import React from 'react';
import {
  Move,
  RotateCw,
  Maximize2,
  Camera,
  Eye,
  Grid,
  Sparkles,
  Server,
  Layers,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
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

  const transformTools: { mode: TransformMode; icon: any; label: string; shortcut: string }[] = [
    { mode: 'translate', icon: Move, label: 'Mover', shortcut: 'W' },
    { mode: 'rotate', icon: RotateCw, label: 'Girar', shortcut: 'E' },
    { mode: 'scale', icon: Maximize2, label: 'Escalar', shortcut: 'R' },
  ];

  return (
    <header className="h-14 bg-[#11141c] border-b border-[#212634] px-4 flex items-center justify-between z-20">
      {/* Brand & Scene Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center space-x-1.5">
              <span>SHOTLAB</span>
              <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 font-mono border border-sky-800/50">
                Studio 3D + IA
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{sceneName}</p>
          </div>
        </div>
      </div>

      {/* Center: Transform & View Controls */}
      <div className="flex items-center space-x-2">
        {/* Transform Gizmo Selector */}
        <div className="flex items-center bg-[#171b26] p-1 rounded-lg border border-[#262c3e]">
          {transformTools.map((tool) => {
            const Icon = tool.icon;
            const active = transformMode === tool.mode;
            return (
              <button
                key={tool.mode}
                onClick={() => setTransformMode(tool.mode)}
                title={`${tool.label} (${tool.shortcut})`}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-[#262c3e] mx-1" />

        {/* View Mode (Editor vs Real Camera) */}
        <div className="flex items-center bg-[#171b26] p-1 rounded-lg border border-[#262c3e]">
          <button
            onClick={() => setActiveView('editor')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === 'editor'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Editor 3D</span>
          </button>
          <button
            onClick={() => setActiveView('camera')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === 'camera'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Câmera Virtual</span>
          </button>
        </div>

        {/* Grid Snap Toggle */}
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          title="Ajuste ao Grid (Snap 10cm)"
          className={`p-2 rounded-lg border text-xs transition-colors ${
            snapToGrid
              ? 'bg-sky-950/70 border-sky-600 text-sky-400'
              : 'bg-[#171b26] border-[#262c3e] text-gray-400 hover:text-gray-200'
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Right: ComfyUI Status & Generate Action */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-xs text-gray-400 bg-[#171b26] px-2.5 py-1.5 rounded-lg border border-[#262c3e]">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-[11px] truncate max-w-[140px]">{comfyUrl}</span>
        </div>

        <button
          onClick={onOpenRenderModal}
          disabled={isRendering}
          className="flex items-center space-x-2 px-4 py-1.5 rounded-lg font-medium text-xs text-white bg-gradient-to-r from-sky-500 via-indigo-600 to-rose-500 hover:from-sky-400 hover:to-rose-400 shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>{isRendering ? 'Gerando...' : 'Gerar Foto IA'}</span>
        </button>
      </div>
    </header>
  );
};
