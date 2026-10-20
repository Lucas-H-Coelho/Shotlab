import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Download, Compass, Sun, Camera, RefreshCw, Sliders, Check, Layers } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { useTranslation } from '../../i18n';
import { calculateHorizontalFovDeg } from '../../utils/optics';
import { SceneObject, CameraSettings, StudioLighting } from '../../types/scene';

interface SetPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SetPlanAnalysisData {
  sceneId: string;
  sceneName: string;
  camera: {
    focalLengthMm: number;
    fStop: number;
    sensorWidthMm: number;
    sensorHeightMm: number;
    hfovDeg: number;
    distanceToSubjectM: number;
    position: [number, number, number];
  };
  subject: {
    name: string;
    position: [number, number, number];
  };
  distancesM: Record<string, number>;
  lightingAnalysis: {
    key: {
      name: string;
      dist3d: number;
      dist2d: number;
      azimuth: number;
      elevation: number;
      intensity: number;
      color: string;
    };
    fill: {
      name: string;
      dist3d: number;
      dist2d: number;
      azimuth: number;
      elevation: number;
      intensity: number;
      color: string;
    };
    rim: {
      name: string;
      dist3d: number;
      dist2d: number;
      azimuth: number;
      elevation: number;
      intensity: number;
      color: string;
    };
  };
  lightingRatio: string;
  svg: string;
  isOffline: boolean;
}

// Local helper to calculate light geometry relative to camera sight line
function computeLocalLightGeometry(
  camPos: [number, number, number],
  subjPos: [number, number, number],
  lightPos: [number, number, number]
): { dist3d: number; dist2d: number; azimuth: number; elevation: number } {
  const dx = lightPos[0] - subjPos[0];
  const dy = lightPos[1] - subjPos[1];
  const dz = lightPos[2] - subjPos[2];

  const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dist2d = Math.sqrt(dx * dx + dz * dz);

  const elevation = dist2d > 1e-5 ? (Math.atan2(dy, dist2d) * 180) / Math.PI : 90;

  const fcX = subjPos[0] - camPos[0];
  const fcZ = subjPos[2] - camPos[2];
  const fcLen = Math.sqrt(fcX * fcX + fcZ * fcZ);

  let azimuth = 0;
  if (fcLen > 1e-5) {
    const fx = fcX / fcLen;
    const fz = fcZ / fcLen;
    const rx = -fz;
    const rz = fx;

    if (dist2d > 1e-5) {
      const lx = dx / dist2d;
      const lz = dz / dist2d;
      const dotF = lx * fx + lz * fz;
      const dotR = lx * rx + lz * rz;
      azimuth = (Math.atan2(dotR, dotF) * 180) / Math.PI;
    }
  }

  return {
    dist3d: Math.round(dist3d * 100) / 100,
    dist2d: Math.round(dist2d * 100) / 100,
    azimuth: Math.round(azimuth),
    elevation: Math.round(elevation),
  };
}

