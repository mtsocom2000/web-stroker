import type { Point } from '../types';
import { distance } from '../utils';

export interface PreprocessingOptions {
  smoothWindowSize: number;
  resampleSpacing: number;
  minPointDistance: number;
}

export const DEFAULT_PREPROCESSING_OPTIONS: PreprocessingOptions = {
  smoothWindowSize: 3,
  resampleSpacing: 5,
  minPointDistance: 2,
};

export interface PreprocessedResult {
  points: Point[];
  originalLength: number;
}

export function preprocessPoints(
  points: Point[],
  options: PreprocessingOptions = DEFAULT_PREPROCESSING_OPTIONS
): Point[] {
  if (points.length < 2) return points;

  let processed = removeRedundantPoints(points, options.minPointDistance);
  processed = smoothPoints(processed, options.smoothWindowSize);
  processed = resampleByArcLength(processed, options.resampleSpacing);

  return processed;
}

export function removeRedundantPoints(points: Point[], minDist: number): Point[] {
  if (points.length < 2) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1];
    const curr = points[i];
    if (distance(last, curr) >= minDist) {
      result.push(curr);
    }
  }

  if (result.length > 1 && distance(result[result.length - 1], points[points.length - 1]) < minDist) {
    result[result.length - 1] = points[points.length - 1];
  }

  return result;
}

export function smoothPoints(points: Point[], windowSize: number): Point[] {
  if (points.length < 2 || windowSize < 2) return points;

  const smoothed: Point[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }

    smoothed.push({
      x: sumX / count,
      y: sumY / count,
      timestamp: points[i].timestamp,
    });
  }

  return smoothed;
}

export function resampleByArcLength(points: Point[], spacing: number): Point[] {
  if (points.length < 2 || spacing <= 0) return points;

  const result: Point[] = [points[0]];
  let accumulatedDist = 0;

  for (let i = 1; i < points.length; i++) {
    const segDist = distance(points[i - 1], points[i]);
    accumulatedDist += segDist;

    while (accumulatedDist >= spacing) {
      const t = 1 - (accumulatedDist - spacing) / segDist;
      const newPoint: Point = {
        x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
        y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
        timestamp: points[i].timestamp,
      };
      result.push(newPoint);
      accumulatedDist -= spacing;
    }
  }

  if (result.length === 0 || distance(result[result.length - 1], points[points.length - 1]) > spacing * 0.5) {
    result.push(points[points.length - 1]);
  }

  return result;
}

export function computeArcLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

export function getPointAtLength(points: Point[], targetLength: number): Point | null {
  if (points.length < 2) return points[0] || null;

  let accumulatedDist = 0;

  for (let i = 1; i < points.length; i++) {
    const segDist = distance(points[i - 1], points[i]);
    
    if (accumulatedDist + segDist >= targetLength) {
      const t = (targetLength - accumulatedDist) / segDist;
      return {
        x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
        y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
        timestamp: points[i - 1].timestamp,
      };
    }
    
    accumulatedDist += segDist;
  }

  return points[points.length - 1];
}
