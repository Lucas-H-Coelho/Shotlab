import xml.etree.ElementTree as ET
import pytest
from httpx import AsyncClient, ASGITransport

from main import app
from models.scene import SceneGraphModel, CameraModel, StudioLightingModel, SceneObjectModel
from services.lighting_studio import (
    LIGHT_MODIFIERS,
    GEL_PRESETS,
    kelvin_to_srgb,
    kelvin_to_linear_rgb,
    calculate_light_geometry,
    generate_set_plan_data,
    generate_set_plan_svg,
)


# ==============================================================================
# 1. KELVIN TEMPERATURE & COLOR CONVERSION TESTS
# ==============================================================================

def test_kelvin_to_srgb_photographic_standards():
    # 2700K - Warm tungsten incandescent
    r, g, b, hex_2700 = kelvin_to_srgb(2700)
    assert r == 255
    assert 160 <= g <= 175
    assert 80 <= b <= 95
    assert hex_2700.startswith("#ff")

    # 3200K - Studio tungsten
    r, g, b, hex_3200 = kelvin_to_srgb(3200)
    assert r == 255
    assert 180 <= g <= 190
    assert 115 <= b <= 130
    assert hex_3200 == "#ffb87b"

    # 5600K - Daylight photographic balance
    r, g, b, hex_5600 = kelvin_to_srgb(5600)
    assert r == 255
    assert 235 <= g <= 245
    assert 220 <= b <= 230
    assert hex_5600 == "#ffefe1"

    # 6500K - Standard D65 daylight
    r, g, b, hex_6500 = kelvin_to_srgb(6500)
    assert r == 255
    assert g >= 250
    assert b >= 245
    assert hex_6500 == "#fffefa"

    # 10000K - Cool blue sky / overcast
    r, g, b, hex_10000 = kelvin_to_srgb(10000)
    assert b == 255
    assert r < b  # Blue dominates at high Kelvin
    assert hex_10000 == "#cadaff"


def test_kelvin_clamping_and_bounds():
    # Out of standard bounds: clamped safely without crash
    r_low, g_low, b_low, hex_low = kelvin_to_srgb(200)
    assert r_low == 255
    assert hex_low is not None

    r_high, g_high, b_high, hex_high = kelvin_to_srgb(80000)
    assert b_high == 255
    assert hex_high is not None


def test_kelvin_to_linear_rgb():
    lin_2700 = kelvin_to_linear_rgb(2700)
    lin_10000 = kelvin_to_linear_rgb(10000)

    # All values must be in [0.0, 1.0]
    for val in lin_2700 + lin_10000:
        assert 0.0 <= val <= 1.0

    # At 2700K (warm), red is 1.0 and blue is lower than at 10000K
    assert lin_2700[0] == 1.0
    assert lin_2700[2] < lin_10000[2]


# ==============================================================================
# 2. CREATIVE GELS & MODIFIERS CATALOG TESTS
# ==============================================================================

def test_creative_gels_catalogue():
    expected_gels = [
        "cto_full_3200k",
        "cto_half_3800k",
        "ctb_full_6500k",
        "daylight_5600k",
        "tungsten_3200k",
        "cyan_gel",
        "amber_gel",
        "magenta_gel",
    ]
    for gel_id in expected_gels:
        assert gel_id in GEL_PRESETS
        gel = GEL_PRESETS[gel_id]
        assert gel.hex_color.startswith("#")
        assert len(gel.rgb_linear) == 3
        assert gel.description != ""


def test_photographic_modifiers_catalog():
    # Verify all 5 required modifiers and their physical dimensions in meters
    assert "softbox_60x90" in LIGHT_MODIFIERS
    sb = LIGHT_MODIFIERS["softbox_60x90"]
    assert sb.width_m == 0.60
    assert sb.height_m == 0.90
    assert sb.depth_m == 0.40
    assert sb.beam_angle_deg == 75.0
    assert sb.type == "softbox"

    assert "octabox_120" in LIGHT_MODIFIERS
    octa = LIGHT_MODIFIERS["octabox_120"]
    assert octa.width_m == 1.20
    assert octa.height_m == 1.20
    assert octa.depth_m == 0.45
    assert octa.beam_angle_deg == 85.0
    assert octa.type == "octabox"

    assert "stripbox_30x140" in LIGHT_MODIFIERS
    strip = LIGHT_MODIFIERS["stripbox_30x140"]
    assert strip.width_m == 0.30
    assert strip.height_m == 1.40
    assert strip.depth_m == 0.35
    assert strip.beam_angle_deg == 55.0
    assert strip.type == "stripbox"
    assert strip.recommended_role == "rim"

    assert "beauty_dish_55" in LIGHT_MODIFIERS
    bd = LIGHT_MODIFIERS["beauty_dish_55"]
    assert bd.width_m == 0.55
    assert bd.height_m == 0.55
    assert bd.depth_m == 0.25
    assert bd.beam_angle_deg == 60.0
    assert bd.type == "beauty_dish"

    assert "fresnel_spot" in LIGHT_MODIFIERS
    fresnel = LIGHT_MODIFIERS["fresnel_spot"]
    assert fresnel.width_m == 0.30
    assert fresnel.height_m == 0.30
    assert fresnel.depth_m == 0.35
    assert fresnel.beam_angle_deg == 25.0
    assert fresnel.type == "fresnel"


# ==============================================================================
# 3. SPATIAL GEOMETRY & ANGLES (METERS & DEGREES)
# ==============================================================================

