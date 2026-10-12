"""
Authentication and User Management router:
- Multi-user signup with 6-digit OTP verification (email / phone)
- Password reset via OTP
- Persistent user progress in the database
"""
import hashlib
import os
import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import User, OTPRecord, UserProgress
from app.models.schemas import (
    SignupSendOtpIn, VerifyOtpIn, LoginIn, ResetPasswordSendOtpIn,
    ResetPasswordVerifyIn, AuthResponse, UserOut, ProgressOut, ProgressUpdateIn
)
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        if ":" not in stored_password:
            return stored_password == provided_password
        salt, hashed = stored_password.split(":", 1)
        rehashed = hashlib.sha256((salt + provided_password).encode("utf-8")).hexdigest()
        return rehashed == hashed
    except Exception:
        return False


def generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


DEFAULT_TOPICS_MASTERY = {
    "ER Model": 85.0,
    "SQL": 72.0,
    "Normalization": 45.0,
    "Transactions": 30.0,
}


@router.post("/signup/send-otp", response_model=AuthResponse)
def signup_send_otp(body: SignupSendOtpIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip().lower()
    if not ident:
        raise HTTPException(400, "Email or phone number is required")
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    if len(body.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")

    existing_user = db.query(User).filter(User.identifier == ident).first()
    if existing_user and existing_user.is_verified:
        raise HTTPException(400, "An account with this email/phone already exists. Please log in.")

    # Generate 6-digit OTP
    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Save OTP record
    otp_rec = OTPRecord(
        identifier=ident,
        otp_code=otp_code,
        purpose="signup",
        expires_at=expires_at,
        is_used=False
    )
    db.add(otp_rec)

    # Stage user record
    if not existing_user:
        user = User(
            name=body.name.strip(),
            identifier=ident,
            hashed_password=hash_password(body.password),
            is_verified=False
        )
        db.add(user)
    else:
        existing_user.name = body.name.strip()
        existing_user.hashed_password = hash_password(body.password)
        existing_user.is_verified = False

    db.commit()

    send_otp_email(ident, otp_code, purpose="signup")

    return AuthResponse(
        status="otp_sent",
        message=f"A 6-digit verification code has been sent to {ident}.",
        debug_otp=otp_code  # Visible for direct verification in browser
    )


@router.post("/signup/verify-otp", response_model=AuthResponse)
def signup_verify_otp(body: VerifyOtpIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip().lower()
    otp_code = body.otp_code.strip()

    otp_rec = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.identifier == ident,
            OTPRecord.otp_code == otp_code,
            OTPRecord.purpose == "signup",
            OTPRecord.is_used == False,
            OTPRecord.expires_at > datetime.utcnow()
        )
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if not otp_rec:
        raise HTTPException(400, "Invalid or expired OTP code. Please enter the correct 6-digit code.")

    otp_rec.is_used = True

    user = db.query(User).filter(User.identifier == ident).first()
    if not user:
        raise HTTPException(404, "User record not found")

    user.is_verified = True

    # Initialize user's progress record in DB if not already present
    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    if not progress:
        progress = UserProgress(
            user_id=user.id,
            overall_mastery=68.0,
            topics_mastery=dict(DEFAULT_TOPICS_MASTERY),
            quizzes_taken=2,
            correct_answers=7,
            total_questions=10,
            study_streak_days=1,
            weekly_goal_sessions=3,
            history=[
                {"date": "Day 1", "topic": "ER Model", "score_pct": 85},
                {"date": "Day 2", "topic": "SQL", "score_pct": 72}
            ]
        )
        db.add(progress)

    db.commit()
    db.refresh(user)

    return AuthResponse(
        status="ok",
        message="Account created and verified successfully!",
        token=f"token_{user.id}",
        user=UserOut(id=user.id, name=user.name, identifier=user.identifier)
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip().lower()
    user = db.query(User).filter(User.identifier == ident).first()

    if not user or not verify_password(user.hashed_password, body.password):
        raise HTTPException(400, "Invalid email/phone or password. Please try again.")

    if not user.is_verified:
        raise HTTPException(400, "Account not verified. Please complete OTP verification first.")

    # Ensure progress record exists
    progress = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    if not progress:
        progress = UserProgress(
            user_id=user.id,
            overall_mastery=68.0,
            topics_mastery=dict(DEFAULT_TOPICS_MASTERY),
            quizzes_taken=2,
            correct_answers=7,
            total_questions=10,
            study_streak_days=1,
            weekly_goal_sessions=3,
            history=[]
        )
        db.add(progress)
        db.commit()

    return AuthResponse(
        status="ok",
        message="Login successful",
        token=f"token_{user.id}",
        user=UserOut(id=user.id, name=user.name, identifier=user.identifier)
    )


@router.post("/reset-password/send-otp", response_model=AuthResponse)
def reset_password_send_otp(body: ResetPasswordSendOtpIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip().lower()
    user = db.query(User).filter(User.identifier == ident).first()
    if not user:
        raise HTTPException(404, "No registered account found with this email or phone number.")

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    otp_rec = OTPRecord(
        identifier=ident,
        otp_code=otp_code,
        purpose="reset_password",
        expires_at=expires_at,
        is_used=False
    )
    db.add(otp_rec)
    db.commit()

    send_otp_email(ident, otp_code, purpose="reset_password")

    return AuthResponse(
        status="otp_sent",
        message=f"A password reset code has been sent to {ident}.",
        debug_otp=otp_code
    )


@router.post("/reset-password/verify", response_model=AuthResponse)
def reset_password_verify(body: ResetPasswordVerifyIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip().lower()
    otp_code = body.otp_code.strip()

    if len(body.new_password) < 4:
        raise HTTPException(400, "New password must be at least 4 characters")

    otp_rec = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.identifier == ident,
            OTPRecord.otp_code == otp_code,
            OTPRecord.purpose == "reset_password",
            OTPRecord.is_used == False,
            OTPRecord.expires_at > datetime.utcnow()
        )
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if not otp_rec:
        raise HTTPException(400, "Invalid or expired OTP code. Please try again.")

    otp_rec.is_used = True

    user = db.query(User).filter(User.identifier == ident).first()
    if not user:
        raise HTTPException(404, "User account not found")

    user.hashed_password = hash_password(body.new_password)
    user.is_verified = True
    db.commit()

    return AuthResponse(
        status="ok",
        message="Password has been reset successfully! You can now log in.",
        user=UserOut(id=user.id, name=user.name, identifier=user.identifier)
    )


@router.get("/progress", response_model=ProgressOut)
def get_user_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        # Create default progress for user
        progress = UserProgress(
            user_id=user_id,
            overall_mastery=68.0,
            topics_mastery=dict(DEFAULT_TOPICS_MASTERY),
            quizzes_taken=2,
            correct_answers=7,
            total_questions=10,
            study_streak_days=1,
            weekly_goal_sessions=3,
            history=[
                {"date": "Day 1", "topic": "ER Model", "score_pct": 85},
                {"date": "Day 2", "topic": "SQL", "score_pct": 72}
            ]
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)

    topics_dict = progress.topics_mastery or dict(DEFAULT_TOPICS_MASTERY)
    weak = [
        {"topic": k, "mastery": v}
        for k, v in topics_dict.items()
        if v < 60
    ]
    weak.sort(key=lambda x: x["mastery"])

    return ProgressOut(
        user_id=progress.user_id,
        overall_mastery=progress.overall_mastery,
        topics_mastery=topics_dict,
        quizzes_taken=progress.quizzes_taken,
        correct_answers=progress.correct_answers,
        total_questions=progress.total_questions,
        study_streak_days=progress.study_streak_days,
        weekly_goal_sessions=progress.weekly_goal_sessions,
        history=progress.history or [],
        weak_topics=weak
    )


@router.post("/progress", response_model=ProgressOut)
def update_user_progress(body: ProgressUpdateIn, db: Session = Depends(get_db)):
    progress = db.query(UserProgress).filter(UserProgress.user_id == body.user_id).first()
    if not progress:
        progress = UserProgress(
            user_id=body.user_id,
            overall_mastery=68.0,
            topics_mastery=dict(DEFAULT_TOPICS_MASTERY),
            quizzes_taken=0,
            correct_answers=0,
            total_questions=0,
            study_streak_days=1,
            weekly_goal_sessions=3,
            history=[]
        )
        db.add(progress)

    if body.topics_mastery is not None:
        current = dict(progress.topics_mastery or DEFAULT_TOPICS_MASTERY)
        current.update(body.topics_mastery)
        progress.topics_mastery = current
        if current:
            progress.overall_mastery = round(sum(current.values()) / len(current), 1)

    if body.quizzes_taken is not None:
        progress.quizzes_taken = body.quizzes_taken

    if body.correct_answers is not None:
        progress.correct_answers = body.correct_answers

    if body.total_questions is not None:
        progress.total_questions = body.total_questions

    if body.study_streak_days is not None:
        progress.study_streak_days = body.study_streak_days

    progress.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(progress)

    topics_dict = progress.topics_mastery or dict(DEFAULT_TOPICS_MASTERY)
    weak = [
        {"topic": k, "mastery": v}
        for k, v in topics_dict.items()
        if v < 60
    ]
    weak.sort(key=lambda x: x["mastery"])

    return ProgressOut(
        user_id=progress.user_id,
        overall_mastery=progress.overall_mastery,
        topics_mastery=topics_dict,
        quizzes_taken=progress.quizzes_taken,
        correct_answers=progress.correct_answers,
        total_questions=progress.total_questions,
        study_streak_days=progress.study_streak_days,
        weekly_goal_sessions=progress.weekly_goal_sessions,
        history=progress.history or [],
        weak_topics=weak
    )
