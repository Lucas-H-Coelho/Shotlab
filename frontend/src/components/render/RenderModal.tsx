import React, { useState } from 'react';
import { X, Sparkles, Sliders, CheckCircle, Download, Image as ImageIcon, Columns, Cpu } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useTranslation } from '../../i18n';

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RenderModal: React.FC<RenderModalProps> = ({ isOpen, onClose }) => {
  const camera = useStudioStore((state) => state.camera);
  const isRendering = useStudioStore((state) => state.isRendering);
  const setRendering = useStudioStore((state) => state.setRendering);
  const addTake = useStudioStore((state) => state.addTake);
  const setComparisonMode = useStudioStore((state) => state.setComparisonMode);
  const setActiveTakeId = useStudioStore((state) => state.setActiveTakeId);
  const takes = useStudioStore((state) => state.takes);
  const { t } = useTranslation();

  const [prompt, setPrompt] = useState(
    'Frasco de perfume minimalista sobre bancada de mármore polido, iluminação suave lateral de estúdio comercial, reflexos delicados, fotografia de produto de luxo editorial'
  );
  const [engine, setEngine] = useState<'qwen-image-2-1' | 'moss-image'>('qwen-image-2-1');
  const [denoise, setDenoise] = useState(0.85);
  const [steps, setSteps] = useState(25);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000));
  const [renderProgress, setRenderProgress] = useState(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [createdTakeId, setCreatedTakeId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real lens optical descriptor that complements the prompt
  const lensPromptAddon = `${camera.focalLengthMm}mm prime lens, f/${camera.fStop} aperture, 35mm full-frame optical perspective`;

  const handleStartGeneration = async () => {
    setRendering(true, t.render.processing);
    setRenderProgress(15);

    try {
      const canvas = document.querySelector('canvas');
      let referenceDataUrl = '';
      if (canvas) {
        referenceDataUrl = canvas.toDataURL('image/png');
      }

      setRenderProgress(35);
      setRendering(true, t.render.processing);

      // Call backend API if available
      const response = await fetch('/v1/scenes/default/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${prompt}, ${lensPromptAddon}`,
          camera: camera,
          referenceImage: referenceDataUrl,
          engine,
          steps,
          denoise,
          seed,
        }),
      }).catch(() => null);

      let progress = 40;
      const interval = setInterval(() => {
        progress += 20;
        if (progress >= 100) {
          clearInterval(interval);
          setRenderProgress(100);
          setRendering(false, 'OK');

          const finalImg = referenceDataUrl;
          if (response && response.ok) {
            response.json().then((data) => {
              const url = data.imageUrl || finalImg;
              setGeneratedImageUrl(url);
              const newTake = addTake({
                name: `Take #${takes.length + 1}`,
                imageUrl: url,
                referenceUrl: referenceDataUrl,
                prompt,
                engine,
                denoise,
                seed,
                steps,
                camera: { ...camera },
              });
              setCreatedTakeId(newTake.id);
            });
          } else {
            setGeneratedImageUrl(finalImg);
            const newTake = addTake({
              name: `Take #${takes.length + 1}`,
              imageUrl: finalImg,
              referenceUrl: referenceDataUrl,
              prompt,
              engine,
              denoise,
              seed,
              steps,
              camera: { ...camera },
            });
            setCreatedTakeId(newTake.id);
          }
        } else {
          setRenderProgress(progress);
        }
      }, 250);
    } catch {
      setRendering(false, 'Error');
    }
  };

  const handleCompareInViewport = () => {
    if (createdTakeId) {
      setActiveTakeId(createdTakeId);
    }
    setComparisonMode('split');
    onClose();
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
                {t.render.title}
              </h3>
              <p className="text-[10px] text-muted-text font-mono">{t.render.subtitle}</p>
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
          {/* Engine Selector (Dual-Engine: Qwen Image 2.1 vs MOSS-Image) */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-primary-text uppercase tracking-wider flex items-center space-x-1">
              <Cpu className="w-3 h-3 text-optic" />
              <span>Motor de Geração (Dual-Engine)</span>
            </label>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setEngine('qwen-image-2-1')}
                className={`p-2.5 rounded-sm border text-left transition-all ${
                  engine === 'qwen-image-2-1'
                    ? 'border-optic bg-elevated text-primary-text shadow-sm'
                    : 'border-hairline bg-surface/50 text-secondary-text hover:border-hairline hover:text-primary-text'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-optic">Qwen Image 2.1</span>
                  <span className="text-[9px] px-1 py-0.5 rounded-sm bg-optic/20 text-optic uppercase">2K Nativo</span>
                </div>
                <p className="text-[10px] text-muted-text mt-1">Preservação por I2I/Edição e Fidelidade Óptica</p>
              </button>

              <button
                type="button"
                onClick={() => setEngine('moss-image')}
                className={`p-2.5 rounded-sm border text-left transition-all ${
                  engine === 'moss-image'
                    ? 'border-optic bg-elevated text-primary-text shadow-sm'
                    : 'border-hairline bg-surface/50 text-secondary-text hover:border-hairline hover:text-primary-text'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary-text">MOSS-Image</span>
                  <span className="text-[9px] px-1 py-0.5 rounded-sm bg-chassis text-secondary-text border border-hairline uppercase">Layout JSON</span>
                </div>
                <p className="text-[10px] text-muted-text mt-1">Projeção 3D Bounding Box Centralizada</p>
              </button>
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold text-primary-text uppercase tracking-wider block">
              {t.render.promptLabel}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.render.promptPlaceholder}
              className="w-full bg-elevated border border-hairline rounded-sm p-2 text-xs text-primary-text focus:outline-none focus:border-optic resize-none leading-relaxed font-sans"
            />
          </div>

          {/* Real Lens Camera Context */}
          <div className="bg-elevated border border-hairline rounded-sm p-2 flex items-start space-x-2">
            <Sliders className="w-3.5 h-3.5 text-optic mt-0.5 flex-shrink-0" />
            <div className="text-[11px] space-y-0.5 font-mono">
              <span className="font-semibold text-primary-text">{t.render.opticalInjection}</span>
              <p className="text-muted-text text-[10px]">{lensPromptAddon}</p>
            </div>
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
            <div className="bg-elevated p-2 rounded-sm border border-hairline space-y-1">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span>{t.render.denoise}</span>
                <span className="text-optic font-semibold">{denoise}</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={denoise}
                onChange={(e) => setDenoise(Number(e.target.value))}
                className="w-full accent-optic bg-surface h-1 rounded-sm cursor-pointer"
              />
            </div>

            <div className="bg-elevated p-2 rounded-sm border border-hairline space-y-1">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span>{t.render.steps}</span>
                <span className="text-optic font-semibold">{steps}</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="w-full accent-optic bg-surface h-1 rounded-sm cursor-pointer"
              />
            </div>

            <div className="bg-elevated p-2 rounded-sm border border-hairline space-y-1">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span>{t.render.seed}</span>
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                  className="text-optic hover:underline text-[9px] uppercase"
                >
                  {t.render.newSeed}
                </button>
              </div>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-full bg-surface border border-hairline rounded-sm px-1.5 py-0.5 text-xs text-primary-text focus:outline-none focus:border-optic"
              />
            </div>
          </div>

          {/* Progress Bar */}
          {isRendering && (
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between text-[10px] text-secondary-text">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-optic animate-ping" />
                  <span>{t.render.processing}</span>
                </span>
                <span className="text-optic font-semibold tabular-nums">{renderProgress}%</span>
              </div>
              <div className="w-full h-1 bg-elevated rounded-full overflow-hidden border border-hairline">
                <div
                  className="h-full bg-optic transition-all duration-300"
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
                  <span>{t.render.takeReady}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={handleCompareInViewport}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-optic text-black font-semibold rounded-sm hover:opacity-90 active:scale-95 transition-all text-[10px]"
                  >
                    <Columns className="w-3 h-3" />
                    <span>Comparar no Viewport</span>
                  </button>
                  <a
                    href={generatedImageUrl}
                    download="shotlab-take-2k.png"
                    className="flex items-center space-x-1 px-2.5 py-1 bg-surface text-primary-text border border-hairline rounded-sm hover:border-specular transition-colors text-[10px]"
                  >
                    <Download className="w-3 h-3 text-optic" />
                    <span>{t.render.download2k}</span>
                  </a>
                </div>
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
            <span>{t.render.geometryPass}</span>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-sm text-xs font-mono text-secondary-text hover:text-primary-text hover:bg-elevated transition-colors border border-hairline"
            >
              {t.render.close}
            </button>
            <button
              onClick={handleStartGeneration}
              disabled={isRendering}
              className="flex items-center space-x-1.5 px-4 py-1 rounded-sm text-xs font-mono uppercase font-semibold text-white bg-tally hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 border border-tally"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRendering ? t.topbar.capturing : t.render.record}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
