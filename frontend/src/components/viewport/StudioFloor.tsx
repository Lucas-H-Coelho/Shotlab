import React from 'react';
import { Grid } from '@react-three/drei';
import { useThemeStore } from '../../store/useThemeStore';

export const StudioFloor: React.FC = () => {
  const theme = useThemeStore((state) => state.theme);

  const isDark = theme === 'dark';

  return (
    <group position={[0, 0, 0]}>
      {/* Metric Grid: 1 meter sections, 0.2m cells (Technical Machined Gunmetal) */}
      <Grid
        renderOrder={-1}
        position={[0, 0.001, 0]}
        infiniteGrid
        cellSize={0.2}
        cellThickness={0.5}
        cellColor={isDark ? '#1a1d24' : '#c8cdd4'}
        sectionSize={1.0}
        sectionThickness={1.0}
        sectionColor={isDark ? '#323846' : '#9ca3af'}
        fadeDistance={25}
        fadeStrength={1.2}
      />

      {/* Shadow-catching floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial opacity={isDark ? 0.45 : 0.25} />
      </mesh>
    </group>
  );
};
