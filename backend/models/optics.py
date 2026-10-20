import math
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class SensorPresetModel(BaseModel):
    id: str
    name: str
    width_mm: float
    height_mm: float
    description: str

SENSOR_PRESETS: Dict[str, Dict[str, Any]] = {
    "FULL_FRAME_35MM": {
        "id": "FULL_FRAME_35MM",
        "name": "35mm Full Frame",
        "width_mm": 36.0,
        "height_mm": 24.0,
        "description": "Padrão fotográfico 3:2 (36x24mm)",
    },
    "SUPER_35_APSC": {
        "id": "SUPER_35_APSC",
        "name": "Super 35 / APS-C",
        "width_mm": 23.6,
        "height_mm": 15.6,
        "description": "Cinema Super 35 / Formato APS-C (23.6x15.6mm)",
    },
    "ARRI_ALEXA_LF": {
        "id": "ARRI_ALEXA_LF",
        "name": "ARRI ALEXA LF",
        "width_mm": 36.7,
        "height_mm": 25.54,
        "description": "Sensor Large Format de cinema (36.7x25.54mm)",
    },
    "MEDIUM_FORMAT_645": {
        "id": "MEDIUM_FORMAT_645",
        "name": "Médio Formato 645",
        "width_mm": 53.7,
        "height_mm": 40.2,
        "description": "Hasselblad / Phase One 645 (53.7x40.2mm)",
    },
}

class DepthOfFieldResult(BaseModel):
    hyperfocal_m: float = Field(..., description="Hyperfocal distance in meters")
    near_limit_m: float = Field(..., description="Near depth of field limit in meters")
    far_limit_m: Optional[float] = Field(None, description="Far depth of field limit in meters (None if infinite)")
    total_dof_m: Optional[float] = Field(None, description="Total depth of field span in meters (None if infinite)")
    is_hyperfocal: bool = Field(..., description="True if focus distance is at or beyond hyperfocal distance")

class OpticsComputeRequest(BaseModel):
    focal_length_mm: float = Field(default=50.0, ge=1.0, le=1000.0)
    f_stop: float = Field(default=2.8, ge=0.5, le=128.0)
    focus_distance_m: float = Field(default=2.5, ge=0.01, le=1000.0)
    sensor_width_mm: float = Field(default=36.0, ge=1.0, le=200.0)
    sensor_height_mm: float = Field(default=24.0, ge=1.0, le=200.0)
    custom_coc_mm: Optional[float] = Field(None, ge=0.001, le=1.0)
    coc_divisor: float = Field(default=1500.0, ge=100.0, le=5000.0)

class OpticsComputeResponse(BaseModel):
    sensor_diagonal_mm: float
    coc_mm: float
    vertical_fov_deg: float
    horizontal_fov_deg: float
    diagonal_fov_deg: float
    hyperfocal_distance_m: float
    dof_near_m: float
    dof_far_m: Optional[float]
    dof_total_m: Optional[float]
    is_infinite_far: bool


def calculate_sensor_diagonal_mm(sensor_width_mm: float, sensor_height_mm: float) -> float:
    """Calculates physical sensor diagonal in millimeters: d = sqrt(w^2 + h^2)."""
    if sensor_width_mm <= 0 or sensor_height_mm <= 0:
        raise ValueError("Sensor dimensions must be strictly positive.")
    return math.sqrt(sensor_width_mm ** 2 + sensor_height_mm ** 2)


def calculate_circle_of_confusion_mm(
    sensor_width_mm: float,
    sensor_height_mm: float,
    divisor: float = 1500.0,
    custom_coc_mm: Optional[float] = None
) -> float:
    """
    Calculates Circle of Confusion (CoC) in millimeters.
    Formula: diagonal / divisor (Zeiss standard d/1500 -> ~0.029mm for 35mm full frame).
    """
    if custom_coc_mm is not None and custom_coc_mm > 0:
        return custom_coc_mm
    if divisor <= 0:
        raise ValueError("CoC divisor must be strictly positive.")
    diagonal = calculate_sensor_diagonal_mm(sensor_width_mm, sensor_height_mm)
    return diagonal / divisor


def calculate_vertical_fov_deg(focal_length_mm: float, sensor_height_mm: float) -> float:
    """
    Returns vertical Field of View in degrees.
    Formula: 2 * arctan(h / (2 * f)) in degrees.
    """
    if focal_length_mm <= 0 or sensor_height_mm <= 0:
        raise ValueError("Focal length and sensor height must be strictly positive.")
    rad = 2.0 * math.atan(sensor_height_mm / (2.0 * focal_length_mm))
    return math.degrees(rad)


