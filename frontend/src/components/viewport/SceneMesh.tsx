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
      case 'backdrop':
        // Seamless curved cyclorama / studio backdrop
        return (
          <group>
            {/* Vertical back wall */}
            <mesh position={[0, 1.5, 0]} receiveShadow>
              <planeGeometry args={[object.scale[0], 3]} />
              <meshStandardMaterial
                color={object.material.color}
                roughness={object.material.roughness}
                metalness={object.material.metalness}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Curved base connecting wall to floor */}
            <mesh position={[0, 0.4, 0.4]} rotation={[0, 0, 0]} receiveShadow>
              <cylinderGeometry
                args={[0.8, 0.8, object.scale[0], 32, 1, true, 0, Math.PI / 2]}
              />
              <meshStandardMaterial
                color={object.material.color}
                roughness={object.material.roughness}
                metalness={object.material.metalness}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  if (!object.visible) return null;

  return (
    <group
      ref={meshRef}
      name={object.id}
      position={object.position}
      rotation={object.rotation}
      scale={object.type === 'table' ? [1, 1, 1] : object.scale}
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
          <lineBasicMaterial color="#38bdf8" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
};
