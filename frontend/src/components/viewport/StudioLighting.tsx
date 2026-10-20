import React from 'react';
import { useStudioStore } from '../../store/useStudioStore';

export const StudioLighting: React.FC = () => {
  const lighting = useStudioStore((state) => state.lighting);

  return (
    <group>
      {/* Ambient ambient fill */}
      <ambientLight
        intensity={lighting.ambientIntensity}
        color={lighting.ambientColor}
      />

      {/* Key Light (main spotlight/directional light) */}
      <directionalLight
        position={lighting.keyLight.position}
        intensity={lighting.keyLight.intensity}
        color={lighting.keyLight.color}
        castShadow={lighting.keyLight.castShadow}
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
        position={lighting.fillLight.position}
        intensity={lighting.fillLight.intensity}
        color={lighting.fillLight.color}
      />

      {/* Rim / Hair Light (backlight for edge definition) */}
      <directionalLight
        position={lighting.rimLight.position}
        intensity={lighting.rimLight.intensity}
        color={lighting.rimLight.color}
      />
    </group>
  );
};
