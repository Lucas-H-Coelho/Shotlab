"""
Shotlab App Main Entrypoint
Re-exports FastAPI application instance from main.py, enabling uvicorn app.main:app.
"""

from main import app, health_check, lifespan

__all__ = ["app", "lifespan", "health_check"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
