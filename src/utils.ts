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
 * 
 * Creates a balanced smooth curve that eliminates jags while preserving drawing character.
 */
export function smoothStroke(points: Point[]): Point[] {
  console.log(`smoothStroke called with ${points.length} points`);
  
  if (points.length < 2) return points;
  if (points.length === 2) return points;
  if (points.length === 3) return points; // Don't smooth very short strokes

  // BALANCED SMOOTHING: Effective but preserves drawing character
  const smoothed: Point[] = [];
  const windowSize = 3; // 3-point moving average (less aggressive than 5)
  
  // Preserve first point
  smoothed.push(points[0]);
  
  // Apply weighted moving average smoothing to interior points
  for (let i = 1; i < points.length - 1; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    // Average with smaller window for better balance
    for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }
    
    // Higher weight for center point to preserve drawing character
    const weight = 5.0; // Increased center point weight for less distortion
    sumX += weight * points[i].x;
    sumY += weight * points[i].y;
    count += weight;
    
    smoothed.push({
      x: sumX / count,
      y: sumY / count
    });
  }
  
  // Preserve last point
  smoothed.push(points[points.length - 1]);
  
  // Add interpolated points between averaged points for smooth curves
  const ultraSmoothed: Point[] = [smoothed[0]];
  const steps = 6; // Reduced from 8 to 6 for more balanced interpolation
  
  for (let i = 0; i < smoothed.length - 1; i++) {
    const p1 = smoothed[i];
    const p2 = smoothed[i + 1];
    
    for (let j = 1; j <= steps; j++) {
      const t = j / (steps + 1);
      ultraSmoothed.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      });
    }
  }
  
  ultraSmoothed.push(smoothed[smoothed.length - 1]);
  
  console.log(`smoothStroke returning ${ultraSmoothed.length} points with balanced smoothing`);
  return ultraSmoothed;
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