import type { Point } from '../types';
import type { MouseDynamics } from './mouseDynamics';

export type ShapeType =
  | 'line'
  | 'angle'
  | 'triangle'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'arc'
  | 'curve'
  | 'polygon'
  | 'polyline'
  | 'unknown';

export interface ShapeClassification {
  type: ShapeType;
  points: Point[];
  confidence: number;
  isClosed: boolean;
  metadata?: unknown;
}

export interface ShapeClassifierOptions {
  minSegmentLength: number;
  lineStraightnessThreshold: number;
  angleTolerance: number;
  minShapeSize: number;
  circleErrorThreshold: number;
  ellipseErrorThreshold: number;
  closedThreshold: number;
}

export const DEFAULT_CLASSIFIER_OPTIONS: ShapeClassifierOptions = {
  minSegmentLength: 20,
  lineStraightnessThreshold: 0.15,
  angleTolerance: Math.PI / 6, // 30 degrees
  minShapeSize: 30,
  circleErrorThreshold: 0.15,
  ellipseErrorThreshold: 0.2,
  closedThreshold: 0.15,
};

/**
 * Multi-stage shape classification.
 * Priority order (most specific to least specific):
 * 1. Line (single straight segment)
 * 2. Arc (single curved segment, open)
 * 3. Angle (2 segments meeting)
 * 4. Triangle (3 segments, closed)
 * 5. Rectangle/Square (4 segments, closed, right angles)
 * 6. Circle (single curve, closed, 360°)
 * 7. Ellipse (single curve, closed, oval)
 * 8. Polygon (5+ segments, closed)
 * 9. Polyline (multiple segments, open)
 * 10. Curve (single curved segment, open, not arc)
 */
export function classifyShape(
  segments: Point[][],
  dynamics: MouseDynamics,
  options: Partial<ShapeClassifierOptions> = {}
): ShapeClassification {
  const opts = { ...DEFAULT_CLASSIFIER_OPTIONS, ...options };

  // Flatten all points for analysis
  const allPoints = segments.flat();

  if (allPoints.length < 2) {
    return { type: 'unknown', points: allPoints, confidence: 0, isClosed: false };
  }

  // Check if shape is closed
  const isClosed = checkIsClosed(allPoints, opts.closedThreshold);

  // Stage 1: Single segment classification
  if (segments.length === 1) {
    return classifySingleSegment(segments[0], isClosed, dynamics, opts);
  }

  // Stage 2: Multi-segment classification
  return classifyMultipleSegments(segments, isClosed, dynamics, opts);
}

/**
 * Classifies a single segment shape.
 */
function classifySingleSegment(
  segment: Point[],
  isClosed: boolean,
  _dynamics: MouseDynamics,
  opts: ShapeClassifierOptions
): ShapeClassification {
  if (segment.length < 2) {
    return { type: 'unknown', points: segment, confidence: 0, isClosed };
  }

  const start = segment[0];
  const end = segment[segment.length - 1];
  const length = distance(start, end);

  if (length < opts.minShapeSize) {
    return { type: 'line', points: [start, end], confidence: 0.9, isClosed };
  }

  // Check if straight line
  const straightness = calculateStraightness(segment);
  if (straightness < opts.lineStraightnessThreshold) {
    return { type: 'line', points: [start, end], confidence: 0.95, isClosed };
  }

  // Check for circle (closed, full coverage)
  if (isClosed) {
    const circleFit = fitCircle(segment);
    if (circleFit && circleFit.error < opts.circleErrorThreshold) {
      const circlePoints = generateCirclePoints(circleFit.center, circleFit.radius);
      return { type: 'circle', points: circlePoints, confidence: 0.9, isClosed, metadata: circleFit };
    }

    // Check for ellipse
    const ellipseFit = fitEllipse(segment);
    if (ellipseFit && ellipseFit.error < opts.ellipseErrorThreshold) {
      const ellipsePoints = generateEllipsePoints(
        ellipseFit.center,
        ellipseFit.majorAxis,
        ellipseFit.minorAxis,
        ellipseFit.angle
      );
      return { type: 'ellipse', points: ellipsePoints, confidence: 0.85, isClosed, metadata: ellipseFit };
    }
  }

  // Check for arc (curved, not closed or partial)
  const arcFit = fitArc(segment);
  if (arcFit && arcFit.coverage > Math.PI / 6 && arcFit.coverage < Math.PI * 1.8) {
    const arcPoints = generateArcPoints(
      arcFit.center,
      arcFit.radius,
      arcFit.startAngle,
      arcFit.endAngle
    );
    return { type: 'arc', points: arcPoints, confidence: 0.8, isClosed: false, metadata: arcFit };
  }

  // Default: curve
  return { type: 'curve', points: segment, confidence: 0.6, isClosed };
}

