import type { Point } from '../types';
import type { ShapeFeatures } from './shapeAnalysis';
import { computeLineDeviation } from './shapeAnalysis';

export type ImprovedShapeType =
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

export interface ShapeScore {
  type: ImprovedShapeType;
  score: number;
  confidence: number;
  reason: string;
}

export interface ImprovedClassification {
  type: ImprovedShapeType;
  points: Point[];
  confidence: number;
  isClosed: boolean;
  allScores: ShapeScore[];
  metadata?: unknown;
}

export function classifyShapeImproved(
  points: Point[],
  features: ShapeFeatures
): ImprovedClassification {
  const scores: ShapeScore[] = [
    scoreLineImproved(points, features),
    scoreAngleImproved(points, features),
    scoreTriangleImproved(points, features),
    scoreRectangleImproved(points, features),
    scoreSquareImproved(points, features),
    scoreCircleImproved(points, features),
    scoreEllipseImproved(points, features),
    scoreArcImproved(points, features),
    scoreCurveImproved(points, features),
    scorePolygonImproved(points, features),
    scorePolylineImproved(points, features),
  ];
  
  scores.sort((a, b) => {
    // Primary sort: by score descending
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    
    // When scores are tied or very close (within 0.15), use corner count as tie-breaker
    if (Math.abs(b.score - a.score) < 0.15) {
      // Triangle vs Rectangle tie-breaker based on corner count and angles
      if ((a.type === 'triangle' && b.type === 'rectangle') || 
          (a.type === 'rectangle' && b.type === 'triangle')) {
        const cornerCount = features.corners.length;
        const rightAngleCount = features.corners.filter(c => {
          const angleDeg = c.angle * 180 / Math.PI;
          return Math.abs(angleDeg - 90) < 30;
        }).length;
        
        if (cornerCount === 4) {
          if (rightAngleCount >= 2) {
            // 4 corners with right angles -> rectangle
            return a.type === 'rectangle' ? -1 : 1;
          } else {
            // 4 corners but NO right angles -> triangle (extra corner detected)
            return a.type === 'triangle' ? -1 : 1;
          }
        } else if (cornerCount === 3) {
          // 3 corners strongly suggests triangle
          return a.type === 'triangle' ? -1 : 1;
        }
      }
    }
    
    // For cases where rectangle score is higher but shouldn't be
    // Check if this is a 4-corner no-right-angle case (triangle)
    if ((a.type === 'triangle' && b.type === 'rectangle') || 
        (a.type === 'rectangle' && b.type === 'triangle')) {
      const cornerCount = features.corners.length;
      const rightAngleCount = features.corners.filter(c => {
        const angleDeg = c.angle * 180 / Math.PI;
        return Math.abs(angleDeg - 90) < 30;
      }).length;
      
      // If 4 corners but no right angles, strongly prefer triangle
      if (cornerCount === 4 && rightAngleCount === 0) {
        return a.type === 'triangle' ? -1 : 1;
      }
    }
    
    // Fallback to default order for other cases
    // Polygon has higher priority than triangle/rectangle as it's more general
    const typeOrder: { [key in ImprovedShapeType]?: number } = {
      'line': 0, 'angle': 1, 'polygon': 2, 'triangle': 3, 'rectangle': 4, 'square': 5,
      'circle': 6, 'ellipse': 7, 'arc': 8, 'curve': 9, 'polyline': 10, 'unknown': 11
    };
    const orderA = typeOrder[a.type] ?? 99;
    const orderB = typeOrder[b.type] ?? 99;
    return orderA - orderB;
  });
  const best = scores[0];
  
  // Post-processing: Fix triangle vs rectangle misclassification
  let finalType = best.type;
  let finalConfidence = best.confidence;
  
  const cornerCount = features.corners.length;
  const rightAngleCount = features.corners.filter(c => {
    const angleDeg = c.angle * 180 / Math.PI;
    return Math.abs(angleDeg - 90) < 30;
  }).length;
  
  // Case 1: If we have 4 corners but NO right angles, it should be triangle (not rectangle)
  if (cornerCount === 4 && rightAngleCount === 0) {
    if (best.type === 'rectangle') {
      // Find triangle score and swap
      const triangleScore = scores.find(s => s.type === 'triangle');
      if (triangleScore && triangleScore.score > 0.4) {
        finalType = 'triangle';
        finalConfidence = triangleScore.confidence;
      }
    }
  }
  
  // Case 2: If we have 3 corners with right angles, check if it's really a rectangle
  if (cornerCount === 3 && rightAngleCount >= 2) {
    // 3 corners with right angles is ambiguous - could be rectangle with one merged corner
    // Check if corner angle features indicate rectangle
    if (features.cornerAngleFeatures?.isRectLike && best.type === 'triangle') {
      // Keep rectangle if scores are close
      const rectScore = scores.find(s => s.type === 'rectangle');
      if (rectScore && Math.abs(rectScore.score - best.score) < 0.2) {
        finalType = 'rectangle';
        finalConfidence = rectScore.confidence;
      }
    }
    // If best is rectangle but we only have 3 corners, prefer triangle
    // unless it's clearly rect-like
    if (best.type === 'rectangle' && !features.cornerAngleFeatures?.isRectLike) {
      const triangleScore = scores.find(s => s.type === 'triangle');
      if (triangleScore && triangleScore.score >= best.score * 0.9) {
        finalType = 'triangle';
        finalConfidence = triangleScore.confidence;
      }
    }
  }
  
  // Case 3: If we have exactly 3 corners and no right angles, force triangle
  if (cornerCount === 3 && rightAngleCount === 0 && best.type === 'rectangle') {
    const triangleScore = scores.find(s => s.type === 'triangle');
    if (triangleScore) {
      finalType = 'triangle';
      finalConfidence = triangleScore.confidence;
    }
  }
  
  // Case 4: Polygon priority - but only when specific shape detection is uncertain
  // For rectangles with right angles, prefer rectangle over generic polygon
  // For triangles with 3 corners, prefer triangle over polygon
  // Only fall back to polygon when the specific shape score is low (< 0.7) or uncertain
  if (cornerCount >= 4) {
    const polygonScore = scores.find(s => s.type === 'polygon');
    const rectScore = scores.find(s => s.type === 'rectangle' || s.type === 'square');
    
    if (polygonScore && polygonScore.score > 0.6) {
      // Check if we have a strong rectangle/square candidate with right angles
      // Require at least 3 right angles for a strong rectangle (not just 2, as trapezoids can have 2)
      const hasRightAngles = rightAngleCount >= 3;
      const hasStrongRectScore = rectScore && rectScore.score >= 0.7;
      
      // Only prefer polygon over rectangle if:
      // 1. No right angles detected (might be irregular quadrilateral)
      // 2. Rectangle score is low (< 0.7)
      // 3. Polygon score is significantly higher than rectangle score
      if (best.type === 'triangle') {
        // For triangles with 4 corners (ambiguous), prefer polygon if scores are close
        if (polygonScore.score >= best.score * 0.85) {
          finalType = 'polygon';
          finalConfidence = polygonScore.confidence;
        }
      } else if (best.type === 'rectangle' || best.type === 'square') {
        // For rectangles: only prefer polygon if rectangle score is weak
        // OR if polygon score is significantly higher (not just within 15%)
        if (!hasRightAngles || !hasStrongRectScore) {
          // No right angles or weak rectangle score - check if polygon is better
          if (polygonScore.score > best.score * 1.1 || polygonScore.score > 0.85 && best.score < 0.6) {
            finalType = 'polygon';
            finalConfidence = polygonScore.confidence;
          }
        }
        // Otherwise: keep rectangle/square as it has right angles and good score
      }
    }
  }
  
  // Update the best score entry with final values
  const finalBest = scores.find(s => s.type === finalType);
  if (finalBest) {
    scores[0] = finalBest;
  }
  
  const generatedPoints = generateShapePointsImproved(finalType, points, features);
  
  return {
    type: finalType,
    points: generatedPoints,
    confidence: finalConfidence,
    isClosed: features.isClosed,
    allScores: scores,
  };
}

