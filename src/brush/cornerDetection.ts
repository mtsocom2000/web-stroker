import type { Point } from '../types';

export interface CornerDetectionOptions {
  velocityThreshold: number;
  angleThreshold: number;
  minCornerDistance: number;
}

export const DEFAULT_CORNER_OPTIONS: CornerDetectionOptions = {
  velocityThreshold: 0.1,
  angleThreshold: 25,
  minCornerDistance: 2,
};

export interface PointData {
  index: number;
  point: Point;
  velocity: number;
  angle: number;
  angleDiff: number;
  isCorner: boolean;
}

function getDirection(points: Point[], i: number, windowSize: number): number | null {
  if (i < windowSize || i >= points.length - windowSize) {
    return null;
  }

  const start = points[i - windowSize];
  const end = points[i + windowSize];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return null;
  }

  return Math.atan2(dy, dx);
}

export function detectCorners(points: Point[], options: Partial<CornerDetectionOptions> = {}): PointData[] {
  const opts = { ...DEFAULT_CORNER_OPTIONS, ...options };

  if (points.length < 3) {
    return points.map((p, i) => ({
      index: i,
      point: p,
      velocity: 0,
      angle: 0,
      angleDiff: 0,
      isCorner: false,
    }));
  }

  const pointData: PointData[] = [];
  let totalVelocity = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let velocity = 0;
    let angle = 0;

    if (i > 0) {
      const prev = points[i - 1];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let timeDelta = 1;
      if (point.timestamp && prev.timestamp) {
        timeDelta = Math.max(1, point.timestamp - prev.timestamp);
      }

      velocity = dist / timeDelta;
      angle = Math.atan2(dy, dx);
    }

    pointData.push({
      index: i,
      point,
      velocity,
      angle,
      angleDiff: 0,
      isCorner: false,
    });

    totalVelocity += velocity;
  }

  const avgVelocity = totalVelocity / points.length;
  const velocityThreshold = avgVelocity * opts.velocityThreshold;
  const angleThresholdRad = (opts.angleThreshold * Math.PI) / 180;

  const windowSize = Math.max(1, Math.min(3, Math.floor(points.length / 10)));

  for (let i = opts.minCornerDistance; i < points.length - opts.minCornerDistance; i++) {
    const current = pointData[i];

    const dirBefore = getDirection(points, i - windowSize, windowSize);
    const dirAfter = getDirection(points, i + windowSize, windowSize);

    let angleDiff = 0;
    if (dirBefore !== null && dirAfter !== null) {
      angleDiff = Math.abs(dirAfter - dirBefore);
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }
    }

    current.angleDiff = angleDiff;

    const isSlow = current.velocity < velocityThreshold && current.velocity > 0;
    const isDirectionChange = angleDiff > angleThresholdRad;

    if (isDirectionChange || isSlow) {
      current.isCorner = true;
    }
  }

  pointData[0].isCorner = true;
  if (points.length > 1) {
    pointData[points.length - 1].isCorner = true;
  }

  return pointData;
}

export function getCornerIndices(pointData: PointData[]): number[] {
  return pointData.filter((d) => d.isCorner).map((d) => d.index);
}
