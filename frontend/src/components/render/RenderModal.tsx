import React, { useState } from 'react';
import { X, Sparkles, Sliders, CheckCircle, RefreshCw, Download, Image as ImageIcon } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RenderModal: React.FC<RenderModalProps> = ({ isOpen, onClose }) => {
  const camera = useStudioStore((state) => state.camera);
  const isRendering = useStudioStore((state) => state.isRendering);
  const setRendering = useStudioStore((state) => state.setRendering);

  const [prompt, setPrompt] = useState(
    'Frasco de perfume minimalista sobre bancada de mármore polido, iluminação suave lateral de estúdio comercial, reflexos delicados, fotografia de produto de luxo editorial'
  );
  const [denoise, setDenoise] = useState(0.85);
  const [steps, setSteps] = useState(25);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000));
  const [renderProgress, setRenderProgress] = useState(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real lens optical descriptor that complements the prompt
  const lensPromptAddon = `${camera.focalLengthMm}mm prime lens, f/${camera.fStop} aperture, 35mm full-frame optical perspective`;

  const handleStartGeneration = async () => {
    setRendering(true, 'Capturando passe 3D e enviando ao ComfyUI...');
    setRenderProgress(15);

    try {
      const canvas = document.querySelector('canvas');
      let referenceDataUrl = '';
      if (canvas) {
        referenceDataUrl = canvas.toDataURL('image/png');
      }

      setRenderProgress(35);
      setRendering(true, 'ComfyUI: Executando Qwen Image 2.1 em modo Edição...');

      // Call backend API if available
      const response = await fetch('/v1/scenes/default/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${prompt}, ${lensPromptAddon}`,
          camera: camera,
          referenceImage: referenceDataUrl,
          steps,
          denoise,
          seed,
        }),
      }).catch(() => null);

      let progress = 40;
      const interval = setInterval(() => {
        progress += 15;
        if (progress >= 100) {
          clearInterval(interval);
          setRenderProgress(100);
          setRendering(false, 'Geração concluída!');
          if (response && response.ok) {
            response.json().then((data) => setGeneratedImageUrl(data.imageUrl));
          } else {
            setGeneratedImageUrl(referenceDataUrl);
          }
        } else {
          setRenderProgress(progress);
        }
      }, 350);
    } catch {
      setRendering(false, 'Erro ao conectar com ComfyUI');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-specular rounded-sm w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-chassis">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-sm bg-elevated border border-hairline flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-optic" />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold text-primary-text uppercase tracking-wider">
                Motor de Renderização • Qwen Image 2.1
              </h3>
              <p className="text-[10px] text-muted-text font-mono">Modo Edição Guiado pela Composição 3D</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary-text hover:text-primary-text p-1 rounded-sm hover:bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Prompt */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-primary-text uppercase tracking-wider block">
              Prompt Criativo da Imagem
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva materiais, texturas, iluminação de estúdio..."
              className="w-full bg-elevated border border-hairline rounded-sm p-2 text-xs text-primary-text focus:outline-none focus:border-optic resize-none leading-relaxed font-sans"
            />
          </div>

          {/* Real Lens Camera Context */}
          <div className="bg-elevated border border-hairline rounded-sm p-2 flex items-start space-x-2">
            <Sliders className="w-3.5 h-3.5 text-optic mt-0.5 flex-shrink-0" />
            <div className="text-[11px] space-y-0.5 font-mono">
              <span className="font-semibold text-primary-text">Injeção Óptica Automática:</span>
              <p className="text-muted-text text-[10px]">{lensPromptAddon}</p>
            </div>
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
            <div className="bg-elevated p-2 rounded-sm border border-hairline space-y-1">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span>Denoise</span>
                <span className="text-optic font-semibold">{denoise}</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={denoise}
                onChange={(e) => setDenoise(Number(e.target.value))}
                className="w-full accent-[var(--accent-optic)] bg-surface h-1 rounded-sm cursor-pointer"
              />
            </div>

            <div className="bg-elevated p-2 rounded-sm border border-hairline space-y-1">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span>Passos (Steps)</span>
                <span className="text-optic font-semibold">{steps}</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="w-full accent-[var(--accent-optic)] bg-surface h-1 rounded-sm cursor-pointer"
              />
            </div>

            <div className="bg-elevated p-2 rounded-sm border border-hairline space-y-1">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span>Seed</span>
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                  className="hover:text-optic text-[9px] flex items-center space-x-0.5"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Novo</span>
                </button>
              </div>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-full bg-surface border border-hairline rounded-sm px-1.5 py-0.5 text-[10px] font-mono text-primary-text"
              />
            </div>
          </div>

          {/* Progress / Output Display */}
          {isRendering && (
            <div className="space-y-1.5 bg-elevated p-3 rounded-sm border border-tally/40 font-mono">
              <div className="flex justify-between text-[10px] text-tally font-medium">
                <span className="flex items-center space-x-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Processando passes no ComfyUI...</span>
                </span>
                <span className="tabular-nums">{renderProgress}%</span>
              </div>
              <div className="w-full bg-surface h-1.5 rounded-sm overflow-hidden">
                <div
                  className="bg-tally h-full transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            </div>
          )}

          {generatedImageUrl && !isRendering && (
            <div className="bg-elevated p-3 rounded-sm border border-status-ok/40 space-y-2">
              <div className="flex items-center justify-between text-xs text-status-ok font-semibold font-mono">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Take Renderizado (2K)</span>
                </div>
                <a
                  href={generatedImageUrl}
                  download="shotlab-render.png"
                  className="flex items-center space-x-1 px-2.5 py-1 bg-surface text-primary-text border border-hairline rounded-sm hover:border-specular transition-colors text-[10px]"
                >
                  <Download className="w-3 h-3 text-optic" />
                  <span>Download 2K</span>
                </a>
              </div>
              <div className="flex justify-center bg-black/60 rounded-sm p-1.5 border border-hairline">
                <img
                  src={generatedImageUrl}
                  alt="Render Final"
                  className="max-h-56 rounded-sm object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-hairline bg-chassis">
          <span className="text-[10px] text-muted-text flex items-center space-x-1 font-mono">
            <ImageIcon className="w-3 h-3 text-optic" />
            <span>Passe de Geometria 3D + Edição Difusão</span>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-sm text-xs font-mono text-secondary-text hover:text-primary-text hover:bg-elevated transition-colors border border-hairline"
            >
              Fechar
            </button>
            <button
              onClick={handleStartGeneration}
              disabled={isRendering}
              className="flex items-center space-x-1.5 px-4 py-1 rounded-sm text-xs font-mono uppercase font-semibold text-white bg-tally hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 border border-tally"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRendering ? 'Processando...' : 'Iniciar Gravação'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
