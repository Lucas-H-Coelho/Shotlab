import os
import sys
import json
from pathlib import Path
import pytest
from httpx import ASGITransport
from typer.testing import CliRunner

# Ensure root workspace and backend directories are on sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
backend_dir = root_dir / "backend"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app as fastapi_app
from cli.main import app as cli_app
from cli.client import set_client_transport


@pytest.fixture(autouse=True)
def setup_cli_transport():
    """Configures CLI to route requests directly to FastAPI in-memory via ASGITransport."""
    set_client_transport(ASGITransport(app=fastapi_app))
    yield
    set_client_transport(None)


@pytest.fixture
def runner():
    return CliRunner()


def test_cli_scene_list(runner):
    # 1. Standard text table format
    res = runner.invoke(cli_app, ["scene", "list"])
    assert res.exit_code == 0

    # 2. JSON format
    res_json = runner.invoke(cli_app, ["--json", "scene", "list"])
    assert res_json.exit_code == 0
    scenes = json.loads(res_json.stdout)
    assert isinstance(scenes, list)


def test_cli_scene_create_and_show(runner):
    # Create new scene
    res_create = runner.invoke(cli_app, ["scene", "create", "Campanha Estudio CLI"])
    assert res_create.exit_code == 0
    assert "✓ Cena criada com sucesso!" in res_create.stdout
    assert "Campanha Estudio CLI" in res_create.stdout

    # Create scene with JSON output
    res_create_json = runner.invoke(cli_app, ["--json", "scene", "create", "Sessao JSON"])
    assert res_create_json.exit_code == 0
    scene_data = json.loads(res_create_json.stdout)
    created_id = scene_data["id"]
    assert scene_data["name"] == "Sessao JSON"
    assert len(scene_data["objects"]) >= 2

    # Show scene
    res_show = runner.invoke(cli_app, ["scene", "show", created_id])
    assert res_show.exit_code == 0
    assert created_id in res_show.stdout

    # Show scene in JSON
    res_show_json = runner.invoke(cli_app, ["scene", "show", created_id, "--json"])
    assert res_show_json.exit_code == 0
    data = json.loads(res_show_json.stdout)
    assert data["id"] == created_id
    assert "camera" in data


def test_cli_object_lifecycle(runner):
    # 1. Add valid object resting on floor (height 0.6m, center y=0.3m -> base y=0.0m)
    res_add = runner.invoke(
        cli_app,
        [
            "object",
            "add",
            "scene-default",
            "--name",
            "Caixa Teste CLI",
            "--type",
            "box",
            "--pos",
            "1.5,0.3,0.5",
            "--scale",
            "0.6,0.6,0.6",
            "--id",
            "test-cli-box-1",
        ],
    )
    assert res_add.exit_code == 0
    assert "test-cli-box-1" in res_add.stdout
    assert "Caixa Teste CLI" in res_add.stdout

    # 2. Add object with --json
    res_add_json = runner.invoke(
        cli_app,
        [
            "--json",
            "object",
            "add",
            "scene-default",
            "--name",
            "Cilindro JSON",
            "--type",
            "cylinder",
            "--pos",
            "2.5,0.5,1.0",
            "--scale",
            "0.4,1.0,0.4",
            "--id",
            "test-cli-cyl-1",
        ],
    )
    assert res_add_json.exit_code == 0
    obj_data = json.loads(res_add_json.stdout)
    assert obj_data["id"] == "test-cli-cyl-1"
    assert obj_data["position"] == [2.5, 0.5, 1.0]

    # 3. Move object to new valid coordinate
    res_move = runner.invoke(
        cli_app,
        [
            "object",
            "move",
            "scene-default",
            "test-cli-box-1",
            "--pos",
            "1.8,0.3,0.8",
        ],
    )
    assert res_move.exit_code == 0
    assert "test-cli-box-1" in res_move.stdout

    # 4. Delete object
    res_del = runner.invoke(
        cli_app,
        [
            "object",
            "delete",
            "scene-default",
            "test-cli-box-1",
        ],
    )
    assert res_del.exit_code == 0
    assert "test-cli-box-1" in res_del.stdout


def test_cli_floor_penetration_422(runner):
    # Try to add an object penetrating floor: height 1.0m, center y=0.1m -> base y = -0.4m
    res = runner.invoke(
        cli_app,
        [
            "object",
            "add",
            "scene-default",
            "--name",
            "Caixa no Subsolo",
            "--type",
            "box",
            "--pos",
            "2.0,0.1,0.0",
            "--scale",
            "1.0,1.0,1.0",
        ],
    )
    # Must exit with code != 0
    assert res.exit_code != 0
    assert "FLOOR_PENETRATION" in res.output
    assert "penetra o chão" in res.output or "base_y_meters" in res.output

    # Test same error with --json flag
    res_json = runner.invoke(
        cli_app,
        [
            "--json",
            "object",
            "add",
            "scene-default",
            "--name",
            "Caixa no Subsolo JSON",
            "--type",
            "box",
            "--pos",
            "2.0,0.1,0.0",
            "--scale",
            "1.0,1.0,1.0",
        ],
    )
    assert res_json.exit_code != 0
    assert "FLOOR_PENETRATION" in res_json.output


