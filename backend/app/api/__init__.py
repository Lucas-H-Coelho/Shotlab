"""
Shotlab App API Package
Re-exports router modules and endpoints.
"""

from routers import events, optics, render, scenes
from routers.events import router as events_router
from routers.optics import router as optics_router
from routers.render import router as render_router
from routers.scenes import router as scenes_router

__all__ = [
    "scenes",
    "render",
    "events",
    "optics",
    "scenes_router",
    "render_router",
    "events_router",
    "optics_router",
]
