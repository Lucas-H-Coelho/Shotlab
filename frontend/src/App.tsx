import React, { useState, useEffect } from 'react';
import { TopBar } from './components/toolbar/TopBar';
import { Viewport } from './components/viewport/Viewport';
import { SceneSidebar } from './components/sidebar/SceneSidebar';
import { CameraPanel } from './components/sidebar/CameraPanel';
import { ObjectPanel } from './components/sidebar/ObjectPanel';
import { LightingPanel } from './components/sidebar/LightingPanel';
import { RenderModal } from './components/render/RenderModal';
import { useStudioStore } from './store/useStudioStore';
import { useTranslation } from './i18n';
import { Camera, Package, Sun, AlertTriangle, X } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'objects' | 'lights'>('camera');
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);

  const setTransformMode = useStudioStore((state) => state.setTransformMode);
  const setActiveView = useStudioStore((state) => state.setActiveView);
  const activeView = useStudioStore((state) => state.activeView);
  const selectObject = useStudioStore((state) => state.selectObject);
  const initializeScene = useStudioStore((state) => state.initializeScene);
  const apiError = useStudioStore((state) => state.apiError);
  const clearApiError = useStudioStore((state) => state.clearApiError);

  const { t } = useTranslation();

  // Initialize scene and WebSocket on startup
  useEffect(() => {
    initializeScene('scene-default');
  }, [initializeScene]);

  // Global Keyboard Shortcuts (Industry standard 3D & photo shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          setTransformMode('translate');
          break;
        case 'e':
          setTransformMode('rotate');
          break;
        case 'r':
          setTransformMode('scale');
          break;
        case 'c':
          setActiveView(activeView === 'camera' ? 'editor' : 'camera');
          break;
        case 'escape':
          selectObject(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, setTransformMode, setActiveView, selectObject]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-chassis text-primary-text font-sans">
      {/* Top Header */}
      <TopBar onOpenRenderModal={() => setIsRenderModalOpen(true)} />

      {/* Main Studio Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Studio Dock (Scene, Cine Gear, 3D Catalog) */}
        <SceneSidebar />

        {/* Viewport 3D Canvas */}
        <main className="flex-1 h-full relative bg-void">
          <Viewport />
        </main>

        {/* Right Studio Controls Sidebar */}
        <aside className="w-80 h-full bg-surface border-l border-hairline flex flex-col z-10 shadow-lg">
          {/* Tab Navigation */}
          <div className="flex border-b border-hairline bg-chassis font-mono text-[10px] uppercase">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 font-semibold border-b-2 transition-all ${
                activeTab === 'camera'
                  ? 'border-optic text-optic bg-surface'
                  : 'border-transparent text-secondary-text hover:text-primary-text hover:bg-elevated/40'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>{t.sidebar.camera}</span>
            </button>
            <button
              onClick={() => setActiveTab('objects')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 font-semibold border-b-2 transition-all ${
                activeTab === 'objects'
                  ? 'border-optic text-optic bg-surface'
                  : 'border-transparent text-secondary-text hover:text-primary-text hover:bg-elevated/40'
              }`}
            >
              <Package className="w-3 h-3" />
              <span>{t.sidebar.objects}</span>
            </button>
            <button
              onClick={() => setActiveTab('lights')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 font-semibold border-b-2 transition-all ${
                activeTab === 'lights'
                  ? 'border-optic text-optic bg-surface'
                  : 'border-transparent text-secondary-text hover:text-primary-text hover:bg-elevated/40'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span>{t.sidebar.lights}</span>
            </button>
          </div>

          {/* Active Panel Content */}
          <div className="flex-1 overflow-y-auto bg-surface">
            {activeTab === 'camera' && <CameraPanel />}
            {activeTab === 'objects' && <ObjectPanel />}
            {activeTab === 'lights' && <LightingPanel />}
          </div>
        </aside>
      </div>

      {/* Physical Validation & API Error Overlay Banner */}
      {apiError && (
        <div className="absolute bottom-4 left-4 max-w-md z-50 bg-surface/95 backdrop-blur border border-tally p-3 rounded-sm shadow-2xl flex items-start space-x-3 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-tally shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-[10px] uppercase text-tally tracking-wider">
                {apiError.code || 'API_VALIDATION_ERROR'}
              </span>
              {apiError.objectId && (
                <span className="font-mono text-[9px] text-muted-text">
                  ID: {apiError.objectId}
                </span>
              )}
            </div>
            <p className="text-secondary-text text-[11px] leading-relaxed">
              {apiError.detail}
            </p>
          </div>
          <button
            onClick={clearApiError}
            title="Fechar"
            className="p-1 text-muted-text hover:text-primary-text rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Generation / Render Modal */}
      <RenderModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
      />
    </div>
  );
};

export default App;
