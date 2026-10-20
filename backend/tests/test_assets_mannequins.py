import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from models.assets import (
    CC0_ASSETS_CATALOG,
    MANNEQUIN_POSES,
    calculate_effective_height_m,
    calculate_eye_height_m,
    calculate_standing_eye_height_m,
)
from services.comfyui_client import build_moss_layout_from_scene
from services.validator import check_floor_contact, get_object_aabb


@pytest.mark.anyio
async def test_list_cc0_assets_catalog():
    """
    Verifies GET /v1/catalog/assets returns all CC0-1.0 assets with real physical
    dimensions in meters, CC0 license, attribution (Poly Haven / Kenney), bounding boxes
    and procedural fallback geometry.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res = await ac.get("/v1/catalog/assets")
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 7

        asset_ids = {a["id"] for a in data}
        expected_ids = {
            "cc0_wooden_chair",
            "cc0_studio_stool",
            "cc0_vintage_camera_tripod",
            "cc0_ceramic_vase",
            "cc0_product_bottle",
            "cc0_apple_crate",
            "cc0_human_mannequin",
        }
        assert expected_ids.issubset(asset_ids)

        # 1. Wooden chair (0.50m × 0.85m × 0.52m, Poly Haven, CC0-1.0)
        chair = next(a for a in data if a["id"] == "cc0_wooden_chair")
        assert chair["category"] == "furniture"
        assert chair["license"] == "CC0-1.0"
        assert chair["attribution"] == "Poly Haven"
        assert chair["width_m"] == 0.50
        assert chair["height_m"] == 0.85
        assert chair["depth_m"] == 0.52
        assert chair["fallback_geometry"]["type"] == "box"
        assert chair["fallback_geometry"]["dimensions_m"] == [0.50, 0.85, 0.52]

        # 2. Studio stool (0.38m × 0.65m × 0.38m, Kenney, CC0-1.0)
        stool = next(a for a in data if a["id"] == "cc0_studio_stool")
        assert stool["category"] == "furniture"
        assert stool["license"] == "CC0-1.0"
        assert stool["attribution"] == "Kenney"
        assert stool["width_m"] == 0.38
        assert stool["height_m"] == 0.65
        assert stool["depth_m"] == 0.38

        # 3. Vintage camera tripod (0.60m × 1.55m × 0.60m, Poly Haven, CC0-1.0)
        tripod = next(a for a in data if a["id"] == "cc0_vintage_camera_tripod")
        assert tripod["category"] == "studio_gear"
        assert tripod["license"] == "CC0-1.0"
        assert tripod["attribution"] == "Poly Haven"
        assert tripod["width_m"] == 0.60
        assert tripod["height_m"] == 1.55
        assert tripod["depth_m"] == 0.60

        # 4. Ceramic vase (0.22m × 0.35m × 0.22m, Poly Haven, CC0-1.0)
        vase = next(a for a in data if a["id"] == "cc0_ceramic_vase")
        assert vase["category"] == "props"
        assert vase["license"] == "CC0-1.0"
        assert vase["attribution"] == "Poly Haven"
        assert vase["width_m"] == 0.22
        assert vase["height_m"] == 0.35
        assert vase["depth_m"] == 0.22

        # 5. Product bottle (0.08m × 0.24m × 0.08m, Kenney, CC0-1.0)
        bottle = next(a for a in data if a["id"] == "cc0_product_bottle")
        assert bottle["category"] == "props"
        assert bottle["license"] == "CC0-1.0"
        assert bottle["attribution"] == "Kenney"
        assert bottle["width_m"] == 0.08
        assert bottle["height_m"] == 0.24
        assert bottle["depth_m"] == 0.08

        # 6. Apple crate (0.50m × 0.30m × 0.40m, Poly Haven, CC0-1.0)
        crate = next(a for a in data if a["id"] == "cc0_apple_crate")
        assert crate["category"] == "props"
        assert crate["license"] == "CC0-1.0"
        assert crate["attribution"] == "Poly Haven"
        assert crate["width_m"] == 0.50
        assert crate["height_m"] == 0.30
        assert crate["depth_m"] == 0.40

        # 7. Category filtering
        res_furniture = await ac.get("/v1/catalog/assets?category=furniture")
        assert res_furniture.status_code == 200
        assert all(a["category"] == "furniture" for a in res_furniture.json())


@pytest.mark.anyio
async def test_get_cc0_asset_by_id():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res = await ac.get("/v1/catalog/assets/cc0_wooden_chair")
        assert res.status_code == 200
        assert res.json()["id"] == "cc0_wooden_chair"

        res_404 = await ac.get("/v1/catalog/assets/non_existent_asset")
        assert res_404.status_code == 404
        assert res_404.json()["detail"]["code"] == "ASSET_NOT_FOUND"


@pytest.mark.anyio
async def test_list_mannequin_poses():
    """
    Verifies GET /v1/catalog/mannequin-poses returns standing, portrait_3_4, seated,
    walking, and hero_contrapposto with physical height factors and torso rotations.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res = await ac.get("/v1/catalog/mannequin-poses")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 5

        pose_ids = {p["id"] for p in data}
        assert pose_ids == {
            "standing",
            "portrait_3_4",
            "seated",
            "walking",
            "hero_contrapposto",
        }

        # Standing: height_factor 1.0, 0 torso rotation
        standing = next(p for p in data if p["id"] == "standing")
        assert standing["height_factor"] == 1.0
        assert standing["torso_rotation_y_deg"] == 0.0

        # Portrait 3/4: torso rotation 35°, look_at_camera True
        portrait = next(p for p in data if p["id"] == "portrait_3_4")
        assert portrait["height_factor"] == 1.0
        assert portrait["torso_rotation_y_deg"] == 35.0
        assert portrait["look_at_camera"] is True

        # Seated: effective head height ~1.30m for 1.75m estatura
        seated = next(p for p in data if p["id"] == "seated")
        assert seated["height_factor"] == pytest.approx(1.30 / 1.75, abs=0.001)

        # Walking & Hero Contrapposto
        walking = next(p for p in data if p["id"] == "walking")
        assert walking["height_factor"] == 0.98
        hero = next(p for p in data if p["id"] == "hero_contrapposto")
        assert hero["height_factor"] == 0.99
        assert hero["torso_rotation_y_deg"] == 15.0


