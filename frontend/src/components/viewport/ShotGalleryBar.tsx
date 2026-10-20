import React, { useState } from 'react';
import {
  Layers,
  Columns,
  Eye,
  Camera,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useTranslation } from '../../i18n';
import { ComparisonMode } from '../../types/scene';

export const ShotGalleryBar: React.FC = () => {
  const takes = useStudioStore((state) => state.takes);
  const activeTakeId = useStudioStore((state) => state.activeTakeId);
  const setActiveTakeId = useStudioStore((state) => state.setActiveTakeId);
  const comparisonMode = useStudioStore((state) => state.comparisonMode);
  const setComparisonMode = useStudioStore((state) => state.setComparisonMode);
  const deleteTake = useStudioStore((state) => state.deleteTake);
  const restoreTakeCamera = useStudioStore((state) => state.restoreTakeCamera);
  const { t } = useTranslation();

  const [isExpanded, setIsExpanded] = useState(true);

  if (takes.length === 0) {
    return null;
  }

  const activeTake = takes.find((t) => t.id === activeTakeId);

  const handleDownload = (e: React.MouseEvent, imageUrl: string, name: string) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${name.toLowerCase().replace(/\s+/g, '-')}-2k.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleModeChange = (mode: ComparisonMode) => {
    setComparisonMode(mode);
    if (!activeTakeId && takes.length > 0) {
      setActiveTakeId(takes[0].id);
    }
  };

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[94%] pointer-events-auto">
      <div className="bg-chassis/95 backdrop-blur-md border border-hairline rounded-sm shadow-2xl overflow-hidden transition-all duration-200">
        {/* Header / Mode Toolbar */}
        <div className="px-3 py-2 bg-surface/80 border-b border-hairline flex items-center justify-between gap-2">
          {/* Left: Gallery Title & Takes Count */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-1.5 text-primary-text hover:text-optic transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-optic" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                {t.gallery.title}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-elevated border border-hairline text-optic font-semibold tabular-nums">
                {takes.length}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-text" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-muted-text" />
              )}
            </button>
          </div>

          {/* Center: Comparison Mode Switcher */}
          <div className="flex items-center space-x-1 bg-elevated p-0.5 rounded-sm border border-hairline font-mono text-[10px]">
            <button
              onClick={() => handleModeChange('none')}
              className={`px-2 py-1 rounded-sm flex items-center space-x-1 transition-all ${
                comparisonMode === 'none'
                  ? 'bg-chassis text-optic font-semibold shadow-sm border border-hairline'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{t.comparison.mode3d}</span>
            </button>

            <button
              onClick={() => handleModeChange('split')}
              className={`px-2 py-1 rounded-sm flex items-center space-x-1 transition-all ${
                comparisonMode === 'split'
                  ? 'bg-chassis text-optic font-semibold shadow-sm border border-hairline'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>{t.comparison.modeSplit}</span>
            </button>

            <button
              onClick={() => handleModeChange('onion')}
              className={`px-2 py-1 rounded-sm flex items-center space-x-1 transition-all ${
                comparisonMode === 'onion'
                  ? 'bg-chassis text-optic font-semibold shadow-sm border border-hairline'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>{t.comparison.modeOnion}</span>
            </button>

            <button
              onClick={() => handleModeChange('full')}
              className={`px-2 py-1 rounded-sm flex items-center space-x-1 transition-all ${
                comparisonMode === 'full'
                  ? 'bg-chassis text-optic font-semibold shadow-sm border border-hairline'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>{t.comparison.modeFull}</span>
            </button>
          </div>

          {/* Right: Active Take Actions */}
          {activeTake && (
            <div className="flex items-center space-x-1.5 font-mono text-[10px]">
              <button
                onClick={() => restoreTakeCamera(activeTake.id)}
                title={t.comparison.matchCamera}
                className="px-2 py-1 bg-elevated hover:bg-specular border border-hairline hover:border-optic text-secondary-text hover:text-primary-text rounded-sm flex items-center space-x-1 transition-colors"
              >
                <Camera className="w-3 h-3 text-optic" />
                <span className="hidden sm:inline">{t.comparison.matchCamera}</span>
              </button>

              <button
                onClick={(e) => handleDownload(e, activeTake.imageUrl, activeTake.name)}
                title={t.comparison.download}
                className="px-2 py-1 bg-elevated hover:bg-specular border border-hairline hover:border-optic text-secondary-text hover:text-primary-text rounded-sm flex items-center space-x-1 transition-colors"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">2K</span>
              </button>
            </div>
          )}
        </div>

        {/* Takes Carousel / Filmstrip */}
        {isExpanded && (
          <div className="p-2.5 flex items-center space-x-2.5 overflow-x-auto scrollbar-thin scrollbar-thumb-hairline">
            {takes.map((take) => {
              const isActive = take.id === activeTakeId;
              const isQwen = take.engine === 'qwen-image-2-1';

              return (
                <div
                  key={take.id}
                  onClick={() => {
                    setActiveTakeId(take.id);
                    if (comparisonMode === 'none') {
                      setComparisonMode('split');
                    }
                  }}
                  className={`group relative flex-shrink-0 w-36 cursor-pointer bg-elevated rounded-sm border overflow-hidden transition-all duration-150 ${
                    isActive
                      ? 'border-optic ring-1 ring-optic shadow-lg'
                      : 'border-hairline hover:border-secondary-text/50 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[3/2] bg-void overflow-hidden">
                    <img
                      src={take.imageUrl}
                      alt={take.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Engine Badge */}
                    <div className="absolute top-1 left-1">
                      <span
                        className={`font-mono text-[8px] font-bold px-1 py-0.5 rounded-sm uppercase tracking-wider ${
                          isQwen
                            ? 'bg-optic text-black font-semibold'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                        }`}
                      >
                        {isQwen ? t.gallery.engineQwen : t.gallery.engineMoss}
                      </span>
                    </div>

                    {/* Delete Take Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTake(take.id);
                      }}
                      title={t.gallery.deleteTake}
                      className="absolute top-1 right-1 p-1 bg-void/80 hover:bg-red-950/90 text-muted-text hover:text-red-400 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Metadata */}
                  <div className="p-1.5 space-y-0.5 font-mono text-[9px] tabular-nums bg-surface/50">
                    <div className="flex items-center justify-between text-primary-text font-semibold">
                      <span className="truncate">{take.name}</span>
                      <span className="text-optic text-[8px]">
                        {take.camera.focalLengthMm}mm f/{take.camera.fStop}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-text text-[8px]">
                      <span>Seed: {take.seed % 10000}</span>
                      <span>D: {take.denoise}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
