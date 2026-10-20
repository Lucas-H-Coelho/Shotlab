"""
Unit and integration tests for ComfyUI Async Client and Render Endpoints.
Covers:
- Online & Offline-Safe health checks
- Image upload and prompt queueing (success and offline exceptions)
- WebSocket progress streaming and offline fallback isolation
- 3D-to-2D MOSS-Image layout projection (abs_centralized yxyx)
- MOSS and Qwen workflow API format generators
- FastAPI endpoints: GET /v1/render/health and POST /v1/scenes/{scene_id}/render
"""

import json
import math
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import httpx
from httpx import AsyncClient, ASGITransport

from main import app
from models.scene import SceneGraphModel, CameraModel, SceneObjectModel, RenderJobRequest
from services.comfyui_client import (
    ComfyUIClient,
    ComfyUIError,
    ComfyUIOfflineError,
    build_moss_layout_from_scene,
    build_moss_workflow,
    build_qwen_workflow,
)
from routers.render import process_comfyui_render


# ==============================================================================
# 1. Healthcheck Tests (check_health)
# ==============================================================================

@pytest.mark.anyio
async def test_check_health_online():
    """When ComfyUI is running, returns online=True with system statistics."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")
    mock_stats = {"system": {"os": "linux", "python_version": "3.11"}, "devices": [{"name": "RTX 4080"}]}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_stats
        mock_get.return_value = mock_response

        health = await client.check_health()
        assert health["online"] is True
        assert health["url"] == "http://mock-comfyui:8188"
        assert health["details"] == mock_stats


@pytest.mark.anyio
async def test_check_health_http_error():
    """When ComfyUI returns a non-200 code, gracefully returns online=False without throwing."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 502
        mock_get.return_value = mock_response

        health = await client.check_health()
        assert health["online"] is False
        assert health["url"] == "http://mock-comfyui:8188"
        assert health["details"]["status_code"] == 502


@pytest.mark.anyio
async def test_check_health_offline_connection_refused():
    """When ComfyUI is offline or unreachable, returns online=False without crashing."""
    client = ComfyUIClient(base_url="http://offline-comfyui:8188")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.ConnectError("Connection refused to ComfyUI")

        health = await client.check_health()
        assert health["online"] is False
        assert health["url"] == "http://offline-comfyui:8188"
        assert "error" in health["details"]
        assert "Connection refused" in health["details"]["error"]


@pytest.mark.anyio
async def test_check_health_timeout():
    """When ComfyUI connection times out, returns online=False without crashing."""
    client = ComfyUIClient(base_url="http://slow-comfyui:8188")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.TimeoutException("Read timed out (2.0s)")

        health = await client.check_health()
        assert health["online"] is False
        assert health["url"] == "http://slow-comfyui:8188"
        assert "TimeoutException" in health["details"]["error_type"]


# ==============================================================================
# 2. Upload Image Tests (upload_image)
# ==============================================================================

@pytest.mark.anyio
async def test_upload_image_success():
    """Successful image upload to POST /upload/image."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")
    mock_res_json = {"name": "test_pass.png", "subfolder": "", "type": "input"}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_res_json
        mock_post.return_value = mock_resp

        res = await client.upload_image(b"fake_png_data", "test_pass.png")
        assert res["name"] == "test_pass.png"


@pytest.mark.anyio
async def test_upload_image_offline_error():
    """Upload when ComfyUI is offline raises ComfyUIOfflineError."""
    client = ComfyUIClient(base_url="http://offline-comfyui:8188")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.ConnectError("Connection refused")

        with pytest.raises(ComfyUIOfflineError) as exc_info:
            await client.upload_image(b"image_bytes", "test.png")
        assert "offline or unreachable" in str(exc_info.value)


@pytest.mark.anyio
async def test_upload_image_http_error():
    """Upload returning HTTP 400 raises ComfyUIError."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        req = httpx.Request("POST", "http://mock-comfyui:8188/upload/image")
        resp = httpx.Response(400, text="Invalid image format", request=req)
        mock_post.side_effect = httpx.HTTPStatusError("Bad Request", request=req, response=resp)

        with pytest.raises(ComfyUIError) as exc_info:
            await client.upload_image(b"broken_bytes", "test.png")
        assert "ComfyUI upload failed (400)" in str(exc_info.value)


# ==============================================================================
# 3. Queue Prompt Tests (queue_prompt)
# ==============================================================================