function scoreLineImproved(points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  const avgCurvature = features.avgCurvature;
  const lineDeviation = computeLineDeviation(points);
  const bbox = features.bbox;
  
  let score = 0;
  const reasons: string[] = [];
  
  if (cornerCount === 0) {
    score += 0.35;
    reasons.push('无顶点');
  } else if (cornerCount <= 2) {
    score += 0.25;
    reasons.push('顶点少');
  } else {
    score -= (cornerCount - 2) * 0.1;
  }
  
  if (avgCurvature < 0.05) {
    score += 0.35;
    reasons.push('曲率极低');
  } else if (avgCurvature < 0.08) {
    score += 0.15;
    reasons.push('曲率低');
  } else if (avgCurvature < 0.13) {
    score += 0.02;
    reasons.push('有曲率');
  }
  
  const maxDim = Math.max(bbox.width, bbox.height);
  const relativeDeviation = maxDim > 0 ? lineDeviation / maxDim : 0;
  
  if (relativeDeviation < 0.03) {
    score += 0.3;
    reasons.push('偏差极小');
  } else if (relativeDeviation < 0.08) {
    score += 0.2;
    reasons.push('偏差小');
  } else if (relativeDeviation < 0.15) {
    score += 0.1;
    reasons.push('偏差可接受');
  }
  
  if (!features.isClosed) {
    score += 0.1;
    reasons.push('开放路径');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'line',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合直线特征',
  };
}

function scoreAngleImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  if (features.isClosed) {
    return { type: 'angle', score: 0, confidence: 0, reason: '封闭图形不是角' };
  }
  
  if (cornerCount === 1) {
    score += 0.5;
    reasons.push('单个顶点');
    
    // Extra check: If the single corner is sharp/acute, this strengthens the angle case
    const cornerAngleRads = features.corners[0].angle;
    const cornerAngleDegs = cornerAngleRads * 180 / Math.PI;
    // If the corner is less than 120 degrees (obtuse), add more points
    if (cornerAngleDegs < 120) {
      score += 0.2; // Boost score for having a sharp angle
      reasons.push(`${cornerAngleDegs.toFixed(1)}°角点`);
    }
    
  } else if (cornerCount === 2) {
    score += 0.4;
    reasons.push('两个顶点');
  } else if (cornerCount === 0) {
    const curvatureVariance = computeCurvatureVarianceImproved(features);
    if (curvatureVariance > 0.1) {
      score += 0.25;
      reasons.push('曲率变化明显');
    }
  } else if (cornerCount === 3) {
    score += 0.2;
    reasons.push('三个顶点');
  }
  
  if (features.avgCurvature < 0.1) {
    score += 0.25;
    reasons.push('曲率低');
  } else if (features.avgCurvature < 0.2) {
    score += 0.15;
    reasons.push('曲率适中');
  }
  
  const diagonal = Math.hypot(features.bbox.width, features.bbox.height);
  if (features.pathLength > diagonal * 1.0 && features.pathLength < diagonal * 5) {
    score += 0.15;
    reasons.push('长度适中');
  }
  
  if (!features.isClosed && features.pathLength > diagonal * 1.2) {
    score += 0.1;
    reasons.push('有转折');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'angle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合角特征',
  };
}

function scoreTriangleImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  if (!features.isClosed) {
    return { type: 'triangle', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  // Check for right angles - this is important for triangle vs rectangle distinction
  const rightAngleCount = features.corners.filter(c => {
    const angleDeg = c.angle * 180 / Math.PI;
    return Math.abs(angleDeg - 90) < 30;
  }).length;
  
  // Primary factor: corner count
  let isValidTriangleCorners = true;
  
  if (cornerCount === 3) {
    // Validate: real triangles should have reasonable angles
    const angles = features.corners.map(c => c.angle * 180 / Math.PI);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const smallAngles = angles.filter(a => a < 45).length;
    const largeAngles = angles.filter(a => a > 120).length;
    
    // A valid triangle should have:
    // 1. No angle too small (< 25°) - these are likely false corners on curves/circles
    // 2. No angle too large (> 160°) - these are not typical triangle corners  
    // 3. At most 1 small angle (< 45°) - circles tend to have 2+ small false corners
    // 4. Not all angles large (>120°) - that would indicate wrong corner detection
    const hasNoExtremeAngles = minAngle >= 25 && maxAngle <= 160;
    const hasFewSmallAngles = smallAngles <= 1;
    const hasValidAngleDistribution = largeAngles < 3; // Not all angles are large
    
    // Note: We don't check angle sum here because corner detection might find
    // points along edges rather than true vertices, resulting in incorrect sums
    
    if (hasNoExtremeAngles && hasFewSmallAngles && hasValidAngleDistribution) {
      score += 0.7;
      reasons.push('3个顶点(角度合理)');
    } else {
      // 3 corners but doesn't look like a real triangle
      // Likely false corners on a curve/circle
      score += 0.25;
      reasons.push('3个顶点但角度异常(可能非三角形)');
      isValidTriangleCorners = false;
    }
  } else if (cornerCount === 2) {
    // 2 corners could still be a triangle (one corner missed)
    score += 0.35;
    reasons.push('接近3个顶点');
  } else if (cornerCount === 4) {
    // 4 corners: could be triangle with extra corner OR rectangle
    // Key distinction: does it have right angles?
    if (rightAngleCount === 0) {
      // 4 corners but NO right angles -> likely triangle with extra corner
      score += 0.65;
      reasons.push('4角无直角(三角形)');
    } else {
      // 4 corners with right angles -> likely rectangle, not triangle
      score += 0.25;
      reasons.push('4角有直角(可能是矩形)');
    }
  } else if (cornerCount >= 1 && cornerCount <= 5) {
    score += 0.15;
    reasons.push('顶点数可接受');
  }
  
  // Secondary factor: check corner angles - triangles typically have angles between 30°-120°
  if (cornerCount >= 2) {
    const triangleLikeAngles = features.corners.filter(c => {
      const angleDeg = c.angle * 180 / Math.PI;
      return angleDeg >= 25 && angleDeg <= 130; // Triangle angles typically in this range
    }).length;
    
    if (triangleLikeAngles === cornerCount && cornerCount <= 4 && isValidTriangleCorners) {
      score += 0.15;
      reasons.push('角度符合三角形特征');
    }
    
    // Additional boost if no right angles detected
    if (rightAngleCount === 0 && cornerCount >= 3) {
      score += 0.15;
      reasons.push('无直角特征');
    }
  }
  
  if (features.avgCurvature < 0.08) {
    score += 0.1;
    reasons.push('曲率极低');
  } else if (features.avgCurvature < 0.15) {
    score += 0.05;
    reasons.push('曲率较低');
  } else if (features.avgCurvature > 0.35 && cornerCount >= 3) {
    // Very high curvature with multiple corners suggests a curve/circle, not a polygon
    score *= 0.5;
    reasons.push('高曲率(可能为曲线)');
  }
  
  if (features.closedDistance < features.bbox.width * 0.15) {
    score += 0.05;
    reasons.push('封闭良好');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'triangle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合三角形特征',
  };
}

function scoreRectangleImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  if (!features.isClosed) {
    return { type: 'rectangle', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  // Check for right angles - this is crucial for rectangle identification
  const rightAngleCount = features.corners.filter(c => {
    const angleDeg = c.angle * 180 / Math.PI;
    return Math.abs(angleDeg - 90) < 30; // Within 30° of 90°
  }).length;
  
  // Primary factor: corner count combined with right angle presence
  if (cornerCount === 4) {
    if (rightAngleCount >= 3) {
      // 4 corners with 3+ right angles -> strong rectangle candidate
      score += 0.7;
      reasons.push('4个顶点');
    } else if (rightAngleCount >= 2) {
      // 4 corners with 2 right angles -> could be rectangle or trapezoid
      // Lower score to allow polygon to compete
      score += 0.5;
      reasons.push('4个顶点(2直角)');
    } else {
      // 4 corners but no right angles -> likely not a rectangle
      score += 0.35;
      reasons.push('4角但无直角(可能是三角形)');
    }
  } else if (cornerCount === 3) {
    // 3 corners could be a rectangle with one merged corner
    // But be cautious - most 3-corner shapes with "right angles" are actually triangles
    if (rightAngleCount >= 2) {
      // 3 corners with 2+ "right angles" might be a rectangle with one merged corner
      score += 0.25;
      reasons.push('3个顶点有直角');
    } else if (rightAngleCount >= 1) {
      // 3 corners with only 1 "right angle" is more likely a triangle
      score += 0.15;
      reasons.push('3个顶点(可能是矩形)');
    } else {
      score += 0.1;
      reasons.push('3个顶点(可能是矩形)');
    }
  } else if (cornerCount >= 2 && cornerCount <= 5) {
    score += 0.2;
    reasons.push('顶点数可接受');
  }
  
  // Secondary factor: check if corners are near 90°
  if (cornerCount >= 2) {
    if (rightAngleCount >= 2) {
      if (cornerCount === 4) {
        // 4 corners with 2+ right angles -> strong rectangle
        score += 0.2;
        reasons.push(`${rightAngleCount}个角接近90°`);
      } else if (cornerCount === 3) {
        // 3 corners with 2+ "right angles" - might be triangle with angles near 90°
        // Give smaller bonus since it's ambiguous
        score += 0.1;
        reasons.push(`${rightAngleCount}个角接近90°`);
      }
    } else if (cornerCount === 4 && rightAngleCount < 2) {
      // If we have 4 corners but none are near 90°, this is likely NOT a rectangle
      score *= 0.5; // Reduce score significantly
      reasons.push('4角但无直角');
    }
  }
  
  if (features.avgCurvature < 0.06) {
    score += 0.1;
    reasons.push('曲率极低');
  } else if (features.avgCurvature < 0.12) {
    score += 0.05;
    reasons.push('曲率较低');
  }
  
  // Aspect ratio check
  const ratio = features.bbox.aspectRatio;
  if (ratio > 0.3 && ratio < 3) {
    score += 0.05;
    reasons.push('比例合理');
  }
  
  if (features.closedDistance < features.bbox.width * 0.12) {
    score += 0.05;
    reasons.push('封闭良好');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'rectangle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合矩形特征',
  };
}

function scoreSquareImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  const rectScore = scoreRectangleImproved(_points, features);
  
  // 必须首先符合矩形特征，才可能是正方形
  if (rectScore.score < 0.3 || !features.cornerAngleFeatures?.isRectLike) {
    return { type: 'square', score: 0, confidence: 0, reason: '不符合矩形基本特征' };
  }
  
  let score = rectScore.score * 0.7;
  const reasons: string[] = ['基本符合矩形特征'];
  
  const ratio = features.bbox.aspectRatio;
  const ratioDeviation = Math.abs(1 - ratio);
  if (ratioDeviation < 0.1) {
    score += 0.3;
    reasons.push('宽高比接近1:1');
  } else if (ratioDeviation < 0.2) {
    score += 0.2;
    reasons.push('宽高比接近正方形');
  } else if (ratioDeviation < 0.3) {
    score += 0.1;
    reasons.push('宽高比可接受');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'square',
    score,
    confidence: score,
    reason: reasons.join(', '),
  };
}

function scoreCircleImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  let score = 0;
  const reasons: string[] = [];
  
  if (!features.isClosed) {
    return { type: 'circle', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  // 3+ corners typically means polygon, but check if they might be false corners on a circle
  if (features.corners.length >= 4) {
    return { type: 'circle', score: 0, confidence: 0, reason: '多边形特征明显' };
  }
  
  // For 3 corners: check if they're valid triangle corners or false corners on a circle
  if (features.corners.length === 3) {
    const angles = features.corners.map(c => c.angle * 180 / Math.PI);
    const angleSum = angles.reduce((a, b) => a + b, 0);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const smallAngles = angles.filter(a => a < 45).length;
    
    // Valid triangle: sum ~180°, at most 1 small angle, reasonable range
    const isValidTriangle = angleSum >= 160 && angleSum <= 200 && 
                           minAngle >= 25 && maxAngle <= 150 && 
                           smallAngles <= 1;
    
    if (isValidTriangle) {
      // This is a real triangle, not a circle
      return { type: 'circle', score: 0, confidence: 0, reason: '三角形特征明显' };
    }
    // Otherwise: might be false corners on a circle, continue with reduced score
  }
  
  if (features.corners.length === 0) {
    score += 0.3;
    reasons.push('无顶点');
  } else if (features.corners.length <= 2) {
    score += 0.2;
    reasons.push('顶点极少');
  } else if (features.corners.length === 3) {
    // 3 corners that don't form a valid triangle - might be false corners on circle
    score += 0.05;
    reasons.push('3个顶点(可能假角点)');
  }
  
  const curvatureVariance = computeCurvatureVarianceImproved(features);
  if (curvatureVariance < 0.08) {
    score += 0.3;
    reasons.push('曲率均匀');
  } else if (curvatureVariance < 0.15) {
    score += 0.2;
    reasons.push('曲率较均匀');
  } else if (curvatureVariance < 0.25) {
    score += 0.1;
    reasons.push('曲率基本均匀');
  }
  
  const bbox = features.bbox;
  const estimatedRadius = (bbox.width + bbox.height) / 4;
  const expectedCircumference = 2 * Math.PI * estimatedRadius;
  const lengthRatio = expectedCircumference > 0 ? features.pathLength / expectedCircumference : 0;
  
  if (lengthRatio > 0.7 && lengthRatio < 1.3) {
    score += 0.25;
    reasons.push('周长匹配');
  } else if (lengthRatio > 0.5 && lengthRatio < 1.5) {
    score += 0.15;
    reasons.push('周长基本匹配');
  }
  
  const ratioDeviation = Math.abs(1 - bbox.aspectRatio);
  if (ratioDeviation < 0.15) {
    score += 0.15;
    reasons.push('接近正圆');
  } else if (ratioDeviation < 0.3) {
    score += 0.08;
    reasons.push('接近圆形');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'circle',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合圆形特征',
  };
}

function scoreEllipseImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  const circleScore = scoreCircleImproved(_points, features);
  
  if (circleScore.score < 0.3) {
    return { type: 'ellipse', score: 0, confidence: 0, reason: '不符合圆形基本特征' };
  }
  
  let score = circleScore.score * 0.7;
  const reasons: string[] = ['基本符合圆形特征'];
  
  const bbox = features.bbox;
  const ratio = bbox.aspectRatio;
  
  if (ratio > 1.2 && ratio < 4) {
    score += 0.3;
    reasons.push('明显的长短轴');
  } else if (ratio > 1.1 && ratio <= 1.2) {
    score += 0.15;
    reasons.push('轻微椭圆');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'ellipse',
    score,
    confidence: score,
    reason: reasons.join(', '),
  };
}

function scoreArcImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  let score = 0;
  const reasons: string[] = [];
  
  if (features.isClosed && features.closedDistance < features.bbox.width * 0.08) {
    return { type: 'arc', score: 0, confidence: 0, reason: '完全封闭的可能是圆' };
  }
  
  if (features.corners.length === 0) {
    score += 0.2;
    reasons.push('无顶点');
  } else if (features.corners.length === 1) {
    score += 0.1;
    reasons.push('单个顶点');
  } else {
    return { type: 'arc', score: 0, confidence: 0, reason: '多顶点不可能是圆弧' };
  }
  
  const curvatureVariance = computeCurvatureVarianceImproved(features);
  if (curvatureVariance < 0.05) {
    score += 0.25;
    reasons.push('曲率很均匀');
  } else if (curvatureVariance < 0.1) {
    score += 0.15;
    reasons.push('曲率较均匀');
  } else {
    return { type: 'arc', score: score * 0.5, confidence: score * 0.5, reason: '曲率不均匀' };
  }
  
  if (features.avgCurvature > 0.05 && features.avgCurvature < 0.2) {
    score += 0.40;
    reasons.push('曲率适中');
  } else if (features.avgCurvature > 0.03 && features.avgCurvature < 0.3) {
    score += 0.30;
    reasons.push('曲率可接受');
  } else {
    // 曲率太低或太高
    return { type: 'arc', score: score * 0.3, confidence: score * 0.3, reason: '曲率不合适' };
  }
  
  const bbox = features.bbox;
  const diagonal = Math.hypot(bbox.width, bbox.height);
  if (features.pathLength > diagonal * 0.95 && features.pathLength < diagonal * 1.1) {
    score *= 0.8;
    reasons.push('长度接近直线');
  }
  
  if (!features.isClosed && features.closedDistance > bbox.width * 0.3) {
    score += 0.15;
    reasons.push('明显开口');
  }
  
  score = Math.max(0, Math.min(1, score));
  const confidence = score * 0.85;
  
  return {
    type: 'arc',
    score,
    confidence,
    reason: reasons.join(', ') || '不符合圆弧特征',
  };
}

function scoreCurveImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  const hasLowCorners = features.corners.length <= 1;
  const hasModerateCurvature = features.avgCurvature > 0.03;
  
  let score = 0;
  if (hasLowCorners) score += 0.3;
  if (hasModerateCurvature) score += 0.3;
  if (!features.isClosed) score += 0.2;
  if (features.avgCurvature > 0.15) score += 0.1;
  
  // 如果曲率很均匀，更可能是 arc 而不是 curve，降低 curve 评分
  const curvatureVariance = computeCurvatureVarianceImproved(features);
  if (curvatureVariance < 0.1) {
    score *= 0.5; // 曲率均匀的应该是 arc 或 line
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'curve',
    score,
    confidence: score * 0.6,
    reason: hasLowCorners && hasModerateCurvature ? '单段不规则曲线' : '未识别为规则图形',
  };
}

function scorePolygonImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  if (!features.isClosed) {
    return { type: 'polygon', score: 0, confidence: 0, reason: '非封闭图形' };
  }
  
  const cornerCount = features.corners.length;
  
  let score = 0;
  const reasons: string[] = [];
  
  // High scores for polygons with 4+ corners
  // Polygon should take precedence over triangle and rectangle (without right angles)
  if (cornerCount >= 6) {
    score += 0.9;
    reasons.push(`${cornerCount}个顶点`);
  } else if (cornerCount === 5) {
    score += 0.85;
    reasons.push('5个顶点');
  } else if (cornerCount === 4) {
    // 4 corners is the key case - should beat triangle (3 corners) 
    // and rectangle without right angles
    score += 0.8;
    reasons.push('4个顶点(四边形)');
  } else if (cornerCount === 3) {
    // 3 corners could be a triangle, but also a degenerate polygon
    score += 0.5;
    reasons.push('3个顶点');
  }
  
  // Boost for low curvature (straight edges)
  if (features.avgCurvature < 0.08) {
    score += 0.15;
    reasons.push('边近似直线');
  } else if (features.avgCurvature < 0.15) {
    score += 0.08;
    reasons.push('曲率较低');
  }
  
  // Good closure bonus
  if (features.closedDistance < features.bbox.width * 0.15) {
    score += 0.05;
    reasons.push('封闭良好');
  }
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'polygon',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合多边形特征',
  };
}

