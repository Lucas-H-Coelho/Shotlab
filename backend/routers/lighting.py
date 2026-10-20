from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Response
import aiosqlite

from models.scene import SceneGraphModel
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
)
from db.database import get_db_connection
from routers.scenes import normalize_scene_id, default_scene
from pydantic import BaseModel, Field

router = APIRouter(tags=["lighting"])


class ModifiersCatalogResponse(BaseModel):
    modifiers: List[LightModifier] = Field(description="Photographic light modifiers with real physical dimensions in meters")
    kelvin_presets: List[GelPreset] = Field(description="Standard color temperature presets (Daylight, Tungsten, etc.)")
    creative_gels: List[GelPreset] = Field(description="Creative color gels (CTO, CTB, Cyan, Amber, Magenta)")


class KelvinConversionResponse(BaseModel):
    kelvin: int
    hex_color: str
    rgb_srgb: List[int]
    rgb_linear: List[float]


@router.get("/v1/lighting/modifiers", response_model=ModifiersCatalogResponse)
async def list_lighting_modifiers():
    """
    Lists photographic light modifiers (Softbox, Octabox, Stripbox, Beauty Dish, Fresnel)
    with real physical dimensions in meters and standard Kelvin / creative gels presets.
    """
    mods = list(LIGHT_MODIFIERS.values())
    k_presets = [g for g in GEL_PRESETS.values() if g.category in ("standard", "correction")]
    gels = [g for g in GEL_PRESETS.values() if g.category == "creative"]

    return ModifiersCatalogResponse(
        modifiers=mods,
        kelvin_presets=k_presets,
        creative_gels=gels,
    )


@router.get("/v1/lighting/kelvin-to-rgb", response_model=KelvinConversionResponse)
async def convert_kelvin(
    kelvin: int = Query(default=5600, ge=1000, le=40000, description="Color temperature in Kelvin")
):
    """
    Converts color temperature in Kelvin to physical linear RGB and sRGB hex format
    using Tanner Helland's blackbody radiation formula.
    """
    r, g, b, hex_str = kelvin_to_srgb(float(kelvin))
    lin_rgb = list(kelvin_to_linear_rgb(float(kelvin)))
    return KelvinConversionResponse(
        kelvin=kelvin,
        hex_color=hex_str,
        rgb_srgb=[r, g, b],
        rgb_linear=lin_rgb,
    )


async def _fetch_scene_or_404(scene_id: str, db: aiosqlite.Connection) -> SceneGraphModel:
    norm_id = normalize_scene_id(scene_id)
    async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (norm_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            if norm_id == "scene-default":
                scene = default_scene("scene-default", "Sessão Fotográfica 01")
                await db.execute(
                    "INSERT OR REPLACE INTO scenes (id, name, data_json) VALUES (?, ?, ?)",
                    (scene.id, scene.name, scene.model_dump_json()),
                )
                await db.commit()
                return scene
            raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
        return SceneGraphModel.model_validate_json(row["data_json"])


@router.get("/v1/scenes/{scene_id}/set-plan", response_model=SetPlanDataResponse)
async def get_scene_set_plan(
    scene_id: str,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Returns structured technical Top-Down Set Plan 2D data:
    - Camera optics (FOV, focal length, f-stop, distance to subject)
    - Distances in meters from camera and each light to primary subject
    - Key, Fill, and Rim lights angles (azimuth and elevation)
    - Complete ready-to-display vector SVG blueprint string
    """
    try:
        scene = await _fetch_scene_or_404(scene_id, db)
        return generate_set_plan_data(scene)
    finally:
        await db.close()


@router.get("/v1/scenes/{scene_id}/set-plan.svg")
async def get_scene_set_plan_svg(
    scene_id: str,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Returns directly the raw vector SVG diagram (image/svg+xml) of the scene's Top-Down Set Plan.
    """
    try:
        scene = await _fetch_scene_or_404(scene_id, db)
        svg_content = generate_set_plan_svg(scene)
        return Response(content=svg_content, media_type="image/svg+xml")
    finally:
        await db.close()
