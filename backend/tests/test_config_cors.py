"""
Unit and integration tests for application configuration, secure CORS headers,
and app package layout compatibility.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import (
    DEFAULT_CORS_ORIGINS,
    Settings,
    get_settings,
    parse_cors_origins,
    settings,
)
from app.main import app
from fastapi.middleware.cors import CORSMiddleware


# ==============================================================================
# 1. Settings & CORS Origins Tests
# ==============================================================================


def test_cors_origins_not_wildcard():
    """Verify that settings.cors_origins is a list and does NOT contain '*' wildcard."""
    assert isinstance(settings.cors_origins, list)
    assert len(settings.cors_origins) > 0
    # Strict security check: wildcard '*' must NEVER be permitted with credentials
    assert "*" not in settings.cors_origins
    for origin in settings.cors_origins:
        assert origin != "*"
        assert origin.startswith("http://") or origin.startswith("https://")


def test_default_cors_origins_content():
    """Verify default CORS origins contain standard Vite local development URLs."""
    assert "http://localhost:5173" in settings.cors_origins
    assert "http://127.0.0.1:5173" in settings.cors_origins
    assert "http://localhost:4173" in settings.cors_origins


def test_default_config_values():
    """Verify default Settings values for ComfyUI and SQLite database path."""
    assert settings.app_name == "Shotlab API"
    assert "http" in settings.comfyui_url
    assert not settings.comfyui_url.endswith("/")
    assert settings.database_path.endswith(".db")


def test_parse_cors_origins_variations():
    """Verify parse_cors_origins parses CSV strings, JSON lists, and handles edge cases."""
    # Comma-separated string
    csv_input = "http://localhost:3000, https://shotlab.studio, http://127.0.0.1:8000"
    parsed_csv = parse_cors_origins(csv_input)
    assert parsed_csv == [
        "http://localhost:3000",
        "https://shotlab.studio",
        "http://127.0.0.1:8000",
    ]

    # JSON array string
    json_input = '["http://app.shotlab.com", "http://preview.shotlab.com"]'
    parsed_json = parse_cors_origins(json_input)
    assert parsed_json == ["http://app.shotlab.com", "http://preview.shotlab.com"]

    # None and empty strings fallback to default
    assert parse_cors_origins(None) == DEFAULT_CORS_ORIGINS
    assert parse_cors_origins("") == DEFAULT_CORS_ORIGINS
    assert parse_cors_origins("   ") == DEFAULT_CORS_ORIGINS

    # Direct list input
    direct_list = ["http://test.local"]
    assert parse_cors_origins(direct_list) == ["http://test.local"]


def test_custom_settings_instance():
    """Verify Settings model validation and field processing."""
    custom = Settings(
        comfyui_url="http://remote-gpu:8188/",
        database_path="/custom/path/shotlab.db",
        cors_origins="https://custom1.com, https://custom2.com",
    )
    assert custom.comfyui_url == "http://remote-gpu:8188"
    assert custom.database_path == "/custom/path/shotlab.db"
    assert custom.cors_origins == ["https://custom1.com", "https://custom2.com"]


# ==============================================================================
# 2. Package Layout & Import Compatibility Tests
# ==============================================================================


def test_app_main_import_identity():
    """Verify that 'from app.main import app' is identical to 'from main import app'."""
    from main import app as root_app

    assert app is root_app
    assert app.title == settings.app_title
    assert app.version == settings.app_version


def test_all_app_subpackages_importable():
    """Verify that all app subpackages (core, api, models, services, db) are importable."""
    from app.api import events, optics, render, scenes
    from app.core.config import settings as core_settings
    from app.db.database import get_db_path, init_db
    from app.models.optics import OpticsComputeResponse, SensorPresetModel
    from app.models.scene import CameraModel, SceneGraphModel
    from app.services.comfyui_client import ComfyUIClient
    from app.services.validator import validate_physical_scene

    assert core_settings is settings
    assert scenes.router is not None
    assert render.router is not None
    assert events.router is not None
    assert optics.router is not None
    assert SceneGraphModel is not None
    assert CameraModel is not None
    assert OpticsComputeResponse is not None
    assert SensorPresetModel is not None
    assert ComfyUIClient is not None
    assert callable(validate_physical_scene)
    assert callable(init_db)
    assert callable(get_db_path)


# ==============================================================================
# 3. HTTP CORS Behavior Tests
# ==============================================================================


def test_cors_middleware_is_configured_on_app():
    """Verify CORSMiddleware exists in app middleware stack with strict origin list."""
    cors_middleware_found = False
    for middleware in app.user_middleware:
        if middleware.cls is CORSMiddleware:
            cors_middleware_found = True
            allow_origins = middleware.kwargs.get("allow_origins", [])
            assert "*" not in allow_origins
            assert "http://localhost:5173" in allow_origins
            assert middleware.kwargs.get("allow_credentials") is True
            break
    assert cors_middleware_found, "CORSMiddleware was not registered on FastAPI app"


@pytest.mark.anyio
async def test_cors_preflight_allowed_origin():
    """Verify that OPTIONS preflight request from allowed origin returns 200 and allow headers."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.options("/v1/scenes/default", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


@pytest.mark.anyio
async def test_cors_preflight_disallowed_origin():
    """Verify that OPTIONS preflight request from disallowed origin does not grant CORS access."""
    headers = {
        "Origin": "http://evil-attacker.example.com",
        "Access-Control-Request-Method": "POST",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.options("/v1/scenes/default", headers=headers)
    assert response.headers.get("access-control-allow-origin") != "http://evil-attacker.example.com"
    assert response.headers.get("access-control-allow-origin") != "*"
