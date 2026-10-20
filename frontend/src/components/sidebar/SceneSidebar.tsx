import React, { useState, useMemo } from 'react';
import {
  Camera,
  Layers,
  Package,
  Boxes,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Check,
  Search,
  Sun,
  Aperture,
  Sliders,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { sceneApi } from '../../api/client';
import { SceneObject, CameraSettings } from '../../types/scene';
import {
  CAMERA_BODIES_LIST,
  CINE_LENSES,
  STUDIO_CATALOG_ITEMS,
  CameraBody,
  CineLens,
  StudioCatalogItem,
  CatalogCategory,
} from '../../data/cineGearInventory';
import {
  calculateCircleOfConfusionMm,
  calculateVerticalFovDeg,
  calculateHorizontalFovDeg,
  calculateDiagonalFovDeg,
  calculateDepthOfFieldM,
} from '../../utils/optics';

export type SidebarTab = 'scene' | 'gear' | 'catalog';

interface SceneSidebarProps {
  className?: string;
}

/**
 * Calculates a safe spawn position on the studio floor (Y = height / 2)
 * testing AABB bounds against existing objects to avoid overlapping collisions.
 */
function calculateSafeSpawnPosition(
  item: StudioCatalogItem,
  existingObjects: SceneObject[]
): [number, number, number] {
  const height = item.dimensions.height;
  const width = item.dimensions.width;
  const depth = item.dimensions.depth;

  // Physical studio rule: object sits flush on the floor at Y = height / 2
  const spawnY = Number((height / 2).toFixed(3));

  // Candidate offsets in priority order: center, then lateral/forward studio increments
  const candidateOffsets: [number, number][] = [
    [0, 0],
    [0.75, 0],
    [-0.75, 0],
    [0, 0.75],
    [0, -0.75],
    [1.1, 0.5],
    [-1.1, 0.5],
    [1.1, -0.5],
    [-1.1, -0.5],
    [1.6, 0],
    [-1.6, 0],
    [0, 1.5],
    [0, -1.5],
    [1.8, 0.9],
    [-1.8, 0.9],
  ];

  for (const [cx, cz] of candidateOffsets) {
    let hasCollision = false;
    const myHalfW = width / 2;
    const myHalfD = depth / 2;
    const myMinX = cx - myHalfW;
    const myMaxX = cx + myHalfW;
    const myMinZ = cz - myHalfD;
    const myMaxZ = cz + myHalfD;

    for (const obj of existingObjects) {
      if (!obj.visible) continue;
      // Backdrop cycs anchor at rear, skip full bounding collision
      if (obj.type === 'backdrop') continue;

      const objW = obj.dimensions?.width ?? (obj.scale ? obj.scale[0] : 0.5);
      const objD = obj.dimensions?.depth ?? (obj.scale ? obj.scale[2] : 0.5);
      const objX = obj.position[0];
      const objZ = obj.position[2];

      const safetyMargin = 0.12; // 12cm buffer
      const objMinX = objX - objW / 2 - safetyMargin;
      const objMaxX = objX + objW / 2 + safetyMargin;
      const objMinZ = objZ - objD / 2 - safetyMargin;
      const objMaxZ = objZ + objD / 2 + safetyMargin;

      const overlapX = myMinX < objMaxX && myMaxX > objMinX;
      const overlapZ = myMinZ < objMaxZ && myMaxZ > objMinZ;

      if (overlapX && overlapZ) {
        hasCollision = true;
        break;
      }
    }

    if (!hasCollision) {
      return [Number(cx.toFixed(3)), spawnY, Number(cz.toFixed(3))];
    }
  }

  // Fallback offset based on total scene objects count
  const fallbackX = 0.8 + 0.4 * existingObjects.length;
  return [Number(fallbackX.toFixed(3)), spawnY, 0];
}

export const SceneSidebar: React.FC<SceneSidebarProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('scene');

  // Lens Filter State
  const [lensManufacturerFilter, setLensManufacturerFilter] = useState<string>('ALL');

  // Catalog State
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<'all' | CatalogCategory>('all');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [spawnNotification, setSpawnNotification] = useState<string | null>(null);

  // Studio Store bindings
  const sceneId = useStudioStore((state) => state.sceneId);
  const objects = useStudioStore((state) => state.objects);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const camera = useStudioStore((state) => state.camera);
  const lighting = useStudioStore((state) => state.lighting);

  const selectObject = useStudioStore((state) => state.selectObject);
  const addObject = useStudioStore((state) => state.addObject);
  const updateObject = useStudioStore((state) => state.updateObject);
  const removeObject = useStudioStore((state) => state.removeObject);
  const duplicateObject = useStudioStore((state) => state.duplicateObject);
  const updateCamera = useStudioStore((state) => state.updateCamera);

  // Optical telemetry calculations
  const cocMm = calculateCircleOfConfusionMm(camera.sensorWidthMm, camera.sensorHeightMm);
  const vFov = calculateVerticalFovDeg(camera.focalLengthMm, camera.sensorHeightMm).toFixed(1);
  const hFov = calculateHorizontalFovDeg(camera.focalLengthMm, camera.sensorWidthMm).toFixed(1);
  const dFov = calculateDiagonalFovDeg(camera.focalLengthMm, camera.sensorWidthMm, camera.sensorHeightMm).toFixed(1);
  const dof = calculateDepthOfFieldM(camera.focalLengthMm, camera.fStop, camera.focusDistanceM, cocMm);
  const hyperfocalM = dof.hyperfocalM.toFixed(2);
  const nearLimitM = dof.nearLimitM.toFixed(2);
  const farLimitDisplay = dof.isHyperfocal || !Number.isFinite(dof.farLimitM) ? '∞' : `${dof.farLimitM.toFixed(2)}m`;
  const totalDofDisplay = dof.isHyperfocal || !Number.isFinite(dof.totalDofM) ? '∞' : `${dof.totalDofM.toFixed(2)}m`;

  // Filtered Cine Lenses
  const filteredLenses = useMemo(() => {
    if (lensManufacturerFilter === 'ALL') return CINE_LENSES;
    if (lensManufacturerFilter === 'ANAMORPHIC') {
      return CINE_LENSES.filter((lens) => lens.squeeze > 1.0);
    }
    return CINE_LENSES.filter((lens) => lens.manufacturer === lensManufacturerFilter);
  }, [lensManufacturerFilter]);

  // Filtered Catalog Items
  const filteredCatalogItems = useMemo(() => {
    return STUDIO_CATALOG_ITEMS.filter((item) => {
      const matchesCategory =
        catalogCategoryFilter === 'all' || item.category === catalogCategoryFilter;
      const matchesSearch =
        catalogSearchQuery.trim() === '' ||
        item.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(catalogSearchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategoryFilter, catalogSearchQuery]);

  // Instantiates a 3D catalog item with floor contact (Y = height / 2) and API sync
  const handleInstantiateCatalogItem = async (catalogItem: StudioCatalogItem) => {
    const position = calculateSafeSpawnPosition(catalogItem, objects);
    const newId = `item-${catalogItem.id}-${Date.now().toString(36)}`;

    const newObj: SceneObject = {
      id: newId,
      name: catalogItem.name,
      type: catalogItem.type,
      position,
      rotation: [0, 0, 0],
      scale: [
        catalogItem.dimensions.width,
        catalogItem.dimensions.height,
        catalogItem.dimensions.depth,
      ],
      dimensions: {
        width: catalogItem.dimensions.width,
        height: catalogItem.dimensions.height,
        depth: catalogItem.dimensions.depth,
        radius: catalogItem.dimensions.radius,
      },
      material: {
        color: catalogItem.material.color,
        roughness: catalogItem.material.roughness,
        metalness: catalogItem.material.metalness,
      },
      visible: true,
      locked: false,
    };

    // 1. Optimistic state update in StudioStore
    useStudioStore.setState((state) => ({
      objects: [...state.objects, newObj],
      selectedObjectId: newId,
      apiError: null,
    }));

    // Trigger visual notification
    setSpawnNotification(`Inserido: ${catalogItem.name}`);
    setTimeout(() => setSpawnNotification(null), 2500);

    // 2. Background synchronization with backend FastAPI
    try {
      await sceneApi.addObject(sceneId, newObj);
    } catch (err: any) {
      console.error('[SceneSidebar] Erro ao sincronizar objeto do catálogo com a API:', err);
      if (err?.validationError) {
        useStudioStore.setState({
          apiError: {
            code: err.validationError.code,
            detail: err.validationError.detail || err.message,
            objectId: err.validationError.object_id,
          },
        });
      }
    }
  };

  // Check if camera body matches current sensor size
  const isCameraBodyActive = (body: CameraBody) => {
    return (
      Math.abs(camera.sensorWidthMm - body.sensorWidthMm) < 0.15 &&
      Math.abs(camera.sensorHeightMm - body.sensorHeightMm) < 0.15
    );
  };

  // Check if cine lens matches current focal & aperture
  const isCineLensActive = (lens: CineLens) => {
    return (
      camera.focalLengthMm === lens.focalLengthMm &&
      Math.abs(camera.fStop - lens.fStop) < 0.15
    );
  };

  return (
    <aside
      className={`w-80 h-full bg-surface border-r border-hairline flex flex-col z-20 shadow-xl select-none text-primary-text font-sans ${className}`}
    >
      {/* Dock Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-chassis border-b border-hairline">
        <div className="flex items-center space-x-2">
          <Aperture className="w-3.5 h-3.5 text-optic" />
          <span className="font-mono font-semibold tracking-wider text-[11px] uppercase">
            Studio Dock
          </span>
        </div>
        <div className="flex items-center space-x-1 text-[10px] font-mono text-muted-text">
          <span className="w-1.5 h-1.5 rounded-full bg-status-ok"></span>
          <span className="tabular-nums">{objects.length} Objs</span>
        </div>
      </div>

      {/* 3-Tab Navigation */}
      <div className="flex border-b border-hairline bg-chassis font-mono text-[10px] uppercase">
        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 font-semibold border-b-2 transition-all ${
            activeTab === 'scene'
              ? 'border-optic text-optic bg-surface shadow-inner'
              : 'border-transparent text-secondary-text hover:text-primary-text hover:bg-elevated/40'
          }`}
          title="Outliner e Controle Geral da Cena"
        >
          <Layers className="w-3 h-3" />
          <span>Cena</span>
        </button>

        <button
          onClick={() => setActiveTab('gear')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 font-semibold border-b-2 transition-all ${
            activeTab === 'gear'
              ? 'border-optic text-optic bg-surface shadow-inner'
              : 'border-transparent text-secondary-text hover:text-primary-text hover:bg-elevated/40'
          }`}
          title="Corpos de Câmera e Lentes Cinematográficas"
        >
          <Camera className="w-3 h-3" />
          <span>Lentes & Câmeras</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 font-semibold border-b-2 transition-all ${
            activeTab === 'catalog'
              ? 'border-optic text-optic bg-surface shadow-inner'
              : 'border-transparent text-secondary-text hover:text-primary-text hover:bg-elevated/40'
          }`}
          title="Catálogo 3D de Estúdio, CC0 e Manequins"
        >
          <Boxes className="w-3 h-3" />
          <span>Catálogo 3D</span>
        </button>
      </div>

      {/* Spawn notification banner */}
      {spawnNotification && (
        <div className="bg-optic/15 border-b border-optic px-3 py-1.5 flex items-center justify-between text-[10px] text-optic font-mono animate-in fade-in">
          <div className="flex items-center space-x-1.5 truncate">
            <Check className="w-3 h-3 shrink-0" />
            <span className="truncate">{spawnNotification}</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-muted-text shrink-0">Y=Piso</span>
        </div>
      )}

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-hairline">
        {/* ========================================================================= */}
        {/* ABA 1: CENA / OUTLINER                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'scene' && (
          <div className="flex flex-col text-xs text-secondary-text">
            {/* Quick Geometric Primitives */}
            <div className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider">
                <div className="flex items-center space-x-1.5">
                  <Plus className="w-3 h-3 text-optic" />
                  <span>Primitivas Rápidas</span>
                </div>
                <span className="text-[9px] text-muted-text">Métrico (m)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => addObject('box')}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-sm bg-elevated border border-hairline hover:border-optic/50 hover:bg-interactive-hover text-primary-text transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-optic" />
                  <span className="font-medium text-[11px]">Cubo 0.5m</span>
                </button>
                <button
                  onClick={() => addObject('cylinder')}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-sm bg-elevated border border-hairline hover:border-optic/50 hover:bg-interactive-hover text-primary-text transition-colors"
                >
                  <div className="w-3.5 h-3.5 rounded-full border border-optic flex items-center justify-center text-[8px] font-mono text-optic">
                    C
                  </div>
                  <span className="font-medium text-[11px]">Cilindro 0.8m</span>
                </button>
                <button
                  onClick={() => addObject('sphere')}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-sm bg-elevated border border-hairline hover:border-optic/50 hover:bg-interactive-hover text-primary-text transition-colors"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-optic/20 border border-optic flex items-center justify-center text-[8px] font-mono text-optic">
                    S
                  </div>
                  <span className="font-medium text-[11px]">Esfera 0.6m</span>
                </button>
                <button
                  onClick={() => addObject('table')}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-sm bg-elevated border border-hairline hover:border-optic/50 hover:bg-interactive-hover text-primary-text transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-optic" />
                  <span className="font-medium text-[11px]">Mesa 1.2m</span>
                </button>
              </div>
            </div>

            {/* Outliner Scene Objects List */}
            <div className="p-3.5 space-y-2">
              <div className="flex justify-between items-center text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider">
                <div className="flex items-center space-x-1.5">
                  <Package className="w-3 h-3 text-optic" />
                  <span>Outliner da Cena ({objects.length})</span>
                </div>
                <span className="text-[9px] text-muted-text">Hierarquia</span>
              </div>

              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {objects.map((obj) => {
                  const isSelected = obj.id === selectedObjectId;
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
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-hairline"
                          style={{ backgroundColor: obj.material.color }}
                        />
                        <span className="truncate font-mono text-[11px] font-medium">{obj.name}</span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Lock Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateObject(obj.id, { locked: !obj.locked });
                          }}
                          className={`p-1 rounded transition-colors ${
                            obj.locked
                              ? 'text-optic bg-optic/10'
                              : 'text-muted-text hover:text-primary-text'
                          }`}
                          title={obj.locked ? 'Bloqueado no piso' : 'Desbloqueado'}
                        >
                          {obj.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>

                        {/* Visibility Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateObject(obj.id, { visible: !obj.visible });
                          }}
                          className={`p-1 rounded transition-colors ${
                            obj.visible
                              ? 'text-secondary-text hover:text-primary-text'
                              : 'text-muted-text opacity-40'
                          }`}
                          title={obj.visible ? 'Ocultar Objeto' : 'Mostrar Objeto'}
                        >
                          {obj.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>

                        {/* Actions for Selected Object */}
                        {isSelected && !obj.locked && (
                          <div className="flex items-center space-x-1 pl-1 border-l border-hairline">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateObject(obj.id);
                              }}
                              className="p-1 text-muted-text hover:text-primary-text rounded transition-colors"
                              title="Duplicar Objeto"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeObject(obj.id);
                              }}
                              className="p-1 text-tally/80 hover:text-tally rounded transition-colors"
                              title="Excluir Objeto"
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

            {/* Studio Lighting Rig Summary */}
            <div className="p-3.5 space-y-2.5 border-t border-hairline">
              <div className="flex items-center justify-between text-[10px] text-muted-text font-mono font-semibold uppercase tracking-wider">
                <div className="flex items-center space-x-1.5">
                  <Sun className="w-3 h-3 text-optic" />
                  <span>Setup de Iluminação (3 Pontos)</span>
                </div>
                <span className="text-[9px] text-status-ok font-mono">Calibrado</span>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                {/* Key Light */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-elevated border border-hairline">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-hairline"
                      style={{ backgroundColor: lighting.keyLight.color }}
                    />
                    <span className="text-primary-text font-medium">Key Light</span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-text tabular-nums">
                    <span>{Math.round(lighting.keyLight.intensity * 100)}%</span>
                    <span className="text-[9px] text-optic font-sans">
                      {lighting.keyLight.castShadow ? 'Sombra' : 'Sem Sombra'}
                    </span>
                  </div>
                </div>

                {/* Fill Light */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-elevated border border-hairline">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-hairline"
                      style={{ backgroundColor: lighting.fillLight.color }}
                    />
                    <span className="text-primary-text font-medium">Fill Light</span>
                  </div>
                  <div className="text-muted-text tabular-nums">
                    <span>{Math.round(lighting.fillLight.intensity * 100)}%</span>
                  </div>
                </div>

                {/* Rim Light */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-elevated border border-hairline">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-hairline"
                      style={{ backgroundColor: lighting.rimLight.color }}
                    />
                    <span className="text-primary-text font-medium">Rim Light</span>
                  </div>
                  <div className="text-muted-text tabular-nums">
                    <span>{Math.round(lighting.rimLight.intensity * 100)}%</span>
                  </div>
                </div>

                {/* Ambient Light */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-elevated border border-hairline">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-hairline"
                      style={{ backgroundColor: lighting.ambientColor }}
                    />
                    <span className="text-primary-text font-medium">Luz Ambiente</span>
                  </div>
                  <div className="text-muted-text tabular-nums">
                    <span>{Math.round(lighting.ambientIntensity * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: LENTES & CÂMERAS (CINE GEAR INVENTORY)                             */}
        {/* ========================================================================= */}
        {activeTab === 'gear' && (
          <div className="flex flex-col text-xs text-secondary-text p-3.5 space-y-4">
            {/* Live Optical Telemetry HUD */}
            <div className="rounded-sm bg-chassis border border-specular p-2.5 space-y-2 shadow-inner">
              <div className="flex items-center justify-between border-b border-hairline pb-1.5">
                <div className="flex items-center space-x-1.5 font-mono text-[10px] text-optic font-semibold uppercase tracking-wider">
                  <Aperture className="w-3 h-3" />
                  <span>Telemetria Óptica Ativa</span>
                </div>
                <span className="font-mono text-[9px] text-status-ok">Full-Frame Link</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                <div className="space-y-0.5">
                  <span className="text-muted-text text-[9px] uppercase">Lente / Abertura</span>
                  <div className="text-primary-text font-semibold tabular-nums text-[11px]">
                    {camera.focalLengthMm}mm <span className="text-optic font-normal">f/{camera.fStop}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-muted-text text-[9px] uppercase">Sensor Físico</span>
                  <div className="text-primary-text font-semibold tabular-nums text-[11px]">
                    {camera.sensorWidthMm.toFixed(1)}×{camera.sensorHeightMm.toFixed(1)}mm
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-muted-text text-[9px] uppercase">Campo de Visão (V / H / D)</span>
                  <div className="text-secondary-text tabular-nums">
                    {vFov}° / {hFov}° / {dFov}°
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-muted-text text-[9px] uppercase">CoC / Hiperfocal</span>
                  <div className="text-secondary-text tabular-nums">
                    {cocMm.toFixed(3)}mm / {hyperfocalM}m
                  </div>
                </div>

                <div className="col-span-2 pt-1 border-t border-hairline/60 flex items-center justify-between text-[9px]">
                  <span className="text-muted-text">Profundidade de Campo (DoF):</span>
                  <span className="text-primary-text tabular-nums">
                    {nearLimitM}m → {farLimitDisplay} ({totalDofDisplay})
                  </span>
                </div>
              </div>
            </div>

            {/* Real Camera Bodies & Sensors Catalog */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-mono text-[10px] uppercase font-semibold text-primary-text tracking-wider">
                  <Camera className="w-3 h-3 text-optic" />
                  <span>Corpos de Câmera & Sensores</span>
                </div>
                <span className="text-[9px] font-mono text-muted-text">7 Corpos</span>
              </div>
              <p className="text-[10px] text-muted-text leading-tight">
                Calibrados com dimensões de sensor oficiais, aspect ratio e CoC real.
              </p>

              <div className="space-y-1.5">
                {CAMERA_BODIES_LIST.map((body) => {
                  const active = isCameraBodyActive(body);
                  return (
                    <button
                      key={body.id}
                      onClick={() =>
                        updateCamera({
                          sensorWidthMm: body.sensorWidthMm,
                          sensorHeightMm: body.sensorHeightMm,
                          aspectRatio: body.aspectRatio,
                        })
                      }
                      className={`w-full text-left p-2 rounded-sm border transition-all ${
                        active
                          ? 'bg-optic/10 border-optic text-primary-text shadow-sm'
                          : 'bg-elevated border-hairline hover:border-specular text-secondary-text hover:text-primary-text'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-[11px] text-primary-text">
                              {body.name}
                            </span>
                            {active && (
                              <span className="text-[8px] font-mono font-bold bg-optic text-void px-1 rounded-sm uppercase">
                                Ativo
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] font-mono text-optic mt-0.5">
                            {body.formatBadge}
                          </div>
                        </div>
                        <div className="text-right font-mono text-[9px] text-muted-text tabular-nums">
                          <div>{body.sensorWidthMm} × {body.sensorHeightMm}mm</div>
                          <div>Crop {body.cropFactor.toFixed(2)}x</div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-text mt-1 line-clamp-1 leading-snug">
                        {body.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cine Lenses Library */}
            <div className="space-y-2 pt-2 border-t border-hairline">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-mono text-[10px] uppercase font-semibold text-primary-text tracking-wider">
                  <Sliders className="w-3 h-3 text-optic" />
                  <span>Lentes Cinematográficas</span>
                </div>
                <span className="text-[9px] font-mono text-muted-text">
                  {filteredLenses.length} Lentes
                </span>
              </div>

              {/* Manufacturer / Series Quick Filter */}
              <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                {[
                  { key: 'ALL', label: 'Todas' },
                  { key: 'ARRI', label: 'ARRI' },
                  { key: 'Cooke', label: 'Cooke' },
                  { key: 'Leitz', label: 'Leitz' },
                  { key: 'ANAMORPHIC', label: 'Anamórfica 2x' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setLensManufacturerFilter(f.key)}
                    className={`px-2 py-0.5 rounded-sm border transition-colors ${
                      lensManufacturerFilter === f.key
                        ? 'bg-optic text-void font-bold border-optic'
                        : 'bg-elevated text-secondary-text border-hairline hover:text-primary-text'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Lenses Cards List */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {filteredLenses.map((lens) => {
                  const active = isCineLensActive(lens);
                  return (
                    <button
                      key={lens.id}
                      onClick={() => {
                        const updates: Partial<CameraSettings> = {
                          focalLengthMm: lens.focalLengthMm,
                          fStop: lens.fStop,
                        };
                        if (lens.aspectRatio) {
                          updates.aspectRatio = lens.aspectRatio;
                        }
                        updateCamera(updates);
                      }}
                      className={`w-full text-left p-2 rounded-sm border transition-all ${
                        active
                          ? 'bg-optic/10 border-optic text-primary-text shadow-sm'
                          : 'bg-elevated border-hairline hover:border-specular text-secondary-text hover:text-primary-text'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-[11px] text-primary-text">
                            {lens.name}
                          </span>
                          {active && (
                            <span className="text-[8px] font-mono font-bold bg-optic text-void px-1 rounded-sm uppercase">
                              Acoplada
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-[11px] text-optic tabular-nums">
                          {lens.maxApertureLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-muted-text">
                        <span>{lens.series}</span>
                        <span className="tabular-nums">
                          {lens.apertureBlades} lâminas • Min {lens.closeFocusM}m
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-hairline/50 text-[9px]">
                        <span className="text-secondary-text italic truncate pr-2">
                          "{lens.character}"
                        </span>
                        {lens.squeeze > 1.0 && (
                          <span className="text-tally font-mono font-semibold shrink-0 uppercase text-[8px]">
                            2.39:1 Squeeze
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: CATÁLOGO 3D (ESTÚDIO, CC0 & MANEQUINS POSÁVEIS)                    */}
        {/* ========================================================================= */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col text-xs text-secondary-text p-3.5 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-text" />
              <input
                type="text"
                value={catalogSearchQuery}
                onChange={(e) => setCatalogSearchQuery(e.target.value)}
                placeholder="Buscar mobiliário, CC0, manequim..."
                className="w-full bg-elevated border border-hairline rounded-sm pl-8 pr-2.5 py-1.5 text-xs text-primary-text placeholder:text-muted-text focus:outline-none focus:border-optic transition-colors"
              />
            </div>

            {/* Category Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 font-mono text-[9px]">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'furniture', label: 'Móveis' },
                { id: 'cc0_props', label: 'CC0' },
                { id: 'mannequins', label: 'Manequins' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCatalogCategoryFilter(cat.id as any)}
                  className={`py-1 text-center rounded-sm border transition-colors ${
                    catalogCategoryFilter === cat.id
                      ? 'bg-optic text-void font-bold border-optic'
                      : 'bg-elevated text-secondary-text border-hairline hover:text-primary-text'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Catalog Items List */}
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-4 text-center text-muted-text font-mono text-[10px]">
                  Nenhum item encontrado no catálogo.
                </div>
              ) : (
                filteredCatalogItems.map((item) => {
                  const dims = item.dimensions;
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-sm bg-elevated border border-hairline hover:border-specular transition-all flex flex-col space-y-1.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          {/* Item Category Visual Badge */}
                          <div
                            className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0"
                            style={{ backgroundColor: item.material.color }}
                          >
                            {item.category === 'mannequins' ? (
                              <User className="w-2.5 h-2.5 text-void" />
                            ) : (
                              <Package className="w-2.5 h-2.5 text-void" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-primary-text text-[11px] leading-tight">
                              {item.name}
                            </div>
                            <div className="text-[9px] font-mono text-muted-text">
                              {item.categoryLabel}
                            </div>
                          </div>
                        </div>

                        {/* License / Pose Badge */}
                        <div className="text-right">
                          {item.license ? (
                            <span className="text-[8px] font-mono bg-chassis px-1 py-0.5 rounded border border-hairline text-optic">
                              {item.license}
                            </span>
                          ) : item.pose ? (
                            <span className="text-[8px] font-mono bg-optic/10 text-optic px-1 py-0.5 rounded border border-optic/30">
                              Pose Real
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-text leading-snug line-clamp-2">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-hairline font-mono text-[9px]">
                        <div className="text-secondary-text tabular-nums">
                          {dims.width.toFixed(2)} × {dims.height.toFixed(2)} × {dims.depth.toFixed(2)} m
                        </div>

                        <button
                          onClick={() => handleInstantiateCatalogItem(item)}
                          className="flex items-center space-x-1 px-2 py-1 rounded-sm bg-optic text-void font-bold hover:brightness-110 active:scale-95 transition-all text-[9px] uppercase tracking-wider"
                          title="Instanciar objeto no estúdio cravado no piso e sem colisão"
                        >
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Safe Spawn Floor Anchor Footer Note */}
            <div className="p-2 bg-chassis rounded-sm border border-hairline flex items-center space-x-2 text-[9px] text-muted-text font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-optic shrink-0" />
              <span>
                Física Ativa: Spawn automático com AABB anti-colisão e base cravada no piso (Y = H/2).
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default SceneSidebar;
