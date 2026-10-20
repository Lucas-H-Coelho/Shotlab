import os
import httpx
from typing import Dict, Any, List, Optional

class ShotlabApiError(Exception):
    def __init__(self, message: str, status_code: int = 500, error_code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}

class ShotlabClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (
            base_url
            or os.environ.get("SHOTLAB_API")
            or "http://localhost:8000"
        ).rstrip("/")

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.request(method, url, **kwargs)
                if not res.is_success:
                    self._handle_error(res)
                return res.json()
        except httpx.ConnectError:
            raise ShotlabApiError(
                f"Could not connect to Shotlab API at {self.base_url}. Is the backend running?",
                status_code=503,
                error_code="CONNECTION_REFUSED",
            )
        except httpx.TimeoutException:
            raise ShotlabApiError(
                f"Timeout connecting to Shotlab API at {self.base_url}.",
                status_code=504,
                error_code="TIMEOUT",
            )

    def _handle_error(self, res: httpx.Response):
        status = res.status_code
        try:
            body = res.json()
        except Exception:
            body = {"detail": res.text}

        detail = body.get("detail", res.text)
        if isinstance(detail, dict):
            code = detail.get("code", "VALIDATION_ERROR")
            msg = detail.get("detail", str(detail))
            raise ShotlabApiError(msg, status_code=status, error_code=code, details=detail)
        elif isinstance(detail, list):
            raise ShotlabApiError(str(detail), status_code=status, error_code="INPUT_VALIDATION_ERROR")
        else:
            raise ShotlabApiError(str(detail), status_code=status, error_code="API_ERROR")

    # Scenes
    def list_scenes(self) -> List[Dict[str, Any]]:
        return self._request("GET", "/v1/scenes")

    def get_scene(self, scene_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/v1/scenes/{scene_id}")

    def create_scene(self, name: str = "Nova Sessão") -> Dict[str, Any]:
        return self._request("POST", f"/v1/scenes?name={name}")

    # Objects
    def add_object(self, scene_id: str, obj_payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", f"/v1/scenes/{scene_id}/objects", json=obj_payload)

    def patch_object(self, scene_id: str, object_id: str, patch_payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("PATCH", f"/v1/scenes/{scene_id}/objects/{object_id}", json=patch_payload)

    def delete_object(self, scene_id: str, object_id: str) -> Dict[str, Any]:
        return self._request("DELETE", f"/v1/scenes/{scene_id}/objects/{object_id}")

    # Camera
    def update_camera(self, scene_id: str, camera_payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("PUT", f"/v1/scenes/{scene_id}/camera", json=camera_payload)

    # Optics
    def get_optics(self, scene_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/v1/optics/scene/{scene_id}")

    def compute_optics(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", "/v1/optics/compute", json=params)

    # Render
    def create_render(self, scene_id: str, render_payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", f"/v1/scenes/{scene_id}/render", json=render_payload)

    def get_job(self, job_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/v1/jobs/{job_id}")