function scorePolylineImproved(_points: Point[], features: ShapeFeatures): ShapeScore {
  if (features.isClosed) {
    return { type: 'polyline', score: 0, confidence: 0, reason: '封闭图形不是多段线' };
  }
  
  const cornerCount = features.corners.length;
  
  let score = 0;
  if (cornerCount >= 2) score += 0.4;
  if (features.pathLength > features.bbox.width * 1.3) score += 0.3;
  if (cornerCount >= 3) score += 0.2;
  
  score = Math.max(0, Math.min(1, score));
  
  return {
    type: 'polyline',
    score,
    confidence: score,
    reason: cornerCount >= 2 ? '多段不封闭路径' : '未识别为多段线',
  };
}

function computeCurvatureVarianceImproved(features: ShapeFeatures): number {
  if (features.curvatures.length < 2) return 0;
  
  const mean = features.avgCurvature;
  const squaredDiffs = features.curvatures.map(c => Math.pow(c.curvature - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  
  return Math.sqrt(variance);
}

function generateShapePointsImproved(
  type: ImprovedShapeType,
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
      if (features.corners.length >= 3) {
        // 使用检测到的3个角点，保持原始位置（不矫正）
        const cornerPoints = features.corners.slice(0, 3).map(c => originalPoints[c.index]);
        return [...cornerPoints, cornerPoints[0]];
      }
      // 如果没有检测到3个角点，尝试用原始点拟合
      if (originalPoints.length >= 3) {
        // 均匀采样3个点
        const step = Math.floor(originalPoints.length / 3);
        return [
          originalPoints[0],
          originalPoints[step],
          originalPoints[step * 2],
          originalPoints[0]
        ];
      }
      return originalPoints;
    }
    
    case 'rectangle':
    case 'square': {
      // 使用检测到的角点，保持原始位置（不矫正）
      if (features.corners.length >= 4) {
        const cornerPoints = features.corners.slice(0, 4).map(c => originalPoints[c.index]);
        return [...cornerPoints, cornerPoints[0]];
      }
      // 如果只有3个角点（可能是矩形被合并了一个角）
      if (features.corners.length === 3) {
        const cornerPoints = features.corners.slice(0, 3).map(c => originalPoints[c.index]);
        // 通过几何关系推断第4个角
        // 简单做法：使用原始点序列的起点作为第4个角
        return [originalPoints[0], ...cornerPoints, originalPoints[0]];
      }
      // 如果没有足够角点，使用原始点
      if (originalPoints.length >= 4) {
        const step = Math.floor(originalPoints.length / 4);
        return [
          originalPoints[0],
          originalPoints[step],
          originalPoints[step * 2],
          originalPoints[step * 3],
          originalPoints[0]
        ];
      }
      return originalPoints;
    }
    
    case 'circle':
      return generateCirclePointsImproved(
        { x: bbox.cx, y: bbox.cy },
        (bbox.width + bbox.height) / 4
      );
    
    case 'ellipse':
      return generateEllipsePointsImproved(
        { x: bbox.cx, y: bbox.cy },
        bbox.width / 2,
        bbox.height / 2
      );
    
    case 'arc':
      return generateArcPointsImproved(originalPoints, features);
    
    default:
      return originalPoints;
  }
}

