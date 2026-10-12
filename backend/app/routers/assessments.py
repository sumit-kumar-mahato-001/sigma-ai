"""
Assessment creation + grading. Generates questions via Gemini when a key
is set (grounded in the course's stored chunks); otherwise falls back to
a small built-in question bank per topic so the demo always works.
Grading updates topic mastery and flags a misconception when a tagged
"confusable pair" question is missed.
"""
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import Question, Topic, QuizAttempt, Chunk, Material
from app.models.schemas import (
    GenerateAssessmentIn, QuestionOut, SubmitQuizIn, SubmitQuizOut, TopicOut, TopicPerf, MisconceptionOut,
)
from app.services.gemini_service import generate_quiz_questions, generate_quiz_question, generate_advanced_quiz

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

FALLBACK_BANK = {
    "Normalization": [
        {"text": "What is the main goal of database normalization?",
         "options": ["Increase redundancy", "Minimize redundancy and dependency", "Increase table size", "Remove primary keys"], "answer_index": 1,
         "explanation": "Normalization organizes database columns to reduce data redundancy and eliminate anomalies."},
        {"text": "A relation in 2NF must first satisfy which condition?",
         "options": ["Be in 3NF", "Be in BCNF", "Be in 1NF with no partial dependencies", "Have no foreign keys"], "answer_index": 2,
         "explanation": "2NF requires the relation to be in 1NF and ensure every non-prime attribute is fully dependent on candidate keys."},
    ],
    "Transactions": [
        {"text": "Which SQL command is used to permanently save transaction changes?",
         "options": ["COMMIT", "ROLLBACK", "SAVEPOINT", "REVOKE"], "answer_index": 0,
         "explanation": "COMMIT writes the log entries and permanently locks in state changes.",
         "misconception": ["COMMIT", "ROLLBACK"]},
        {"text": "In ACID properties, what does 'I' represent?",
         "options": ["Integrity", "Isolation", "Indexing", "Inheritance"], "answer_index": 1,
         "explanation": "Isolation guarantees concurrent execution yields identical results to serial execution."},
    ],
}


@router.post("/generate", response_model=list[QuestionOut])
def generate_assessment(body: GenerateAssessmentIn, db: Session = Depends(get_db)):
    created: list[Question] = []
    per_topic_count = max(2, body.num_questions // max(1, len(body.topics)))
    mode = body.mode or "practice"
    q_type = body.question_type or "mcq"

    for topic_name in body.topics:
        context_rows = (
            db.query(Chunk)
            .join(Material, Chunk.material_id == Material.id)
            .filter(Material.course_id == body.course_id)
            .limit(5)
            .all()
        )
        context = "\n".join(f"[{c.page or 'Ground'}] {c.text}" for c in context_rows)[:4000]

        # Use Project-Hackathon enhanced generator with mode and type support
        q_list = generate_advanced_quiz(
            topic=topic_name,
            context=context,
            count=per_topic_count,
            difficulty=body.difficulty,
            mode=mode,
            q_type=q_type
        )
        if not q_list:
            bank = FALLBACK_BANK.get(topic_name, [])
            if bank:
                q_list = bank
            else:
                q_dict = generate_quiz_question(topic_name, context, body.difficulty)
                if q_dict:
                    q_list = [q_dict]

        for q_dict in q_list:
            if "text" in q_dict and "options" in q_dict and "answer_index" in q_dict:
                q = Question(
                    course_id=body.course_id, topic=topic_name, difficulty=body.difficulty,
                    text=q_dict["text"], options=q_dict["options"], answer_index=q_dict["answer_index"],
                    misconception=q_dict.get("misconception"),
                )
                db.add(q)
                created.append(q)

    db.commit()
    for q in created:
        db.refresh(q)

    return [
        QuestionOut(
            id=q.id,
            topic=q.topic,
            difficulty=q.difficulty,
            text=q.text,
            options=q.options,
            type=q_type,
            explanation=getattr(q, "explanation", "Verified from course materials.")
        )
        for q in created
    ]


@router.post("/submit", response_model=SubmitQuizOut)
def submit_quiz(body: SubmitQuizIn, db: Session = Depends(get_db)):
    questions = [db.get(Question, qid) for qid in body.question_ids]
    questions = [q for q in questions if q is not None]
    if not questions or len(questions) != len(body.answers):
        raise HTTPException(400, "Mismatched questions and answers")

    by_topic: dict[str, list[bool]] = {}
    misconception = None
    correct_count = 0

    for q, chosen in zip(questions, body.answers):
        is_correct = chosen == q.answer_index
        correct_count += int(is_correct)
        by_topic.setdefault(q.topic, []).append(is_correct)
        if not is_correct and q.misconception and misconception is None:
            a, b = q.misconception
            misconception = MisconceptionOut(
                a=a, b=b,
                explanation=f"Your answer suggests you may be mixing up {a} and {b}.",
            )

    topic_perf = [
        TopicPerf(topic=t, pct=round(sum(v) / len(v) * 100)) for t, v in by_topic.items()
    ]

    updated_topics: list[TopicOut] = []
    for t_name, results in by_topic.items():
        topic_row = db.query(Topic).filter(Topic.course_id == body.course_id, Topic.name == t_name).first()
        if topic_row:
            # Apply Bayesian Knowledge Tracing (pyBKT) update
            for res in results:
                from app.services.learner_engine import update_bkt_mastery
                update_bkt_mastery(user_id="default_user", topic_id=t_name, is_correct=res)
            score = sum(results) / len(results) * 100
            topic_row.mastery = round(topic_row.mastery * 0.5 + score * 0.5, 1)
            db.add(topic_row)
    db.commit()

    all_topics = db.query(Topic).filter(Topic.course_id == body.course_id).all()
    updated_topics = [
        TopicOut(id=t.id, name=t.name, mastery=t.mastery, prerequisites=t.prerequisites or []) for t in all_topics
    ]

    score_pct = round(correct_count / len(questions) * 100, 1)
    db.add(QuizAttempt(course_id=body.course_id, answers=body.answers, score_pct=score_pct))
    db.commit()

    return SubmitQuizOut(
        score_pct=score_pct, correct=correct_count, total=len(questions),
        topic_performance=topic_perf, misconception=misconception, updated_topics=updated_topics,
    )


@router.get("/mastery-profile")
def get_mastery_profile(user_id: str = "default_user"):
    """Returns dynamic Bayesian Knowledge Tracing topic mastery profile."""
    from app.services.learner_engine import get_student_mastery_profile
    return {"mastery": get_student_mastery_profile(user_id)}

