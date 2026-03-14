import type { Point } from '../types';
import type { MouseDynamics } from './mouseDynamics';
import type { PointDensity } from './pointDensity';

export interface CornerDetectionResult {
  corners: number[];
  scores: number[];
  features: CornerFeatures[];
}

export interface CornerFeatures {
  angleChange: number;
  speedReduction: number;
  densityPeak: number;
  deceleration: number;
  totalScore: number;
}

export interface CornerDetectionOptions {
  angleThreshold: number;
  speedThreshold: number;
  densityThreshold: number;
  decelThreshold: number;
  minCornerDistance: number;
  scoreThreshold: number;
}

export const DEFAULT_CORNER_OPTIONS: CornerDetectionOptions = {
  angleThreshold: Math.PI / 12, // 15 degrees (更敏感)
  speedThreshold: 0.25,
  densityThreshold: 0.5,
  decelThreshold: 0.4,
  minCornerDistance: 15, // 几何距离阈值（像素），合并小于此距离的角点
  scoreThreshold: 0.45,
};

/**
 * Enhanced corner detection using multiple features:
 * - Direction change (angle between segments)
 * - Speed reduction (slowdown at corners)
 * - Point density (crowded areas)
 * - Deceleration pattern (acceleration analysis)
 *
 * Each feature contributes to a confidence score.
 * Corners are detected where total score exceeds threshold.
 */
export function detectCornersWithFeatures(
  points: Point[],
  dynamics: MouseDynamics,
  density: PointDensity,
  options: Partial<CornerDetectionOptions> = {}
): CornerDetectionResult {
  const opts = { ...DEFAULT_CORNER_OPTIONS, ...options };

  if (points.length < 3) {
    return {
      corners: points.length > 0 ? [0, points.length - 1] : [],
      scores: points.map(() => 0),
      features: points.map(() => ({
        angleChange: 0,
        speedReduction: 0,
        densityPeak: 0,
        deceleration: 0,
        totalScore: 0,
      })),
    };
  }

  const corners: number[] = [];
  const scores: number[] = [];
  const features: CornerFeatures[] = [];

  for (let i = 1; i < points.length - 1; i++) {
    // Feature 1: Angle change (direction difference)
    const angleChange = dynamics.directionChanges[i];
    const angleScore = Math.min(1, angleChange / opts.angleThreshold);

    // Feature 2: Speed reduction
    const currentSpeed = dynamics.velocities[i];
    const avgSpeed = dynamics.avgVelocity;
    const speedReduction = avgSpeed > 0 ? 1 - currentSpeed / avgSpeed : 0;
    const speedScore = speedReduction > 0 ? Math.min(1, speedReduction / (1 - opts.speedThreshold)) : 0;

    // Feature 3: Point density (crowded area)
    const densityScore = density.normalizedDensities[i];

    // Feature 4: Deceleration
    const deceleration = -dynamics.accelerations[i]; // Negative acceleration = deceleration
    const decelScore = deceleration > 0 ? Math.min(1, deceleration / opts.decelThreshold) : 0;

    // Calculate weighted total score
    // Weights: angle 35%, speed 25%, density 25%, decel 15%
    const totalScore = angleScore * 0.35 + speedScore * 0.25 + densityScore * 0.25 + decelScore * 0.15;

    scores.push(totalScore);
    features.push({
      angleChange: angleScore,
      speedReduction: speedScore,
      densityPeak: densityScore,
      deceleration: decelScore,
      totalScore,
    });

    // Check if this is a corner
    if (totalScore >= opts.scoreThreshold) {
      // Check distance from other corners
      const lastCorner = corners.length > 0 ? corners[corners.length - 1] : -Infinity;
      if (i - lastCorner >= opts.minCornerDistance) {
        corners.push(i);
      }
    }
  }

  // Always include start and end points
  if (points.length > 0 && !corners.includes(0)) {
    corners.unshift(0);
  }
  if (points.length > 1 && !corners.includes(points.length - 1)) {
    corners.push(points.length - 1);
  }

  // Merge corners that are too close geometrically (remove false corners from dense areas)
  const mergedCorners = mergeCloseCorners(corners, points, opts.minCornerDistance * 2);

  return { corners: mergedCorners, scores, features };
}

/**
 * Splits points into segments based on detected corners.
 */
export function splitIntoSegments(
  points: Point[],
  cornerIndices: number[]
): Point[][] {
  if (cornerIndices.length < 2) {
    return [points];
  }

  const segments: Point[][] = [];

  for (let i = 0; i < cornerIndices.length - 1; i++) {
    const startIdx = cornerIndices[i];
    const endIdx = cornerIndices[i + 1];

    if (endIdx > startIdx) {
      segments.push(points.slice(startIdx, endIdx + 1));
    }
  }

  return segments;
}

/**
 * Gets corner type based on feature analysis.
 */
export function getCornerType(
  features: CornerFeatures
): 'sharp' | 'smooth' | 'dense' | 'slow' | 'mixed' {
  const { angleChange, speedReduction, densityPeak, deceleration } = features;

  // Find dominant feature
  const maxFeature = Math.max(angleChange, speedReduction, densityPeak, deceleration);

  if (maxFeature === angleChange && angleChange > 0.7) {
    return 'sharp';
  }
  if (maxFeature === speedReduction && speedReduction > 0.7) {
    return 'slow';
  }
  if (maxFeature === densityPeak && densityPeak > 0.7) {
    return 'dense';
  }
  if (maxFeature === deceleration && deceleration > 0.7) {
    return 'smooth';
  }

  return 'mixed';
}

/**
 * Filters corners by minimum confidence score.
 */
export function filterCornersByScore(
  corners: number[],
  scores: number[],
  minScore: number
): number[] {
  return corners.filter((_, idx) => scores[idx] >= minScore);
}

/**
 * Merges close corners to avoid duplicate detections.
 */
export function mergeCloseCorners(
  corners: number[],
  points: Point[],
  minDistance: number
): number[] {
  if (corners.length < 2) return corners;

  const merged: number[] = [corners[0]];

  for (let i = 1; i < corners.length; i++) {
    const currentIdx = corners[i];
    const lastMergedIdx = merged[merged.length - 1];

    const dx = points[currentIdx].x - points[lastMergedIdx].x;
    const dy = points[currentIdx].y - points[lastMergedIdx].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= minDistance) {
      merged.push(currentIdx);
    }
  }

  return merged;
}
