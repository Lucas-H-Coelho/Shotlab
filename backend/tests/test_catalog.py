import pytest
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient

from main import app
from models.catalog import PARAMETRIC_CATALOG
from models.scene import SceneObjectModel
from services.validator import check_floor_contact, get_object_aabb

@pytest.mark.anyio
async def test_list_primitives():
    """
    Verifies GET /v1/catalog/primitives returns all 7 studio presets with real-world physical
    dimensions in meters, physical boundaries (min_m, max_m) and PBR materials.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/catalog/primitives")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 7

        preset_ids = {p["id"] for p in data}
        expected_ids = {
            "studio_table",
            "cyclorama",
            "pedestal",
            "shelf",
            "studio_wall",
            "softbox_80x120",
            "human_mannequin",
        }
        assert preset_ids == expected_ids

        # 1. Studio table (1.60m × 0.75m × 0.80m, position [0, 0.375, 0])
        table = next(p for p in data if p["id"] == "studio_table")
        assert table["name"] == "Mesa de Estúdio"
        assert table["width_m"] == 1.60
        assert table["height_m"] == 0.75
        assert table["depth_m"] == 0.80
        assert table["default_position"] == [0.0, 0.375, 0.0]
        assert table["material"]["color"] == "#334155"

        # 2. Cyclorama (4.00m × 3.00m × 3.00m, position [0, 1.50, -1.50])
        cyc = next(p for p in data if p["id"] == "cyclorama")
        assert cyc["name"] == "Ciclorama Infinito"
        assert cyc["width_m"] == 4.00
        assert cyc["height_m"] == 3.00
        assert cyc["depth_m"] == 3.00
        assert cyc["default_position"] == [0.0, 1.50, -1.50]
        assert cyc["material"]["color"] == "#f8fafc"

        # 3. Pedestal (0.40m × 1.00m × 0.40m, position [0, 0.50, 0])
        ped = next(p for p in data if p["id"] == "pedestal")
        assert ped["width_m"] == 0.40
        assert ped["height_m"] == 1.00
        assert ped["depth_m"] == 0.40
        assert ped["default_position"] == [0.0, 0.50, 0.0]

        # 4. Shelf (1.20m × 1.80m × 0.35m, position [0, 0.90, -1.00])
        shelf = next(p for p in data if p["id"] == "shelf")
        assert shelf["width_m"] == 1.20
        assert shelf["height_m"] == 1.80
        assert shelf["depth_m"] == 0.35
        assert shelf["default_position"] == [0.0, 0.90, -1.00]

        # 5. Studio Wall (3.00m × 2.80m × 0.15m, position [0, 1.40, -2.00])
        wall = next(p for p in data if p["id"] == "studio_wall")
        assert wall["width_m"] == 3.00
        assert wall["height_m"] == 2.80
        assert wall["depth_m"] == 0.15
        assert wall["default_position"] == [0.0, 1.40, -2.00]

        # 6. Softbox 80x120 (0.80m × 1.20m × 0.45m, position [1.50, 1.60, 1.50], kelvin 5600, intensity)
        softbox = next(p for p in data if p["id"] == "softbox_80x120")
        assert softbox["width_m"] == 0.80
        assert softbox["height_m"] == 1.20
        assert softbox["depth_m"] == 0.45
        assert softbox["default_position"] == [1.50, 1.60, 1.50]
        assert softbox["metadata"]["kelvin"] == 5600
        assert softbox["metadata"]["intensity"] == 1.5

        # 7. Human Mannequin (0.50m × 1.75m × 0.30m, position [0, 0.875, 0], poses)
        mannequin = next(p for p in data if p["id"] == "human_mannequin")
        assert mannequin["width_m"] == 0.50
        assert mannequin["height_m"] == 1.75
        assert mannequin["depth_m"] == 0.30
        assert mannequin["default_position"] == [0.0, 0.875, 0.0]
        assert "standing" in mannequin["metadata"]["supported_poses"]
        assert "hero" in mannequin["metadata"]["supported_poses"]

@pytest.mark.anyio
async def test_get_primitive_by_id():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/catalog/primitives/studio_table")
        assert res.status_code == 200
        assert res.json()["id"] == "studio_table"

        res_404 = await ac.get("/v1/catalog/primitives/non_existent_preset")
        assert res_404.status_code == 404

@pytest.mark.anyio
async def test_spawn_preset_floor_contact_calculation():
    """
    Tests automatic calculation of position[1] = height_m / 2.0 to ensure zero floor penetration
    and exact contact with the studio floor (base elevation Y = 0.0m).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Spawn pedestal with custom height 1.20m at an empty spot [2.5, Y, 2.5]
        payload = {
            "preset_id": "pedestal",
            "name": "Pedestal Alto",
            "height_m": 1.20,
            "x_m": 2.5,
            "z_m": 2.5,
        }
        res = await ac.post("/v1/scenes/scene-default/spawn-preset", json=payload)
        assert res.status_code == 201
        data = res.json()

        # Check position Y is exactly height / 2.0 = 0.60m
        assert data["position"][0] == 2.5
        assert data["position"][1] == 0.60
        assert data["position"][2] == 2.5
        assert data["scale"] == [0.40, 1.20, 0.40]

        # Verify physics validator: base elevation must be 0.0m and pass floor check
        spawned_obj = SceneObjectModel.model_validate(data)
        min_bounds, max_bounds = get_object_aabb(spawned_obj)
        assert round(min_bounds[1], 4) == 0.0
        assert check_floor_contact(spawned_obj) is None

