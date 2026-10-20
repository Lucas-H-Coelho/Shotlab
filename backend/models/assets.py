import math
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from models.scene import MaterialModel

AssetCategory = Literal["furniture", "props", "studio_gear", "mannequins"]

MannequinPose = Literal[
    "standing",
    "portrait_3_4",
    "seated",
    "walking",
    "hero_contrapposto",
]


class BoundingBox(BaseModel):
    min_m: List[float] = Field(
        description="Bounding box minimum [min_x, min_y, min_z] in meters relative to object origin"
    )
    max_m: List[float] = Field(
        description="Bounding box maximum [max_x, max_y, max_z] in meters relative to object origin"
    )


class ProceduralFallbackGeometry(BaseModel):
    type: Literal["box", "cylinder", "sphere", "model"] = Field(
        default="box",
        description="Procedural Three.js fallback primitive type",
    )
    dimensions_m: List[float] = Field(
        description="Dimensions [width, height, depth] in meters"
    )
    color: str = Field(default="#94a3b8", description="Hex fallback color")
    roughness: float = Field(default=0.5, ge=0.0, le=1.0)
    metalness: float = Field(default=0.1, ge=0.0, le=1.0)
    wireframe: bool = False
    parts: Optional[List[Dict[str, Any]]] = None


class CC0Asset(BaseModel):
    id: str = Field(description="Unique CC0 asset identifier")
    name: str = Field(description="Human readable name in Portuguese")
    category: AssetCategory = Field(description="Asset category")
    license: str = Field(
        default="CC0-1.0",
        description="Explicit CC0-1.0 public domain license",
    )
    attribution: str = Field(
        description="Source attribution, e.g. Poly Haven / Kenney"
    )
    source_url: Optional[str] = Field(
        default=None, description="Original CC0 source URL"
    )
    width_m: float = Field(ge=0.01, description="Physical width in meters (X)")
    height_m: float = Field(ge=0.01, description="Physical height in meters (Y)")
    depth_m: float = Field(ge=0.01, description="Physical depth in meters (Z)")
    bounding_box: BoundingBox = Field(
        description="Axis-aligned physical bounding box in meters"
    )
    gltf_url: str = Field(description="Relative path to optimized glTF/GLB asset")
    fallback_geometry: ProceduralFallbackGeometry = Field(
        description="Procedural fallback geometric representation for 3D viewport"
    )
    tags: List[str] = Field(default_factory=list, description="Searchable tags")
    description: Optional[str] = Field(
        default=None, description="Physical and photographic description"
    )


class MannequinPosePreset(BaseModel):
    id: MannequinPose = Field(description="Unique pose preset identifier")
    name: str = Field(description="Human-readable name in Portuguese")
    description: str = Field(description="Photographic and anatomical explanation")
    height_factor: float = Field(
        default=1.0,
        ge=0.5,
        le=1.2,
        description="Factor applied to nominal stature to determine effective vertical height",
    )
    torso_rotation_y_deg: float = Field(
        default=0.0, description="Torso Y rotation in degrees"
    )
    look_at_camera: bool = Field(
        default=True, description="Whether eye target aims at camera"
    )
    default_eye_target: Optional[List[float]] = Field(
        default=None, description="Default 3D gaze target [X, Y, Z] in meters"
    )
    editorial_style: str = Field(
        default="commercial", description="Editorial fashion or portrait style"
    )


# ------------------------------------------------------------------------------
# Real-world Pose Presets
# ------------------------------------------------------------------------------
MANNEQUIN_POSES: Dict[MannequinPose, MannequinPosePreset] = {
    "standing": MannequinPosePreset(
        id="standing",
        name="Em Pé Neutro",
        description="Em pé neutro — postura ereta natural para iluminação e proporções de corpo inteiro (height_factor: 1.0)",
        height_factor=1.0,
        torso_rotation_y_deg=0.0,
        look_at_camera=False,
        editorial_style="commercial",
    ),
    "portrait_3_4": MannequinPosePreset(
        id="portrait_3_4",
        name="Retrato 3/4 Clássico",
        description="Retrato 3/4 clássico — rotação de tronco em 35° e olhar focado para a câmera",
        height_factor=1.0,
        torso_rotation_y_deg=35.0,
        look_at_camera=True,
        editorial_style="portrait",
    ),
    "seated": MannequinPosePreset(
        id="seated",
        name="Sentado em Banqueta/Cadeira",
        description="Sentado em banqueta/cadeira — altura efetiva do topo da cabeça ~1.30m para estatura 1.75m, base em Y = 0.0m",
        height_factor=round(1.30 / 1.75, 4),  # 0.7429 -> 1.75m * 0.742857 ~ 1.30m
        torso_rotation_y_deg=0.0,
        look_at_camera=True,
        editorial_style="editorial",
    ),
    "walking": MannequinPosePreset(
        id="walking",
        name="Passo Dinâmico Editorial",
        description="Passo dinâmico de moda/editorial com movimento elegante e separação de pernas",
        height_factor=0.98,
        torso_rotation_y_deg=10.0,
        look_at_camera=False,
        editorial_style="fashion",
    ),
    "hero_contrapposto": MannequinPosePreset(
        id="hero_contrapposto",
        name="Hero Contrapposto",
        description="Pose editorial contrapposto com deslocamento assimétrico de peso nos quadris",
        height_factor=0.99,
        torso_rotation_y_deg=15.0,
        look_at_camera=True,
        editorial_style="high_fashion",
    ),
}


