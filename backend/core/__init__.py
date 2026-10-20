"""
Shotlab Core Package
"""

from core.config import DEFAULT_CORS_ORIGINS, Settings, get_settings, parse_cors_origins, settings

__all__ = [
    "DEFAULT_CORS_ORIGINS",
    "Settings",
    "get_settings",
    "parse_cors_origins",
    "settings",
]