def test_calculate_light_geometry():
    cam = [0.0, 1.4, 2.5]
    subj = [0.0, 0.9, 0.0]

    # Key light: right of camera
    key = [2.5, 3.0, 2.5]
    d3, d2, az, el = calculate_light_geometry(cam, subj, key)
    assert d3 == pytest.approx(4.11, abs=0.05)
    assert d2 == pytest.approx(3.54, abs=0.05)
    assert az == pytest.approx(45.0, abs=1.0)  # +45° camera right
    assert 25.0 <= el <= 35.0

    # Fill light: left of camera
    fill = [-2.5, 2.0, 2.0]
    fd3, fd2, faz, fel = calculate_light_geometry(cam, subj, fill)
    assert faz < 0.0  # Camera left is negative
    assert faz == pytest.approx(-51.3, abs=1.5)

    # Rim light: directly behind subject
    rim = [0.0, 2.8, -2.5]
    rd3, rd2, raz, rel = calculate_light_geometry(cam, subj, rim)
    assert raz == pytest.approx(180.0, abs=0.5)


def test_generate_set_plan_data():
    scene = SceneGraphModel(
        id="test-scene-plan",
        name="Teste Set Plan",
        camera=CameraModel(focal_length_mm=85.0, f_stop=1.8, position=[0.0, 1.4, 2.5], target=[0.0, 0.9, 0.0]),
        lighting=StudioLightingModel(),
        objects=[
            SceneObjectModel(
                id="hero-subj",
                name="Hero Product",
                type="box",
                position=[0.0, 0.9, 0.0],
                scale=[0.5, 0.5, 0.5],
            )
        ],
    )

    data = generate_set_plan_data(scene)
    assert data.scene_id == "test-scene-plan"
    assert data.subject.name == "Hero Product"
    assert data.camera.focal_length_mm == 85.0
    assert data.camera.f_stop == 1.8
    assert "camera_to_subject_3d" in data.distances_m
    assert data.distances_m["camera_to_subject_3d"] > 0
    assert "key_light" in data.lighting_analysis
    assert "fill_light" in data.lighting_analysis
    assert "rim_light" in data.lighting_analysis
    assert data.lighting_ratio.endswith(":1")
    assert len(data.elements_2d) >= 5
    assert data.svg.startswith("<svg")


# ==============================================================================
# 4. VECTOR SVG GENERATOR & BLUEPRINT QUALITY
# ==============================================================================

def test_generate_set_plan_svg_validity_and_contents():
    scene = SceneGraphModel(
        id="scene-svg-test",
        name="Sessão Editorial",
        camera=CameraModel(focal_length_mm=50.0, f_stop=2.8, position=[0.0, 1.5, 3.0], target=[0.0, 1.0, 0.0]),
        lighting=StudioLightingModel(),
        objects=[
            SceneObjectModel(
                id="cyclorama-main",
                name="Ciclorama Infinito",
                type="backdrop",
                position=[0.0, 1.5, -2.0],
                scale=[6.0, 3.0, 2.0],
            ),
            SceneObjectModel(
                id="mannequin-subj",
                name="Manequim Humano",
                type="model",
                position=[0.0, 0.875, 0.0],
                scale=[0.5, 1.75, 0.3],
            ),
        ],
    )

    svg_text = generate_set_plan_svg(scene)

    # 1. Must be valid XML
    root = ET.fromstring(svg_text)
    assert root.tag.endswith("svg")

    # 2. Vantablack theme colors & optical accent
    assert "#0b0c0e" in svg_text  # Background
    assert "#f59e0b" in svg_text  # Camera FOV accent optic
    assert "SHOTLAB // SET PLAN 2D BLUEPRINT" in svg_text
    assert "1.0m × 1.0m" in svg_text

    # 3. Contains lights, camera, and subject
    assert "KEY LIGHT" in svg_text
    assert "FILL LIGHT" in svg_text
    assert "RIM LIGHT" in svg_text
    assert "MANEQUIM HUMANO" in svg_text
    assert "50mm f/2.8" in svg_text


# ==============================================================================
# 5. FASTAPI REST ENDPOINTS INTEGRATION TESTS
# ==============================================================================

@pytest.mark.anyio
async def test_api_lighting_modifiers_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/lighting/modifiers")
        assert res.status_code == 200
        data = res.json()
        assert "modifiers" in data
        assert "kelvin_presets" in data
        assert "creative_gels" in data

        mod_ids = [m["id"] for m in data["modifiers"]]
        assert "softbox_60x90" in mod_ids
        assert "octabox_120" in mod_ids
        assert "stripbox_30x140" in mod_ids
        assert "beauty_dish_55" in mod_ids
        assert "fresnel_spot" in mod_ids


@pytest.mark.anyio
async def test_api_kelvin_conversion_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/v1/lighting/kelvin-to-rgb?kelvin=5600")
        assert res.status_code == 200
        data = res.json()
        assert data["kelvin"] == 5600
        assert data["hex_color"] == "#ffefe1"
        assert len(data["rgb_srgb"]) == 3
        assert len(data["rgb_linear"]) == 3


@pytest.mark.anyio
async def test_api_scenes_set_plan_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # JSON Set Plan endpoint
        res = await ac.get("/v1/scenes/default/set-plan")
        assert res.status_code == 200
        plan = res.json()
        assert plan["scene_id"] == "scene-default"
        assert "camera" in plan
        assert "lighting_analysis" in plan
        assert "svg" in plan
        assert plan["svg"].startswith("<svg")

        # Raw SVG endpoint
        res_svg = await ac.get("/v1/scenes/default/set-plan.svg")
        assert res_svg.status_code == 200
        assert res_svg.headers["content-type"].startswith("image/svg+xml")
        assert res_svg.text.startswith("<svg")
        assert "</svg>" in res_svg.text

        # 404 on invalid scene
        res_404 = await ac.get("/v1/scenes/non-existent-12345/set-plan")
        assert res_404.status_code == 404