@pytest.mark.anyio
async def test_create_mannequin_180m_and_eye_height():
    """
    Tests creation of a posable human mannequin with height 1.80m in standing pose:
    - Verifies anatomical eye_height_m = 1.80m - 0.11m = 1.69m.
    - Verifies automatic floor contact (Y = effective_height_m / 2.0 = 0.90m, base Y = 0.0m).
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Create fresh scene
        res_scene = await ac.post("/v1/scenes?name=Sessão Manequins")
        assert res_scene.status_code == 201
        scene_id = res_scene.json()["id"]

        # Spawn mannequin 1.80m standing at non-overlapping X coordinate (e.g. 1.8m)
        payload = {
            "name": "Modelo Alta Costura",
            "height_m": 1.80,
            "pose": "standing",
            "look_at_camera": True,
            "x_m": 1.80,
            "z_m": 0.0,
        }
        res = await ac.post(f"/v1/scenes/{scene_id}/mannequins", json=payload)
        assert res.status_code == 201
        obj = res.json()

        assert obj["type"] == "model"
        assert obj["name"] == "Modelo Alta Costura"
        assert obj["scale"][1] == 1.80

        # Floor contact: position[1] must equal height / 2.0 = 0.90m
        assert obj["position"][0] == 1.80
        assert obj["position"][1] == 0.90
        assert obj["position"][2] == 0.0

        # Verify base sits exactly on floor Y = 0.0m
        base_y = obj["position"][1] - (obj["scale"][1] / 2.0)
        assert base_y == pytest.approx(0.0, abs=0.001)

        # Verify metadata
        meta = obj["metadata"]
        assert meta["is_mannequin"] is True
        assert meta["height_m"] == 1.80
        assert meta["effective_height_m"] == 1.80
        assert meta["eye_height_m"] == 1.69
        assert meta["standing_eye_height_m"] == 1.69
        assert meta["pose"] == "standing"
        assert meta["look_at_camera"] is True


@pytest.mark.anyio
async def test_patch_mannequin_pose_standing_to_seated():
    """
    Tests updating pose from 'standing' to 'seated' via PATCH:
    - Stature is preserved (1.80m).
    - Effective height is recalculated to seated factor (~1.3371m).
    - Eye height is recalculated to seated eye level (~1.2271m).
    - Floor contact position[1] is automatically recalculated to (effective_height / 2.0),
      guaranteeing base remains exactly at Y = 0.0m without sinking or floating.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res_scene = await ac.post("/v1/scenes?name=Sessão Poses")
        scene_id = res_scene.json()["id"]

        # 1. Create standing mannequin 1.80m
        spawn_payload = {
            "name": "Modelo Editorial",
            "height_m": 1.80,
            "pose": "standing",
            "x_m": -1.80,
            "z_m": 0.0,
        }
        res_spawn = await ac.post(
            f"/v1/scenes/{scene_id}/mannequins", json=spawn_payload
        )
        assert res_spawn.status_code == 201
        mannequin_id = res_spawn.json()["id"]

        # 2. Patch pose from standing to seated
        patch_payload = {
            "pose": "seated",
        }
        res_patch = await ac.patch(
            f"/v1/scenes/{scene_id}/mannequins/{mannequin_id}",
            json=patch_payload,
        )
        assert res_patch.status_code == 200
        updated = res_patch.json()

        meta = updated["metadata"]
        assert meta["pose"] == "seated"
        assert meta["height_m"] == 1.80

        expected_effective_h = round(1.80 * (1.30 / 1.75), 4)
        expected_seated_eye_h = round(expected_effective_h - 0.11, 4)
        expected_pos_y = round(expected_effective_h / 2.0, 4)

        assert meta["effective_height_m"] == expected_effective_h
        assert meta["eye_height_m"] == expected_seated_eye_h
        assert meta["standing_eye_height_m"] == 1.69

        # Ensure object scale reflects effective seated height
        assert updated["scale"][1] == expected_effective_h

        # Ensure position Y was automatically recalculated for zero floor penetration
        assert updated["position"][1] == expected_pos_y
        base_y = updated["position"][1] - (updated["scale"][1] / 2.0)
        assert base_y == pytest.approx(0.0, abs=0.001)

        # 3. Patch pose to portrait_3_4 (35° torso rotation)
        res_portrait = await ac.patch(
            f"/v1/scenes/{scene_id}/mannequins/{mannequin_id}",
            json={"pose": "portrait_3_4"},
        )
        assert res_portrait.status_code == 200
        p_obj = res_portrait.json()
        assert p_obj["metadata"]["pose"] == "portrait_3_4"
        assert p_obj["rotation"][1] == pytest.approx(0.6109, abs=0.01)  # 35° in rad
        assert p_obj["scale"][1] == 1.80
        assert p_obj["position"][1] == 0.90


