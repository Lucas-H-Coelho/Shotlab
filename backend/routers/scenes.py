import json
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
import aiosqlite

from models.scene import (
    SceneGraphModel,
    SceneObjectModel,
    CameraModel,
    UpdateObjectRequest,
)
from services.validator import validate_physical_scene, check_aabb_collisions, check_floor_contact
from db.database import get_db_connection

router = APIRouter(prefix="/v1/scenes", tags=["scenes"])

def default_scene(scene_id: str, name: str = "Nova Sessão Fotográfica") -> SceneGraphModel:
    return SceneGraphModel(
        id=scene_id,
        name=name,
        allow_intersections=False,
        camera=CameraModel(),
        objects=[
            SceneObjectModel(
                id="studio-backdrop",
                name="Fundo Infinito (Cyc)",
                type="backdrop",
                position=[0.0, 1.75, -1.8],
                rotation=[0.0, 0.0, 0.0],
                scale=[6.0, 3.5, 2.5],
                material={"color": "#dbe0e8", "roughness": 0.85, "metalness": 0.05},
                locked=True,
            ),
            SceneObjectModel(
                id="product-pedestal",
                name="Bancada / Pedestal",
                type="cylinder",
                position=[0.0, 0.4, 0.0],
                rotation=[0.0, 0.0, 0.0],
                scale=[0.8, 0.8, 0.8],
                material={"color": "#2a2f3a", "roughness": 0.4, "metalness": 0.2},
            ),
            SceneObjectModel(
                id="hero-product",
                name="Objeto Principal (Hero)",
                type="box",
                position=[0.0, 1.05, 0.0],
                rotation=[0.0, 0.35, 0.0],
                scale=[0.25, 0.5, 0.25],
                material={"color": "#e11d48", "roughness": 0.2, "metalness": 0.8},
            ),
        ],
    )

def normalize_scene_id(scene_id: str) -> str:
    return "scene-default" if scene_id == "default" else scene_id

@router.get("", response_model=List[SceneGraphModel])
async def list_scenes(db: aiosqlite.Connection = Depends(get_db_connection)):
    try:
        async with db.execute("SELECT data_json FROM scenes ORDER BY updated_at DESC") as cursor:
            rows = await cursor.fetchall()
            return [SceneGraphModel.model_validate_json(row["data_json"]) for row in rows]
    finally:
        await db.close()

@router.post("", response_model=SceneGraphModel, status_code=201)
async def create_scene(name: Optional[str] = "Nova Sessão Fotográfica", db: aiosqlite.Connection = Depends(get_db_connection)):
    scene_id = f"scene-{uuid.uuid4().hex[:8]}"
    scene = default_scene(scene_id, name)
    try:
        await db.execute(
            "INSERT INTO scenes (id, name, data_json) VALUES (?, ?, ?)",
            (scene.id, scene.name, scene.model_dump_json()),
        )
        await db.commit()
        return scene
    finally:
        await db.close()

