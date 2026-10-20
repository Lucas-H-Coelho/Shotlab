import math
import uuid
from typing import List, Optional
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from db.database import get_db_connection
from models.assets import (
    CC0_ASSETS_CATALOG,
    MANNEQUIN_POSES,
    AssetCategory,
    CC0Asset,
    CreateMannequinRequest,
    MannequinPose,
    MannequinPosePreset,
    SpawnAssetRequest,
    UpdateMannequinRequest,
    calculate_effective_height_m,
    calculate_eye_height_m,
    calculate_standing_eye_height_m,
)
from models.scene import MaterialModel, SceneGraphModel, SceneObjectModel
from routers.events import manager
from routers.scenes import default_scene, normalize_scene_id
from services.validator import validate_physical_scene

router = APIRouter(prefix="/v1", tags=["assets"])


# ==============================================================================
# CC0 3D Asset Library Catalog Endpoints
# ==============================================================================


@router.get("/catalog/assets", response_model=List[CC0Asset])
async def list_cc0_assets(category: Optional[AssetCategory] = None):
    """
    Lists all CC0-1.0 3D assets from Poly Haven and Kenney.
    Provides real physical dimensions in meters (width_m, height_m, depth_m),
    validated bounding boxes, and procedural fallback geometry for Three.js viewport.
    """
    assets = list(CC0_ASSETS_CATALOG.values())
    if category:
        assets = [a for a in assets if a.category == category]
    return assets


@router.get("/catalog/assets/{asset_id}", response_model=CC0Asset)
async def get_cc0_asset(asset_id: str):
    """
    Fetches a specific CC0 asset by its unique identifier.
    """
    asset = CC0_ASSETS_CATALOG.get(asset_id)
    if not asset:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ASSET_NOT_FOUND",
                "message": f"Asset '{asset_id}' not found in CC0 catalog",
            },
        )
    return asset


