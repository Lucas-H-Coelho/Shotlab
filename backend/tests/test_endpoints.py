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

        # 2. Add a valid object supported on floor (height 0.5m, center y=0.25m, base y=0.0m)
        new_obj = {
            "id": "test-box-1",
            "name": "Caixa Teste",
            "type": "box",
            "position": [1.5, 0.25, 0.5],
            "rotation": [0.0, 0.0, 0.0],
            "scale": [0.5, 0.5, 0.5],
            "material": {"color": "#ff0055", "roughness": 0.3, "metalness": 0.5},
            "visible": True,
            "locked": False
        }
        res_add = await ac.post("/v1/scenes/default/objects", json=new_obj)
        assert res_add.status_code == 201

        # 3. Try to add an invalid object penetrating the floor (height 1.0m, center y=0.2m -> base y=-0.3m) -> 422
        bad_floor_obj = {
            "id": "test-bad-floor",
            "name": "Caixa no Subsolo",
            "type": "box",
            "position": [2.5, 0.2, 0.0],
            "scale": [1.0, 1.0, 1.0]
        }
        res_bad_floor = await ac.post("/v1/scenes/default/objects", json=bad_floor_obj)
        assert res_bad_floor.status_code == 422
        assert res_bad_floor.json()["detail"]["code"] == "FLOOR_PENETRATION"

        # 4. Try to add an object that collides with hero-product (at [0, 1.05, 0], scale [0.25, 0.5, 0.25]) -> 422
        colliding_obj = {
            "id": "test-colliding",
            "name": "Caixa Colisora",
            "type": "box",
            "position": [0.0, 1.05, 0.0],
            "scale": [0.3, 0.5, 0.3]
        }
        res_colliding = await ac.post("/v1/scenes/default/objects", json=colliding_obj)
        assert res_colliding.status_code == 422
        assert res_colliding.json()["detail"]["code"] == "COLLISION_AABB"

        # 5. Validate scene endpoint
        res_val = await ac.post("/v1/scenes/default/validate")
        assert res_val.status_code == 200
        assert res_val.json()["status"] == "valid"

        # 6. Update camera optical parameters
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


def test_websocket_broadcast():
    from starlette.testclient import TestClient
    client = TestClient(app)
    with client.websocket_connect("/v1/scenes/scene-default/events") as websocket:
        # Patch an object via REST
        patch_res = client.patch(
            "/v1/scenes/scene-default/objects/hero-product",
            json={"name": "Hero Renamed via API"}
        )
        assert patch_res.status_code == 200

        # Receive WebSocket message
        message = websocket.receive_json()
        assert message["type"] == "OBJECT_UPDATED"
        assert message["scene_id"] == "scene-default"
        assert message["object_id"] == "hero-product"
        assert message["data"]["name"] == "Hero Renamed via API"

