import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Depends
import aiosqlite

from models.scene import (
    SceneGraphModel,
    SceneObjectModel,
)
from models.catalog import (
    ParametricPreset,
    SpawnPresetRequest,
    PARAMETRIC_CATALOG,
)
from services.validator import validate_physical_scene
from db.database import get_db_connection
from routers.events import manager
from routers.scenes import normalize_scene_id, default_scene

router = APIRouter(prefix="/v1", tags=["catalog"])

@router.get("/catalog/primitives", response_model=List[ParametricPreset])
async def list_primitives():
    """
    Lists all real-world photographic studio parametric presets.
    Includes default physical dimensions in meters (width_m, height_m, depth_m),
    physical bounding limits (min_m, max_m), and recommended PBR materials.
    """
    return list(PARAMETRIC_CATALOG.values())

@router.get("/catalog/primitives/{preset_id}", response_model=ParametricPreset)
async def get_primitive(preset_id: str):
    """
    Fetches a specific parametric preset by ID.
    """
    preset = PARAMETRIC_CATALOG.get(preset_id)
    if not preset:
        raise HTTPException(
            status_code=404,
            detail=f"Preset '{preset_id}' not found in parametric catalog"
        )
    return preset

@router.post("/scenes/{scene_id}/spawn-preset", response_model=SceneObjectModel, status_code=201)
async def spawn_preset(
    scene_id: str,
    req: SpawnPresetRequest,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Instantiates a studio parametric preset directly into the scene.
    Accepts optional overrides (width_m, height_m, depth_m, x_m, z_m, color, kelvin, pose).
    Automatically calculates position[1] = height_m / 2.0 to snap precisely to the floor (Y = 0.0m),
    validates against physical floor penetration and volumetric AABB collisions (SHOT-15),
    persists into database, and broadcasts WebSocket 'object_added' event to all connected peers.
    """
    scene_id = normalize_scene_id(scene_id)
    preset = PARAMETRIC_CATALOG.get(req.preset_id)
    if not preset:
        raise HTTPException(
            status_code=404,
            detail=f"Preset '{req.preset_id}' not found in catalog"
        )

    # 1. Resolve dimensions (in meters)
    width = req.width_m if req.width_m is not None else preset.width_m
    height = req.height_m if req.height_m is not None else preset.height_m
    depth = req.depth_m if req.depth_m is not None else preset.depth_m

    # Validate dimensions against physical limits
    if width < preset.min_m[0] or width > preset.max_m[0]:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "DIMENSION_OUT_OF_BOUNDS",
                "message": f"width_m={width} is outside physical limits [{preset.min_m[0]}, {preset.max_m[0]}] for '{preset.id}'"
            }
        )
    if height < preset.min_m[1] or height > preset.max_m[1]:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "DIMENSION_OUT_OF_BOUNDS",
                "message": f"height_m={height} is outside physical limits [{preset.min_m[1]}, {preset.max_m[1]}] for '{preset.id}'"
            }
        )
    if depth < preset.min_m[2] or depth > preset.max_m[2]:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "DIMENSION_OUT_OF_BOUNDS",
                "message": f"depth_m={depth} is outside physical limits [{preset.min_m[2]}, {preset.max_m[2]}] for '{preset.id}'"
            }
        )

    # 2. Resolve position [X, Y, Z] in meters
    pos_x = req.x_m if req.x_m is not None else preset.default_position[0]
    pos_z = req.z_m if req.z_m is not None else preset.default_position[2]

    if req.y_m is not None:
        pos_y = req.y_m
    elif req.snap_to_floor is True:
        pos_y = height / 2.0
    elif req.snap_to_floor is False:
        pos_y = preset.default_position[1]
    else:
        # Default behavior:
        # If preset is elevated lighting modifier (softbox) and snap_to_floor wasn't requested, use preset default elevation
        if preset.id == "softbox_80x120":
            pos_y = preset.default_position[1]
        else:
            # Automatic floor contact: center Y = height / 2.0 so base Y = 0.0m
            pos_y = height / 2.0

    # 3. Resolve rotation
    rotation = req.rotation if req.rotation is not None else list(preset.default_rotation)

    # 4. Resolve PBR material
    material = preset.material.model_copy()
    if req.color:
        material.color = req.color

    # 5. Resolve metadata
    metadata = dict(preset.metadata)
    metadata["preset_id"] = preset.id

    if req.kelvin is not None:
        metadata["kelvin"] = req.kelvin
    if req.intensity is not None:
        metadata["intensity"] = req.intensity
    if req.pose is not None:
        supported_poses = preset.metadata.get("supported_poses", ["standing", "seated", "walking", "hero"])
        if req.pose not in supported_poses:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_POSE",
                    "message": f"Pose '{req.pose}' not supported. Allowed poses: {supported_poses}"
                }
            )
        metadata["pose"] = req.pose

    # 6. Instantiate SceneObjectModel
    obj_id = f"{preset.id}-{uuid.uuid4().hex[:6]}"
    obj_name = req.name if req.name else preset.name

    obj = SceneObjectModel(
        id=obj_id,
        name=obj_name,
        type=preset.type,
        position=[round(pos_x, 4), round(pos_y, 4), round(pos_z, 4)],
        rotation=rotation,
        scale=[round(width, 4), round(height, 4), round(depth, 4)],
        material=material,
        visible=True,
        locked=(preset.type == "backdrop"),
        metadata=metadata,
    )

    # 7. Load scene from database
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

        # 8. Physical validation (floor contact & AABB collision checks)
        temp_objects = list(scene.objects) + [obj]
        temp_scene = scene.model_copy(update={"objects": temp_objects})
        validate_physical_scene(temp_scene, target_object=obj)

        # 9. Commit object to scene
        scene.objects.append(obj)
        await db.execute(
            "INSERT OR REPLACE INTO scenes (id, name, data_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (scene.id, scene.name, scene.model_dump_json()),
        )
        await db.commit()

        # 10. Broadcast WebSocket event
        await manager.broadcast_to_scene(scene_id, {
            "type": "OBJECT_ADDED",
            "event": "object_added",
            "scene_id": scene_id,
            "data": obj.model_dump(),
        })

        return obj
    finally:
        await db.close()
