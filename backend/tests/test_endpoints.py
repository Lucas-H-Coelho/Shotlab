import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.anyio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "Shotlab API", "version": "1.0.0"}

@pytest.mark.anyio
async def test_scene_lifecycle_and_validation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Fetch default scene
        res = await ac.get("/v1/scenes/default")
        assert res.status_code == 200
        scene_data = res.json()
        assert scene_data["id"] == "scene-default"
        assert len(scene_data["objects"]) >= 2
        assert scene_data["camera"]["focal_length_mm"] == 85.0

        # 2. Add a valid object
        new_obj = {
            "id": "test-box-1",
            "name": "Caixa Teste",
            "type": "box",
            "position": [0.5, 0.25, 0.5],
            "rotation": [0.0, 0.0, 0.0],
            "scale": [0.5, 0.5, 0.5],
            "material": {"color": "#ff0055", "roughness": 0.3, "metalness": 0.5},
            "visible": True,
            "locked": False
        }
        res_add = await ac.post("/v1/scenes/default/objects", json=new_obj)
        assert res_add.status_code == 201

        # 3. Try to add an invalid object sinking below ground floor (Y < 0) -> Must return 422
        bad_obj = {
            "id": "test-bad",
            "name": "Caixa no Subsolo",
            "type": "box",
            "position": [0.0, -1.0, 0.0],
            "scale": [1.0, 1.0, 1.0]
        }
        res_bad = await ac.post("/v1/scenes/default/objects", json=bad_obj)
        assert res_bad.status_code == 422

        # 4. Update camera optical parameters
        cam_update = {
            "focal_length_mm": 50.0,
            "sensor_width_mm": 36.0,
            "sensor_height_mm": 24.0,
            "f_stop": 2.8,
            "focus_distance_m": 1.8,
            "position": [0.0, 1.5, 3.0],
            "target": [0.0, 1.0, 0.0],
            "aspect_ratio": 1.5
        }
        res_cam = await ac.put("/v1/scenes/default/camera", json=cam_update)
        assert res_cam.status_code == 200
        assert res_cam.json()["focal_length_mm"] == 50.0
        assert res_cam.json()["f_stop"] == 2.8
