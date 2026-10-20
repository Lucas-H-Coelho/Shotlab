import { CameraSettings, SceneGraph, SceneObject, StudioLighting } from '../types/scene';

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

const DEFAULT_STUDIO_LIGHTING: StudioLighting = {
  ambientIntensity: 0.35,
  ambientColor: '#ffffff',
  keyLight: {
    intensity: 1.6,
    color: '#fffbf0',
    position: [2.5, 3.0, 2.5],
    castShadow: true,
  },
  fillLight: {
    intensity: 0.7,
    color: '#e8f0fe',
    position: [-2.5, 2.0, 2.0],
  },
  rimLight: {
    intensity: 1.2,
    color: '#ffffff',
    position: [0.0, 2.8, -2.5],
  },
};

export function fromApiLighting(apiLighting: any): StudioLighting {
  if (!apiLighting || typeof apiLighting !== 'object') {
    return {
      ambientIntensity: DEFAULT_STUDIO_LIGHTING.ambientIntensity,
      ambientColor: DEFAULT_STUDIO_LIGHTING.ambientColor,
      keyLight: {
        ...DEFAULT_STUDIO_LIGHTING.keyLight,
        position: [...DEFAULT_STUDIO_LIGHTING.keyLight.position],
      },
      fillLight: {
        ...DEFAULT_STUDIO_LIGHTING.fillLight,
        position: [...DEFAULT_STUDIO_LIGHTING.fillLight.position],
      },
      rimLight: {
        ...DEFAULT_STUDIO_LIGHTING.rimLight,
        position: [...DEFAULT_STUDIO_LIGHTING.rimLight.position],
      },
    };
  }

  const rawKey = apiLighting.keyLight ?? apiLighting.key_light;
  const rawFill = apiLighting.fillLight ?? apiLighting.fill_light;
  const rawRim = apiLighting.rimLight ?? apiLighting.rim_light;

  const keyPosition =
    Array.isArray(rawKey?.position) && rawKey.position.length === 3
      ? ([rawKey.position[0], rawKey.position[1], rawKey.position[2]] as [number, number, number])
      : ([...DEFAULT_STUDIO_LIGHTING.keyLight.position] as [number, number, number]);

  const fillPosition =
    Array.isArray(rawFill?.position) && rawFill.position.length === 3
      ? ([rawFill.position[0], rawFill.position[1], rawFill.position[2]] as [number, number, number])
      : ([...DEFAULT_STUDIO_LIGHTING.fillLight.position] as [number, number, number]);

  const rimPosition =
    Array.isArray(rawRim?.position) && rawRim.position.length === 3
      ? ([rawRim.position[0], rawRim.position[1], rawRim.position[2]] as [number, number, number])
      : ([...DEFAULT_STUDIO_LIGHTING.rimLight.position] as [number, number, number]);

  return {
    ambientIntensity:
      typeof (apiLighting.ambientIntensity ?? apiLighting.ambient_intensity) === 'number'
        ? (apiLighting.ambientIntensity ?? apiLighting.ambient_intensity)
        : DEFAULT_STUDIO_LIGHTING.ambientIntensity,
    ambientColor:
      (apiLighting.ambientColor ?? apiLighting.ambient_color) || DEFAULT_STUDIO_LIGHTING.ambientColor,
    keyLight: {
      intensity:
        typeof rawKey?.intensity === 'number'
          ? rawKey.intensity
          : DEFAULT_STUDIO_LIGHTING.keyLight.intensity,
      color: rawKey?.color || DEFAULT_STUDIO_LIGHTING.keyLight.color,
      position: keyPosition,
      castShadow:
        (rawKey?.castShadow ?? rawKey?.cast_shadow) !== undefined
          ? Boolean(rawKey?.castShadow ?? rawKey?.cast_shadow)
          : DEFAULT_STUDIO_LIGHTING.keyLight.castShadow,
    },
    fillLight: {
      intensity:
        typeof rawFill?.intensity === 'number'
          ? rawFill.intensity
          : DEFAULT_STUDIO_LIGHTING.fillLight.intensity,
      color: rawFill?.color || DEFAULT_STUDIO_LIGHTING.fillLight.color,
      position: fillPosition,
    },
    rimLight: {
      intensity:
        typeof rawRim?.intensity === 'number'
          ? rawRim.intensity
          : DEFAULT_STUDIO_LIGHTING.rimLight.intensity,
      color: rawRim?.color || DEFAULT_STUDIO_LIGHTING.rimLight.color,
      position: rimPosition,
    },
  };
}

export function fromApiScene(apiScene: ApiSceneGraph): SceneGraph {
  return {
    id: apiScene.id,
    name: apiScene.name,
    allowIntersections: apiScene.allow_intersections,
    camera: fromApiCamera(apiScene.camera),
    lighting: fromApiLighting(apiScene.lighting),
    objects: (apiScene.objects || []).map(fromApiObject),
  };
}
