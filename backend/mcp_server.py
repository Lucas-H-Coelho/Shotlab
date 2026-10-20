"""
Shotlab MCP Server — Model Context Protocol thin client for the /v1 REST API.

Provides JSON-RPC 2.0 stdio server and Python-callable tools for AI agents
(e.g., Claude Desktop, Antigravity, Cursor) to inspect and manipulate the 3D scene,
compute real physical optics, and trigger dual-engine ComfyUI renders.

All spatial coordinates and dimensions are strictly in meters (m).
All camera optical parameters use real photographic units (mm, f-stop).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional

import httpx

# ============================================================================
# MCP Protocol Constants & Tool Schemas
# ============================================================================

MCP_PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "shotlab-mcp-server"
SERVER_VERSION = "1.0.0"

TOOL_SCHEMAS: List[Dict[str, Any]] = [
    {
        "name": "list_scenes",
        "description": (
            "List all 3D photographic scenes in the Shotlab virtual studio with metadata, "
            "active camera parameters, and object summaries."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_scene",
        "description": (
            "Retrieve full Scene Graph data by ID, including 3D objects with physical coordinates and scales "
            "in meters [m], camera optical settings (focal length in mm, aperture f/, sensor dimensions in mm), "
            "and studio lighting."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "scene_id": {
                    "type": "string",
                    "description": "Identifier of the scene to fetch (e.g. 'default' or 'scene-default').",
                    "default": "default",
                },
            },
            "required": ["scene_id"],
        },
    },
    {
        "name": "add_object",
        "description": (
            "Add a 3D object to the virtual studio with real physical dimensions and coordinates in meters [m]. "
            "Backend enforces physical validation: floor contact (base elevation Y >= 0.0m) and volumetric "
            "AABB collision checks against other objects in the scene. If violated, returns clear diagnostics "
            "so the agent can adjust coordinates and self-correct."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "scene_id": {
                    "type": "string",
                    "description": "Target scene ID (e.g. 'default').",
                    "default": "default",
                },
                "name": {
                    "type": "string",
                    "description": "Descriptive name for the 3D object (e.g. 'Hero Perfume Bottle').",
                },
                "type": {
                    "type": "string",
                    "enum": ["box", "cylinder", "sphere", "plane", "table", "backdrop", "model"],
                    "description": "Geometric primitive type.",
                },
                "position": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "World position [X, Y, Z] in meters [m]. Y is vertical elevation above the studio floor (Y=0.0m).",
                },
                "scale": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "Physical dimensions [Width (X), Height (Y), Depth (Z)] strictly in positive meters [m].",
                },
                "rotation": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "Euler angles [Pitch (X), Yaw (Y), Roll (Z)] in radians. Default is [0.0, 0.0, 0.0].",
                    "default": [0.0, 0.0, 0.0],
                },
                "material": {
                    "type": "object",
                    "description": "Physical PBR material parameters.",
                    "properties": {
                        "color": {"type": "string", "description": "Hex color code (e.g. '#e11d48')."},
                        "roughness": {"type": "number", "minimum": 0.0, "maximum": 1.0, "description": "Surface roughness (0=glossy, 1=diffuse)."},
                        "metalness": {"type": "number", "minimum": 0.0, "maximum": 1.0, "description": "Metallic reflection (0=dielectric, 1=metallic)."},
                        "opacity": {"type": "number", "minimum": 0.0, "maximum": 1.0, "description": "Material opacity."},
                        "wireframe": {"type": "boolean", "description": "Render wireframe mode."},
                    },
                },
                "id": {
                    "type": "string",
                    "description": "Optional unique object ID. If omitted, one is automatically generated.",
                },
                "visible": {
                    "type": "boolean",
                    "description": "Whether the object is visible and participates in collision checks. Default true.",
                    "default": True,
                },
                "locked": {
                    "type": "boolean",
                    "description": "Whether the object is locked from editing. Default false.",
                    "default": False,
                },
            },
            "required": ["scene_id", "name", "type", "position", "scale"],
        },
    },
    {
        "name": "update_object",
        "description": (
            "Update position (meters [m]), rotation (radians), scale (meters [m]), material, or visibility "
            "of an existing 3D object in the scene. Subject to the same physical floor and collision validations."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "scene_id": {
                    "type": "string",
                    "description": "Target scene ID.",
                    "default": "default",
                },
                "object_id": {
                    "type": "string",
                    "description": "ID of the object to modify.",
                },
                "name": {
                    "type": "string",
                    "description": "New name for the object.",
                },
                "position": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "New position [X, Y, Z] in meters [m].",
                },
                "rotation": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "New Euler rotation [Pitch, Yaw, Roll] in radians.",
                },
                "scale": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "New dimensions [Width, Height, Depth] in positive meters [m].",
                },
                "material": {
                    "type": "object",
                    "description": "Updated PBR material parameters.",
                    "properties": {
                        "color": {"type": "string"},
                        "roughness": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "metalness": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "opacity": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "wireframe": {"type": "boolean"},
                    },
                },
                "visible": {
                    "type": "boolean",
                    "description": "Toggle visibility.",
                },
            },
            "required": ["scene_id", "object_id"],
        },
    },
    {
        "name": "delete_object",
        "description": "Delete a 3D object from the scene by its object ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "scene_id": {
                    "type": "string",
                    "description": "Target scene ID.",
                    "default": "default",
                },
                "object_id": {
                    "type": "string",
                    "description": "ID of the object to delete.",
                },
            },
            "required": ["scene_id", "object_id"],
        },
    },
    {
        "name": "set_camera",
        "description": (
            "Configure the virtual camera using real physical photography metrics: focal length in millimeters [mm], "
            "aperture f-stop [f/], focus distance in meters [m], sensor dimensions in millimeters [mm], "
            "and camera position / target in meters [m]."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "scene_id": {
                    "type": "string",
                    "description": "Target scene ID.",
                    "default": "default",
                },
                "focal_length_mm": {
                    "type": "number",
                    "minimum": 10.0,
                    "maximum": 600.0,
                    "description": "Lens focal length in millimeters [mm] (e.g. 24, 35, 50, 85, 105, 135).",
                },
                "f_stop": {
                    "type": "number",
                    "minimum": 0.7,
                    "maximum": 64.0,
                    "description": "Lens aperture f-number (e.g. 1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11.0, 16.0).",
                },
                "focus_distance_m": {
                    "type": "number",
                    "minimum": 0.1,
                    "maximum": 100.0,
                    "description": "Subject plane focus distance in meters [m] (e.g. 2.2).",
                },
                "sensor_width_mm": {
                    "type": "number",
                    "minimum": 5.0,
                    "maximum": 100.0,
                    "description": "Physical sensor width in millimeters [mm] (36.0mm for Full Frame, 23.6mm for APS-C).",
                },
                "sensor_height_mm": {
                    "type": "number",
                    "minimum": 5.0,
                    "maximum": 100.0,
                    "description": "Physical sensor height in millimeters [mm] (24.0mm for Full Frame, 15.6mm for APS-C).",
                },
                "position": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "Camera 3D world position [X, Y, Z] in meters [m].",
                },
                "target": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                    "description": "Camera look-at target [X, Y, Z] in meters [m].",
                },
                "aspect_ratio": {
                    "type": "number",
                    "description": "Aspect ratio (e.g. 1.5 for 3:2 Full Frame, 1.33 for 4:3, 1.777 for 16:9).",
                },
            },
            "required": ["scene_id"],
        },
    },
    {
        "name": "compute_optics",
        "description": (
            "Calculate real photographic optical metrics: horizontal/vertical/diagonal Field of View (FOV in degrees [°]), "
            "Circle of Confusion (CoC in millimeters [mm]), Hyperfocal distance in meters [m], and Depth of Field "
            "(near limit, far limit, and total DoF span in meters [m])."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "focal_length_mm": {
                    "type": "number",
                    "minimum": 1.0,
                    "maximum": 1000.0,
                    "description": "Focal length in millimeters [mm] (e.g. 50.0).",
                    "default": 50.0,
                },
                "f_stop": {
                    "type": "number",
                    "minimum": 0.5,
                    "maximum": 128.0,
                    "description": "Lens aperture f-stop (e.g. 2.8).",
                    "default": 2.8,
                },
                "focus_distance_m": {
                    "type": "number",
                    "minimum": 0.01,
                    "maximum": 1000.0,
                    "description": "Subject focus distance in meters [m] (e.g. 2.5).",
                    "default": 2.5,
                },
                "sensor_width_mm": {
                    "type": "number",
                    "minimum": 1.0,
                    "maximum": 200.0,
                    "description": "Sensor width in millimeters [mm] (default 36.0 for Full Frame).",
                    "default": 36.0,
                },
                "sensor_height_mm": {
                    "type": "number",
                    "minimum": 1.0,
                    "maximum": 200.0,
                    "description": "Sensor height in millimeters [mm] (default 24.0 for Full Frame).",
                    "default": 24.0,
                },
                "custom_coc_mm": {
                    "type": "number",
                    "description": "Optional explicit Circle of Confusion in millimeters [mm].",
                },
                "coc_divisor": {
                    "type": "number",
                    "description": "Circle of confusion diagonal divisor (default 1500.0 for Zeiss standard).",
                    "default": 1500.0,
                },
            },
            "required": [],
        },
    },
    {
        "name": "render_scene",
        "description": (
            "Dispatch an AI photographic render job for the scene to ComfyUI. Supports dual engines: "
            "'qwen-2.1' (Qwen Image 2.1 via 3D pass image conditioning) and 'moss-image' (MOSS-Image via structured "
            "bounding-box layout conditioning). Returns a job ID to poll progress."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "scene_id": {
                    "type": "string",
                    "description": "Scene ID to render (e.g. 'default').",
                    "default": "default",
                },
                "prompt": {
                    "type": "string",
                    "description": "Photorealistic prompt describing the lighting, textures, materials, and overall mood.",
                },
                "engine": {
                    "type": "string",
                    "enum": ["qwen-2.1", "moss-image"],
                    "description": "Diffusion engine selector ('qwen-2.1' or 'moss-image'). Default is 'qwen-2.1'.",
                    "default": "qwen-2.1",
                },
                "negative_prompt": {
                    "type": "string",
                    "description": "Negative prompt to suppress unwanted artifacts.",
                    "default": "blurry, low quality, cartoon, deformed, noisy",
                },
                "steps": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "description": "Inference steps (default: 25).",
                    "default": 25,
                },
                "denoise": {
                    "type": "number",
                    "minimum": 0.1,
                    "maximum": 1.0,
                    "description": "Denoising strength (0.1 to 1.0, default: 0.85).",
                    "default": 0.85,
                },
                "seed": {
                    "type": "integer",
                    "description": "Random seed for reproducible results.",
                },
                "reference_image_base64": {
                    "type": "string",
                    "description": "Optional base64-encoded image pass from the 3D viewport.",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "get_render_status",
        "description": "Check the status, percentage progress, and output image URL of a submitted render job.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "job_id": {
                    "type": "string",
                    "description": "Job identifier returned by render_scene (e.g. 'job-a1b2c3d4').",
                },
            },
            "required": ["job_id"],
        },
    },
]


# ============================================================================
# Shotlab Thin API Client
# ============================================================================

class ShotlabAPIClient:
    """
    Thin HTTP client communicating with Shotlab's /v1 FastAPI REST endpoints.
    Can be configured with an existing httpx.AsyncClient (e.g. in tests using ASGITransport)
    or connects to a running FastAPI server via base_url.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ):
        self.base_url = (base_url or os.getenv("SHOTLAB_API_BASE_URL", "http://127.0.0.1:8000")).rstrip("/")
        self._custom_client = client

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Performs HTTP request and formats physical errors for AI self-correction."""
        url = f"{self.base_url}{path}"
        try:
            if self._custom_client is not None:
                resp = await self._custom_client.request(method, url, params=params, json=json_data)
            else:
                async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as ac:
                    resp = await ac.request(method, path, params=params, json=json_data)
        except httpx.ConnectError:
            return {
                "isError": True,
                "error": f"CONNECTION_ERROR: Could not connect to Shotlab API at {self.base_url}. Ensure the FastAPI server is running.",
            }
        except httpx.RequestError as exc:
            return {
                "isError": True,
                "error": f"REQUEST_ERROR: Failed communicating with Shotlab API: {exc}",
            }

        # Parse response
        if resp.status_code == 422:
            return self._format_422_error(resp)
        elif resp.status_code == 404:
            try:
                detail = resp.json().get("detail", resp.text)
            except Exception:
                detail = resp.text
            return {
                "isError": True,
                "error": f"RESOURCE_NOT_FOUND (HTTP 404): {detail}",
            }
        elif resp.status_code >= 400:
            return {
                "isError": True,
                "error": f"API_ERROR (HTTP {resp.status_code}): {resp.text}",
            }

        try:
            data = resp.json()
            return {"isError": False, "data": data}
        except Exception:
            return {"isError": False, "data": resp.text}

    def _format_422_error(self, resp: httpx.Response) -> Dict[str, Any]:
        """Formats 422 physical constraint errors so LLM agents can easily self-correct."""
        try:
            body = resp.json()
            detail = body.get("detail", body)
            if isinstance(detail, dict):
                code = detail.get("code")
                if code == "FLOOR_PENETRATION":
                    obj_name = detail.get("object_name", "Object")
                    base_y = detail.get("base_y_meters", 0.0)
                    msg = (
                        f"PHYSICAL VIOLATION (FLOOR_PENETRATION): Object '{obj_name}' penetrates the studio floor at "
                        f"base elevation Y = {base_y:.4f}m (studio floor is at Y = 0.0m).\n"
                        f"-> Recommendation to self-correct: Increase position[1] (Y height in meters) by at least "
                        f"{abs(base_y):.4f}m so that base Y >= 0.0m."
                    )
                    return {"isError": True, "error": msg, "data": detail}
                elif code == "COLLISION_AABB":
                    obj_a = detail.get("object_a_name", "Object A")
                    obj_b = detail.get("object_b_name", "Object B")
                    msg = (
                        f"PHYSICAL VIOLATION (COLLISION_AABB): Volumetric 3D collision detected between '{obj_a}' and '{obj_b}'.\n"
                        f"-> Recommendation to self-correct: Reposition or rescale the object along X, Y, or Z in meters "
                        f"to eliminate overlapping bounding boxes in 3D space."
                    )
                    return {"isError": True, "error": msg, "data": detail}
            elif isinstance(detail, list):
                # Pydantic validation errors
                err_lines = [
                    f"- {'.'.join(str(loc) for loc in err.get('loc', []))}: {err.get('msg', '')}"
                    for err in detail
                ]
                msg = "VALIDATION ERROR (HTTP 422):\n" + "\n".join(err_lines)
                return {"isError": True, "error": msg, "data": detail}

            return {
                "isError": True,
                "error": f"Physical or Schema Validation Error (HTTP 422): {json.dumps(detail, ensure_ascii=False)}",
                "data": detail,
            }
        except Exception:
            return {"isError": True, "error": f"Validation Error (HTTP 422): {resp.text}"}

    # ------------------------------------------------------------------------
    # API Tool Methods
    # ------------------------------------------------------------------------

    async def list_scenes(self) -> Dict[str, Any]:
        """Lists all scenes in the studio."""
        return await self._request("GET", "/v1/scenes")

    async def get_scene(self, scene_id: str = "default") -> Dict[str, Any]:
        """Gets full scene graph by ID."""
        return await self._request("GET", f"/v1/scenes/{scene_id}")

    async def add_object(
        self,
        scene_id: str,
        name: str,
        type: str,
        position: List[float],
        scale: List[float],
        rotation: Optional[List[float]] = None,
        material: Optional[Dict[str, Any]] = None,
        id: Optional[str] = None,
        visible: bool = True,
        locked: bool = False,
    ) -> Dict[str, Any]:
        """Adds a 3D object to the scene."""
        payload: Dict[str, Any] = {
            "name": name,
            "type": type,
            "position": position,
            "scale": scale,
            "visible": visible,
            "locked": locked,
        }
        if rotation is not None:
            payload["rotation"] = rotation
        if material is not None:
            payload["material"] = material
        if id is not None:
            payload["id"] = id
        else:
            payload["id"] = f"obj-{name.lower().replace(' ', '-')[:12]}"

        return await self._request("POST", f"/v1/scenes/{scene_id}/objects", json_data=payload)

    async def update_object(
        self,
        scene_id: str,
        object_id: str,
        name: Optional[str] = None,
        position: Optional[List[float]] = None,
        rotation: Optional[List[float]] = None,
        scale: Optional[List[float]] = None,
        material: Optional[Dict[str, Any]] = None,
        visible: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Updates attributes of an existing object."""
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if position is not None:
            payload["position"] = position
        if rotation is not None:
            payload["rotation"] = rotation
        if scale is not None:
            payload["scale"] = scale
        if material is not None:
            payload["material"] = material
        if visible is not None:
            payload["visible"] = visible

        return await self._request("PATCH", f"/v1/scenes/{scene_id}/objects/{object_id}", json_data=payload)

    async def delete_object(self, scene_id: str, object_id: str) -> Dict[str, Any]:
        """Deletes an object from the scene."""
        return await self._request("DELETE", f"/v1/scenes/{scene_id}/objects/{object_id}")

    async def set_camera(
        self,
        scene_id: str = "default",
        focal_length_mm: Optional[float] = None,
        f_stop: Optional[float] = None,
        focus_distance_m: Optional[float] = None,
        sensor_width_mm: Optional[float] = None,
        sensor_height_mm: Optional[float] = None,
        position: Optional[List[float]] = None,
        target: Optional[List[float]] = None,
        aspect_ratio: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Updates camera parameters, preserving existing scene camera values where omitted."""
        # 1. Fetch current scene camera to merge non-provided parameters
        current_cam: Dict[str, Any] = {
            "focal_length_mm": 85.0,
            "sensor_width_mm": 36.0,
            "sensor_height_mm": 24.0,
            "f_stop": 1.8,
            "focus_distance_m": 2.2,
            "position": [0.0, 1.4, 2.5],
            "target": [0.0, 0.9, 0.0],
            "aspect_ratio": 1.5,
        }
        scene_res = await self.get_scene(scene_id)
        if not scene_res.get("isError") and isinstance(scene_res.get("data"), dict):
            existing_cam = scene_res["data"].get("camera")
            if isinstance(existing_cam, dict):
                current_cam.update(existing_cam)

        if focal_length_mm is not None:
            current_cam["focal_length_mm"] = focal_length_mm
        if f_stop is not None:
            current_cam["f_stop"] = f_stop
        if focus_distance_m is not None:
            current_cam["focus_distance_m"] = focus_distance_m
        if sensor_width_mm is not None:
            current_cam["sensor_width_mm"] = sensor_width_mm
        if sensor_height_mm is not None:
            current_cam["sensor_height_mm"] = sensor_height_mm
        if position is not None:
            current_cam["position"] = position
        if target is not None:
            current_cam["target"] = target
        if aspect_ratio is not None:
            current_cam["aspect_ratio"] = aspect_ratio

        return await self._request("PUT", f"/v1/scenes/{scene_id}/camera", json_data=current_cam)

    async def compute_optics(
        self,
        focal_length_mm: float = 50.0,
        f_stop: float = 2.8,
        focus_distance_m: float = 2.5,
        sensor_width_mm: float = 36.0,
        sensor_height_mm: float = 24.0,
        custom_coc_mm: Optional[float] = None,
        coc_divisor: float = 1500.0,
    ) -> Dict[str, Any]:
        """Computes FOV, DoF, CoC, and hyperfocal distance."""
        payload: Dict[str, Any] = {
            "focal_length_mm": focal_length_mm,
            "f_stop": f_stop,
            "focus_distance_m": focus_distance_m,
            "sensor_width_mm": sensor_width_mm,
            "sensor_height_mm": sensor_height_mm,
            "coc_divisor": coc_divisor,
        }
        if custom_coc_mm is not None:
            payload["custom_coc_mm"] = custom_coc_mm

        return await self._request("POST", "/v1/optics/compute", json_data=payload)

    async def render_scene(
        self,
        prompt: str,
        scene_id: str = "default",
        engine: str = "qwen-2.1",
        negative_prompt: Optional[str] = "blurry, low quality, cartoon, deformed, noisy",
        steps: int = 25,
        denoise: float = 0.85,
        seed: Optional[int] = None,
        reference_image_base64: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submits a ComfyUI render job."""
        payload: Dict[str, Any] = {
            "prompt": prompt,
            "engine": engine,
            "negative_prompt": negative_prompt,
            "steps": steps,
            "denoise": denoise,
        }
        if seed is not None:
            payload["seed"] = seed
        if reference_image_base64 is not None:
            payload["reference_image_base64"] = reference_image_base64

        return await self._request("POST", f"/v1/scenes/{scene_id}/render", json_data=payload)

    async def get_render_status(self, job_id: str) -> Dict[str, Any]:
        """Fetches status and result of a render job."""
        return await self._request("GET", f"/v1/jobs/{job_id}")


# ============================================================================
# Shotlab MCP Server Implementation
# ============================================================================

class ShotlabMCPServer:
    """
    Model Context Protocol (JSON-RPC 2.0 stdio) server.
    Serves as an agent-facing thin layer dispatching to Shotlab's /v1 REST API.
    """

    def __init__(
        self,
        client: Optional[ShotlabAPIClient] = None,
        base_url: Optional[str] = None,
    ):
        self.client = client or ShotlabAPIClient(base_url=base_url)

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Returns the list of available MCP tools and their JSON schemas."""
        return TOOL_SCHEMAS

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes an MCP tool by name and returns standard MCP result:
        {"content": [{"type": "text", "text": "..."}], "isError": bool}
        """
        args = arguments or {}

        if name == "list_scenes":
            res = await self.client.list_scenes()
        elif name == "get_scene":
            scene_id = args.get("scene_id", "default")
            res = await self.client.get_scene(scene_id=scene_id)
        elif name == "add_object":
            res = await self.client.add_object(
                scene_id=args.get("scene_id", "default"),
                name=args["name"],
                type=args["type"],
                position=args["position"],
                scale=args["scale"],
                rotation=args.get("rotation"),
                material=args.get("material"),
                id=args.get("id"),
                visible=args.get("visible", True),
                locked=args.get("locked", False),
            )
        elif name == "update_object":
            res = await self.client.update_object(
                scene_id=args.get("scene_id", "default"),
                object_id=args["object_id"],
                name=args.get("name"),
                position=args.get("position"),
                rotation=args.get("rotation"),
                scale=args.get("scale"),
                material=args.get("material"),
                visible=args.get("visible"),
            )
        elif name == "delete_object":
            res = await self.client.delete_object(
                scene_id=args.get("scene_id", "default"),
                object_id=args["object_id"],
            )
        elif name == "set_camera":
            res = await self.client.set_camera(
                scene_id=args.get("scene_id", "default"),
                focal_length_mm=args.get("focal_length_mm"),
                f_stop=args.get("f_stop"),
                focus_distance_m=args.get("focus_distance_m"),
                sensor_width_mm=args.get("sensor_width_mm"),
                sensor_height_mm=args.get("sensor_height_mm"),
                position=args.get("position"),
                target=args.get("target"),
                aspect_ratio=args.get("aspect_ratio"),
            )
        elif name == "compute_optics":
            res = await self.client.compute_optics(
                focal_length_mm=args.get("focal_length_mm", 50.0),
                f_stop=args.get("f_stop", 2.8),
                focus_distance_m=args.get("focus_distance_m", 2.5),
                sensor_width_mm=args.get("sensor_width_mm", 36.0),
                sensor_height_mm=args.get("sensor_height_mm", 24.0),
                custom_coc_mm=args.get("custom_coc_mm"),
                coc_divisor=args.get("coc_divisor", 1500.0),
            )
        elif name == "render_scene":
            res = await self.client.render_scene(
                scene_id=args.get("scene_id", "default"),
                prompt=args["prompt"],
                engine=args.get("engine", "qwen-2.1"),
                negative_prompt=args.get("negative_prompt", "blurry, low quality, cartoon, deformed, noisy"),
                steps=args.get("steps", 25),
                denoise=args.get("denoise", 0.85),
                seed=args.get("seed"),
                reference_image_base64=args.get("reference_image_base64"),
            )
        elif name == "get_render_status":
            res = await self.client.get_render_status(job_id=args["job_id"])
        else:
            return {
                "content": [{"type": "text", "text": f"UNKNOWN_TOOL: Tool '{name}' does not exist on this server."}],
                "isError": True,
            }

        # Format output content
        if res.get("isError"):
            return {
                "content": [{"type": "text", "text": str(res.get("error", "Unknown tool error"))}],
                "isError": True,
            }

        data_val = res.get("data")
        text_out = json.dumps(data_val, indent=2, ensure_ascii=False) if isinstance(data_val, (dict, list)) else str(data_val)
        return {
            "content": [{"type": "text", "text": text_out}],
            "isError": False,
        }

    async def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Dispatches incoming JSON-RPC 2.0 messages according to the MCP specification.
        Returns a response dictionary or None (for notifications).
        """
        msg_id = message.get("id")
        method = message.get("method")
        params = message.get("params", {})

        # Notifications do not return a response
        if method == "notifications/initialized":
            return None

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": {},
                    },
                    "serverInfo": {
                        "name": SERVER_NAME,
                        "version": SERVER_VERSION,
                    },
                },
            }

        elif method == "ping":
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {},
            }

        elif method == "tools/list":
            tools = await self.list_tools()
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "tools": tools,
                },
            }

        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            if not tool_name:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32602,
                        "message": "Invalid params: 'name' is required for tools/call",
                    },
                }

            result = await self.call_tool(tool_name, arguments)
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": result,
            }

        else:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: '{method}'",
                },
            }

    async def run_stdio(self) -> None:
        """
        Runs the JSON-RPC stdio event loop. Reads newline-delimited JSON from stdin
        and writes responses to stdout. Diagnostic logs are directed to stderr.
        """
        sys.stderr.write(f"[{SERVER_NAME}] Starting stdio transport connected to {self.client.base_url}\n")
        sys.stderr.flush()

        loop = asyncio.get_running_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)

        while True:
            line_bytes = await reader.readline()
            if not line_bytes:
                break
            line_str = line_bytes.decode("utf-8").strip()
            if not line_str:
                continue

            try:
                msg = json.loads(line_str)
            except Exception as e:
                err_resp = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"Parse error: {e}"},
                }
                sys.stdout.write(json.dumps(err_resp) + "\n")
                sys.stdout.flush()
                continue

            try:
                resp = await self.handle_message(msg)
                if resp is not None:
                    sys.stdout.write(json.dumps(resp) + "\n")
                    sys.stdout.flush()
            except Exception as e:
                sys.stderr.write(f"[{SERVER_NAME}] Internal error handling message: {e}\n")
                sys.stderr.flush()
                err_resp = {
                    "jsonrpc": "2.0",
                    "id": msg.get("id"),
                    "error": {"code": -32603, "message": f"Internal error: {e}"},
                }
                sys.stdout.write(json.dumps(err_resp) + "\n")
                sys.stdout.flush()


# ============================================================================
# Python Programmatic Invocations & CLI Entrypoint
# ============================================================================

async def call_tool_direct(
    name: str,
    arguments: Dict[str, Any],
    client: Optional[ShotlabAPIClient] = None,
) -> Dict[str, Any]:
    """Convenience helper to invoke a tool directly in Python without stdio."""
    server = ShotlabMCPServer(client=client)
    return await server.call_tool(name, arguments)


def main():
    """CLI entrypoint for running the MCP server over stdio."""
    server = ShotlabMCPServer()
    try:
        asyncio.run(server.run_stdio())
    except (KeyboardInterrupt, SystemExit):
        sys.stderr.write(f"[{SERVER_NAME}] Shutdown cleanly.\n")


if __name__ == "__main__":
    main()
