import React, { useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sliders } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useTranslation } from '../../i18n';

export const CurtainSlider: React.FC = () => {
  const takes = useStudioStore((state) => state.takes);
  const activeTakeId = useStudioStore((state) => state.activeTakeId);
  const comparisonMode = useStudioStore((state) => state.comparisonMode);
  const splitPosition = useStudioStore((state) => state.splitPosition);
  const setSplitPosition = useStudioStore((state) => state.setSplitPosition);
  const onionOpacity = useStudioStore((state) => state.onionOpacity);
  const setOnionOpacity = useStudioStore((state) => state.setOnionOpacity);
  const { t } = useTranslation();

  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTake = takes.find((take) => take.id === activeTakeId);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const newPos = (clientX - rect.left) / rect.width;
      setSplitPosition(newPos);
    },
    [setSplitPosition]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture already released
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('pointerup', handleGlobalMouseUp);
    return () => window.removeEventListener('pointerup', handleGlobalMouseUp);
  }, []);

  if (!activeTake || comparisonMode === 'none') {
    return null;
  }

  const splitPercent = Math.round(splitPosition * 100);
  const opacityPercent = Math.round(onionOpacity * 100);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 1. Split Curtain View */}
      {comparisonMode === 'split' && (
        <>
          {/* AI Render Layer clipped to right portion */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              clipPath: `inset(0 0 0 ${splitPosition * 100}%)`,
            }}
          >
            <img
              src={activeTake.imageUrl}
              alt="AI Render 2K"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* Draggable Vertical Divider Handle */}
          <div
            className="absolute top-0 bottom-0 pointer-events-auto flex items-center justify-center cursor-ew-resize group"
            style={{
              left: `${splitPosition * 100}%`,
              transform: 'translateX(-50%)',
              width: '28px',
            }}
            onPointerDown={handlePointerDown}
          >
            {/* Fine Vertical Line */}
            <div className="absolute top-0 bottom-0 w-[1.5px] bg-optic shadow-[0_0_8px_rgba(234,179,8,0.4)]" />

            {/* CNC Machined Metal Knurled Thumb Grip */}
            <div className="relative z-10 w-6 h-9 rounded-sm bg-chassis border border-specular shadow-2xl flex items-center justify-center gap-0.5 text-optic group-hover:border-optic group-active:scale-95 transition-transform duration-75">
              <ChevronLeft className="w-3 h-3 stroke-[2.5]" />
              <ChevronRight className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>

          {/* Overlay Badges */}
          <div className="absolute top-12 left-4 pointer-events-none">
            <div className="px-2.5 py-1 bg-chassis/85 backdrop-blur-md border border-hairline rounded-sm shadow-md flex items-center space-x-1.5 font-mono text-[10px] text-secondary-text">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-text/60" />
              <span className="tracking-wider">{t.comparison.blockoutBadge}</span>
            </div>
          </div>

          <div className="absolute top-12 right-4 pointer-events-none">
            <div className="px-2.5 py-1 bg-chassis/85 backdrop-blur-md border border-optic/40 rounded-sm shadow-md flex items-center space-x-1.5 font-mono text-[10px] text-optic">
              <span className="w-1.5 h-1.5 rounded-full bg-optic animate-pulse" />
              <span className="tracking-wider font-semibold">{t.comparison.renderBadge}</span>
              <span className="text-muted-text tabular-nums">({100 - splitPercent}%)</span>
            </div>
          </div>
        </>
      )}

      {/* 2. Onion Skin View */}
      {comparisonMode === 'onion' && (
        <>
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-75"
            style={{ opacity: onionOpacity }}
          >
            <img
              src={activeTake.imageUrl}
              alt="AI Render 2K (Onion Skin)"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Floating Onion Opacity Slider Badge */}
          <div className="absolute top-12 right-4 pointer-events-auto">
            <div className="px-3 py-1.5 bg-chassis/90 backdrop-blur-md border border-hairline rounded-sm shadow-xl flex items-center space-x-2 font-mono text-[11px] text-primary-text">
              <Sliders className="w-3.5 h-3.5 text-optic" />
              <span className="text-secondary-text uppercase text-[10px] font-semibold">{t.comparison.opacity}:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={onionOpacity}
                onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
                className="w-24 accent-optic h-1 cursor-pointer"
              />
              <span className="text-optic font-bold tabular-nums w-8 text-right">{opacityPercent}%</span>
            </div>
          </div>
        </>
      )}

      {/* 3. Full 2K Render View */}
      {comparisonMode === 'full' && (
        <div className="absolute inset-0 pointer-events-none bg-void/90 flex items-center justify-center">
          <img
            src={activeTake.imageUrl}
            alt="AI Render 2K Full"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-12 right-4 pointer-events-none">
            <div className="px-2.5 py-1 bg-chassis/85 backdrop-blur-md border border-optic rounded-sm shadow-md font-mono text-[10px] text-optic tracking-wider font-semibold">
              {t.comparison.modeFull} • 2K
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