@pytest.mark.anyio
async def test_queue_prompt_success():
    """Successfully queues a workflow prompt."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")
    mock_res_json = {"prompt_id": "prompt-xyz-123", "number": 1, "node_errors": {}}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_res_json
        mock_post.return_value = mock_resp

        res = await client.queue_prompt({"1": {"class_type": "KSampler"}}, client_id="test-client")
        assert res["prompt_id"] == "prompt-xyz-123"


@pytest.mark.anyio
async def test_queue_prompt_offline_error():
    """Queue prompt when ComfyUI is offline raises ComfyUIOfflineError."""
    client = ComfyUIClient(base_url="http://offline-comfyui:8188")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.ConnectError("Failed to connect")

        with pytest.raises(ComfyUIOfflineError):
            await client.queue_prompt({"1": {}})


# ==============================================================================
# 4. Stream Progress Tests (stream_progress)
# ==============================================================================

class MockWebSocket:
    """Mock for websockets connection context manager."""
    def __init__(self, messages):
        self.messages = list(messages)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False

    async def recv(self):
        if self.messages:
            return self.messages.pop(0)
        raise TimeoutError("No more messages")


@pytest.mark.anyio
async def test_stream_progress_normal_execution():
    """Receives progress messages and terminates when node is None in executing."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")
    messages = [
        json.dumps({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 0}}}}),
        json.dumps({"type": "progress", "data": {"value": 25, "max": 50, "prompt_id": "p1"}}),
        json.dumps({"type": "executed", "data": {"node": "10", "output": {"images": [{"filename": "out.png"}]}, "prompt_id": "p1"}}),
        json.dumps({"type": "executing", "data": {"node": None, "prompt_id": "p1"}}),
    ]

    with patch("websockets.connect", return_value=MockWebSocket(messages)):
        events = []
        async for evt in client.stream_progress(client_id="c1", prompt_id="p1"):
            events.append(evt)

        assert len(events) == 4
        assert events[0]["type"] == "status"
        assert events[1]["type"] == "progress"
        assert events[1]["data"]["value"] == 25
        assert events[2]["type"] == "executed"
        assert events[3]["type"] == "executing"
        assert events[3]["data"]["node"] is None


@pytest.mark.anyio
async def test_stream_progress_binary_preview():
    """Receives binary preview frame and yields preview_bytes."""
    client = ComfyUIClient(base_url="http://mock-comfyui:8188")
    binary_frame = b"\x00\x00\x00\x01\x00\x00\x00\x02RAW_JPEG_BYTES"
    messages = [
        binary_frame,
        json.dumps({"type": "executing", "data": {"node": None, "prompt_id": "p1"}}),
    ]

    with patch("websockets.connect", return_value=MockWebSocket(messages)):
        events = []
        async for evt in client.stream_progress(client_id="c1", prompt_id="p1"):
            events.append(evt)

        assert len(events) == 2
        assert events[0]["type"] == "preview_bytes"
        assert events[0]["data"] == binary_frame


@pytest.mark.anyio
async def test_stream_progress_offline_fallback():
    """When WebSocket connection fails (offline), yields offline event gracefully without throwing."""
    client = ComfyUIClient(base_url="http://offline-comfyui:8188")

    with patch("websockets.connect", side_effect=OSError("Connection refused")):
        events = []
        async for evt in client.stream_progress(client_id="c1", prompt_id="p1"):
            events.append(evt)

        assert len(events) == 1
        assert events[0]["type"] == "offline"
        assert events[0]["data"]["online"] is False
        assert "fallback" in events[0]["data"]["message"]


# ==============================================================================
# 5. MOSS-Image 3D Layout Projection Tests (build_moss_layout_from_scene)
# ==============================================================================

def test_moss_layout_dimensions_validation():
    """Canvas dimensions must be strict multiples of 16."""
    cam = CameraModel()
    scene = SceneGraphModel(id="s1", name="Test Scene", camera=cam, objects=[])

    with pytest.raises(ValueError) as exc:
        build_moss_layout_from_scene(scene, width=1000, height=1024)
    assert "multiples of 16" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        build_moss_layout_from_scene(scene, width=1024, height=1005)
    assert "multiples of 16" in str(exc.value)


