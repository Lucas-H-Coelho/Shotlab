import { create } from 'zustand';
import { CameraSettings, ObjectType, SceneGraph, SceneObject, StudioLighting, TransformMode } from '../types/scene';

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

export const useStudioStore = create<StudioState>((set) => ({
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

  selectObject: (id) => set({ selectedObjectId: id }),

  addObject: (type) =>
    set((state) => {
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

      return {
        objects: [...state.objects, newObject],
        selectedObjectId: id,
      };
    }),

  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)),
    })),

  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    })),

  duplicateObject: (id) =>
    set((state) => {
      const source = state.objects.find((o) => o.id === id);
      if (!source) return state;

      const newObj: SceneObject = {
        ...source,
        id: `obj-${Date.now()}`,
        name: `${source.name} (Cópia)`,
        position: [source.position[0] + 0.3, source.position[1], source.position[2] + 0.3],
      };

      return {
        objects: [...state.objects, newObj],
        selectedObjectId: newObj.id,
      };
    }),

  setTransformMode: (mode) => set({ transformMode: mode }),

  updateCamera: (updates) =>
    set((state) => ({
      camera: { ...state.camera, ...updates },
    })),

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
      lighting: scene.lighting,
      objects: scene.objects,
      selectedObjectId: scene.objects.length > 0 ? scene.objects[0].id : null,
    }),
}));
