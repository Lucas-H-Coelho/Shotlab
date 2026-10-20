"""
Shotlab App API Package
Re-exports router modules and endpoints.
"""

from routers import assets, events, optics, render, scenes
from routers.assets import router as assets_router
from routers.events import router as events_router
from routers.optics import router as optics_router
from routers.render import router as render_router
from routers.scenes import router as scenes_router

__all__ = [
    "assets",
    "scenes",
    "render",
    "events",
    "optics",
    "assets_router",
    "scenes_router",
    "render_router",
    "events_router",
    "optics_router",
]
