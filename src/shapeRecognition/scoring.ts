import type { Point } from '../types';
import { fitLine, fitCircle, fitEllipse, computeAngularCoverage, computePerimeter } from './fitting';
import { detectCornersAndSegments, isClosedShape } from './cornerDetection';
import { classifyShape, type ShapeType } from './classifier';

export interface ShapeScore {
  type: ShapeType;
  score: number;
  normalizedError: number;
  confidence: number;
  points: Point[];
}

interface ScoringWeights {
  errorWeight: number;
  coverageWeight: number;
  complexityPenalty: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  errorWeight: 0.5,
  coverageWeight: 0.3,
  complexityPenalty: 0.1,
};

function computeLineScore(points: Point[]): ShapeScore | null {
  const lineFit = fitLine(points);
  if (!lineFit) return null;

  const perimeter = computePerimeter(points);
  const startEndDist = Math.sqrt(
    (points[points.length - 1].x - points[0].x) ** 2 +
    (points[points.length - 1].y - points[0].y) ** 2
  );
  const closureRatio = startEndDist / perimeter;

  const errorScore = Math.max(0, 1 - lineFit.normalizedError / 0.05);
  const closureScore = 1 - closureRatio;
  const score = errorScore * 0.7 + closureScore * 0.3;

  if (score < 0.5) return null;

  return {
    type: 'line',
    score,
    normalizedError: lineFit.normalizedError,
    confidence: score,
    points: [points[0], points[points.length - 1]],
  };
}

function computeCircleScore(points: Point[]): ShapeScore | null {
  if (points.length < 10) return null;

  const perimeter = computePerimeter(points);
  const startEndDist = Math.sqrt(
    (points[points.length - 1].x - points[0].x) ** 2 +
    (points[points.length - 1].y - points[0].y) ** 2
  );
  
  if (startEndDist > Math.max(10, perimeter * 0.05)) return null;

  const circleFit = fitCircle(points);
  if (!circleFit) return null;

  if (circleFit.normalizedError > 0.15) return null;

  const angularCoverage = computeAngularCoverage(points, circleFit.center);
  const coverageScore = angularCoverage / (Math.PI * 2);

  const errorScore = Math.max(0, 1 - circleFit.normalizedError / 0.1);
  const score = errorScore * 0.6 + coverageScore * 0.4;

  if (score < 0.5) return null;

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

  return {
    type: 'circle',
    score,
    normalizedError: circleFit.normalizedError,
    confidence: score,
    points: circlePoints,
  };
}

function computeEllipseScore(points: Point[]): ShapeScore | null {
  if (points.length < 10) return null;

  const perimeter = computePerimeter(points);
  const startEndDist = Math.sqrt(
    (points[points.length - 1].x - points[0].x) ** 2 +
    (points[points.length - 1].y - points[0].y) ** 2
  );
  
  if (startEndDist > Math.max(10, perimeter * 0.05)) return null;

  const ellipseFit = fitEllipse(points);
  if (!ellipseFit) return null;

  if (ellipseFit.normalizedError > 0.15) return null;

  const axisRatio = ellipseFit.majorAxis / ellipseFit.minorAxis;
  if (axisRatio > 4) return null;

  const angularCoverage = computeAngularCoverage(points, ellipseFit.center);
  const coverageScore = angularCoverage / (Math.PI * 2);

  const errorScore = Math.max(0, 1 - ellipseFit.normalizedError / 0.12);
  const shapePenalty = Math.max(0, (axisRatio - 1) / 3) * 0.2;
  const score = errorScore * 0.6 + coverageScore * 0.4 - shapePenalty;

  if (score < 0.5) return null;

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

  return {
    type: 'ellipse',
    score,
    normalizedError: ellipseFit.normalizedError,
    confidence: score,
    points: ellipsePoints,
  };
}

function computePolygonScore(points: Point[], weights: ScoringWeights = DEFAULT_WEIGHTS): ShapeScore | null {
  const isClosed = isClosedShape(points, 0.2);
  const { segments } = detectCornersAndSegments(points, {
    angleThreshold: Math.PI / 6,
    velocityThreshold: 0.3,
    minCornerDistance: 20,
    minSegmentLength: 15,
  });

  const classification = classifyShape(segments, isClosed);
  
  if (classification.type === 'unknown' || classification.points.length < 2) {
    return null;
  }

  const cornerPenalty = Math.max(0, (segments.length - 3) * weights.complexityPenalty);
  const closureBonus = isClosed ? 0.1 : 0;

  return {
    type: classification.type,
    score: classification.confidence + closureBonus - cornerPenalty,
    normalizedError: 0,
    confidence: classification.confidence,
    points: classification.points,
  };
}

export function scoreShapes(points: Point[]): ShapeScore[] {
  const scores: ShapeScore[] = [];

  const lineScore = computeLineScore(points);
  if (lineScore) scores.push(lineScore);

  const circleScore = computeCircleScore(points);
  if (circleScore) scores.push(circleScore);

  const ellipseScore = computeEllipseScore(points);
  if (ellipseScore) scores.push(ellipseScore);

  const polygonScore = computePolygonScore(points);
  if (polygonScore) scores.push(polygonScore);

  scores.sort((a, b) => b.score - a.score);

  return scores;
}

export function predictShapeWithScoring(points: Point[]): Point[] | null {
  const scores = scoreShapes(points);
  
  const bestScore = scores.find(s => s.score > 0.6);
  
  if (bestScore) {
    return bestScore.points;
  }

  if (scores.length > 0) {
    return scores[0].points;
  }

  return null;
}

export function predictShapeWithScoringAndDetails(points: Point[]): ShapeScore | null {
  const scores = scoreShapes(points);
  
  const bestScore = scores.find(s => s.score > 0.6);
  
  if (bestScore) {
    return bestScore;
  }

  return scores.length > 0 ? scores[0] : null;
}