def calculate_horizontal_fov_deg(focal_length_mm: float, sensor_width_mm: float) -> float:
    """
    Returns horizontal Field of View in degrees.
    Formula: 2 * arctan(w / (2 * f)) in degrees.
    """
    if focal_length_mm <= 0 or sensor_width_mm <= 0:
        raise ValueError("Focal length and sensor width must be strictly positive.")
    rad = 2.0 * math.atan(sensor_width_mm / (2.0 * focal_length_mm))
    return math.degrees(rad)


def calculate_diagonal_fov_deg(
    focal_length_mm: float,
    sensor_width_mm: float,
    sensor_height_mm: float
) -> float:
    """
    Returns diagonal Field of View in degrees.
    Formula: 2 * arctan(d / (2 * f)) in degrees.
    """
    diagonal = calculate_sensor_diagonal_mm(sensor_width_mm, sensor_height_mm)
    rad = 2.0 * math.atan(diagonal / (2.0 * focal_length_mm))
    return math.degrees(rad)


def calculate_hyperfocal_distance_m(
    focal_length_mm: float,
    f_stop: float,
    coc_mm: float
) -> float:
    """
    Calculates hyperfocal distance in meters.
    Formula: H = (f^2 / (N * c)) + f (in mm), converted to meters.
    """
    if focal_length_mm <= 0 or f_stop <= 0 or coc_mm <= 0:
        raise ValueError("Focal length, f-stop, and circle of confusion must be strictly positive.")
    h_mm = (focal_length_mm ** 2) / (f_stop * coc_mm) + focal_length_mm
    return h_mm / 1000.0


def calculate_depth_of_field_m(
    focal_length_mm: float,
    f_stop: float,
    focus_distance_m: float,
    coc_mm: float
) -> DepthOfFieldResult:
    """
    Calculates Depth of Field near limit, far limit, total DoF in meters.
    Formulas:
    D_near = (H * s) / (H + (s - f))
    D_far = (H * s) / (H - (s - f)) for s < H
    When s >= H: far limit and total DoF are infinite (represented as None in the result model).
    """
    if focus_distance_m <= 0:
        raise ValueError("Focus distance must be strictly positive meters.")

    h_m = calculate_hyperfocal_distance_m(focal_length_mm, f_stop, coc_mm)
    f_m = focal_length_mm / 1000.0
    is_hyper = focus_distance_m >= h_m

    near_denom = h_m + (focus_distance_m - f_m)
    near_limit_m = (h_m * focus_distance_m) / near_denom if near_denom > 0 else 0.0

    if is_hyper:
        return DepthOfFieldResult(
            hyperfocal_m=h_m,
            near_limit_m=near_limit_m,
            far_limit_m=None,
            total_dof_m=None,
            is_hyperfocal=True,
        )

    far_denom = h_m - (focus_distance_m - f_m)
    if far_denom <= 0:
        return DepthOfFieldResult(
            hyperfocal_m=h_m,
            near_limit_m=near_limit_m,
            far_limit_m=None,
            total_dof_m=None,
            is_hyperfocal=True,
        )

    far_limit_m = (h_m * focus_distance_m) / far_denom
    total_dof_m = far_limit_m - near_limit_m

    return DepthOfFieldResult(
        hyperfocal_m=h_m,
        near_limit_m=near_limit_m,
        far_limit_m=far_limit_m,
        total_dof_m=total_dof_m,
        is_hyperfocal=False,
    )


def compute_full_optics(req: OpticsComputeRequest) -> OpticsComputeResponse:
    """Computes all physical optical characteristics for a camera setup."""
    diag = calculate_sensor_diagonal_mm(req.sensor_width_mm, req.sensor_height_mm)
    coc = calculate_circle_of_confusion_mm(
        req.sensor_width_mm,
        req.sensor_height_mm,
        divisor=req.coc_divisor,
        custom_coc_mm=req.custom_coc_mm
    )
    v_fov = calculate_vertical_fov_deg(req.focal_length_mm, req.sensor_height_mm)
    h_fov = calculate_horizontal_fov_deg(req.focal_length_mm, req.sensor_width_mm)
    d_fov = calculate_diagonal_fov_deg(req.focal_length_mm, req.sensor_width_mm, req.sensor_height_mm)
    h_dist = calculate_hyperfocal_distance_m(req.focal_length_mm, req.f_stop, coc)
    dof = calculate_depth_of_field_m(req.focal_length_mm, req.f_stop, req.focus_distance_m, coc)

    return OpticsComputeResponse(
        sensor_diagonal_mm=diag,
        coc_mm=coc,
        vertical_fov_deg=v_fov,
        horizontal_fov_deg=h_fov,
        diagonal_fov_deg=d_fov,
        hyperfocal_distance_m=h_dist,
        dof_near_m=dof.near_limit_m,
        dof_far_m=dof.far_limit_m,
        dof_total_m=dof.total_dof_m,
        is_infinite_far=dof.is_hyperfocal,
    )
