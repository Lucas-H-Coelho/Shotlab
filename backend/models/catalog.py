from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from models.scene import ObjectType, MaterialModel

PoseType = Literal["standing", "seated", "walking", "hero"]

class PhysicalLimits(BaseModel):
    min_m: List[float] = Field(description="Minimum physical dimensions in meters [width, height, depth]")
    max_m: List[float] = Field(description="Maximum physical dimensions in meters [width, height, depth]")

class ParametricPreset(BaseModel):
    id: str = Field(description="Unique identifier for the preset primitive")
    name: str = Field(description="Human readable name in Portuguese")
    category: str = Field(description="Preset category (furniture, backdrop, prop, architecture, lighting, character)")
    type: ObjectType = Field(description="Geometric primitive type mapped into 3D scene")
    width_m: float = Field(description="Default width in meters (X axis)")
    height_m: float = Field(description="Default height in meters (Y axis)")
    depth_m: float = Field(description="Default depth in meters (Z axis)")
    default_position: List[float] = Field(description="Default position [X, Y, Z] in meters")
    default_rotation: List[float] = Field(default=[0.0, 0.0, 0.0], description="Euler rotation in radians [Pitch, Yaw, Roll]")
    min_m: List[float] = Field(description="Physical minimum dimensions [width, height, depth] in meters")
    max_m: List[float] = Field(description="Physical maximum dimensions [width, height, depth] in meters")
    material: MaterialModel = Field(description="Recommended physical PBR material")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata such as Kelvin lighting or character poses")
    description: Optional[str] = Field(default=None, description="Detailed explanation of the photographic preset")

class SpawnPresetRequest(BaseModel):
    preset_id: str = Field(description="ID of the parametric preset (e.g. 'studio_table', 'cyclorama', 'pedestal', 'shelf', 'studio_wall', 'softbox_80x120', 'human_mannequin')")
    name: Optional[str] = Field(default=None, description="Custom name for the spawned object")
    width_m: Optional[float] = Field(default=None, ge=0.01, description="Width override in meters")
    height_m: Optional[float] = Field(default=None, ge=0.01, description="Height override in meters")
    depth_m: Optional[float] = Field(default=None, ge=0.01, description="Depth override in meters")
    x_m: Optional[float] = Field(default=None, description="X position override in meters")
    y_m: Optional[float] = Field(default=None, description="Y position override in meters (if omitted, calculated automatically)")
    z_m: Optional[float] = Field(default=None, description="Z position override in meters")
    rotation: Optional[List[float]] = Field(default=None, description="Euler rotation override [Pitch, Yaw, Roll] in radians")
    color: Optional[str] = Field(default=None, description="Hex color override (e.g. '#334155')")
    kelvin: Optional[int] = Field(default=None, ge=1000, le=20000, description="Lighting color temperature in Kelvin (for lighting modifiers)")
    intensity: Optional[float] = Field(default=None, ge=0.0, description="Lighting intensity override")
    pose: Optional[PoseType] = Field(default=None, description="Anatomical pose override for mannequin ('standing', 'seated', 'walking', 'hero')")
    snap_to_floor: Optional[bool] = Field(default=None, description="Whether to automatically clamp position[1] to height_m / 2.0 to ensure zero floor penetration")

