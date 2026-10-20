import {
  ApiCamera,
  ApiObject,
  ApiSceneGraph,
  ApiValidationError,
  fromApiCamera,
  fromApiObject,
  fromApiScene,
  PhysicalValidationError,
  toApiCamera,
  toApiObject,
} from './types';
import { CameraSettings, SceneGraph, SceneObject } from '../types/scene';

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: any;
    try {
      errorData = await res.json();
    } catch {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    if (errorData?.detail && typeof errorData.detail === 'object' && errorData.detail.code) {
      throw new PhysicalValidationError(errorData.detail as ApiValidationError);
    }

    const message =
      typeof errorData?.detail === 'string'
        ? errorData.detail
        : JSON.stringify(errorData?.detail || errorData);
    throw new Error(message || `API Error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const sceneApi = {
  async getScenes(): Promise<SceneGraph[]> {
    const res = await fetch(`${API_BASE_URL}/v1/scenes`);
    const apiScenes = await handleResponse<ApiSceneGraph[]>(res);
    return apiScenes.map(fromApiScene);
  },

  async getScene(sceneId: string = 'scene-default'): Promise<SceneGraph> {
    const res = await fetch(`${API_BASE_URL}/v1/scenes/${encodeURIComponent(sceneId)}`);
    const apiScene = await handleResponse<ApiSceneGraph>(res);
    return fromApiScene(apiScene);
  },

  async createScene(name: string = 'Nova Sessão'): Promise<SceneGraph> {
    const res = await fetch(`${API_BASE_URL}/v1/scenes?name=${encodeURIComponent(name)}`, {
      method: 'POST',
    });
    const apiScene = await handleResponse<ApiSceneGraph>(res);
    return fromApiScene(apiScene);
  },

  async addObject(sceneId: string, obj: SceneObject): Promise<SceneObject> {
    const apiPayload = toApiObject(obj);
    const res = await fetch(`${API_BASE_URL}/v1/scenes/${encodeURIComponent(sceneId)}/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });
    const apiObj = await handleResponse<ApiObject>(res);
    return fromApiObject(apiObj);
  },

  async patchObject(
    sceneId: string,
    objectId: string,
    patch: Partial<SceneObject>
  ): Promise<SceneObject> {
    const patchPayload: Record<string, any> = {};
    if (patch.name !== undefined) patchPayload.name = patch.name;
    if (patch.position !== undefined) patchPayload.position = patch.position;
    if (patch.rotation !== undefined) patchPayload.rotation = patch.rotation;
    if (patch.scale !== undefined) patchPayload.scale = patch.scale;
    if (patch.material !== undefined) patchPayload.material = patch.material;
    if (patch.visible !== undefined) patchPayload.visible = patch.visible;

    const res = await fetch(
      `${API_BASE_URL}/v1/scenes/${encodeURIComponent(sceneId)}/objects/${encodeURIComponent(objectId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      }
    );
    const apiObj = await handleResponse<ApiObject>(res);
    return fromApiObject(apiObj);
  },

  async deleteObject(sceneId: string, objectId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE_URL}/v1/scenes/${encodeURIComponent(sceneId)}/objects/${encodeURIComponent(objectId)}`,
      {
        method: 'DELETE',
      }
    );
    await handleResponse<{ status: string; object_id: string }>(res);
  },

  async updateCamera(sceneId: string, camera: CameraSettings): Promise<CameraSettings> {
    const apiPayload = toApiCamera(camera);
    const res = await fetch(`${API_BASE_URL}/v1/scenes/${encodeURIComponent(sceneId)}/camera`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });
    const apiCam = await handleResponse<ApiCamera>(res);
    return fromApiCamera(apiCam);
  },

  async validateScene(sceneId: string): Promise<{
    status: string;
    scene_id: string;
    objects_count: number;
    floor_contact: string;
    collisions: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/v1/scenes/${encodeURIComponent(sceneId)}/validate`, {
      method: 'POST',
    });
    return handleResponse(res);
  },
};
