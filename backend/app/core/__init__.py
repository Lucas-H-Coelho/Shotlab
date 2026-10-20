"""
Shotlab App Core Package
Re-exports settings and configuration from core.
"""

from core.config import DEFAULT_CORS_ORIGINS, Settings, get_settings, parse_cors_origins, settings

__all__ = [
    "DEFAULT_CORS_ORIGINS",
    "Settings",
    "get_settings",
    "parse_cors_origins",
    "settings",
]
