import React from 'react';
import { Camera, Focus, Sliders, Compass } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { calculateHorizontalFov, calculateVerticalFov } from '../../types/scene';

export const CameraPanel: React.FC = () => {
  const camera = useStudioStore((state) => state.camera);
  const updateCamera = useStudioStore((state) => state.updateCamera);

  const focalPresets = [
    { label: '24mm', value: 24, desc: 'Grande Angular' },
    { label: '35mm', value: 35, desc: 'Reportagem' },
    { label: '50mm', value: 50, desc: 'Normal 1:1' },
    { label: '85mm', value: 85, desc: 'Retrato / Hero' },
    { label: '105mm', value: 105, desc: 'Macro' },
    { label: '135mm', value: 135, desc: 'Telefoto' },
  ];

  const fStopPresets = [1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11, 16];

  const aspectRatios = [
    { label: '3:2', value: 3 / 2, desc: 'Full Frame' },
    { label: '1:1', value: 1, desc: 'Quadrado' },
    { label: '16:9', value: 16 / 9, desc: 'Widescreen' },
    { label: '4:5', value: 4 / 5, desc: 'Editorial' },
    { label: '9:16', value: 9 / 16, desc: 'Vertical' },
  ];

  const vFov = calculateVerticalFov(camera.focalLengthMm, camera.sensorHeightMm).toFixed(1);
  const hFov = calculateHorizontalFov(camera.focalLengthMm, camera.sensorWidthMm).toFixed(1);

  return (
    <div className="flex flex-col space-y-4 text-xs p-3.5 text-secondary-text">
      {/* Section Header */}
      <div className="flex items-center space-x-2 border-b border-hairline pb-2.5">
        <Camera className="w-3.5 h-3.5 text-optic" />
        <h2 className="font-semibold text-primary-text tracking-wider text-[10px] uppercase font-mono">
          Óptica & Parâmetros de Lente
        </h2>
      </div>

      {/* Focal Length Section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <label className="font-medium text-primary-text uppercase text-[10px] tracking-wider">
            Distância Focal
          </label>
          <span className="font-mono tabular-nums text-optic font-semibold">
            {camera.focalLengthMm} mm
          </span>
        </div>

        <input
          type="range"
          min="16"
          max="200"
          step="1"
          value={camera.focalLengthMm}
          onChange={(e) => updateCamera({ focalLengthMm: Number(e.target.value) })}
          className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
        />

        {/* Prime Lens Presets */}
        <div className="grid grid-cols-3 gap-1 pt-0.5">
          {focalPresets.map((preset) => {
            const active = camera.focalLengthMm === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => updateCamera({ focalLengthMm: preset.value })}
                className={`px-1.5 py-1 rounded-sm text-[10px] font-mono border text-center transition-all ${
                  active
                    ? 'bg-optic/15 border-optic text-optic font-semibold shadow-sm'
                    : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                }`}
              >
                <div className="tabular-nums">{preset.label}</div>
                <div className="text-[8px] text-muted-text truncate">{preset.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optical Math Calculated Card */}
      <div className="bg-surface rounded-sm p-2.5 border border-hairline space-y-1.5">
        <div className="flex items-center space-x-1.5 text-[10px] text-muted-text uppercase font-mono tracking-wider">
          <Compass className="w-3 h-3 text-optic" />
          <span>Geometria Óptica Real (Full-Frame 36x24mm)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <div className="bg-elevated p-2 rounded-sm border border-hairline">
            <div className="text-[9px] text-muted-text uppercase font-mono">FOV Vertical</div>
            <div className="text-primary-text font-mono tabular-nums text-xs font-semibold">{vFov}°</div>
          </div>
          <div className="bg-elevated p-2 rounded-sm border border-hairline">
            <div className="text-[9px] text-muted-text uppercase font-mono">FOV Horizontal</div>
            <div className="text-primary-text font-mono tabular-nums text-xs font-semibold">{hFov}°</div>
          </div>
        </div>
      </div>

      {/* Aperture / f-Stop */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <label className="font-medium text-primary-text uppercase text-[10px] tracking-wider">
            Abertura do Diafragma (Aperture)
          </label>
          <span className="font-mono tabular-nums text-optic font-semibold">f / {camera.fStop}</span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {fStopPresets.map((stop) => {
            const active = camera.fStop === stop;
            return (
              <button
                key={stop}
                onClick={() => updateCamera({ fStop: stop })}
                className={`py-1 rounded-sm text-[10px] font-mono tabular-nums font-medium border transition-colors ${
                  active
                    ? 'bg-optic/15 border-optic text-optic font-semibold'
                    : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                }`}
              >
                f/{stop}
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus Distance */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center space-x-1.5">
            <Focus className="w-3 h-3 text-optic" />
            <label className="font-medium text-primary-text uppercase text-[10px] tracking-wider">
              Distância de Foco
            </label>
          </div>
          <span className="font-mono tabular-nums text-optic font-semibold">
            {camera.focusDistanceM.toFixed(2)} m
          </span>
        </div>

        <input
          type="range"
          min="0.5"
          max="8.0"
          step="0.05"
          value={camera.focusDistanceM}
          onChange={(e) => updateCamera({ focusDistanceM: Number(e.target.value) })}
          className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
        />
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-mono tracking-wider text-primary-text font-medium block">
          Proporção do Sensor (Gate Mask)
        </label>
        <div className="grid grid-cols-3 gap-1">
          {aspectRatios.map((ratio) => {
            const active = Math.abs(camera.aspectRatio - ratio.value) < 0.01;
            return (
              <button
                key={ratio.label}
                onClick={() => updateCamera({ aspectRatio: ratio.value })}
                className={`px-1.5 py-1 rounded-sm text-[10px] font-mono border text-center transition-colors ${
                  active
                    ? 'bg-elevated border-optic text-optic font-semibold'
                    : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                }`}
              >
                <div className="tabular-nums">{ratio.label}</div>
                <div className="text-[8px] text-muted-text truncate">{ratio.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Camera 3D Position */}
      <div className="space-y-2 pt-2 border-t border-hairline">
        <div className="flex items-center space-x-1.5 text-[10px] text-primary-text font-mono uppercase tracking-wider font-medium">
          <Sliders className="w-3 h-3 text-optic" />
          <span>Posição Espacial da Câmera (Metros)</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 font-mono tabular-nums">
          <div>
            <span className="text-[9px] text-muted-text block uppercase">X (Lateral)</span>
            <input
              type="number"
              step="0.1"
              value={camera.position[0]}
              onChange={(e) =>
                updateCamera({
                  position: [Number(e.target.value), camera.position[1], camera.position[2]],
                })
              }
              className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-[11px] focus:outline-none focus:border-optic"
            />
          </div>
          <div>
            <span className="text-[9px] text-muted-text block uppercase">Y (Altura)</span>
            <input
              type="number"
              step="0.1"
              value={camera.position[1]}
              onChange={(e) =>
                updateCamera({
                  position: [camera.position[0], Number(e.target.value), camera.position[2]],
                })
              }
              className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-[11px] focus:outline-none focus:border-optic"
            />
          </div>
          <div>
            <span className="text-[9px] text-muted-text block uppercase">Z (Distância)</span>
            <input
              type="number"
              step="0.1"
              value={camera.position[2]}
              onChange={(e) =>
                updateCamera({
                  position: [camera.position[0], camera.position[1], Number(e.target.value)],
                })
              }
              className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-[11px] focus:outline-none focus:border-optic"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
