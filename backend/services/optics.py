import math
from typing import Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field

class OpticsComputeRequest(BaseModel):
    focal_length_mm: float = Field(..., ge=1.0, le=1000.0, description="Focal length in mm")
    f_stop: float = Field(..., ge=0.5, le=64.0, description="Lens aperture f-number")
    focus_distance_m: float = Field(..., ge=0.01, le=1000.0, description="Focus distance in meters")
    sensor_width_mm: float = Field(default=36.0, ge=1.0, le=200.0, description="Sensor width in mm")
    sensor_height_mm: float = Field(default=24.0, ge=1.0, le=200.0, description="Sensor height in mm")
    coc_divisor: float = Field(default=1500.0, ge=500.0, le=3000.0, description="CoC divisor (standard: diagonal/1500)")
    custom_coc_mm: Optional[float] = Field(default=None, ge=0.001, le=0.5, description="Optional custom CoC in mm")

class OpticsComputeResponse(BaseModel):
    sensor_width_mm: float
    sensor_height_mm: float
    sensor_diagonal_mm: float
    focal_length_mm: float
    f_stop: float
    focus_distance_m: float
    coc_mm: float
    fov_vertical_deg: float
    fov_horizontal_deg: float
    fov_diagonal_deg: float
    hyperfocal_distance_m: float
    dof_near_m: float
    dof_far_m: Optional[float]
    dof_total_m: Optional[float]
    is_infinite_far: bool

def compute_sensor_diagonal_mm(sensor_width_mm: float, sensor_height_mm: float) -> float:
    return math.sqrt(sensor_width_mm ** 2 + sensor_height_mm ** 2)

def compute_coc_mm(
    sensor_width_mm: float,
    sensor_height_mm: float,
    divisor: float = 1500.0,
    custom_coc_mm: Optional[float] = None
) -> float:
    if custom_coc_mm is not None:
        return custom_coc_mm
    diag = compute_sensor_diagonal_mm(sensor_width_mm, sensor_height_mm)
    return diag / divisor

def compute_fov_deg(focal_length_mm: float, sensor_dimension_mm: float) -> float:
    rad = 2.0 * math.atan(sensor_dimension_mm / (2.0 * focal_length_mm))
    return math.degrees(rad)

def compute_hyperfocal_m(focal_length_mm: float, f_stop: float, coc_mm: float) -> float:
    """
    H = (f^2 / (N * c)) / 1000 + f / 1000
    Standard photographic hyperfocal distance in meters.
    """
    f = focal_length_mm
    N = f_stop
    c = coc_mm
    # H in mm = (f^2 / (N * c)) + f
    h_mm = (f ** 2) / (N * c) + f
    return h_mm / 1000.0

def compute_dof_limits_m(
    focal_length_mm: float,
    f_stop: float,
    focus_distance_m: float,
    coc_mm: float
) -> Tuple[float, float, Optional[float], Optional[float], bool]:
    H = compute_hyperfocal_m(focal_length_mm, f_stop, coc_mm)
    s = focus_distance_m
    f_m = focal_length_mm / 1000.0

    # Near limit
    # Near = (H * s) / (H + (s - f_m))
    denom_near = H + (s - f_m)
    dof_near = (H * s) / denom_near if denom_near > 0 else 0.0

    # Far limit
    # If focus distance is at or beyond hyperfocal, far limit is Infinity
    denom_far = H - (s - f_m)
    if denom_far <= 0 or s >= H:
        dof_far = None
        dof_total = None
        is_infinite = True
    else:
        dof_far = (H * s) / denom_far
        dof_total = dof_far - dof_near
        is_infinite = False

    return H, dof_near, dof_far, dof_total, is_infinite

def calculate_optics(req: OpticsComputeRequest) -> OpticsComputeResponse:
    diag = compute_sensor_diagonal_mm(req.sensor_width_mm, req.sensor_height_mm)
    coc = compute_coc_mm(req.sensor_width_mm, req.sensor_height_mm, req.coc_divisor, req.custom_coc_mm)
    
    fov_v = compute_fov_deg(req.focal_length_mm, req.sensor_height_mm)
    fov_h = compute_fov_deg(req.focal_length_mm, req.sensor_width_mm)
    fov_d = compute_fov_deg(req.focal_length_mm, diag)

    H, d_near, d_far, d_total, is_inf = compute_dof_limits_m(
        req.focal_length_mm,
        req.f_stop,
        req.focus_distance_m,
        coc
    )

    return OpticsComputeResponse(
        sensor_width_mm=round(req.sensor_width_mm, 2),
        sensor_height_mm=round(req.sensor_height_mm, 2),
        sensor_diagonal_mm=round(diag, 3),
        focal_length_mm=round(req.focal_length_mm, 1),
        f_stop=round(req.f_stop, 2),
        focus_distance_m=round(req.focus_distance_m, 3),
        coc_mm=round(coc, 5),
        fov_vertical_deg=round(fov_v, 2),
        fov_horizontal_deg=round(fov_h, 2),
        fov_diagonal_deg=round(fov_d, 2),
        hyperfocal_distance_m=round(H, 3),
        dof_near_m=round(d_near, 3),
        dof_far_m=round(d_far, 3) if d_far is not None else None,
        dof_total_m=round(d_total, 3) if d_total is not None else None,
        is_infinite_far=is_inf,
    )
