"""
Database engine/session setup (SQLite file via SQLAlchemy ORM).
Swap DATABASE_URL in .env to Postgres later without changing any model code.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import get_settings

settings = get_settings()

db_url = settings.database_url or "sqlite:///./storage/db/sigma.db"
# Supabase and Render URLs: ensure postgresql+psycopg2 driver is used
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

if db_url.startswith("sqlite"):
    db_file_path = db_url.replace("sqlite:///", "")
    dir_name = os.path.dirname(db_file_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)
else:
    # PostgreSQL (Supabase) engine with keepalive & pool pre-ping
    engine = create_engine(db_url, pool_pre_ping=True, pool_size=10, max_overflow=20)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
