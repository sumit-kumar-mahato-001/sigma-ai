"""
Sigma backend — FastAPI entrypoint.

Run with:  uvicorn app.main:app --reload
Docs at:   http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.seed import seed
from app.routers import courses, materials, chat, assessments, auth

settings = get_settings()

app = FastAPI(title="Sigma API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed()


@app.get("/api/health")
def health():
    return {"status": "ok", "gemini_configured": bool(settings.gemini_api_key)}


app.include_router(courses.router)
app.include_router(materials.router)
app.include_router(chat.router)
app.include_router(assessments.router)
app.include_router(auth.router)
