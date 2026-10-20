import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useStudioStore } from '../../store/useStudioStore';

export const StudioLighting: React.FC = () => {
  const lighting = useStudioStore((state) => state.lighting);
  const activeView = useStudioStore((state) => state.activeView);

  const ambientIntensity = lighting?.ambientIntensity ?? 0.35;
  const ambientColor = lighting?.ambientColor ?? '#ffffff';

  const keyLight = lighting?.keyLight ?? {
    position: [2.5, 3.0, 2.5] as [number, number, number],
    intensity: 1.6,
    color: '#fffbf0',
    castShadow: true,
  };

  const fillLight = lighting?.fillLight ?? {
    position: [-2.5, 2.0, 2.0] as [number, number, number],
    intensity: 0.7,
    color: '#e8f0fe',
  };

  const rimLight = lighting?.rimLight ?? {
    position: [0.0, 2.8, -2.5] as [number, number, number],
    intensity: 1.2,
    color: '#ffffff',
  };

  const keyPosition = keyLight.position ?? [2.5, 3.0, 2.5];
  const fillPosition = fillLight.position ?? [-2.5, 2.0, 2.0];
  const rimPosition = rimLight.position ?? [0.0, 2.8, -2.5];

  const studioTarget = useMemo(() => new THREE.Vector3(0, 0.9, 0), []);

  // Compute rotation Eulers towards subject center [0, 0.9, 0]
  const keyRotation = useMemo(() => {
    const mat = new THREE.Matrix4();
    mat.lookAt(new THREE.Vector3(...keyPosition), studioTarget, new THREE.Vector3(0, 1, 0));
    return new THREE.Euler().setFromRotationMatrix(mat);
  }, [keyPosition, studioTarget]);

  const fillRotation = useMemo(() => {
    const mat = new THREE.Matrix4();
    mat.lookAt(new THREE.Vector3(...fillPosition), studioTarget, new THREE.Vector3(0, 1, 0));
    return new THREE.Euler().setFromRotationMatrix(mat);
  }, [fillPosition, studioTarget]);

  const rimRotation = useMemo(() => {
    const mat = new THREE.Matrix4();
    mat.lookAt(new THREE.Vector3(...rimPosition), studioTarget, new THREE.Vector3(0, 1, 0));
    return new THREE.Euler().setFromRotationMatrix(mat);
  }, [rimPosition, studioTarget]);

  // Key light guide line to studio target
  const keyTargetLineGeom = useMemo(() => {
    const pts = [new THREE.Vector3(...keyPosition), studioTarget];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [keyPosition, studioTarget]);

  return (
    <group>
      {/* Ambient ambient fill */}
      <ambientLight
        intensity={ambientIntensity}
        color={ambientColor}
      />

      {/* Key Light (main spotlight/directional light) */}
      <directionalLight
        position={keyPosition}
        intensity={keyLight.intensity ?? 1.6}
        color={keyLight.color ?? '#fffbf0'}
        castShadow={keyLight.castShadow ?? true}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0001}
      />

      {/* Fill Light (softer, cool light to fill shadows) */}
      <directionalLight
        position={fillPosition}
        intensity={fillLight.intensity ?? 0.7}
        color={fillLight.color ?? '#e8f0fe'}
      />

      {/* Rim / Hair Light (backlight for edge definition) */}
      <directionalLight
        position={rimPosition}
        intensity={rimLight.intensity ?? 1.2}
        color={rimLight.color ?? '#ffffff'}
      />

      {/* Physical 3D Studio Modifiers - Only in Editor View */}
      {activeView === 'editor' && (
        <group>
          {/* ========================================================= */}
          {/* 1. KEY LIGHT: Softbox 80×120cm */}
          {/* ========================================================= */}
          <group position={keyPosition}>
            {/* Stand / C-Stand C-Bar to ground */}
            <mesh position={[0, -keyPosition[1] / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, keyPosition[1], 12]} />
              <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Base C-Stand legs on floor */}
            <mesh position={[0, -keyPosition[1] + 0.02, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.04, 3]} />
              <meshStandardMaterial color="#18181b" metalness={0.7} roughness={0.4} />
            </mesh>

            {/* Rotated Softbox Assembly pointing to target */}
            <group rotation={keyRotation}>
              {/* Softbox Outer Shell (Black Nylon/Metal) */}
              <mesh position={[0, 0, 0.16]}>
                <boxGeometry args={[0.8, 1.2, 0.32]} />
                <meshStandardMaterial color="#18181b" metalness={0.3} roughness={0.8} />
              </mesh>
              {/* Softbox Inner / Rim Frame */}
              <mesh position={[0, 0, 0.01]}>
                <boxGeometry args={[0.82, 1.22, 0.02]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Diffuser Screen (Emissive face towards target in -Z) */}
              <mesh position={[0, 0, 0.0]}>
                <planeGeometry args={[0.78, 1.18]} />
                <meshStandardMaterial
                  color={keyLight.color ?? '#fffbf0'}
                  emissive={keyLight.color ?? '#fffbf0'}
                  emissiveIntensity={0.85}
                  roughness={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Back Mount Ring / Speedring */}
              <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.06, 16]} />
                <meshStandardMaterial color="#3f3f46" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          </group>

          {/* Key Light Aiming Guide Line */}
          <lineSegments geometry={keyTargetLineGeom}>
            <lineBasicMaterial color={keyLight.color ?? '#fffbf0'} opacity={0.35} transparent />
          </lineSegments>

          {/* ========================================================= */}
          {/* 2. FILL LIGHT: Octabox 120cm */}
          {/* ========================================================= */}
          <group position={fillPosition}>
            {/* Stand / C-Stand C-Bar to ground */}
            <mesh position={[0, -fillPosition[1] / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, fillPosition[1], 12]} />
              <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Base C-Stand legs on floor */}
            <mesh position={[0, -fillPosition[1] + 0.02, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.04, 3]} />
              <meshStandardMaterial color="#18181b" metalness={0.7} roughness={0.4} />
            </mesh>

            {/* Rotated Octabox Assembly pointing to target */}
            <group rotation={fillRotation}>
              {/* Octagonal body (8-sided cone/cylinder) */}
              <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.6, 0.4, 0.28, 8]} />
                <meshStandardMaterial color="#18181b" metalness={0.3} roughness={0.8} />
              </mesh>
              {/* Diffuser Screen (Emissive 8-sided disc facing target) */}
              <mesh position={[0, 0, 0.0]}>
                <circleGeometry args={[0.58, 8]} />
                <meshStandardMaterial
                  color={fillLight.color ?? '#e8f0fe'}
                  emissive={fillLight.color ?? '#e8f0fe'}
                  emissiveIntensity={0.75}
                  roughness={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Back Mount Ring */}
              <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
                <meshStandardMaterial color="#3f3f46" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          </group>

          {/* ========================================================= */}
          {/* 3. RIM LIGHT: Stripbox 30×140cm */}
          {/* ========================================================= */}
          <group position={rimPosition}>
            {/* Stand / C-Stand C-Bar to ground */}
            <mesh position={[0, -rimPosition[1] / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, rimPosition[1], 12]} />
              <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Base legs */}
            <mesh position={[0, -rimPosition[1] + 0.02, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.04, 3]} />
              <meshStandardMaterial color="#18181b" metalness={0.7} roughness={0.4} />
            </mesh>

            {/* Rotated Stripbox Assembly pointing to target */}
            <group rotation={rimRotation}>
              {/* Stripbox Outer Shell */}
              <mesh position={[0, 0, 0.12]}>
                <boxGeometry args={[0.3, 1.4, 0.24]} />
                <meshStandardMaterial color="#18181b" metalness={0.3} roughness={0.8} />
              </mesh>
              {/* Diffuser Screen (Emissive vertical strip facing target) */}
              <mesh position={[0, 0, 0.0]}>
                <planeGeometry args={[0.28, 1.38]} />
                <meshStandardMaterial
                  color={rimLight.color ?? '#ffffff'}
                  emissive={rimLight.color ?? '#ffffff'}
                  emissiveIntensity={0.85}
                  roughness={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Back Mount */}
              <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
                <meshStandardMaterial color="#3f3f46" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          </group>
        </group>
      )}
    </group>
  );
};
