import os
import uuid
import json
import base64
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Response, Query
import aiosqlite

from services.export_service import export_job_png, build_shot_metadata

from models.scene import RenderJobRequest, RenderJobResponse, SceneGraphModel
from db.database import get_db_connection
from services.comfyui_client import (
    ComfyUIClient,
    build_moss_layout_from_scene,
    build_moss_workflow,
    build_qwen_workflow,
    ComfyUIOfflineError,
    ComfyUIError,
)
from routers.scenes import default_scene

router = APIRouter(prefix="/v1", tags=["render"])

# Default ComfyUI client instance
comfyui_client = ComfyUIClient()


@router.get("/render/health")
async def get_render_health() -> Dict[str, Any]:
    """
    Returns ComfyUI connectivity and health status.
    Offline-safe: returns {online: false, ...} without raising exceptions when ComfyUI is offline.
    """
    return await comfyui_client.check_health()


async def get_scene_model_from_db(db: aiosqlite.Connection, scene_id: str) -> SceneGraphModel:
    """Helper to fetch or fallback to default scene graph model."""
    norm_id = "scene-default" if scene_id == "default" else scene_id
    async with db.execute("SELECT data_json FROM scenes WHERE id = ?", (norm_id,)) as cursor:
        row = await cursor.fetchone()
        if row and row["data_json"]:
            try:
                return SceneGraphModel.model_validate_json(row["data_json"])
            except Exception:
                pass
    return default_scene(norm_id)


