import type { Point } from '../types';
import { preprocessPoints } from './preprocessing';
import { detectCornersAndSegments } from './cornerDetection';
import { classifyShape, type ClassificationResult } from './classifier';
import { fitCircle, fitEllipse, computeAngularCoverage, computePerimeter } from './fitting';

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

const CIRCLE_NORMALIZED_ERROR_THRESHOLD = 0.07;
const ELLIPSE_NORMALIZED_ERROR_THRESHOLD = 0.10;
const ELLIPSE_AXIS_RATIO_THRESHOLD = 4;
const ANGULAR_COVERAGE_THRESHOLD = Math.PI * 1.5;

function isClosedWithBetterThreshold(points: Point[]): boolean {
  const perimeter = computePerimeter(points);
  const startEndDist = Math.sqrt(
    (points[0].x - points[points.length - 1].x) ** 2 +
    (points[0].y - points[points.length - 1].y) ** 2
  );
  const threshold = Math.max(10, perimeter * 0.05);
  return startEndDist < threshold;
}

function detectGlobalCircle(points: Point[]): Point[] | null {
  if (points.length < 10) return null;

  if (!isClosedWithBetterThreshold(points)) return null;

  const circleFit = fitCircle(points);
  if (!circleFit) return null;

  if (circleFit.normalizedError > CIRCLE_NORMALIZED_ERROR_THRESHOLD) return null;

  const angularCoverage = computeAngularCoverage(points, circleFit.center);
  if (angularCoverage < ANGULAR_COVERAGE_THRESHOLD) return null;

  const numPoints = 32;
  const circlePoints: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    circlePoints.push({
      x: circleFit.center.x + circleFit.radius * Math.cos(angle),
      y: circleFit.center.y + circleFit.radius * Math.sin(angle),
    });
  }
  circlePoints.push(circlePoints[0]);

  return circlePoints;
}

function detectEllipse(points: Point[]): Point[] | null {
  if (points.length < 10) return null;

  if (!isClosedWithBetterThreshold(points)) return null;

  const ellipseFit = fitEllipse(points);
  if (!ellipseFit) return null;

  if (ellipseFit.normalizedError > ELLIPSE_NORMALIZED_ERROR_THRESHOLD) return null;

  const axisRatio = ellipseFit.majorAxis / ellipseFit.minorAxis;
  if (axisRatio > ELLIPSE_AXIS_RATIO_THRESHOLD) return null;

  const angularCoverage = computeAngularCoverage(points, ellipseFit.center);
  if (angularCoverage < ANGULAR_COVERAGE_THRESHOLD) return null;

  const numPoints = 32;
  const ellipsePoints: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const cosT = Math.cos(ellipseFit.angle);
    const sinT = Math.sin(ellipseFit.angle);
    const localX = ellipseFit.majorAxis * Math.cos(angle);
    const localY = ellipseFit.minorAxis * Math.sin(angle);
    ellipsePoints.push({
      x: ellipseFit.center.x + localX * cosT - localY * sinT,
      y: ellipseFit.center.y + localX * sinT + localY * cosT,
    });
  }
  ellipsePoints.push(ellipsePoints[0]);

  return ellipsePoints;
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

  const ellipse = detectEllipse(points);
  if (ellipse) {
    return ellipse;
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

  const isClosed = isClosedWithBetterThreshold(processedPoints);

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

  const isClosed = isClosedWithBetterThreshold(processedPoints);

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
