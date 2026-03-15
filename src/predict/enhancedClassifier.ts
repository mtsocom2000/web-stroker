import type { Point } from '../types';
import type { ShapeFeatures } from './shapeAnalysis';
import { computeLineDeviation } from './shapeAnalysis';

/**
 * 图形类型
 */
export type EnhancedShapeType =
  | 'line'
  | 'angle'
  | 'triangle'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'arc'
  | 'curve'
  | 'polygon'
  | 'polyline'
  | 'unknown';

/**
 * 图形评分结果
 */
export interface ShapeScore {
  type: EnhancedShapeType;
  score: number; // 0-1
  confidence: number; // 0-1
  reason: string;
}

/**
 * 图形分类结果
 */
export interface EnhancedClassification {
  type: EnhancedShapeType;
  points: Point[];
  confidence: number;
  isClosed: boolean;
  allScores: ShapeScore[];
  metadata?: unknown;
}

/**
 * 主分类函数
 * 根据特征分析结果对所有图形类型进行评分
 * 
 * @param points 轨迹点
 * @param features 特征分析结果
 * @returns 分类结果和所有图形类型的评分
 */
export function classifyShapeWithScores(
  points: Point[],
  features: ShapeFeatures
): EnhancedClassification {
  // 计算所有图形的评分
  const scores: ShapeScore[] = [
    scoreLine(points, features),
    scoreAngle(points, features),
    scoreTriangle(points, features),
    scoreRectangle(points, features),
    scoreSquare(points, features),
    scoreCircle(points, features),
    scoreEllipse(points, features),
    scoreArc(points, features),
    scoreCurve(points, features),
    scorePolygon(points, features),
    scorePolyline(points, features),
  ];
  
  // 按评分排序
  scores.sort((a, b) => b.score - a.score);
  
  // 获取最高分
  const best = scores[0];
  
  // 生成规整图形点
  const generatedPoints = generateShapePoints(best.type, points, features);
  
  return {
    type: best.type,
    points: generatedPoints,
    confidence: best.confidence,
    isClosed: features.isClosed,
    allScores: scores,
  };
}

/**
 * 直线评分
 * 条件：顶点数≈0，平均曲率极低，点到首尾连线的平均偏差小
 */
function scoreLine(points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  const avgCurvature = features.avgCurvature;
  const lineDeviation = computeLineDeviation(points);
  const bbox = features.bbox;
  
  // 计算直线度评分
  let score = 0;
  const reasons: string[] = [];
  
  // 顶点数评分（越少越好）
  if (cornerCount === 0) {
    score += 0.4;
    reasons.push('无顶点');
  } else if (cornerCount <= 2) {
    score += 0.2;
    reasons.push('顶点少');
  }
  
  // 曲率评分（越低越好）
  if (avgCurvature < 0.05) {
    score += 0.3;
    reasons.push('曲率极低');
  } else if (avgCurvature < 0.1) {
    score += 0.15;
    reasons.push('曲率低');
  }
  
  // 直线偏差评分（越小越好，相对于包围盒尺寸）
  const relativeDeviation = lineDeviation / (Math.max(bbox.width, bbox.height) + 1e-9);
  if (relativeDeviation < 0.05) {
    score += 0.3;
    reasons.push('偏差极小');
  } else if (relativeDeviation < 0.1) {
    score += 0.15;
    reasons.push('偏差小');
  }
  
  return {
    type: 'line',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合直线特征',
  };
}

/**
 * 角/折线评分
 * 条件：顶点数=1，该顶点两侧各自曲率很低
 */
function scoreAngle(_points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  // 必须不是封闭图形
  if (features.isClosed) {
    return { type: 'angle', score: 0, confidence: 0, reason: '封闭图形不是角' };
  }
  
  // 顶点数评分
  if (cornerCount === 1) {
    score += 0.5;
    reasons.push('单个顶点');
  } else if (cornerCount === 2) {
    score += 0.3;
    reasons.push('两个顶点');
  }
  
  // 曲率评分
  if (features.avgCurvature < 0.1) {
    score += 0.3;
    reasons.push('曲率低');
  }
  
  // 路径长度适中
  const diagonal = Math.hypot(features.bbox.width, features.bbox.height);
  if (features.pathLength > diagonal * 1.5 && features.pathLength < diagonal * 3) {
    score += 0.2;
    reasons.push('长度适中');
  }
  
  return {
    type: 'angle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合角特征',
  };
}

