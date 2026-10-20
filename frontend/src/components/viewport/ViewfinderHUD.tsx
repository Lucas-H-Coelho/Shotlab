import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import {
  calculateCircleOfConfusionMm,
  calculateVerticalFovDeg,
  calculateHorizontalFovDeg,
  calculateHyperfocalDistanceM,
  calculateDepthOfFieldM,
} from '../../utils/optics';
import { captureScenePasses, downloadDataUrl } from '../../utils/passesExporter';
import {
  Grid,
  Crosshair,
  Maximize2,
  Download,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ViewfinderHUDProps {
  getThreeContext?: () => {
    scene: any;
    camera: any;
    renderer: any;
  } | null;
}

export const ViewfinderHUD: React.FC<ViewfinderHUDProps> = ({ getThreeContext }) => {
  const activeView = useStudioStore((state) => state.activeView);
  const camera = useStudioStore((state) => state.camera);
  const viewfinder = useStudioStore((state) => state.viewfinder);
  const updateViewfinder = useStudioStore((state) => state.updateViewfinder);
  const sceneName = useStudioStore((state) => state.sceneName);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Monitor container resize to calculate frame bounding box
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Optical telemetry calculations
  const cocMm = calculateCircleOfConfusionMm(camera.sensorWidthMm, camera.sensorHeightMm);
  const vFov = calculateVerticalFovDeg(camera.focalLengthMm, camera.sensorHeightMm).toFixed(1);
  const hFov = calculateHorizontalFovDeg(camera.focalLengthMm, camera.sensorWidthMm).toFixed(1);
  const hyperfocalM = calculateHyperfocalDistanceM(camera.focalLengthMm, camera.fStop, cocMm).toFixed(2);
  const dof = calculateDepthOfFieldM(camera.focalLengthMm, camera.fStop, camera.focusDistanceM, cocMm);

  const nearLimitM = dof.nearLimitM.toFixed(2);
  const farLimitM = dof.isHyperfocal || !Number.isFinite(dof.farLimitM) ? '∞' : dof.farLimitM.toFixed(2);
  const totalDofM = dof.isHyperfocal || !Number.isFinite(dof.totalDofM) ? '∞' : `${dof.totalDofM.toFixed(2)}m`;

  // Compute Active Frame Rectangle based on Aspect Ratio
  const targetAspect = camera.aspectRatio || 1.5;
  const containerAspect = containerSize.width > 0 && containerSize.height > 0
    ? containerSize.width / containerSize.height
    : targetAspect;

  let frameWidth = containerSize.width;
  let frameHeight = containerSize.height;
  let frameLeft = 0;
  let frameTop = 0;

  if (containerAspect > targetAspect) {
    // Pillarbox: Container is wider than frame
    frameHeight = containerSize.height;
    frameWidth = frameHeight * targetAspect;
    frameLeft = (containerSize.width - frameWidth) / 2;
    frameTop = 0;
  } else {
    // Letterbox: Container is taller than frame
    frameWidth = containerSize.width;
    frameHeight = frameWidth / targetAspect;
    frameLeft = 0;
    frameTop = (containerSize.height - frameHeight) / 2;
  }

  // Handle Passes Capture
  const handleExportPasses = (passType: 'both' | 'rgb' | 'depth') => {
    if (!getThreeContext) return;
    const ctx = getThreeContext();
    if (!ctx || !ctx.scene || !ctx.camera || !ctx.renderer) {
      console.warn('Three context not ready for passes export');
      return;
    }

    setIsExporting(true);
    try {
      const passes = captureScenePasses(ctx.scene, ctx.camera, ctx.renderer);
      const prefix = `shotlab-${sceneName.toLowerCase().replace(/\s+/g, '-')}-${camera.focalLengthMm}mm`;

      if (passType === 'rgb' || passType === 'both') {
        downloadDataUrl(passes.beautyDataUrl, `${prefix}-rgb.png`);
      }
      if (passType === 'depth' || passType === 'both') {
        downloadDataUrl(passes.depthDataUrl, `${prefix}-depth.png`);
      }
    } catch (err) {
      console.error('Failed to export passes:', err);
    } finally {
      setIsExporting(false);
      setExportMenuOpen(false);
    }
  };

  const isCameraView = activeView === 'camera';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono"
    >
      {/* 1. Safe Frame (Gate Mask) - Only in Camera View */}
      {isCameraView && viewfinder.showGateMask && containerSize.width > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        >
          <defs>
            <mask id="gate-mask">
              {/* White area = visible/transparent mask */}
              <rect width="100%" height="100%" fill="white" />
              {/* Black hole = cutout frame */}
              <rect
                x={frameLeft}
                y={frameTop}
                width={frameWidth}
                height={frameHeight}
                fill="black"
              />
            </mask>
          </defs>

          {/* Darkened area outside active aspect ratio */}
          <rect
            width="100%"
            height="100%"
            fill="black"
            fillOpacity={viewfinder.gateMaskOpacity}
            mask="url(#gate-mask)"
          />

          {/* Technical Frame Line */}
          <rect
            x={frameLeft}
            y={frameTop}
            width={frameWidth}
            height={frameHeight}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth="1"
          />

          {/* Corner Tick Marks (ARRI / Leica Style) */}
          {/* Top-Left */}
          <path
            d={`M ${frameLeft} ${frameTop + 16} L ${frameLeft} ${frameTop} L ${frameLeft + 16} ${frameTop}`}
            fill="none"
            stroke="var(--accent-optic)"
            strokeWidth="1.5"
          />
          {/* Top-Right */}
          <path
            d={`M ${frameLeft + frameWidth - 16} ${frameTop} L ${frameLeft + frameWidth} ${frameTop} L ${frameLeft + frameWidth} ${frameTop + 16}`}
            fill="none"
            stroke="var(--accent-optic)"
            strokeWidth="1.5"
          />
          {/* Bottom-Left */}
          <path
            d={`M ${frameLeft} ${frameTop + frameHeight - 16} L ${frameLeft} ${frameTop + frameHeight} L ${frameLeft + 16} ${frameTop + frameHeight}`}
            fill="none"
            stroke="var(--accent-optic)"
            strokeWidth="1.5"
          />
          {/* Bottom-Right */}
          <path
            d={`M ${frameLeft + frameWidth - 16} ${frameTop + frameHeight} L ${frameLeft + frameWidth} ${frameTop + frameHeight} L ${frameLeft + frameWidth} ${frameTop + frameHeight - 16}`}
            fill="none"
            stroke="var(--accent-optic)"
            strokeWidth="1.5"
          />
        </svg>
      )}

      {/* 2. Composition Guides (Inside the Active Frame) */}
      {isCameraView && containerSize.width > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${frameLeft}px`,
            top: `${frameTop}px`,
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            zIndex: 6,
          }}
        >
          {/* Rule of Thirds (3x3 grid) */}
          {viewfinder.showRuleOfThirds && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              <div className="border-r border-b border-optic/35" />
              <div className="border-r border-b border-optic/35" />
              <div className="border-b border-optic/35" />
              <div className="border-r border-b border-optic/35" />
              <div className="border-r border-b border-optic/35" />
              <div className="border-b border-optic/35" />
              <div className="border-r border-optic/35" />
              <div className="border-r border-optic/35" />
              <div />
            </div>
          )}

          {/* Golden Ratio (Phi Grid: 38.2% and 61.8%) */}
          {viewfinder.showGoldenRatio && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[38.2%] left-0 right-0 border-t border-optic/30 border-dashed" />
              <div className="absolute top-[61.8%] left-0 right-0 border-t border-optic/30 border-dashed" />
              <div className="absolute left-[38.2%] top-0 bottom-0 border-l border-optic/30 border-dashed" />
              <div className="absolute left-[61.8%] top-0 bottom-0 border-l border-optic/30 border-dashed" />
            </div>
          )}

          {/* Center Crosshair */}
          {viewfinder.showCenterCross && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-6 h-6 flex items-center justify-center">
                <div className="absolute w-full h-[1px] bg-optic/60" />
                <div className="absolute h-full w-[1px] bg-optic/60" />
                <div className="w-1.5 h-1.5 rounded-full border border-optic/80" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Viewfinder Technical HUD Readouts */}
      {viewfinder.showHud && (
        <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none z-10 text-[10px] tabular-nums">
          {/* Top Bar Telemetry */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 bg-chassis/85 backdrop-blur px-2.5 py-1 rounded-sm border border-hairline shadow-sm">
                <span className="font-bold text-optic">
                  {camera.focalLengthMm.toFixed(1)}MM
                </span>
                <span className="text-secondary-text">•</span>
                <span className="text-primary-text font-semibold">
                  f/{camera.fStop}
                </span>
                <span className="text-secondary-text">•</span>
                <span className="text-muted-text uppercase">
                  {camera.sensorWidthMm}x{camera.sensorHeightMm}mm
                </span>
              </div>
              <div className="text-[9px] text-muted-text px-1">
                <span>V-FOV {vFov}°</span> • <span>H-FOV {hFov}°</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="bg-chassis/85 backdrop-blur px-2 py-1 rounded-sm border border-hairline text-right">
                <span className="text-muted-text text-[9px] uppercase block">Gate</span>
                <span className="font-semibold text-primary-text text-[10px]">
                  {camera.aspectRatio === 16 / 9
                    ? '16:9'
                    : camera.aspectRatio === 2.39
                    ? '2.39:1'
                    : camera.aspectRatio === 1
                    ? '1:1'
                    : camera.aspectRatio === 4 / 5
                    ? '4:5'
                    : '3:2'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Bar Telemetry */}
          <div className="flex justify-between items-end">
            <div className="bg-chassis/85 backdrop-blur px-2.5 py-1.5 rounded-sm border border-hairline shadow-sm space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="text-muted-text uppercase text-[9px]">Focus:</span>
                <span className="font-semibold text-primary-text">{camera.focusDistanceM.toFixed(2)}m</span>
                <span className="text-secondary-text">•</span>
                <span className="text-muted-text uppercase text-[9px]">DoF:</span>
                <span className="text-optic font-semibold">{nearLimitM}m – {farLimitM}m</span>
                <span className="text-muted-text text-[9px]">({totalDofM})</span>
              </div>
              <div className="text-[9px] text-muted-text">
                <span>Hyperfocal: {hyperfocalM}m</span> • <span>CoC: {cocMm.toFixed(4)}mm</span> • <span>Height: {camera.position[1].toFixed(2)}m</span>
              </div>
            </div>

            {/* Quick Toggle Controls Floating Bar */}
            <div className="flex items-center space-x-1 pointer-events-auto bg-surface/90 backdrop-blur p-1 rounded-sm border border-hairline shadow-lg">
              {/* Gate Mask Toggle */}
              {isCameraView && (
                <button
                  onClick={() => updateViewfinder({ showGateMask: !viewfinder.showGateMask })}
                  title="Toggle Gate Mask (Safe Frame)"
                  className={`px-1.5 py-1 rounded-sm text-[9px] font-semibold transition-colors ${
                    viewfinder.showGateMask
                      ? 'bg-optic/20 text-optic border border-optic/60'
                      : 'text-secondary-text hover:text-primary-text hover:bg-elevated'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              )}

              {/* Rule of Thirds Toggle */}
              <button
                onClick={() => updateViewfinder({ showRuleOfThirds: !viewfinder.showRuleOfThirds })}
                title="Toggle Rule of Thirds Grid"
                className={`px-1.5 py-1 rounded-sm text-[9px] font-semibold transition-colors ${
                  viewfinder.showRuleOfThirds
                    ? 'bg-optic/20 text-optic border border-optic/60'
                    : 'text-secondary-text hover:text-primary-text hover:bg-elevated'
                }`}
              >
                <Grid className="w-3 h-3" />
              </button>

              {/* Center Cross Toggle */}
              <button
                onClick={() => updateViewfinder({ showCenterCross: !viewfinder.showCenterCross })}
                title="Toggle Center Crosshair"
                className={`px-1.5 py-1 rounded-sm text-[9px] font-semibold transition-colors ${
                  viewfinder.showCenterCross
                    ? 'bg-optic/20 text-optic border border-optic/60'
                    : 'text-secondary-text hover:text-primary-text hover:bg-elevated'
                }`}
              >
                <Crosshair className="w-3 h-3" />
              </button>

              {/* Golden Ratio Toggle */}
              <button
                onClick={() => updateViewfinder({ showGoldenRatio: !viewfinder.showGoldenRatio })}
                title="Toggle Golden Ratio (Phi Grid)"
                className={`px-1.5 py-1 rounded-sm text-[9px] font-semibold transition-colors ${
                  viewfinder.showGoldenRatio
                    ? 'bg-optic/20 text-optic border border-optic/60'
                    : 'text-secondary-text hover:text-primary-text hover:bg-elevated'
                }`}
              >
                <span className="text-[10px] font-serif leading-none">φ</span>
              </button>

              {/* Export Passes Button */}
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  disabled={isExporting}
                  title="Export High-Res Passes (Beauty RGB + Depth Map)"
                  className="flex items-center space-x-1 px-2 py-1 rounded-sm text-[10px] bg-elevated hover:bg-interactive-hover border border-hairline text-primary-text font-semibold transition-colors"
                >
                  <Download className="w-3 h-3 text-optic" />
                  <span>PASSES</span>
                </button>

                {exportMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-1 w-44 bg-surface border border-specular rounded-sm shadow-2xl p-1 z-50 text-[10px]">
                    <div className="text-[9px] text-muted-text px-2 py-1 uppercase tracking-wider border-b border-hairline font-semibold">
                      Export Passes
                    </div>
                    <button
                      onClick={() => handleExportPasses('both')}
                      className="w-full text-left px-2 py-1.5 hover:bg-elevated text-primary-text flex items-center space-x-1.5 rounded-sm transition-colors"
                    >
                      <Layers className="w-3 h-3 text-optic" />
                      <span>RGB + Depth (Ambos)</span>
                    </button>
                    <button
                      onClick={() => handleExportPasses('rgb')}
                      className="w-full text-left px-2 py-1.5 hover:bg-elevated text-secondary-text hover:text-primary-text flex items-center space-x-1.5 rounded-sm transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-primary-text" />
                      <span>Beauty RGB Pass</span>
                    </button>
                    <button
                      onClick={() => handleExportPasses('depth')}
                      className="w-full text-left px-2 py-1.5 hover:bg-elevated text-secondary-text hover:text-primary-text flex items-center space-x-1.5 rounded-sm transition-colors"
                    >
                      <Eye className="w-3 h-3 text-muted-text" />
                      <span>Depth Map Pass</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
