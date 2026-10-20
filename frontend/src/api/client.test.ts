import { describe, it, expect } from 'vitest';
import {
  fromApiCamera,
  toApiCamera,
  fromApiObject,
  toApiObject,
  fromApiScene,
  fromApiLighting,
  PhysicalValidationError,
  ApiSceneGraph,
} from './types';
import { useStudioStore } from '../store/useStudioStore';

describe('Frontend API-First Client & Data Converters', () => {
  it('correctly maps CameraSettings to and from ApiCamera format', () => {
    const frontendCam = {
      focalLengthMm: 50.0,
      sensorWidthMm: 36.0,
      sensorHeightMm: 24.0,
      fStop: 2.8,
      focusDistanceM: 2.5,
      position: [0.0, 1.65, 3.0] as [number, number, number],
      target: [0.0, 1.0, 0.0] as [number, number, number],
      aspectRatio: 1.5,
    };

    const apiCam = toApiCamera(frontendCam);
    expect(apiCam.focal_length_mm).toBe(50.0);
    expect(apiCam.sensor_width_mm).toBe(36.0);
    expect(apiCam.sensor_height_mm).toBe(24.0);
    expect(apiCam.f_stop).toBe(2.8);
    expect(apiCam.focus_distance_m).toBe(2.5);

    const roundtrip = fromApiCamera(apiCam);
    expect(roundtrip).toEqual(frontendCam);
  });

  it('correctly maps SceneObject to and from ApiObject format', () => {
    const frontendObj = {
      id: 'test-pedestal',
      name: 'Pedestal de Teste',
      type: 'cylinder' as const,
      position: [0.0, 0.4, 0.0] as [number, number, number],
      rotation: [0.0, 0.0, 0.0] as [number, number, number],
      scale: [0.8, 0.8, 0.8] as [number, number, number],
      material: { color: '#ffffff', roughness: 0.5, metalness: 0.1 },
      visible: true,
      locked: false,
    };

    const apiObj = toApiObject(frontendObj);
    expect(apiObj.id).toBe('test-pedestal');
    expect(apiObj.name).toBe('Pedestal de Teste');
    expect(apiObj.type).toBe('cylinder');

    const roundtrip = fromApiObject(apiObj);
    expect(roundtrip).toEqual(frontendObj);
  });

  it('creates PhysicalValidationError with structured error codes', () => {
    const errorDetails = {
      code: 'FLOOR_PENETRATION',
      detail: "Object 'test-box' penetrates floor: base Y is -0.300m (minimum 0.000m)",
      object_id: 'test-box',
      penetration_m: 0.3,
    };

    const err = new PhysicalValidationError(errorDetails);
    expect(err.name).toBe('PhysicalValidationError');
    expect(err.code).toBe('FLOOR_PENETRATION');
    expect(err.objectId).toBe('test-box');
    expect(err.message).toContain('penetrates floor');
  });

  it('applies remote WebSocket events without local mutation loop', () => {
    const store = useStudioStore.getState();

    // 1. Test remote object update
    store.applyRemoteObjectUpdate({
      id: 'hero-product',
      name: 'Hero Remote Renamed',
      type: 'box',
      position: [1.0, 1.05, 0.0],
      rotation: [0, 0, 0],
      scale: [0.25, 0.5, 0.25],
      material: { color: '#ff0000', roughness: 0.5, metalness: 0.1 },
      visible: true,
    });

    const updatedHero = useStudioStore.getState().objects.find((o) => o.id === 'hero-product');
    expect(updatedHero?.name).toBe('Hero Remote Renamed');
    expect(updatedHero?.position).toEqual([1.0, 1.05, 0.0]);

    // 2. Test remote camera update
    store.applyRemoteCameraUpdate({
      focalLengthMm: 35.0,
      sensorWidthMm: 36.0,
      sensorHeightMm: 24.0,
      fStop: 4.0,
      focusDistanceM: 1.5,
      position: [0, 1.2, 2.0],
      target: [0, 0.8, 0],
      aspectRatio: 1.5,
    });

    const updatedCam = useStudioStore.getState().camera;
    expect(updatedCam.focalLengthMm).toBe(35.0);
    expect(updatedCam.fStop).toBe(4.0);

    // 3. Test remote object delete
    store.applyRemoteObjectDelete('hero-product');
    const heroAfterDelete = useStudioStore.getState().objects.find((o) => o.id === 'hero-product');
    expect(heroAfterDelete).toBeUndefined();
  });

  it('correctly parses full ApiSceneGraph into SceneGraph', () => {
    const apiScene: ApiSceneGraph = {
      id: 'scene-test-123',
      name: 'Sessão Especial',
      allow_intersections: false,
      camera: {
        focal_length_mm: 50.0,
        sensor_width_mm: 36.0,
        sensor_height_mm: 24.0,
        f_stop: 2.8,
        focus_distance_m: 2.0,
        position: [0, 1.5, 2.5],
        target: [0, 1.0, 0],
        aspect_ratio: 1.5,
      },
      objects: [
        {
          id: 'obj-1',
          name: 'Cubo 1',
          type: 'box',
          position: [0, 0.25, 0],
          rotation: [0, 0, 0],
          scale: [0.5, 0.5, 0.5],
        },
      ],
    };

    const scene = fromApiScene(apiScene);
    expect(scene.id).toBe('scene-test-123');
    expect(scene.name).toBe('Sessão Especial');
    expect(scene.camera.focalLengthMm).toBe(50.0);
    expect(scene.objects[0].material.color).toBe('#94a3b8');
  });

  it('converts snake_case backend lighting to camelCase StudioLighting with position defined', () => {
    const apiSceneWithSnakeLighting: ApiSceneGraph = {
      id: 'scene-default',
      name: 'Default Scene',
      allow_intersections: false,
      camera: {
        focal_length_mm: 85.0,
        sensor_width_mm: 36.0,
        sensor_height_mm: 24.0,
        f_stop: 1.8,
        focus_distance_m: 2.2,
        position: [0.0, 1.4, 2.5],
        target: [0.0, 0.9, 0.0],
        aspect_ratio: 1.5,
      },
      lighting: {
        ambient_intensity: 0.4,
        ambient_color: '#f0f0f0',
        key_light: {
          intensity: 1.8,
          color: '#fffbf0',
          position: [3.0, 3.5, 2.0],
          cast_shadow: true,
        },
        fill_light: {
          intensity: 0.8,
          color: '#e8f0fe',
          position: [-2.0, 2.2, 1.8],
          cast_shadow: false,
        },
        rim_light: {
          intensity: 1.5,
          color: '#ffffff',
          position: [0.0, 3.0, -2.0],
          cast_shadow: false,
        },
      },
      objects: [],
    };

    const scene = fromApiScene(apiSceneWithSnakeLighting);

    expect(scene.lighting).toBeDefined();
    expect(scene.lighting.ambientIntensity).toBe(0.4);
    expect(scene.lighting.ambientColor).toBe('#f0f0f0');

    // Key light
    expect(scene.lighting.keyLight).toBeDefined();
    expect(scene.lighting.keyLight.position).toEqual([3.0, 3.5, 2.0]);
    expect(scene.lighting.keyLight.intensity).toBe(1.8);
    expect(scene.lighting.keyLight.color).toBe('#fffbf0');
    expect(scene.lighting.keyLight.castShadow).toBe(true);

    // Fill light
    expect(scene.lighting.fillLight).toBeDefined();
    expect(scene.lighting.fillLight.position).toEqual([-2.0, 2.2, 1.8]);
    expect(scene.lighting.fillLight.intensity).toBe(0.8);
    expect(scene.lighting.fillLight.color).toBe('#e8f0fe');

    // Rim light
    expect(scene.lighting.rimLight).toBeDefined();
    expect(scene.lighting.rimLight.position).toEqual([0.0, 3.0, -2.0]);
    expect(scene.lighting.rimLight.intensity).toBe(1.5);
    expect(scene.lighting.rimLight.color).toBe('#ffffff');
  });

  it('provides safe defaults when lighting or subfields are undefined', () => {
    const partialLighting = fromApiLighting(undefined);
    expect(partialLighting.keyLight.position).toEqual([2.5, 3.0, 2.5]);
    expect(partialLighting.fillLight.position).toEqual([-2.5, 2.0, 2.0]);
    expect(partialLighting.rimLight.position).toEqual([0.0, 2.8, -2.5]);
    expect(partialLighting.ambientIntensity).toBe(0.35);

    const emptyObjLighting = fromApiLighting({});
    expect(emptyObjLighting.keyLight.position).toEqual([2.5, 3.0, 2.5]);
    expect(emptyObjLighting.fillLight.position).toEqual([-2.5, 2.0, 2.0]);
    expect(emptyObjLighting.rimLight.position).toEqual([0.0, 2.8, -2.5]);
  });
});
