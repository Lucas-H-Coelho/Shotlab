import os
import asyncio
import concurrent.futures
from typing import Optional, Dict, Any
import httpx

DEFAULT_API_URL = os.environ.get("SHOTLAB_API_URL", "http://localhost:8000")

_client_transport: Optional[httpx.AsyncBaseTransport] = None


def set_client_transport(transport: Optional[httpx.AsyncBaseTransport]) -> None:
    """Sets an in-memory ASGI transport (e.g., ASGITransport for testing)."""
    global _client_transport
    _client_transport = transport


def get_client_transport() -> Optional[httpx.AsyncBaseTransport]:
    """Returns the current ASGI transport if configured."""
    return _client_transport


def run_sync(coro):
    """
    Safely executes an async coroutine synchronously,
    handling existing event loops gracefully.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(asyncio.run, coro)
            return future.result()
    return asyncio.run(coro)


class ShotlabClient:
    """
    REST API client for Shotlab /v1 endpoints.
    Uses httpx.AsyncClient internally and executes sync wrappers for CLI integration.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        timeout: float = 60.0,
    ):
        base = api_url or os.environ.get("SHOTLAB_API_URL", DEFAULT_API_URL)
        self.api_url = base.rstrip("/")
        self.transport = transport if transport is not None else _client_transport
        self.timeout = timeout

    def _get_async_client(self) -> httpx.AsyncClient:
        if self.transport is not None:
            return httpx.AsyncClient(
                transport=self.transport,
                base_url=self.api_url,
                timeout=self.timeout,
            )
        return httpx.AsyncClient(
            base_url=self.api_url,
            timeout=self.timeout,
        )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        url = f"{self.api_url}{path}"
        async with self._get_async_client() as client:
            return await client.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
            )

    # ---------------- Scene Operations ----------------

    def list_scenes(self) -> httpx.Response:
        return run_sync(self._request("GET", "/v1/scenes"))

    def get_scene(self, scene_id: str) -> httpx.Response:
        return run_sync(self._request("GET", f"/v1/scenes/{scene_id}"))

    def create_scene(self, name: str = "Nova Sessão Fotográfica") -> httpx.Response:
        return run_sync(self._request("POST", "/v1/scenes", params={"name": name}))

    # ---------------- Object Operations ----------------

    def add_object(self, scene_id: str, obj_data: Dict[str, Any]) -> httpx.Response:
        return run_sync(self._request("POST", f"/v1/scenes/{scene_id}/objects", json_data=obj_data))

    def move_object(self, scene_id: str, object_id: str, position: list[float]) -> httpx.Response:
        return run_sync(
            self._request(
                "PATCH",
                f"/v1/scenes/{scene_id}/objects/{object_id}",
                json_data={"position": position},
            )
        )

    def delete_object(self, scene_id: str, object_id: str) -> httpx.Response:
        return run_sync(self._request("DELETE", f"/v1/scenes/{scene_id}/objects/{object_id}"))

    # ---------------- Camera Operations ----------------

    def set_camera(self, scene_id: str, camera_data: Dict[str, Any]) -> httpx.Response:
        return run_sync(self._request("PUT", f"/v1/scenes/{scene_id}/camera", json_data=camera_data))

    # ---------------- Optics Operations ----------------

    def compute_optics(self, optics_data: Dict[str, Any]) -> httpx.Response:
        return run_sync(self._request("POST", "/v1/optics/compute", json_data=optics_data))

    # ---------------- Render Operations ----------------

    def create_render_job(self, scene_id: str, render_data: Dict[str, Any]) -> httpx.Response:
        return run_sync(self._request("POST", f"/v1/scenes/{scene_id}/render", json_data=render_data))

    def get_job_status(self, job_id: str) -> httpx.Response:
        return run_sync(self._request("GET", f"/v1/jobs/{job_id}"))
