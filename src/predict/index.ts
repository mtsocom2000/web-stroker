import type { Point } from '../types';
import { analyzeMouseDynamics, type MouseDynamics } from './mouseDynamics';
import { analyzePointDensity, type PointDensity } from './pointDensity';
import {
  detectCornersWithFeatures,
  splitIntoSegments,
  type CornerDetectionResult,
} from './cornerDetection';
import {
  classifyShape,
  type ShapeType,
} from './shapeClassifier';
import {
  analyzeShapeFeatures,
} from './shapeAnalysis';
import {
  classifyShapeWithScores,
} from './enhancedClassifier';
import {
  classifyShapeImproved,
  type ImprovedShapeType,
} from './improvedClassifier';

export interface PredictOptions {
  useDynamics: boolean;
  useDensity: boolean;
  useEnhancedClassifier: boolean;
  useImprovedClassifier: boolean; // 使用改进的分类器
  minConfidence: number;
  fallbackToOriginal: boolean;
}

export const DEFAULT_PREDICT_OPTIONS: PredictOptions = {
  useDynamics: true,
  useDensity: true,
  useEnhancedClassifier: true,
  useImprovedClassifier: true, // 默认启用改进分类器
  minConfidence: 0.5, // 降低默认阈值到 0.5
  fallbackToOriginal: true,
};

export interface PredictResult {
  points: Point[];
  shapeType: ShapeType;
  confidence: number;
  isClosed: boolean;
  analysis: {
    dynamics: MouseDynamics;
    density: PointDensity;
    corners: CornerDetectionResult;
    segments: Point[][];
  };
}

/**
 * Main predict function that analyzes a stroke and predicts its shape.
 *
 * Pipeline:
 * 1. Analyze mouse dynamics (velocity, acceleration, direction)
 * 2. Analyze point density (crowded areas = corners)
 * 3. Detect corners using multiple features
 * 4. Split into segments
 * 5. Classify shape
 * 6. Generate perfect shape
 *
 * Returns predicted points or null if no shape detected.
 */
export function predictShape(
  points: Point[],
  options: Partial<PredictOptions> = {}
): Point[] | null {
  const result = predictShapeWithDetails(points, options);
  if (!result) return null;
  return result.points;
}

/**
 * Predict with full analysis details.
 */
export function predictShapeWithDetails(
  points: Point[],
  options: Partial<PredictOptions> = {}
): PredictResult | null {
  const opts = { ...DEFAULT_PREDICT_OPTIONS, ...options };

  if (points.length < 2) return null;

  // Stage 1: Analyze mouse dynamics
  const dynamics = analyzeMouseDynamics(points);

  // Stage 2: Analyze point density
  const density = analyzePointDensity(points);

  // Stage 3: Detect corners with multi-feature analysis
  const corners = detectCornersWithFeatures(points, dynamics, density);

  // Stage 4: Split into segments based on corners
  const segments = splitIntoSegments(points, corners.corners);

  // Stage 5: Classify shape
  let shapeType: ShapeType | ImprovedShapeType;
  let predictedPoints: Point[];
  let confidence: number;
  let isClosed: boolean;
  
  if (opts.useImprovedClassifier) {
    // 使用改进的分类器（优先）
    const features = analyzeShapeFeatures(points);
    const improvedResult = classifyShapeImproved(points, features);
    
    shapeType = improvedResult.type as ShapeType;
    predictedPoints = improvedResult.points;
    confidence = improvedResult.confidence;
    isClosed = improvedResult.isClosed;
  } else if (opts.useEnhancedClassifier) {
    // 使用增强分类器
    const features = analyzeShapeFeatures(points);
    const enhancedResult = classifyShapeWithScores(points, features);
    
    shapeType = enhancedResult.type as ShapeType;
    predictedPoints = enhancedResult.points;
    confidence = enhancedResult.confidence;
    isClosed = enhancedResult.isClosed;
  } else {
    // 使用旧分类器
    const classification = classifyShape(segments, dynamics);
    shapeType = classification.type;
    predictedPoints = classification.points;
    confidence = classification.confidence;
    isClosed = classification.isClosed;
  }

  // Stage 6: Check confidence threshold
  if (confidence < opts.minConfidence) {
    if (opts.fallbackToOriginal) {
      return {
        points,
        shapeType: 'unknown',
        confidence: 0,
        isClosed,
        analysis: {
          dynamics,
          density,
          corners,
          segments,
        },
      };
    }
    return null;
  }

  return {
    points: predictedPoints,
    shapeType,
    confidence,
    isClosed,
    analysis: {
      dynamics,
      density,
      corners,
      segments,
    },
  };
}

// Re-export all types
export type { MouseDynamics, SpeedPattern } from './mouseDynamics';
export type { PointDensity } from './pointDensity';
export type { CornerDetectionResult, CornerFeatures } from './cornerDetection';
export type { ShapeClassification, ShapeType } from './shapeClassifier';
export type { ImprovedClassification, ImprovedShapeType, ShapeScore } from './improvedClassifier';
