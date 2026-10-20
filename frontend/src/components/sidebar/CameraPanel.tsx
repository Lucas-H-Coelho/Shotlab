import React, { useState } from 'react';
import { Camera, Focus, Sliders, Compass, Sun, Sparkles, Aperture } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useTranslation } from '../../i18n';
import { SetPlanModal } from '../modals/SetPlanModal';
import {
  SENSOR_PRESETS,
  calculateCircleOfConfusionMm,
  calculateVerticalFovDeg,
  calculateHorizontalFovDeg,
  calculateDiagonalFovDeg,
  calculateDepthOfFieldM,
} from '../../utils/optics';

export function parseShutterSpeedSeconds(shutter: string | number | undefined): number {
  if (typeof shutter === 'number') return shutter > 0 ? shutter : 1 / 250;
  if (!shutter) return 1 / 250;
  const match = shutter.match(/1\/(\d+)/);
  if (match) {
    const denom = parseFloat(match[1]);
    return denom > 0 ? 1 / denom : 1 / 250;
  }
  const val = parseFloat(shutter);
  return isNaN(val) || val <= 0 ? 1 / 250 : val;
}

export function kelvinToHex(kelvin: number): string {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const KELVIN_PRESETS = [
  { label: '3200K', desc: 'Tungsten', kelvin: 3200, hex: '#ffac54' },
  { label: '4500K', desc: 'Neutral', kelvin: 4500, hex: '#ffd6aa' },
  { label: '5600K', desc: 'Daylight', kelvin: 5600, hex: '#ffede0' },
  { label: '6500K', desc: 'Overcast', kelvin: 6500, hex: '#fffbf8' },
];

export const CameraPanel: React.FC = () => {
  const camera = useStudioStore((state) => state.camera);
  const updateCamera = useStudioStore((state) => state.updateCamera);
  const lighting = useStudioStore((state) => state.lighting);
  const updateLighting = useStudioStore((state) => state.updateLighting);
  const { t } = useTranslation();

  const [isSetPlanOpen, setIsSetPlanOpen] = useState(false);

  // Exposure Triangle settings
  const isoPresets = [50, 100, 200, 400, 800, 1600, 3200, 6400];
  const shutterPresets = [
    '1/8000s',
    '1/2000s',
    '1/1000s',
    '1/500s',
    '1/250s',
    '1/125s',
    '1/60s',
    '1/48s (180°)',
  ];

  const currentIso = camera.iso ?? 100;
  const currentShutter = camera.shutterSpeed ?? '1/250';
  const shutterSec = parseShutterSpeedSeconds(currentShutter);
  const ev100 = Math.log2((camera.fStop * camera.fStop) / shutterSec);

  // Optical realism settings
  const currentSensorFit = camera.sensorFit ?? 'AUTO';
  const currentShiftX = camera.shiftX ?? 0;
  const currentShiftY = camera.shiftY ?? 0;
  const currentBlades = camera.apertureBlades ?? 9;
  const currentSqueeze = camera.anamorphicSqueeze ?? 1.0;
  const currentHalation = camera.halation ?? 0.15;
  const currentChromaticAberration = camera.chromaticAberration ?? 0.05;
  const currentVignetting = camera.vignetting ?? 0.20;
  const currentFilmGrain = camera.filmGrain ?? 0.10;

  const focalPresets = [
    { label: '24mm', value: 24, desc: t.camera.presets.wide },
    { label: '35mm', value: 35, desc: t.camera.presets.report },
    { label: '50mm', value: 50, desc: t.camera.presets.normal },
    { label: '85mm', value: 85, desc: t.camera.presets.portrait },
    { label: '105mm', value: 105, desc: t.camera.presets.macro },
    { label: '135mm', value: 135, desc: t.camera.presets.telephoto },
  ];

  const fStopPresets = [1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11, 16];
  const sensorPresets = Object.values(SENSOR_PRESETS);

  const aspectRatios = [
    { label: '3:2', value: 3 / 2, desc: t.camera.presets.fullFrame },
    { label: '1:1', value: 1, desc: t.camera.presets.square },
    { label: '16:9', value: 16 / 9, desc: t.camera.presets.widescreen },
    { label: '4:5', value: 4 / 5, desc: t.camera.presets.editorial },
    { label: '9:16', value: 9 / 16, desc: t.camera.presets.vertical },
  ];

  const cocMm = calculateCircleOfConfusionMm(camera.sensorWidthMm, camera.sensorHeightMm);
  const vFov = calculateVerticalFovDeg(camera.focalLengthMm, camera.sensorHeightMm).toFixed(1);
  const hFov = calculateHorizontalFovDeg(camera.focalLengthMm, camera.sensorWidthMm).toFixed(1);
  const dFov = calculateDiagonalFovDeg(camera.focalLengthMm, camera.sensorWidthMm, camera.sensorHeightMm).toFixed(1);
  const dof = calculateDepthOfFieldM(camera.focalLengthMm, camera.fStop, camera.focusDistanceM, cocMm);
  const hyperfocalM = dof.hyperfocalM.toFixed(2);
  const nearLimitM = dof.nearLimitM.toFixed(2);
  const farLimitDisplay = dof.isHyperfocal || !Number.isFinite(dof.farLimitM) ? t.camera.infinite : `${dof.farLimitM.toFixed(2)} m`;
  const totalDofDisplay = dof.isHyperfocal || !Number.isFinite(dof.totalDofM) ? t.camera.infinite : `${dof.totalDofM.toFixed(2)} m`;

  return (
    <div className="flex flex-col space-y-4 text-xs p-3.5 text-secondary-text overflow-y-auto">
      {/* Set Plan 2D Trigger Button (PRO FEATURE HIGHLIGHT) */}
      <button
        onClick={() => setIsSetPlanOpen(true)}
        className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-sm bg-optic/15 border border-optic text-optic font-mono text-[11px] font-semibold hover:bg-optic/25 transition-all shadow-sm active:scale-[0.99]"
      >
        <Compass className="w-4 h-4 text-optic" />
        <span>{t.camera.openSetPlan}</span>
      </button>

      {/* Section Header */}
      <div className="flex items-center space-x-2 border-b border-hairline pb-2.5">
        <Camera className="w-3.5 h-3.5 text-optic" />
        <h2 className="font-semibold text-primary-text tracking-wider text-[10px] uppercase font-mono">
          {t.camera.title}
        </h2>
      </div>

      {/* Exposure Triangle Section (ISO, Shutter, EV100) */}
      <div className="bg-surface rounded-sm p-2.5 border border-hairline space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[10px] text-primary-text uppercase font-mono font-semibold">
            <Sparkles className="w-3 h-3 text-optic" />
            <span>{t.camera.exposureTriangle}</span>
          </div>
          <div className="px-1.5 py-0.5 rounded-sm bg-optic/15 border border-optic text-optic font-mono text-[10px] font-bold tabular-nums">
            EV100: {ev100.toFixed(1)}
          </div>
        </div>

        {/* ISO Selector */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-muted-text uppercase">{t.camera.iso}</span>
            <span className="text-primary-text font-bold tabular-nums">ISO {currentIso}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {isoPresets.map((isoVal) => {
              const active = currentIso === isoVal;
              return (
                <button
                  key={isoVal}
                  onClick={() => updateCamera({ iso: isoVal })}
                  className={`py-1 rounded-sm text-[10px] font-mono tabular-nums border text-center transition-all ${
                    active
                      ? 'bg-optic/15 border-optic text-optic font-semibold shadow-sm'
                      : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                  }`}
                >
                  {isoVal}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shutter Speed Selector */}
        <div className="space-y-1 pt-1 border-t border-hairline">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-muted-text uppercase">{t.camera.shutter}</span>
            <span className="text-primary-text font-bold tabular-nums">{currentShutter}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {shutterPresets.map((speed) => {
              const active = currentShutter === speed;
              const shortLabel = speed.replace('s', '');
              return (
                <button
                  key={speed}
                  onClick={() => updateCamera({ shutterSpeed: speed })}
                  className={`py-1 px-1 rounded-sm text-[9px] font-mono tabular-nums border text-center truncate transition-all ${
                    active
                      ? 'bg-optic/15 border-optic text-optic font-semibold shadow-sm'
                      : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                  }`}
                  title={speed}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sensor Format Presets */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-mono tracking-wider text-primary-text font-medium block">
          {t.camera.sensorPreset}
        </label>
        <div className="grid grid-cols-2 gap-1">
          {sensorPresets.map((preset) => {
            const active =
              Math.abs(camera.sensorWidthMm - preset.widthMm) < 0.1 &&
              Math.abs(camera.sensorHeightMm - preset.heightMm) < 0.1;
            return (
              <button
                key={preset.id}
                onClick={() =>
                  updateCamera({
                    sensorWidthMm: preset.widthMm,
                    sensorHeightMm: preset.heightMm,
                    aspectRatio: preset.widthMm / preset.heightMm,
                  })
                }
                className={`px-1.5 py-1 rounded-sm text-[10px] font-mono border text-left transition-all ${
                  active
                    ? 'bg-optic/15 border-optic text-optic font-semibold shadow-sm'
                    : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                }`}
              >
                <div className="truncate font-medium">{preset.name}</div>
                <div className="text-[8px] text-muted-text tabular-nums">
                  {preset.widthMm}x{preset.heightMm}mm
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focal Length Section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <label className="font-medium text-primary-text uppercase text-[10px] tracking-wider">
            {t.camera.focalLength}
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
      <div className="bg-surface rounded-sm p-2.5 border border-hairline space-y-2">
        <div className="flex items-center space-x-1.5 text-[10px] text-muted-text uppercase font-mono tracking-wider">
          <Compass className="w-3 h-3 text-optic" />
          <span>{t.camera.realOptics}</span>
        </div>

        {/* FOV Telemetry */}
        <div className="grid grid-cols-3 gap-1 pt-0.5">
          <div className="bg-elevated p-1.5 rounded-sm border border-hairline">
            <div className="text-[8px] text-muted-text uppercase font-mono">{t.camera.vFov}</div>
            <div className="text-primary-text font-mono tabular-nums text-xs font-semibold">{vFov}°</div>
          </div>
          <div className="bg-elevated p-1.5 rounded-sm border border-hairline">
            <div className="text-[8px] text-muted-text uppercase font-mono">{t.camera.hFov}</div>
            <div className="text-primary-text font-mono tabular-nums text-xs font-semibold">{hFov}°</div>
          </div>
          <div className="bg-elevated p-1.5 rounded-sm border border-hairline">
            <div className="text-[8px] text-muted-text uppercase font-mono">FOV Diag</div>
            <div className="text-primary-text font-mono tabular-nums text-xs font-semibold">{dFov}°</div>
          </div>
        </div>

        {/* Hyperfocal & DoF Telemetry */}
        <div className="pt-1 border-t border-hairline space-y-1">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-muted-text uppercase">{t.camera.hyperfocal} (H):</span>
            <span className="text-primary-text font-semibold tabular-nums">{hyperfocalM} m</span>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <div className="bg-elevated p-1.5 rounded-sm border border-hairline">
              <div className="text-[8px] text-muted-text uppercase font-mono">{t.camera.nearLimit}</div>
              <div className="text-primary-text font-mono tabular-nums text-[11px] font-semibold">{nearLimitM} m</div>
            </div>
            <div className="bg-elevated p-1.5 rounded-sm border border-hairline">
              <div className="text-[8px] text-muted-text uppercase font-mono">{t.camera.farLimit}</div>
              <div className="text-primary-text font-mono tabular-nums text-[11px] font-semibold">{farLimitDisplay}</div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono text-muted-text pt-0.5">
            <span>{t.camera.totalDof}:</span>
            <span className="text-optic font-semibold tabular-nums">{totalDofDisplay}</span>
          </div>
          <div className="flex justify-between items-center text-[8px] font-mono text-muted-text">
            <span>{t.camera.coc}:</span>
            <span className="tabular-nums">{cocMm.toFixed(4)} mm</span>
          </div>
        </div>
      </div>

      {/* Aperture / f-Stop */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <label className="font-medium text-primary-text uppercase text-[10px] tracking-wider">
            {t.camera.aperture}
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
              {t.camera.focusDistance}
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

      {/* Section: Lens Physics & Optical Realism (Blender & ComfyUI-Optical-Realism) */}
      <div className="bg-surface rounded-sm p-2.5 border border-hairline space-y-3">
        <div className="flex items-center space-x-1.5 text-[10px] text-primary-text font-semibold uppercase tracking-wider font-mono">
          <Aperture className="w-3.5 h-3.5 text-optic" />
          <span>{t.camera.opticalRealism}</span>
        </div>

        {/* Sensor Fit Buttons */}
        <div className="space-y-1">
          <span className="text-[9px] text-muted-text font-mono uppercase block">{t.camera.sensorFit}</span>
          <div className="grid grid-cols-3 gap-1">
            {(['AUTO', 'HORIZONTAL', 'VERTICAL'] as const).map((fit) => {
              const active = currentSensorFit === fit;
              const label = fit === 'AUTO' ? t.camera.sensorFitAuto : fit === 'HORIZONTAL' ? t.camera.sensorFitHor : t.camera.sensorFitVert;
              return (
                <button
                  key={fit}
                  onClick={() => updateCamera({ sensorFit: fit })}
                  className={`py-1 rounded-sm text-[10px] font-mono border text-center transition-all ${
                    active
                      ? 'bg-optic/15 border-optic text-optic font-bold shadow-sm'
                      : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lens Shift X & Shift Y */}
        <div className="space-y-1.5 pt-1 border-t border-hairline">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-muted-text uppercase">{t.camera.lensShift}</span>
            <span className="text-primary-text tabular-nums text-[10px]">
              X: {currentShiftX > 0 ? `+${currentShiftX.toFixed(2)}` : currentShiftX.toFixed(2)} | Y: {currentShiftY > 0 ? `+${currentShiftY.toFixed(2)}` : currentShiftY.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[8px] text-muted-text uppercase font-mono block">{t.camera.shiftX}</span>
              <input
                type="range"
                min="-0.50"
                max="0.50"
                step="0.01"
                value={currentShiftX}
                onChange={(e) => updateCamera({ shiftX: Number(e.target.value) })}
                className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
              />
            </div>
            <div>
              <span className="text-[8px] text-muted-text uppercase font-mono block">{t.camera.shiftY}</span>
              <input
                type="range"
                min="-0.50"
                max="0.50"
                step="0.01"
                value={currentShiftY}
                onChange={(e) => updateCamera({ shiftY: Number(e.target.value) })}
                className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Aperture Blades (5 to 18) & Anamorphic Squeeze */}
        <div className="space-y-1.5 pt-1 border-t border-hairline">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-muted-text uppercase">{t.camera.apertureBlades}</span>
            <span className="text-primary-text font-bold tabular-nums">{currentBlades} lâminas</span>
          </div>
          <input
            type="range"
            min="5"
            max="18"
            step="1"
            value={currentBlades}
            onChange={(e) => updateCamera({ apertureBlades: Number(e.target.value) })}
            className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
          />

          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-muted-text uppercase">{t.camera.anamorphicSqueeze}</span>
              <span className="text-optic font-bold tabular-nums">{currentSqueeze.toFixed(2)}x</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[1.0, 1.33, 1.5, 2.0].map((sq) => {
                const active = Math.abs(currentSqueeze - sq) < 0.05;
                return (
                  <button
                    key={sq}
                    onClick={() => updateCamera({ anamorphicSqueeze: sq })}
                    className={`py-1 rounded-sm text-[10px] font-mono tabular-nums border text-center transition-all ${
                      active
                        ? 'bg-optic/15 border-optic text-optic font-bold shadow-sm'
                        : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                    }`}
                  >
                    {sq.toFixed(2)}x
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Optical Post-Processing Sliders */}
        <div className="space-y-2 pt-2 border-t border-hairline">
          <div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-text">{t.camera.halation}</span>
              <span className="text-primary-text tabular-nums">{(currentHalation * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={currentHalation}
              onChange={(e) => updateCamera({ halation: Number(e.target.value) })}
              className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-text">{t.camera.chromaticAberration}</span>
              <span className="text-primary-text tabular-nums">{currentChromaticAberration.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={currentChromaticAberration}
              onChange={(e) => updateCamera({ chromaticAberration: Number(e.target.value) })}
              className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-text">{t.camera.vignetting}</span>
              <span className="text-primary-text tabular-nums">{(currentVignetting * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={currentVignetting}
              onChange={(e) => updateCamera({ vignetting: Number(e.target.value) })}
              className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-text">{t.camera.filmGrain}</span>
              <span className="text-primary-text tabular-nums">{(currentFilmGrain * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={currentFilmGrain}
              onChange={(e) => updateCamera({ filmGrain: Number(e.target.value) })}
              className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Section: Studio Lighting (Key / Fill / Rim + Kelvin Integration) */}
      <div className="bg-surface rounded-sm p-2.5 border border-hairline space-y-3">
        <div className="flex items-center space-x-1.5 text-[10px] text-primary-text font-semibold uppercase tracking-wider font-mono">
          <Sun className="w-3.5 h-3.5 text-optic" />
          <span>{t.lighting.title}</span>
        </div>

        {/* Key Light */}
        <div className="space-y-1.5 p-2 rounded-sm bg-elevated border border-hairline">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="font-semibold text-primary-text uppercase">{t.lighting.keyLight}</span>
            <span className="text-optic font-bold tabular-nums">{lighting.keyLight.intensity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0"
            max="4.0"
            step="0.1"
            value={lighting.keyLight.intensity}
            onChange={(e) => updateLighting({ keyLight: { ...lighting.keyLight, intensity: Number(e.target.value) } })}
            className="w-full accent-[var(--accent-optic)] bg-surface h-1 rounded-sm cursor-pointer"
          />
          <div className="grid grid-cols-4 gap-1 pt-1">
            {KELVIN_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => updateLighting({ keyLight: { ...lighting.keyLight, color: p.hex } })}
                className="px-1 py-0.5 rounded-sm bg-surface border border-hairline text-[9px] font-mono hover:border-optic text-muted-text hover:text-primary-text truncate"
                title={`${p.label} ${p.desc}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fill Light */}
        <div className="space-y-1.5 p-2 rounded-sm bg-elevated border border-hairline">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="font-semibold text-primary-text uppercase">{t.lighting.fillLight}</span>
            <span className="text-secondary-text font-bold tabular-nums">{lighting.fillLight.intensity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0"
            max="3.0"
            step="0.1"
            value={lighting.fillLight.intensity}
            onChange={(e) => updateLighting({ fillLight: { ...lighting.fillLight, intensity: Number(e.target.value) } })}
            className="w-full accent-[var(--accent-optic)] bg-surface h-1 rounded-sm cursor-pointer"
          />
          <div className="grid grid-cols-4 gap-1 pt-1">
            {KELVIN_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => updateLighting({ fillLight: { ...lighting.fillLight, color: p.hex } })}
                className="px-1 py-0.5 rounded-sm bg-surface border border-hairline text-[9px] font-mono hover:border-optic text-muted-text hover:text-primary-text truncate"
                title={`${p.label} ${p.desc}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rim Light */}
        <div className="space-y-1.5 p-2 rounded-sm bg-elevated border border-hairline">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="font-semibold text-primary-text uppercase">{t.lighting.rimLight}</span>
            <span className="text-optic font-bold tabular-nums">{lighting.rimLight.intensity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0"
            max="3.0"
            step="0.1"
            value={lighting.rimLight.intensity}
            onChange={(e) => updateLighting({ rimLight: { ...lighting.rimLight, intensity: Number(e.target.value) } })}
            className="w-full accent-[var(--accent-optic)] bg-surface h-1 rounded-sm cursor-pointer"
          />
          <div className="grid grid-cols-4 gap-1 pt-1">
            {KELVIN_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => updateLighting({ rimLight: { ...lighting.rimLight, color: p.hex } })}
                className="px-1 py-0.5 rounded-sm bg-surface border border-hairline text-[9px] font-mono hover:border-optic text-muted-text hover:text-primary-text truncate"
                title={`${p.label} ${p.desc}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-mono tracking-wider text-primary-text font-medium block">
          {t.camera.gateMask}
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
          <span>{t.camera.position}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 font-mono tabular-nums">
          <div>
            <span className="text-[9px] text-muted-text block uppercase">{t.camera.x}</span>
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
            <span className="text-[9px] text-muted-text block uppercase">{t.camera.y}</span>
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
            <span className="text-[9px] text-muted-text block uppercase">{t.camera.z}</span>
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

      {/* SetPlanModal Portal */}
      <SetPlanModal isOpen={isSetPlanOpen} onClose={() => setIsSetPlanOpen(false)} />
    </div>
  );
};