# Real-world photographic presets (all spatial units in meters)
PARAMETRIC_CATALOG: Dict[str, ParametricPreset] = {
    "studio_table": ParametricPreset(
        id="studio_table",
        name="Mesa de Estúdio",
        category="furniture",
        type="table",
        width_m=1.60,
        height_m=0.75,
        depth_m=0.80,
        default_position=[0.0, 0.375, 0.0],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[0.60, 0.40, 0.40],
        max_m=[3.00, 1.20, 2.00],
        material=MaterialModel(color="#334155", roughness=0.4, metalness=0.1),
        metadata={"category": "furniture", "surface_height_m": 0.75},
        description="Mesa de estúdio com tampo e pernas estruturais para fotografia de produtos",
    ),
    "cyclorama": ParametricPreset(
        id="cyclorama",
        name="Ciclorama Infinito",
        category="backdrop",
        type="backdrop",
        width_m=4.00,
        height_m=3.00,
        depth_m=3.00,
        default_position=[0.0, 1.50, -1.50],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[2.00, 2.00, 1.50],
        max_m=[12.00, 6.00, 8.00],
        material=MaterialModel(color="#f8fafc", roughness=0.95, metalness=0.0),
        metadata={"category": "backdrop", "seamless_curve": True},
        description="Ciclorama infinito com transição suave parede-chão para fotografia comercial",
    ),
    "pedestal": ParametricPreset(
        id="pedestal",
        name="Cubo / Pedestal de Produto",
        category="prop",
        type="box",
        width_m=0.40,
        height_m=1.00,
        depth_m=0.40,
        default_position=[0.0, 0.50, 0.0],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[0.20, 0.20, 0.20],
        max_m=[1.50, 2.00, 1.50],
        material=MaterialModel(color="#1e293b", roughness=0.3, metalness=0.2),
        metadata={"category": "prop", "pedestal_shape": "cubic"},
        description="Pedestal minimalista para elevação e destaque de produtos no estúdio",
    ),
    "shelf": ParametricPreset(
        id="shelf",
        name="Estante / Prateleira",
        category="furniture",
        type="box",
        width_m=1.20,
        height_m=1.80,
        depth_m=0.35,
        default_position=[0.0, 0.90, -1.00],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[0.50, 0.80, 0.20],
        max_m=[3.00, 3.00, 1.00],
        material=MaterialModel(color="#64748b", roughness=0.6, metalness=0.15),
        metadata={"category": "furniture", "shelves_count": 4},
        description="Estante cenográfica com prateleiras para ambientação de cena",
    ),
    "studio_wall": ParametricPreset(
        id="studio_wall",
        name="Parede Cenográfica",
        category="architecture",
        type="box",
        width_m=3.00,
        height_m=2.80,
        depth_m=0.15,
        default_position=[0.0, 1.40, -2.00],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[1.00, 1.50, 0.05],
        max_m=[10.00, 5.00, 0.50],
        material=MaterialModel(color="#94a3b8", roughness=0.8, metalness=0.0),
        metadata={"category": "architecture", "wall_thickness_m": 0.15},
        description="Parede cenográfica divisória para estúdios modulares e cenários cinematográficos",
    ),
    "softbox_80x120": ParametricPreset(
        id="softbox_80x120",
        name="Modificador Fotográfico Softbox",
        category="lighting",
        type="box",
        width_m=0.80,
        height_m=1.20,
        depth_m=0.45,
        default_position=[1.50, 1.60, 1.50],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[0.40, 0.40, 0.20],
        max_m=[2.00, 2.50, 1.50],
        material=MaterialModel(color="#0f172a", roughness=0.7, metalness=0.2),
        metadata={
            "category": "lighting",
            "kelvin": 5600,
            "intensity": 1.5,
            "light_type": "softbox",
            "kelvin_range": [2500, 10000],
        },
        description="Softbox retangular 80x120cm difuso com temperatura de cor calibrada em 5600K",
    ),
    "human_mannequin": ParametricPreset(
        id="human_mannequin",
        name="Manequim Humano Escala Real",
        category="character",
        type="model",
        width_m=0.50,
        height_m=1.75,
        depth_m=0.30,
        default_position=[0.0, 0.875, 0.0],
        default_rotation=[0.0, 0.0, 0.0],
        min_m=[0.30, 1.20, 0.20],
        max_m=[0.80, 2.20, 0.50],
        material=MaterialModel(color="#e2e8f0", roughness=0.5, metalness=0.05),
        metadata={
            "category": "character",
            "pose": "standing",
            "supported_poses": ["standing", "seated", "walking", "hero"],
        },
        description="Manequim humano anatômico em escala 1:1 (1.75m de altura) com suporte a poses fotográficas",
    ),
}
