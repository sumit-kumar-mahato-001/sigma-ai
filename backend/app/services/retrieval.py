"""
Very small in-process retrieval ("RAG-lite"): ranks stored text chunks for
a course against a question using keyword overlap and basic TF-IDF.
"""
from __future__ import annotations
import re
from collections import Counter
from sqlalchemy.orm import Session
import math

from app.models.orm import Chunk, Material

STOPWORDS = {
    "the","a","an","is","are","of","in","on","to","and","or","for","what",
    "explain","how","why","does","do","it","this","that","with","your",
    "mein","ka","ki","ke","hai","kya","kaise","samjho","batao",
    "ko","se","hi","bhi","yeh","woh","hai","hain","tha","thi","the",
    "karo","karein","kya","kaun","kab","kaha","kyun"
}


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 2]


def _get_bigrams(tokens: list[str]) -> list[str]:
    return [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]


def search_course(db: Session, course_id: str, question: str, top_k: int = 3) -> list[tuple[Chunk, Material, float]]:
    """Return the best matching chunks (with their source material) for a question."""
    q_tokens = _tokenize(question)
    q_bigrams = _get_bigrams(q_tokens)
    
    q_terms = set(q_tokens + q_bigrams)
    
    if not q_terms:
        return []

    rows = (
        db.query(Chunk, Material)
        .join(Material, Chunk.material_id == Material.id)
        .filter(Material.course_id == course_id)
        .all()
    )

    if not rows:
        return []

    # Calculate document frequencies
    df = Counter()
    doc_terms = []
    for chunk, material in rows:
        c_tokens = _tokenize(chunk.text)
        c_bigrams = _get_bigrams(c_tokens)
        c_terms_list = c_tokens + c_bigrams
        c_terms_set = set(c_terms_list)
        doc_terms.append((chunk, material, c_terms_list, c_terms_set))
        for term in c_terms_set:
            df[term] += 1
            
    num_docs = len(rows)
    
    # Calculate idf
    idf = {}
    for term, count in df.items():
        idf[term] = math.log((num_docs + 1) / (count + 1)) + 1

    scored = []
    for chunk, material, c_terms_list, c_terms_set in doc_terms:
        tf = Counter(c_terms_list)
        
        score = 0.0
        for term in q_terms:
            if term in c_terms_set:
                tf_val = tf[term]
                score += tf_val * idf.get(term, 0)
                
        if score > 0:
            scored.append((score, chunk, material))

    if not scored:
        return []
        
    scored.sort(key=lambda x: x[0], reverse=True)
    
    max_score = scored[0][0]
    
    results = []
    for score, chunk, material in scored[:top_k]:
        normalized_score = min(100.0, (score / max_score) * 100.0) if max_score > 0 else 0.0
        results.append((chunk, material, normalized_score))
        
    return results
