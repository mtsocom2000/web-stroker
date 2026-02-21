import type { Point } from '../types';

export interface LineFitResult {
  slope: number;
  intercept: number;
  normalizedError: number;
  points: [Point, Point];
}

export interface CircleFitResult {
  center: Point;
  radius: number;
  normalizedError: number;
  residuals: number[];
}

export interface EllipseFitResult {
  center: Point;
  majorAxis: number;
  minorAxis: number;
  angle: number;
  normalizedError: number;
}

export function computeArcLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

export function computePerimeter(points: Point[]): number {
  return computeArcLength(points);
}

export function resampleByArcLength(points: Point[], spacing: number): Point[] {
  if (points.length < 2) return [...points];

  const result: Point[] = [points[0]];
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (segmentLength < 0.001) continue;

    while (accumulated + segmentLength >= (result.length) * spacing) {
      const remaining = result.length * spacing - accumulated;
      const ratio = remaining / segmentLength;
      result.push({
        x: prev.x + dx * ratio,
        y: prev.y + dy * ratio,
      });
      accumulated += remaining;
    }
  }

  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }

  return result;
}

export function fitLine(points: Point[]): LineFitResult | null {
  if (points.length < 2) return null;

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = meanY - slope * meanX;

  let totalError = 0;
  for (const p of points) {
    const predictedY = slope * p.x + intercept;
    const error = p.y - predictedY;
    totalError += error * error;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const lineLength = Math.sqrt(
    (last.x - first.x) ** 2 + (last.y - first.y) ** 2
  );

  const normalizedError = lineLength > 0 ? Math.sqrt(totalError / n) / lineLength : 0;

  return {
    slope,
    intercept,
    normalizedError,
    points: [first, last],
  };
}

function fitLineFromPoints(p1: Point, p2: Point): { a: number; b: number; c: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len < 1e-10) {
    return { a: 1, b: 0, c: -p1.x };
  }
  
  const nx = -dy / len;
  const ny = dx / len;
  
  return {
    a: nx,
    b: ny,
    c: -(nx * p1.x + ny * p1.y),
  };
}

export function fitLinesToSegments(points: Point[], corners: number[]): { lines: { a: number; b: number; c: number }[], segments: Point[][] } {
  const segments: Point[][] = [];
  const lines: { a: number; b: number; c: number }[] = [];
  
  let startIdx = 0;
  for (const cornerIdx of corners) {
    if (cornerIdx > startIdx) {
      const segment = points.slice(startIdx, cornerIdx + 1);
      segments.push(segment);
      
      if (segment.length >= 2) {
        lines.push(fitLineFromPoints(segment[0], segment[segment.length - 1]));
      }
    }
    startIdx = cornerIdx;
  }
  
  if (startIdx < points.length) {
    const segment = points.slice(startIdx);
    segments.push(segment);
    
    if (segment.length >= 2) {
      lines.push(fitLineFromPoints(segment[0], segment[segment.length - 1]));
    }
  }
  
  return { lines, segments };
}

export function fitCircleTaubin(points: Point[]): CircleFitResult | null {
  if (points.length < 3) return null;

  const n = points.length;
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumX3 = 0, sumY3 = 0, sumXY = 0, sumX2Y = 0, sumXY2 = 0;

  for (const p of points) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    const y2 = y * y;
    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumXY += x * y;
    sumX2Y += x2 * y;
    sumXY2 += x * y2;
  }

  const Mxx = sumX2 - sumX * sumX / n;
  const Myy = sumY2 - sumY * sumY / n;
  const Mxy = sumXY - sumX * sumY / n;
  const Mxz = (sumX3 + sumXY2 - (sumX2 + sumY2) * sumX / n) / 2;
  const Myz = (sumY3 + sumX2Y - (sumX2 + sumY2) * sumY / n) / 2;

  const denominator = Mxx * Myy - Mxy * Mxy;
  if (Math.abs(denominator) < 1e-10) return null;

  const cx = (Myz * Mxy - Mxz * Myy) / denominator;
  const cy = (Mxz * Mxy - Myz * Mxx) / denominator;

  let sumRadius = 0;
  const residuals: number[] = [];

  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const radius = Math.sqrt(dx * dx + dy * dy);
    sumRadius += radius;
    residuals.push(radius);
  }

  const radius = sumRadius / n;

  let totalError = 0;
  for (let i = 0; i < n; i++) {
    const error = residuals[i] - radius;
    totalError += error * error;
  }

  const normalizedError = radius > 0 ? Math.sqrt(totalError / n) / radius : 0;

  return {
    center: { x: cx, y: cy },
    radius,
    normalizedError,
    residuals,
  };
}

export function fitCircle(points: Point[]): CircleFitResult | null {
  return fitCircleTaubin(points);
}

