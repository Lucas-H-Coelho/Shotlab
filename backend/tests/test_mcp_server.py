import json
import pytest
from httpx import AsyncClient, ASGITransport

from main import app
from mcp_server import ShotlabMCPServer, ShotlabAPIClient, TOOL_SCHEMAS


@pytest.mark.anyio
async def test_mcp_tools_list():
    """Validates that tools/list exposes all required tools with physical units in schemas."""
    server = ShotlabMCPServer()
    tools = await server.list_tools()

    tool_names = {t["name"] for t in tools}
    expected_tools = {
        "list_scenes",
        "get_scene",
        "add_object",
        "update_object",
        "delete_object",
        "set_camera",
        "compute_optics",
        "render_scene",
        "get_render_status",
    }
    assert expected_tools.issubset(tool_names), f"Missing tools: {expected_tools - tool_names}"

    # Verify physical units are explicitly mentioned in schemas
    add_obj = next(t for t in tools if t["name"] == "add_object")
    assert "meters [m]" in add_obj["inputSchema"]["properties"]["position"]["description"]
    assert "meters [m]" in add_obj["inputSchema"]["properties"]["scale"]["description"]

    set_cam = next(t for t in tools if t["name"] == "set_camera")
    assert "millimeters [mm]" in set_cam["inputSchema"]["properties"]["focal_length_mm"]["description"]
    assert "f-number" in set_cam["inputSchema"]["properties"]["f_stop"]["description"]
    assert "meters [m]" in set_cam["inputSchema"]["properties"]["focus_distance_m"]["description"]


@pytest.mark.anyio
async def test_mcp_protocol_handshake_and_ping():
    """Validates JSON-RPC 2.0 initialize, notifications, ping, and unknown method."""
    server = ShotlabMCPServer()

    # 1. Initialize
    init_msg = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-agent", "version": "1.0.0"},
        },
    }
    resp = await server.handle_message(init_msg)
    assert resp["jsonrpc"] == "2.0"
    assert resp["id"] == 1
    assert resp["result"]["protocolVersion"] == "2024-11-05"
    assert resp["result"]["serverInfo"]["name"] == "shotlab-mcp-server"

    # 2. Notification (no response)
    notif_msg = {"jsonrpc": "2.0", "method": "notifications/initialized"}
    assert await server.handle_message(notif_msg) is None

    # 3. Ping
    ping_msg = {"jsonrpc": "2.0", "id": 2, "method": "ping"}
    ping_resp = await server.handle_message(ping_msg)
    assert ping_resp["id"] == 2
    assert ping_resp["result"] == {}

    # 4. Unknown method
    unknown_msg = {"jsonrpc": "2.0", "id": 3, "method": "non_existent_method"}
    unknown_resp = await server.handle_message(unknown_msg)
    assert unknown_resp["error"]["code"] == -32601


@pytest.mark.anyio
async def test_mcp_scenes_queries():
    """Tests list_scenes and get_scene via tools/call."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        client = ShotlabAPIClient(client=ac)
        server = ShotlabMCPServer(client=client)

        # 1. get_scene (seeds default scene if database is fresh)
        call_get = {"jsonrpc": "2.0", "id": 10, "method": "tools/call", "params": {"name": "get_scene", "arguments": {"scene_id": "default"}}}
        res_get = await server.handle_message(call_get)
        assert res_get["result"]["isError"] is False
        scene = json.loads(res_get["result"]["content"][0]["text"])
        assert scene["id"] == "scene-default"
        assert "camera" in scene
        assert "objects" in scene

        # 2. list_scenes
        call_msg = {"jsonrpc": "2.0", "id": 11, "method": "tools/call", "params": {"name": "list_scenes", "arguments": {}}}
        res = await server.handle_message(call_msg)
        assert res["result"]["isError"] is False
        scenes = json.loads(res["result"]["content"][0]["text"])
        assert isinstance(scenes, list)
        assert len(scenes) >= 1


@pytest.mark.anyio
async def test_mcp_object_crud_and_physical_validation():
    """
    Tests adding, updating, and deleting an object, as well as catching 422 physical errors
    (FLOOR_PENETRATION and COLLISION_AABB) with actionable guidance.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        client = ShotlabAPIClient(client=ac)
        server = ShotlabMCPServer(client=client)

        # 1. Add valid object resting safely on floor (height 0.5m, center Y 0.25m -> base at 0.0m)
        add_params = {
            "scene_id": "default",
            "name": "MCP Wooden Pedestal",
            "type": "cylinder",
            "position": [1.5, 0.25, 1.0],
            "scale": [0.5, 0.5, 0.5],
            "rotation": [0.0, 0.0, 0.0],
            "material": {"color": "#a16207", "roughness": 0.7, "metalness": 0.1},
            "id": "mcp-pedestal-1",
        }
        res_add = await server.call_tool("add_object", add_params)
        assert res_add["isError"] is False
        added_data = json.loads(res_add["content"][0]["text"])
        assert added_data["id"] == "mcp-pedestal-1"
        assert added_data["position"] == [1.5, 0.25, 1.0]

        # 2. Update the object position
        upd_params = {
            "scene_id": "default",
            "object_id": "mcp-pedestal-1",
            "name": "MCP Oak Pedestal",
            "position": [1.8, 0.25, 1.2],
        }
        res_upd = await server.call_tool("update_object", upd_params)
        assert res_upd["isError"] is False
        upd_data = json.loads(res_upd["content"][0]["text"])
        assert upd_data["name"] == "MCP Oak Pedestal"
        assert upd_data["position"] == [1.8, 0.25, 1.2]

        # 3. Test FLOOR_PENETRATION 422 error
        bad_floor_params = {
            "scene_id": "default",
            "name": "Subterranean Box",
            "type": "box",
            "position": [3.0, 0.2, 0.0],
            "scale": [1.0, 1.0, 1.0],  # base at 0.2 - 0.5 = -0.3m < 0.0m
        }
        res_floor_err = await server.call_tool("add_object", bad_floor_params)
        assert res_floor_err["isError"] is True
        err_msg = res_floor_err["content"][0]["text"]
        assert "FLOOR_PENETRATION" in err_msg
        assert "penetrates the studio floor" in err_msg
        assert "Recommendation to self-correct" in err_msg

        # 4. Test COLLISION_AABB 422 error (colliding with default hero-product at [0.0, 1.05, 0.0])
        colliding_params = {
            "scene_id": "default",
            "name": "Colliding Intruder",
            "type": "box",
            "position": [0.0, 1.05, 0.0],
            "scale": [0.3, 0.5, 0.3],
        }
        res_col_err = await server.call_tool("add_object", colliding_params)
        assert res_col_err["isError"] is True
        col_err_msg = res_col_err["content"][0]["text"]
        assert "COLLISION_AABB" in col_err_msg
        assert "Volumetric 3D collision detected" in col_err_msg
        assert "Recommendation to self-correct" in col_err_msg

        # 5. Delete the object
        res_del = await server.call_tool("delete_object", {"scene_id": "default", "object_id": "mcp-pedestal-1"})
        assert res_del["isError"] is False
        del_data = json.loads(res_del["content"][0]["text"])
        assert del_data["status"] == "deleted"


