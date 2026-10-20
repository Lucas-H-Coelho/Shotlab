import React from 'react';
import {
  Move,
  RotateCw,
  Maximize2,
  Camera,
  Eye,
  Grid,
  Sun,
  Moon,
  Sparkles,
  Server,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useThemeStore } from '../../store/useThemeStore';
import { TransformMode } from '../../types/scene';

interface TopBarProps {
  onOpenRenderModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenRenderModal }) => {
  const transformMode = useStudioStore((state) => state.transformMode);
  const setTransformMode = useStudioStore((state) => state.setTransformMode);
  const activeView = useStudioStore((state) => state.activeView);
  const setActiveView = useStudioStore((state) => state.setActiveView);
  const snapToGrid = useStudioStore((state) => state.snapToGrid);
  const setSnapToGrid = useStudioStore((state) => state.setSnapToGrid);
  const sceneName = useStudioStore((state) => state.sceneName);
  const comfyUrl = useStudioStore((state) => state.comfyUrl);
  const isRendering = useStudioStore((state) => state.isRendering);

  const { theme, toggleTheme } = useThemeStore();

  const transformTools: { mode: TransformMode; icon: any; label: string; shortcut: string }[] = [
    { mode: 'translate', icon: Move, label: 'Mover', shortcut: 'W' },
    { mode: 'rotate', icon: RotateCw, label: 'Girar', shortcut: 'E' },
    { mode: 'scale', icon: Maximize2, label: 'Escalar', shortcut: 'R' },
  ];

  return (
    <header className="h-12 bg-chassis border-b border-hairline px-3 flex items-center justify-between z-20">
      {/* Brand & Project Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          {/* CNC Machined Logo Tag */}
          <div className="w-7 h-7 rounded-sm bg-elevated border border-hairline flex items-center justify-center shadow-inner">
            <span className="font-mono font-bold text-xs text-optic tracking-tighter">SL</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold tracking-wider text-primary-text uppercase">
                Shotlab
              </span>
              <span className="text-[9px] uppercase px-1 py-0.5 rounded-sm bg-elevated border border-hairline text-secondary-text font-mono tabular-nums">
                Studio 3D • Optical
              </span>
            </div>
            <p className="text-[10px] text-muted-text truncate max-w-[180px]">{sceneName}</p>
          </div>
        </div>
      </div>

      {/* Center: Transform & Viewport Mode Selectors */}
      <div className="flex items-center space-x-2">
        {/* Transform Tools (Translate / Rotate / Scale) */}
        <div className="flex items-center bg-surface p-0.5 rounded-sm border border-hairline">
          {transformTools.map((tool) => {
            const Icon = tool.icon;
            const active = transformMode === tool.mode;
            return (
              <button
                key={tool.mode}
                onClick={() => setTransformMode(tool.mode)}
                title={`${tool.label} (${tool.shortcut})`}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                  active
                    ? 'bg-elevated text-optic border border-specular shadow-sm'
                    : 'text-secondary-text hover:text-primary-text hover:bg-elevated/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tool.label}</span>
                <span className="text-[9px] opacity-60 font-mono tabular-nums">[{tool.shortcut}]</span>
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-hairline mx-1" />

        {/* View Mode (Free Orbit vs Virtual Camera) */}
        <div className="flex items-center bg-surface p-0.5 rounded-sm border border-hairline">
          <button
            onClick={() => setActiveView('editor')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
              activeView === 'editor'
                ? 'bg-elevated text-primary-text border border-specular shadow-sm'
                : 'text-secondary-text hover:text-primary-text hover:bg-elevated/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Editor 3D</span>
          </button>
          <button
            onClick={() => setActiveView('camera')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
              activeView === 'camera'
                ? 'bg-optic text-chassis font-semibold border border-optic shadow-sm'
                : 'text-secondary-text hover:text-primary-text hover:bg-elevated/50'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Visor Óptico</span>
          </button>
        </div>

        {/* Grid Snap Toggle */}
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          title="Ajuste ao Piso e Grid Métrico (10cm)"
          className={`p-1.5 rounded-sm border text-xs transition-colors ${
            snapToGrid
              ? 'bg-optic/15 border-optic text-optic'
              : 'bg-surface border-hairline text-secondary-text hover:text-primary-text hover:bg-elevated'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Theme Switcher, ComfyUI Telemetry & Render Action */}
      <div className="flex items-center space-x-2">
        {/* Dark / Light Mode Switcher */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Alternar para Modo Diurno (Brushed Silver)' : 'Alternar para Modo Vantablack'}
          className="p-1.5 rounded-sm bg-surface border border-hairline text-secondary-text hover:text-primary-text hover:bg-elevated transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-optic" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-secondary-text" />
          )}
        </button>

        {/* ComfyUI Server Telemetry Badge */}
        <div className="flex items-center space-x-2 text-xs bg-surface px-2 py-1 rounded-sm border border-hairline">
          <div className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />
          <Server className="w-3 h-3 text-secondary-text" />
          <span className="font-mono text-[10px] text-secondary-text truncate max-w-[120px] tabular-nums">
            {comfyUrl.replace('http://', '')}
          </span>
        </div>

        {/* Render Action Button (Tally Style) */}
        <button
          onClick={onOpenRenderModal}
          disabled={isRendering}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-sm text-xs font-semibold tracking-wide text-white bg-tally hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 border border-tally"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase text-[11px] font-mono tabular-nums">
            {isRendering ? 'Processando...' : 'Capturar Take'}
          </span>
        </button>
      </div>
    </header>
  );
};
