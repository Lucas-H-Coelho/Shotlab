import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useStudioStore } from '../../store/useStudioStore';
import { calculateVerticalFov } from '../../types/scene';

export const CameraHelperVisualizer: React.FC = () => {
  const cameraSettings = useStudioStore((state) => state.camera);
  const activeView = useStudioStore((state) => state.activeView);

  // Only show when in editor mode
  if (activeView === 'camera') return null;

  const { position, target, focalLengthMm, sensorHeightMm, focusDistanceM } = cameraSettings;
  const fov = calculateVerticalFov(focalLengthMm, sensorHeightMm);

  // Calculate direction and frustum points
  const camPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const tgtPos = useMemo(() => new THREE.Vector3(...target), [target]);

  // Construct camera frustum wireframe
  const frustumLines = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(tgtPos, camPos).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const dist = Math.min(focusDistanceM, 3.5);
    const halfFovRad = ((fov / 2) * Math.PI) / 180;
    const halfHeight = Math.tan(halfFovRad) * dist;
    const halfWidth = halfHeight * cameraSettings.aspectRatio;

    const planeCenter = camPos.clone().add(dir.clone().multiplyScalar(dist));

    const tl = planeCenter.clone().add(realUp.clone().multiplyScalar(halfHeight)).sub(right.clone().multiplyScalar(halfWidth));
    const tr = planeCenter.clone().add(realUp.clone().multiplyScalar(halfHeight)).add(right.clone().multiplyScalar(halfWidth));
    const br = planeCenter.clone().sub(realUp.clone().multiplyScalar(halfHeight)).add(right.clone().multiplyScalar(halfWidth));
    const bl = planeCenter.clone().sub(realUp.clone().multiplyScalar(halfHeight)).sub(right.clone().multiplyScalar(halfWidth));

    const points = [
      // Rays from camera to 4 corners
      camPos, tl,
      camPos, tr,
      camPos, br,
      camPos, bl,
      // Rectangle at focus distance
      tl, tr,
      tr, br,
      br, bl,
      bl, tl,
    ];

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return geom;
  }, [camPos, tgtPos, focalLengthMm, sensorHeightMm, focusDistanceM, fov, cameraSettings.aspectRatio]);

  return (
    <group>
      {/* Camera Body Icon / Box */}
      <mesh position={position}>
        <boxGeometry args={[0.2, 0.15, 0.25]} />
        <meshStandardMaterial color="#f43f5e" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Camera Lens */}
      <mesh position={[position[0], position[1], position[2] - 0.12]}>
        <cylinderGeometry args={[0.07, 0.08, 0.14, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Frustum wireframe */}
      <lineSegments geometry={frustumLines}>
        <lineBasicMaterial color="#f43f5e" opacity={0.65} transparent />
      </lineSegments>

      {/* Target Marker */}
      <mesh position={target}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color="#38bdf8" wireframe />
      </mesh>
    </group>
  );
};