@pytest.mark.anyio
async def test_spawn_preset_with_overrides():
    """
    Tests spawning studio_table with custom width, depth, color, and location.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "preset_id": "studio_table",
            "name": "Mesa Customizada",
            "width_m": 2.0,
            "height_m": 0.8,
            "depth_m": 0.9,
            "x_m": -3.0,
            "z_m": -1.0,
            "color": "#10b981",
        }
        res = await ac.post("/v1/scenes/scene-default/spawn-preset", json=payload)
        assert res.status_code == 201
        data = res.json()

        assert data["position"] == [-3.0, 0.4, -1.0]
        assert data["scale"] == [2.0, 0.8, 0.9]
        assert data["material"]["color"] == "#10b981"

@pytest.mark.anyio
async def test_spawn_preset_lighting_and_character_metadata():
    """
    Tests softbox with Kelvin and intensity overrides, and mannequin with pose override.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Softbox with custom kelvin (3200K) and intensity (2.2)
        res_softbox = await ac.post("/v1/scenes/scene-default/spawn-preset", json={
            "preset_id": "softbox_80x120",
            "x_m": 2.8,
            "z_m": -2.8,
            "kelvin": 3200,
            "intensity": 2.2,
        })
        assert res_softbox.status_code == 201
        sb_data = res_softbox.json()
        assert sb_data["metadata"]["kelvin"] == 3200
        assert sb_data["metadata"]["intensity"] == 2.2
        assert sb_data["position"][1] == 1.60  # Default elevated height for studio softbox

        # 2. Mannequin with 'hero' pose
        res_mannequin = await ac.post("/v1/scenes/scene-default/spawn-preset", json={
            "preset_id": "human_mannequin",
            "x_m": -2.8,
            "z_m": 2.8,
            "pose": "hero",
        })
        assert res_mannequin.status_code == 201
        man_data = res_mannequin.json()
        assert man_data["metadata"]["pose"] == "hero"
        assert man_data["position"][1] == 0.875  # 1.75 / 2

        # 3. Invalid pose returns 422
        res_invalid_pose = await ac.post("/v1/scenes/scene-default/spawn-preset", json={
            "preset_id": "human_mannequin",
            "pose": "flying_superhero",
        })
        assert res_invalid_pose.status_code == 422

@pytest.mark.anyio
async def test_spawn_preset_collision_detection_aabb():
    """
    Tests volumetric AABB collision detection: attempting to spawn a preset where an object
    already exists in the scene must trigger HTTP 422 COLLISION_AABB.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # In scene-default, product-pedestal is at [0, 0.4, 0] with scale [0.8, 0.8, 0.8]
        # Attempting to spawn studio_table at [0, Y, 0] must collide with product-pedestal
        colliding_payload = {
            "preset_id": "studio_table",
            "x_m": 0.0,
            "z_m": 0.0,
        }
        res = await ac.post("/v1/scenes/scene-default/spawn-preset", json=colliding_payload)
        assert res.status_code == 422
        err = res.json()["detail"]
        assert err["code"] == "COLLISION_AABB"

@pytest.mark.anyio
async def test_spawn_preset_dimension_out_of_bounds():
    """
    Tests physical boundary limits validation: dimensions exceeding min_m or max_m return 422.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Pedestal max width is 1.50m. Requesting 5.0m must fail with DIMENSION_OUT_OF_BOUNDS
        bad_payload = {
            "preset_id": "pedestal",
            "width_m": 5.0,
            "x_m": 3.0,
            "z_m": 3.0,
        }
        res = await ac.post("/v1/scenes/scene-default/spawn-preset", json=bad_payload)
        assert res.status_code == 422
        assert res.json()["detail"]["code"] == "DIMENSION_OUT_OF_BOUNDS"

@pytest.mark.anyio
async def test_spawn_preset_nonexistent_preset_or_scene():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Nonexistent preset
        res_bad_preset = await ac.post("/v1/scenes/scene-default/spawn-preset", json={
            "preset_id": "unknown_spaceship_999",
        })
        assert res_bad_preset.status_code == 404

        # Nonexistent scene
        res_bad_scene = await ac.post("/v1/scenes/scene-does-not-exist-999/spawn-preset", json={
            "preset_id": "studio_table",
        })
        assert res_bad_scene.status_code == 404

def test_spawn_preset_websocket_broadcast():
    """
    Verifies that spawning a preset triggers a real-time WebSocket event 'OBJECT_ADDED'.
    """
    client = TestClient(app)
    with client.websocket_connect("/v1/scenes/scene-default/events") as ws:
        # Spawn shelf at clear location
        resp = client.post("/v1/scenes/scene-default/spawn-preset", json={
            "preset_id": "shelf",
            "name": "Estante Broadcast Test",
            "x_m": -3.5,
            "z_m": 0.0,
        })
        assert resp.status_code == 201

        # Receive WebSocket event
        event = ws.receive_json()
        assert event["type"] == "OBJECT_ADDED"
        assert event["event"] == "object_added"
        assert event["scene_id"] == "scene-default"
        assert event["data"]["name"] == "Estante Broadcast Test"
        assert event["data"]["scale"] == [1.20, 1.80, 0.35]
        assert event["data"]["position"] == [-3.5, 0.90, 0.0]
