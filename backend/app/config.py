"""
Central app settings, loaded from environment variables / .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    database_url: str = "sqlite:///./storage/db/sigma.db"
    frontend_origin: str = "http://localhost:5173"
    upload_dir: str = "./storage/uploads"

    # Optional SMTP for emails
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
