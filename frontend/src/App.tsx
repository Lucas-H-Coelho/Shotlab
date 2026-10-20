import React, { useState, useEffect } from 'react';
import { TopBar } from './components/toolbar/TopBar';
import { Viewport } from './components/viewport/Viewport';
import { CameraPanel } from './components/sidebar/CameraPanel';
import { ObjectPanel } from './components/sidebar/ObjectPanel';
import { LightingPanel } from './components/sidebar/LightingPanel';
import { RenderModal } from './components/render/RenderModal';
import { useStudioStore } from './store/useStudioStore';
import { Camera, Package, Sun } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'objects' | 'lights'>('camera');
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);

  const setTransformMode = useStudioStore((state) => state.setTransformMode);
  const setActiveView = useStudioStore((state) => state.setActiveView);
  const activeView = useStudioStore((state) => state.activeView);
  const selectObject = useStudioStore((state) => state.selectObject);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0e14]">
      {/* Top Header */}
      <TopBar onOpenRenderModal={() => setIsRenderModalOpen(true)} />

      {/* Main Studio Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Viewport 3D Canvas */}
        <main className="flex-1 h-full relative">
          <Viewport />
        </main>

        {/* Right Studio Controls Sidebar */}
        <aside className="w-80 h-full bg-[#11141c] border-l border-[#212634] flex flex-col z-10 shadow-xl">
          {/* Tab Navigation */}
          <div className="flex border-b border-[#212634] bg-[#161a25]">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'camera'
                  ? 'border-rose-500 text-rose-400 bg-[#121620]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a202d]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Câmera</span>
            </button>
            <button
              onClick={() => setActiveTab('objects')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'objects'
                  ? 'border-sky-500 text-sky-400 bg-[#121620]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a202d]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Objetos</span>
            </button>
            <button
              onClick={() => setActiveTab('lights')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'lights'
                  ? 'border-amber-500 text-amber-400 bg-[#121620]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a202d]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Luzes</span>
            </button>
          </div>

          {/* Active Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'camera' && <CameraPanel />}
            {activeTab === 'objects' && <ObjectPanel />}
            {activeTab === 'lights' && <LightingPanel />}
          </div>
        </aside>
      </div>

      {/* Generation / Render Modal */}
      <RenderModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
      />
    </div>
  );
};

export default App;
