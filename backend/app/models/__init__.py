"""
Shotlab App Models Package
Re-exports Pydantic models for scenes and camera optics.
"""

from models import optics, scene
from models.optics import (
    SENSOR_PRESETS,
    DepthOfFieldResult,
    OpticsComputeRequest,
    OpticsComputeResponse,
    SensorPresetModel,
    calculate_circle_of_confusion_mm,
    calculate_depth_of_field_m,
    calculate_diagonal_fov_deg,
    calculate_horizontal_fov_deg,
    calculate_hyperfocal_distance_m,
    calculate_sensor_diagonal_mm,
    calculate_vertical_fov_deg,
    compute_full_optics,
)
from models.scene import (
    CameraModel,
    MaterialModel,
    RenderJobRequest,
    RenderJobResponse,
    SceneGraphModel,
    SceneObjectModel,
)

__all__ = [
    "scene",
    "optics",
    "CameraModel",
    "MaterialModel",
    "RenderJobRequest",
    "RenderJobResponse",
    "SceneGraphModel",
    "SceneObjectModel",
    "SENSOR_PRESETS",
    "DepthOfFieldResult",
    "OpticsComputeRequest",
    "OpticsComputeResponse",
    "SensorPresetModel",
    "calculate_circle_of_confusion_mm",
    "calculate_depth_of_field_m",
    "calculate_diagonal_fov_deg",
    "calculate_horizontal_fov_deg",
    "calculate_hyperfocal_distance_m",
    "calculate_sensor_diagonal_mm",
    "calculate_vertical_fov_deg",
    "compute_full_optics",
]