/**
 * Classifies multi-segment shapes.
 */
function classifyMultipleSegments(
  segments: Point[][],
  isClosed: boolean,
  _dynamics: MouseDynamics,
  opts: ShapeClassifierOptions
): ShapeClassification {
  const numSegments = segments.length;

  // 2 segments = angle
  if (numSegments === 2) {
    const corner = segments[0][segments[0].length - 1];
    return {
      type: 'angle',
      points: [segments[0][0], corner, segments[1][segments[1].length - 1]],
      confidence: 0.85,
      isClosed: false,
    };
  }

  // 3 segments, closed = triangle
  if (numSegments === 3 && isClosed) {
    const corners = segments.map((s) => s[s.length - 1]);
    const trianglePoints = [segments[0][0], corners[0], corners[1], corners[2], segments[0][0]];
    return { type: 'triangle', points: trianglePoints, confidence: 0.85, isClosed };
  }

  // 4 segments, closed = rectangle or square
  if (numSegments === 4 && isClosed) {
    return classifyQuadrilateral(segments, opts);
  }

  // 5+ segments, closed = polygon
  if (isClosed && numSegments >= 5) {
    const corners = segments.map((s) => s[s.length - 1]);
    const polyPoints = [segments[0][0], ...corners, segments[0][0]];
    return { type: 'polygon', points: polyPoints, confidence: 0.7, isClosed };
  }

  // Open, multiple segments = polyline
  const allPoints: Point[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      allPoints.push(...segments[i]);
    } else {
      allPoints.push(...segments[i].slice(1));
    }
  }
  return { type: 'polyline', points: allPoints, confidence: 0.75, isClosed };
}

/**
 * Classifies 4-sided shapes (rectangles, squares, or general quadrilaterals).
 */
function classifyQuadrilateral(segments: Point[][], opts: ShapeClassifierOptions): ShapeClassification {
  const corners = segments.map((s) => s[s.length - 1]);

  // Check if it's a rectangle by verifying right angles
  let rightAngleCount = 0;
  for (let i = 0; i < 4; i++) {
    const prev = corners[(i + 3) % 4];
    const curr = corners[i];
    const next = corners[(i + 1) % 4];
    const angle = calculateInteriorAngle(prev, curr, next);

    if (Math.abs(angle - Math.PI / 2) < opts.angleTolerance) {
      rightAngleCount++;
    }
  }

  // Check side lengths for square
  const sideLengths = [];
  for (let i = 0; i < 4; i++) {
    sideLengths.push(distance(corners[i], corners[(i + 1) % 4]));
  }
  const avgSide = sideLengths.reduce((a, b) => a + b, 0) / 4;
  const isSquare = sideLengths.every((l) => Math.abs(l - avgSide) / avgSide < 0.15);

  const rectPoints = [segments[0][0], corners[0], corners[1], corners[2], corners[3], segments[0][0]];

  if (rightAngleCount >= 3) {
    if (isSquare) {
      return { type: 'square', points: rectPoints, confidence: 0.9, isClosed: true };
    }
    return { type: 'rectangle', points: rectPoints, confidence: 0.9, isClosed: true };
  }

  return { type: 'polygon', points: rectPoints, confidence: 0.7, isClosed: true };
}

// Helper functions

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateStraightness(points: Point[]): number {
  if (points.length < 3) return 0;

  const start = points[0];
  const end = points[points.length - 1];
  const lineLength = distance(start, end);

  if (lineLength < 0.001) return Infinity;

  let maxDeviation = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const deviation = pointToLineDistance(points[i], start, end);
    maxDeviation = Math.max(maxDeviation, deviation);
  }

  return maxDeviation / lineLength;
}

function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength < 0.001) return distance(point, lineStart);

  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (lineLength * lineLength))
  );

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

function calculateInteriorAngle(p1: Point, p2: Point, p3: Point): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;

  const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (len1 < 0.001 || len2 < 0.001) return 0;

  const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
}

