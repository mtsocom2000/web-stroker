import type { Point, LengthUnit, AngleUnit, Stroke } from './types';

export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle);
}

export function pixelsToUnit(pixels: number, _unit: LengthUnit, pixelsPerUnit: number): number {
  return pixels / pixelsPerUnit;
}

export function unitToPixels(units: number, pixelsPerUnit: number): number {
  return units * pixelsPerUnit;
}

export function formatLength(value: number, unit?: LengthUnit): string {
  if (!unit) {
    if (value < 1) {
      return value.toFixed(2);
    }
    if (value < 10) {
      return value.toFixed(1);
    }
    return `${Math.round(value)}`;
  }

  if (unit === 'px') {
    return `${Math.round(value)}px`;
  }

  if (value < 1) {
    return `${value.toFixed(2)}${unit}`;
  }

  if (value < 10) {
    return `${value.toFixed(1)}${unit}`;
  }

  return `${Math.round(value)}${unit}`;
}

export function formatAngle(value: number, unit: AngleUnit): string {
  if (unit === 'radian') {
    return `${value.toFixed(2)}rad`;
  }

  const degrees = (value * 180) / Math.PI;
  return `${degrees.toFixed(1)}°`;
}

export function getAcuteAngle(angle: number): number {
  return Math.min(angle, Math.PI - angle);
}

export function snapToGrid(
  point: Point,
  gridSize: number,
  threshold: number
): Point | null {
  const snappedX = Math.round(point.x / gridSize) * gridSize;
  const snappedY = Math.round(point.y / gridSize) * gridSize;

  const dx = point.x - snappedX;
  const dy = point.y - snappedY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= threshold) {
    return { x: snappedX, y: snappedY };
  }

  return null;
}

export interface MeasurementResult {
  value: number;
  formatted: string;
}

export function measureDistance(
  start: Point,
  end: Point,
  unit: LengthUnit,
  pixelsPerUnit: number
): MeasurementResult {
  const px = distance(start, end);
  const value = pixelsToUnit(px, unit, pixelsPerUnit);
  return { value, formatted: formatLength(value, unit) };
}

export function measureAngle(
  _line1Start: Point,
  vertex: Point,
  line1End: Point,
  line2End: Point,
  unit: AngleUnit
): MeasurementResult {
  const angle = angleBetween(line1End, vertex, line2End);
  const acuteAngle = getAcuteAngle(angle);
  const formatted = formatAngle(acuteAngle, unit);
  return { value: acuteAngle, formatted };
}

export function measureRadius(
  center: Point,
  edgePoint: Point,
  unit: LengthUnit,
  pixelsPerUnit: number
): MeasurementResult {
  const px = distance(center, edgePoint);
  const value = pixelsToUnit(px, unit, pixelsPerUnit);
  return { value, formatted: formatLength(value, unit) };
}

export function calculateAngleBetweenLines(
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point,
  unit: AngleUnit
): MeasurementResult {
  const dx1 = line1End.x - line1Start.x;
  const dy1 = line1End.y - line1Start.y;
  const dx2 = line2End.x - line2Start.x;
  const dy2 = line2End.y - line2Start.y;

  const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

  if (mag1 === 0 || mag2 === 0) {
    return { value: 0, formatted: '0°' };
  }

  const dot = dx1 * dx2 + dy1 * dy2;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angle = Math.acos(cosAngle);

  const acuteAngle = getAcuteAngle(angle);
  const formatted = formatAngle(acuteAngle, unit);
  return { value: acuteAngle, formatted };
}

export function checkParallelLines(
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point,
  threshold: number = 0.01
): boolean {
  const dx1 = line1End.x - line1Start.x;
  const dy1 = line1End.y - line1Start.y;
  const dx2 = line2End.x - line2Start.x;
  const dy2 = line2End.y - line2Start.y;

  const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

  if (mag1 === 0 || mag2 === 0) return false;

  const cross = dx1 * dy2 - dy1 * dx2;
  return Math.abs(cross / (mag1 * mag2)) < threshold;
}

/**
 * Find the intersection point of two infinite lines defined by two points each.
 * If lines are parallel, returns the midpoint between the two closest endpoints.
 */
