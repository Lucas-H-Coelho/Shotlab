import math
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator

ObjectType = Literal['box', 'cylinder', 'sphere', 'plane', 'table', 'backdrop', 'model']

class MaterialModel(BaseModel):
    color: str = Field(default="#94a3b8", description="Hex color code")
    roughness: float = Field(default=0.5, ge=0.0, le=1.0)
    metalness: float = Field(default=0.1, ge=0.0, le=1.0)
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    wireframe: bool = Field(default=False)

class SceneObjectModel(BaseModel):
    id: str
    name: str
    type: ObjectType
    position: List[float] = Field(
        default=[0.0, 0.0, 0.0],
        description="Position in meters [X, Y, Z] where Y is height above floor"
    )
    rotation: List[float] = Field(
        default=[0.0, 0.0, 0.0],
        description="Euler rotation in radians [Pitch, Yaw, Roll]"
    )
    scale: List[float] = Field(
        default=[1.0, 1.0, 1.0],
        description="Dimensions/Scale in meters [X, Y, Z]"
    )
    material: MaterialModel = Field(default_factory=MaterialModel)
    visible: bool = Field(default=True)
    locked: bool = Field(default=False)

    @field_validator("position")
    @classmethod
    def validate_position_format(cls, v: List[float]) -> List[float]:
        if len(v) != 3:
            raise ValueError("Position must contain exactly 3 coordinates [X, Y, Z]")
        return v

    @field_validator("scale")
    @classmethod
    def validate_scale_positive(cls, v: List[float]) -> List[float]:
        if len(v) != 3:
            raise ValueError("Scale must contain exactly 3 values [X, Y, Z]")
        for val in v:
            if val <= 0:
                raise ValueError("Scale dimensions must be strictly positive meters.")
        return v


class CameraModel(BaseModel):
    focal_length_mm: float = Field(default=85.0, ge=10.0, le=600.0, description="Focal length in millimeters")
    sensor_width_mm: float = Field(default=36.0, ge=5.0, le=100.0, description="Sensor width in mm (Full Frame = 36mm)")
    sensor_height_mm: float = Field(default=24.0, ge=5.0, le=100.0, description="Sensor height in mm (Full Frame = 24mm)")
    f_stop: float = Field(default=1.8, ge=0.7, le=64.0, description="Lens aperture f-stop value")
    focus_distance_m: float = Field(default=2.2, ge=0.1, le=100.0, description="Focus distance in meters")
    position: List[float] = Field(default=[0.0, 1.4, 2.5], description="Camera 3D position [X, Y, Z] in meters")
    target: List[float] = Field(default=[0.0, 0.9, 0.0], description="Camera focal aim point [X, Y, Z] in meters")
    aspect_ratio: float = Field(default=1.5, description="Sensor aspect ratio (e.g. 1.5 for 3:2)")

    def calculate_vertical_fov(self) -> float:
        """Returns vertical Field of View in degrees based on physical sensor and lens focal length"""
        rad = 2.0 * math.atan(self.sensor_height_mm / (2.0 * self.focal_length_mm))
        return math.degrees(rad)

    def calculate_horizontal_fov(self) -> float:
        """Returns horizontal Field of View in degrees"""
        rad = 2.0 * math.atan(self.sensor_width_mm / (2.0 * self.focal_length_mm))
        return math.degrees(rad)

class LightSourceModel(BaseModel):
    intensity: float = Field(default=1.0, ge=0.0)
    color: str = Field(default="#ffffff")
    position: List[float] = Field(default=[0.0, 2.0, 0.0])
    cast_shadow: bool = Field(default=False)

class StudioLightingModel(BaseModel):
    ambient_intensity: float = Field(default=0.35, ge=0.0, le=2.0)
    ambient_color: str = Field(default="#ffffff")
    key_light: LightSourceModel = Field(
        default_factory=lambda: LightSourceModel(
            intensity=1.6, color="#fffbf0", position=[2.5, 3.0, 2.5], cast_shadow=True
        )
    )
    fill_light: LightSourceModel = Field(
        default_factory=lambda: LightSourceModel(
            intensity=0.7, color="#e8f0fe", position=[-2.5, 2.0, 2.0]
        )
    )
    rim_light: LightSourceModel = Field(
        default_factory=lambda: LightSourceModel(
            intensity=1.2, color="#ffffff", position=[0.0, 2.8, -2.5]
        )
    )

class SceneGraphModel(BaseModel):
    id: str
    name: str
    allow_intersections: bool = Field(
        default=False,
        description="Whether volumetric collisions/intersections between objects are allowed in this scene"
    )
    camera: CameraModel = Field(default_factory=CameraModel)
    lighting: StudioLightingModel = Field(default_factory=StudioLightingModel)
    objects: List[SceneObjectModel] = Field(default_factory=list)

class UpdateObjectRequest(BaseModel):
    name: Optional[str] = None
    position: Optional[List[float]] = None
    rotation: Optional[List[float]] = None
    scale: Optional[List[float]] = None
    material: Optional[MaterialModel] = None
    visible: Optional[bool] = None

class RenderJobRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = "blurry, low quality, cartoon, deformed, noisy"
    steps: int = Field(default=25, ge=10, le=50)
    denoise: float = Field(default=0.85, ge=0.1, le=1.0)
    seed: Optional[int] = None
    reference_image_base64: Optional[str] = None

class RenderJobResponse(BaseModel):
    job_id: str
    scene_id: str
    status: Literal['pending', 'processing', 'completed', 'failed']
    progress: int = Field(default=0, ge=0, le=100)
    image_url: Optional[str] = None
    alpha_url: Optional[str] = None
    error: Optional[str] = None
