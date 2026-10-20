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
  ArrowDownToLine,
  User,
  Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useTranslation } from '../../i18n';
import { ObjectType } from '../../types/scene';

export const ObjectPanel: React.FC = () => {
  const objects = useStudioStore((state) => state.objects);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const selectObject = useStudioStore((state) => state.selectObject);
  const addObject = useStudioStore((state) => state.addObject);
  const updateObject = useStudioStore((state) => state.updateObject);
  const removeObject = useStudioStore((state) => state.removeObject);
  const duplicateObject = useStudioStore((state) => state.duplicateObject);

  const { t } = useTranslation();

  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  const addOptions: { type: ObjectType; label: string; icon: any }[] = [
    { type: 'box', label: t.objects.types.box, icon: Box },
    { type: 'cylinder', label: t.objects.types.cylinder, icon: Circle },
    { type: 'sphere', label: t.objects.types.sphere, icon: Circle },
    { type: 'table', label: t.objects.types.table, icon: Layers },
  ];

  // Quick action: Snap object base to floor (Blender PLACE_ORIGIN_BASE)
  const handleSnapToFloor = () => {
    if (!selectedObject) return;
    const targetY = selectedObject.type === 'backdrop' ? 0 : Number((selectedObject.scale[1] / 2).toFixed(3));
    updateObject(selectedObject.id, {
      position: [selectedObject.position[0], targetY, selectedObject.position[2]],
    });
  };

  const isCharacterCandidate = Boolean(
    selectedObject?.metadata?.is_character ??
    (selectedObject &&
      (selectedObject.type === 'model' ||
        selectedObject.name.toLowerCase().includes('manequim') ||
        selectedObject.name.toLowerCase().includes('sujeito') ||
        selectedObject.name.toLowerCase().includes('personagem') ||
        selectedObject.name.toLowerCase().includes('hero')))
  );

  const characterPoses: { id: 'standing' | 'portrait_3_4' | 'seated' | 'walking' | 'hero_contrapposto'; label: string }[] = [
    { id: 'standing', label: t.objects.poses.standing },
    { id: 'portrait_3_4', label: t.objects.poses.portrait_3_4 },
    { id: 'seated', label: t.objects.poses.seated },
    { id: 'walking', label: t.objects.poses.walking },
    { id: 'hero_contrapposto', label: t.objects.poses.hero_contrapposto },
  ];

  return (
    <div className="flex flex-col h-full text-xs text-secondary-text divide-y divide-hairline">
      {/* Add Object Actions */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center space-x-1.5 text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider">
          <Plus className="w-3 h-3 text-optic" />
          <span>{t.objects.primitivesTitle}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {addOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() => addObject(opt.type)}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-sm bg-elevated border border-hairline hover:border-optic/50 hover:bg-interactive-hover text-primary-text transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-optic" />
                <span className="font-medium text-[11px]">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scene Objects Outliner List */}
      <div className="p-3.5 space-y-2">
        <div className="flex justify-between items-center text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Package className="w-3 h-3 text-optic" />
            <span>{t.objects.outlinerTitle} ({objects.length})</span>
          </div>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {objects.map((obj) => {
            const isSelected = obj.id === selectedObjectId;
            const isChar = Boolean(obj.metadata?.is_character);
            return (
              <div
                key={obj.id}
                onClick={() => selectObject(obj.id)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-elevated border-optic text-primary-text shadow-sm'
                    : 'bg-surface border-hairline text-secondary-text hover:bg-elevated hover:text-primary-text'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: obj.material.color }}
                  />
                  <span className="truncate font-mono text-[11px]">{obj.name}</span>
                  {isChar && (
                    <span className="px-1 py-0.2 rounded-xs bg-optic/10 text-optic text-[8px] font-mono">
                      HERO
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  {obj.locked && <Lock className="w-3 h-3 text-muted-text" />}
                  {isSelected && !obj.locked && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateObject(obj.id);
                        }}
                        title={t.objects.duplicate}
                        className="p-0.5 text-secondary-text hover:text-optic transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeObject(obj.id);
                        }}
                        title={t.objects.delete}
                        className="p-0.5 text-secondary-text hover:text-tally transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
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
        <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-text block font-mono font-semibold uppercase tracking-wider">
              {t.objects.identifier}
            </label>
            <input
              type="text"
              value={selectedObject.name}
              onChange={(e) => updateObject(selectedObject.id, { name: e.target.value })}
              className="w-full bg-elevated border border-hairline rounded-sm px-2 py-1 text-primary-text font-mono text-xs focus:outline-none focus:border-optic"
            />
          </div>

          {/* Quick Action: Pousar no Piso (Y = 0.00m) */}
          <button
            onClick={handleSnapToFloor}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-sm bg-elevated border border-hairline hover:border-optic text-secondary-text hover:text-optic text-[11px] font-mono font-medium transition-all shadow-sm active:scale-[0.99]"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-optic" />
            <span>{t.objects.snapToFloor}</span>
          </button>

          {/* Position (m) */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider block">
              {t.objects.position}
            </span>
            <div className="grid grid-cols-3 gap-1.5 font-mono tabular-nums">
              <div>
                <span className="text-[9px] text-muted-text block uppercase">X</span>
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
                  className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-xs focus:outline-none focus:border-optic"
                />
              </div>
              <div>
                <span className="text-[9px] text-muted-text block uppercase">{t.objects.floorY}</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedObject.position[1].toFixed(2)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      position: [
                        selectedObject.position[0],
                        Number(e.target.value),
                        selectedObject.position[2],
                      ],
                    })
                  }
                  className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-xs focus:outline-none focus:border-optic"
                />
              </div>
              <div>
                <span className="text-[9px] text-muted-text block uppercase">Z</span>
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
                  className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-xs focus:outline-none focus:border-optic"
                />
              </div>
            </div>
          </div>

          {/* Scale (m) */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider block">
              {t.objects.dimensions}
            </span>
            <div className="grid grid-cols-3 gap-1.5 font-mono tabular-nums">
              <div>
                <span className="text-[9px] text-muted-text block uppercase">{t.objects.width}</span>
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
                  className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-xs focus:outline-none focus:border-optic"
                />
              </div>
              <div>
                <span className="text-[9px] text-muted-text block uppercase">{t.objects.height}</span>
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
                  className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-xs focus:outline-none focus:border-optic"
                />
              </div>
              <div>
                <span className="text-[9px] text-muted-text block uppercase">{t.objects.depth}</span>
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
                  className="w-full bg-elevated border border-hairline rounded-sm px-1.5 py-1 text-primary-text text-xs focus:outline-none focus:border-optic"
                />
              </div>
            </div>
          </div>

          {/* Character / Mannequin Section (SHOT-39 Pro Feature) */}
          <div className="bg-surface p-2.5 rounded-sm border border-hairline space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCharacterCandidate}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      metadata: {
                        ...selectedObject.metadata,
                        is_character: e.target.checked,
                        height_m: selectedObject.metadata?.height_m ?? selectedObject.scale[1] ?? 1.75,
                        pose: selectedObject.metadata?.pose ?? 'standing',
                      },
                    })
                  }
                  className="accent-[var(--accent-optic)] rounded-sm cursor-pointer"
                />
                <span className="text-[10px] font-mono text-primary-text uppercase font-semibold flex items-center space-x-1">
                  <User className="w-3 h-3 text-optic" />
                  <span>{t.objects.characterSection}</span>
                </span>
              </label>
            </div>

            {isCharacterCandidate && (
              <div className="space-y-2.5 pt-1 border-t border-hairline">
                {/* Subject Pose Selector */}
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-text font-mono uppercase block">{t.objects.pose}</span>
                  <div className="grid grid-cols-2 gap-1">
                    {characterPoses.map((p) => {
                      const currentPose = selectedObject.metadata?.pose ?? 'standing';
                      const active = currentPose === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() =>
                            updateObject(selectedObject.id, {
                              metadata: { ...selectedObject.metadata, pose: p.id },
                            })
                          }
                          className={`px-1.5 py-1 rounded-sm text-[10px] font-mono border text-left truncate transition-all ${
                            active
                              ? 'bg-optic/15 border-optic text-optic font-semibold shadow-sm'
                              : 'bg-elevated border-hairline text-secondary-text hover:text-primary-text hover:bg-interactive-hover'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Estatura Real (1.50m - 2.00m) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-muted-text uppercase">{t.objects.realHeight}</span>
                    <span className="text-optic font-bold tabular-nums">
                      {(selectedObject.metadata?.height_m ?? selectedObject.scale[1] ?? 1.75).toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.50"
                    max="2.00"
                    step="0.01"
                    value={selectedObject.metadata?.height_m ?? selectedObject.scale[1] ?? 1.75}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      const targetY = h / 2;
                      updateObject(selectedObject.id, {
                        scale: [
                          selectedObject.scale[0],
                          h,
                          selectedObject.scale[2],
                        ],
                        position: [selectedObject.position[0], targetY, selectedObject.position[2]],
                        metadata: {
                          ...selectedObject.metadata,
                          height_m: h,
                          eye_height_m: Number((h * 0.93).toFixed(2)),
                        },
                      });
                    }}
                    className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
                  />
                </div>

                {/* Look at Camera Toggle */}
                <label className="flex items-center space-x-2 text-[10px] font-mono text-secondary-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedObject.metadata?.look_at_camera ?? true)}
                    onChange={(e) =>
                      updateObject(selectedObject.id, {
                        metadata: { ...selectedObject.metadata, look_at_camera: e.target.checked },
                      })
                    }
                    className="accent-[var(--accent-optic)] rounded-sm cursor-pointer"
                  />
                  <span>{t.objects.lookAtCamera}</span>
                </label>

                {/* Creative Prompt / Character Identity (Qwen 2.1 / MOSS-Image) */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-1 text-[9px] text-muted-text font-mono uppercase">
                    <Sparkles className="w-2.5 h-2.5 text-optic" />
                    <span>{t.objects.characterPrompt}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={selectedObject.metadata?.character_prompt ?? ''}
                    onChange={(e) =>
                      updateObject(selectedObject.id, {
                        metadata: { ...selectedObject.metadata, character_prompt: e.target.value },
                      })
                    }
                    placeholder={t.objects.characterPromptPlaceholder}
                    className="w-full bg-elevated border border-hairline rounded-sm p-1.5 text-primary-text font-sans text-xs focus:outline-none focus:border-optic resize-none"
                  />
                </div>

                {/* Identity Reference Image URL */}
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-text font-mono uppercase block">
                    {t.objects.identityRefImage}
                  </span>
                  <input
                    type="text"
                    value={selectedObject.metadata?.identity_reference_image ?? ''}
                    onChange={(e) =>
                      updateObject(selectedObject.id, {
                        metadata: { ...selectedObject.metadata, identity_reference_image: e.target.value },
                      })
                    }
                    placeholder="https://... ou caminho local"
                    className="w-full bg-elevated border border-hairline rounded-sm px-2 py-1 text-primary-text font-mono text-[10px] focus:outline-none focus:border-optic"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Material & Appearance */}
          <div className="space-y-2.5 pt-2 border-t border-hairline">
            <div className="flex items-center space-x-1.5 text-[10px] text-primary-text font-mono font-semibold uppercase tracking-wider">
              <Palette className="w-3 h-3 text-optic" />
              <span>{t.objects.materialTitle}</span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={selectedObject.material.color}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    material: { ...selectedObject.material, color: e.target.value },
                  })
                }
                className="w-7 h-7 rounded-sm cursor-pointer bg-transparent border-0"
              />
              <span className="font-mono tabular-nums text-xs text-primary-text uppercase">
                {selectedObject.material.color}
              </span>
            </div>

            {/* Roughness & Metalness */}
            <div className="space-y-1.5 text-xs">
              <div>
                <div className="flex justify-between text-muted-text text-[10px] font-mono">
                  <span>{t.objects.roughness}</span>
                  <span className="tabular-nums text-primary-text">{selectedObject.material.roughness.toFixed(2)}</span>
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
                  className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-muted-text text-[10px] font-mono">
                  <span>{t.objects.metalness}</span>
                  <span className="tabular-nums text-primary-text">{selectedObject.material.metalness.toFixed(2)}</span>
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
                  className="w-full accent-[var(--accent-optic)] bg-elevated h-1 rounded-sm cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