def test_moss_layout_projection_abs_centralized_yxyx():
    """
    Validates projection of 3D objects to MOSS-Image abs_centralized yxyx format
    according to docs/RESEARCH_MOSS_IMAGE.md.
    """
    cam = CameraModel(
        focal_length_mm=85.0,
        sensor_width_mm=36.0,
        sensor_height_mm=24.0,
        position=[0.0, 1.3, 2.2],
        target=[0.0, 0.8, 0.0],
    )
    podium = SceneObjectModel(
        id="podium",
        name="Pedestal Studio",
        type="cylinder",
        position=[0.0, 0.5, 0.0],
        scale=[0.8, 0.6, 0.8],
        material={"color": "#1e293b", "roughness": 0.4},
    )
    product = SceneObjectModel(
        id="hero",
        name="Frasco Cosmético",
        type="box",
        position=[0.0, 0.95, 0.0],
        scale=[0.15, 0.30, 0.15],
        material={"color": "#e11d48", "roughness": 0.2},
    )
    backdrop = SceneObjectModel(
        id="bg",
        name="Fundo Infinito",
        type="backdrop",
        position=[0.0, 1.75, -1.8],
        scale=[6.0, 3.5, 2.5],
    )
    invisible_obj = SceneObjectModel(
        id="hidden",
        name="Objeto Oculto",
        type="box",
        position=[1.0, 0.5, 0.0],
        scale=[0.3, 0.3, 0.3],
        visible=False,
    )

    scene = SceneGraphModel(
        id="scene-test",
        name="Cena Teste",
        camera=cam,
        objects=[podium, product, backdrop, invisible_obj],
    )

    layout = build_moss_layout_from_scene(
        scene_graph=scene,
        width=1024,
        height=1024,
        global_caption="A luxury commercial product shot with studio lighting.",
    )

    assert layout["bbox_coord_space"] == "abs_centralized"
    assert layout["bbox_format"] == "yxyx"
    assert layout["summary"]["caption"] == "A luxury commercial product shot with studio lighting."

    # Backdrops and invisible objects must be excluded
    items = layout["items"]
    assert len(items) == 2

    # Check labels and bounding boxes
    for item in items:
        assert item["label"] == "object"
        assert "caption" in item
        bbox = item["bbox"]
        assert len(bbox) == 4
        y_min, x_min, y_max, x_max = bbox

        # Coordinates must be integers in abs_centralized range [-W/2, W/2] and [-H/2, H/2]
        assert isinstance(y_min, int) and isinstance(x_min, int)
        assert isinstance(y_max, int) and isinstance(x_max, int)
        assert -512 <= y_min <= 512
        assert -512 <= y_max <= 512
        assert -512 <= x_min <= 512
        assert -512 <= x_max <= 512
        assert y_min < y_max
        assert x_min < x_max


def test_moss_layout_behind_camera_excluded():
    """Objects located behind the camera (cam_z >= -0.05) must be discarded."""
    cam = CameraModel(
        position=[0.0, 1.0, 2.0],
        target=[0.0, 1.0, 0.0],  # Camera looks in -Z direction
    )
    # Object positioned behind camera at Z = 5.0
    behind_obj = SceneObjectModel(
        id="behind",
        name="Atrás da Câmera",
        type="box",
        position=[0.0, 1.0, 5.0],
        scale=[0.5, 0.5, 0.5],
    )
    scene = SceneGraphModel(id="s1", name="S1", camera=cam, objects=[behind_obj])

    layout = build_moss_layout_from_scene(scene, width=1024, height=1024)
    assert len(layout["items"]) == 0


def test_moss_layout_from_dict():
    """Functions accepting a raw dictionary instead of SceneGraphModel instance."""
    cam = CameraModel()
    scene = SceneGraphModel(
        id="s1",
        name="S1",
        camera=cam,
        objects=[
            SceneObjectModel(
                id="obj1",
                name="Caixa",
                type="box",
                position=[0.0, 0.5, 0.0],
                scale=[0.4, 0.4, 0.4],
            )
        ],
    )
    scene_dict = scene.model_dump()
    layout = build_moss_layout_from_scene(scene_dict, width=1024, height=1024)
    assert layout["bbox_coord_space"] == "abs_centralized"
    assert len(layout["items"]) == 1


# ==============================================================================
# 6. Workflow Builders Tests (build_moss_workflow & build_qwen_workflow)
# ==============================================================================

def test_build_moss_workflow_nodes():
    """Ensures MOSS-Image API workflow contains all required nodes according to RESEARCH_MOSS_IMAGE.md."""
    layout_sample = {
        "summary": {"caption": "Studio scene"},
        "items": [],
        "bbox_coord_space": "abs_centralized",
        "bbox_format": "yxyx",
    }
    wf = build_moss_workflow(layout_sample, seed=99, steps=50, width=1024, height=1024)

    assert wf["1"]["class_type"] == "MOSSImageHFDiTLoader"
    assert wf["2"]["class_type"] == "MOSSImageCLIPLoader"
    assert wf["4"]["class_type"] == "ModelSamplingSD3"
    assert wf["4"]["inputs"]["shift"] == 5.0
    assert wf["5"]["class_type"] == "SkipLayerGuidanceDiTSimple"
    assert wf["5"]["inputs"]["single_layers"] == "22"
    assert wf["6"]["class_type"] == "CLIPTextEncode"
    assert wf["9"]["class_type"] == "KSampler"
    assert wf["9"]["inputs"]["steps"] == 50
    assert wf["9"]["inputs"]["sampler_name"] == "euler"
    assert wf["9"]["inputs"]["scheduler"] == "sgm_uniform"
    assert wf["11"]["class_type"] == "SaveImage"


