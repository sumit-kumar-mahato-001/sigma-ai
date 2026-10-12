"""
Pydantic request/response schemas — the API contract the React frontend
consumes. These mirror src/types.ts so swapping src/api.ts from mock JSON
to fetch() calls is close to a 1:1 rename.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class TopicOut(BaseModel):
    id: str
    name: str
    mastery: float
    prerequisites: list[str]
    source: Optional[str] = None

    class Config:
        from_attributes = True


class MaterialOut(BaseModel):
    id: str
    kind: str
    name: str
    pages: int
    status: str
    video_url: Optional[str] = None

    class Config:
        from_attributes = True


class UploadVideoLinkIn(BaseModel):
    course_id: str
    user_id: Optional[str] = None
    name: str
    url: str


class ChatMessageIn(BaseModel):
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    course_id: Optional[str] = "dbms"
    text: Optional[str] = None
    query: Optional[str] = None
    lang: str = "hn"   # en | hi | hn
    history: Optional[list[dict]] = None


class ChatMessageOut(BaseModel):
    session_id: str
    role: str
    text: str
    covered: bool
    source_file: Optional[str] = None
    source_loc: Optional[str] = None
    confidence: int = 0
    verified: bool = False
    citations: list[str] = []


class ChatSessionOut(BaseModel):
    id: str
    title: str

    class Config:
        from_attributes = True


class QuestionOut(BaseModel):
    id: str
    topic: str
    difficulty: str
    text: str
    options: list[str]
    type: Optional[str] = "mcq"
    explanation: Optional[str] = None
    source_loc: Optional[str] = None

    class Config:
        from_attributes = True


class GenerateAssessmentIn(BaseModel):
    course_id: str
    topics: list[str]
    num_questions: int = 10
    difficulty: str = "Medium"
    mode: Optional[str] = "practice"       # practice | diagnostic | mock_exam
    question_type: Optional[str] = "mcq"   # mcq | short_answer | numerical


class SubmitQuizIn(BaseModel):
    course_id: str
    question_ids: list[str]
    answers: list[int]


class TopicPerf(BaseModel):
    topic: str
    pct: int


class MisconceptionOut(BaseModel):
    a: str
    b: str
    explanation: str


class SubmitQuizOut(BaseModel):
    score_pct: float
    correct: int
    total: int
    topic_performance: list[TopicPerf]
    misconception: Optional[MisconceptionOut] = None
    updated_topics: list[TopicOut]


class SignupSendOtpIn(BaseModel):
    name: str
    identifier: str  # email or phone
    password: str


class VerifyOtpIn(BaseModel):
    identifier: str
    otp_code: str


class LoginIn(BaseModel):
    identifier: str
    password: str


class ResetPasswordSendOtpIn(BaseModel):
    identifier: str


class ResetPasswordVerifyIn(BaseModel):
    identifier: str
    otp_code: str
    new_password: str


class UserOut(BaseModel):
    id: str
    name: str
    identifier: str


class AuthResponse(BaseModel):
    status: str
    message: Optional[str] = None
    token: Optional[str] = None
    debug_otp: Optional[str] = None
    user: Optional[UserOut] = None


class ProgressUpdateIn(BaseModel):
    user_id: str
    topics_mastery: Optional[dict[str, float]] = None
    quizzes_taken: Optional[int] = None
    correct_answers: Optional[int] = None
    total_questions: Optional[int] = None
    study_streak_days: Optional[int] = None


class ProgressOut(BaseModel):
    user_id: str
    overall_mastery: float
    topics_mastery: dict[str, float]
    quizzes_taken: int
    correct_answers: int
    total_questions: int
    study_streak_days: int
    weekly_goal_sessions: int
    history: list[dict]
    weak_topics: list[dict]

