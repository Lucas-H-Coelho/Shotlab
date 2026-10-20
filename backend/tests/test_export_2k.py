import json
import struct
import pytest
from httpx import AsyncClient, ASGITransport

from main import app
from services.export_service import (
    PNG_SIGNATURE,
    parse_png_chunks,
    extract_png_metadata,
    generate_synthetic_2k_plate,
    inject_png_metadata,
)
from routers.render import process_comfyui_render
from models.scene import RenderJobRequest


@pytest.mark.anyio
async def test_export_service_png_primitives():
    """Validates low-level PNG generation, chunk encoding and metadata injection."""
    # 1. Generate RGB synthetic plate (2K)
    plate_rgb = generate_synthetic_2k_plate(width=2048, height=1365, alpha=False)
    assert plate_rgb.startswith(PNG_SIGNATURE)

    chunks_rgb = parse_png_chunks(plate_rgb)
    assert len(chunks_rgb) >= 3  # IHDR, IDAT, IEND
    ihdr_type, ihdr_data = chunks_rgb[0]
    assert ihdr_type == b"IHDR"
    w, h, bit_depth, color_type = struct.unpack(">IIBB", ihdr_data[:10])
    assert w == 2048
    assert h == 1365
    assert bit_depth == 8
    assert color_type == 2  # RGB (24 bits)

    # 2. Generate RGBA synthetic plate (2K with alpha transparency)
    plate_rgba = generate_synthetic_2k_plate(width=2048, height=1365, alpha=True)
    assert plate_rgba.startswith(PNG_SIGNATURE)
    chunks_rgba = parse_png_chunks(plate_rgba)
    _, ihdr_rgba_data = chunks_rgba[0]
    _, _, _, color_type_rgba = struct.unpack(">IIBB", ihdr_rgba_data[:10])
    assert color_type_rgba == 6  # RGBA (32 bits with alpha channel)

    # 3. Test metadata injection
    dummy_metadata = {
        "job_id": "job-test-123",
        "scene_id": "scene-default",
        "focal_length_mm": 85.0,
        "f_stop": 1.8,
        "focus_distance_m": 2.2,
        "engine": "qwen-2.1",
        "prompt": "Luxury perfume bottle with dramatic rim light",
        "software": "Shotlab Studio v1.0.0",
        "fov": {"horizontal_deg": 23.9, "vertical_deg": 16.1},
    }
    injected_png = inject_png_metadata(plate_rgba, dummy_metadata)
    extracted = extract_png_metadata(injected_png)

    assert "Shotlab-Metadata" in extracted
    assert "Software" in extracted
    assert "Camera-Optics" in extracted
    assert "Engine" in extracted
    assert "Scene-ID" in extracted

    parsed_shotlab_meta = json.loads(extracted["Shotlab-Metadata"])
    assert parsed_shotlab_meta["job_id"] == "job-test-123"
    assert parsed_shotlab_meta["focal_length_mm"] == 85.0
    assert parsed_shotlab_meta["f_stop"] == 1.8
    assert extracted["Software"] == "Shotlab Studio v1.0.0"
    assert extracted["Engine"] == "qwen-2.1"
    assert extracted["Scene-ID"] == "scene-default"


