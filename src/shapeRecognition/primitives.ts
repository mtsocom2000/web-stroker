import type { Point } from '../types';
import { distance } from '../utils';

export type PrimitiveType = 'line' | 'arc' | 'curve';

export interface Primitive {
  type: PrimitiveType;
  points: Point[];
  error: number;
}

export interface LinePrimitive extends Primitive {
  type: 'line';
  start: Point;
  end: Point;
  length: number;
}

export interface ArcPrimitive extends Primitive {
  type: 'arc';
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  angularCoverage: number;
}

export interface CurvePrimitive extends Primitive {
  type: 'curve';
  controlPoints: Point[];
}

export type AnyPrimitive = LinePrimitive | ArcPrimitive | CurvePrimitive;

export interface PrimitiveFitResult {
  primitive: AnyPrimitive;
  isValid: boolean;
}

export interface PrimitiveFittingOptions {
  lineErrorThreshold: number;
  arcErrorThreshold: number;
  minArcAngle: number;
}

export const DEFAULT_PRIMITIVE_OPTIONS: PrimitiveFittingOptions = {
  lineErrorThreshold: 3.0,
  arcErrorThreshold: 4.0,
  minArcAngle: Math.PI / 6, // 30 degrees
};

export function fitPrimitive(
  points: Point[],
  options: PrimitiveFittingOptions = DEFAULT_PRIMITIVE_OPTIONS
): PrimitiveFitResult {
  if (points.length < 2) {
    return { primitive: createLinePrimitive(points), isValid: false };
  }

  const lineResult = fitLine(points);
  if (lineResult.isValid && lineResult.primitive.error < options.lineErrorThreshold) {
    return lineResult;
  }

  const arcResult = fitArc(points);
  if (arcResult.isValid && arcResult.primitive.error < options.arcErrorThreshold) {
    return arcResult;
  }

  return fitBezier(points);
}

function createLinePrimitive(points: Point[]): LinePrimitive {
  const start = points[0];
  const end = points[points.length - 1];
  const length = distance(start, end);
  return {
    type: 'line',
    points,
    error: length > 0 ? 0 : Infinity,
    start,
    end,
    length,
  };
}

