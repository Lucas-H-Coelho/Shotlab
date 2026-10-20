import * as THREE from 'three';

export interface ScenePasses {
  beautyDataUrl: string;
  depthDataUrl: string;
  width: number;
  height: number;
  timestamp: string;
}

/**
 * Captures both RGB Beauty and Normalized Depth Map passes from a live Three.js scene.
 */
export function captureScenePasses(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer
): ScenePasses {
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // 1. Capture RGB Beauty Pass
  renderer.render(scene, camera);
  const beautyDataUrl = renderer.domElement.toDataURL('image/png');

  // 2. Prepare Depth Pass by swapping materials
  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const originalBackground = scene.background;

  // Set pure black background for empty void
  scene.background = new THREE.Color(0x000000);

  // High precision linear depth material
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.BasicDepthPacking,
  });

  scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      // Do not replace gizmos or helpers
      if (mesh.name.startsWith('helper') || mesh.name.startsWith('gizmo')) {
        return;
      }
      originalMaterials.set(mesh, mesh.material);
      mesh.material = depthMaterial;
    }
  });

  // Render Depth frame
  renderer.render(scene, camera);
  const depthDataUrl = renderer.domElement.toDataURL('image/png');

  // 3. Restore original scene materials and background
  originalMaterials.forEach((mat, mesh) => {
    mesh.material = mat;
  });
  scene.background = originalBackground;
  depthMaterial.dispose();

  // Re-render beauty pass to restore viewport state
  renderer.render(scene, camera);

  return {
    beautyDataUrl,
    depthDataUrl,
    width,
    height,
    timestamp,
  };
}

/**
 * Triggers a browser download of a given data URL.
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