# ------------------------------------------------------------------------------
# CC0 3D Asset Library Catalog
# ------------------------------------------------------------------------------
CC0_ASSETS_CATALOG: Dict[str, CC0Asset] = {
    "cc0_wooden_chair": CC0Asset(
        id="cc0_wooden_chair",
        name="Cadeira de Madeira Clássica",
        category="furniture",
        license="CC0-1.0",
        attribution="Poly Haven",
        source_url="https://polyhaven.com/a/wooden_chair",
        width_m=0.50,
        height_m=0.85,
        depth_m=0.52,
        bounding_box=BoundingBox(
            min_m=[-0.25, 0.0, -0.26],
            max_m=[0.25, 0.85, 0.26],
        ),
        gltf_url="/assets/models/cc0_wooden_chair.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="box",
            dimensions_m=[0.50, 0.85, 0.52],
            color="#8b5a2b",
            roughness=0.6,
            metalness=0.05,
        ),
        tags=["furniture", "chair", "wood", "studio", "cc0", "polyhaven"],
        description="Cadeira de madeira maciça clássica com encosto para composições fotográficas de estúdio",
    ),
    "cc0_studio_stool": CC0Asset(
        id="cc0_studio_stool",
        name="Banqueta de Estúdio Fotográfico",
        category="furniture",
        license="CC0-1.0",
        attribution="Kenney",
        source_url="https://kenney.nl/assets",
        width_m=0.38,
        height_m=0.65,
        depth_m=0.38,
        bounding_box=BoundingBox(
            min_m=[-0.19, 0.0, -0.19],
            max_m=[0.19, 0.65, 0.19],
        ),
        gltf_url="/assets/models/cc0_studio_stool.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="cylinder",
            dimensions_m=[0.38, 0.65, 0.38],
            color="#334155",
            roughness=0.35,
            metalness=0.65,
        ),
        tags=["furniture", "stool", "metal", "seating", "cc0", "kenney"],
        description="Banqueta metálica de estúdio fotográfico com assento circular para posicionamento de manequins",
    ),
    "cc0_vintage_camera_tripod": CC0Asset(
        id="cc0_vintage_camera_tripod",
        name="Tripé Vintage de Câmera",
        category="studio_gear",
        license="CC0-1.0",
        attribution="Poly Haven",
        source_url="https://polyhaven.com/a/camera_tripod",
        width_m=0.60,
        height_m=1.55,
        depth_m=0.60,
        bounding_box=BoundingBox(
            min_m=[-0.30, 0.0, -0.30],
            max_m=[0.30, 1.55, 0.30],
        ),
        gltf_url="/assets/models/cc0_vintage_camera_tripod.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="cylinder",
            dimensions_m=[0.60, 1.55, 0.60],
            color="#1e293b",
            roughness=0.4,
            metalness=0.75,
        ),
        tags=["studio_gear", "tripod", "camera", "vintage", "cc0", "polyhaven"],
        description="Tripé de estúdio fotográfico vintage em madeira nobre e conexões metálicas usinadas",
    ),
    "cc0_ceramic_vase": CC0Asset(
        id="cc0_ceramic_vase",
        name="Vaso Cerâmico de Estúdio",
        category="props",
        license="CC0-1.0",
        attribution="Poly Haven",
        source_url="https://polyhaven.com/a/ceramic_vase",
        width_m=0.22,
        height_m=0.35,
        depth_m=0.22,
        bounding_box=BoundingBox(
            min_m=[-0.11, 0.0, -0.11],
            max_m=[0.11, 0.35, 0.11],
        ),
        gltf_url="/assets/models/cc0_ceramic_vase.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="cylinder",
            dimensions_m=[0.22, 0.35, 0.22],
            color="#f1f5f9",
            roughness=0.25,
            metalness=0.05,
        ),
        tags=["props", "vase", "ceramic", "still_life", "decor", "cc0", "polyhaven"],
        description="Vaso cerâmico fosco artesanal para composições still life e packshots",
    ),
    "cc0_product_bottle": CC0Asset(
        id="cc0_product_bottle",
        name="Frasco Cosmético de Vidro",
        category="props",
        license="CC0-1.0",
        attribution="Kenney",
        source_url="https://kenney.nl/assets",
        width_m=0.08,
        height_m=0.24,
        depth_m=0.08,
        bounding_box=BoundingBox(
            min_m=[-0.04, 0.0, -0.04],
            max_m=[0.04, 0.24, 0.04],
        ),
        gltf_url="/assets/models/cc0_product_bottle.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="cylinder",
            dimensions_m=[0.08, 0.24, 0.08],
            color="#0284c7",
            roughness=0.1,
            metalness=0.1,
        ),
        tags=["props", "bottle", "cosmetic", "glass", "packshot", "cc0", "kenney"],
        description="Frasco cilíndrico de vidro premium para fotografia comercial e iluminação de produtos cosméticos",
    ),
    "cc0_apple_crate": CC0Asset(
        id="cc0_apple_crate",
        name="Caixote Apple Box de Madeira",
        category="props",
        license="CC0-1.0",
        attribution="Poly Haven",
        source_url="https://polyhaven.com/a/apple_box",
        width_m=0.50,
        height_m=0.30,
        depth_m=0.40,
        bounding_box=BoundingBox(
            min_m=[-0.25, 0.0, -0.20],
            max_m=[0.25, 0.30, 0.20],
        ),
        gltf_url="/assets/models/cc0_apple_crate.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="box",
            dimensions_m=[0.50, 0.30, 0.40],
            color="#d97706",
            roughness=0.75,
            metalness=0.0,
        ),
        tags=["props", "crate", "wood", "apple_box", "cinema", "cc0", "polyhaven"],
        description="Caixote padrão apple box em ripas de madeira para elevação de modelos e produtos no set",
    ),
    "cc0_human_mannequin": CC0Asset(
        id="cc0_human_mannequin",
        name="Manequim Humano Anatômico CC0",
        category="mannequins",
        license="CC0-1.0",
        attribution="Kenney",
        source_url="https://kenney.nl/assets",
        width_m=0.50,
        height_m=1.75,
        depth_m=0.30,
        bounding_box=BoundingBox(
            min_m=[-0.25, 0.0, -0.15],
            max_m=[0.25, 1.75, 0.15],
        ),
        gltf_url="/assets/models/cc0_human_mannequin.glb",
        fallback_geometry=ProceduralFallbackGeometry(
            type="model",
            dimensions_m=[0.50, 1.75, 0.30],
            color="#e2e8f0",
            roughness=0.5,
            metalness=0.05,
        ),
        tags=["mannequins", "human", "character", "posable", "fashion", "cc0", "kenney"],
        description="Manequim humano em escala 1:1 com proporções anatômicas realistas e suporte a poses editoriais",
    ),
}


