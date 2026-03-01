import { describe, it, expect } from 'vitest';
import {
  angleNormalize,
  angleDiff,
  angleContains,
  chooseIntersectionByMouseAngle,
  computeArcSweep,
} from '../utils/angleHelpers';

describe('angleNormalize', () => {
  it('should normalize angle to [-π, π)', () => {
    expect(angleNormalize(0)).toBeCloseTo(0, 5);
    // π exactly should be π, not -π
    expect(angleNormalize(Math.PI)).toBeCloseTo(Math.PI, 5);
    // just above π should wrap to near -π
    expect(angleNormalize(Math.PI + 0.01)).toBeCloseTo(-Math.PI + 0.01, 5);
  });

  it('should wrap angles greater than π', () => {
    expect(angleNormalize(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1, 5);
    expect(angleNormalize(2 * Math.PI)).toBeCloseTo(0, 5);
    // 3π normalizes to π (because 3π - 2π = π)
    expect(angleNormalize(3 * Math.PI)).toBeCloseTo(Math.PI, 5);
  });

  it('should wrap angles less than -π', () => {
    expect(angleNormalize(-Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1, 5);
    expect(angleNormalize(-2 * Math.PI)).toBeCloseTo(0, 5);
  });
});

describe('angleDiff', () => {
  it('should compute signed difference from a to b', () => {
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
    expect(angleDiff(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('should handle wrap-around correctly', () => {
    // 3π/2 to π/2: normalized to -π/2 to π/2, diff should be π
    const diff = angleDiff((3 * Math.PI) / 2, Math.PI / 2);
    expect(diff).toBeCloseTo(Math.PI, 5);
  });

  it('should return 0 for identical angles', () => {
    expect(angleDiff(0, 0)).toBeCloseTo(0, 5);
    expect(angleDiff(Math.PI, Math.PI)).toBeCloseTo(0, 5);
  });
});

describe('angleContains', () => {
  it('should contain angle within forward sweep', () => {
    // Arc from 0 to π/2 (0°-90°) should contain 45°
    const result = angleContains(0, Math.PI / 2, Math.PI / 4);
    expect(result).toBe(true);
  });

  it('should not contain angle outside forward sweep', () => {
    // Arc from 0 to π/2 should not contain -π/2 (-90°)
    const result = angleContains(0, Math.PI / 2, -Math.PI / 2);
    expect(result).toBe(false);
  });

  it('should handle backward sweep (clockwise)', () => {
    // Arc from π/2 to -π/2 (clockwise, downward)
    const result = angleContains(Math.PI / 2, -Math.PI / 2, -Math.PI / 4);
    expect(result).toBe(true);
  });

  it('should contain start and end angles', () => {
    expect(angleContains(0, Math.PI / 2, 0)).toBe(true);
    expect(angleContains(0, Math.PI / 2, Math.PI / 2)).toBe(true);
  });

  it('should handle wrap-around cases', () => {
    // Arc from 3π/4 to -3π/4 (wrapping through -π/π boundary)
    // 3π/4 → 5π/4 (wraps to -3π/4)
    const result = angleContains((3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI);
    expect(result).toBe(true);
  });
});

describe('chooseIntersectionByMouseAngle', () => {
  it('should choose intersection on same side as mouse', () => {
    const arcCenter = { x: 0, y: 0 };
    const intersection1 = { x: 1, y: 0 }; // Right
    const intersection2 = { x: -1, y: 0 }; // Left
    const arcEndpoint2 = { x: 0, y: 1 }; // Top
    const mouseOnRight = { x: 1, y: 1 }; // Top-right

    const chosen = chooseIntersectionByMouseAngle(
      intersection1,
      intersection2,
      arcCenter,
      arcEndpoint2,
      mouseOnRight
    );

    expect(chosen).toEqual(intersection1);
  });

  it('should choose intersection on opposite side when mouse is there', () => {
    const arcCenter = { x: 0, y: 0 };
    const intersection1 = { x: 1, y: 0 }; // Right
    const intersection2 = { x: -1, y: 0 }; // Left
    const arcEndpoint2 = { x: 0, y: 1 }; // Top
    const mouseOnLeft = { x: -1, y: 1 }; // Top-left

    const chosen = chooseIntersectionByMouseAngle(
      intersection1,
      intersection2,
      arcCenter,
      arcEndpoint2,
      mouseOnLeft
    );

    expect(chosen).toEqual(intersection2);
  });

  it('should handle null intersection2', () => {
    const arcCenter = { x: 0, y: 0 };
    const intersection1 = { x: 1, y: 0 };
    const arcEndpoint2 = { x: 0, y: 1 };
    const mouse = { x: 2, y: 2 };

    const chosen = chooseIntersectionByMouseAngle(
      intersection1,
      null,
      arcCenter,
      arcEndpoint2,
      mouse
    );

    expect(chosen).toEqual(intersection1);
  });
});

describe('computeArcSweep', () => {
  it('should compute positive sweep for counter-clockwise', () => {
    const sweep = computeArcSweep(0, Math.PI / 2);
    expect(sweep).toBeCloseTo(Math.PI / 2, 5);
  });

  it('should compute negative sweep for clockwise', () => {
    const sweep = computeArcSweep(Math.PI / 2, 0);
    expect(sweep).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('should handle wrap-around', () => {
    const sweep = computeArcSweep(Math.PI, -Math.PI);
    expect(Math.abs(sweep)).toBeCloseTo(0, 5);
  });
});
