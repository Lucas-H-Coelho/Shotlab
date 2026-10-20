import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useStudioStore } from '../../store/useStudioStore';
import { StudioFloor } from './StudioFloor';
import { StudioLighting } from './StudioLighting';
import { SceneMesh } from './SceneMesh';
import { CameraHelperVisualizer } from './CameraHelperVisualizer';
import { TransformGizmo } from './TransformGizmo';
import { calculateVerticalFov } from '../../types/scene';

export const Viewport: React.FC = () => {
  const objects = useStudioStore((state) => state.objects);
  const activeView = useStudioStore((state) => state.activeView);
  const cameraSettings = useStudioStore((state) => state.camera);
  const selectObject = useStudioStore((state) => state.selectObject);

  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const orbitRef = useRef<any>(null);

  const verticalFov = calculateVerticalFov(
    cameraSettings.focalLengthMm,
    cameraSettings.sensorHeightMm
  );

  return (
    <div
      className="relative w-full h-full bg-[#0b0e14] overflow-hidden"
      onClick={() => selectObject(null)}
    >
      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 2, 4.2], fov: 45 }}
      >
        <color attach="background" args={['#0e1117']} />

        {/* Studio Lighting Setup */}
        <StudioLighting />

        {/* Ground grid & shadow catcher */}
        <StudioFloor />

        {/* Scene Objects */}
        {objects.map((obj) => (
          <SceneMesh key={obj.id} object={obj} />
        ))}

        {/* Transform Gizmo for selected object */}
        <TransformGizmo onDraggingChange={setIsGizmoDragging} />

        {/* Camera visualizer in Editor View */}
        <CameraHelperVisualizer />

        {/* Camera View Switcher */}
        {activeView === 'camera' ? (
          <PerspectiveCamera
            makeDefault
            fov={verticalFov}
            aspect={cameraSettings.aspectRatio}
            position={cameraSettings.position}
            onUpdate={(self) => {
              self.lookAt(...cameraSettings.target);
              self.updateProjectionMatrix();
            }}
          />
        ) : (
          <OrbitControls
            ref={orbitRef}
            makeDefault
            enabled={!isGizmoDragging}
            target={cameraSettings.target}
            minDistance={0.5}
            maxDistance={30}
            maxPolarAngle={Math.PI / 2 + 0.05} // Don't flip below floor
            dampingFactor={0.08}
          />
        )}
      </Canvas>

      {/* Viewport Overlay Tag / HUD */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 pointer-events-none">
        <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md bg-slate-900/80 backdrop-blur border border-slate-800 text-sky-400">
          {activeView === 'camera' ? `Câmera (${cameraSettings.focalLengthMm}mm f/${cameraSettings.fStop})` : 'Perspectiva Livre (Editor)'}
        </span>
        {activeView === 'camera' && (
          <span className="px-2 py-1 text-xs rounded-md bg-rose-950/70 border border-rose-800/80 text-rose-300">
            Enquadramento Real 3:2
          </span>
        )}
      </div>
    </div>
  );
};
