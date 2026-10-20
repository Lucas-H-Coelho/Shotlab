import { describe, it, expect } from 'vitest';
import {
  calculateSensorDiagonal_mm,
  calculateCoc_mm,
  calculateFov_deg,
  calculateHyperfocal_m,
  calculateDofLimits_m,
  calculateFullOptics,
  calculateBlenderFovDeg,
} from './optics';

describe('Real Optics Physics Engine', () => {
  it('computes exact sensor diagonal and Circle of Confusion (CoC)', () => {
    // Full Frame 36x24mm
    const diagonal = calculateSensorDiagonal_mm(36.0, 24.0);
    expect(diagonal).toBeCloseTo(43.267, 3);

    // Standard CoC with d / 1500
    const coc = calculateCoc_mm(36.0, 24.0, 1500);
    expect(coc).toBeCloseTo(0.02884, 4);

    // Custom CoC
    const customCoc = calculateCoc_mm(36.0, 24.0, 1500, 0.030);
    expect(customCoc).toBe(0.030);
  });

  it('computes optical Field of View (FOV) across axes', () => {
    // 50mm on 36x24mm
    const vFov = calculateFov_deg(50.0, 24.0);
    expect(vFov).toBeCloseTo(26.99, 2);

    const hFov = calculateFov_deg(50.0, 36.0);
    expect(hFov).toBeCloseTo(39.60, 2);
  });

  it('verifies reference vector 1: 50mm f/8 Full Frame at 3m focus', () => {
    const res = calculateFullOptics({
      focalLength_mm: 50.0,
      fStop: 8.0,
      focusDistance_m: 3.0,
      sensorWidth_mm: 36.0,
      sensorHeight_mm: 24.0,
      customCoc_mm: 0.030,
    });

    // Hyperfocal distance should be ~10.467m (within 0.05m / <0.5%)
    expect(res.hyperfocalDistance_m).toBeCloseTo(10.467, 2);
    expect(res.dofNear_m).toBeLessThan(3.0);
    expect(res.dofFar_m).toBeGreaterThan(3.0);
    expect(res.isInfiniteFar).toBe(false);
  });

  it('verifies reference vector 2: 85mm f/1.8 Full Frame at 2.2m focus (Portrait/Hero)', () => {
    const res = calculateFullOptics({
      focalLength_mm: 85.0,
      fStop: 1.8,
      focusDistance_m: 2.2,
      sensorWidth_mm: 36.0,
      sensorHeight_mm: 24.0,
      customCoc_mm: 0.030,
    });

    // Thin Depth of Field around 0.07m
    expect(res.dofTotal_m).not.toBeNull();
    expect(res.dofTotal_m!).toBeGreaterThanOrEqual(0.06);
    expect(res.dofTotal_m!).toBeLessThanOrEqual(0.10);

    expect(res.dofNear_m).toBeCloseTo(2.166, 2);
    expect(res.dofFar_m).toBeCloseTo(2.235, 2);
  });

  it('correctly sets far limit to Infinity when focus distance >= hyperfocal', () => {
    const res = calculateFullOptics({
      focalLength_mm: 50.0,
      fStop: 8.0,
      focusDistance_m: 12.0, // Focus beyond hyperfocal (~10.46m)
      customCoc_mm: 0.030,
    });

    expect(res.isInfiniteFar).toBe(true);
    expect(res.dofFar_m).toBeNull();
    expect(res.dofTotal_m).toBeNull();
  });

  it('tests calculateHyperfocal_m and calculateDofLimits_m directly', () => {
    const h = calculateHyperfocal_m(50.0, 8.0, 0.030);
    expect(h).toBeCloseTo(10.467, 2);

    const limits = calculateDofLimits_m(50.0, 8.0, 3.0, 0.030);
    expect(limits.near_m).toBeCloseTo(2.340, 2);
    expect(limits.far_m).toBeCloseTo(4.177, 2);
    expect(limits.isInfinite).toBe(false);
  });

  it('accurately computes Blender-compatible Sensor Fit (AUTO, HORIZONTAL, VERTICAL)', () => {
    // 50mm lens on Full Frame 36x24mm
    // Landscape 16:9 (aspect = 16/9 = 1.7778)
    const landscapeAuto = calculateBlenderFovDeg(50.0, 36.0, 24.0, 16 / 9, 'auto');
    expect(landscapeAuto.effectiveFit).toBe('horizontal');
    expect(landscapeAuto.hFov_deg).toBeCloseTo(39.60, 2);
    // vFov = 2 * atan(tan(hFov / 2) / (16/9)) -> 2 * atan(0.36 / 1.7778) = 22.895°
    expect(landscapeAuto.vFov_deg).toBeCloseTo(22.90, 2);

    // Portrait 9:16 (aspect = 9/16 = 0.5625)
    const portraitAuto = calculateBlenderFovDeg(50.0, 36.0, 24.0, 9 / 16, 'auto');
    expect(portraitAuto.effectiveFit).toBe('vertical');
    expect(portraitAuto.vFov_deg).toBeCloseTo(26.99, 2);
    expect(portraitAuto.hFov_deg).toBeCloseTo(15.38, 2);

    // Explicit Vertical Fit on Landscape
    const explicitVert = calculateBlenderFovDeg(50.0, 36.0, 24.0, 16 / 9, 'vertical');
    expect(explicitVert.effectiveFit).toBe('vertical');
    expect(explicitVert.vFov_deg).toBeCloseTo(26.99, 2);
    expect(explicitVert.hFov_deg).toBeCloseTo(46.21, 2);
  });
});

