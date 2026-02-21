import type { Point } from '../types';
import { distance } from '../utils';
import { computeTurnAngle } from './cornerDetection';
import { fitLinesToSegments, checkPerpendicular, checkParallel } from './fitting';

export type ShapeType = 
  | 'line' 
  | 'polyline' 
  | 'angle' 
  | 'triangle' 
  | 'rectangle' 
  | 'circle' 
  | 'ellipse'
  | 'arc'
  | 'curve'
  | 'unknown';

export interface ClassificationResult {
  type: ShapeType;
  points: Point[];
  confidence: number;
}

export function classifyShape(
  segments: Point[][],
  isClosed: boolean
): ClassificationResult {
  if (segments.length === 0) {
    return { type: 'unknown', points: [], confidence: 0 };
  }

  if (segments.length === 1) {
    return classifySingleSegment(segments[0], isClosed);
  }

  return classifyMultipleSegments(segments, isClosed);
}

function classifySingleSegment(segment: Point[], isClosed: boolean): ClassificationResult {
  if (segment.length < 2) {
    return { type: 'unknown', points: [], confidence: 0 };
  }

  const start = segment[0];
  const end = segment[segment.length - 1];
  const length = distance(start, end);

  if (length < 10) {
    return { type: 'line', points: [start, end], confidence: 0.9 };
  }

  const angles = getSegmentAngles(segment);
  const avgRadius = angles.avgRadius;
  const stdDev = angles.stdDev;
  const angularCoverage = angles.angularCoverage;

  if (angularCoverage > Math.PI * 1.5 && isClosed) {
    if (stdDev / avgRadius < 0.15) {
      return { type: 'circle', points: generateCirclePoints(angles.center, avgRadius), confidence: 0.8 };
    }
  }

  if (angularCoverage > Math.PI / 3) {
    if (stdDev / avgRadius < 0.2) {
      return { type: 'arc', points: generateArcPoints(angles.center, avgRadius, angles.minAngle, angularCoverage), confidence: 0.7 };
    }
  }

  return { type: 'line', points: [start, end], confidence: 0.9 };
}

interface SegmentAngles {
  center: Point;
  avgRadius: number;
  stdDev: number;
  angularCoverage: number;
  minAngle: number;
  maxAngle: number;
}

