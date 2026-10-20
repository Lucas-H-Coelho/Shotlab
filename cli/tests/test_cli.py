import pytest
from unittest.mock import patch, MagicMock
from typer.testing import CliRunner

from cli.main import app
from cli.client import ShotlabApiError

runner = CliRunner()

def test_cli_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Shotlab CLI" in result.stdout
    assert "scene" in result.stdout
    assert "object" in result.stdout
    assert "camera" in result.stdout

def test_cli_scene_help():
    result = runner.invoke(app, ["scene", "--help"])
    assert result.exit_code == 0
    assert "list" in result.stdout
    assert "show" in result.stdout
    assert "create" in result.stdout

@patch("cli.main.get_client")
def test_scene_list_json(mock_get_client):
    mock_client = MagicMock()
    mock_client.list_scenes.return_value = [
        {"id": "scene-default", "name": "Sessão 01", "objects": [], "camera": {"focal_length_mm": 85.0}}
    ]
    mock_get_client.return_value = mock_client

    result = runner.invoke(app, ["--json", "scene", "list"])
    assert result.exit_code == 0
    assert "scene-default" in result.stdout
    assert "Sessão 01" in result.stdout

@patch("cli.main.get_client")
def test_object_add_floor_penetration_error(mock_get_client):
    mock_client = MagicMock()
    mock_client.add_object.side_effect = ShotlabApiError(
        message="Object 'obj-bad' penetrates floor: base Y is -0.300m (minimum 0.000m)",
        status_code=422,
        error_code="FLOOR_PENETRATION",
        details={"code": "FLOOR_PENETRATION", "penetration_m": 0.3},
    )
    mock_get_client.return_value = mock_client

    result = runner.invoke(
        app,
        ["object", "add", "scene-default", "box", "--x", "0", "--y", "-0.3", "--z", "0"],
    )
    assert result.exit_code == 1
    assert "FLOOR_PENETRATION" in result.stderr or "FLOOR_PENETRATION" in result.stdout
    assert "penetrates floor" in result.stderr or "penetrates floor" in result.stdout

@patch("cli.main.get_client")
def test_object_move_success(mock_get_client):
    mock_client = MagicMock()
    mock_client.patch_object.return_value = {
        "id": "hero-product",
        "position": [1.5, 1.05, 0.5],
    }
    mock_get_client.return_value = mock_client

    result = runner.invoke(
        app,
        ["--json", "object", "move", "scene-default", "hero-product", "--x", "1.5", "--y", "1.05", "--z", "0.5"],
    )
    assert result.exit_code == 0
    assert "hero-product" in result.stdout
    assert "1.5" in result.stdout

@patch("cli.main.get_client")
def test_camera_set_success(mock_get_client):
    mock_client = MagicMock()
    mock_client.get_scene.return_value = {
        "camera": {"focal_length_mm": 50.0, "f_stop": 2.8, "position": [0, 1.4, 2.5]}
    }
    mock_client.update_camera.return_value = {
        "focal_length_mm": 85.0,
        "f_stop": 1.8,
        "focus_distance_m": 2.2,
        "position": [0, 1.65, 3.0],
    }
    mock_get_client.return_value = mock_client

    result = runner.invoke(
        app,
        ["--json", "camera", "set", "scene-default", "--focal", "85", "--fstop", "1.8", "--focus", "2.2"],
    )
    assert result.exit_code == 0
    assert "85" in result.stdout
    assert "1.8" in result.stdout

@patch("cli.main.get_client")
def test_optics_telemetry(mock_get_client):
    mock_client = MagicMock()
    mock_client.get_optics.return_value = {
        "focal_length_mm": 85.0,
        "f_stop": 1.8,
        "focus_distance_m": 2.2,
        "sensor_width_mm": 36.0,
        "sensor_height_mm": 24.0,
        "coc_mm": 0.0288,
        "fov_vertical_deg": 16.07,
        "fov_horizontal_deg": 23.91,
        "hyperfocal_distance_m": 133.5,
        "dof_near_m": 2.17,
        "dof_far_m": 2.24,
        "dof_total_m": 0.07,
    }
    mock_get_client.return_value = mock_client

    result = runner.invoke(app, ["--json", "optics", "scene-default"])
    assert result.exit_code == 0
    assert "16.07" in result.stdout
    assert "133.5" in result.stdout
