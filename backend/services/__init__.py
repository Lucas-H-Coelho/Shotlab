"""
Shotlab Services Package
"""

from services import comfyui_client, optics, validator
from services.comfyui_client import (
    ComfyUIClient,
    ComfyUIError,
    ComfyUIOfflineError,
    build_moss_layout_from_scene,
    build_moss_workflow,
    build_qwen_workflow,
    check_health,
    default_comfyui_client,
    queue_prompt,
    stream_progress,
    upload_image,
)
from services.validator import (
    check_aabb_collisions,
    check_floor_contact,
    validate_physical_scene,
)

__all__ = [
    "validator",
    "optics",
    "comfyui_client",
    "ComfyUIClient",
    "ComfyUIError",
    "ComfyUIOfflineError",
    "build_moss_layout_from_scene",
    "build_moss_workflow",
    "build_qwen_workflow",
    "check_health",
    "default_comfyui_client",
    "queue_prompt",
    "stream_progress",
    "upload_image",
    "check_aabb_collisions",
    "check_floor_contact",
    "validate_physical_scene",
]
