"""
Shotlab ComfyUI Async Client
Provides asynchronous communication with ComfyUI via HTTP and WebSocket,
with offline-safe fallback mode and MOSS-Image / Qwen Image 2.1 dual-engine support.
"""

import os
import math
import json
import uuid
import asyncio
from typing import Dict, Any, Optional, List, AsyncGenerator, Union

import httpx
import websockets

from models.scene import SceneGraphModel, SceneObjectModel, CameraModel


class ComfyUIError(Exception):
    """Base exception for ComfyUI client errors."""
    pass


class ComfyUIOfflineError(ComfyUIError):
    """Raised when ComfyUI server is unreachable or offline."""
    pass


class ComfyUIClient:
    """
    Async client for ComfyUI REST API and WebSocket streams.
    Designed with offline-safe isolation so the Shotlab application remains
    fully functional in 3D edit mode even when ComfyUI is offline.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or os.environ.get("COMFYUI_URL", "http://localhost:8188")).rstrip("/")

    @property
    def ws_url(self) -> str:
        """Derives the WebSocket URL from base HTTP/HTTPS URL."""
        if self.base_url.startswith("https://"):
            return "wss://" + self.base_url[len("https://"):]
        elif self.base_url.startswith("http://"):
            return "ws://" + self.base_url[len("http://"):]
        return f"ws://{self.base_url}"

    async def check_health(self) -> Dict[str, Any]:
        """
        Graceful async health check against GET {COMFYUI_URL}/system_stats with a short 2.0s timeout.
        Returns {"online": bool, "url": str, "details": ...} without ever raising exceptions
        that could crash or block the backend.
        """
        target_url = f"{self.base_url}/system_stats"
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(target_url)
                if response.status_code == 200:
                    try:
                        details = response.json()
                    except Exception:
                        details = {"raw": response.text}
                    return {
                        "online": True,
                        "url": self.base_url,
                        "details": details,
                    }
                else:
                    return {
                        "online": False,
                        "url": self.base_url,
                        "details": {
                            "status_code": response.status_code,
                            "error": f"ComfyUI returned HTTP status {response.status_code}",
                        },
                    }
        except Exception as exc:
            return {
                "online": False,
                "url": self.base_url,
                "details": {
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
            }

    async def upload_image(
        self,
        image_bytes: bytes,
        filename: str,
        subfolder: str = "",
        image_type: str = "input",
        overwrite: bool = True,
    ) -> Dict[str, Any]:
        """
        Uploads an image buffer to ComfyUI via POST {COMFYUI_URL}/upload/image.
        """
        target_url = f"{self.base_url}/upload/image"
        files = {"image": (filename, image_bytes, "image/png")}
        data = {
            "subfolder": subfolder,
            "type": image_type,
            "overwrite": "true" if overwrite else "false",
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(target_url, files=files, data=data)
                res.raise_for_status()
                return res.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise ComfyUIOfflineError(f"ComfyUI offline or unreachable at {self.base_url}: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise ComfyUIError(f"ComfyUI upload failed ({exc.response.status_code}): {exc.response.text}") from exc

    async def queue_prompt(
        self,
        workflow_json: Dict[str, Any],
        client_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches a workflow execution request to ComfyUI via POST {COMFYUI_URL}/prompt.
        """
        target_url = f"{self.base_url}/prompt"
        payload: Dict[str, Any] = {"prompt": workflow_json}
        if client_id:
            payload["client_id"] = client_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(target_url, json=payload)
                res.raise_for_status()
                return res.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise ComfyUIOfflineError(f"ComfyUI offline or unreachable at {self.base_url}: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise ComfyUIError(f"ComfyUI prompt queuing failed ({exc.response.status_code}): {exc.response.text}") from exc

    async def stream_progress(
        self,
        client_id: str,
        prompt_id: Optional[str] = None,
        timeout: float = 120.0,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Listens to ComfyUI WebSocket messages on ws://{host}:{port}/ws?clientId={client_id}.
        Provides offline-safe fallback: if WebSocket connection fails or drops, yields
        a fallback status event instead of raising an unhandled exception.
        """
        ws_endpoint = f"{self.ws_url}/ws?clientId={client_id}"
        try:
            async with websockets.connect(ws_endpoint, open_timeout=2.0) as ws:
                while True:
                    try:
                        message = await asyncio.wait_for(ws.recv(), timeout=timeout)
                    except asyncio.TimeoutError:
                        yield {
                            "type": "timeout",
                            "data": {
                                "client_id": client_id,
                                "prompt_id": prompt_id,
                                "message": f"WebSocket timed out waiting for ComfyUI message ({timeout}s)",
                            },
                        }
                        break

                    if isinstance(message, bytes):
                        # Binary preview frame from ComfyUI
                        yield {
                            "type": "preview_bytes",
                            "data": message,
                        }
                        continue

                    try:
                        event = json.loads(message)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type")
                    event_data = event.get("data", {})
                    msg_prompt_id = event_data.get("prompt_id")

                    yield event

                    # Check execution termination
                    if event_type == "executing":
                        # When node is None, execution of workflow finished
                        if event_data.get("node") is None:
                            if prompt_id is None or msg_prompt_id == prompt_id:
                                break

                    elif event_type == "execution_error":
                        if prompt_id is None or msg_prompt_id == prompt_id:
                            break

        except Exception as exc:
            # Offline-safe graceful yield
            yield {
                "type": "offline",
                "data": {
                    "online": False,
                    "client_id": client_id,
                    "prompt_id": prompt_id,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                    "message": f"ComfyUI WebSocket unavailable at {ws_endpoint}. Operating in offline-safe fallback mode.",
                },
            }

    async def get_history(self, prompt_id: str) -> Dict[str, Any]:
        """Fetches execution history for a specific prompt_id."""
        target_url = f"{self.base_url}/history/{prompt_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(target_url)
                res.raise_for_status()
                return res.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise ComfyUIOfflineError(f"ComfyUI offline or unreachable at {self.base_url}: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise ComfyUIError(f"ComfyUI history fetch failed ({exc.response.status_code}): {exc.response.text}") from exc

    def get_view_url(self, filename: str, subfolder: str = "", image_type: str = "output") -> str:
        """Returns the public URL to view an image generated or uploaded to ComfyUI."""
        return f"{self.base_url}/view?filename={filename}&subfolder={subfolder}&type={image_type}"


def build_moss_layout_from_scene(
    scene_graph: Union[SceneGraphModel, Dict[str, Any]],
    width: int = 1024,
    height: int = 1024,
    global_caption: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Projects 3D objects from Shotlab's SceneGraphModel into MOSS-Image
    Layout JSON format (abs_centralized coordinates, yxyx bounding box format),
    following the physical optical camera formulation documented in docs/RESEARCH_MOSS_IMAGE.md.
    """
    if width % 16 != 0 or height % 16 != 0:
        raise ValueError(f"Canvas dimensions must be multiples of 16, got width={width}, height={height}")

    if isinstance(scene_graph, dict):
        scene = SceneGraphModel.model_validate(scene_graph)
    else:
        scene = scene_graph

    cam = scene.camera
    focal_mm = max(1.0, float(cam.focal_length_mm))
    sensor_w = float(cam.sensor_width_mm)
    sensor_h = float(cam.sensor_height_mm)

    # 1. Optical field of view half-angle tangents (tan(fov/2))
    # tan(atan(sensor / (2 * focal))) == sensor / (2 * focal)
    tan_half_v = sensor_h / (2.0 * focal_mm)
    tan_half_h = sensor_w / (2.0 * focal_mm)

    # 2. Camera orthonormal coordinate system (LookAt)
    cx, cy, cz = [float(v) for v in cam.position]
    tx, ty, tz = [float(v) for v in cam.target]

    fx, fy, fz = tx - cx, ty - cy, tz - cz
    f_len = math.sqrt(fx * fx + fy * fy + fz * fz) or 1.0
    fx, fy, fz = fx / f_len, fy / f_len, fz / f_len

    # Up reference: [0, 1, 0]
    # Right = Forward x Up -> [fy*0 - fz*1, fz*0 - fx*0, fx*1 - fy*0] = [-fz, 0, fx]
    rx = -fz
    ry = 0.0
    rz = fx
    r_len = math.sqrt(rx * rx + rz * rz)
    if r_len < 1e-6:
        # Camera is looking straight along Y axis
        rx = 1.0 if fy > 0 else -1.0
        ry = 0.0
        rz = 0.0
        r_len = 1.0
    rx, rz = rx / r_len, rz / r_len

    # True Up = Right x Forward
    ux = ry * fz - rz * fy
    uy = rz * fx - rx * fz
    uz = rx * fy - ry * fx

    half_w = width // 2
    half_h = height // 2
    items: List[Dict[str, Any]] = []

    for obj in scene.objects:
        if not obj.visible or obj.type == "backdrop":
            continue

        sx, sy, sz = [float(v) for v in obj.scale]
        hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
        local_corners = [
            [-hx, -hy, -hz], [hx, -hy, -hz],
            [-hx,  hy, -hz], [hx,  hy, -hz],
            [-hx, -hy,  hz], [hx, -hy,  hz],
            [-hx,  hy,  hz], [hx,  hy,  hz],
        ]

        pitch, yaw, roll = [float(v) for v in obj.rotation]
        cp, sp = math.cos(pitch), math.sin(pitch)
        cy_a, sy_a = math.cos(yaw), math.sin(yaw)
        cr, sr = math.cos(roll), math.sin(roll)

        R = [
            [cy_a * cr + sy_a * sp * sr, -cy_a * sr + sy_a * sp * cr, sy_a * cp],
            [cp * sr, cp * cr, -sp],
            [-sy_a * cr + cy_a * sp * sr, sy_a * sr + cy_a * sp * cr, cy_a * cp],
        ]

        px, py, pz = [float(v) for v in obj.position]
        pixel_x_coords: List[float] = []
        pixel_y_coords: List[float] = []
        visible_in_front = False

        for lx, ly, lz in local_corners:
            wx = R[0][0] * lx + R[0][1] * ly + R[0][2] * lz + px
            wy = R[1][0] * lx + R[1][1] * ly + R[1][2] * lz + py
            wz = R[2][0] * lx + R[2][1] * ly + R[2][2] * lz + pz

            dx, dy, dz = wx - cx, wy - cy, wz - cz

            # Camera space coordinates
            cam_x = rx * dx + ry * dy + rz * dz
            cam_y = ux * dx + uy * dy + uz * dz
            cam_z = -(fx * dx + fy * dy + fz * dz)  # OpenGL convention: forward is -Z

            if cam_z < -0.05:  # Point is in front of camera
                visible_in_front = True
                ndc_x = cam_x / (-cam_z * tan_half_h)
                ndc_y = cam_y / (-cam_z * tan_half_v)

                px_x = ((ndc_x + 1.0) / 2.0) * width
                px_y = ((1.0 - ndc_y) / 2.0) * height
                pixel_x_coords.append(px_x)
                pixel_y_coords.append(px_y)

        if not visible_in_front or not pixel_x_coords:
            continue

        raw_x1 = max(0.0, min(pixel_x_coords))
        raw_x2 = min(float(width), max(pixel_x_coords))
        raw_y1 = max(0.0, min(pixel_y_coords))
        raw_y2 = min(float(height), max(pixel_y_coords))

        # Discard bounding boxes smaller than 16px or completely outside frame
        if (raw_x2 - raw_x1) < 16.0 or (raw_y2 - raw_y1) < 16.0:
            continue

        # Convert to abs_centralized [y_min, x_min, y_max, x_max]
        y_min = math.floor(raw_y1) - half_h
        x_min = math.floor(raw_x1) - half_w
        y_max = math.ceil(raw_y2) - half_h
        x_max = math.ceil(raw_x2) - half_w

        color = getattr(obj.material, "color", "#94a3b8")
        roughness = float(getattr(obj.material, "roughness", 0.5))

        items.append({
            "label": "object",
            "caption": f"A realistic {obj.name} with material color {color}, roughness {roughness:.2f}, studio quality.",
            "bbox": [int(y_min), int(x_min), int(y_max), int(x_max)],
        })

    return {
        "summary": {
            "meta": ["studio photography", "commercial shoot", "clean composition"],
            "canvas": "single",
            "caption": global_caption or "A professional studio photograph with realistic studio lighting and optical depth of field.",
        },
        "items": items,
        "bbox_coord_space": "abs_centralized",
        "bbox_format": "yxyx",
    }


def build_moss_workflow(
    layout_json: Dict[str, Any],
    seed: int = 42,
    steps: int = 50,
    cfg: float = 3.0,
    width: int = 1024,
    height: int = 1024,
    negative_prompt: str = "nsfw, worst quality, bad anatomy, watermark, jpeg artifact, blurry",
) -> Dict[str, Any]:
    """
    Constructs an API-format workflow for MOSS-Image DiT (BF16) + Qwen3.5-9B Text Encoder
    with Flow Matching Shift 5.0 and Skip Layer Guidance (Layer 22).
    """
    layout_str = json.dumps(layout_json, ensure_ascii=False)
    return {
        "1": {
            "inputs": {
                "model_path": os.environ.get("MOSS_MODEL_PATH", "/home/rukashi/Documentos/ComfyUI_windows_portable/ComfyUI/models/moss-image-sft"),
                "weight_dtype": "default",
            },
            "class_type": "MOSSImageHFDiTLoader",
            "_meta": {"title": "MOSS-Image-SFT DiT (BF16)"},
        },
        "2": {
            "inputs": {
                "clip_name": "qwen3.5_9b_int8_convrot.safetensors",
                "device": "cpu",
            },
            "class_type": "MOSSImageCLIPLoader",
            "_meta": {"title": "Qwen3.5-9B Text Encoder (INT8)"},
        },
        "3": {
            "inputs": {
                "vae_name": "flux2-vae_small.safetensors",
            },
            "class_type": "VAEDoader",
            "_meta": {"title": "Flux2 VAE"},
        },
        "4": {
            "inputs": {
                "shift": 5.0,
                "model": ["1", 0],
            },
            "class_type": "ModelSamplingSD3",
            "_meta": {"title": "Flow Matching Shift (5.0)"},
        },
        "5": {
            "inputs": {
                "double_layers": "",
                "single_layers": "22",
                "start_percent": 0.0,
                "end_percent": 1.0,
                "model": ["4", 0],
            },
            "class_type": "SkipLayerGuidanceDiTSimple",
            "_meta": {"title": "SLG Uncond Skip (Layer 22)"},
        },
        "6": {
            "inputs": {
                "text": layout_str,
                "clip": ["2", 0],
            },
            "class_type": "CLIPTextEncode",
            "_meta": {"title": "Layout Positive Prompt"},
        },
        "7": {
            "inputs": {
                "text": negative_prompt,
                "clip": ["2", 0],
            },
            "class_type": "CLIPTextEncode",
            "_meta": {"title": "Negative Prompt"},
        },
        "8": {
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1,
            },
            "class_type": "EmptyFlux2LatentImage",
            "_meta": {"title": "Empty Flux2 Latent"},
        },
        "9": {
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "sgm_uniform",
                "denoise": 1.0,
                "model": ["5", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["8", 0],
            },
            "class_type": "KSampler",
            "_meta": {"title": "KSampler (MOSS Inference)"},
        },
        "10": {
            "inputs": {
                "samples": ["9", 0],
                "vae": ["3", 0],
            },
            "class_type": "VAEDecode",
            "_meta": {"title": "VAE Decode"},
        },
        "11": {
            "inputs": {
                "filename_prefix": "Shotlab_MOSS",
                "images": ["10", 0],
            },
            "class_type": "SaveImage",
            "_meta": {"title": "Save Rendered Image"},
        },
    }


def build_qwen_workflow(
    prompt: str,
    reference_image_filename: str,
    negative_prompt: str = "blurry, out of focus, deformed geometry, lowres, cartoon, plastic skin, oversaturated, chromatic aberration, ai slop, watermark",
    seed: int = 42,
    steps: int = 25,
    denoise: float = 0.85,
) -> Dict[str, Any]:
    """
    Constructs an API-format workflow for Qwen Image 2.1 (MM-DiT) with 3D reference image splicing.
    """
    return {
        "1": {
            "inputs": {
                "unet_name": "qwen_image_2.1_int8_convrot.safetensors",
                "weight_dtype": "default",
            },
            "class_type": "UNETLoader",
            "_meta": {"title": "Qwen Image 2.1 DiT (INT8)"},
        },
        "2": {
            "inputs": {
                "clip_name": "qwen3.5_9b_qwen_image_2.1_pe_i2i.int8_convrot.safetensors",
                "type": "qwen_image",
                "device": "default",
            },
            "class_type": "CLIPLoader",
            "_meta": {"title": "Qwen 2.1 Text Encoder (PE I2I)"},
        },
        "3": {
            "inputs": {
                "vae_name": "qwen_image_2.1_vae_bf16.safetensors",
            },
            "class_type": "VAELoader",
            "_meta": {"title": "Qwen Image 2.1 VAE (64 Channels)"},
        },
        "4": {
            "inputs": {
                "lora_name": "Qwen-Image-Lightning-4steps-V1.0.safetensors",
                "strength_model": 1.0,
                "model": ["1", 0],
            },
            "class_type": "LoraLoaderModelOnly",
            "_meta": {"title": "LoRA Lightning (4-Step Fast Preview)"},
        },
        "5": {
            "inputs": {
                "lora_name": "Qwen-Edit-Relight.safetensors",
                "strength_model": 0.8,
                "model": ["4", 0],
            },
            "class_type": "LoraLoaderModelOnly",
            "_meta": {"title": "LoRA Studio Relight"},
        },
        "6": {
            "inputs": {
                "image": reference_image_filename,
            },
            "class_type": "LoadImage",
            "_meta": {"title": "Shotlab 3D Pass (Reference)"},
        },
        "7": {
            "inputs": {
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "resolution": 1024,
                "clip": ["2", 0],
                "vae": ["3", 0],
                "image_1": ["6", 0],
            },
            "class_type": "TextEncodeQwenImage21",
            "_meta": {"title": "Text & Reference Encode (Qwen Image 2.1)"},
        },
        "8": {
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": denoise,
                "model": ["5", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "latent_image": ["7", 2],
            },
            "class_type": "KSampler",
            "_meta": {"title": "KSampler (Qwen Inference)"},
        },
        "9": {
            "inputs": {
                "samples": ["8", 0],
                "vae": ["3", 0],
            },
            "class_type": "VAEDecode",
            "_meta": {"title": "VAE Decode (64 Channels)"},
        },
        "10": {
            "inputs": {
                "filename_prefix": "Shotlab_Qwen21_Render",
                "images": ["9", 0],
            },
            "class_type": "SaveImage",
            "_meta": {"title": "Save Rendered Frame"},
        },
    }


# Singleton instance for default application use
default_comfyui_client = ComfyUIClient()


# Module-level convenience functions
async def check_health(base_url: Optional[str] = None) -> Dict[str, Any]:
    client = ComfyUIClient(base_url) if base_url else default_comfyui_client
    return await client.check_health()


async def upload_image(
    image_bytes: bytes,
    filename: str,
    subfolder: str = "",
    image_type: str = "input",
    overwrite: bool = True,
    client: Optional[ComfyUIClient] = None,
) -> Dict[str, Any]:
    c = client or default_comfyui_client
    return await c.upload_image(image_bytes, filename, subfolder, image_type, overwrite)


async def queue_prompt(
    workflow_json: Dict[str, Any],
    client_id: Optional[str] = None,
    client: Optional[ComfyUIClient] = None,
) -> Dict[str, Any]:
    c = client or default_comfyui_client
    return await c.queue_prompt(workflow_json, client_id)


def stream_progress(
    client_id: str,
    prompt_id: Optional[str] = None,
    client: Optional[ComfyUIClient] = None,
    timeout: float = 120.0,
) -> AsyncGenerator[Dict[str, Any], None]:
    c = client or default_comfyui_client
    return c.stream_progress(client_id, prompt_id, timeout)
