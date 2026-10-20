import pytest
import math
from httpx import AsyncClient, ASGITransport

from main import app
from models.scene import CameraModel
from models.optics import (
    SENSOR_PRESETS,
    calculate_sensor_diagonal_mm,
    calculate_circle_of_confusion_mm,
    calculate_vertical_fov_deg,
    calculate_horizontal_fov_deg,
    calculate_diagonal_fov_deg,
    calculate_hyperfocal_distance_m,
    calculate_depth_of_field_m,
    compute_full_optics,
    OpticsComputeRequest,
)

def test_sensor_presets_and_diagonal():
    # 35mm Full Frame: 36x24mm
    ff = SENSOR_PRESETS["FULL_FRAME_35MM"]
    diag_ff = calculate_sensor_diagonal_mm(ff["width_mm"], ff["height_mm"])
    assert pytest.approx(diag_ff, rel=1e-3) == 43.267

    # Super 35 / APS-C: 23.6x15.6mm
    s35 = SENSOR_PRESETS["SUPER_35_APSC"]
    diag_s35 = calculate_sensor_diagonal_mm(s35["width_mm"], s35["height_mm"])
    assert pytest.approx(diag_s35, rel=1e-3) == 28.290

    # ARRI ALEXA LF: 36.7x25.54mm
    arri = SENSOR_PRESETS["ARRI_ALEXA_LF"]
    diag_arri = calculate_sensor_diagonal_mm(arri["width_mm"], arri["height_mm"])
    assert pytest.approx(diag_arri, rel=1e-3) == 44.712

    # Medium Format 645: 53.7x40.2mm
    mf = SENSOR_PRESETS["MEDIUM_FORMAT_645"]
    diag_mf = calculate_sensor_diagonal_mm(mf["width_mm"], mf["height_mm"])
    assert pytest.approx(diag_mf, rel=1e-3) == 67.080


def test_circle_of_confusion():
    # Full Frame 36x24mm: d / 1500 -> ~0.02884mm (~0.029mm)
    coc_ff = calculate_circle_of_confusion_mm(36.0, 24.0, divisor=1500.0)
    assert pytest.approx(coc_ff, rel=1e-3) == 0.02884

    # Custom CoC override
    coc_custom = calculate_circle_of_confusion_mm(36.0, 24.0, custom_coc_mm=0.030)
    assert coc_custom == 0.030


def test_fov_calculations():
    # 50mm on Full Frame (36x24mm)
    # vFov = 2 * atan(24 / (2 * 50)) = ~26.99 deg
    v_fov = calculate_vertical_fov_deg(50.0, 24.0)
    assert pytest.approx(v_fov, abs=0.02) == 26.99

    # hFov = 2 * atan(36 / (2 * 50)) = ~39.60 deg
    h_fov = calculate_horizontal_fov_deg(50.0, 36.0)
    assert pytest.approx(h_fov, abs=0.02) == 39.60

    # diagFov = 2 * atan(43.267 / (2 * 50)) = ~46.79 deg
    d_fov = calculate_diagonal_fov_deg(50.0, 36.0, 24.0)
    assert pytest.approx(d_fov, abs=0.02) == 46.79


def test_reference_vector_1_50mm_f8_ff_3m():
    """
    Reference Vector 1:
    Lens 50mm, f/8, Full Frame (36x24mm), focus distance 3.0m, standard 35mm CoC 0.030mm.
    Hyperfocal = (50^2 / (8 * 0.030)) + 50 = 10466.67mm = 10.467m (~10.4m).
    Tolerance <= 1%.
    """
    f = 50.0
    n = 8.0
    coc = 0.030
    dist = 3.0

    h_m = calculate_hyperfocal_distance_m(f, n, coc)
    assert pytest.approx(h_m, rel=0.01) == 10.467

    dof = calculate_depth_of_field_m(f, n, dist, coc)
    assert not dof.is_hyperfocal
    assert pytest.approx(dof.near_limit_m, rel=0.01) == 2.340
    assert pytest.approx(dof.far_limit_m, rel=0.01) == 4.177
    assert pytest.approx(dof.total_dof_m, rel=0.01) == (4.177 - 2.340)

    # Also test with exact derived CoC (~0.02884mm)
    coc_exact = calculate_circle_of_confusion_mm(36.0, 24.0)
    h_exact = calculate_hyperfocal_distance_m(f, n, coc_exact)
    assert pytest.approx(h_exact, rel=0.01) == 10.884


