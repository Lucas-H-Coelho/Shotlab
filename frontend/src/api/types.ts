import { CameraSettings, SceneGraph, SceneObject } from '../types/scene';

export interface ApiCamera {
  focal_length_mm: number;
  sensor_width_mm: number;
  sensor_height_mm: number;
  f_stop: number;
  focus_distance_m: number;
  position: [number, number, number];
  target: [number, number, number];
  aspect_ratio: number;
}

export interface ApiObject {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material?: {
    color?: string;
    roughness?: number;
    metalness?: number;
    wireframe?: boolean;
    opacity?: number;
    transmission?: number;
  };
  visible?: boolean;
  locked?: boolean;
}

export interface ApiSceneGraph {
  id: string;
  name: string;
  allow_intersections: boolean;
  camera: ApiCamera;
  lighting?: any;
  objects: ApiObject[];
}

export interface ApiValidationError {
  code: string;
  detail: string;
  object_id?: string;
  other_id?: string;
  penetration_m?: number;
  actual_base_y_m?: number;
  min_allowed_y_m?: number;
  overlap_m?: [number, number, number];
}

export interface ApiErrorResponse {
  detail: string | ApiValidationError;
}

export class PhysicalValidationError extends Error {
  public code: string;
  public objectId?: string;
  public details: ApiValidationError;

  constructor(error: ApiValidationError) {
    super(error.detail || error.code);
    this.name = 'PhysicalValidationError';
    this.code = error.code;
    this.objectId = error.object_id;
    this.details = error;
  }
}

// Converters
export function fromApiCamera(apiCam: ApiCamera): CameraSettings {
  return {
    focalLengthMm: apiCam.focal_length_mm,
    sensorWidthMm: apiCam.sensor_width_mm,
    sensorHeightMm: apiCam.sensor_height_mm,
    fStop: apiCam.f_stop,
    focusDistanceM: apiCam.focus_distance_m,
    position: apiCam.position,
    target: apiCam.target,
    aspectRatio: apiCam.aspect_ratio,
  };
}

export function toApiCamera(cam: CameraSettings): ApiCamera {
  return {
    focal_length_mm: cam.focalLengthMm,
    sensor_width_mm: cam.sensorWidthMm,
    sensor_height_mm: cam.sensorHeightMm,
    f_stop: cam.fStop,
    focus_distance_m: cam.focusDistanceM,
    position: cam.position,
    target: cam.target,
    aspect_ratio: cam.aspectRatio,
  };
}

export function fromApiObject(apiObj: ApiObject): SceneObject {
  return {
    id: apiObj.id,
    name: apiObj.name,
    type: apiObj.type as any,
    position: apiObj.position,
    rotation: apiObj.rotation,
    scale: apiObj.scale,
    material: {
      color: apiObj.material?.color || '#94a3b8',
      roughness: apiObj.material?.roughness ?? 0.5,
      metalness: apiObj.material?.metalness ?? 0.1,
      ...(apiObj.material?.wireframe !== undefined && { wireframe: apiObj.material.wireframe }),
      ...(apiObj.material?.opacity !== undefined && { opacity: apiObj.material.opacity }),
    },
    visible: apiObj.visible ?? true,
    locked: apiObj.locked ?? false,
  };
}

export function toApiObject(obj: SceneObject): ApiObject {
  return {
    id: obj.id,
    name: obj.name,
    type: obj.type,
    position: obj.position,
    rotation: obj.rotation,
    scale: obj.scale,
    material: obj.material,
    visible: obj.visible,
    locked: obj.locked,
  };
}

export function fromApiScene(apiScene: ApiSceneGraph): SceneGraph {
  return {
    id: apiScene.id,
    name: apiScene.name,
    allowIntersections: apiScene.allow_intersections,
    camera: fromApiCamera(apiScene.camera),
    lighting: apiScene.lighting,
    objects: (apiScene.objects || []).map(fromApiObject),
  };
}