function getSegmentAngles(segment: Point[]): SegmentAngles {
  const n = segment.length;
  if (n < 3) {
    return {
      center: segment[0],
      avgRadius: 0,
      stdDev: 0,
      angularCoverage: 0,
      minAngle: 0,
      maxAngle: 0,
    };
  }

  let sumX = 0, sumY = 0;
  for (const p of segment) {
    sumX += p.x;
    sumY += p.y;
  }
  const center = { x: sumX / n, y: sumY / n };

  const radii = segment.map(p => distance(p, center));
  const avgRadius = radii.reduce((a, b) => a + b, 0) / n;
  const squaredDiffs = radii.map(r => (r - avgRadius) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(variance);

  const angles = segment.map(p => Math.atan2(p.y - center.y, p.x - center.x));
  let minAngle = angles[0];
  let maxAngle = angles[0];
  for (let i = 1; i < angles.length; i++) {
    minAngle = Math.min(minAngle, angles[i]);
    maxAngle = Math.max(maxAngle, angles[i]);
  }
  let angularCoverage = maxAngle - minAngle;
  if (angularCoverage < 0) angularCoverage += 2 * Math.PI;

  return {
    center,
    avgRadius,
    stdDev,
    angularCoverage,
    minAngle,
    maxAngle,
  };
}

function classifyMultipleSegments(segments: Point[][], isClosed: boolean): ClassificationResult {
  const numSegments = segments.length;

  if (numSegments === 2) {
    return classifyAngle(segments, isClosed);
  }

  if (numSegments === 3 && isClosed) {
    return classifyTriangle(segments);
  }

  if (numSegments === 4 && isClosed) {
    return classifyRectangle(segments);
  }

  if (isClosed && numSegments >= 5) {
    return classifyPolygon(segments);
  }

  return classifyPolyline(segments);
}

function classifyAngle(segments: Point[][], isClosed: boolean): ClassificationResult {
  const corner = segments[0][segments[0].length - 1];
  
  if (!isClosed) {
    return {
      type: 'angle',
      points: [segments[0][0], corner, segments[1][segments[1].length - 1]],
      confidence: 0.8,
    };
  }

  return classifyPolygon(segments);
}

function classifyTriangle(segments: Point[][]): ClassificationResult {
  const corners = segments.map(s => s[s.length - 1]);
  
  if (corners.length !== 3) {
    return { type: 'unknown', points: [], confidence: 0 };
  }
  
  const p0 = segments[0][0];
  const p1 = corners[0];
  const p2 = corners[1];
  
  const perimeter = distance(p0, p1) + distance(p1, p2) + distance(p2, p0);
  
  if (perimeter < 30) {
    return { type: 'unknown', points: [], confidence: 0 };
  }
  
  const avgSideLength = perimeter / 3;
  const side1 = distance(p0, p1);
  const side2 = distance(p1, p2);
  const side3 = distance(p2, p0);
  
  const sideVariation = Math.max(
    Math.abs(side1 - avgSideLength),
    Math.abs(side2 - avgSideLength),
    Math.abs(side3 - avgSideLength)
  ) / avgSideLength;
  
  const points = [
    segments[0][0],
    corners[0],
    corners[1],
    corners[2],
    segments[0][0],
  ];
  
  let confidence = 0.7;
  
  if (sideVariation < 0.3) {
    confidence = 0.85;
  } else if (sideVariation < 0.5) {
    confidence = 0.75;
  }
  
  return { type: 'triangle', points, confidence };
}

function classifyRectangle(segments: Point[][]): ClassificationResult {
  const corners = segments.map(s => s[s.length - 1]);
  
  if (corners.length !== 4) {
    return classifyPolygon(segments);
  }

  const segmentPoints: Point[][] = [];
  
  for (let i = 0; i < 4; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % 4];
    segmentPoints.push([start, end]);
  }
  
  const { lines } = fitLinesToSegments(
    segments.flat(),
    [0, 1, 2, 3].map(i => i * 10).filter((_, i) => i < segments.length)
  );
  
  if (lines.length < 4) {
    return classifyPolygon(segments);
  }
  
  let perpendicularCount = 0;
  let parallelCount = 0;
  const sideLengths: number[] = [];
  
  for (let i = 0; i < 4; i++) {
    const line1 = lines[i];
    const line2 = lines[(i + 1) % 4];
    
    if (checkPerpendicular(line1, line2, 0.2)) {
      perpendicularCount++;
    }
    
    const line3 = lines[(i + 2) % 4];
    if (checkParallel(line1, line3, 0.2)) {
      parallelCount++;
    }
    
    sideLengths.push(distance(corners[i], corners[(i + 1) % 4]));
  }
  
  const avgLength = sideLengths.reduce((a, b) => a + b, 0) / 4;
  const lengthVariations = sideLengths.map(l => Math.abs(l - avgLength) / avgLength);
  const similarLengths = lengthVariations.filter(v => v < 0.25).length;
  
  if (perpendicularCount >= 3 && parallelCount >= 2 && similarLengths >= 2) {
    const points = [
      segments[0][0],
      corners[0],
      corners[1],
      corners[2],
      corners[3],
      segments[0][0],
    ];
    return { type: 'rectangle', points, confidence: 0.85 };
  }
  
  const angles = [];
  for (let i = 0; i < 4; i++) {
    const prev = corners[(i + 3) % 4];
    const curr = corners[i];
    const next = corners[(i + 1) % 4];
    const angle = computeTurnAngle(prev, curr, next);
    angles.push(angle);
  }

  let rightAngleCount = 0;
  for (const angle of angles) {
    const deviation = Math.abs(angle - Math.PI / 2);
    if (deviation < Math.PI / 6) {
      rightAngleCount++;
    }
  }

  if (rightAngleCount >= 3) {
    const points = [
      segments[0][0],
      corners[0],
      corners[1],
      corners[2],
      corners[3],
      segments[0][0],
    ];
    return { type: 'rectangle', points, confidence: 0.8 };
  }

  return classifyPolygon(segments);
}

function classifyPolygon(segments: Point[][]): ClassificationResult {
  const corners = segments.map(s => s[s.length - 1]);
  const points = [segments[0][0], ...corners];

  if (points.length > 0) {
    points.push(points[0]);
  }

  return { type: 'polyline', points, confidence: 0.6 };
}

function classifyPolyline(segments: Point[][]): ClassificationResult {
  const allPoints: Point[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      allPoints.push(...segments[i]);
    } else {
      allPoints.push(...segments[i].slice(1));
    }
  }

  return { type: 'polyline', points: allPoints, confidence: 0.7 };
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

function generateArcPoints(
  center: Point, 
  radius: number, 
  startAngle: number, 
  angularCoverage: number,
  numPoints: number = 32
): Point[] {
  const points: Point[] = [];
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
