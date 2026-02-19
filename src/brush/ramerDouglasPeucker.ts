import type { Point } from '../types';

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq
    )
  );

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

function rdpRecursive(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) {
    return points;
  }

  let maxDist = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpRecursive(points.slice(0, maxIndex + 1), epsilon);
    const right = rdpRecursive(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}

export function simplifyRDP(points: Point[], epsilon: number = 5): Point[] {
  if (points.length < 3) {
    return points;
  }
  return rdpRecursive(points, epsilon);
}

export function isStraightLine(points: Point[], epsilon: number = 5): boolean {
  if (points.length < 3) {
    return true;
  }
  const simplified = rdpRecursive(points, epsilon);
  return simplified.length <= 2;
}

export function calculateStrokeLength(points: Point[]): number {
  if (points.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

export function getAdaptiveEpsilon(points: Point[]): number {
  const length = calculateStrokeLength(points);
  return Math.max(3, Math.min(15, length / 50));
}