@router.get("/{scene_id}", response_model=SceneGraphModel)
async def get_scene(scene_id: str, db: aiosqlite.Connection = Depends(get_db_connection)):
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (scene_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                if scene_id == "scene-default":
                    scene = default_scene("scene-default", "Sessão Fotográfica 01")
                    await db.execute(
                        "INSERT OR REPLACE INTO scenes (id, name, data_json) VALUES (?, ?, ?)",
                        (scene.id, scene.name, scene.model_dump_json()),
                    )
                    await db.commit()
                    return scene
                raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
            return SceneGraphModel.model_validate_json(row["data_json"])
    finally:
        await db.close()

@router.put("/{scene_id}", response_model=SceneGraphModel)
async def update_scene(scene_id: str, scene: SceneGraphModel, db: aiosqlite.Connection = Depends(get_db_connection)):
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute("SELECT id FROM scenes WHERE id = ?", (scene_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
        
        # Physical validation of entire scene
        validate_physical_scene(scene)

        scene.id = scene_id
        await db.execute(
            "UPDATE scenes SET name = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (scene.name, scene.model_dump_json(), scene_id),
        )
        await db.commit()
        return scene
    finally:
        await db.close()

@router.post("/{scene_id}/validate")
async def validate_scene(scene_id: str, db: aiosqlite.Connection = Depends(get_db_connection)):
    """
    Validates physical scene constraints (floor penetration and volumetric AABB collisions).
    """
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (scene_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
            scene = SceneGraphModel.model_validate_json(row["data_json"])

        validate_physical_scene(scene)
        return {
            "status": "valid",
            "scene_id": scene_id,
            "objects_count": len(scene.objects),
            "floor_contact": "ok",
            "collisions": "none"
        }
    finally:
        await db.close()

@router.post("/{scene_id}/objects", response_model=SceneObjectModel, status_code=201)
async def add_object(scene_id: str, obj: SceneObjectModel, db: aiosqlite.Connection = Depends(get_db_connection)):
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

        # Check duplicate ID
        if any(o.id == obj.id for o in scene.objects):
            obj.id = f"obj-{uuid.uuid4().hex[:6]}"

        # Validate physics before committing
        temp_objects = list(scene.objects) + [obj]
        temp_scene = scene.model_copy(update={"objects": temp_objects})
        validate_physical_scene(temp_scene, target_object=obj)

        scene.objects.append(obj)
        await db.execute(
            "INSERT OR REPLACE INTO scenes (id, name, data_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (scene.id, scene.name, scene.model_dump_json()),
        )
        await db.commit()
        return obj
    finally:
        await db.close()

@router.patch("/{scene_id}/objects/{object_id}", response_model=SceneObjectModel)
async def patch_object(
    scene_id: str,
    object_id: str,
    patch: UpdateObjectRequest,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (scene_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
            scene = SceneGraphModel.model_validate_json(row["data_json"])

        target_obj = next((o for o in scene.objects if o.id == object_id), None)
        if not target_obj:
            raise HTTPException(status_code=404, detail=f"Object '{object_id}' not found in scene")

        # Create updated draft
        updated_obj = target_obj.model_copy()
        if patch.name is not None:
            updated_obj.name = patch.name
        if patch.position is not None:
            updated_obj.position = patch.position
        if patch.rotation is not None:
            updated_obj.rotation = patch.rotation
        if patch.scale is not None:
            updated_obj.scale = patch.scale
        if patch.material is not None:
            updated_obj.material = patch.material
        if patch.visible is not None:
            updated_obj.visible = patch.visible

        # Validate physics with modified object
        temp_objects = [updated_obj if o.id == object_id else o for o in scene.objects]
        temp_scene = scene.model_copy(update={"objects": temp_objects})
        validate_physical_scene(temp_scene, target_object=updated_obj)

        # Apply changes
        target_obj.name = updated_obj.name
        target_obj.position = updated_obj.position
        target_obj.rotation = updated_obj.rotation
        target_obj.scale = updated_obj.scale
        target_obj.material = updated_obj.material
        target_obj.visible = updated_obj.visible

        await db.execute(
            "UPDATE scenes SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (scene.model_dump_json(), scene_id),
        )
        await db.commit()
        return target_obj
    finally:
        await db.close()

@router.delete("/{scene_id}/objects/{object_id}")
async def delete_object(scene_id: str, object_id: str, db: aiosqlite.Connection = Depends(get_db_connection)):
    scene_id = normalize_scene_id(scene_id)
    try:
        async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (scene_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")
            scene = SceneGraphModel.model_validate_json(row["data_json"])

        initial_len = len(scene.objects)
        scene.objects = [o for o in scene.objects if o.id != object_id]
        if len(scene.objects) == initial_len:
            raise HTTPException(status_code=404, detail=f"Object '{object_id}' not found in scene")

        await db.execute(
            "UPDATE scenes SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (scene.model_dump_json(), scene_id),
        )
        await db.commit()
        return {"status": "deleted", "object_id": object_id}
    finally:
        await db.close()

@router.put("/{scene_id}/camera", response_model=CameraModel)
async def update_camera(scene_id: str, camera: CameraModel, db: aiosqlite.Connection = Depends(get_db_connection)):
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

        scene.camera = camera
        await db.execute(
            "INSERT OR REPLACE INTO scenes (id, name, data_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (scene.id, scene.name, scene.model_dump_json()),
        )
        await db.commit()
        return camera
    finally:
        await db.close()
