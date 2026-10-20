import { create } from 'zustand';
import { CameraSettings, ObjectType, SceneGraph, SceneObject, StudioLighting, TransformMode } from '../types/scene';
import { sceneApi } from '../api/client';
import { sceneWsService, WebSocketStatus, SceneEvent } from '../api/websocket';
import { fromApiCamera, fromApiObject, fromApiScene, PhysicalValidationError } from '../api/types';

export interface ApiErrorInfo {
  code?: string;
  detail: string;
  objectId?: string;
}

interface StudioState {
  sceneId: string;
  sceneName: string;
  objects: SceneObject[];
  selectedObjectId: string | null;
  camera: CameraSettings;
  lighting: StudioLighting;
  transformMode: TransformMode;
  activeView: 'editor' | 'camera';
  snapToGrid: boolean;
  comfyUrl: string;
  isRendering: boolean;
  renderStatusText: string;

  // Real-time API & WS state
  wsStatus: WebSocketStatus;
  apiError: ApiErrorInfo | null;
  clearApiError: () => void;
  initializeScene: (sceneId?: string) => Promise<void>;

  // Remote Event Handlers (Called by WebSocket without echo)
  applyRemoteObjectUpdate: (obj: SceneObject) => void;
  applyRemoteObjectAdd: (obj: SceneObject) => void;
  applyRemoteObjectDelete: (objectId: string) => void;
  applyRemoteCameraUpdate: (cam: CameraSettings) => void;
  applyRemoteSceneUpdate: (scene: SceneGraph) => void;

  // Actions
  selectObject: (id: string | null) => void;
  addObject: (type: ObjectType) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  setTransformMode: (mode: TransformMode) => void;
  updateCamera: (updates: Partial<CameraSettings>) => void;
  updateLighting: (updates: Partial<StudioLighting>) => void;
  setActiveView: (view: 'editor' | 'camera') => void;
  setSnapToGrid: (snap: boolean) => void;
  setComfyUrl: (url: string) => void;
  setRendering: (rendering: boolean, status?: string) => void;
  loadScene: (scene: SceneGraph) => void;
}

const defaultCamera: CameraSettings = {
  focalLengthMm: 85, // 85mm portrait / product standard
  sensorWidthMm: 36.0,
  sensorHeightMm: 24.0,
  fStop: 1.8,
  focusDistanceM: 2.2,
  position: [0, 1.4, 2.5], // Eye / chest level at 2.5m distance
  target: [0, 0.9, 0],    // Focused on object / subject center
  aspectRatio: 3 / 2,
};

