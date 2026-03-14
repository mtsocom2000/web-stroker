import type { Point } from '../types';

/**
 * 计算两个图形的几何相似度
 * 用于验证预测结果是否与原始图形有足够的相似性
 * 
 * 相似度基于以下几个因素：
 * 1. 包围盒重叠度 (bounding box overlap)
 * 2. 方向一致性 (orientation consistency)
 * 3. 中心点距离 (centroid distance)
 * 4. 大小比例 (size ratio)
 * 
 * 返回 0-1 之间的相似度分数，低于阈值应认为预测失败
 */

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface ShapeOrientation {
  startPoint: Point;
  endPoint: Point;
  angle: number; // 弧度
}

/**
 * 计算包围盒
 */
function getBoundingBox(points: Point[]): BoundingBox {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * 计算两个包围盒的重叠度 (IoU - Intersection over Union)
 */
function calculateBoundingBoxOverlap(bb1: BoundingBox, bb2: BoundingBox): number {
  const intersectMinX = Math.max(bb1.minX, bb2.minX);
  const intersectMinY = Math.max(bb1.minY, bb2.minY);
  const intersectMaxX = Math.min(bb1.maxX, bb2.maxX);
  const intersectMaxY = Math.min(bb1.maxY, bb2.maxY);
  
  if (intersectMaxX <= intersectMinX || intersectMaxY <= intersectMinY) {
    return 0; // 无重叠
  }
  
  const intersectArea = (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
  const area1 = bb1.width * bb1.height;
  const area2 = bb2.width * bb2.height;
  const unionArea = area1 + area2 - intersectArea;
  
  return unionArea > 0 ? intersectArea / unionArea : 0;
}

/**
 * 计算图形的方向（从起点到终点的角度）
 */
function getShapeOrientation(points: Point[]): ShapeOrientation {
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const angle = Math.atan2(dy, dx);
  
  return { startPoint, endPoint, angle };
}

/**
 * 计算两个角度的差异（考虑周期性）
 */
function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2);
  while (diff > Math.PI) {
    diff = 2 * Math.PI - diff;
  }
  return diff;
}

/**
 * 计算中心点距离（相对于图形大小的归一化距离）
 */
function calculateNormalizedCentroidDistance(
  bb1: BoundingBox,
  bb2: BoundingBox
): number {
  const dx = bb1.centerX - bb2.centerX;
  const dy = bb1.centerY - bb2.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // 使用平均大小作为归一化因子
  const avgSize = (bb1.width + bb1.height + bb2.width + bb2.height) / 4;
  
  if (avgSize === 0) return distance > 0 ? 1 : 0;
  
  return Math.min(distance / avgSize, 1); // 限制在 0-1 之间
}

/**
 * 计算大小比例相似度
 */
function calculateSizeRatioSimilarity(bb1: BoundingBox, bb2: BoundingBox): number {
  if (bb1.width === 0 || bb1.height === 0 || bb2.width === 0 || bb2.height === 0) {
    return 0;
  }
  
  const widthRatio = Math.min(bb1.width, bb2.width) / Math.max(bb1.width, bb2.width);
  const heightRatio = Math.min(bb1.height, bb2.height) / Math.max(bb1.height, bb2.height);
  
  return (widthRatio + heightRatio) / 2;
}

export interface ShapeSimilarityResult {
  similarity: number; // 0-1
  boundingBoxOverlap: number;
  orientationDifference: number; // 弧度
  centroidDistance: number; // 归一化
  sizeRatio: number;
  passed: boolean;
}

/**
 * 计算两个图形的几何相似度
 * 
 * @param originalPoints 原始图形的点
 * @param predictedPoints 预测图形的点
 * @param threshold 通过阈值 (默认 0.3)
 * @returns 相似度结果
 */
export function calculateShapeSimilarity(
  originalPoints: Point[],
  predictedPoints: Point[],
  threshold: number = 0.3
): ShapeSimilarityResult {
  if (!originalPoints?.length || !predictedPoints?.length) {
    return {
      similarity: 0,
      boundingBoxOverlap: 0,
      orientationDifference: Math.PI,
      centroidDistance: 1,
      sizeRatio: 0,
      passed: false,
    };
  }
  
  const bb1 = getBoundingBox(originalPoints);
  const bb2 = getBoundingBox(predictedPoints);
  
  // 计算各项指标
  const boundingBoxOverlap = calculateBoundingBoxOverlap(bb1, bb2);
  
  const orient1 = getShapeOrientation(originalPoints);
  const orient2 = getShapeOrientation(predictedPoints);
  const orientationDifference = angleDifference(orient1.angle, orient2.angle);
  const orientationScore = 1 - (orientationDifference / Math.PI); // 归一化到 0-1
  
  const centroidDistance = calculateNormalizedCentroidDistance(bb1, bb2);
  const centroidScore = 1 - centroidDistance; // 距离越近分数越高
  
  const sizeRatio = calculateSizeRatioSimilarity(bb1, bb2);
  
  // 综合相似度分数（加权平均）
  // 包围盒重叠度权重最高，因为它综合了位置和大小
  const similarity = 
    boundingBoxOverlap * 0.5 +
    orientationScore * 0.2 +
    centroidScore * 0.2 +
    sizeRatio * 0.1;
  
  return {
    similarity,
    boundingBoxOverlap,
    orientationDifference,
    centroidDistance,
    sizeRatio,
    passed: similarity >= threshold,
  };
}

/**
 * 检查预测结果是否与原始图形有足够的相似性
 * 
 * @param originalPoints 原始绘制点
 * @param predictedPoints 预测后的点
 * @param minConfidence 最小置信度（低于此值直接返回失败）
 * @returns 是否通过相似性检查
 */
export function validateShapePrediction(
  originalPoints: Point[],
  predictedPoints: Point[] | null,
  minConfidence: number = 0.3
): boolean {
  if (!predictedPoints || predictedPoints.length === 0) {
    return false;
  }
  
  const result = calculateShapeSimilarity(originalPoints, predictedPoints, minConfidence);
  
  // 记录验证结果（用于调试）
  if (process.env.NODE_ENV === 'development') {
    console.log('Shape similarity validation:', {
      similarity: result.similarity.toFixed(3),
      boundingBoxOverlap: result.boundingBoxOverlap.toFixed(3),
      orientationDifference: (result.orientationDifference * 180 / Math.PI).toFixed(1) + '°',
      centroidDistance: result.centroidDistance.toFixed(3),
      sizeRatio: result.sizeRatio.toFixed(3),
      passed: result.passed,
    });
  }
  
  return result.passed;
}
