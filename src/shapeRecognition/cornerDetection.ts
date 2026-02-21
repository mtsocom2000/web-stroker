import type { Point } from '../types';
import { distance } from '../utils';

export interface CornerDetectionOptions {
  angleThreshold: number;
  velocityThreshold: number;
  minCornerDistance: number;
  minSegmentLength: number;
}

export const DEFAULT_CORNER_OPTIONS: CornerDetectionOptions = {
  angleThreshold: Math.PI / 6, // 30 degrees
  velocityThreshold: 0.3, // 30% of average speed
  minCornerDistance: 10,
  minSegmentLength: 15,
};

export interface CornerResult {
  indices: number[];
  segments: Point[][];
}

export function detectCornersAndSegments(
  points: Point[],
  options: CornerDetectionOptions = DEFAULT_CORNER_OPTIONS
): CornerResult {
  if (points.length < 3) {
    return { indices: [], segments: [points] };
  }

  const cornerIndices = detectCorners(points, options);

  const segments = splitIntoSegments(points, cornerIndices);

  return {
    indices: cornerIndices,
    segments,
  };
}

export function detectCorners(
  points: Point[],
  options: CornerDetectionOptions = DEFAULT_CORNER_OPTIONS
): number[] {
  if (points.length < 3) return [];

  const { angleThreshold, velocityThreshold, minCornerDistance } = options;

  const velocities = computeVelocities(points);
  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;

  const corners: number[] = [];

  for (let i = 1; i < points.length - 1; i++) {
    const angle = computeTurnAngle(points[i - 1], points[i], points[i + 1]);

    const isSharpAngle = angle > angleThreshold;
    const isSlowSpeed = velocities[i] < avgVelocity * velocityThreshold;

    if (isSharpAngle || isSlowSpeed) {
      const lastCornerDist = corners.length > 0 
        ? distance(points[i], points[corners[corners.length - 1]]) 
        : Infinity;

      if (lastCornerDist > minCornerDistance) {
        corners.push(i);
      }
    }
  }

  return corners;
}

function computeVelocities(points: Point[]): number[] {
  const velocities: number[] = [0];

  for (let i = 1; i < points.length; i++) {
    const dist = distance(points[i - 1], points[i]);
    let timeDiff = 1;

    const t1 = points[i].timestamp ?? 0;
    const t0 = points[i - 1].timestamp ?? 0;
    if (t1 > t0) {
      timeDiff = t1 - t0;
    }

    velocities.push(dist / timeDiff);
  }

  return velocities;
}

export function computeTurnAngle(p1: Point, p2: Point, p3: Point): number {
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;

  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);

  if (len1 < 0.1 || len2 < 0.1) return 0;

  const cosAngle = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
  return Math.acos(cosAngle);
}

function splitIntoSegments(points: Point[], cornerIndices: number[]): Point[][] {
  if (cornerIndices.length === 0) {
    return [points];
  }

  const segments: Point[][] = [];
  let startIndex = 0;

  for (const cornerIndex of cornerIndices) {
    if (cornerIndex > startIndex) {
      segments.push(points.slice(startIndex, cornerIndex + 1));
    }
    startIndex = cornerIndex;
  }

  if (startIndex < points.length) {
    segments.push(points.slice(startIndex));
  }

  return segments;
}

export function isClosedShape(points: Point[], threshold: number = 0.2): boolean {
  if (points.length < 3) return false;

  const startToEnd = distance(points[0], points[points.length - 1]);
  const perimeter = computePerimeter(points);

  const absThreshold = Math.max(10, perimeter * 0.05);
  const relThreshold = perimeter * threshold;
  
  return startToEnd < Math.min(absThreshold, relThreshold);
}

function computePerimeter(points: Point[]): number {
  let perimeter = 0;
  for (let i = 1; i < points.length; i++) {
    perimeter += distance(points[i - 1], points[i]);
  }
  return perimeter;
}
