import type { Point } from '../types';
import { preprocessPoints } from './preprocessing';
import { detectCornersAndSegments, isClosedShape } from './cornerDetection';
import { classifyShape, type ClassificationResult } from './classifier';
import { distance } from '../utils';

export type { ShapeType, ClassificationResult } from './classifier';

export interface PredictShapeOptions {
  preprocess?: boolean;
  smoothWindowSize?: number;
  resampleSpacing?: number;
  minPointDistance?: number;
  angleThreshold?: number;
  velocityThreshold?: number;
  minCornerDistance?: number;
}

const DEFAULT_OPTIONS: Required<PredictShapeOptions> = {
  preprocess: true,
  smoothWindowSize: 3,
  resampleSpacing: 5,
  minPointDistance: 2,
  angleThreshold: Math.PI / 6,
  velocityThreshold: 0.3,
  minCornerDistance: 20,
};

function computeCurvature(p1: Point, p2: Point, p3: Point): number {
  const ax = p2.x - p1.x;
  const ay = p2.y - p1.y;
  const bx = p3.x - p2.x;
  const by = p3.y - p2.y;
  
  const cross = ax * by - ay * bx;
  const len1 = Math.hypot(ax, ay);
  const len2 = Math.hypot(bx, by);
  const len3 = Math.hypot(p3.x - p1.x, p3.y - p1.y);
  
  if (len1 < 0.1 || len2 < 0.1 || len3 < 0.1) return 0;
  
  return 2 * Math.abs(cross) / (len1 * len2 * len3);
}

function computeCornerCount(points: Point[], angleThreshold: number = Math.PI / 6): number {
  let cornerCount = 0;
  const angleThresholdRad = Math.PI - angleThreshold;
  
  for (let i = 1; i < points.length - 1; i++) {
    const angle = computeTurnAngleSimple(points[i - 1], points[i], points[i + 1]);
    if (angle > angleThresholdRad) {
      cornerCount++;
    }
  }
  
  return cornerCount;
}

function computeTurnAngleSimple(p1: Point, p2: Point, p3: Point): number {
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

function computeStraightSegmentRatio(points: Point[], angleThreshold: number = Math.PI / 12): number {
  let straightCount = 0;
  const thresholdRad = angleThreshold;
  
  for (let i = 1; i < points.length - 1; i++) {
    const angle = computeTurnAngleSimple(points[i - 1], points[i], points[i + 1]);
    if (angle < thresholdRad) {
      straightCount++;
    }
  }
  
  return straightCount / (points.length - 2);
}

function detectGlobalCircle(points: Point[]): Point[] | null {
  if (points.length < 10) return null;

  const isClosed = isClosedShape(points, 0.25);
  if (!isClosed) return null;

  const cornerCount = computeCornerCount(points);
  if (cornerCount >= 4) {
    return null;
  }

  const straightRatio = computeStraightSegmentRatio(points);
  if (straightRatio > 0.55) {
    return null;
  }

  const curvatures: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const kappa = computeCurvature(points[i - 1], points[i], points[i + 1]);
    curvatures.push(kappa);
  }
  
  if (curvatures.length === 0) return null;
  
  const avgCurvature = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
  if (avgCurvature < 0.001) return null;
  
  const curvatureVariance = curvatures.reduce((a, b) => a + (b - avgCurvature) ** 2, 0) / curvatures.length;
  const curvatureStdDev = Math.sqrt(curvatureVariance);
  
  if (curvatureStdDev > avgCurvature * 0.8) {
    return null;
  }

  const n = points.length;
  let sumX = 0, sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const center = { x: sumX / n, y: sumY / n };

  const radii = points.map(p => distance(p, center));
  const avgRadius = radii.reduce((a, b) => a + b, 0) / n;
  
  const squaredDiffs = radii.map(r => (r - avgRadius) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev / avgRadius > 0.18) return null;

  const angles = points.map(p => Math.atan2(p.y - center.y, p.x - center.x));
  let minAngle = angles[0], maxAngle = angles[0];
  for (let i = 1; i < angles.length; i++) {
    minAngle = Math.min(minAngle, angles[i]);
    maxAngle = Math.max(maxAngle, angles[i]);
  }
  let angularCoverage = maxAngle - minAngle;
  if (angularCoverage < 0) angularCoverage += 2 * Math.PI;

  if (angularCoverage < Math.PI * 1.3) return null;

  const numPoints = 32;
  const circlePoints: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    circlePoints.push({
      x: center.x + avgRadius * Math.cos(angle),
      y: center.y + avgRadius * Math.sin(angle),
    });
  }
  circlePoints.push(circlePoints[0]);
  
  return circlePoints;
}

export function predictShape(points: Point[], options?: PredictShapeOptions): Point[] | null {
  if (points.length < 2) return null;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const originalStart = points[0];
  const originalEnd = points[points.length - 1];

  const globalCircle = detectGlobalCircle(points);
  if (globalCircle) {
    return globalCircle;
  }

  let processedPoints = points;
  if (opts.preprocess) {
    processedPoints = preprocessPoints(points, {
      smoothWindowSize: opts.smoothWindowSize,
      resampleSpacing: opts.resampleSpacing,
      minPointDistance: opts.minPointDistance,
    });
  }

  if (processedPoints.length < 2) return null;

  const isClosed = isClosedShape(processedPoints, 0.2);

  const { segments } = detectCornersAndSegments(processedPoints, {
    angleThreshold: opts.angleThreshold,
    velocityThreshold: opts.velocityThreshold,
    minCornerDistance: opts.minCornerDistance,
    minSegmentLength: 15,
  });

  const result = classifyShape(segments, isClosed);

  if (result.points.length >= 2) {
    if (result.type === 'line' && segments.length === 1) {
      return [originalStart, originalEnd];
    }
    
    if (result.type === 'angle') {
      return result.points;
    }
    
    if (result.type === 'triangle' || result.type === 'rectangle') {
      const corners = segments.map(s => s[s.length - 1]);
      const shapePoints = [originalStart, ...corners, originalEnd, originalStart];
      return shapePoints;
    }
    
    if (result.type === 'polyline' && segments.length >= 2) {
      const polyPoints = [originalStart];
      for (const segment of segments) {
        polyPoints.push(segment[segment.length - 1]);
      }
      polyPoints.push(originalEnd);
      return polyPoints;
    }
    
    return result.points;
  }

  return null;
}

export function predictShapeWithDetails(points: Point[], options?: PredictShapeOptions): ClassificationResult | null {
  if (points.length < 2) return null;

  const opts = { ...DEFAULT_OPTIONS, ...options };

  let processedPoints = points;
  if (opts.preprocess) {
    processedPoints = preprocessPoints(points, {
      smoothWindowSize: opts.smoothWindowSize,
      resampleSpacing: opts.resampleSpacing,
      minPointDistance: opts.minPointDistance,
    });
  }

  if (processedPoints.length < 2) return null;

  const isClosed = isClosedShape(processedPoints, 0.2);

  const { segments } = detectCornersAndSegments(processedPoints, {
    angleThreshold: opts.angleThreshold,
    velocityThreshold: opts.velocityThreshold,
    minCornerDistance: opts.minCornerDistance,
    minSegmentLength: 15,
  });

  const result = classifyShape(segments, isClosed);

  return result;
}

export { preprocessPoints } from './preprocessing';
export { detectCornersAndSegments, isClosedShape } from './cornerDetection';
export { fitPrimitive } from './primitives';
export { classifyShape } from './classifier';