def test_build_qwen_workflow_nodes():
    """Ensures Qwen Image 2.1 API workflow contains canonical reference-splicing nodes."""
    wf = build_qwen_workflow(
        prompt="Studio perfume shot",
        reference_image_filename="shotlab_input_pass.png",
        seed=123,
        steps=25,
        denoise=0.85,
    )

    assert wf["1"]["class_type"] == "UNETLoader"
    assert wf["2"]["class_type"] == "CLIPLoader"
    assert wf["3"]["class_type"] == "VAELoader"
    assert wf["6"]["class_type"] == "LoadImage"
    assert wf["6"]["inputs"]["image"] == "shotlab_input_pass.png"
    assert wf["7"]["class_type"] == "TextEncodeQwenImage21"
    assert wf["8"]["class_type"] == "KSampler"
    assert wf["8"]["inputs"]["steps"] == 25
    assert wf["10"]["class_type"] == "SaveImage"


# ==============================================================================
# 7. FastAPI Endpoint Integration Tests
# ==============================================================================

@pytest.mark.anyio
async def test_get_render_health_endpoint():
    """GET /v1/render/health returns ComfyUI connectivity state."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/render/health")
        assert res.status_code == 200
        data = res.json()
        assert "online" in data
        assert "url" in data
        assert "details" in data


@pytest.mark.anyio
async def test_create_render_job_dual_engines():
    """POST /v1/scenes/{scene_id}/render supports both qwen-2.1 and moss-image engines."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Render job with Qwen Image 2.1
        payload_qwen = {
            "prompt": "Commercial cosmetic photography with studio reflections",
            "steps": 25,
            "engine": "qwen-2.1",
        }
        res_qwen = await ac.post("/v1/scenes/default/render", json=payload_qwen)
        assert res_qwen.status_code == 200
        job_qwen = res_qwen.json()
        assert job_qwen["status"] == "pending"
        assert job_qwen["engine"] == "qwen-2.1"

        # 2. Render job with MOSS-Image
        payload_moss = {
            "prompt": "Editorial poster layout with sharp typography",
            "steps": 50,
            "engine": "moss-image",
        }
        res_moss = await ac.post("/v1/scenes/default/render", json=payload_moss)
        assert res_moss.status_code == 200
        job_moss = res_moss.json()
        assert job_moss["status"] == "pending"
        assert job_moss["engine"] == "moss-image"


@pytest.mark.anyio
async def test_offline_safe_render_execution_moss():
    """
    Directly exercises process_comfyui_render when ComfyUI is offline for MOSS-Image,
    verifying it finishes in completed status with offline note and generated layout.
    """
    req = RenderJobRequest(
        prompt="Studio shot with sharp typography",
        steps=50,
        engine="moss-image",
        reference_image_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create job
        res_create = await ac.post("/v1/scenes/default/render", json=req.model_dump())
        assert res_create.status_code == 200
        job_id = res_create.json()["job_id"]

        # Run process_comfyui_render directly in test
        await process_comfyui_render(job_id=job_id, scene_id="scene-default", request=req)

        # Check job status
        res_job = await ac.get(f"/v1/jobs/{job_id}")
        assert res_job.status_code == 200
        job_data = res_job.json()
        assert job_data["status"] == "completed"
        assert job_data["progress"] == 100
        assert job_data["engine"] == "moss-image"
        assert job_data["image_url"].startswith("data:image/png;base64,")


@pytest.mark.anyio
async def test_offline_safe_render_execution_qwen():
    """
    Exercises process_comfyui_render when ComfyUI is offline for Qwen Image 2.1,
    verifying seamless fallback without throwing or failing.
    """
    req = RenderJobRequest(
        prompt="Photo of perfume on pedestal",
        steps=25,
        engine="qwen-2.1",
        reference_image_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_create = await ac.post("/v1/scenes/default/render", json=req.model_dump())
        assert res_create.status_code == 200
        job_id = res_create.json()["job_id"]

        await process_comfyui_render(job_id=job_id, scene_id="scene-default", request=req)

        res_job = await ac.get(f"/v1/jobs/{job_id}")
        assert res_job.status_code == 200
        job_data = res_job.json()
        assert job_data["status"] == "completed"
        assert job_data["progress"] == 100
        assert job_data["engine"] == "qwen-2.1"
