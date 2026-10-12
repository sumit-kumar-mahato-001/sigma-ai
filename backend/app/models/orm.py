"""
SQLAlchemy ORM models — the real persistence layer behind the mock JSON
the frontend used in Phase 1. Field names intentionally mirror
src/types.ts on the frontend so the API responses map 1:1 onto it.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, ForeignKey, JSON, Boolean
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id() -> str:
    return uuid.uuid4().hex[:12]


class Course(Base):
    __tablename__ = "courses"
    id = Column(String, primary_key=True, default=gen_id)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    materials = relationship("Material", back_populates="course", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="course", cascade="all, delete-orphan")


class Material(Base):
    """An uploaded PDF / PPT / image, or a linked video."""
    __tablename__ = "materials"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    kind = Column(String, nullable=False)          # pdf | ppt | image | video
    name = Column(String, nullable=False)
    path = Column(String, nullable=True)            # local file path, if uploaded
    video_url = Column(String, nullable=True)        # external link, if video-by-link
    pages = Column(Integer, default=0)
    status = Column(String, default="processing")   # processing | ready | error
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="materials")
    user = relationship("User", back_populates="materials")
    chunks = relationship("Chunk", back_populates="material", cascade="all, delete-orphan")


class Chunk(Base):
    """A piece of extracted text used for retrieval (RAG)."""
    __tablename__ = "chunks"
    id = Column(String, primary_key=True, default=gen_id)
    material_id = Column(String, ForeignKey("materials.id"))
    page = Column(String, nullable=True)   # page number, slide number, or mm:ss timestamp
    text = Column(Text, nullable=False)
    topic = Column(String, nullable=True)

    material = relationship("Material", back_populates="chunks")


class Topic(Base):
    __tablename__ = "topics"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"))
    name = Column(String, nullable=False)
    mastery = Column(Float, default=0)
    prerequisites = Column(JSON, default=list)

    course = relationship("Course", back_populates="topics")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    identifier = Column(String, unique=True, index=True, nullable=False)  # email or phone
    hashed_password = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    progress = relationship("UserProgress", back_populates="user", uselist=False, cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")


class OTPRecord(Base):
    __tablename__ = "otp_records"
    id = Column(String, primary_key=True, default=gen_id)
    identifier = Column(String, index=True, nullable=False)
    otp_code = Column(String, nullable=False)
    purpose = Column(String, default="signup")  # signup | reset_password
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)


class UserProgress(Base):
    __tablename__ = "user_progress"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    overall_mastery = Column(Float, default=68.0)
    topics_mastery = Column(JSON, default=dict)  # {"Normalization": 45, "Transactions": 72}
    quizzes_taken = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    study_streak_days = Column(Integer, default=1)
    weekly_goal_sessions = Column(Integer, default=3)
    history = Column(JSON, default=list)  # list of attempts
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="progress")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String, default="New chat")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("chat_sessions.id"))
    role = Column(String, nullable=False)   # user | assistant
    text = Column(Text, nullable=False)
    lang = Column(String, default="en")
    covered = Column(Boolean, default=True)
    source_file = Column(String, nullable=True)
    source_loc = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class Question(Base):
    __tablename__ = "questions"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"))
    topic = Column(String, nullable=False)
    difficulty = Column(String, default="Medium")
    text = Column(Text, nullable=False)
    options = Column(JSON, default=list)
    answer_index = Column(Integer, nullable=False)
    misconception = Column(JSON, nullable=True)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    answers = Column(JSON, default=list)     # list[int] chosen option index per question
    score_pct = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_attempts")