export function findLineIntersection(
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point
): Point {
  const x1 = line1Start.x, y1 = line1Start.y;
  const x2 = line1End.x, y2 = line1End.y;
  const x3 = line2Start.x, y3 = line2Start.y;
  const x4 = line2End.x, y4 = line2End.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel
  if (Math.abs(denom) < 1e-10) {
    // Return midpoint of the two closest endpoints
    const mid1 = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const mid2 = { x: (x3 + x4) / 2, y: (y3 + y4) / 2 };
    return { x: (mid1.x + mid2.x) / 2, y: (mid1.y + mid2.y) / 2 };
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

/**
 * Find intersection points between a circle and an infinite line.
 * @param center - Circle center point
 * @param radius - Circle radius (must be positive)
 * @param lineStart - First point defining the line
 * @param lineEnd - Second point defining the line
 * @returns Array of intersection points (0, 1, or 2 points)
 */
export function lineCircleIntersections(
  center: Point,
  radius: number,
  lineStart: Point,
  lineEnd: Point
): Point[] {
  const epsilon = 1e-10;

  // Direction vector of the line
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLenSq = dx * dx + dy * dy;

  // Degenerate case: line is a point
  if (lineLenSq < epsilon) {
    const distToCenter = Math.sqrt(
      (center.x - lineStart.x) ** 2 + (center.y - lineStart.y) ** 2
    );
    return Math.abs(distToCenter - radius) < epsilon ? [{ ...lineStart }] : [];
  }

  // Vector from line start to circle center
  const fx = center.x - lineStart.x;
  const fy = center.y - lineStart.y;

  // Project center onto the line: t = (f · d) / |d|²
  const t = (fx * dx + fy * dy) / lineLenSq;

  // Closest point on the line to the circle center
  const closestX = lineStart.x + t * dx;
  const closestY = lineStart.y + t * dy;

  // Distance from circle center to closest point on line
  const distX = center.x - closestX;
  const distY = center.y - closestY;
  const distSq = distX * distX + distY * distY;
  const dist = Math.sqrt(distSq);

  // No intersection if line is too far from circle
  if (dist > radius + epsilon) {
    return [];
  }

  // Tangent case: line touches circle at exactly one point
  if (Math.abs(dist - radius) < epsilon) {
    return [{ x: closestX, y: closestY }];
  }

  // Two intersection points
  // Half-chord distance from closest point to intersection points
  const halfChord = Math.sqrt(radius * radius - distSq);

  // Normalize direction vector
  const dirLen = Math.sqrt(lineLenSq);
  const uxNorm = dx / dirLen;
  const uyNorm = dy / dirLen;

  return [
    {
      x: closestX - halfChord * uxNorm,
      y: closestY - halfChord * uyNorm
    },
    {
      x: closestX + halfChord * uxNorm,
      y: closestY + halfChord * uyNorm
    }
  ];
}

/**
 * Check if a point lies on a line segment (within tolerance).
 * Returns true if point is on the segment, false otherwise.
 * Tolerance defaults to 1e-6 for floating-point comparison.
 */
export function isPointOnSegment(
  point: Point,
  segStart: Point,
  segEnd: Point,
  tolerance: number = 1e-6
): boolean {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq < tolerance) {
    // Segment is essentially a point
    const dpx = point.x - segStart.x;
    const dpy = point.y - segStart.y;
    return dpx * dpx + dpy * dpy < tolerance;
  }

  // Project point onto the line
  const t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / segLenSq;

  // Check if t is within [0, 1] (on the segment)
  if (t < -tolerance || t > 1 + tolerance) {
    return false;
  }

  // Check distance from point to line
  const closestX = segStart.x + t * dx;
  const closestY = segStart.y + t * dy;
  const distSq = (point.x - closestX) ** 2 + (point.y - closestY) ** 2;

  return distSq < tolerance;
}

/**
 * Find the closest point on a line segment to a given point.
 * Returns the closest point on the segment (clamped to segment bounds).
 */
export function closestPointOnSegment(
  point: Point,
  segStart: Point,
  segEnd: Point
): Point {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    // Segment is a point
    return { x: segStart.x, y: segStart.y };
  }

  // Project point onto the line, clamped to [0, 1]
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy
  };
}