@pytest.mark.anyio
async def test_render_job_creation_and_metadata_endpoint():
    """
    Tests POST /v1/render job submission and GET /v1/render/{job_id}/metadata
    inspection of camera optics, DoF, FOV, prompt and 2K resolution.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create render job via POST /v1/render
        payload = {
            "prompt": "Studio portrait with 85mm f/1.4 lens and soft volumetric lighting",
            "negative_prompt": "blurry, low quality, cartoon",
            "steps": 30,
            "denoise": 0.8,
            "seed": 123456,
            "engine": "qwen-2.1",
        }
        res_post = await ac.post("/v1/render", json=payload)
        assert res_post.status_code == 200
        job_data = res_post.json()
        job_id = job_data["job_id"]
        assert job_id.startswith("job-")
        assert job_data["status"] == "pending"
        assert job_data["engine"] == "qwen-2.1"

        # 2. Query GET /v1/render/{job_id}/metadata
        res_meta = await ac.get(f"/v1/render/{job_id}/metadata")
        assert res_meta.status_code == 200
        meta = res_meta.json()

        # Check required metadata fields
        assert meta["job_id"] == job_id
        assert meta["software"] == "Shotlab Studio v1.0.0"
        assert meta["engine"] == "qwen-2.1"
        assert meta["prompt"] == payload["prompt"]
        assert meta["seed"] == 123456
        assert meta["steps"] == 30
        assert meta["resolution"] == "2048x1365"  # 3:2 Full Frame default sensor
        assert meta["width"] == 2048
        assert meta["height"] == 1365

        # Check physical camera and optical calculations
        assert meta["focal_length_mm"] == 85.0
        assert meta["f_stop"] == 1.8
        assert meta["focus_distance_m"] == 2.2
        assert meta["sensor_width_mm"] == 36.0
        assert meta["sensor_height_mm"] == 24.0
        assert "fov" in meta
        assert meta["fov"]["horizontal_deg"] > 0
        assert meta["fov"]["vertical_deg"] > 0
        assert "dof" in meta
        assert meta["dof"]["hyperfocal_m"] > 0
        assert meta["dof"]["near_limit_m"] > 0


@pytest.mark.anyio
async def test_export_2k_rgb_and_rgba_modes():
    """
    Tests downloading GET /v1/render/{job_id}/export with alpha=false (RGB)
    and alpha=true (RGBA), verifying PNG header signature, IHDR color mode
    and embedded tEXt chunk Shotlab-Metadata.
    """
    req = RenderJobRequest(
        prompt="Cosmetics glass bottle on pedestal with rim light",
        engine="qwen-2.1",
        steps=25,
        seed=42,
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create job
        res_create = await ac.post("/v1/render", json=req.model_dump())
        assert res_create.status_code == 200
        job_id = res_create.json()["job_id"]

        # Run worker directly to simulate completion in offline-safe mode
        await process_comfyui_render(job_id=job_id, scene_id="scene-default", request=req)

        # -------------------------------------------------------------
        # 1. Export RGB (alpha=false)
        # -------------------------------------------------------------
        res_rgb = await ac.get(f"/v1/render/{job_id}/export?alpha=false&format=png")
        assert res_rgb.status_code == 200
        assert res_rgb.headers["content-type"] == "image/png"
        assert f'attachment; filename="shotlab_{job_id}.png"' in res_rgb.headers["content-disposition"]
        assert res_rgb.headers["x-shotlab-engine"] == "qwen-2.1"
        assert res_rgb.headers["x-shotlab-resolution"] == "2048x1365"

        rgb_bytes = res_rgb.content
        # Verify PNG Magic Signature
        assert rgb_bytes.startswith(PNG_SIGNATURE)

        # Verify IHDR Color Mode == 2 (RGB 24-bit)
        chunks_rgb = parse_png_chunks(rgb_bytes)
        ihdr_type, ihdr_data = chunks_rgb[0]
        assert ihdr_type == b"IHDR"
        w_rgb, h_rgb, depth_rgb, color_type_rgb = struct.unpack(">IIBB", ihdr_data[:10])
        assert w_rgb == 2048
        assert h_rgb == 1365
        assert depth_rgb == 8
        assert color_type_rgb == 2, f"Expected RGB color type 2, got {color_type_rgb}"

        # Verify presence of tEXt chunks
        text_metadata_rgb = extract_png_metadata(rgb_bytes)
        assert "Shotlab-Metadata" in text_metadata_rgb
        assert text_metadata_rgb["Software"] == "Shotlab Studio v1.0.0"
        assert text_metadata_rgb["Engine"] == "qwen-2.1"
        assert "Camera-Optics" in text_metadata_rgb

        # Verify JSON content inside Shotlab-Metadata tEXt chunk
        parsed_rgb_meta = json.loads(text_metadata_rgb["Shotlab-Metadata"])
        assert parsed_rgb_meta["job_id"] == job_id
        assert parsed_rgb_meta["resolution"] == "2048x1365"
        assert parsed_rgb_meta["color_mode"] == "RGB"
        assert parsed_rgb_meta["has_alpha"] is False
        assert parsed_rgb_meta["focal_length_mm"] == 85.0
        assert parsed_rgb_meta["f_stop"] == 1.8

        # -------------------------------------------------------------
        # 2. Export RGBA with Alpha Channel (alpha=true)
        # -------------------------------------------------------------
        res_rgba = await ac.get(f"/v1/render/{job_id}/export?alpha=true&format=png")
        assert res_rgba.status_code == 200
        assert res_rgba.headers["content-type"] == "image/png"
        assert f'attachment; filename="shotlab_{job_id}.png"' in res_rgba.headers["content-disposition"]

        rgba_bytes = res_rgba.content
        assert rgba_bytes.startswith(PNG_SIGNATURE)

        # Verify IHDR Color Mode == 6 (RGBA 32-bit with transparency)
        chunks_rgba = parse_png_chunks(rgba_bytes)
        ihdr_type_rgba, ihdr_data_rgba = chunks_rgba[0]
        assert ihdr_type_rgba == b"IHDR"
        w_rgba, h_rgba, depth_rgba, color_type_rgba = struct.unpack(">IIBB", ihdr_data_rgba[:10])
        assert w_rgba == 2048
        assert h_rgba == 1365
        assert depth_rgba == 8
        assert color_type_rgba == 6, f"Expected RGBA color type 6, got {color_type_rgba}"

        # Verify presence and contents of tEXt metadata chunk
        text_metadata_rgba = extract_png_metadata(rgba_bytes)
        assert "Shotlab-Metadata" in text_metadata_rgba
        parsed_rgba_meta = json.loads(text_metadata_rgba["Shotlab-Metadata"])
        assert parsed_rgba_meta["color_mode"] == "RGBA"
        assert parsed_rgba_meta["has_alpha"] is True


@pytest.mark.anyio
async def test_export_with_moss_engine_and_aliases():
    """Tests export endpoints with MOSS-Image engine and /v1/jobs/{job_id} aliases."""
    req = RenderJobRequest(
        prompt="Architectural interior with sharp text labels",
        engine="moss-image",
        steps=50,
        seed=999,
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_create = await ac.post("/v1/scenes/default/render", json=req.model_dump())
        assert res_create.status_code == 200
        job_id = res_create.json()["job_id"]

        await process_comfyui_render(job_id=job_id, scene_id="scene-default", request=req)

        # Access via /v1/jobs/{job_id}/metadata alias
        res_meta = await ac.get(f"/v1/jobs/{job_id}/metadata")
        assert res_meta.status_code == 200
        meta = res_meta.json()
        assert meta["engine"] == "moss-image"

        # Access via /v1/jobs/{job_id}/export alias
        res_export = await ac.get(f"/v1/jobs/{job_id}/export?alpha=true")
        assert res_export.status_code == 200
        assert res_export.content.startswith(PNG_SIGNATURE)
        extracted = extract_png_metadata(res_export.content)
        assert extracted["Engine"] == "moss-image"


@pytest.mark.anyio
async def test_export_error_handling():
    """Tests 404 for non-existent job and 400 for unsupported format."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Non-existent job
        res_404_meta = await ac.get("/v1/render/job-nonexistent-9999/metadata")
        assert res_404_meta.status_code == 404

        res_404_export = await ac.get("/v1/render/job-nonexistent-9999/export")
        assert res_404_export.status_code == 404

        # Create valid job to test invalid format
        res_create = await ac.post("/v1/render", json={"prompt": "Valid test prompt"})
        job_id = res_create.json()["job_id"]

        # Unsupported format (e.g. jpeg, webp)
        res_bad_format = await ac.get(f"/v1/render/{job_id}/export?format=jpeg")
        assert res_bad_format.status_code == 400
        assert "Unsupported format" in res_bad_format.json()["detail"]