@pytest.mark.anyio
async def test_identity_reference_and_moss_layout():
    """
    Tests slot for identity reference, outfit reference and character prompt on mannequin:
    - Populates identity_reference_image, outfit_reference_image, character_prompt.
    - Verifies MOSS-Image layout projection builds regional bounding box with character_prompt!
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res_scene = await ac.post("/v1/scenes?name=Sessão Identidade")
        scene_id = res_scene.json()["id"]

        # Aim camera at mannequin location
        await ac.put(
            f"/v1/scenes/{scene_id}/camera",
            json={
                "position": [1.5, 1.4, 2.5],
                "target": [1.5, 0.9, 0.0],
                "focal_length_mm": 35.0,
            },
        )

        dummy_identity_b64 = "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        dummy_outfit_b64 = "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        prompt_text = "Brazilian female high-fashion model wearing emerald silk trench coat, sharp studio catchlight"

        payload = {
            "name": "Mannequin Helena",
            "height_m": 1.76,
            "pose": "standing",
            "look_at_camera": True,
            "identity_reference_image": dummy_identity_b64,
            "outfit_reference_image": dummy_outfit_b64,
            "character_prompt": prompt_text,
            "x_m": 1.50,
            "z_m": 0.0,
        }
        res = await ac.post(f"/v1/scenes/{scene_id}/mannequins", json=payload)
        assert res.status_code == 201
        data = res.json()

        assert data["metadata"]["identity_reference_image"] == dummy_identity_b64
        assert data["metadata"]["outfit_reference_image"] == dummy_outfit_b64
        assert data["metadata"]["character_prompt"] == prompt_text

        # Fetch scene and verify MOSS-Image regional layout generation
        res_scene_get = await ac.get(f"/v1/scenes/{scene_id}")
        scene_data = res_scene_get.json()

        layout = build_moss_layout_from_scene(
            scene_data, width=1024, height=1024, global_caption="Vogue cover shoot"
        )
        assert layout["bbox_coord_space"] == "abs_centralized"

        # Find item corresponding to mannequin Helena
        mannequin_item = next(
            (i for i in layout["items"] if i["caption"] == prompt_text), None
        )
        assert mannequin_item is not None
        assert len(mannequin_item["bbox"]) == 4


@pytest.mark.anyio
async def test_physical_validation_422():
    """
    Tests physical constraints and 422 validations:
    - Height out of anatomical bounds (< 1.50m or > 2.00m)
    - Unsupported pose
    - Floor penetration (Y position causing base < 0.0m)
    - Volumetric AABB collision with another scene object (SHOT-15)
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res_scene = await ac.post("/v1/scenes?name=Sessão Validação Física")
        scene_id = res_scene.json()["id"]

        # 1. Height below 1.50m -> 422
        res_too_short = await ac.post(
            f"/v1/scenes/{scene_id}/mannequins",
            json={"height_m": 1.40, "x_m": 1.5},
        )
        assert res_too_short.status_code == 422

        # 2. Height above 2.00m -> 422
        res_too_tall = await ac.post(
            f"/v1/scenes/{scene_id}/mannequins",
            json={"height_m": 2.20, "x_m": 1.5},
        )
        assert res_too_tall.status_code == 422

        # 3. Unsupported pose -> 422
        res_invalid_pose = await ac.post(
            f"/v1/scenes/{scene_id}/mannequins",
            json={"height_m": 1.75, "pose": "flying_superhero", "x_m": 1.5},
        )
        assert res_invalid_pose.status_code == 422

        # 4. Explicit negative Y causing floor penetration -> 422
        res_floor_pen = await ac.post(
            f"/v1/scenes/{scene_id}/mannequins",
            json={"height_m": 1.75, "x_m": 2.0, "y_m": -0.5},
        )
        assert res_floor_pen.status_code == 422
        err_detail = res_floor_pen.json()["detail"]
        assert (
            err_detail.get("code") == "FLOOR_PENETRATION"
            or "penetra o chão" in str(err_detail)
        )

        # 5. Volumetric AABB collision:
        # Default scene has 'hero-product' at [0.0, 1.05, 0.0] with scale [0.25, 0.5, 0.25]
        # and 'product-pedestal' at [0.0, 0.4, 0.0] with scale [0.8, 0.8, 0.8].
        # Spawning mannequin at center [0.0, 0.875, 0.0] collides with pedestal / hero product!
        res_collision = await ac.post(
            f"/v1/scenes/{scene_id}/mannequins",
            json={"height_m": 1.75, "x_m": 0.0, "z_m": 0.0},
        )
        assert res_collision.status_code == 422
        col_detail = res_collision.json()["detail"]
        assert col_detail["code"] == "COLLISION_AABB"


