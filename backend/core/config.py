"""
Shotlab Core Configuration
Typed application settings loaded from environment variables and .env files.
"""

import json
import os
from typing import List, Union
from pydantic import BaseModel, Field, field_validator

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

DEFAULT_CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]


def parse_cors_origins(val: Union[str, List[str], None]) -> List[str]:
    """
    Parse CORS origins from str (comma-separated or JSON list) or list.
    Guarantees clean URLs and fallback to safe local origins.
    """
    if not val:
        return list(DEFAULT_CORS_ORIGINS)
    if isinstance(val, list):
        return [str(origin).strip() for origin in val if str(origin).strip()]
    raw = str(val).strip()
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


class Settings(BaseModel):
    """
    Typed application configuration for Shotlab backend.
    """

    app_name: str = "Shotlab API"
    app_title: str = "Shotlab — Estúdio Fotográfico Virtual com IA API"
    app_version: str = "1.0.0"

    # ComfyUI server base URL (HTTP / WebSocket)
    comfyui_url: str = Field(
        default_factory=lambda: os.getenv("COMFYUI_URL", "http://localhost:8188").rstrip("/")
    )

    # SQLite database file path
    database_path: str = Field(
        default_factory=lambda: os.getenv("DATABASE_PATH")
        or os.getenv("SHOTLAB_DB_PATH")
        or "shotlab.db"
    )

    # Allowed CORS origins (strict list, no wildcard allowed with credentials)
    cors_origins: List[str] = Field(
        default_factory=lambda: parse_cors_origins(os.getenv("CORS_ORIGINS"))
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def validate_cors_origins(cls, v: Union[str, List[str], None]) -> List[str]:
        return parse_cors_origins(v)

    @field_validator("comfyui_url", mode="before")
    @classmethod
    def validate_comfyui_url(cls, v: str) -> str:
        if isinstance(v, str):
            return v.rstrip("/")
        return v


def get_settings() -> Settings:
    """Return an instance of Settings populated from environment."""
    return Settings()


# Global singleton instance for application use
settings = get_settings()
