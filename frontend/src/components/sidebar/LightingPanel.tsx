import React from 'react';
import { Sun, SunDim, Lightbulb } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';

export const LightingPanel: React.FC = () => {
  const lighting = useStudioStore((state) => state.lighting);
  const updateLighting = useStudioStore((state) => state.updateLighting);

  return (
    <div className="flex flex-col space-y-5 text-sm p-4 text-gray-300">
      <div className="flex items-center space-x-2 border-b border-[#212634] pb-3">
        <Sun className="w-4 h-4 text-amber-400" />
        <h2 className="font-semibold text-white tracking-wide text-xs uppercase">
          Iluminação do Estúdio (3 Pontos)
        </h2>
      </div>

      {/* Key Light */}
      <div className="bg-[#141822] p-3 rounded-lg border border-[#222736] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-white">Luz Principal (Key Light)</span>
          </div>
          <span className="font-mono text-amber-400 font-semibold">{lighting.keyLight.intensity.toFixed(1)}</span>
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
          className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
        />

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-gray-400">Temperatura / Cor</span>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={lighting.keyLight.color}
              onChange={(e) =>
                updateLighting({
                  keyLight: { ...lighting.keyLight, color: e.target.value },
                })
              }
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
            <span className="font-mono text-[11px] text-gray-400">{lighting.keyLight.color}</span>
          </div>
        </div>
      </div>

      {/* Fill Light */}
      <div className="bg-[#141822] p-3 rounded-lg border border-[#222736] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <SunDim className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold text-white">Luz de Preenchimento (Fill)</span>
          </div>
          <span className="font-mono text-sky-400 font-semibold">{lighting.fillLight.intensity.toFixed(1)}</span>
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
          className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
        />

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-gray-400">Temperatura / Cor</span>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={lighting.fillLight.color}
              onChange={(e) =>
                updateLighting({
                  fillLight: { ...lighting.fillLight, color: e.target.value },
                })
              }
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
            <span className="font-mono text-[11px] text-gray-400">{lighting.fillLight.color}</span>
          </div>
        </div>
      </div>

      {/* Rim Light */}
      <div className="bg-[#141822] p-3 rounded-lg border border-[#222736] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-white">Luz de Recorte (Rim / Contra)</span>
          </div>
          <span className="font-mono text-purple-400 font-semibold">{lighting.rimLight.intensity.toFixed(1)}</span>
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
          className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
        />
      </div>

      {/* Ambient Light */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-300 font-medium">Luz Ambiente Geral</span>
          <span className="font-mono text-gray-400">{lighting.ambientIntensity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.05"
          max="1.0"
          step="0.05"
          value={lighting.ambientIntensity}
          onChange={(e) => updateLighting({ ambientIntensity: Number(e.target.value) })}
          className="w-full accent-gray-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
};
