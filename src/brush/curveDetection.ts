import type { Point } from '../types';

export interface CurveAnalysis {
  isCurve: boolean;
  curveType: 'circle' | 'ellipse' | 'arc' | 'unknown';
  center?: Point;
  radius?: number;
  fitError: number;
}

function calculateCentroid(points: Point[]): Point {
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

function calculateRadiusVariance(points: Point[], center: Point): { variance: number; avgRadius: number } {
  const distances = points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const avgRadius = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  if (avgRadius < 0.001) {
    return { variance: Infinity, avgRadius: 0 };
  }

  const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgRadius, 2), 0) / distances.length;
  const normalizedVariance = Math.sqrt(variance) / avgRadius;

  return { variance: normalizedVariance, avgRadius };
}

export function analyzeCurve(points: Point[]): CurveAnalysis {
  if (points.length < 10) {
    return { isCurve: false, curveType: 'unknown', fitError: Infinity };
  }

  const centroid = calculateCentroid(points);
  const { variance, avgRadius } = calculateRadiusVariance(points, centroid);

  // Check if points form a circle (low variance in distances from center)
  const isCircle = variance < 0.15 && avgRadius > 5;

  if (isCircle) {
    return {
      isCurve: true,
      curveType: 'circle',
      center: centroid,
      radius: avgRadius,
      fitError: variance,
    };
  }

  // Check for ellipse (two different radii)
  // Simplified: check if bounding box aspect ratio is different from 1
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const width = maxX - minX;
  const height = maxY - minY;
  const aspectRatio = Math.max(width, height) / Math.min(width, height);

  if (aspectRatio > 1.5 && avgRadius > 5) {
    return {
      isCurve: true,
      curveType: 'ellipse',
      center: centroid,
      radius: avgRadius,
      fitError: variance,
    };
  }

  return { isCurve: false, curveType: 'unknown', fitError: variance };
}

export function calculateCurvature(points: Point[], windowSize: number = 3): number[] {
  const curvatures: number[] = [];

  for (let i = 0; i < points.length; i++) {
    if (i < windowSize || i >= points.length - windowSize) {
      curvatures.push(0);
      continue;
    }

    const prev = points[i - windowSize];
    const curr = points[i];
    const next = points[i + windowSize];

    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    const cross = v1.x * v2.y - v1.y * v2.x;
    const dot = v1.x * v2.x + v1.y * v2.y;
    const angle = Math.atan2(cross, dot);

    curvatures.push(Math.abs(angle));
  }

  return curvatures;
}

export function hasConsistentCurvature(points: Point[], threshold: number = 0.3): boolean {
  if (points.length < 10) {
    return false;
  }

  const curvatures = calculateCurvature(points);
  
  // Filter out zero curvatures (straight sections)
  const nonZeroCurvatures = curvatures.filter((c) => c > 0.01);
  
  if (nonZeroCurvatures.length < points.length * 0.5) {
    return false;
  }

  const avgCurvature = nonZeroCurvatures.reduce((a, b) => a + b, 0) / nonZeroCurvatures.length;
  
  // Check if variance is low (consistent curvature)
  const variance = nonZeroCurvatures.reduce((sum, c) => sum + Math.pow(c - avgCurvature, 2), 0) / nonZeroCurvatures.length;
  
  return variance < threshold && avgCurvature > 0.1;
}

export function calculateAverageVelocity(points: Point[]): number {
  if (points.length < 2) {
    return 0;
  }

  let totalVelocity = 0;
  let count = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let timeDelta = 1;
    const ts1 = points[i].timestamp;
    const ts0 = points[i - 1].timestamp;
    if (ts1 !== undefined && ts0 !== undefined) {
      timeDelta = Math.max(1, ts1 - ts0);
    }

    totalVelocity += dist / timeDelta;
    count++;
  }

  return count > 0 ? totalVelocity / count : 0;
}