export type SnapType = 'integer' | 'strokePoint' | 'intersection' | 'origin' | 'polylinePoint';

export interface SnapResult {
  point: Point;
  type: SnapType;
  distance: number;
}

export function findNearestIntegerPoint(
  point: Point,
  threshold: number
): SnapResult | null {
  const snappedX = Math.round(point.x);
  const snappedY = Math.round(point.y);

  const dx = point.x - snappedX;
  const dy = point.y - snappedY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= threshold) {
    return {
      point: { x: snappedX, y: snappedY },
      type: 'integer',
      distance: dist,
    };
  }

  return null;
}

export function findNearestOriginPoint(
  point: Point,
  threshold: number
): SnapResult | null {
  const origin = { x: 0, y: 0 };
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= threshold) {
    return {
      point: origin,
      type: 'origin',
      distance: dist,
    };
  }

  return null;
}

export function findNearestPolylinePoint(
  point: Point,
  polylinePoints: Point[],
  threshold: number
): SnapResult | null {
  let nearestResult: SnapResult | null = null;

  for (const p of polylinePoints) {
    const dx = point.x - p.x;
    const dy = point.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= threshold) {
      if (!nearestResult || dist < nearestResult.distance) {
        nearestResult = {
          point: { x: p.x, y: p.y },
          type: 'polylinePoint',
          distance: dist,
        };
      }
    }
  }

  return nearestResult;
}

export function findNearestStrokePoint(
  point: Point,
  strokes: Stroke[],
  threshold: number
): SnapResult | null {
  let nearestResult: SnapResult | null = null;

  for (const stroke of strokes) {
    if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;

    for (const segment of stroke.digitalSegments) {
      if (segment.points.length < 2) continue;

      const startPoint = segment.points[0];
      const endPoint = segment.points[segment.points.length - 1];

      for (const p of [startPoint, endPoint]) {
        const dx = point.x - p.x;
        const dy = point.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= threshold) {
          if (!nearestResult || dist < nearestResult.distance) {
            nearestResult = {
              point: { x: p.x, y: p.y },
              type: 'strokePoint',
              distance: dist,
            };
          }
        }
      }
    }
  }

  return nearestResult;
}

export interface IntersectionInfo {
  point: Point;
  segments: Array<{ strokeId: string; segmentIndex: number }>;
}

export function findNearestIntersectionPoint(
  point: Point,
  intersections: IntersectionInfo[],
  threshold: number
): SnapResult | null {
  let nearestResult: SnapResult | null = null;

  for (const intersection of intersections) {
    const dx = point.x - intersection.point.x;
    const dy = point.y - intersection.point.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= threshold) {
      if (!nearestResult || dist < nearestResult.distance) {
        nearestResult = {
          point: { x: intersection.point.x, y: intersection.point.y },
          type: 'intersection',
          distance: dist,
        };
      }
    }
  }

  return nearestResult;
}

export interface SnapOptions {
  strokes: Stroke[];
  intersections: IntersectionInfo[];
  polylinePoints?: Point[];
  threshold: number;
}

export function findBestSnapPoint(
  point: Point,
  options: SnapOptions
): SnapResult | null {
  const { strokes, intersections, polylinePoints, threshold } = options;

  const intersectionResult = findNearestIntersectionPoint(point, intersections, threshold);
  if (intersectionResult) {
    return intersectionResult;
  }

  if (polylinePoints && polylinePoints.length > 0) {
    const polylineResult = findNearestPolylinePoint(point, polylinePoints, threshold);
    if (polylineResult) {
      return polylineResult;
    }
  }

  const strokePointResult = findNearestStrokePoint(point, strokes, threshold);
  if (strokePointResult) {
    return strokePointResult;
  }

  const originResult = findNearestOriginPoint(point, threshold);
  if (originResult) {
    return originResult;
  }

  const integerResult = findNearestIntegerPoint(point, threshold);
  return integerResult;
}
