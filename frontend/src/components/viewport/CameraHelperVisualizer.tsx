import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useStudioStore } from '../../store/useStudioStore';
import {
  calculateCircleOfConfusionMm,
  calculateVerticalFovDeg,
  calculateDepthOfFieldM,
} from '../../utils/optics';

export const CameraHelperVisualizer: React.FC = () => {
  const cameraSettings = useStudioStore((state) => state.camera);
  const activeView = useStudioStore((state) => state.activeView);

  const {
    position,
    target,
    focalLengthMm,
    sensorWidthMm = 36.0,
    sensorHeightMm = 24.0,
    fStop = 2.8,
    focusDistanceM = 2.0,
    aspectRatio = 1.5,
  } = cameraSettings;

  // Circle of confusion and optical depth of field calculations
  const cocMm = useMemo(
    () => calculateCircleOfConfusionMm(sensorWidthMm, sensorHeightMm),
    [sensorWidthMm, sensorHeightMm]
  );

  const dof = useMemo(
    () => calculateDepthOfFieldM(focalLengthMm, fStop, focusDistanceM, cocMm),
    [focalLengthMm, fStop, focusDistanceM, cocMm]
  );

  const vFovDeg = useMemo(
    () => calculateVerticalFovDeg(focalLengthMm, sensorHeightMm),
    [focalLengthMm, sensorHeightMm]
  );

  const camPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const tgtPos = useMemo(() => new THREE.Vector3(...target), [target]);

  // Spatial direction and orientation basis vectors
  const cameraVectors = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(tgtPos, camPos);
    if (dir.lengthSq() < 1e-6) {
      dir.set(0, 0, -1);
    } else {
      dir.normalize();
    }

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3();
    if (Math.abs(dir.y) > 0.99) {
      right.crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
    } else {
      right.crossVectors(dir, up).normalize();
    }
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const halfFovRad = ((vFovDeg / 2) * Math.PI) / 180;

    const getCornersAt = (d: number) => {
      const clampedDist = Math.max(0.05, d);
      const halfHeight = Math.tan(halfFovRad) * clampedDist;
      const halfWidth = halfHeight * (aspectRatio || 1.5);
      const center = camPos.clone().add(dir.clone().multiplyScalar(clampedDist));

      const tl = center.clone().add(realUp.clone().multiplyScalar(halfHeight)).sub(right.clone().multiplyScalar(halfWidth));
      const tr = center.clone().add(realUp.clone().multiplyScalar(halfHeight)).add(right.clone().multiplyScalar(halfWidth));
      const br = center.clone().sub(realUp.clone().multiplyScalar(halfHeight)).add(right.clone().multiplyScalar(halfWidth));
      const bl = center.clone().sub(realUp.clone().multiplyScalar(halfHeight)).sub(right.clone().multiplyScalar(halfWidth));

      return { center, tl, tr, br, bl, halfWidth, halfHeight };
    };

    return { dir, right, realUp, getCornersAt };
  }, [camPos, tgtPos, vFovDeg, aspectRatio]);

  // Frustum, DoF planes, crosshair and corridor geometries
  const helperGeometries = useMemo(() => {
    const { right, realUp, getCornersAt } = cameraVectors;

    const nearDist = Math.max(0.1, dof.nearLimitM);
    const focusDist = Math.max(0.15, focusDistanceM);
    const isFiniteFar = !dof.isHyperfocal && Number.isFinite(dof.farLimitM);
    const farDist = isFiniteFar ? Math.min(dof.farLimitM, 12.0) : Math.min(focusDist * 2.2, 12.0);

    const nearCorners = getCornersAt(nearDist);
    const focusCorners = getCornersAt(focusDist);
    const farCorners = getCornersAt(farDist);

    const createPlaneMeshGeom = (tl: THREE.Vector3, tr: THREE.Vector3, br: THREE.Vector3, bl: THREE.Vector3) => {
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array([
        tl.x, tl.y, tl.z,
        tr.x, tr.y, tr.z,
        br.x, br.y, br.z,
        tl.x, tl.y, tl.z,
        br.x, br.y, br.z,
        bl.x, bl.y, bl.z,
      ]);
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.computeVertexNormals();
      return geom;
    };

    const createFrameLineGeom = (tl: THREE.Vector3, tr: THREE.Vector3, br: THREE.Vector3, bl: THREE.Vector3) => {
      const pts = [tl, tr, tr, br, br, bl, bl, tl];
      return new THREE.BufferGeometry().setFromPoints(pts);
    };

    // 1. Frustum Rays: from camera origin to Far DoF (or max) corners
    const maxCorners = isFiniteFar ? farCorners : (farDist > focusDist ? farCorners : focusCorners);
    const frustumRayPoints = [
      camPos, maxCorners.tl,
      camPos, maxCorners.tr,
      camPos, maxCorners.br,
      camPos, maxCorners.bl,
    ];
    const frustumRaysGeom = new THREE.BufferGeometry().setFromPoints(frustumRayPoints);

    // 2. Near DoF Planar Geometry
    const nearMeshGeom = createPlaneMeshGeom(nearCorners.tl, nearCorners.tr, nearCorners.br, nearCorners.bl);
    const nearFrameGeom = createFrameLineGeom(nearCorners.tl, nearCorners.tr, nearCorners.br, nearCorners.bl);

    // 3. Focus Distance Planar Geometry
    const focusMeshGeom = createPlaneMeshGeom(focusCorners.tl, focusCorners.tr, focusCorners.br, focusCorners.bl);
    const focusFrameGeom = createFrameLineGeom(focusCorners.tl, focusCorners.tr, focusCorners.br, focusCorners.bl);

    // Focus Crosshair at center
    const chSize = Math.min(focusCorners.halfWidth, focusCorners.halfHeight) * 0.28;
    const chH1 = focusCorners.center.clone().sub(right.clone().multiplyScalar(chSize));
    const chH2 = focusCorners.center.clone().add(right.clone().multiplyScalar(chSize));
    const chV1 = focusCorners.center.clone().sub(realUp.clone().multiplyScalar(chSize));
    const chV2 = focusCorners.center.clone().add(realUp.clone().multiplyScalar(chSize));
    const focusCrosshairGeom = new THREE.BufferGeometry().setFromPoints([chH1, chH2, chV1, chV2]);

    // 4. Far DoF Planar Geometry (when finite)
    let farMeshGeom: THREE.BufferGeometry | null = null;
    let farFrameGeom: THREE.BufferGeometry | null = null;
    if (isFiniteFar) {
      farMeshGeom = createPlaneMeshGeom(farCorners.tl, farCorners.tr, farCorners.br, farCorners.bl);
      farFrameGeom = createFrameLineGeom(farCorners.tl, farCorners.tr, farCorners.br, farCorners.bl);
    }

    // 5. 3D Sharpness Corridor / DoF Volume
    // Connects 4 corners from Near to Far
    const corridorPoints = [
      nearCorners.tl, farCorners.tl,
      nearCorners.tr, farCorners.tr,
      nearCorners.br, farCorners.br,
      nearCorners.bl, farCorners.bl,
    ];
    const corridorGeom = new THREE.BufferGeometry().setFromPoints(corridorPoints);

    return {
      frustumRaysGeom,
      nearMeshGeom,
      nearFrameGeom,
      focusMeshGeom,
      focusFrameGeom,
      focusCrosshairGeom,
      farMeshGeom,
      farFrameGeom,
      corridorGeom,
      isFiniteFar,
    };
  }, [cameraVectors, camPos, dof, focusDistanceM]);

  // Camera orientation Euler angles towards target
  const cameraLookMatrix = useMemo(() => {
    const mat = new THREE.Matrix4();
    mat.lookAt(camPos, tgtPos, new THREE.Vector3(0, 1, 0));
    return new THREE.Euler().setFromRotationMatrix(mat);
  }, [camPos, tgtPos]);

  // Strict hook parity: early return ONLY after all useMemo hooks
  if (activeView === 'camera') return null;

  return (
    <group>
      {/* Camera Body & Lens oriented towards target */}
      <group position={position} rotation={cameraLookMatrix}>
        {/* Camera Body (Vantablack metal) */}
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[0.22, 0.16, 0.18]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Top Viewfinder / Prism */}
        <mesh position={[0, 0.1, 0.08]}>
          <boxGeometry args={[0.08, 0.05, 0.12]} />
          <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Camera Lens barrel pointing in -Z */}
        <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.075, 0.16, 24]} />
          <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Front Lens Glass element */}
        <mesh position={[0, 0, -0.141]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.06, 24]} />
          <meshStandardMaterial color="#1e2229" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>

      {/* Target Marker */}
      <mesh position={target}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#ebb32d" wireframe />
      </mesh>

      {/* Frustum Outer Wireframe Rays */}
      <lineSegments geometry={helperGeometries.frustumRaysGeom}>
        <lineBasicMaterial color="#5c616b" opacity={0.4} transparent />
      </lineSegments>

      {/* 3D Sharpness Corridor (DoF Volume Lines - Monochromatic Pewter) */}
      <lineSegments geometry={helperGeometries.corridorGeom}>
        <lineBasicMaterial color="#969ba4" opacity={0.35} transparent />
      </lineSegments>

      {/* 1. Near DoF Limit Plane (Pewter #969ba4) */}
      <mesh geometry={helperGeometries.nearMeshGeom}>
        <meshBasicMaterial
          color="#969ba4"
          opacity={0.05}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={helperGeometries.nearFrameGeom}>
        <lineBasicMaterial color="#969ba4" opacity={0.55} transparent />
      </lineSegments>

      {/* 2. Focus Distance Plane (Cine Amber #ebb32d) */}
      <mesh geometry={helperGeometries.focusMeshGeom}>
        <meshBasicMaterial
          color="#ebb32d"
          opacity={0.10}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={helperGeometries.focusFrameGeom}>
        <lineBasicMaterial color="#ebb32d" opacity={0.85} transparent />
      </lineSegments>
      {/* Focus Center Crosshair */}
      <lineSegments geometry={helperGeometries.focusCrosshairGeom}>
        <lineBasicMaterial color="#ebb32d" opacity={0.95} />
      </lineSegments>

      {/* 3. Far DoF Limit Plane (Pewter #969ba4 - when finite) */}
      {helperGeometries.isFiniteFar && helperGeometries.farMeshGeom && (
        <mesh geometry={helperGeometries.farMeshGeom}>
          <meshBasicMaterial
            color="#969ba4"
            opacity={0.05}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {helperGeometries.isFiniteFar && helperGeometries.farFrameGeom && (
        <lineSegments geometry={helperGeometries.farFrameGeom}>
          <lineBasicMaterial color="#969ba4" opacity={0.55} transparent />
        </lineSegments>
      )}
    </group>
  );
};
