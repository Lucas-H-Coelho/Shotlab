import React, { useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { SceneObject } from '../../types/scene';
import { useStudioStore } from '../../store/useStudioStore';

interface SceneMeshProps {
  object: SceneObject;
}

export const SceneMesh: React.FC<SceneMeshProps> = ({ object }) => {
  const meshRef = useRef<THREE.Group>(null);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const selectObject = useStudioStore((state) => state.selectObject);

  const isSelected = selectedObjectId === object.id;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectObject(object.id);
  };

  const renderGeometry = () => {
    switch (object.type) {
      case 'box':
        return <boxGeometry args={[1, 1, 1]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'plane':
        return <planeGeometry args={[1, 1]} />;
      case 'table':
        return (
          <group>
            {/* Tabletop */}
            <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.2, 0.05, 0.8]} />
              <meshStandardMaterial
                color={object.material.color}
                roughness={object.material.roughness}
                metalness={object.material.metalness}
              />
            </mesh>
            {/* 4 Legs */}
            <mesh position={[-0.52, 0.2, -0.32]} castShadow receiveShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 16]} />
              <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0.52, 0.2, -0.32]} castShadow receiveShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 16]} />
              <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[-0.52, 0.2, 0.32]} castShadow receiveShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 16]} />
              <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0.52, 0.2, 0.32]} castShadow receiveShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 16]} />
              <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        );
      case 'backdrop': {
        // Seamless studio cyclorama (back wall + floor apron) without double-scaling
        const w = object.scale[0] || 6.0;
        const h = object.scale[1] || 3.5;
        const d = object.scale[2] || 2.5;
        return (
          <group>
            {/* Vertical back wall */}
            <mesh position={[0, h / 2, 0]} receiveShadow>
              <planeGeometry args={[w, h]} />
              <meshStandardMaterial
                color="#1c2026"
                roughness={0.9}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Floor apron extending forward in +Z */}
            <mesh position={[0, 0.002, d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[w, d]} />
              <meshStandardMaterial
                color="#181b20"
                roughness={0.92}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      }
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  if (!object.visible) return null;

  const groupPosition: [number, number, number] =
    object.type === 'backdrop'
      ? [object.position[0], 0, object.position[2]]
      : object.position;

  return (
    <group
      ref={meshRef}
      name={object.id}
      position={groupPosition}
      rotation={object.rotation}
      scale={object.type === 'table' || object.type === 'backdrop' ? [1, 1, 1] : object.scale}
      onClick={handleClick}
    >
      {object.type === 'table' || object.type === 'backdrop' ? (
        renderGeometry()
      ) : (
        <mesh castShadow receiveShadow>
          {renderGeometry()}
          <meshStandardMaterial
            color={object.material.color}
            roughness={object.material.roughness}
            metalness={object.material.metalness}
            wireframe={object.material.wireframe}
          />
        </mesh>
      )}

      {/* Selected highlight wireframe bounding indicator */}
      {isSelected && !object.locked && (
        <lineSegments>
          <edgesGeometry
            args={[
              object.type === 'cylinder'
                ? new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
                : object.type === 'sphere'
                ? new THREE.SphereGeometry(0.5, 12, 12)
                : new THREE.BoxGeometry(1.04, 1.04, 1.04),
            ]}
          />
          <lineBasicMaterial color="#ebb32d" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
};