export function fitLine(points: Point[]): PrimitiveFitResult {
  if (points.length < 2) {
    return { primitive: createLinePrimitive(points), isValid: false };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const length = distance(start, end);

  if (length < 5) {
    return { primitive: createLinePrimitive(points), isValid: false };
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;

  let maxError = 0;
  let totalError = 0;

  for (const p of points) {
    const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const err = Math.hypot(p.x - projX, p.y - projY);
    maxError = Math.max(maxError, err);
    totalError += err;
  }

  const avgError = totalError / points.length;
  const isValid = maxError < length * 0.1;

  return {
    primitive: {
      type: 'line',
      points,
      error: avgError,
      start,
      end,
      length,
    },
    isValid,
  };
}

export function fitArc(points: Point[]): PrimitiveFitResult {
  if (points.length < 5) {
    return {
      primitive: {
        type: 'arc',
        points,
        error: Infinity,
        center: points[0],
        radius: 0,
        startAngle: 0,
        endAngle: 0,
        angularCoverage: 0,
      },
      isValid: false,
    };
  }

  const center = findArcCenter(points);
  if (!center) {
    return {
      primitive: {
        type: 'arc',
        points,
        error: Infinity,
        center: points[0],
        radius: 0,
        startAngle: 0,
        endAngle: 0,
        angularCoverage: 0,
      },
      isValid: false,
    };
  }

  const radii = points.map(p => distance(p, center));
  const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;

  const squaredDiffs = radii.map(r => (r - avgRadius) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / radii.length;
  const stdDev = Math.sqrt(variance);

  const angles = points.map(p => Math.atan2(p.y - center.y, p.x - center.x));
  let minAngle = angles[0];
  let maxAngle = angles[0];
  for (let i = 1; i < angles.length; i++) {
    minAngle = Math.min(minAngle, angles[i]);
    maxAngle = Math.max(maxAngle, angles[i]);
  }
  let angularCoverage = maxAngle - minAngle;
  if (angularCoverage < 0) angularCoverage += 2 * Math.PI;

  const error = stdDev;
  const isValid = angularCoverage > Math.PI / 6 && avgRadius > 5;

  return {
    primitive: {
      type: 'arc',
      points,
      error,
      center,
      radius: avgRadius,
      startAngle: angles[0],
      endAngle: angles[angles.length - 1],
      angularCoverage,
    },
    isValid,
  };
}

function findArcCenter(points: Point[]): Point | null {
  const n = points.length;
  if (n < 3) return null;

  let sumX = 0, sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const centroid = { x: sumX / n, y: sumY / n };

  const radii = points.map(p => distance(p, centroid));
  const avgRadius = radii.reduce((a, b) => a + b, 0) / n;

  let nearCount = 0;
  for (const r of radii) {
    if (Math.abs(r - avgRadius) < avgRadius * 0.3) {
      nearCount++;
    }
  }

  if (nearCount / n > 0.5) {
    return centroid;
  }

  let bestCenter: Point | null = null;
  let bestVariance = Infinity;

  const sampleSize = Math.min(n, 8);
  for (let i = 0; i < sampleSize; i++) {
    for (let j = i + 1; j < sampleSize; j++) {
      const p1 = points[i];
      const p2 = points[j];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      let perpX = -(p2.y - p1.y);
      let perpY = p2.x - p1.x;
      const len = Math.hypot(perpX, perpY);
      if (len < 1) continue;
      perpX /= len;
      perpY /= len;

      const d = distance(p1, p2) / 2;
      const candidates = [
        { x: midX + perpX * d, y: midY + perpY * d },
        { x: midX - perpX * d, y: midY - perpY * d },
      ];

      for (const c of candidates) {
        const rs = points.map(p => distance(p, c));
        const avgR = rs.reduce((a, b) => a + b, 0) / n;
        const vars = rs.map(r => (r - avgR) ** 2).reduce((a, b) => a + b, 0) / n;

        if (vars < bestVariance) {
          bestVariance = vars;
          bestCenter = c;
        }
      }
    }
  }

  return bestCenter;
}

export function fitBezier(points: Point[]): PrimitiveFitResult {
  if (points.length < 2) {
    return {
      primitive: {
        type: 'curve',
        points,
        error: Infinity,
        controlPoints: points,
      },
      isValid: false,
    };
  }

  const controlPoints = computeBezierControlPoints(points);

  let maxError = 0;
  for (let i = 0; i < points.length; i++) {
    const t = points.length > 1 ? i / (points.length - 1) : 0;
    const bezierPoint = evaluateCubicBezier(controlPoints, t);
    const err = distance(points[i], bezierPoint);
    maxError = Math.max(maxError, err);
  }

  return {
    primitive: {
      type: 'curve',
      points,
      error: maxError,
      controlPoints,
    },
    isValid: maxError < 10,
  };
}

function computeBezierControlPoints(points: Point[]): Point[] {
  if (points.length < 2) return points;

  if (points.length === 2) {
    return [points[0], points[0], points[1], points[1]];
  }

  if (points.length === 3) {
    return [points[0], points[1], points[1], points[2]];
  }

  const n = points.length - 1;
  const p0 = points[0];
  const pn = points[n];

  const p1 = {
    x: points[1].x - (points[2].x - p0.x) / 6,
    y: points[1].y - (points[2].y - p0.y) / 6,
  };

  const pn1 = {
    x: points[n - 1].x + (pn.x - points[n - 2].x) / 6,
    y: points[n - 1].y + (pn.y - points[n - 2].y) / 6,
  };

  return [p0, p1, pn1, pn];
}

function evaluateCubicBezier(controlPoints: Point[], t: number): Point {
  const [p0, p1, p2, p3] = controlPoints;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

export function generatePointsFromPrimitive(primitive: AnyPrimitive, numPoints: number = 32): Point[] {
  switch (primitive.type) {
    case 'line': {
      const points: Point[] = [];
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        points.push({
          x: primitive.start.x + t * (primitive.end.x - primitive.start.x),
          y: primitive.start.y + t * (primitive.end.y - primitive.start.y),
        });
      }
      return points;
    }

    case 'arc': {
      const points: Point[] = [];
      const { center, radius, startAngle, angularCoverage } = primitive;
      
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const angle = startAngle + t * angularCoverage;
        points.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
        });
      }
      return points;
    }

    case 'curve': {
      const points: Point[] = [];
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        points.push(evaluateCubicBezier(primitive.controlPoints, t));
      }
      return points;
    }

    default:
      return [];
  }
}
