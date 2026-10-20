/**
 * Pure mathematical optical engine for real-world camera geometry.
 *
 * Units convention:
 * - Dimensions / Focal Length / Circle of Confusion: millimeters (mm)
 * - Distances / Depth of Field / Hyperfocal: meters (m)
 * - Angles / FOV: degrees (deg)
 */

export interface SensorPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

export const SENSOR_PRESETS = {
  FULL_FRAME_35MM: {
    id: 'FULL_FRAME_35MM',
    name: '35mm Full Frame',
    widthMm: 36.0,
    heightMm: 24.0,
    description: 'Padrão fotográfico 3:2 (36x24mm)',
  },
  SUPER_35_APSC: {
    id: 'SUPER_35_APSC',
    name: 'Super 35 / APS-C',
    widthMm: 23.6,
    heightMm: 15.6,
    description: 'Cinema Super 35 / Formato APS-C (23.6x15.6mm)',
  },
  ARRI_ALEXA_LF: {
    id: 'ARRI_ALEXA_LF',
    name: 'ARRI ALEXA LF',
    widthMm: 36.7,
    heightMm: 25.54,
    description: 'Sensor Large Format de cinema (36.7x25.54mm)',
  },
  MEDIUM_FORMAT_645: {
    id: 'MEDIUM_FORMAT_645',
    name: 'Médio Formato 645',
    widthMm: 53.7,
    heightMm: 40.2,
    description: 'Hasselblad / Phase One 645 (53.7x40.2mm)',
  },
} as const;

export type SensorPresetKey = keyof typeof SENSOR_PRESETS;

export interface DepthOfFieldResult {
  hyperfocalM: number;
  nearLimitM: number;
  farLimitM: number;
  totalDofM: number;
  isHyperfocal: boolean;
}

export interface FullOpticsParams {
  focalLength_mm: number;
  fStop: number;
  focusDistance_m: number;
  sensorWidth_mm?: number;
  sensorHeight_mm?: number;
  customCoc_mm?: number;
  cocDivisor?: number;
}

export interface FullOpticsResult {
  diagonal_mm: number;
  coc_mm: number;
  vFov_deg: number;
  hFov_deg: number;
  diagonalFov_deg: number;
  hyperfocalDistance_m: number;
  dofNear_m: number;
  dofFar_m: number | null;
  dofTotal_m: number | null;
  isInfiniteFar: boolean;
}

/**
 * Calculates sensor diagonal in millimeters.
 * d = sqrt(w^2 + h^2)
 */
export function calculateSensorDiagonal_mm(
  sensorWidthMm: number,
  sensorHeightMm: number
): number {
  if (sensorWidthMm <= 0 || sensorHeightMm <= 0) {
    throw new Error('Sensor dimensions must be strictly positive');
  }
  return Math.sqrt(sensorWidthMm * sensorWidthMm + sensorHeightMm * sensorHeightMm);
}

/**
 * Calculates Circle of Confusion (CoC) based on standard Zeiss formula (diagonal / divisor).
 * For 35mm Full Frame (36x24mm) with divisor 1500, CoC is ~0.0288mm (~0.029mm).
 */
export function calculateCoc_mm(
  sensorWidthMm: number,
  sensorHeightMm: number,
  divisor: number = 1500,
  customCoc?: number
): number {
  if (customCoc !== undefined && customCoc > 0) {
    return customCoc;
  }
  if (divisor <= 0) {
    throw new Error('CoC divisor must be strictly positive');
  }
  const diagonal = calculateSensorDiagonal_mm(sensorWidthMm, sensorHeightMm);
  return diagonal / divisor;
}

/**
 * Calculates Circle of Confusion in millimeters with default d / 1500.
 */
export function calculateCircleOfConfusionMm(
  sensorWidthMm: number,
  sensorHeightMm: number
): number {
  return calculateCoc_mm(sensorWidthMm, sensorHeightMm, 1500);
}

/**
 * Calculates Field of View in degrees for a given sensor dimension.
 * FOV = 2 * arctan(sensorDimension / (2 * focalLength))
 */
export function calculateFov_deg(
  focalLengthMm: number,
  sensorDimensionMm: number
): number {
  if (focalLengthMm <= 0 || sensorDimensionMm <= 0) {
    throw new Error('Focal length and sensor dimension must be strictly positive');
  }
  const rad = 2 * Math.atan(sensorDimensionMm / (2 * focalLengthMm));
  return (rad * 180) / Math.PI;
}

/**
 * Calculates Vertical Field of View in degrees.
 */
export function calculateVerticalFovDeg(
  focalLengthMm: number,
  sensorHeightMm: number
): number {
  return calculateFov_deg(focalLengthMm, sensorHeightMm);
}

/**
 * Calculates Horizontal Field of View in degrees.
 */
export function calculateHorizontalFovDeg(
  focalLengthMm: number,
  sensorWidthMm: number
): number {
  return calculateFov_deg(focalLengthMm, sensorWidthMm);
}

/**
 * Calculates Diagonal Field of View in degrees.
 */
export function calculateDiagonalFovDeg(
  focalLengthMm: number,
  sensorWidthMm: number,
  sensorHeightMm: number
): number {
  const diagonalMm = calculateSensorDiagonal_mm(sensorWidthMm, sensorHeightMm);
  return calculateFov_deg(focalLengthMm, diagonalMm);
}

