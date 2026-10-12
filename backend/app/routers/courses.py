"""
Courses + topics + progress endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import Course, Topic
from app.models.schemas import TopicOut

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("")
def list_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).all()
    return [{"id": c.id, "title": c.title} for c in courses]


@router.get("/{course_id}/topics", response_model=list[TopicOut])
def list_topics(course_id: str, db: Session = Depends(get_db)):
    topics = db.query(Topic).filter(Topic.course_id == course_id).all()
    if not topics:
        raise HTTPException(404, "No topics found for this course")
    return [
        TopicOut(id=t.id, name=t.name, mastery=t.mastery, prerequisites=t.prerequisites or [])
        for t in topics
    ]


@router.get("/{course_id}/progress")
def progress_summary(course_id: str, db: Session = Depends(get_db)):
    topics = db.query(Topic).filter(Topic.course_id == course_id).all()
    if not topics:
        raise HTTPException(404, "No topics found for this course")
    overall = round(sum(t.mastery for t in topics) / len(topics)) if topics else 0
    weak = sorted(({"topic": t.name, "mastery": t.mastery} for t in topics), key=lambda x: x["mastery"])
    return {
        "overall_mastery": overall,
        "topics": [{"topic": t.name, "mastery": t.mastery} for t in topics],
        "weak_topics": [w for w in weak if w["mastery"] < 60],
    }
