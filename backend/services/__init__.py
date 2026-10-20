"""
Shotlab Services Package
"""

from services import comfyui_client, lighting_studio, optics, validator
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
from services.lighting_studio import (
    LIGHT_MODIFIERS,
    GEL_PRESETS,
    LightModifier,
    GelPreset,
    SetPlanDataResponse,
    generate_set_plan_data,
    generate_set_plan_svg,
    kelvin_to_srgb,
    kelvin_to_linear_rgb,
    calculate_light_geometry,
)

__all__ = [
    "validator",
    "optics",
    "comfyui_client",
    "lighting_studio",
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
    "LIGHT_MODIFIERS",
    "GEL_PRESETS",
    "LightModifier",
    "GelPreset",
    "SetPlanDataResponse",
    "generate_set_plan_data",
    "generate_set_plan_svg",
    "kelvin_to_srgb",
    "kelvin_to_linear_rgb",
    "calculate_light_geometry",
]