function generateCirclePointsImproved(center: Point, radius: number, numPoints: number = 32): Point[] {
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

function generateEllipsePointsImproved(
  center: Point,
  a: number,
  b: number,
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

function generateArcPointsImproved(points: Point[], features: ShapeFeatures): Point[] {
  if (features.avgCurvature < 0.05) {
    return [points[0], points[points.length - 1]];
  }
  
  const start = points[0];
  const mid = points[Math.floor(points.length / 2)];
  const end = points[points.length - 1];
  
  const circle = fitCircleFromPoints(start, mid, end);
  
  if (!circle) {
    return points;
  }
  
  const startAngle = Math.atan2(start.y - circle.center.y, start.x - circle.center.x);
  const endAngle = Math.atan2(end.y - circle.center.y, end.x - circle.center.x);
  
  let coverage = endAngle - startAngle;
  if (coverage < -Math.PI) coverage += 2 * Math.PI;
  if (coverage > Math.PI) coverage -= 2 * Math.PI;
  
  const maxCoverage = Math.PI * 1.5;
  if (Math.abs(coverage) > maxCoverage) {
    coverage = coverage > 0 ? maxCoverage : -maxCoverage;
  }
  
  if (Math.abs(coverage) < Math.PI / 6) {
    return [start, end];
  }
  
  const numPoints = Math.max(8, Math.floor(Math.abs(coverage) / (Math.PI / 16)));
  const result: Point[] = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startAngle + t * coverage;
    result.push({
      x: circle.center.x + circle.radius * Math.cos(angle),
      y: circle.center.y + circle.radius * Math.sin(angle),
    });
  }
  
  return result;
}

function fitCircleFromPoints(p1: Point, p2: Point, p3: Point): { center: Point; radius: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  
  if (Math.abs(d) < 1e-10) {
    return null;
  }
  
  const ux = ((p1.x * p1.x + p1.y * p1.y) * (p2.y - p3.y) +
              (p2.x * p2.x + p2.y * p2.y) * (p3.y - p1.y) +
              (p3.x * p3.x + p3.y * p3.y) * (p1.y - p2.y)) / d;
  
  const uy = ((p1.x * p1.x + p1.y * p1.y) * (p3.x - p2.x) +
              (p2.x * p2.x + p2.y * p2.y) * (p1.x - p3.x) +
              (p3.x * p3.x + p3.y * p3.y) * (p2.x - p1.x)) / d;
  
  const center = { x: ux, y: uy };
  const radius = Math.hypot(p1.x - center.x, p1.y - center.y);
  
  return { center, radius };
}
