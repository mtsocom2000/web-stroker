import type { Point } from './types';

const INTERPOLATION_STEPS = 6;

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

export function smoothStroke(points: Point[]): Point[] {
  if (points.length < 2) return points;
  if (points.length === 2) return points;
  if (points.length === 3) return points;

  const smoothed: Point[] = [];
  const windowSize = 3;
  
  smoothed.push(points[0]);
  
  for (let i = 1; i < points.length - 1; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }
    
    const weight = 5.0;
    sumX += weight * points[i].x;
    sumY += weight * points[i].y;
    count += weight;
    
    smoothed.push({
      x: sumX / count,
      y: sumY / count
    });
  }
  
  smoothed.push(points[points.length - 1]);
  
  const ultraSmoothed: Point[] = [smoothed[0]];
  
  for (let i = 0; i < smoothed.length - 1; i++) {
    const p1 = smoothed[i];
    const p2 = smoothed[i + 1];
    
    for (let j = 1; j <= INTERPOLATION_STEPS; j++) {
      const t = j / (INTERPOLATION_STEPS + 1);
      ultraSmoothed.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      });
    }
  }
  
  ultraSmoothed.push(smoothed[smoothed.length - 1]);
  
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