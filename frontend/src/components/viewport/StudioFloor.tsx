import React from 'react';
import { Grid } from '@react-three/drei';

export const StudioFloor: React.FC = () => {
  return (
    <group position={[0, 0, 0]}>
      {/* Visual metric grid: 1 meter sections, 0.2m cells */}
      <Grid
        renderOrder={-1}
        position={[0, 0.001, 0]}
        infiniteGrid
        cellSize={0.2}
        cellThickness={0.6}
        cellColor="#262d3d"
        sectionSize={1.0}
        sectionThickness={1.2}
        sectionColor="#3b82f6"
        fadeDistance={30}
        fadeStrength={1.5}
      />

      {/* Shadow-catching floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
    </group>
  );
};