async def process_comfyui_render(job_id: str, scene_id: str, request: RenderJobRequest):
    """
    Background worker that formats ComfyUI workflow for Qwen Image 2.1 or MOSS-Image,
    dispatches prompt to ComfyUI /prompt endpoint, tracks progress via WebSocket,
    and falls back gracefully to offline-safe mode when ComfyUI is unavailable.
    """
    db_path = os.environ.get("SHOTLAB_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "shotlab.db"))
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row

    try:
        # Step 1: Update status to processing
        await db.execute(
            "UPDATE jobs SET status = 'processing', progress = 10, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (job_id,),
        )
        await db.commit()

        # Step 2: Check health of ComfyUI
        health = await comfyui_client.check_health()
        comfy_online = health.get("online", False)

        # Retrieve scene data
        scene = await get_scene_model_from_db(db, scene_id)

        if not comfy_online:
            # ==========================================
            # OFFLINE-SAFE FALLBACK MODE
            # ==========================================
            moss_layout = None
            if request.engine == "moss-image":
                try:
                    moss_layout = build_moss_layout_from_scene(
                        scene_graph=scene,
                        width=1024,
                        height=1024,
                        global_caption=request.prompt,
                    )
                except Exception as exc:
                    moss_layout = {"error": str(exc)}

                result_data = {
                    "imageUrl": request.reference_image_base64 or "/assets/placeholder-render.png",
                    "engine": "moss-image",
                    "offline": True,
                    "note": "ComfyUI offline; preview gerada em modo offline-safe com layout JSON MOSS-Image.",
                    "moss_layout": moss_layout,
                }
            else:
                result_data = {
                    "imageUrl": request.reference_image_base64 or "/assets/placeholder-render.png",
                    "engine": "qwen-2.1",
                    "offline": True,
                    "note": "ComfyUI offline; preview gerada a partir do buffer de cena 3D (Qwen Image 2.1).",
                }

            await db.execute(
                """
                UPDATE jobs 
                SET status = 'completed', progress = 100, 
                    result_json = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
                """,
                (json.dumps(result_data), job_id),
            )
            await db.commit()
            return

        # ==========================================
        # ONLINE COMFYUI EXECUTION MODE
        # ==========================================
        prompt_id: Optional[str] = None
        uploaded_filename: Optional[str] = None

        if request.engine == "moss-image":
            # Build MOSS-Image layout JSON from Scene Graph
            moss_layout = build_moss_layout_from_scene(
                scene_graph=scene,
                width=1024,
                height=1024,
                global_caption=request.prompt,
            )
            workflow = build_moss_workflow(
                layout_json=moss_layout,
                seed=request.seed if request.seed is not None else 42,
                steps=request.steps,
                negative_prompt=request.negative_prompt or "nsfw, worst quality, bad anatomy, watermark, blurry",
            )
        else:
            # Qwen Image 2.1 Workflow
            # Handle reference image upload if available
            if request.reference_image_base64:
                try:
                    b64_str = request.reference_image_base64
                    if "," in b64_str:
                        b64_str = b64_str.split(",", 1)[1]
                    img_bytes = base64.b64decode(b64_str)
                    uploaded_filename = f"shotlab_{job_id}.png"
                    await comfyui_client.upload_image(
                        image_bytes=img_bytes,
                        filename=uploaded_filename,
                        overwrite=True,
                    )
                except Exception:
                    uploaded_filename = "shotlab_input_pass_3d.png"
            else:
                uploaded_filename = "shotlab_input_pass_3d.png"

            workflow = build_qwen_workflow(
                prompt=request.prompt,
                reference_image_filename=uploaded_filename,
                negative_prompt=request.negative_prompt or "blurry, out of focus, deformed geometry, lowres, cartoon",
                seed=request.seed if request.seed is not None else 42,
                steps=request.steps,
                denoise=request.denoise,
            )

        # Queue prompt in ComfyUI
        queue_res = await comfyui_client.queue_prompt(workflow, client_id=job_id)
        prompt_id = queue_res.get("prompt_id")

        await db.execute(
            "UPDATE jobs SET progress = 30, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (job_id,),
        )
        await db.commit()

        # Listen to progress over WebSocket
        image_url: Optional[str] = None
        async for event in comfyui_client.stream_progress(client_id=job_id, prompt_id=prompt_id):
            evt_type = event.get("type")
            evt_data = event.get("data", {})

            if evt_type == "progress":
                val = evt_data.get("value", 0)
                max_val = evt_data.get("max", 1) or 1
                prog = int(30 + (val / max_val) * 60)
                await db.execute(
                    "UPDATE jobs SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (min(95, prog), job_id),
                )
                await db.commit()

            elif evt_type == "executed":
                output = evt_data.get("output", {})
                images = output.get("images", [])
                if images:
                    first_img = images[0]
                    image_url = comfyui_client.get_view_url(
                        filename=first_img.get("filename", ""),
                        subfolder=first_img.get("subfolder", ""),
                        image_type=first_img.get("type", "output"),
                    )

            elif evt_type == "offline":
                # Fallback if connection dropped
                break

        # If image_url was not captured via WS, try fetching history
        if not image_url and prompt_id:
            try:
                hist = await comfyui_client.get_history(prompt_id)
                prompt_hist = hist.get(prompt_id, {})
                outputs = prompt_hist.get("outputs", {})
                for _, node_output in outputs.items():
                    if "images" in node_output and node_output["images"]:
                        img_info = node_output["images"][0]
                        image_url = comfyui_client.get_view_url(
                            filename=img_info.get("filename", ""),
                            subfolder=img_info.get("subfolder", ""),
                            image_type=img_info.get("type", "output"),
                        )
                        break
            except Exception:
                pass

        final_image = image_url or request.reference_image_base64 or "/assets/placeholder-render.png"
        final_result = {
            "imageUrl": final_image,
            "engine": request.engine,
            "offline": False,
            "promptId": prompt_id,
        }

        await db.execute(
            """
            UPDATE jobs 
            SET status = 'completed', progress = 100, 
                result_json = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
            """,
            (json.dumps(final_result), job_id),
        )
        await db.commit()

    except Exception as e:
        # If ComfyUI fails, operate in graceful fallback rather than leaving an untracked error
        fallback_result = {
            "imageUrl": request.reference_image_base64 or "/assets/placeholder-render.png",
            "engine": request.engine,
            "offline": True,
            "error": str(e),
            "note": "Falha na comunicação com ComfyUI; operando em modo offline-safe.",
        }
        await db.execute(
            """
            UPDATE jobs 
            SET status = 'completed', progress = 100, 
                result_json = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
            """,
            (json.dumps(fallback_result), job_id),
        )
        await db.commit()
    finally:
        await db.close()


@router.post("/render", response_model=RenderJobResponse)
async def create_render_job_standalone(
    request: RenderJobRequest,
    background_tasks: BackgroundTasks,
    scene_id: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    target_scene_id = request.scene_id or scene_id or "default"
    return await create_render_job(
        scene_id=target_scene_id,
        request=request,
        background_tasks=background_tasks,
        db=db,
    )


@router.post("/scenes/{scene_id}/render", response_model=RenderJobResponse)
async def create_render_job(
    scene_id: str,
    request: RenderJobRequest,
    background_tasks: BackgroundTasks,
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    try:
        # Verify scene exists
        norm_id = "scene-default" if scene_id == "default" else scene_id
        async with db.execute("SELECT id FROM scenes WHERE id = ?", (norm_id,)) as cursor:
            row = await cursor.fetchone()
            if not row and scene_id not in ("default", "scene-default"):
                raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

        job_id = f"job-{uuid.uuid4().hex[:8]}"

        await db.execute(
            """
            INSERT INTO jobs (id, scene_id, status, progress, payload_json)
            VALUES (?, ?, 'pending', 0, ?)
            """,
            (job_id, norm_id, request.model_dump_json()),
        )
        await db.commit()

        background_tasks.add_task(process_comfyui_render, job_id, norm_id, request)

        return RenderJobResponse(
            job_id=job_id,
            scene_id=norm_id,
            status="pending",
            progress=0,
            engine=request.engine,
        )
    finally:
        await db.close()


@router.get("/jobs/{job_id}", response_model=RenderJobResponse)
@router.get("/render/{job_id}", response_model=RenderJobResponse)
async def get_job_status(job_id: str, db: aiosqlite.Connection = Depends(get_db_connection)):
    try:
        async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

            result_data = json.loads(row["result_json"]) if row["result_json"] else {}
            payload_data = json.loads(row["payload_json"]) if row["payload_json"] else {}
            engine = result_data.get("engine") or payload_data.get("engine", "qwen-2.1")

            return RenderJobResponse(
                job_id=row["id"],
                scene_id=row["scene_id"],
                status=row["status"],
                progress=row["progress"],
                image_url=result_data.get("imageUrl"),
                alpha_url=result_data.get("alphaUrl"),
                engine=engine,
                error=result_data.get("error"),
            )
    finally:
        await db.close()


@router.get("/render/{job_id}/metadata")
@router.get("/jobs/{job_id}/metadata")
async def get_render_job_metadata(
    job_id: str,
    db: aiosqlite.Connection = Depends(get_db_connection),
) -> Dict[str, Any]:
    """Returns structured JSON sidecar manifest containing all optical, spatial, and generative parameters."""
    try:
        async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

            job_dict = dict(row)
            scene_id = job_dict.get("scene_id", "scene-default")
            scene = await get_scene_model_from_db(db, scene_id)

            return build_shot_metadata(job_row=job_dict, scene=scene, alpha=False)
    finally:
        await db.close()


@router.get("/render/{job_id}/export")
@router.get("/jobs/{job_id}/export")
async def export_render_job(
    job_id: str,
    alpha: bool = Query(default=False, description="Whether to include transparency / RGBA alpha channel"),
    format: str = Query(default="png", description="Export file format ('png')"),
    db: aiosqlite.Connection = Depends(get_db_connection),
):
    """
    Exports a render job as 2K PNG with embedded tEXt technical metadata chunks.
    Supports alpha=True (32-bit RGBA) and alpha=False (24-bit RGB).
    """
    if format.lower() != "png":
        raise HTTPException(status_code=400, detail=f"Unsupported format '{format}'. Only 'png' is supported.")

    try:
        async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

            job_dict = dict(row)
            scene_id = job_dict.get("scene_id", "scene-default")
            scene = await get_scene_model_from_db(db, scene_id)

            png_bytes, metadata = export_job_png(
                job_row=job_dict,
                scene=scene,
                alpha=alpha,
                format_type=format,
            )

            return Response(
                content=png_bytes,
                media_type="image/png",
                headers={
                    "Content-Disposition": f'attachment; filename="shotlab_{job_id}.png"',
                    "X-Shotlab-Engine": str(metadata.get("engine", "")),
                    "X-Shotlab-Resolution": str(metadata.get("resolution", "")),
                },
            )
    finally:
        await db.close()