// Local SVG Vector Blueprint Generator
function generateLocalSetPlanSvg(
  camera: CameraSettings,
  lighting: StudioLighting,
  objects: SceneObject[],
  subjectPos: [number, number, number],
  subjectName: string
): string {
  const svgW = 1000;
  const svgH = 1000;
  const centerX = 500.0;
  const centerZ = 520.0;
  const scalePxPerM = 90.0; // 1m = 90px

  const mToPx = (x: number, z: number): [number, number] => [
    centerX + x * scalePxPerM,
    centerZ + z * scalePxPerM,
  ];

  const [subjPx, subjPz] = mToPx(subjectPos[0], subjectPos[2]);
  const [camPx, camPz] = mToPx(camera.position[0], camera.position[2]);

  const hfovDeg = calculateHorizontalFovDeg(camera.focalLengthMm, camera.sensorWidthMm);
  const halfHfovRad = ((hfovDeg / 2) * Math.PI) / 180;

  const camDx = subjectPos[0] - camera.position[0];
  const camDz = subjectPos[2] - camera.position[2];
  const opticalAngleRad = Math.atan2(camDz, camDx);

  const fovReachM = Math.max(4.0, Math.sqrt(camDx * camDx + camDz * camDz) + 1.2);
  const fovReachPx = fovReachM * scalePxPerM;

  const fovLeftAngle = opticalAngleRad - halfHfovRad;
  const fovRightAngle = opticalAngleRad + halfHfovRad;

  const fovLeftX = camPx + Math.cos(fovLeftAngle) * fovReachPx;
  const fovLeftZ = camPz + Math.sin(fovLeftAngle) * fovReachPx;
  const fovRightX = camPx + Math.cos(fovRightAngle) * fovReachPx;
  const fovRightZ = camPz + Math.sin(fovRightAngle) * fovReachPx;

  // Grid lines
  const gridLines: string[] = [];
  for (let mx = -5; mx <= 5; mx++) {
    const [gx] = mToPx(mx, 0);
    const isAxis = mx === 0;
    const strokeCol = isAxis ? '#2a3241' : '#161b24';
    const strokeW = isAxis ? '1.5' : '1.0';
    gridLines.push(
      `<line x1="${gx.toFixed(1)}" y1="110" x2="${gx.toFixed(1)}" y2="920" stroke="${strokeCol}" stroke-width="${strokeW}"/>`
    );
    if (!isAxis && mx >= -4 && mx <= 4) {
      gridLines.push(
        `<text x="${gx.toFixed(1)}" y="936" font-family="monospace" font-size="9" fill="#475569" text-anchor="middle">${mx > 0 ? '+' : ''}${mx}m</text>`
      );
    }
  }

  for (let mz = -4; mz <= 4; mz++) {
    const [, gz] = mToPx(0, mz);
    const isAxis = mz === 0;
    const strokeCol = isAxis ? '#2a3241' : '#161b24';
    const strokeW = isAxis ? '1.5' : '1.0';
    gridLines.push(
      `<line x1="60" y1="${gz.toFixed(1)}" x2="940" y2="${gz.toFixed(1)}" stroke="${strokeCol}" stroke-width="${strokeW}"/>`
    );
    if (!isAxis) {
      gridLines.push(
        `<text x="50" y="${(gz + 3).toFixed(1)}" font-family="monospace" font-size="9" fill="#475569" text-anchor="end">${mz > 0 ? '+' : ''}${mz}m</text>`
      );
    }
  }

  // Objects
  const renderedObjects: string[] = [];
  for (const obj of objects) {
    const [ox, oz] = mToPx(obj.position[0], obj.position[2]);
    const wPx = obj.scale[0] * scalePxPerM;
    const dPx = obj.scale[2] * scalePxPerM;
    const rotDeg = (obj.rotation[1] * 180) / Math.PI;

    if (obj.type === 'backdrop') {
      renderedObjects.push(`
        <g id="obj-${obj.id}" transform="translate(${ox.toFixed(1)}, ${oz.toFixed(1)}) rotate(${rotDeg.toFixed(1)})">
          <rect x="${(-wPx / 2).toFixed(1)}" y="${(-dPx / 2).toFixed(1)}" width="${wPx.toFixed(1)}" height="${dPx.toFixed(1)}" rx="12" fill="#151b23" stroke="#374151" stroke-width="2"/>
          <path d="M ${(-wPx / 2 + 8).toFixed(1)} ${(-dPx / 2 + 10).toFixed(1)} L ${(wPx / 2 - 8).toFixed(1)} ${(-dPx / 2 + 10).toFixed(1)}" stroke="#475569" stroke-width="3" stroke-dasharray="4,4"/>
          <text x="0" y="5" font-family="monospace" font-size="11" fill="#94a3b8" text-anchor="middle" font-weight="600">${obj.name.toUpperCase()}</text>
          <text x="0" y="20" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">${obj.scale[0].toFixed(1)}m × ${obj.scale[1].toFixed(1)}m</text>
        </g>
      `);
    } else {
      renderedObjects.push(`
        <g id="obj-${obj.id}" transform="translate(${ox.toFixed(1)}, ${oz.toFixed(1)}) rotate(${rotDeg.toFixed(1)})">
          <rect x="${(-wPx / 2).toFixed(1)}" y="${(-dPx / 2).toFixed(1)}" width="${wPx.toFixed(1)}" height="${dPx.toFixed(1)}" rx="4" fill="#1e2430" stroke="#3b82f6" stroke-width="1.2"/>
          <text x="0" y="4" font-family="monospace" font-size="9" fill="#93c5fd" text-anchor="middle">${obj.name}</text>
        </g>
      `);
    }
  }

  // Lights rendering
  const [kPx, kPz] = mToPx(lighting.keyLight.position[0], lighting.keyLight.position[2]);
  const [fPx, fPz] = mToPx(lighting.fillLight.position[0], lighting.fillLight.position[2]);
  const [rPx, rPz] = mToPx(lighting.rimLight.position[0], lighting.rimLight.position[2]);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%">
  <defs>
    <radialGradient id="studio-vignette" cx="50%" cy="52%" r="65%">
      <stop offset="0%" stop-color="#12161f" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#0b0c0e" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#050607" stop-opacity="1.0"/>
    </radialGradient>
    <radialGradient id="fov-glow" cx="0%" cy="0%" r="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.18"/>
      <stop offset="65%" stop-color="#f59e0b" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
    </radialGradient>
    <linearGradient id="key-beam" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.01"/>
    </linearGradient>
    <linearGradient id="fill-beam" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#93c5fd" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#93c5fd" stop-opacity="0.01"/>
    </linearGradient>
    <linearGradient id="rim-beam" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#c084fc" stop-opacity="0.01"/>
    </linearGradient>
  </defs>

  <!-- Studio Floor & Blueprint Background -->
  <rect width="${svgW}" height="${svgH}" fill="#0b0c0e"/>
  <rect width="${svgW}" height="${svgH}" fill="url(#studio-vignette)"/>

  <!-- Metric Studio Grid (1.0m × 1.0m) -->
  <g id="metric-grid" opacity="0.65">
    ${gridLines.join('\n    ')}
  </g>

  <!-- Title & Blueprint Header -->
  <g id="blueprint-header">
    <rect x="60" y="30" width="880" height="65" rx="6" fill="#10141d" stroke="#1f2937" stroke-width="1.2"/>
    <text x="80" y="55" font-family="monospace" font-size="14" fill="#f8fafc" font-weight="700" letter-spacing="1.5">SHOTLAB • STUDIO SET PLAN 2D</text>
    <text x="80" y="75" font-family="monospace" font-size="10" fill="#94a3b8">DIAGRAMA TÉCNICO TOP-DOWN • ESCALA 1:1 METROS • OPTICAL PRO</text>
    <text x="920" y="55" font-family="monospace" font-size="11" fill="#f59e0b" font-weight="600" text-anchor="end">CAM: ${camera.focalLengthMm}mm f/${camera.fStop}</text>
    <text x="920" y="75" font-family="monospace" font-size="10" fill="#64748b" text-anchor="end">HFOV: ${hfovDeg.toFixed(1)}° | DIST: ${(Math.sqrt(camDx * camDx + camDz * camDz)).toFixed(2)}m</text>
  </g>

  <!-- Scene Objects -->
  ${renderedObjects.join('\n')}

  <!-- Camera FOV Light Cone -->
  <path d="M ${camPx.toFixed(1)} ${camPz.toFixed(1)} L ${fovLeftX.toFixed(1)} ${fovLeftZ.toFixed(1)} A ${fovReachPx.toFixed(1)} ${fovReachPx.toFixed(1)} 0 0 1 ${fovRightX.toFixed(1)} ${fovRightZ.toFixed(1)} Z" fill="url(#fov-glow)"/>
  <line x1="${camPx.toFixed(1)}" y1="${camPz.toFixed(1)}" x2="${fovLeftX.toFixed(1)}" y2="${fovLeftZ.toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="6,4" opacity="0.8"/>
  <line x1="${camPx.toFixed(1)}" y1="${camPz.toFixed(1)}" x2="${fovRightX.toFixed(1)}" y2="${fovRightZ.toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="6,4" opacity="0.8"/>

  <!-- Optical Sight Line (Camera -> Subject) -->
  <line x1="${camPx.toFixed(1)}" y1="${camPz.toFixed(1)}" x2="${subjPx.toFixed(1)}" y2="${subjPz.toFixed(1)}" stroke="#f59e0b" stroke-width="1.8"/>

  <!-- Light Beam Lines to Subject -->
  <line x1="${kPx.toFixed(1)}" y1="${kPz.toFixed(1)}" x2="${subjPx.toFixed(1)}" y2="${subjPz.toFixed(1)}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.75"/>
  <line x1="${fPx.toFixed(1)}" y1="${fPz.toFixed(1)}" x2="${subjPx.toFixed(1)}" y2="${subjPz.toFixed(1)}" stroke="#93c5fd" stroke-width="1.2" stroke-dasharray="4,3" opacity="0.75"/>
  <line x1="${rPx.toFixed(1)}" y1="${rPz.toFixed(1)}" x2="${subjPx.toFixed(1)}" y2="${subjPz.toFixed(1)}" stroke="#c084fc" stroke-width="1.2" stroke-dasharray="4,3" opacity="0.75"/>

  <!-- Key Light Modifier Graphic (Softbox) -->
  <g id="light-key" transform="translate(${kPx.toFixed(1)}, ${kPz.toFixed(1)})">
    <circle cx="0" cy="0" r="16" fill="#1c1917" stroke="#fbbf24" stroke-width="2"/>
    <rect x="-12" y="-6" width="24" height="12" rx="2" fill="#fbbf24" opacity="0.9"/>
    <text x="0" y="28" font-family="monospace" font-size="10" fill="#fbbf24" font-weight="700" text-anchor="middle">KEY LIGHT</text>
    <text x="0" y="40" font-family="monospace" font-size="8" fill="#d97706" text-anchor="middle">${lighting.keyLight.intensity.toFixed(1)}x | Y: ${lighting.keyLight.position[1].toFixed(1)}m</text>
  </g>

  <!-- Fill Light Modifier Graphic -->
  <g id="light-fill" transform="translate(${fPx.toFixed(1)}, ${fPz.toFixed(1)})">
    <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#93c5fd" stroke-width="1.8"/>
    <rect x="-10" y="-5" width="20" height="10" rx="2" fill="#93c5fd" opacity="0.85"/>
    <text x="0" y="26" font-family="monospace" font-size="10" fill="#93c5fd" font-weight="700" text-anchor="middle">FILL LIGHT</text>
    <text x="0" y="38" font-family="monospace" font-size="8" fill="#60a5fa" text-anchor="middle">${lighting.fillLight.intensity.toFixed(1)}x | Y: ${lighting.fillLight.position[1].toFixed(1)}m</text>
  </g>

  <!-- Rim Light Modifier Graphic -->
  <g id="light-rim" transform="translate(${rPx.toFixed(1)}, ${rPz.toFixed(1)})">
    <circle cx="0" cy="0" r="13" fill="#180d24" stroke="#c084fc" stroke-width="1.8"/>
    <rect x="-9" y="-4" width="18" height="8" rx="2" fill="#c084fc" opacity="0.85"/>
    <text x="0" y="25" font-family="monospace" font-size="10" fill="#c084fc" font-weight="700" text-anchor="middle">RIM LIGHT</text>
    <text x="0" y="37" font-family="monospace" font-size="8" fill="#a855f7" text-anchor="middle">${lighting.rimLight.intensity.toFixed(1)}x | Y: ${lighting.rimLight.position[1].toFixed(1)}m</text>
  </g>

  <!-- Primary Subject Target -->
  <g id="subject-target" transform="translate(${subjPx.toFixed(1)}, ${subjPz.toFixed(1)})">
    <circle cx="0" cy="0" r="22" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    <circle cx="0" cy="0" r="8" fill="#38bdf8"/>
    <line x1="-28" y1="0" x2="28" y2="0" stroke="#38bdf8" stroke-width="1.2"/>
    <line x1="0" y1="-28" x2="0" y2="28" stroke="#38bdf8" stroke-width="1.2"/>
    <text x="0" y="-32" font-family="monospace" font-size="11" fill="#38bdf8" font-weight="700" text-anchor="middle">${subjectName.toUpperCase()}</text>
  </g>

  <!-- Camera Graphic Body -->
  <g id="camera-body" transform="translate(${camPx.toFixed(1)}, ${camPz.toFixed(1)})">
    <circle cx="0" cy="0" r="24" fill="#0f172a" stroke="#f59e0b" stroke-width="2.5"/>
    <polygon points="0,-18 14,12 -14,12" fill="#f59e0b"/>
    <circle cx="0" cy="0" r="6" fill="#0f172a"/>
    <text x="0" y="34" font-family="monospace" font-size="11" fill="#f59e0b" font-weight="700" text-anchor="middle">CAMERA</text>
    <text x="0" y="47" font-family="monospace" font-size="8" fill="#d97706" text-anchor="middle">Y: ${camera.position[1].toFixed(2)}m</text>
  </g>

  <!-- Compass Rose -->
  <g id="compass" transform="translate(900, 160)">
    <circle cx="0" cy="0" r="20" fill="#111827" stroke="#374151" stroke-width="1"/>
    <line x1="0" y1="-16" x2="0" y2="16" stroke="#475569" stroke-width="1"/>
    <line x1="-16" y1="0" x2="16" y2="0" stroke="#475569" stroke-width="1"/>
    <polygon points="0,-18 4,-6 -4,-6" fill="#ef4444"/>
    <text x="0" y="-22" font-family="monospace" font-size="9" fill="#ef4444" font-weight="700" text-anchor="middle">N (-Z)</text>
  </g>
</svg>
  `.trim();
}

export const SetPlanModal: React.FC<SetPlanModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const sceneId = useStudioStore((state) => state.sceneId);
  const sceneName = useStudioStore((state) => state.sceneName);
  const camera = useStudioStore((state) => state.camera);
  const lighting = useStudioStore((state) => state.lighting);
  const objects = useStudioStore((state) => state.objects);

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<SetPlanAnalysisData | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Subject resolution
  const resolvedSubject = useMemo(() => {
    const candidate =
      objects.find((o) => o.metadata?.is_character || o.name.toLowerCase().includes('manequim') || o.name.toLowerCase().includes('hero') || o.name.toLowerCase().includes('sujeito')) ||
      objects.find((o) => o.type !== 'backdrop');
    return {
      name: candidate ? candidate.name : 'Ponto Focal (Alvo)',
      position: candidate ? candidate.position : camera.target,
    };
  }, [objects, camera.target]);

  // Fetch set-plan from backend or fall back to local SVG
  const loadSetPlan = useCallback(async () => {
    setIsLoading(true);
    const sid = sceneId || 'scene-default';

    try {
      const res = await fetch(`http://localhost:8000/v1/scenes/${sid}/set-plan`, {
        headers: { Accept: 'application/json' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        setData({
          sceneId: json.scene_id || sid,
          sceneName: json.scene_name || sceneName,
          camera: {
            focalLengthMm: json.camera?.focal_length_mm ?? camera.focalLengthMm,
            fStop: json.camera?.f_stop ?? camera.fStop,
            sensorWidthMm: json.camera?.sensor_width_mm ?? camera.sensorWidthMm,
            sensorHeightMm: json.camera?.sensor_height_mm ?? camera.sensorHeightMm,
            hfovDeg: json.camera?.fov_horizontal_deg ?? calculateHorizontalFovDeg(camera.focalLengthMm, camera.sensorWidthMm),
            distanceToSubjectM: json.camera?.distance_to_subject_m ?? 2.5,
            position: json.camera?.position_m ?? camera.position,
          },
          subject: {
            name: json.subject?.name ?? resolvedSubject.name,
            position: json.subject?.position_m ?? resolvedSubject.position,
          },
          distancesM: json.distances_m || {},
          lightingAnalysis: {
            key: {
              name: json.lighting_analysis?.key_light?.name ?? 'Key Light',
              dist3d: json.lighting_analysis?.key_light?.distance_to_subject_m ?? 3.5,
              dist2d: json.lighting_analysis?.key_light?.distance_to_subject_2d_m ?? 2.8,
              azimuth: json.lighting_analysis?.key_light?.azimuth_deg ?? 45,
              elevation: json.lighting_analysis?.key_light?.elevation_deg ?? 35,
              intensity: json.lighting_analysis?.key_light?.intensity ?? lighting.keyLight.intensity,
              color: json.lighting_analysis?.key_light?.color_hex ?? lighting.keyLight.color,
            },
            fill: {
              name: json.lighting_analysis?.fill_light?.name ?? 'Fill Light',
              dist3d: json.lighting_analysis?.fill_light?.distance_to_subject_m ?? 3.2,
              dist2d: json.lighting_analysis?.fill_light?.distance_to_subject_2d_m ?? 2.6,
              azimuth: json.lighting_analysis?.fill_light?.azimuth_deg ?? -45,
              elevation: json.lighting_analysis?.fill_light?.elevation_deg ?? 25,
              intensity: json.lighting_analysis?.fill_light?.intensity ?? lighting.fillLight.intensity,
              color: json.lighting_analysis?.fill_light?.color_hex ?? lighting.fillLight.color,
            },
            rim: {
              name: json.lighting_analysis?.rim_light?.name ?? 'Rim Light',
              dist3d: json.lighting_analysis?.rim_light?.distance_to_subject_m ?? 3.0,
              dist2d: json.lighting_analysis?.rim_light?.distance_to_subject_2d_m ?? 2.5,
              azimuth: json.lighting_analysis?.rim_light?.azimuth_deg ?? 160,
              elevation: json.lighting_analysis?.rim_light?.elevation_deg ?? 40,
              intensity: json.lighting_analysis?.rim_light?.intensity ?? lighting.rimLight.intensity,
              color: json.lighting_analysis?.rim_light?.color_hex ?? lighting.rimLight.color,
            },
          },
          lightingRatio: json.lighting_ratio || '2:1',
          svg: json.svg,
          isOffline: false,
        });
        setIsLoading(false);
        return;
      }
    } catch {
      // Fallback to local computation
    }

    // Local Fallback Computation
    const keyGeo = computeLocalLightGeometry(camera.position, resolvedSubject.position, lighting.keyLight.position);
    const fillGeo = computeLocalLightGeometry(camera.position, resolvedSubject.position, lighting.fillLight.position);
    const rimGeo = computeLocalLightGeometry(camera.position, resolvedSubject.position, lighting.rimLight.position);

    const cDx = camera.position[0] - resolvedSubject.position[0];
    const cDy = camera.position[1] - resolvedSubject.position[1];
    const cDz = camera.position[2] - resolvedSubject.position[2];
    const camDist3d = Math.round(Math.sqrt(cDx * cDx + cDy * cDy + cDz * cDz) * 100) / 100;

    const ratioVal = lighting.fillLight.intensity > 0 ? (lighting.keyLight.intensity / lighting.fillLight.intensity).toFixed(1) : '1.0';

    const localSvg = generateLocalSetPlanSvg(camera, lighting, objects, resolvedSubject.position, resolvedSubject.name);

    setData({
      sceneId: sid,
      sceneName: sceneName || 'Estúdio Shotlab',
      camera: {
        focalLengthMm: camera.focalLengthMm,
        fStop: camera.fStop,
        sensorWidthMm: camera.sensorWidthMm,
        sensorHeightMm: camera.sensorHeightMm,
        hfovDeg: calculateHorizontalFovDeg(camera.focalLengthMm, camera.sensorWidthMm),
        distanceToSubjectM: camDist3d,
        position: camera.position,
      },
      subject: resolvedSubject,
      distancesM: {
        camera_to_subject: camDist3d,
        key_light_to_subject: keyGeo.dist3d,
        fill_light_to_subject: fillGeo.dist3d,
        rim_light_to_subject: rimGeo.dist3d,
      },
      lightingAnalysis: {
        key: {
          name: 'Key Light (Luz Principal)',
          dist3d: keyGeo.dist3d,
          dist2d: keyGeo.dist2d,
          azimuth: keyGeo.azimuth,
          elevation: keyGeo.elevation,
          intensity: lighting.keyLight.intensity,
          color: lighting.keyLight.color,
        },
        fill: {
          name: 'Fill Light (Preenchimento)',
          dist3d: fillGeo.dist3d,
          dist2d: fillGeo.dist2d,
          azimuth: fillGeo.azimuth,
          elevation: fillGeo.elevation,
          intensity: lighting.fillLight.intensity,
          color: lighting.fillLight.color,
        },
        rim: {
          name: 'Rim Light (Contraluz)',
          dist3d: rimGeo.dist3d,
          dist2d: rimGeo.dist2d,
          azimuth: rimGeo.azimuth,
          elevation: rimGeo.elevation,
          intensity: lighting.rimLight.intensity,
          color: lighting.rimLight.color,
        },
      },
      lightingRatio: `${ratioVal}:1`,
      svg: localSvg,
      isOffline: true,
    });
    setIsLoading(false);
  }, [sceneId, sceneName, camera, lighting, objects, resolvedSubject]);

  useEffect(() => {
    if (isOpen) {
      loadSetPlan();
    }
  }, [isOpen, loadSetPlan]);

  // Handle Download SVG
  const handleDownloadSvg = () => {
    if (!data?.svg) return;
    const blob = new Blob([data.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `set-plan-${data.sceneId || 'studio'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-[#0b0c0e] border border-[#2a303c] rounded-md shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden text-secondary-text font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2430] bg-[#12161f]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-optic/10 border border-optic/30 text-optic">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wider text-primary-text uppercase font-mono">
                  {t.setPlan.modalTitle}
                </h2>
                {data?.isOffline && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/15 border border-amber-500/40 text-[9px] font-mono text-amber-400">
                    OFFLINE / LOCAL SVG
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-text font-mono">
                {t.setPlan.modalSubtitle} • {data?.sceneName || sceneName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={loadSetPlan}
              disabled={isLoading}
              className="p-1.5 text-secondary-text hover:text-primary-text hover:bg-elevated rounded-sm transition-colors"
              title="Recarregar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-optic' : ''}`} />
            </button>

            <button
              onClick={handleDownloadSvg}
              disabled={!data?.svg}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-optic hover:bg-optic/90 text-black font-mono text-xs font-semibold shadow transition-all active:scale-95"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>BAIXADO!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.setPlan.downloadSvg}</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-secondary-text hover:text-primary-text hover:bg-elevated rounded-sm transition-colors"
              title={t.setPlan.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Content: Left SVG Blueprint / Right Metrics Panel */}
        <div className="flex flex-1 overflow-hidden divide-x divide-[#1e2430]">
          {/* Left: 2D Set Plan Vector Viewport */}
          <div className="flex-1 bg-[#050607] p-3 flex items-center justify-center relative overflow-hidden select-none">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-2 text-muted-text font-mono text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-optic" />
                <span>Calculando Set Plan 2D...</span>
              </div>
            ) : data?.svg ? (
              <div
                className="w-full h-full flex items-center justify-center max-h-[76vh] overflow-hidden"
                dangerouslySetInnerHTML={{ __html: data.svg }}
              />
            ) : (
              <div className="text-muted-text font-mono text-xs">Nenhum dado de Set Plan disponível.</div>
            )}
          </div>

          {/* Right: Telemetry & Photometric Measurements Sidebar */}
          <div className="w-84 max-w-sm bg-[#0e1117] p-4 overflow-y-auto space-y-4 text-xs font-mono">
            {/* Camera Optics Telemetry */}
            <div className="bg-[#141822] p-3 rounded-sm border border-[#222a38] space-y-2">
              <div className="flex items-center space-x-1.5 text-[10px] text-optic font-semibold uppercase tracking-wider">
                <Camera className="w-3.5 h-3.5" />
                <span>Câmera & Óptica Real</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] tabular-nums pt-1">
                <div>
                  <span className="text-[9px] text-muted-text block uppercase">Lente</span>
                  <span className="text-primary-text font-semibold">{data?.camera.focalLengthMm}mm</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-text block uppercase">Abertura</span>
                  <span className="text-primary-text font-semibold">f/{data?.camera.fStop}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-text block uppercase">HFOV</span>
                  <span className="text-primary-text">{data?.camera.hfovDeg.toFixed(1)}°</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-text block uppercase">Sensor</span>
                  <span className="text-primary-text">{data?.camera.sensorWidthMm}x{data?.camera.sensorHeightMm}mm</span>
                </div>
              </div>
            </div>

            {/* Distances to Subject (tabular-nums in meters) */}
            <div className="bg-[#141822] p-3 rounded-sm border border-[#222a38] space-y-2">
              <div className="flex items-center justify-between text-[10px] text-primary-text font-semibold uppercase tracking-wider">
                <div className="flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-optic" />
                  <span>{t.setPlan.distancesTable}</span>
                </div>
                <span className="text-optic font-bold">{data?.lightingRatio}</span>
              </div>

              <div className="space-y-1.5 pt-1 tabular-nums">
                <div className="flex justify-between items-center py-1 border-b border-[#1f2735] text-[11px]">
                  <span className="text-muted-text flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    <span>Câmera → Sujeito</span>
                  </span>
                  <span className="text-primary-text font-bold text-xs">{data?.camera.distanceToSubjectM.toFixed(2)} m</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#1f2735] text-[11px]">
                  <span className="text-muted-text flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] inline-block" />
                    <span>Key Light → Sujeito</span>
                  </span>
                  <span className="text-primary-text font-bold">{data?.lightingAnalysis.key.dist3d.toFixed(2)} m</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#1f2735] text-[11px]">
                  <span className="text-muted-text flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#93c5fd] inline-block" />
                    <span>Fill Light → Sujeito</span>
                  </span>
                  <span className="text-primary-text font-bold">{data?.lightingAnalysis.fill.dist3d.toFixed(2)} m</span>
                </div>

                <div className="flex justify-between items-center py-1 text-[11px]">
                  <span className="text-muted-text flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc] inline-block" />
                    <span>Rim Light → Sujeito</span>
                  </span>
                  <span className="text-primary-text font-bold">{data?.lightingAnalysis.rim.dist3d.toFixed(2)} m</span>
                </div>
              </div>
            </div>

            {/* Lighting Angles: Azimuth & Elevation */}
            <div className="bg-[#141822] p-3 rounded-sm border border-[#222a38] space-y-2.5">
              <div className="flex items-center space-x-1.5 text-[10px] text-primary-text font-semibold uppercase tracking-wider">
                <Sun className="w-3.5 h-3.5 text-optic" />
                <span>Ângulos de Iluminação (Estúdio)</span>
              </div>

              {/* Key Light Card */}
              <div className="p-2 rounded-sm bg-[#0a0d13] border border-[#1f2735] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-hairline" style={{ backgroundColor: data?.lightingAnalysis.key.color }} />
                    <span className="font-semibold text-[#fbbf24] text-[10px] uppercase">Key Light</span>
                  </div>
                  <span className="text-muted-text text-[10px] tabular-nums">{data?.lightingAnalysis.key.intensity.toFixed(1)}x</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] tabular-nums text-muted-text pt-0.5">
                  <div>Azimute: <span className="text-primary-text font-bold">{(data?.lightingAnalysis.key.azimuth ?? 0) > 0 ? `+${data?.lightingAnalysis.key.azimuth}` : data?.lightingAnalysis.key.azimuth ?? 0}°</span></div>
                  <div>Elevação: <span className="text-primary-text font-bold">{data?.lightingAnalysis.key.elevation ?? 0}°</span></div>
                </div>
              </div>

              {/* Fill Light Card */}
              <div className="p-2 rounded-sm bg-[#0a0d13] border border-[#1f2735] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-hairline" style={{ backgroundColor: data?.lightingAnalysis.fill.color }} />
                    <span className="font-semibold text-[#93c5fd] text-[10px] uppercase">Fill Light</span>
                  </div>
                  <span className="text-muted-text text-[10px] tabular-nums">{data?.lightingAnalysis.fill.intensity.toFixed(1)}x</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] tabular-nums text-muted-text pt-0.5">
                  <div>Azimute: <span className="text-primary-text font-bold">{(data?.lightingAnalysis.fill.azimuth ?? 0) > 0 ? `+${data?.lightingAnalysis.fill.azimuth}` : data?.lightingAnalysis.fill.azimuth ?? 0}°</span></div>
                  <div>Elevação: <span className="text-primary-text font-bold">{data?.lightingAnalysis.fill.elevation ?? 0}°</span></div>
                </div>
              </div>

              {/* Rim Light Card */}
              <div className="p-2 rounded-sm bg-[#0a0d13] border border-[#1f2735] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-hairline" style={{ backgroundColor: data?.lightingAnalysis.rim.color }} />
                    <span className="font-semibold text-[#c084fc] text-[10px] uppercase">Rim Light</span>
                  </div>
                  <span className="text-muted-text text-[10px] tabular-nums">{data?.lightingAnalysis.rim.intensity.toFixed(1)}x</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] tabular-nums text-muted-text pt-0.5">
                  <div>Azimute: <span className="text-primary-text font-bold">{(data?.lightingAnalysis.rim.azimuth ?? 0) > 0 ? `+${data?.lightingAnalysis.rim.azimuth}` : data?.lightingAnalysis.rim.azimuth ?? 0}°</span></div>
                  <div>Elevação: <span className="text-primary-text font-bold">{data?.lightingAnalysis.rim.elevation ?? 0}°</span></div>
                </div>
              </div>
            </div>

            {/* Primary Subject Coordinates */}
            <div className="p-2.5 bg-[#141822] rounded-sm border border-[#222a38] text-[10px] space-y-1">
              <div className="flex items-center space-x-1 text-muted-text uppercase font-semibold">
                <Layers className="w-3 h-3 text-optic" />
                <span>Sujeito: <strong className="text-primary-text">{data?.subject.name}</strong></span>
              </div>
              <div className="text-muted-text tabular-nums">
                Posição: X={data?.subject.position[0].toFixed(2)}m, Y={data?.subject.position[1].toFixed(2)}m, Z={data?.subject.position[2].toFixed(2)}m
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