/**
 * Calculates Hyperfocal Distance in meters.
 * H = (f^2 / (N * c)) + f (in mm), converted to meters.
 *
 * @param focalLengthMm Lens focal length in mm
 * @param fStop Aperture f-number (e.g. 1.8, 2.8, 8.0)
 * @param cocMm Circle of confusion in mm (derived from sensor)
 * @returns Hyperfocal distance in meters
 */
export function calculateHyperfocalDistanceM(
  focalLengthMm: number,
  fStop: number,
  cocMm: number
): number {
  if (focalLengthMm <= 0 || fStop <= 0 || cocMm <= 0) {
    throw new Error('Focal length, f-stop and circle of confusion must be strictly positive');
  }
  const hyperfocalMm = (focalLengthMm * focalLengthMm) / (fStop * cocMm) + focalLengthMm;
  return hyperfocalMm / 1000;
}

export const calculateHyperfocal_m = calculateHyperfocalDistanceM;

/**
 * Calculates Depth of Field limits (near, far, total) in meters.
 *
 * Formulas:
 * D_near = (H * s) / (H + (s - f))
 * D_far  = (H * s) / (H - (s - f)) when s < H
 * When s >= H (focus at or beyond hyperfocal), D_far = Infinity and total DoF = Infinity.
 *
 * @param focalLengthMm Lens focal length in mm
 * @param fStop Lens aperture f-number
 * @param focusDistanceM Subject focus distance in meters
 * @param cocMm Circle of confusion in mm
 */
export function calculateDepthOfFieldM(
  focalLengthMm: number,
  fStop: number,
  focusDistanceM: number,
  cocMm: number
): DepthOfFieldResult {
  if (focusDistanceM <= 0) {
    throw new Error('Focus distance must be strictly positive');
  }

  const hyperfocalM = calculateHyperfocalDistanceM(focalLengthMm, fStop, cocMm);
  const focalLengthM = focalLengthMm / 1000;
  const isHyperfocal = focusDistanceM >= hyperfocalM;

  const nearDenom = hyperfocalM + (focusDistanceM - focalLengthM);
  const nearLimitM = nearDenom > 0 ? (hyperfocalM * focusDistanceM) / nearDenom : 0;

  let farLimitM: number;
  let totalDofM: number;

  if (isHyperfocal) {
    farLimitM = Infinity;
    totalDofM = Infinity;
  } else {
    const farDenom = hyperfocalM - (focusDistanceM - focalLengthM);
    if (farDenom <= 0) {
      farLimitM = Infinity;
      totalDofM = Infinity;
    } else {
      farLimitM = (hyperfocalM * focusDistanceM) / farDenom;
      totalDofM = farLimitM - nearLimitM;
    }
  }

  return {
    hyperfocalM,
    nearLimitM,
    farLimitM,
    totalDofM,
    isHyperfocal,
  };
}

export function calculateDofLimits_m(
  focalLengthMm: number,
  fStop: number,
  focusDistanceM: number,
  cocMm: number
): {
  near_m: number;
  far_m: number | null;
  total_m: number | null;
  isInfinite: boolean;
} {
  const result = calculateDepthOfFieldM(focalLengthMm, fStop, focusDistanceM, cocMm);
  return {
    near_m: result.nearLimitM,
    far_m: result.isHyperfocal || !Number.isFinite(result.farLimitM) ? null : result.farLimitM,
    total_m: result.isHyperfocal || !Number.isFinite(result.totalDofM) ? null : result.totalDofM,
    isInfinite: result.isHyperfocal || !Number.isFinite(result.farLimitM),
  };
}

/**
 * Computes the complete set of optical parameters for a camera configuration.
 */
export function calculateFullOptics(params: FullOpticsParams): FullOpticsResult {
  const sensorWidth = params.sensorWidth_mm ?? 36.0;
  const sensorHeight = params.sensorHeight_mm ?? 24.0;
  const divisor = params.cocDivisor ?? 1500;

  const diagonal_mm = calculateSensorDiagonal_mm(sensorWidth, sensorHeight);
  const coc_mm = calculateCoc_mm(sensorWidth, sensorHeight, divisor, params.customCoc_mm);
  const vFov_deg = calculateVerticalFovDeg(params.focalLength_mm, sensorHeight);
  const hFov_deg = calculateHorizontalFovDeg(params.focalLength_mm, sensorWidth);
  const diagonalFov_deg = calculateDiagonalFovDeg(params.focalLength_mm, sensorWidth, sensorHeight);

  const hyperfocalDistance_m = calculateHyperfocalDistanceM(
    params.focalLength_mm,
    params.fStop,
    coc_mm
  );

  const dofResult = calculateDepthOfFieldM(
    params.focalLength_mm,
    params.fStop,
    params.focusDistance_m,
    coc_mm
  );

  const isInfiniteFar = dofResult.isHyperfocal || !Number.isFinite(dofResult.farLimitM);

  return {
    diagonal_mm,
    coc_mm,
    vFov_deg,
    hFov_deg,
    diagonalFov_deg,
    hyperfocalDistance_m,
    dofNear_m: dofResult.nearLimitM,
    dofFar_m: isInfiniteFar ? null : dofResult.farLimitM,
    dofTotal_m: isInfiniteFar ? null : dofResult.totalDofM,
    isInfiniteFar,
  };
}

// Aliases for backwards compatibility with previous imports
export const calculateVerticalFov = calculateVerticalFovDeg;
export const calculateHorizontalFov = calculateHorizontalFovDeg;
