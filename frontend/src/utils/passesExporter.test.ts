import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { captureScenePasses, downloadDataUrl } from './passesExporter';

describe('Passes Exporter (RGB Beauty & Normalized Depth Map)', () => {
  it('correctly captures RGB and Depth passes and restores original materials', () => {
    // 1. Build a mock Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const origMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geometry, origMaterial);
    scene.add(mesh);

    const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);

    // 2. Mock WebGLRenderer
    let renderCount = 0;
    const domElement = {
      width: 1920,
      height: 1080,
      toDataURL: vi.fn().mockImplementation((_format: string) => {
        return `data:image/png;base64,mockRenderFrame${renderCount}`;
      }),
    } as unknown as HTMLCanvasElement;

    const renderer = {
      domElement,
      render: vi.fn().mockImplementation((_s: THREE.Scene, _c: THREE.Camera) => {
        renderCount++;
      }),
    } as unknown as THREE.WebGLRenderer;

    // 3. Execute capture
    const passes = captureScenePasses(scene, camera, renderer);

    expect(passes.width).toBe(1920);
    expect(passes.height).toBe(1080);
    expect(passes.beautyDataUrl).toContain('mockRenderFrame');
    expect(passes.depthDataUrl).toContain('mockRenderFrame');

    // Verify 3 renders occurred (Beauty, Depth, Restore)
    expect(renderCount).toBe(3);

    // Verify original material was completely restored
    expect(mesh.material).toBe(origMaterial);

    // Verify background color was restored
    expect((scene.background as THREE.Color).getHexString()).toBe('ffffff');
  });

  it('triggers downloadDataUrl with anchor click when document is present', () => {
    const clickMock = vi.fn();
    const fakeAnchor = { href: '', download: '', click: clickMock } as any;
    const fakeBody = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    } as any;

    const fakeDoc = {
      createElement: vi.fn().mockReturnValue(fakeAnchor),
      body: fakeBody,
    };

    (globalThis as any).document = fakeDoc;

    downloadDataUrl('data:image/png;base64,testdata', 'test-render.png');

    expect(fakeDoc.createElement).toHaveBeenCalledWith('a');
    expect(fakeAnchor.download).toBe('test-render.png');
    expect(fakeBody.appendChild).toHaveBeenCalledWith(fakeAnchor);
    expect(clickMock).toHaveBeenCalled();
    expect(fakeBody.removeChild).toHaveBeenCalledWith(fakeAnchor);

    delete (globalThis as any).document;
  });
});