def test_reference_vector_2_85mm_f18_ff_2_2m():
    """
    Reference Vector 2:
    Lens 85mm, f/1.8, Full Frame (36x24mm), focus distance 2.2m (Portrait/Hero).
    CoC = 0.030mm.
    Hyperfocal = (85^2 / (1.8 * 0.030)) + 85 = 133881.3mm = 133.88m.
    Thin DoF around 0.07m (0.06m <= total_dof <= 0.10m).
    """
    f = 85.0
    n = 1.8
    coc = 0.030
    dist = 2.2

    h_m = calculate_hyperfocal_distance_m(f, n, coc)
    assert pytest.approx(h_m, rel=0.01) == 133.88

    dof = calculate_depth_of_field_m(f, n, dist, coc)
    assert not dof.is_hyperfocal
    assert pytest.approx(dof.near_limit_m, rel=0.01) == 2.166
    assert pytest.approx(dof.far_limit_m, rel=0.01) == 2.235
    assert 0.06 <= dof.total_dof_m <= 0.10


def test_hyperfocal_infinity_boundary():
    """
    When focus distance >= hyperfocal distance, far limit and total DoF must be infinite (None).
    """
    f = 50.0
    n = 8.0
    coc = 0.030
    h_m = calculate_hyperfocal_distance_m(f, n, coc)  # ~10.467m

    # Focus at 12m (beyond hyperfocal)
    dof_beyond = calculate_depth_of_field_m(f, n, 12.0, coc)
    assert dof_beyond.is_hyperfocal is True
    assert dof_beyond.far_limit_m is None
    assert dof_beyond.total_dof_m is None
    # Near limit at hyperfocal should be approx H / 2
    assert dof_beyond.near_limit_m > 0

    # Focus exactly at hyperfocal distance
    dof_exact = calculate_depth_of_field_m(f, n, h_m, coc)
    assert dof_exact.is_hyperfocal is True
    assert dof_exact.far_limit_m is None
    assert dof_exact.total_dof_m is None


def test_camera_model_integrated_methods():
    """Validates CameraModel helper methods in models/scene.py."""
    cam = CameraModel(
        focal_length_mm=85.0,
        sensor_width_mm=36.0,
        sensor_height_mm=24.0,
        f_stop=1.8,
        focus_distance_m=2.2,
    )
    coc = cam.calculate_circle_of_confusion()
    assert pytest.approx(coc, rel=1e-3) == 0.02884

    h_dist = cam.calculate_hyperfocal_distance()
    assert h_dist > 100.0  # ~139m with 0.02884mm CoC

    dof = cam.calculate_depth_of_field()
    assert dof.is_hyperfocal is False
    assert dof.near_limit_m < 2.2 < dof.far_limit_m


@pytest.mark.anyio
async def test_optics_compute_endpoint():
    """Tests the /v1/optics/compute REST endpoint."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req = {
            "focal_length_mm": 50.0,
            "f_stop": 8.0,
            "focus_distance_m": 3.0,
            "sensor_width_mm": 36.0,
            "sensor_height_mm": 24.0,
            "custom_coc_mm": 0.030,
        }
        res = await ac.post("/v1/optics/compute", json=req)
        assert res.status_code == 200
        data = res.json()
        assert pytest.approx(data["hyperfocal_distance_m"], rel=0.01) == 10.467
        assert pytest.approx(data["dof_near_m"], rel=0.01) == 2.340
        assert pytest.approx(data["dof_far_m"], rel=0.01) == 4.177
        assert data["is_infinite_far"] is False

        # Test presets endpoint
        presets_res = await ac.get("/v1/optics/presets")
        assert presets_res.status_code == 200
        presets = presets_res.json()
        assert "FULL_FRAME_35MM" in presets
        assert presets["FULL_FRAME_35MM"]["width_mm"] == 36.0