@pytest.mark.anyio
async def test_spawn_cc0_asset_and_collisions():
    """
    Tests spawning CC0 assets into a scene:
    - Auto floor contact (Y = height_m / 2.0, base at Y = 0.0m).
    - Volumetric AABB collision prevention.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res_scene = await ac.post("/v1/scenes?name=Sessão Assets CC0")
        scene_id = res_scene.json()["id"]

        # 1. Spawn wooden chair at clear position [1.5, 0, 0]
        res_chair = await ac.post(
            f"/v1/scenes/{scene_id}/assets",
            json={"asset_id": "cc0_wooden_chair", "x_m": 1.5, "z_m": 0.0},
        )
        assert res_chair.status_code == 201
        chair_obj = res_chair.json()
        assert chair_obj["name"] == "Cadeira de Madeira Clássica"
        assert chair_obj["scale"] == [0.50, 0.85, 0.52]
        assert chair_obj["position"][0] == 1.5
        assert chair_obj["position"][1] == pytest.approx(0.85 / 2.0, abs=0.001)

        # 2. Spawning overlapping asset at the exact same location must trigger 422 AABB collision
        res_overlap = await ac.post(
            f"/v1/scenes/{scene_id}/assets",
            json={"asset_id": "cc0_studio_stool", "x_m": 1.5, "z_m": 0.0},
        )
        assert res_overlap.status_code == 422
        assert res_overlap.json()["detail"]["code"] == "COLLISION_AABB"


def test_anatomical_formulas():
    """
    Direct unit tests for human anatomical formulas:
    - Effective height by pose.
    - Standing and seated eye heights.
    """
    # 1.80m standing
    assert calculate_effective_height_m(1.80, "standing") == 1.80
    assert calculate_standing_eye_height_m(1.80) == 1.69
    assert calculate_eye_height_m(1.80, "standing") == 1.69

    # 1.75m standing
    assert calculate_effective_height_m(1.75, "standing") == 1.75
    assert calculate_standing_eye_height_m(1.75) == 1.64
    assert calculate_eye_height_m(1.75, "standing") == 1.64

    # 1.75m seated -> effective height 1.30m, eye height 1.19m
    effective_seated_175 = calculate_effective_height_m(1.75, "seated")
    assert effective_seated_175 == pytest.approx(1.30, abs=0.001)
    assert calculate_eye_height_m(1.75, "seated") == pytest.approx(1.19, abs=0.001)

    # 1.80m seated
    effective_seated_180 = calculate_effective_height_m(1.80, "seated")
    assert effective_seated_180 == round(1.80 * (1.30 / 1.75), 4)
    assert calculate_eye_height_m(1.80, "seated") == round(
        effective_seated_180 - 0.11, 4
    )
