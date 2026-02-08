import type { Point } from './types';

// Catmull-Rom spline interpolation - fast and smooth
export function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  const v0 = (p2.x - p0.x) * 0.5;
  const v1 = (p3.x - p1.x) * 0.5;
  const x =
    p1.x +
    v0 * t +
    (3 * (p2.x - p1.x) - 2 * v0 - v1) * t2 +
    (2 * (p1.x - p2.x) + v0 + v1) * t3;

  const v0y = (p2.y - p0.y) * 0.5;
  const v1y = (p3.y - p1.y) * 0.5;
  const y =
    p1.y +
    v0y * t +
    (3 * (p2.y - p1.y) - 2 * v0y - v1y) * t2 +
    (2 * (p1.y - p2.y) + v0y + v1y) * t3;

  return { x, y };
}

/**
 * Smooth stroke ONLY when detection fails to find a clear geometric pattern.
 * This implements "detection-first" principle: detect what user intended, then only smooth freehand curves.
 */
export function smoothStroke(points: Point[]): Point[] {
  if (points.length < 2) return points;
  if (points.length === 2) return points;
  if (points.length === 3) return points; // Don't smooth very short strokes

  const smoothed: Point[] = [];
  const steps = 6; // Reduced steps for subtler smoothing (only when needed)

  // Always preserve the exact first point
  smoothed.push(points[0]);

  // Only smooth interior segments (from first to second-to-last)
  for (let i = 0; i < points.length - 2; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // For first segment, use first point as p0
    // For other segments, use previous point as p0
    const p0 = i === 0 ? points[0] : points[i - 1];
    
    // For interior segments, we have proper p3
    // For penultimate segment, use last point as p3
    const p3 = i < points.length - 3 ? points[i + 2] : points[points.length - 1];

    // Add the current point (except for the very first one which we already added)
    if (i > 0) {
      smoothed.push(p1);
    }

    // Add interpolated points between p1 and p2
    for (let j = 1; j <= steps; j++) {
      const t = j / (steps + 1);
      smoothed.push(catmullRom(p0, p1, p2, p3, t));
    }
  }

  // Add the second-to-last point and preserve the exact last point
  if (points.length > 2) {
    smoothed.push(points[points.length - 2]);
  }
  smoothed.push(points[points.length - 1]);
  
  return smoothed;
}

// Distance between two points
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