def test_cli_collision_aabb_422(runner):
    # Try to add an object that collides with hero-product ([0, 1.05, 0], scale [0.25, 0.5, 0.25])
    res = runner.invoke(
        cli_app,
        [
            "object",
            "add",
            "scene-default",
            "--name",
            "Caixa Colisora",
            "--type",
            "box",
            "--pos",
            "0.0,1.05,0.0",
            "--scale",
            "0.25,0.5,0.25",
        ],
    )
    # Must exit with code != 0
    assert res.exit_code != 0
    assert "COLLISION_AABB" in res.output
    assert "Colisão" in res.output or "hero-product" in res.output

    # Test same collision error with --json flag
    res_json = runner.invoke(
        cli_app,
        [
            "--json",
            "object",
            "add",
            "scene-default",
            "--name",
            "Caixa Colisora JSON",
            "--type",
            "box",
            "--pos",
            "0.0,1.05,0.0",
            "--scale",
            "0.25,0.5,0.25",
        ],
    )
    assert res_json.exit_code != 0
    assert "COLLISION_AABB" in res_json.output


def test_cli_camera_set(runner):
    # Update camera focal length, fstop, and focus distance
    res = runner.invoke(
        cli_app,
        [
            "camera",
            "set",
            "scene-default",
            "--focal",
            "85",
            "--fstop",
            "1.8",
            "--focus",
            "2.2",
        ],
    )
    assert res.exit_code == 0
    assert "85.0 mm" in res.stdout
    assert "f/1.8" in res.stdout
    assert "2.2 m" in res.stdout

    # Update with --json
    res_json = runner.invoke(
        cli_app,
        [
            "--json",
            "camera",
            "set",
            "scene-default",
            "--focal",
            "50",
            "--fstop",
            "2.8",
            "--focus",
            "3.5",
        ],
    )
    assert res_json.exit_code == 0
    cam_data = json.loads(res_json.stdout)
    assert cam_data["focal_length_mm"] == 50.0
    assert cam_data["f_stop"] == 2.8
    assert cam_data["focus_distance_m"] == 3.5


def test_cli_optics_compute(runner):
    # Compute optics with reference values: 85mm, f/1.8, focus 2.2m
    res = runner.invoke(
        cli_app,
        [
            "optics",
            "compute",
            "--focal",
            "85",
            "--fstop",
            "1.8",
            "--focus",
            "2.2",
        ],
    )
    assert res.exit_code == 0
    assert "85.0" in res.stdout
    assert "f/1.8" in res.stdout
    assert "Profundidade de Campo" in res.stdout

    # Compute optics with --json output
    res_json = runner.invoke(
        cli_app,
        [
            "--json",
            "optics",
            "compute",
            "--focal",
            "85",
            "--fstop",
            "1.8",
            "--focus",
            "2.2",
        ],
    )
    assert res_json.exit_code == 0
    opt_data = json.loads(res_json.stdout)
    assert "sensor_diagonal_mm" in opt_data
    assert "coc_mm" in opt_data
    assert "hyperfocal_distance_m" in opt_data
    assert "dof_near_m" in opt_data
    assert opt_data["dof_near_m"] > 2.0
    assert opt_data["dof_far_m"] > opt_data["dof_near_m"]


def test_cli_render_dual_engines(runner):
    # 1. Render using Qwen Image 2.1 engine
    res_qwen = runner.invoke(
        cli_app,
        [
            "render",
            "scene-default",
            "--prompt",
            "Studio photorealistic bottle on pedestal",
            "--engine",
            "qwen-2.1",
        ],
    )
    assert res_qwen.exit_code == 0
    assert "qwen-2.1" in res_qwen.stdout
    assert "Job ID" in res_qwen.stdout

    # 2. Render using MOSS-Image layout engine with --json
    res_moss = runner.invoke(
        cli_app,
        [
            "--json",
            "render",
            "scene-default",
            "--prompt",
            "Geometric product composition layout",
            "--engine",
            "moss-image",
        ],
    )
    assert res_moss.exit_code == 0
    job_moss = json.loads(res_moss.stdout)
    assert job_moss["engine"] == "moss-image"
    assert "job_id" in job_moss
    assert job_moss["status"] in ("pending", "processing", "completed")

    # 3. Invalid engine should fail
    res_invalid = runner.invoke(
        cli_app,
        [
            "render",
            "scene-default",
            "--prompt",
            "Invalid engine test",
            "--engine",
            "invalid-engine",
        ],
    )
    assert res_invalid.exit_code != 0
