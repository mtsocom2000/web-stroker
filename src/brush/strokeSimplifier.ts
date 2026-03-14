import type { Point } from '../types';
import { simplifyRDP, getAdaptiveEpsilon } from './ramerDouglasPeucker';
import { detectCorners, getCornerIndices } from './cornerDetection';

export interface SimplificationOptions {
  useAdaptiveEpsilon: boolean;
  baseEpsilon: number;
  minPoints: number;
  detectCorners: boolean;
}

export const DEFAULT_SIMPLIFICATION_OPTIONS: SimplificationOptions = {
  useAdaptiveEpsilon: true,
  baseEpsilon: 3,
  minPoints: 2,
  detectCorners: true,
};

export interface StrokeSegment {
  startIndex: number;
  endIndex: number;
  startPoint: Point;
  endPoint: Point;
  avgVelocity: number;
  angle: number;
  isStraight: boolean;
  points: Point[];
}

export interface SimplificationResult {
  simplifiedPoints: Point[];
  cornerPoints: Point[];
  cornerIndices: number[];
  segments: StrokeSegment[];
  originalPointCount: number;
  reductionRatio: number;
}

/**
 * Simplifies a stroke by removing redundant points while preserving shape.
 * Uses Ramer-Douglas-Peucker algorithm with adaptive epsilon.
 *
 * Key improvements over previous version:
 * 1. Uses RDP instead of aggressive corner-based simplification
 * 2. Preserves curves naturally (RDP keeps deviation points)
 * 3. Adaptive epsilon based on stroke length
 * 4. Never reduces curves to just 2 points
 * 5. Still provides corner detection for predict mode
 */
export function simplifyStroke(
  points: Point[],
  options: Partial<SimplificationOptions> = {}
): SimplificationResult {
  const opts = { ...DEFAULT_SIMPLIFICATION_OPTIONS, ...options };

  if (points.length < 2) {
    return {
      simplifiedPoints: points,
      cornerPoints: points,
      cornerIndices: points.map((_, i) => i),
      segments: [],
      originalPointCount: points.length,
      reductionRatio: 0,
    };
  }

  // Calculate adaptive epsilon based on stroke characteristics
  const epsilon = opts.useAdaptiveEpsilon
    ? getAdaptiveEpsilon(points)
    : opts.baseEpsilon;

  // Apply RDP simplification
  // RDP naturally preserves curves by keeping points that deviate from straight lines
  const simplifiedPoints = simplifyRDP(points, epsilon);

  // Detect corners using the corner detection algorithm (for predict mode)
  // This runs on the ORIGINAL points, not simplified, to get accurate corner detection
  let cornerIndices: number[] = [];
  let cornerPoints: Point[] = [];

  if (opts.detectCorners && points.length >= 3) {
    const pointData = detectCorners(points);
    cornerIndices = getCornerIndices(pointData);
    cornerPoints = cornerIndices.map((i) => points[i]);
  } else {
    // Fallback: use start and end as corners
    cornerIndices = [0, points.length - 1];
    cornerPoints = [points[0], points[points.length - 1]];
  }

  // Build segments from corner indices
  // Each segment connects consecutive corners
  const segments: StrokeSegment[] = [];

  for (let i = 0; i < cornerIndices.length - 1; i++) {
    const startIdx = cornerIndices[i];
    const endIdx = cornerIndices[i + 1];
    const segmentPoints = points.slice(startIdx, endIdx + 1);

    const startPoint = points[startIdx];
    const endPoint = points[endIdx];

    // Calculate average velocity for this segment
    let totalVelocity = 0;
    let velocityCount = 0;
    for (let j = startIdx; j <= endIdx; j++) {
      if (j > 0 && points[j].timestamp && points[j - 1].timestamp) {
        const dx = points[j].x - points[j - 1].x;
        const dy = points[j].y - points[j - 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dt = points[j].timestamp! - points[j - 1].timestamp!;
        if (dt > 0) {
          totalVelocity += dist / dt;
          velocityCount++;
        }
      }
    }
    const avgVelocity = velocityCount > 0 ? totalVelocity / velocityCount : 0;

    // Calculate angle of this segment
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const angle = Math.atan2(dy, dx);

    // Check if segment is straight using RDP on just this segment
    const simplifiedSegment = simplifyRDP(segmentPoints, epsilon);
    const isStraight = simplifiedSegment.length <= 2;

    segments.push({
      startIndex: startIdx,
      endIndex: endIdx,
      startPoint,
      endPoint,
      avgVelocity,
      angle,
      isStraight,
      points: segmentPoints,
    });
  }

  return {
    simplifiedPoints,
    cornerPoints,
    cornerIndices,
    segments,
    originalPointCount: points.length,
    reductionRatio: 1 - simplifiedPoints.length / points.length,
  };
}