const defaultLighting: StudioLighting = {
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

const initialObjects: SceneObject[] = [
  // Backdrop
  {
    id: 'studio-backdrop',
    name: 'Fundo Infinito (Cyc)',
    type: 'backdrop',
    position: [0, 0, -1.8],
    rotation: [0, 0, 0],
    scale: [6.0, 3.5, 2.5],
    material: {
      color: '#dbe0e8',
      roughness: 0.85,
      metalness: 0.05,
    },
    visible: true,
    locked: true,
  },
  // Pedestal / Table
  {
    id: 'product-pedestal',
    name: 'Bancada / Pedestal',
    type: 'cylinder',
    position: [0, 0.4, 0],
    rotation: [0, 0, 0],
    scale: [0.8, 0.8, 0.8],
    material: {
      color: '#2a2f3a',
      roughness: 0.4,
      metalness: 0.2,
    },
    visible: true,
  },
  // Sample Product (Box / Bottle stand-in)
  {
    id: 'hero-product',
    name: 'Objeto Principal (Hero)',
    type: 'box',
    position: [0, 1.05, 0],
    rotation: [0, 0.35, 0],
    scale: [0.25, 0.5, 0.25],
    material: {
      color: '#e11d48',
      roughness: 0.2,
      metalness: 0.8,
    },
    visible: true,
  },
];

let cameraDebounceTimer: any = null;
let wsSubscribed = false;

export const useStudioStore = create<StudioState>((set, get) => ({
  sceneId: 'scene-default',
  sceneName: 'Sessão Fotográfica 01',
  objects: initialObjects,
  selectedObjectId: 'hero-product',
  camera: defaultCamera,
  lighting: defaultLighting,
  transformMode: 'translate',
  activeView: 'editor',
  snapToGrid: false,
  comfyUrl: 'http://localhost:8188',
  isRendering: false,
  renderStatusText: '',
  wsStatus: 'disconnected',
  apiError: null,

  clearApiError: () => set({ apiError: null }),

  initializeScene: async (sceneId = 'scene-default') => {
    set({ sceneId });

    // 1. Subscribe to WebSocket events if not already subscribed
    if (!wsSubscribed) {
      wsSubscribed = true;
      sceneWsService.subscribeStatus((status) => {
        set({ wsStatus: status });
      });

      sceneWsService.subscribe((event: SceneEvent) => {
        const state = get();
        switch (event.type) {
          case 'OBJECT_UPDATED':
            state.applyRemoteObjectUpdate(fromApiObject(event.data));
            break;
          case 'OBJECT_ADDED':
            state.applyRemoteObjectAdd(fromApiObject(event.data));
            break;
          case 'OBJECT_DELETED':
            state.applyRemoteObjectDelete(event.object_id);
            break;
          case 'CAMERA_UPDATED':
            state.applyRemoteCameraUpdate(fromApiCamera(event.data));
            break;
          case 'SCENE_UPDATED':
            state.applyRemoteSceneUpdate(fromApiScene(event.data));
            break;
        }
      });
    }

    // Connect WebSocket
    sceneWsService.connect(sceneId);

    // 2. Fetch remote scene from API
    try {
      const remoteScene = await sceneApi.getScene(sceneId);
      get().loadScene(remoteScene);
    } catch (err: any) {
      console.warn('[StudioStore] Could not load scene from API, using local default:', err);
    }
  },

  applyRemoteObjectUpdate: (remoteObj) =>
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === remoteObj.id ? { ...obj, ...remoteObj } : obj)),
    })),

  applyRemoteObjectAdd: (remoteObj) =>
    set((state) => {
      if (state.objects.some((o) => o.id === remoteObj.id)) {
        return state;
      }
      return {
        objects: [...state.objects, remoteObj],
      };
    }),

  applyRemoteObjectDelete: (objectId) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== objectId),
      selectedObjectId: state.selectedObjectId === objectId ? null : state.selectedObjectId,
    })),

  applyRemoteCameraUpdate: (remoteCam) =>
    set((state) => ({
      camera: { ...state.camera, ...remoteCam },
    })),

  applyRemoteSceneUpdate: (remoteScene) =>
    set({
      sceneId: remoteScene.id,
      sceneName: remoteScene.name,
      camera: remoteScene.camera,
      lighting: remoteScene.lighting || get().lighting,
      objects: remoteScene.objects,
    }),

  selectObject: (id) => set({ selectedObjectId: id }),

  addObject: (type) => {
    const state = get();
    const id = `obj-${Date.now()}`;
    let name = 'Novo Objeto';
    let scale: [number, number, number] = [0.5, 0.5, 0.5];
    let position: [number, number, number] = [0, 0.25, 0];
    let color = '#94a3b8';

    switch (type) {
      case 'box':
        name = `Cubo ${state.objects.length + 1}`;
        position = [0, 0.25, 0];
        scale = [0.5, 0.5, 0.5];
        color = '#38bdf8';
        break;
      case 'cylinder':
        name = `Cilindro ${state.objects.length + 1}`;
        position = [0, 0.4, 0];
        scale = [0.6, 0.8, 0.6];
        color = '#a855f7';
        break;
      case 'sphere':
        name = `Esfera ${state.objects.length + 1}`;
        position = [0, 0.3, 0];
        scale = [0.6, 0.6, 0.6];
        color = '#f59e0b';
        break;
      case 'table':
        name = `Mesa / Bancada ${state.objects.length + 1}`;
        position = [0, 0.45, 0];
        scale = [1.2, 0.9, 0.8];
        color = '#78716c';
        break;
      default:
        name = `Item ${state.objects.length + 1}`;
    }

    const newObject: SceneObject = {
      id,
      name,
      type,
      position,
      rotation: [0, 0, 0],
      scale,
      material: {
        color,
        roughness: 0.5,
        metalness: 0.1,
      },
      visible: true,
    };

    // 1. Optimistic update
    set({
      objects: [...state.objects, newObject],
      selectedObjectId: id,
      apiError: null,
    });

    // 2. Sync to API in background
    sceneApi.addObject(state.sceneId, newObject).catch((err) => {
      console.error('[StudioStore] Failed to add object to API:', err);
      // Rollback on failure
      set((s) => ({
        objects: s.objects.filter((o) => o.id !== id),
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
        apiError: {
          code: err instanceof PhysicalValidationError ? err.code : 'ADD_OBJECT_ERROR',
          detail: err.message,
          objectId: id,
        },
      }));
    });
  },

  updateObject: (id, updates) => {
    const state = get();
    const oldObj = state.objects.find((o) => o.id === id);
    if (!oldObj) return;

    // 1. Optimistic update
    set({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)),
      apiError: null,
    });

    // 2. Sync to API in background
    sceneApi.patchObject(state.sceneId, id, updates).catch((err) => {
      console.error('[StudioStore] Failed to update object in API:', err);
      // Rollback to previous state on validation error
      set((s) => ({
        objects: s.objects.map((o) => (o.id === id ? oldObj : o)),
        apiError: {
          code: err instanceof PhysicalValidationError ? err.code : 'PHYSICAL_VALIDATION_ERROR',
          detail: err.message,
          objectId: id,
        },
      }));
    });
  },

  removeObject: (id) => {
    const state = get();
    const oldObj = state.objects.find((o) => o.id === id);
    if (!oldObj) return;

    // 1. Optimistic update
    set({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      apiError: null,
    });

    // 2. Sync to API
    sceneApi.deleteObject(state.sceneId, id).catch((err) => {
      console.error('[StudioStore] Failed to delete object in API:', err);
      // Rollback
      set((s) => ({
        objects: [...s.objects, oldObj],
        apiError: {
          code: err instanceof PhysicalValidationError ? err.code : 'DELETE_OBJECT_ERROR',
          detail: err.message,
          objectId: id,
        },
      }));
    });
  },

  duplicateObject: (id) => {
    const state = get();
    const source = state.objects.find((o) => o.id === id);
    if (!source) return;

    const newObj: SceneObject = {
      ...source,
      id: `obj-${Date.now()}`,
      name: `${source.name} (Cópia)`,
      position: [source.position[0] + 0.3, source.position[1], source.position[2] + 0.3],
    };

    set({
      objects: [...state.objects, newObj],
      selectedObjectId: newObj.id,
      apiError: null,
    });

    sceneApi.addObject(state.sceneId, newObj).catch((err) => {
      console.error('[StudioStore] Failed to add duplicate object:', err);
      set((s) => ({
        objects: s.objects.filter((o) => o.id !== newObj.id),
        selectedObjectId: s.selectedObjectId === newObj.id ? null : s.selectedObjectId,
        apiError: {
          code: err instanceof PhysicalValidationError ? err.code : 'DUPLICATE_ERROR',
          detail: err.message,
          objectId: newObj.id,
        },
      }));
    });
  },

  setTransformMode: (mode) => set({ transformMode: mode }),

  updateCamera: (updates) => {
    const oldCamera = get().camera;
    const newCamera = { ...oldCamera, ...updates };

    // 1. Optimistic update
    set({ camera: newCamera, apiError: null });

    // 2. Debounced sync to API (120ms)
    if (cameraDebounceTimer) {
      clearTimeout(cameraDebounceTimer);
    }

    cameraDebounceTimer = setTimeout(() => {
      sceneApi.updateCamera(get().sceneId, newCamera).catch((err) => {
        console.error('[StudioStore] Failed to sync camera to API:', err);
        set({
          camera: oldCamera,
          apiError: {
            code: 'CAMERA_UPDATE_ERROR',
            detail: err.message,
          },
        });
      });
    }, 120);
  },

  updateLighting: (updates) =>
    set((state) => ({
      lighting: { ...state.lighting, ...updates },
    })),

  setActiveView: (view) => set({ activeView: view }),

  setSnapToGrid: (snap) => set({ snapToGrid: snap }),

  setComfyUrl: (url) => set({ comfyUrl: url }),

  setRendering: (rendering, status = '') =>
    set({ isRendering: rendering, renderStatusText: status }),

  loadScene: (scene) =>
    set({
      sceneId: scene.id,
      sceneName: scene.name,
      camera: scene.camera,
      lighting: scene.lighting || get().lighting,
      objects: scene.objects,
      selectedObjectId: scene.objects.length > 0 ? scene.objects[0].id : null,
    }),
}));