@pytest.mark.anyio
async def test_mcp_camera_and_optics():
    """Tests set_camera and compute_optics tools."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        client = ShotlabAPIClient(client=ac)
        server = ShotlabMCPServer(client=client)

        # 1. Update camera optical parameters
        cam_params = {
            "scene_id": "default",
            "focal_length_mm": 50.0,
            "f_stop": 2.0,
            "focus_distance_m": 2.0,
        }
        res_cam = await server.call_tool("set_camera", cam_params)
        assert res_cam["isError"] is False
        cam_data = json.loads(res_cam["content"][0]["text"])
        assert cam_data["focal_length_mm"] == 50.0
        assert cam_data["f_stop"] == 2.0
        assert cam_data["focus_distance_m"] == 2.0
        # Preserved previous sensor dimensions
        assert cam_data["sensor_width_mm"] == 36.0

        # 2. Compute exact optics formulas
        optics_params = {
            "focal_length_mm": 85.0,
            "f_stop": 1.8,
            "focus_distance_m": 2.5,
            "sensor_width_mm": 36.0,
            "sensor_height_mm": 24.0,
        }
        res_optics = await server.call_tool("compute_optics", optics_params)
        assert res_optics["isError"] is False
        optics_data = json.loads(res_optics["content"][0]["text"])
        assert "vertical_fov_deg" in optics_data
        assert "horizontal_fov_deg" in optics_data
        assert "diagonal_fov_deg" in optics_data
        assert "hyperfocal_distance_m" in optics_data
        assert "dof_near_m" in optics_data
        assert "dof_far_m" in optics_data
        assert optics_data["dof_near_m"] < optics_data["dof_far_m"]


@pytest.mark.anyio
async def test_mcp_render_workflow_dual_engine():
    """Tests render_scene (qwen-2.1 and moss-image) and get_render_status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        client = ShotlabAPIClient(client=ac)
        server = ShotlabMCPServer(client=client)

        # 1. Submit Qwen Image 2.1 render job
        qwen_render_params = {
            "scene_id": "default",
            "engine": "qwen-2.1",
            "prompt": "Studio portrait of luxury cosmetic perfume, Hasselblad 85mm f/1.8, high key lighting",
            "steps": 20,
            "denoise": 0.8,
        }
        res_qwen = await server.call_tool("render_scene", qwen_render_params)
        assert res_qwen["isError"] is False
        job_qwen = json.loads(res_qwen["content"][0]["text"])
        assert "job_id" in job_qwen
        assert job_qwen["engine"] == "qwen-2.1"

        # 2. Poll job status
        res_status = await server.call_tool("get_render_status", {"job_id": job_qwen["job_id"]})
        assert res_status["isError"] is False
        status_data = json.loads(res_status["content"][0]["text"])
        assert status_data["job_id"] == job_qwen["job_id"]
        assert "status" in status_data
        assert status_data["status"] in ("pending", "processing", "completed")

        # 3. Submit MOSS-Image render job
        moss_render_params = {
            "scene_id": "default",
            "engine": "moss-image",
            "prompt": "Minimalist bottle on geometric pedestal with architectural shadows",
            "steps": 15,
        }
        res_moss = await server.call_tool("render_scene", moss_render_params)
        assert res_moss["isError"] is False
        job_moss = json.loads(res_moss["content"][0]["text"])
        assert job_moss["engine"] == "moss-image"


@pytest.mark.anyio
async def test_mcp_unknown_tool_and_invalid_params():
    """Tests error responses for invalid tool invocations."""
    server = ShotlabMCPServer()

    # Unknown tool
    res_unknown = await server.call_tool("unknown_tool_xyz", {})
    assert res_unknown["isError"] is True
    assert "UNKNOWN_TOOL" in res_unknown["content"][0]["text"]

    # Missing tool name in tools/call JSON-RPC
    msg = {"jsonrpc": "2.0", "id": 99, "method": "tools/call", "params": {}}
    resp = await server.handle_message(msg)
    assert resp["error"]["code"] == -32602
