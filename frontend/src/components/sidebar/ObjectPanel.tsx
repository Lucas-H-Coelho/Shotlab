import React from 'react';
import {
  Box,
  Circle,
  Copy,
  Trash2,
  Plus,
  Package,
  Layers,
  Palette,
  Lock,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { ObjectType } from '../../types/scene';

export const ObjectPanel: React.FC = () => {
  const objects = useStudioStore((state) => state.objects);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const selectObject = useStudioStore((state) => state.selectObject);
  const addObject = useStudioStore((state) => state.addObject);
  const updateObject = useStudioStore((state) => state.updateObject);
  const removeObject = useStudioStore((state) => state.removeObject);
  const duplicateObject = useStudioStore((state) => state.duplicateObject);

  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  const addOptions: { type: ObjectType; label: string; icon: any }[] = [
    { type: 'box', label: 'Cubo', icon: Box },
    { type: 'cylinder', label: 'Cilindro', icon: Circle },
    { type: 'sphere', label: 'Esfera', icon: Circle },
    { type: 'table', label: 'Mesa / Bancada', icon: Layers },
  ];

  return (
    <div className="flex flex-col h-full text-xs text-gray-300 divide-y divide-[#212634]">
      {/* Add Object Actions */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-semibold uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Formas Paramétricas</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {addOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() => addObject(opt.type)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#161a25] border border-[#252b3b] hover:border-sky-500/50 hover:bg-[#1d2332] text-gray-200 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scene Objects List */}
      <div className="p-4 space-y-2">
        <div className="flex justify-between items-center text-xs text-gray-400 font-semibold uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Package className="w-3.5 h-3.5 text-indigo-400" />
            <span>Objetos na Cena ({objects.length})</span>
          </div>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {objects.map((obj) => {
            const isSelected = obj.id === selectedObjectId;
            return (
              <div
                key={obj.id}
                onClick={() => selectObject(obj.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-sky-950/60 border-sky-500 text-white shadow-sm'
                    : 'bg-[#141822] border-[#202534] text-gray-300 hover:bg-[#1a202d]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: obj.material.color }}
                  />
                  <span className="truncate font-medium">{obj.name}</span>
                </div>

                <div className="flex items-center space-x-1">
                  {obj.locked && <Lock className="w-3 h-3 text-gray-500" />}
                  {isSelected && !obj.locked && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateObject(obj.id);
                        }}
                        title="Duplicar"
                        className="p-1 hover:text-sky-300 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeObject(obj.id);
                        }}
                        title="Excluir"
                        className="p-1 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Object Inspector */}
      {selectedObject && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="text-[11px] text-gray-400 block font-semibold uppercase tracking-wider">
              Identificação
            </label>
            <input
              type="text"
              value={selectedObject.name}
              onChange={(e) => updateObject(selectedObject.id, { name: e.target.value })}
              className="w-full bg-[#161a25] border border-[#252b3b] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          {/* Position (m) */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block">
              Posição (Metros)
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <span className="text-[10px] text-gray-500 block">X</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedObject.position[0].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      position: [
                        Number(e.target.value),
                        selectedObject.position[1],
                        selectedObject.position[2],
                      ],
                    })
                  }
                  className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Y (Altura)</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedObject.position[1].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      position: [
                        selectedObject.position[0],
                        Math.max(0, Number(e.target.value)),
                        selectedObject.position[2],
                      ],
                    })
                  }
                  className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Z</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedObject.position[2].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      position: [
                        selectedObject.position[0],
                        selectedObject.position[1],
                        Number(e.target.value),
                      ],
                    })
                  }
                  className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Scale (m) */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block">
              Escala (Metros)
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <span className="text-[10px] text-gray-500 block">Largura (X)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={selectedObject.scale[0].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      scale: [
                        Math.max(0.01, Number(e.target.value)),
                        selectedObject.scale[1],
                        selectedObject.scale[2],
                      ],
                    })
                  }
                  className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Altura (Y)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={selectedObject.scale[1].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      scale: [
                        selectedObject.scale[0],
                        Math.max(0.01, Number(e.target.value)),
                        selectedObject.scale[2],
                      ],
                    })
                  }
                  className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Profundidade (Z)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={selectedObject.scale[2].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      scale: [
                        selectedObject.scale[0],
                        selectedObject.scale[1],
                        Math.max(0.01, Number(e.target.value)),
                      ],
                    })
                  }
                  className="w-full bg-[#161a25] border border-[#252b3b] rounded px-2 py-1 text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Material & Colors */}
          <div className="space-y-3 pt-2 border-t border-[#212634]">
            <div className="flex items-center space-x-1.5 text-xs text-gray-300 font-semibold uppercase tracking-wider">
              <Palette className="w-3.5 h-3.5 text-rose-400" />
              <span>Material & Cor de Referência</span>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={selectedObject.material.color}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    material: { ...selectedObject.material, color: e.target.value },
                  })
                }
                className="w-9 h-9 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="font-mono text-xs text-gray-300">{selectedObject.material.color}</span>
            </div>

            {/* Roughness & Metalness */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-gray-400">
                  <span>Rugosidade (Roughness)</span>
                  <span className="font-mono">{selectedObject.material.roughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedObject.material.roughness}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      material: { ...selectedObject.material, roughness: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-gray-400">
                  <span>Metálico (Metalness)</span>
                  <span className="font-mono">{selectedObject.material.metalness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedObject.material.metalness}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      material: { ...selectedObject.material, metalness: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
