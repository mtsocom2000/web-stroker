import type { Point } from '../types';
import { detectCorners, getCornerIndices } from './cornerDetection';

function isVeryStraightLine(points: Point[], epsilon: number = 30): boolean {
  if (points.length < 3) return true;

  const start = points[0];
  const end = points[points.length - 1];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength < 10) return false; // Too short to be a meaningful line

  let maxDist = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    
    const t = Math.max(0, Math.min(1,
      ((p.x - start.x) * dx + (p.y - start.y) * dy) / (lineLength * lineLength)
    ));
    
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    
    const dist = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
    maxDist = Math.max(maxDist, dist);
  }

  // Only consider straight if max deviation is very small
  return maxDist < epsilon;
}

export interface SimplificationOptions {
  cornerDetection: {
    velocityThreshold: number;
    angleThreshold: number;
    minCornerDistance: number;
  };
  straightnessThreshold: number;
}

export const DEFAULT_SIMPLIFICATION_OPTIONS: SimplificationOptions = {
  cornerDetection: {
    velocityThreshold: 0.1,
    angleThreshold: 25,
    minCornerDistance: 2,
  },
  straightnessThreshold: 0.7,
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
}

export function simplifyStroke(points: Point[]): SimplificationResult {
  if (points.length < 2) {
    return {
      simplifiedPoints: points,
      cornerPoints: points,
      cornerIndices: points.map((_, i) => i),
      segments: [],
    };
  }

  // First, check if the entire stroke is a VERY straight line
  // Use large epsilon (30) to only detect nearly perfect straight lines
  if (isVeryStraightLine(points, 30)) {
    return {
      simplifiedPoints: [points[0], points[points.length - 1]],
      cornerPoints: [points[0], points[points.length - 1]],
      cornerIndices: [0, points.length - 1],
      segments: [{
        startIndex: 0,
        endIndex: points.length - 1,
        startPoint: points[0],
        endPoint: points[points.length - 1],
        avgVelocity: 0,
        angle: Math.atan2(points[points.length - 1].y - points[0].y, points[points.length - 1].x - points[0].x),
        isStraight: true,
        points,
      }],
    };
  }

  // Detect corners using the corner detection algorithm
  const pointData = detectCorners(points, DEFAULT_SIMPLIFICATION_OPTIONS.cornerDetection);
  const cornerIndices = getCornerIndices(pointData);
  const cornerPoints = cornerIndices.map((i) => points[i]);

  // If corners detected (more than start and end), use corner points as simplified output
  // This makes the corners visible in the final stroke
  let simplifiedPoints: Point[];
  if (cornerPoints.length > 2) {
    simplifiedPoints = cornerPoints;
  } else {
    simplifiedPoints = points;
  }

  // Build segments between corners
  const segments: StrokeSegment[] = [];
  
  for (let i = 0; i < cornerIndices.length - 1; i++) {
    const startIdx = cornerIndices[i];
    const endIdx = cornerIndices[i + 1];
    const segmentPoints = points.slice(startIdx, endIdx + 1);

    const startPoint = points[startIdx];
    const endPoint = points[endIdx];

    let totalVelocity = 0;
    for (let j = startIdx; j <= endIdx; j++) {
      totalVelocity += pointData[j].velocity;
    }
    const avgVelocity = totalVelocity / (endIdx - startIdx + 1);

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const angle = Math.atan2(dy, dx);

    segments.push({
      startIndex: startIdx,
      endIndex: endIdx,
      startPoint,
      endPoint,
      avgVelocity,
      angle,
      isStraight: false, // Don't mark as straight - keep original points
      points: segmentPoints,
    });
  }

  // Return - use corner points if detected, otherwise original points
  return {
    simplifiedPoints,
    cornerPoints,
    cornerIndices,
    segments,
  };
}