# ------------------------------------------------------------------------------
# Anatomical Calculations
# ------------------------------------------------------------------------------
def calculate_effective_height_m(height_m: float, pose: MannequinPose) -> float:
    """
    Computes effective vertical height in meters based on real human stature and pose.
    For standing: height_factor = 1.0 -> effective_height = height_m
    For seated: height_factor = (1.30 / 1.75) -> effective_height ~1.30m for 1.75m stature
    """
    if pose == "seated":
        return round(height_m * (1.30 / 1.75), 4)
    preset = MANNEQUIN_POSES.get(pose)
    factor = preset.height_factor if preset else 1.0
    return round(height_m * factor, 4)


def calculate_standing_eye_height_m(height_m: float) -> float:
    """
    Anatomical eye height calculation for standing human:
    eye_height_m = height_m - 0.11m (vertex to eye level is approx 11cm).
    """
    return round(height_m - 0.11, 4)


def calculate_eye_height_m(height_m: float, pose: MannequinPose = "standing") -> float:
    """
    Computes 3D eye height in meters from the floor (Y = 0.0m) according to the pose:
    When standing: eye_height_m = height_m - 0.11m
    When seated: eye_height_m = effective_height_m - 0.11m
    """
    effective_h = calculate_effective_height_m(height_m, pose)
    return round(effective_h - 0.11, 4)


