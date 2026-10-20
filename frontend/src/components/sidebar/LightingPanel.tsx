import React from 'react';
import { Sun, SunDim, Lightbulb } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';

export const LightingPanel: React.FC = () => {
  const lighting = useStudioStore((state) => state.lighting);
  const updateLighting = useStudioStore((state) => state.updateLighting);

  return (
    <div className="flex flex-col space-y-4 text-xs p-3.5 text-secondary-text">
      <div className="flex items-center space-x-2 border-b border-hairline pb-2.5">
        <Sun className="w-3.5 h-3.5 text-optic" />
        <h2 className="font-semibold text-primary-text tracking-wider text-[10px] uppercase font-mono">
          Iluminação do Estúdio (3 Pontos)
        </h2>
      </div>

      {/* Key Light */}
      <div className="bg-surface p-2.5 rounded-sm border border-hairline space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <Sun className="w-3 h-3 text-optic" />
            <span className="font-semibold text-primary-text text-[11px]">Luz Principal (Key Light)</span>
          </div>
          <span className="font-mono tabular-nums text-optic font-semibold">{lighting.keyLight.intensity.toFixed(1)}</span>
        </div>

        <input
          type="range"
          min="0"
          max="4.0"
          step="0.1"
          value={lighting.keyLight.intensity}
          onChange={(e) =>
            updateLighting({
              keyLight: { ...lighting.keyLight, intensity: Number(e.target.value) },
            })
          }
          className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
        />

        <div className="flex items-center justify-between text-[11px] pt-0.5">
          <span className="text-muted-text font-mono">Temperatura</span>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={lighting.keyLight.color}
              onChange={(e) =>
                updateLighting({
                  keyLight: { ...lighting.keyLight, color: e.target.value },
                })
              }
              className="w-5 h-5 rounded-sm cursor-pointer bg-transparent border-0"
            />
            <span className="font-mono text-[10px] text-primary-text uppercase">{lighting.keyLight.color}</span>
          </div>
        </div>
      </div>

      {/* Fill Light */}
      <div className="bg-surface p-2.5 rounded-sm border border-hairline space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <SunDim className="w-3 h-3 text-secondary-text" />
            <span className="font-semibold text-primary-text text-[11px]">Luz de Preenchimento (Fill)</span>
          </div>
          <span className="font-mono tabular-nums text-secondary-text font-semibold">{lighting.fillLight.intensity.toFixed(1)}</span>
        </div>

        <input
          type="range"
          min="0"
          max="3.0"
          step="0.1"
          value={lighting.fillLight.intensity}
          onChange={(e) =>
            updateLighting({
              fillLight: { ...lighting.fillLight, intensity: Number(e.target.value) },
            })
          }
          className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
        />

        <div className="flex items-center justify-between text-[11px] pt-0.5">
          <span className="text-muted-text font-mono">Temperatura</span>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={lighting.fillLight.color}
              onChange={(e) =>
                updateLighting({
                  fillLight: { ...lighting.fillLight, color: e.target.value },
                })
              }
              className="w-5 h-5 rounded-sm cursor-pointer bg-transparent border-0"
            />
            <span className="font-mono text-[10px] text-primary-text uppercase">{lighting.fillLight.color}</span>
          </div>
        </div>
      </div>

      {/* Rim Light */}
      <div className="bg-surface p-2.5 rounded-sm border border-hairline space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <Lightbulb className="w-3 h-3 text-optic" />
            <span className="font-semibold text-primary-text text-[11px]">Luz de Recorte (Rim / Hair)</span>
          </div>
          <span className="font-mono tabular-nums text-optic font-semibold">{lighting.rimLight.intensity.toFixed(1)}</span>
        </div>

        <input
          type="range"
          min="0"
          max="3.0"
          step="0.1"
          value={lighting.rimLight.intensity}
          onChange={(e) =>
            updateLighting({
              rimLight: { ...lighting.rimLight, intensity: Number(e.target.value) },
            })
          }
          className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
        />
      </div>

      {/* Ambient Light */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-secondary-text font-mono text-[10px] uppercase">Luz Ambiente Geral</span>
          <span className="font-mono tabular-nums text-muted-text">{lighting.ambientIntensity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.05"
          max="1.0"
          step="0.05"
          value={lighting.ambientIntensity}
          onChange={(e) => updateLighting({ ambientIntensity: Number(e.target.value) })}
          className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
        />
      </div>
    </div>
  );
};
