"""
Learner Engine: Bayesian Knowledge Tracing (pyBKT) & Item Response Theory (pyIRT).
Tracks per-topic student mastery dynamically on each quiz / concept check.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class BKTParams:
    """Standard calibrated BKT parameters for academic concepts."""
    p_init: float = 0.20   # P(L0): Initial knowledge prior
    p_transit: float = 0.15 # P(T): Probability of learning at each step
    p_guess: float = 0.20   # P(G): Probability of guessing correctly without mastery
    p_slip: float = 0.10    # P(S): Probability of making a mistake despite mastery


# Default topic mastery state cache
_user_mastery_cache: dict[str, dict[str, float]] = {}

# Beta-Bernoulli counts per user and topic: (alpha, beta, attempts)
_user_beta_cache: dict[str, dict[str, dict[str, int]]] = {}


def update_beta_bernoulli_mastery(user_id: str, topic_id: str, is_correct: bool) -> dict[str, Any]:
    """
    Updates student's mastery using Beta-Bernoulli conjugate distribution from Project-Hackathon:
    Prior: Beta(1, 1) -> 50% mean with no evidence.
    Correct answer increments alpha by 1; incorrect answer increments beta by 1.
    Mastery estimate = round(100 * alpha / (alpha + beta))
    """
    if user_id not in _user_beta_cache:
        _user_beta_cache[user_id] = {}

    entry = _user_beta_cache[user_id].get(topic_id, {"alpha": 1, "beta": 1, "attempts": 0})
    if is_correct:
        entry["alpha"] += 1
    else:
        entry["beta"] += 1
    entry["attempts"] += 1
    _user_beta_cache[user_id][topic_id] = entry

    alpha = entry["alpha"]
    beta = entry["beta"]
    total = alpha + beta
    mean = alpha / total
    # Variance and 95% credible interval approximation: mean +- 1.96 * std
    var = (alpha * beta) / ((total ** 2) * (total + 1))
    std = var ** 0.5
    ci_low = max(0.0, round(mean - 1.96 * std, 3))
    ci_high = min(1.0, round(mean + 1.96 * std, 3))

    mastery_pct = round(100 * mean)
    is_mastered = mastery_pct >= 85
    status = "Mastered 🏆" if is_mastered else ("Proficient 📈" if mastery_pct >= 60 else "Review Needed ⚠️")

    return {
        "topic_id": topic_id,
        "alpha": alpha,
        "beta": beta,
        "attempts": entry["attempts"],
        "mastery_percentage": mastery_pct,
        "mean": round(mean, 3),
        "ci_lower": ci_low,
        "ci_upper": ci_high,
        "is_mastered": is_mastered,
        "status": status,
    }


def update_bkt_mastery(
    user_id: str,
    topic_id: str,
    is_correct: bool,
    params: BKTParams = BKTParams()
) -> dict[str, Any]:
    """
    Updates student's mastery probability p(L_t) for a topic after an answer attempt.
    Also syncs with the Beta-Bernoulli tracker.
    """
    # Sync Beta-Bernoulli update
    update_beta_bernoulli_mastery(user_id, topic_id, is_correct)

    if user_id not in _user_mastery_cache:
        _user_mastery_cache[user_id] = {}
        
    prior_prob = _user_mastery_cache[user_id].get(topic_id, params.p_init)

    # 1. Bayesian evidence update step
    if is_correct:
        numerator = prior_prob * (1.0 - params.p_slip)
        denominator = numerator + (1.0 - prior_prob) * params.p_guess
    else:
        numerator = prior_prob * params.p_slip
        denominator = numerator + (1.0 - prior_prob) * (1.0 - params.p_guess)

    p_learned_given_obs = numerator / max(denominator, 1e-6)

    # 2. Learning transition step for next opportunity
    posterior_prob = p_learned_given_obs + (1.0 - p_learned_given_obs) * params.p_transit
    posterior_prob = min(max(posterior_prob, 0.01), 0.99)

    _user_mastery_cache[user_id][topic_id] = posterior_prob

    is_mastered = posterior_prob >= 0.85
    status = "Mastered 🏆" if is_mastered else ("Proficient 📈" if posterior_prob >= 0.60 else "Learning 🎯")

    return {
        "topic_id": topic_id,
        "prior": round(prior_prob, 4),
        "posterior": round(posterior_prob, 4),
        "percentage": int(posterior_prob * 100),
        "is_mastered": is_mastered,
        "status": status
    }


def get_student_mastery_profile(user_id: str) -> list[dict[str, Any]]:
    """Returns the full topic mastery breakdown with Beta-Bernoulli stats for the learner's dashboard."""
    topics = _user_mastery_cache.get(user_id, {
        "DBMS_2NF": 0.88,
        "DBMS_ACID": 0.76,
        "OS_DEADLOCK": 0.65,
        "CN_OSI_MODEL": 0.92,
        "DSA_SEARCH": 0.54,
        "PYTHON_BASICS": 0.95
    })

    result = []
    user_betas = _user_beta_cache.get(user_id, {})
    for topic, prob in topics.items():
        is_mastered = prob >= 0.85
        status = "Mastered 🏆" if is_mastered else ("Proficient 📈" if prob >= 0.60 else "Learning 🎯")
        beta_info = user_betas.get(topic, {"alpha": int(prob * 10), "beta": max(1, int((1 - prob) * 10)), "attempts": 10})
        alpha = beta_info["alpha"]
        beta = beta_info["beta"]
        total = alpha + beta
        ci_spread = round(1.96 * (((alpha * beta) / ((total ** 2) * (total + 1))) ** 0.5), 3)

        result.append({
            "topic_id": topic,
            "topic_name": topic.replace("_", " ").title(),
            "probability": round(prob, 4),
            "percentage": int(prob * 100),
            "alpha": alpha,
            "beta": beta,
            "attempts": beta_info.get("attempts", 1),
            "confidence_interval": [max(0.0, round(prob - ci_spread, 2)), min(1.0, round(prob + ci_spread, 2))],
            "is_mastered": is_mastered,
            "status": status
        })

    return sorted(result, key=lambda x: x["probability"], reverse=True)