# ------------------------------------------------------------------------------
# Request / Response Schemas
# ------------------------------------------------------------------------------
class CreateMannequinRequest(BaseModel):
    name: Optional[str] = Field(default="Manequim Humano", description="Display name for the mannequin")
    height_m: float = Field(
        default=1.75,
        ge=1.50,
        le=2.00,
        description="Real human stature in meters (strictly constrained between 1.50m and 2.00m)",
    )
    pose: MannequinPose = Field(
        default="standing",
        description="Pose preset: 'standing', 'portrait_3_4', 'seated', 'walking', 'hero_contrapposto'",
    )
    look_at_camera: bool = Field(
        default=True,
        description="Whether eye target aims at active camera",
    )
    eye_target: Optional[List[float]] = Field(
        default=None,
        description="Custom 3D coordinates [X, Y, Z] in meters for eye gaze",
    )
    identity_reference_image: Optional[str] = Field(
        default=None,
        description="Base64 or image URL reference for Qwen Image 2.1 reference_latents / character identity",
    )
    outfit_reference_image: Optional[str] = Field(
        default=None,
        description="Base64 or image URL reference for clothing / outfit styling",
    )
    character_prompt: Optional[str] = Field(
        default=None,
        description="Character prompt or regional caption description for MOSS-Image [N] and Qwen text prompt",
    )
    x_m: Optional[float] = Field(default=0.0, description="X coordinate in meters")
    y_m: Optional[float] = Field(
        default=None,
        description="Y coordinate in meters (if omitted, automatically calculated to snap base to Y = 0.0m)",
    )
    z_m: Optional[float] = Field(default=0.0, description="Z coordinate in meters")
    position: Optional[List[float]] = Field(
        default=None,
        description="Direct 3D position [X, Y, Z] override in meters",
    )
    rotation: Optional[List[float]] = Field(
        default=None,
        description="Euler rotation in radians [Pitch, Yaw, Roll]",
    )
    color: Optional[str] = Field(
        default="#e2e8f0",
        description="Hex surface color for the mannequin material",
    )


class UpdateMannequinRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="Updated display name")
    height_m: Optional[float] = Field(
        default=None,
        ge=1.50,
        le=2.00,
        description="Updated stature in meters [1.50m - 2.00m]",
    )
    pose: Optional[MannequinPose] = Field(default=None, description="Updated pose preset")
    look_at_camera: Optional[bool] = Field(default=None, description="Whether gaze aims at camera")
    eye_target: Optional[List[float]] = Field(default=None, description="Custom 3D gaze target [X, Y, Z]")
    identity_reference_image: Optional[str] = Field(
        default=None,
        description="Updated base64 or URL reference image for Qwen Image 2.1 identity reference_latents",
    )
    outfit_reference_image: Optional[str] = Field(
        default=None,
        description="Updated base64 or URL reference image for outfit styling",
    )
    character_prompt: Optional[str] = Field(
        default=None,
        description="Updated character prompt for MOSS-Image [N] regional layout and Qwen prompt",
    )
    x_m: Optional[float] = Field(default=None, description="Updated X coordinate")
    y_m: Optional[float] = Field(default=None, description="Updated Y coordinate")
    z_m: Optional[float] = Field(default=None, description="Updated Z coordinate")
    position: Optional[List[float]] = Field(default=None, description="Updated 3D position [X, Y, Z]")
    rotation: Optional[List[float]] = Field(default=None, description="Updated Euler rotation [Pitch, Yaw, Roll]")
    color: Optional[str] = Field(default=None, description="Updated material color")


class SpawnAssetRequest(BaseModel):
    asset_id: str = Field(description="ID of the CC0 asset (e.g. 'cc0_wooden_chair')")
    name: Optional[str] = Field(default=None, description="Custom name override")
    x_m: Optional[float] = Field(default=0.0, description="X coordinate in meters")
    y_m: Optional[float] = Field(default=None, description="Y coordinate in meters (default: snaps to floor Y=0.0m)")
    z_m: Optional[float] = Field(default=0.0, description="Z coordinate in meters")
    rotation: Optional[List[float]] = Field(default=None, description="Euler rotation [Pitch, Yaw, Roll] in radians")
    color: Optional[str] = Field(default=None, description="Hex material color override")
