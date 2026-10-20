import React from 'react';
import { useStudioStore } from '../../store/useStudioStore';

export const StudioLighting: React.FC = () => {
  const lighting = useStudioStore((state) => state.lighting);

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
    </group>
  );
};
