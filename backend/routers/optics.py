from fastapi import APIRouter, HTTPException, Depends
import aiosqlite

from models.optics import (
    OpticsComputeRequest,
    OpticsComputeResponse,
    compute_full_optics,
    SENSOR_PRESETS,
)
from db.database import get_db_connection
from models.scene import SceneGraphModel
from routers.scenes import normalize_scene_id, default_scene

router = APIRouter(prefix="/v1/optics", tags=["optics"])

@router.post("/compute", response_model=OpticsComputeResponse)
async def compute_optics_endpoint(req: OpticsComputeRequest):
    """
    Computes exact real optical geometry:
    - Sensor diagonal and Circle of Confusion (CoC)
    - Vertical, Horizontal, and Diagonal FOV in degrees
    - Hyperfocal distance in meters
    - Depth of Field Near Limit, Far Limit, and Total DoF in meters
    """
    try:
        return compute_full_optics(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.get("/presets")
async def get_sensor_presets():
    """Returns available physical sensor presets."""
    return SENSOR_PRESETS

@router.get("/scene/{scene_id}", response_model=OpticsComputeResponse)
async def get_scene_optics(scene_id: str, db: aiosqlite.Connection = Depends(get_db_connection)):
    """Computes real optical geometry directly from the scene's active camera."""
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (scene_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                if scene_id == "scene-default":
                    scene = default_scene("scene-default")
                else:
                    raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
            else:
                scene = SceneGraphModel.model_validate_json(row["data_json"])

        cam = scene.camera
        req = OpticsComputeRequest(
            focal_length_mm=cam.focal_length_mm,
            f_stop=cam.f_stop,
            focus_distance_m=cam.focus_distance_m,
            sensor_width_mm=cam.sensor_width_mm,
            sensor_height_mm=cam.sensor_height_mm,
        )
        return compute_full_optics(req)
    finally:
        await db.close()
