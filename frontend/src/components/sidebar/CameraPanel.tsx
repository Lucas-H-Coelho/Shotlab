import React from 'react';
import { Camera, Focus, Sliders, Info } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { calculateHorizontalFov, calculateVerticalFov } from '../../types/scene';

export const CameraPanel: React.FC = () => {
  const camera = useStudioStore((state) => state.camera);
  const updateCamera = useStudioStore((state) => state.updateCamera);

  const focalPresets = [
    { label: '24mm', value: 24, desc: 'Grande Angular' },
    { label: '35mm', value: 35, desc: 'Reportagem' },
    { label: '50mm', value: 50, desc: 'Normal (1:1)' },
    { label: '85mm', value: 85, desc: 'Retrato / Hero' },
    { label: '105mm', value: 105, desc: 'Macro' },
    { label: '135mm', value: 135, desc: 'Telefoto' },
  ];

  const fStopPresets = [1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11, 16];

  const aspectRatios = [
    { label: '3:2', value: 3 / 2, desc: 'Full Frame' },
    { label: '1:1', value: 1, desc: 'Quadrado' },
    { label: '16:9', value: 16 / 9, desc: 'Widescreen' },
    { label: '4:5', value: 4 / 5, desc: 'Instagram Feed' },
    { label: '9:16', value: 9 / 16, desc: 'Vertical / Story' },
  ];

  const vFov = calculateVerticalFov(camera.focalLengthMm, camera.sensorHeightMm).toFixed(1);
  const hFov = calculateHorizontalFov(camera.focalLengthMm, camera.sensorWidthMm).toFixed(1);

  return (
    <div className="flex flex-col space-y-5 text-sm p-4 text-gray-300">
      <div className="flex items-center space-x-2 border-b border-[#212634] pb-3">
        <Camera className="w-4 h-4 text-rose-400" />
        <h2 className="font-semibold text-white tracking-wide text-xs uppercase">
          Óptica & Câmera Virtual
        </h2>
      </div>

      {/* Focal Length Section */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <label className="font-medium text-gray-200">Distância Focal</label>
          <span className="font-mono text-sky-400 font-semibold">{camera.focalLengthMm} mm</span>
        </div>

        <input
          type="range"
          min="18"
          max="200"
          step="1"
          value={camera.focalLengthMm}
          onChange={(e) => updateCamera({ focalLengthMm: Number(e.target.value) })}
          className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
        />

        {/* Focal Presets */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {focalPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => updateCamera({ focalLengthMm: preset.value })}
              className={`px-2 py-1.5 rounded text-[11px] font-medium border text-center transition-all ${
                camera.focalLengthMm === preset.value
                  ? 'bg-rose-950/80 border-rose-600 text-rose-300 shadow-sm'
                  : 'bg-[#161a25] border-[#252b3b] text-gray-400 hover:text-gray-200 hover:bg-[#1c2230]'
              }`}
            >
              <div className="font-bold">{preset.label}</div>
              <div className="text-[9px] opacity-70 truncate">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Optical Math Calculated Card */}
      <div className="bg-[#141822] rounded-lg p-3 border border-[#222736] space-y-1.5">
        <div className="flex items-center space-x-1.5 text-xs text-gray-400">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-medium">Geometria Óptica Real</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
          <div className="bg-[#0e1118] p-2 rounded border border-[#1b202c]">
            <div className="text-[10px] text-gray-500 uppercase">FOV Vertical</div>
            <div className="text-white font-semibold">{vFov}°</div>
          </div>
          <div className="bg-[#0e1118] p-2 rounded border border-[#1b202c]">
            <div className="text-[10px] text-gray-500 uppercase">FOV Horizontal</div>
            <div className="text-white font-semibold">{hFov}°</div>
          </div>
        </div>
      </div>

      {/* Aperture / f-Stop */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <label className="font-medium text-gray-200">Abertura do Diafragma</label>
          <span className="font-mono text-rose-400 font-semibold">f / {camera.fStop}</span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {fStopPresets.map((stop) => (
            <button
              key={stop}
              onClick={() => updateCamera({ fStop: stop })}
              className={`py-1 rounded text-xs font-mono font-medium border transition-colors ${
                camera.fStop === stop
                  ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                  : 'bg-[#161a25] border-[#252b3b] text-gray-400 hover:text-gray-200'
              }`}
            >
              f/{stop}
            </button>
          ))}
        </div>
      </div>

      {/* Focus Distance */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center space-x-1.5">
            <Focus className="w-3.5 h-3.5 text-sky-400" />
            <label className="font-medium text-gray-200">Distância de Foco</label>
          </div>
          <span className="font-mono text-sky-400 font-semibold">{camera.focusDistanceM.toFixed(2)} m</span>
        </div>

        <input
          type="range"
          min="0.5"
          max="8.0"
          step="0.05"
          value={camera.focusDistanceM}
          onChange={(e) => updateCamera({ focusDistanceM: Number(e.target.value) })}
          className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
        />
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-200">Proporção do Sensor (Aspect)</label>
        <div className="grid grid-cols-3 gap-1.5">
          {aspectRatios.map((ratio) => (
            <button
              key={ratio.label}
              onClick={() => updateCamera({ aspectRatio: ratio.value })}
              className={`px-2 py-1.5 rounded text-xs border text-center transition-colors ${
                Math.abs(camera.aspectRatio - ratio.value) < 0.01
                  ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                  : 'bg-[#161a25] border-[#252b3b] text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="font-semibold">{ratio.label}</div>
              <div className="text-[9px] opacity-70 truncate">{ratio.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Camera Position (Height, Distance) */}
      <div className="space-y-3 pt-2 border-t border-[#212634]">
        <div className="flex items-center space-x-1.5 text-xs text-gray-300 font-medium">
          <Sliders className="w-3.5 h-3.5 text-gray-400" />
          <span>Posicionamento da Câmera (Metros)</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div>
            <span className="text-[10px] text-gray-500 block">X (Lateral)</span>
            <input
              type="number"
              step="0.1"
              value={camera.position[0]}
              onChange={(e) =>
                updateCamera({
                  position: [Number(e.target.value), camera.position[1], camera.position[2]],
                })
              }
              className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 block">Y (Altura)</span>
            <input
              type="number"
              step="0.1"
              value={camera.position[1]}
              onChange={(e) =>
                updateCamera({
                  position: [camera.position[0], Number(e.target.value), camera.position[2]],
                })
              }
              className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 block">Z (Distância)</span>
            <input
              type="number"
              step="0.1"
              value={camera.position[2]}
              onChange={(e) =>
                updateCamera({
                  position: [camera.position[0], camera.position[1], Number(e.target.value)],
                })
              }
              className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
