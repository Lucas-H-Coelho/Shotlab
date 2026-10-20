import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useStudioStore } from '../../store/useStudioStore';
import { useThemeStore } from '../../store/useThemeStore';
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
  const theme = useThemeStore((state) => state.theme);

  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const orbitRef = useRef<any>(null);

  const verticalFov = calculateVerticalFov(
    cameraSettings.focalLengthMm,
    cameraSettings.sensorHeightMm
  );

  const backgroundColor = theme === 'dark' ? '#050506' : '#dedfe2';

  return (
    <div
      className="relative w-full h-full bg-void overflow-hidden"
      onClick={() => selectObject(null)}
    >
      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 2, 4.2], fov: 45 }}
      >
        <color attach="background" args={[backgroundColor]} />

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
      <div className="absolute top-3 left-3 flex items-center space-x-1.5 pointer-events-none font-mono">
        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-sm bg-surface/90 backdrop-blur border border-hairline text-primary-text shadow-sm tabular-nums">
          {activeView === 'camera' ? `Lente ${cameraSettings.focalLengthMm}mm • f/${cameraSettings.fStop}` : 'Perspectiva Livre (Editor)'}
        </span>
        {activeView === 'camera' && (
          <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded-sm bg-tally/20 border border-tally/60 text-tally font-semibold">
            Gate Mask 3:2
          </span>
        )}
      </div>
    </div>
  );
};