function checkIsClosed(points: Point[], threshold: number): boolean {
  if (points.length < 3) return false;

  const start = points[0];
  const end = points[points.length - 1];
  const closeDistance = distance(start, end);

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 1; i < points.length; i++) {
    perimeter += distance(points[i - 1], points[i]);
  }

  const relativeThreshold = Math.max(10, perimeter * threshold);
  return closeDistance < relativeThreshold;
}

interface CircleFit {
  center: Point;
  radius: number;
  error: number;
}

function fitCircle(points: Point[]): CircleFit | null {
  if (points.length < 5) return null;

  // Simple circle fitting using average center and radius
  let sumX = 0,
    sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const center = { x: sumX / points.length, y: sumY / points.length };

  const radii = points.map((p) => distance(p, center));
  const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;

  const squaredDiffs = radii.map((r) => (r - avgRadius) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / radii.length;
  const error = Math.sqrt(variance) / avgRadius;

  return { center, radius: avgRadius, error };
}

interface EllipseFit {
  center: Point;
  majorAxis: number;
  minorAxis: number;
  angle: number;
  error: number;
}

function fitEllipse(points: Point[]): EllipseFit | null {
  if (points.length < 8) return null;

  // Simplified ellipse fitting - just check if it's oval-shaped
  const circleFit = fitCircle(points);
  if (!circleFit) return null;

  // Calculate principal axes using covariance matrix
  let sumX = 0,
    sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const center = { x: sumX / points.length, y: sumY / points.length };

  let covXX = 0,
    covYY = 0,
    covXY = 0;
  for (const p of points) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    covXX += dx * dx;
    covYY += dy * dy;
    covXY += dx * dy;
  }

  const n = points.length;
  covXX /= n;
  covYY /= n;
  covXY /= n;

  // Eigenvalues give us the axes
  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const discriminant = Math.sqrt(trace * trace - 4 * det);

  const eigenvalue1 = (trace + discriminant) / 2;
  const eigenvalue2 = (trace - discriminant) / 2;

  const majorAxis = Math.sqrt(Math.max(eigenvalue1, eigenvalue2)) * 2;
  const minorAxis = Math.sqrt(Math.min(eigenvalue1, eigenvalue2)) * 2;

  // Calculate rotation angle
  let angle = 0;
  if (covXX !== covYY) {
    angle = Math.atan2(2 * covXY, covXX - covYY) / 2;
  }

  // Calculate error
  const expectedArea = Math.PI * (majorAxis / 2) * (minorAxis / 2);
  const actualArea = estimateArea(points);
  const error = Math.abs(expectedArea - actualArea) / Math.max(expectedArea, actualArea);

  return { center, majorAxis, minorAxis, angle, error };
}

interface ArcFit {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  coverage: number;
}

function fitArc(points: Point[]): ArcFit | null {
  const circleFit = fitCircle(points);
  if (!circleFit) return null;

  // Calculate angles
  const angles = points.map((p) => Math.atan2(p.y - circleFit.center.y, p.x - circleFit.center.x));

  let minAngle = angles[0];
  let maxAngle = angles[0];
  for (const angle of angles) {
    minAngle = Math.min(minAngle, angle);
    maxAngle = Math.max(maxAngle, angle);
  }

  let coverage = maxAngle - minAngle;
  if (coverage < 0) coverage += 2 * Math.PI;

  return {
    center: circleFit.center,
    radius: circleFit.radius,
    startAngle: minAngle,
    endAngle: maxAngle,
    coverage,
  };
}

function estimateArea(points: Point[]): number {
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function generateCirclePoints(center: Point, radius: number, numPoints: number = 32): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  points.push(points[0]);
  return points;
}

function generateEllipsePoints(
  center: Point,
  majorAxis: number,
  minorAxis: number,
  angle: number,
  numPoints: number = 32
): Point[] {
  const points: Point[] = [];
  const cosT = Math.cos(angle);
  const sinT = Math.sin(angle);
  const a = majorAxis / 2;
  const b = minorAxis / 2;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const localX = a * Math.cos(theta);
    const localY = b * Math.sin(theta);
    points.push({
      x: center.x + localX * cosT - localY * sinT,
      y: center.y + localX * sinT + localY * cosT,
    });
  }
  points.push(points[0]);
  return points;
}

function generateArcPoints(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  numPoints: number = 32
): Point[] {
  const points: Point[] = [];
  let coverage = endAngle - startAngle;
  if (coverage < 0) coverage += 2 * Math.PI;

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const angle = startAngle + t * coverage;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return points;
}
