import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useStudioStore } from '../../store/useStudioStore';
import { useThemeStore } from '../../store/useThemeStore';
import { StudioFloor } from './StudioFloor';
import { StudioLighting } from './StudioLighting';
import { SceneMesh } from './SceneMesh';
import { CameraHelperVisualizer } from './CameraHelperVisualizer';
import { TransformGizmo } from './TransformGizmo';
import { ViewfinderHUD } from './ViewfinderHUD';
import { calculateVerticalFov } from '../../types/scene';

const ThreeContextBridge: React.FC<{ onContext: (ctx: { scene: any; camera: any; renderer: any }) => void }> = ({ onContext }) => {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    onContext({ scene, camera, renderer: gl });
  }, [scene, camera, gl, onContext]);
  return null;
};

export const Viewport: React.FC = () => {
  const objects = useStudioStore((state) => state.objects);
  const activeView = useStudioStore((state) => state.activeView);
  const cameraSettings = useStudioStore((state) => state.camera);
  const selectObject = useStudioStore((state) => state.selectObject);
  const theme = useThemeStore((state) => state.theme);

  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const [threeCtx, setThreeCtx] = useState<{ scene: any; camera: any; renderer: any } | null>(null);
  const orbitRef = useRef<any>(null);

  const handleContext = useCallback((ctx: { scene: any; camera: any; renderer: any }) => {
    setThreeCtx(ctx);
  }, []);

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
        <ThreeContextBridge onContext={handleContext} />
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

      {/* ARRI / Leica Viewfinder HUD, Safe Frames & Composition Guides */}
      <ViewfinderHUD getThreeContext={() => threeCtx} />
    </div>
  );
};