/**
 * 三角形评分
 * 条件：顶点数≈3，首尾相近（封闭），3段均低曲率
 */
function scoreTriangle(_points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  // 必须封闭
  if (!features.isClosed) {
    return { type: 'triangle', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  // 顶点数评分
  if (cornerCount === 3) {
    score += 0.5;
    reasons.push('3个顶点');
  } else if (cornerCount >= 2 && cornerCount <= 4) {
    score += 0.3;
    reasons.push('顶点数接近3');
  }
  
  // 曲率评分
  if (features.avgCurvature < 0.1) {
    score += 0.3;
    reasons.push('曲率低');
  }
  
  // 封闭性评分
  if (features.closedDistance < features.bbox.width * 0.1) {
    score += 0.2;
    reasons.push('封闭良好');
  }
  
  return {
    type: 'triangle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合三角形特征',
  };
}

/**
 * 四边形评分
 * 条件：顶点数≈4，首尾相近，4段均低曲率
 */
function scoreRectangle(_points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  // 必须封闭
  if (!features.isClosed) {
    return { type: 'rectangle', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  // 顶点数评分
  if (cornerCount === 4) {
    score += 0.5;
    reasons.push('4个顶点');
  } else if (cornerCount >= 3 && cornerCount <= 5) {
    score += 0.3;
    reasons.push('顶点数接近4');
  }
  
  // 曲率评分
  if (features.avgCurvature < 0.08) {
    score += 0.3;
    reasons.push('曲率极低');
  }
  
  // 宽高比评分（矩形通常有合理的宽高比）
  const ratio = features.bbox.aspectRatio;
  if (ratio > 0.3 && ratio < 3) {
    score += 0.2;
    reasons.push('比例合理');
  }
  
  return {
    type: 'rectangle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合矩形特征',
  };
}

/**
 * 正方形评分
 * 条件：顶点数≈4，封闭，宽高比≈1
 */
function scoreSquare(_points: Point[], features: ShapeFeatures): ShapeScore {
  const rectScore = scoreRectangle(_points, features);
  
  // 如果不是矩形，也不可能是正方形
  if (rectScore.score < 0.3) {
    return { type: 'square', score: 0, confidence: 0, reason: '不符合矩形基本特征' };
  }
  
  let score = rectScore.score * 0.7; // 继承矩形评分的一部分
  const reasons: string[] = ['基本符合矩形特征'];
  
  // 宽高比评分（正方形宽高比≈1）
  const ratio = features.bbox.aspectRatio;
  const ratioDeviation = Math.abs(1 - ratio);
  if (ratioDeviation < 0.1) {
    score += 0.3;
    reasons.push('宽高比接近1:1');
  } else if (ratioDeviation < 0.2) {
    score += 0.15;
    reasons.push('宽高比接近正方形');
  }
  
  return {
    type: 'square',
    score,
    confidence: score,
    reason: reasons.join(', '),
  };
}

/**
 * 圆形评分
 * 条件：顶点数≈0，曲率均匀，首尾相近，轨迹长度≈2πr
 */
function scoreCircle(_points: Point[], features: ShapeFeatures): ShapeScore {
  let score = 0;
  const reasons: string[] = [];
  
  // 必须封闭
  if (!features.isClosed) {
    return { type: 'circle', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  // 顶点数评分（圆形应该没有明显的角）
  if (features.corners.length === 0) {
    score += 0.3;
    reasons.push('无顶点');
  } else if (features.corners.length <= 2) {
    score += 0.15;
    reasons.push('顶点极少');
  }
  
  // 曲率均匀性评分
  const curvatureVariance = computeCurvatureVariance(features);
  if (curvatureVariance < 0.1) {
    score += 0.3;
    reasons.push('曲率均匀');
  } else if (curvatureVariance < 0.2) {
    score += 0.15;
    reasons.push('曲率较均匀');
  }
  
  // 路径长度与周长匹配度
  const bbox = features.bbox;
  const estimatedRadius = (bbox.width + bbox.height) / 4;
  const expectedCircumference = 2 * Math.PI * estimatedRadius;
  const lengthRatio = features.pathLength / expectedCircumference;
  
  if (lengthRatio > 0.8 && lengthRatio < 1.2) {
    score += 0.25;
    reasons.push('周长匹配');
  }
  
  // 宽高比（圆形应该接近1:1）
  const ratioDeviation = Math.abs(1 - bbox.aspectRatio);
  if (ratioDeviation < 0.2) {
    score += 0.15;
    reasons.push('接近正圆');
  }
  
  return {
    type: 'circle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合圆形特征',
  };
}

/**
 * 椭圆评分
 * 条件：同圆但包围盒纵横比≠1，曲率周期性变化
 */
function scoreEllipse(_points: Point[], features: ShapeFeatures): ShapeScore {
  const circleScore = scoreCircle(_points, features);
  
  // 如果不是圆形，也不可能是椭圆
  if (circleScore.score < 0.3) {
    return { type: 'ellipse', score: 0, confidence: 0, reason: '不符合圆形基本特征' };
  }
  
  let score = circleScore.score * 0.7; // 继承圆形评分的一部分
  const reasons: string[] = ['基本符合圆形特征'];
  
  const bbox = features.bbox;
  const ratio = bbox.aspectRatio;
  
  // 宽高比评分（椭圆应该有明显的长短轴差异）
  if (ratio > 1.3 && ratio < 3) {
    score += 0.3;
    reasons.push('明显的长短轴');
  } else if (ratio > 1.1 && ratio <= 1.3) {
    score += 0.15;
    reasons.push('轻微椭圆');
  }
  
  return {
    type: 'ellipse',
    score,
    confidence: score,
    reason: reasons.join(', '),
  };
}

/**
 * 圆弧评分
 * 条件：曲率均匀，不封闭或部分封闭
 */
function scoreArc(_points: Point[], features: ShapeFeatures): ShapeScore {
  let score = 0;
  const reasons: string[] = [];
  
  // 圆弧不应该是完全封闭的
  if (features.isClosed && features.closedDistance < features.bbox.width * 0.1) {
    return { type: 'arc', score: 0, confidence: 0, reason: '完全封闭的可能是圆' };
  }
  
  // 顶点数评分
  if (features.corners.length === 0) {
    score += 0.3;
    reasons.push('无顶点');
  }
  
  // 曲率均匀性评分
  const curvatureVariance = computeCurvatureVariance(features);
  if (curvatureVariance < 0.15) {
    score += 0.4;
    reasons.push('曲率均匀');
  }
  
  // 平均曲率评分（圆弧应该有明显的曲率）
  if (features.avgCurvature > 0.05 && features.avgCurvature < 0.3) {
    score += 0.3;
    reasons.push('曲率适中');
  }
  
  return {
    type: 'arc',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合圆弧特征',
  };
}

/**
 * 曲线评分
 * 条件：单段曲线，不规则
 */
function scoreCurve(_points: Point[], features: ShapeFeatures): ShapeScore {
  // 如果其他图形评分都很低，则认为是曲线
  const hasLowCorners = features.corners.length <= 1;
  const hasModerateCurvature = features.avgCurvature > 0.05;
  
  let score = 0;
  if (hasLowCorners) score += 0.3;
  if (hasModerateCurvature) score += 0.3;
  if (!features.isClosed) score += 0.2;
  
  return {
    type: 'curve',
    score,
    confidence: score * 0.6, // 曲线置信度较低
    reason: hasLowCorners && hasModerateCurvature ? '单段不规则曲线' : '未识别为规则图形',
  };
}

/**
 * 多边形评分
 * 条件：5+顶点，封闭
 */
function scorePolygon(_points: Point[], features: ShapeFeatures): ShapeScore {
  if (!features.isClosed) {
    return { type: 'polygon', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  if (cornerCount >= 5) {
    score += 0.6;
    reasons.push(`${cornerCount}个顶点`);
  } else if (cornerCount === 4) {
    score += 0.3;
    reasons.push('4个顶点');
  }
  
  // 曲率评分
  if (features.avgCurvature < 0.1) {
    score += 0.3;
    reasons.push('曲率低');
  }
  
  return {
    type: 'polygon',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合多边形特征',
  };
}

/**
 * 多段线评分
 * 条件：多段，不封闭
 */
function scorePolyline(_points: Point[], features: ShapeFeatures): ShapeScore {
  if (features.isClosed) {
    return { type: 'polyline', score: 0, confidence: 0, reason: '封闭图形不是多段线' };
  }
  
  const cornerCount = features.corners.length;
  
  let score = 0;
  if (cornerCount >= 2) score += 0.4;
  if (features.pathLength > features.bbox.width * 1.5) score += 0.3;
  
  return {
    type: 'polyline',
    score,
    confidence: score,
    reason: cornerCount >= 2 ? '多段不封闭路径' : '未识别为多段线',
  };
}

/**
 * 计算曲率方差（用于判断曲率均匀性）
 */
function computeCurvatureVariance(features: ShapeFeatures): number {
  if (features.curvatures.length < 2) return 0;
  
  const mean = features.avgCurvature;
  const squaredDiffs = features.curvatures.map(c => Math.pow(c.curvature - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  
  return Math.sqrt(variance); // 返回标准差
}

/**
 * 根据图形类型生成规整的点
 */
function generateShapePoints(
  type: EnhancedShapeType,
  originalPoints: Point[],
  features: ShapeFeatures
): Point[] {
  const bbox = features.bbox;
  
  switch (type) {
    case 'line':
      return [originalPoints[0], originalPoints[originalPoints.length - 1]];
    
    case 'angle': {
      const corner = features.corners[0];
      if (corner) {
        return [
          originalPoints[0],
          originalPoints[corner.index],
          originalPoints[originalPoints.length - 1],
        ];
      }
      return originalPoints;
    }
    
    case 'triangle': {
      // 使用包围盒中心和对角点构建等边三角形
      const corners = features.corners.slice(0, 3).map(c => originalPoints[c.index]);
      if (corners.length === 3) {
        return [...corners, corners[0]];
      }
      return originalPoints;
    }
    
    case 'rectangle':
    case 'square': {
      const w = bbox.width;
      const h = type === 'square' ? bbox.width : bbox.height;
      return [
        { x: bbox.minX, y: bbox.minY },
        { x: bbox.minX + w, y: bbox.minY },
        { x: bbox.minX + w, y: bbox.minY + h },
        { x: bbox.minX, y: bbox.minY + h },
        { x: bbox.minX, y: bbox.minY },
      ];
    }
    
    case 'circle':
      return generateCirclePoints(
        { x: bbox.cx, y: bbox.cy },
        (bbox.width + bbox.height) / 4
      );
    
    case 'ellipse':
      return generateEllipsePoints(
        { x: bbox.cx, y: bbox.cy },
        bbox.width / 2,
        bbox.height / 2
      );
    
    case 'arc':
      return generateArcPoints(originalPoints, features);
    
    default:
      return originalPoints;
  }
}

/**
 * 生成圆形点
 */
function generateCirclePoints(center: Point, radius: number, numPoints: number = 32): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * 生成椭圆点
 */
function generateEllipsePoints(
  center: Point,
  a: number, // 半长轴
  b: number, // 半短轴
  numPoints: number = 32
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    points.push({
      x: center.x + a * Math.cos(angle),
      y: center.y + b * Math.sin(angle),
    });
  }
  return points;
}

/**
 * 生成圆弧点
 */
function generateArcPoints(points: Point[], features: ShapeFeatures): Point[] {
  // 简化的圆弧生成，使用拟合的圆心和角度
  const bbox = features.bbox;
  const center = { x: bbox.cx, y: bbox.cy };
  const radius = (bbox.width + bbox.height) / 4;
  
  // 计算起始和结束角度
  const startAngle = Math.atan2(points[0].y - center.y, points[0].x - center.x);
  const endAngle = Math.atan2(
    points[points.length - 1].y - center.y,
    points[points.length - 1].x - center.x
  );
  
  const numPoints = 32;
  const result: Point[] = [];
  
  let coverage = endAngle - startAngle;
  if (coverage < 0) coverage += 2 * Math.PI;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startAngle + t * coverage;
    result.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  
  return result;
}