@router.post(
    "/scenes/{scene_id}/assets",
    response_model=SceneObjectModel,
    status_code=201,
)
async def spawn_cc0_asset(
    scene_id: str,
    req: SpawnAssetRequest,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Instantiates a CC0 3D asset into the scene.
    Automatically snaps base to floor (Y = 0.0m) and validates physical AABB collisions (SHOT-15).
    """
    scene_id = normalize_scene_id(scene_id)
    asset = CC0_ASSETS_CATALOG.get(req.asset_id)
    if not asset:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ASSET_NOT_FOUND",
                "message": f"Asset '{req.asset_id}' not found in CC0 catalog",
            },
        )

    # 1. Resolve position & floor contact
    pos_x = req.x_m if req.x_m is not None else 0.0
    pos_z = req.z_m if req.z_m is not None else 0.0
    # Center Y = height / 2 so bottom rests precisely at Y = 0.0m
    pos_y = req.y_m if req.y_m is not None else (asset.height_m / 2.0)

    rotation = req.rotation if req.rotation is not None else [0.0, 0.0, 0.0]

    # 2. Material
    color = req.color or asset.fallback_geometry.color
    material = MaterialModel(
        color=color,
        roughness=asset.fallback_geometry.roughness,
        metalness=asset.fallback_geometry.metalness,
    )

    # 3. Build SceneObjectModel
    obj_id = f"{asset.id}-{uuid.uuid4().hex[:6]}"
    obj_name = req.name or asset.name

    obj = SceneObjectModel(
        id=obj_id,
        name=obj_name,
        type="model",
        position=[round(pos_x, 4), round(pos_y, 4), round(pos_z, 4)],
        rotation=rotation,
        scale=[
            round(asset.width_m, 4),
            round(asset.height_m, 4),
            round(asset.depth_m, 4),
        ],
        material=material,
        visible=True,
        locked=False,
        metadata={
            "asset_id": asset.id,
            "category": asset.category,
            "license": asset.license,
            "attribution": asset.attribution,
            "gltf_url": asset.gltf_url,
            "fallback_geometry": asset.fallback_geometry.model_dump(),
        },
    )

    # 4. Load scene and validate physics
    try:
        async with db.execute(
            "SELECT data_json FROM scenes WHERE id = ?", (scene_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                if scene_id == "scene-default":
                    scene = default_scene("scene-default")
                else:
                    raise HTTPException(
                        status_code=404, detail=f"Scene '{scene_id}' not found"
                    )
            else:
                scene = SceneGraphModel.model_validate_json(row["data_json"])

        temp_objects = list(scene.objects) + [obj]
        temp_scene = scene.model_copy(update={"objects": temp_objects})
        validate_physical_scene(temp_scene, target_object=obj)

        scene.objects.append(obj)
        await db.execute(
            "INSERT OR REPLACE INTO scenes (id, name, data_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (scene.id, scene.name, scene.model_dump_json()),
        )
        await db.commit()

        await manager.broadcast_to_scene(
            scene_id,
            {
                "type": "OBJECT_ADDED",
                "event": "asset_added",
                "scene_id": scene_id,
                "data": obj.model_dump(),
            },
        )
        return obj
    finally:
        await db.close()


# ==============================================================================
# Posable Human Mannequins Endpoints
# ==============================================================================


@router.get("/catalog/mannequin-poses", response_model=List[MannequinPosePreset])
async def list_mannequin_poses():
    """
    Lists all photographic and editorial mannequin pose presets:
    - standing (neutral full-body)
    - portrait_3_4 (classic 3/4 portrait, 35° torso rotation, look-at camera)
    - seated (seated on stool/chair, effective top-of-head ~1.30m for 1.75m stature, base at Y=0.0m)
    - walking (fashion dynamic editorial step)
    - hero_contrapposto (contrapposto pose)
    """
    return list(MANNEQUIN_POSES.values())


@router.get(
    "/catalog/mannequin-poses/{pose_id}",
    response_model=MannequinPosePreset,
)
async def get_mannequin_pose(pose_id: str):
    """
    Fetches details for a specific pose preset.
    """
    preset = MANNEQUIN_POSES.get(pose_id)  # type: ignore
    if not preset:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "POSE_NOT_FOUND",
                "message": f"Pose preset '{pose_id}' not found",
            },
        )
    return preset


@router.post(
    "/scenes/{scene_id}/mannequins",
    response_model=SceneObjectModel,
    status_code=201,
)
async def create_mannequin(
    scene_id: str,
    req: CreateMannequinRequest,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Creates a posable human mannequin in the scene:
    - Configurable real height between 1.50m and 2.00m (default 1.75m).
    - Anatomical eye height calculation (eye_height_m = height_m - 0.11m).
    - Eye target (look_at_camera or custom 3D [X, Y, Z] target).
    - Editorial pose presets (standing, portrait_3_4, seated, walking, hero_contrapposto).
    - Identity & outfit reference image/prompt slots for Qwen Image 2.1 and MOSS-Image.
    - Automatic floor contact (Y = 0.0m) and AABB collision validation (SHOT-15).
    """
    scene_id = normalize_scene_id(scene_id)

    # 1. Height anatomical validation
    if req.height_m < 1.50 or req.height_m > 2.00:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "HEIGHT_OUT_OF_BOUNDS",
                "message": f"Estatura {req.height_m}m está fora dos limites anatômicos reais [1.50m, 2.00m]",
            },
        )

    # 2. Pose validation
    if req.pose not in MANNEQUIN_POSES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_MANNEQUIN_POSE",
                "message": f"Pose '{req.pose}' não suportada. Poses permitidas: {list(MANNEQUIN_POSES.keys())}",
            },
        )
    pose_preset = MANNEQUIN_POSES[req.pose]

    # 3. Anatomical height calculations
    effective_h = calculate_effective_height_m(req.height_m, req.pose)
    standing_eye_h = calculate_standing_eye_height_m(req.height_m)
    eye_h = calculate_eye_height_m(req.height_m, req.pose)

    # 4. Resolve position & floor contact
    if req.position is not None:
        pos_x = req.position[0]
        pos_y = (
            req.position[1]
            if len(req.position) > 1
            else (effective_h / 2.0)
        )
        pos_z = req.position[2] if len(req.position) > 2 else 0.0
    else:
        pos_x = req.x_m if req.x_m is not None else 0.0
        pos_z = req.z_m if req.z_m is not None else 0.0
        # Automatically center Y so bottom rests precisely on floor (Y = 0.0m)
        pos_y = req.y_m if req.y_m is not None else (effective_h / 2.0)

    # 5. Resolve rotation
    if req.rotation is not None:
        rotation = req.rotation
    elif req.pose == "portrait_3_4":
        rotation = [0.0, round(math.radians(35.0), 4), 0.0]
    elif req.pose == "hero_contrapposto":
        rotation = [0.0, round(math.radians(15.0), 4), 0.0]
    elif req.pose == "walking":
        rotation = [0.0, round(math.radians(10.0), 4), 0.0]
    else:
        rotation = [0.0, 0.0, 0.0]

    # 6. Build SceneObjectModel
    obj_id = f"mannequin-{uuid.uuid4().hex[:6]}"
    obj = SceneObjectModel(
        id=obj_id,
        name=req.name or "Manequim Humano",
        type="model",
        position=[round(pos_x, 4), round(pos_y, 4), round(pos_z, 4)],
        rotation=rotation,
        scale=[0.50, round(effective_h, 4), 0.30],
        material=MaterialModel(
            color=req.color or "#e2e8f0",
            roughness=0.5,
            metalness=0.05,
        ),
        visible=True,
        locked=False,
        metadata={
            "is_mannequin": True,
            "category": "mannequins",
            "pose": req.pose,
            "height_m": req.height_m,
            "effective_height_m": effective_h,
            "eye_height_m": eye_h,
            "standing_eye_height_m": standing_eye_h,
            "look_at_camera": req.look_at_camera,
            "eye_target": req.eye_target,
            "identity_reference_image": req.identity_reference_image,
            "outfit_reference_image": req.outfit_reference_image,
            "character_prompt": req.character_prompt,
            "torso_rotation_y_deg": pose_preset.torso_rotation_y_deg,
            "editorial_style": pose_preset.editorial_style,
            "gltf_url": "/assets/models/cc0_human_mannequin.glb",
        },
    )

    # 7. Physical validation against scene
    try:
        async with db.execute(
            "SELECT data_json FROM scenes WHERE id = ?", (scene_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                if scene_id == "scene-default":
                    scene = default_scene("scene-default")
                else:
                    raise HTTPException(
                        status_code=404, detail=f"Scene '{scene_id}' not found"
                    )
            else:
                scene = SceneGraphModel.model_validate_json(row["data_json"])

        temp_objects = list(scene.objects) + [obj]
        temp_scene = scene.model_copy(update={"objects": temp_objects})
        validate_physical_scene(temp_scene, target_object=obj)

        scene.objects.append(obj)
        await db.execute(
            "INSERT OR REPLACE INTO scenes (id, name, data_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (scene.id, scene.name, scene.model_dump_json()),
        )
        await db.commit()

        await manager.broadcast_to_scene(
            scene_id,
            {
                "type": "OBJECT_ADDED",
                "event": "mannequin_added",
                "scene_id": scene_id,
                "data": obj.model_dump(),
            },
        )
        return obj
    finally:
        await db.close()


@router.patch(
    "/scenes/{scene_id}/mannequins/{object_id}",
    response_model=SceneObjectModel,
)
async def update_mannequin(
    scene_id: str,
    object_id: str,
    patch: UpdateMannequinRequest,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Updates a posable mannequin's pose, stature (1.50m–2.00m), eye target, and identity reference.
    Automatically recalculates floor contact (base at Y = 0.0m) and validates physical AABB collisions (SHOT-15).
    """
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute(
            "SELECT data_json FROM scenes WHERE id = ?", (scene_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                if scene_id == "scene-default":
                    scene = default_scene("scene-default")
                else:
                    raise HTTPException(
                        status_code=404, detail=f"Scene '{scene_id}' not found"
                    )
            else:
                scene = SceneGraphModel.model_validate_json(row["data_json"])

        target_obj = next((o for o in scene.objects if o.id == object_id), None)
        if not target_obj:
            raise HTTPException(
                status_code=404,
                detail=f"Mannequin '{object_id}' not found in scene",
            )

        metadata = dict(target_obj.metadata or {})

        # 1. Resolve & validate height
        current_height = float(metadata.get("height_m", 1.75))
        new_height = patch.height_m if patch.height_m is not None else current_height
        if new_height < 1.50 or new_height > 2.00:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "HEIGHT_OUT_OF_BOUNDS",
                    "message": f"Estatura {new_height}m está fora dos limites anatômicos reais [1.50m, 2.00m]",
                },
            )

        # 2. Resolve & validate pose
        current_pose = metadata.get("pose", "standing")
        new_pose: MannequinPose = (
            patch.pose if patch.pose is not None else current_pose  # type: ignore
        )
        if new_pose not in MANNEQUIN_POSES:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_MANNEQUIN_POSE",
                    "message": f"Pose '{new_pose}' não suportada. Poses permitidas: {list(MANNEQUIN_POSES.keys())}",
                },
            )
        pose_preset = MANNEQUIN_POSES[new_pose]

        # 3. Recalculate anatomical heights
        effective_h = calculate_effective_height_m(new_height, new_pose)
        standing_eye_h = calculate_standing_eye_height_m(new_height)
        eye_h = calculate_eye_height_m(new_height, new_pose)

        # 4. Resolve position & floor contact
        updated_pos = list(target_obj.position)
        if patch.position is not None:
            updated_pos = list(patch.position)
        else:
            if patch.x_m is not None:
                updated_pos[0] = patch.x_m
            if patch.z_m is not None:
                updated_pos[2] = patch.z_m
            if patch.y_m is not None:
                updated_pos[1] = patch.y_m
            else:
                # Automatically recalculate floor contact so base stays at Y = 0.0m
                updated_pos[1] = effective_h / 2.0

        # 5. Resolve rotation
        updated_rot = list(target_obj.rotation)
        if patch.rotation is not None:
            updated_rot = patch.rotation
        elif new_pose != current_pose:
            # When pose changes, adjust torso rotation accordingly if not explicitly overridden
            if new_pose == "portrait_3_4":
                updated_rot = [0.0, round(math.radians(35.0), 4), 0.0]
            elif new_pose == "hero_contrapposto":
                updated_rot = [0.0, round(math.radians(15.0), 4), 0.0]
            elif new_pose == "walking":
                updated_rot = [0.0, round(math.radians(10.0), 4), 0.0]
            elif new_pose in ("standing", "seated"):
                updated_rot = [0.0, 0.0, 0.0]

        # 6. Update scale
        updated_scale = [target_obj.scale[0], round(effective_h, 4), target_obj.scale[2]]

        # 7. Update material
        updated_material = target_obj.material.model_copy()
        if patch.color:
            updated_material.color = patch.color

        # 8. Update metadata
        metadata["is_mannequin"] = True
        metadata["category"] = "mannequins"
        metadata["pose"] = new_pose
        metadata["height_m"] = new_height
        metadata["effective_height_m"] = effective_h
        metadata["eye_height_m"] = eye_h
        metadata["standing_eye_height_m"] = standing_eye_h
        metadata["torso_rotation_y_deg"] = pose_preset.torso_rotation_y_deg
        metadata["editorial_style"] = pose_preset.editorial_style
        metadata["gltf_url"] = metadata.get(
            "gltf_url", "/assets/models/cc0_human_mannequin.glb"
        )

        if patch.look_at_camera is not None:
            metadata["look_at_camera"] = patch.look_at_camera
        if patch.eye_target is not None:
            metadata["eye_target"] = patch.eye_target
        if patch.identity_reference_image is not None:
            metadata["identity_reference_image"] = patch.identity_reference_image
        if patch.outfit_reference_image is not None:
            metadata["outfit_reference_image"] = patch.outfit_reference_image
        if patch.character_prompt is not None:
            metadata["character_prompt"] = patch.character_prompt

        updated_obj = target_obj.model_copy(
            update={
                "name": patch.name or target_obj.name,
                "position": [round(c, 4) for c in updated_pos],
                "rotation": updated_rot,
                "scale": updated_scale,
                "material": updated_material,
                "metadata": metadata,
            }
        )

        # 9. Physical validation
        temp_objects = [
            updated_obj if o.id == object_id else o for o in scene.objects
        ]
        temp_scene = scene.model_copy(update={"objects": temp_objects})
        validate_physical_scene(temp_scene, target_object=updated_obj)

        # 10. Commit changes
        target_obj.name = updated_obj.name
        target_obj.position = updated_obj.position
        target_obj.rotation = updated_obj.rotation
        target_obj.scale = updated_obj.scale
        target_obj.material = updated_obj.material
        target_obj.metadata = updated_obj.metadata

        await db.execute(
            "UPDATE scenes SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (scene.model_dump_json(), scene_id),
        )
        await db.commit()

        await manager.broadcast_to_scene(
            scene_id,
            {
                "type": "OBJECT_UPDATED",
                "event": "mannequin_updated",
                "scene_id": scene_id,
                "data": target_obj.model_dump(),
            },
        )
        return target_obj
    finally:
        await db.close()


@router.get(
    "/scenes/{scene_id}/mannequins",
    response_model=List[SceneObjectModel],
)
async def list_scene_mannequins(
    scene_id: str,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Lists all mannequin objects currently present in the specified scene.
    """
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute(
            "SELECT data_json FROM scenes WHERE id = ?", (scene_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                if scene_id == "scene-default":
                    scene = default_scene("scene-default")
                else:
                    raise HTTPException(
                        status_code=404, detail=f"Scene '{scene_id}' not found"
                    )
            else:
                scene = SceneGraphModel.model_validate_json(row["data_json"])

        return [
            o
            for o in scene.objects
            if o.metadata and o.metadata.get("is_mannequin")
        ]
    finally:
        await db.close()
