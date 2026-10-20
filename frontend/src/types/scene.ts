export type TransformMode = 'translate' | 'rotate' | 'scale';

export type ObjectType = 'box' | 'cylinder' | 'sphere' | 'plane' | 'table' | 'backdrop' | 'model';

export interface MaterialProperties {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  wireframe?: boolean;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  position: [number, number, number]; // in meters (X, Y, Z) - Y is UP
  rotation: [number, number, number]; // in radians [pitch, yaw, roll]
  scale: [number, number, number];    // in meters / multiplier
  material: MaterialProperties;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
  };
  visible: boolean;
  locked?: boolean;
}

export interface CameraSettings {
  focalLengthMm: number;    // e.g. 24, 35, 50, 85, 100 mm
  sensorWidthMm: number;    // default 36.0 (Full-Frame 35mm)
  sensorHeightMm: number;   // default 24.0 (Full-Frame 35mm)
  fStop: number;            // aperture, e.g. 1.4, 1.8, 2.8, 4.0, 5.6, 8.0
  focusDistanceM: number;   // focus distance in meters
  position: [number, number, number];
  target: [number, number, number];
  aspectRatio: number;      // e.g. 16/9, 4/3, 1, 3/2, 9/16
}

export interface StudioLighting {
  ambientIntensity: number;
  ambientColor: string;
  keyLight: {
    intensity: number;
    color: string;
    position: [number, number, number];
    castShadow: boolean;
  };
  fillLight: {
    intensity: number;
    color: string;
    position: [number, number, number];
  };
  rimLight: {
    intensity: number;
    color: string;
    position: [number, number, number];
  };
}

export interface SceneGraph {
  id: string;
  name: string;
  allowIntersections?: boolean;
  camera: CameraSettings;
  lighting: StudioLighting;
  objects: SceneObject[];
}

export {
  SENSOR_PRESETS,
  calculateCircleOfConfusionMm,
  calculateVerticalFovDeg,
  calculateHorizontalFovDeg,
  calculateDiagonalFovDeg,
  calculateHyperfocalDistanceM,
  calculateDepthOfFieldM,
  calculateVerticalFov,
  calculateHorizontalFov,
} from '../utils/optics';
export type { SensorPreset, SensorPresetKey, DepthOfFieldResult } from '../utils/optics';