function distanceToEllipse(
  px: number,
  py: number,
  cx: number,
  cy: number,
  a: number,
  b: number,
  theta: number
): number {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const dx = px - cx;
  const dy = py - cy;

  const x = dx * cosT + dy * sinT;
  const y = -dx * sinT + dy * cosT;

  const normalizedX = x / a;
  const normalizedY = y / b;
  const dist = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY) - 1;

  return dist * Math.min(a, b);
}

export function fitEllipse(points: Point[]): EllipseFitResult | null {
  if (points.length < 5) return null;

  const n = points.length;
  
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
    sumXY += p.x * p.y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;
  const meanX2 = sumX2 / n;
  const meanY2 = sumY2 / n;
  const meanXY = sumXY / n;

  const dx = meanX2 - meanX * meanX;
  const dy = meanY2 - meanY * meanY;
  const dxy = meanXY - meanX * meanY;

  const a = dx;
  const b = dxy;
  const c = dy;

  const centerX = (b * (meanY2 - meanY * meanY) - c * (meanXY - meanX * meanY)) / (b * b - a * c);
  const centerY = (a * (meanXY - meanX * meanY) - b * (meanX2 - meanX * meanX)) / (b * b - a * c);

  const centeredPoints = points.map(p => ({
    x: p.x - centerX,
    y: p.y - centerY,
  }));

  let sumXc2 = 0, sumYc2 = 0, sumXcYc = 0;
  for (const p of centeredPoints) {
    sumXc2 += p.x * p.x;
    sumYc2 += p.y * p.y;
    sumXcYc += p.x * p.y;
  }

  const covXX = sumXc2 / n;
  const covYY = sumYc2 / n;
  const covXY = sumXcYc / n;

  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;

  if (det <= 0) return null;

  const eigen1 = trace / 2 + Math.sqrt(trace * trace / 4 - det);
  const eigen2 = trace / 2 - Math.sqrt(trace * trace / 4 - det);

  let a2 = Math.sqrt(eigen1);
  let b2 = Math.sqrt(eigen2);

  if (a2 < b2) {
    const temp = a2;
    a2 = b2;
    b2 = temp;
  }

  if (a2 < 5 || b2 < 5) return null;

  const theta = 0.5 * Math.atan2(2 * covXY, covXX - covYY);

  let totalError = 0;
  for (const p of points) {
    const error = distanceToEllipse(p.x, p.y, centerX, centerY, a2, b2, theta);
    totalError += error * error;
  }

  const avgRadius = (a2 + b2) / 2;
  const normalizedError = avgRadius > 0 ? Math.sqrt(totalError / n) / avgRadius : 0;

  return {
    center: { x: centerX, y: centerY },
    majorAxis: a2,
    minorAxis: b2,
    angle: theta,
    normalizedError,
  };
}

export function computeAngularCoverage(points: Point[], center: Point): number {
  const angles = points.map(p => Math.atan2(p.y - center.y, p.x - center.x));
  
  let minAngle = angles[0];
  let maxAngle = angles[0];
  
  for (let i = 1; i < angles.length; i++) {
    minAngle = Math.min(minAngle, angles[i]);
    maxAngle = Math.max(maxAngle, angles[i]);
  }
  
  let coverage = maxAngle - minAngle;
  if (coverage < 0) coverage += 2 * Math.PI;
  
  return coverage;
}

export function isConvexShape(points: Point[]): boolean {
  if (points.length < 3) return true;

  let sign = 0;
  
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    
    if (Math.abs(cross) > 1e-10) {
      const currentSign = cross > 0 ? 1 : -1;
      if (sign === 0) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
  }
  
  return sign !== 0;
}

export function checkPerpendicular(line1: { a: number; b: number; c: number }, line2: { a: number; b: number; c: number }, tolerance: number = 0.15): boolean {
  const dot = line1.a * line2.a + line1.b * line2.b;
  const len1 = Math.sqrt(line1.a * line1.a + line1.b * line1.b);
  const len2 = Math.sqrt(line2.a * line2.a + line2.b * line2.b);
  
  if (len1 < 1e-10 || len2 < 1e-10) return false;
  
  const cosAngle = Math.abs(dot) / (len1 * len2);
  return Math.abs(cosAngle) < tolerance;
}

export function checkParallel(line1: { a: number; b: number; c: number }, line2: { a: number; b: number; c: number }, tolerance: number = 0.15): boolean {
  const dot = line1.a * line2.a + line1.b * line2.b;
  const len1 = Math.sqrt(line1.a * line1.a + line1.b * line1.b);
  const len2 = Math.sqrt(line2.a * line2.a + line2.b * line2.b);
  
  if (len1 < 1e-10 || len2 < 1e-10) return false;
  
  const cosAngle = Math.abs(dot) / (len1 * len2);
  return Math.abs(cosAngle - 1) < tolerance;
}

export function distancePointToLine(px: number, py: number, line: { a: number; b: number; c: number }): number {
  const { a, b, c } = line;
  const denominator = Math.sqrt(a * a + b * b);
  if (denominator < 1e-10) return Infinity;
  return Math.abs(a * px + b * py + c) / denominator;
}
