import type { Point } from '../types';

/**
 * 转角检测结果
 */
export interface AngleResult {
  index: number;
  angle: number; // 弧度制
}

/**
 * 曲率计算结果
 */
export interface CurvatureResult {
  index: number;
  curvature: number;
}

/**
 * 包围盒结果
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number; // 中心点 x
  cy: number; // 中心点 y
  aspectRatio: number; // 宽高比
}

/**
 * 图形特征分析结果
 */
export interface ShapeFeatures {
  angles: AngleResult[];
  corners: AngleResult[]; // 转角超过阈值的点
  cornerAngleFeatures?: CornerAngleFeatures; // 角点角度特征（用于区分三角形/矩形）
  curvatures: CurvatureResult[];
  avgCurvature: number;
  maxCurvature: number;
  bbox: BoundingBox;
  isClosed: boolean;
  closedDistance: number; // 首尾距离
  pathLength: number; // 路径总长度
}

/**
 * 计算路径上各点的转角
 * 使用向量的余弦相似度计算
 * 
 * @param points 轨迹点
 * @param step 计算步长（默认3，更精细的采样以捕获所有角落）
 * @returns 各点的转角信息
 */
export function computeAngles(points: Point[], step: number = 3): AngleResult[] {
  const angles: AngleResult[] = [];
  
  for (let i = step; i < points.length - step; i++) {
    const p0 = points[i - step];
    const p1 = points[i];
    const p2 = points[i + step];
    
    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    if (len1 < 1e-9 || len2 < 1e-9) {
      angles.push({ index: i, angle: 0 });
      continue;
    }
    
    const cos = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
    const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
    
    angles.push({ index: i, angle });
  }
  
  return angles;
}

/**
 * 找出转角超过阈值的顶点（锐角/直角区域）
 * 并合并相邻的角点（去除假角点）
 * 
 * @param angles 转角信息数组
 * @param points 原始点（用于合并计算）
 * @param threshold 转角阈值（默认 Math.PI * 0.3 ≈ 54度，捕获更多潜在角落）
 * @param minDistance 合并距离阈值（默认20像素）
 * @returns 转角超过阈值的顶点
 */
export function findCorners(angles: AngleResult[], points: Point[], _threshold: number = Math.PI * 0.4, minDistanceRatio: number = 0.025): AngleResult[] {
  // Determine adaptive thresholds based on shape characteristics
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y); 
  const bboxWidth = Math.max(...xs) - Math.min(...xs);
  const bboxHeight = Math.max(...ys) - Math.min(...ys);
  const bboxSize = Math.max(bboxWidth, bboxHeight);
  
  // Calculate if the shape is open (angle-like) vs. closed (polygon-like)
  const start = points[0];
  const end = points[points.length - 1];
  const endDistance = Math.hypot(start.x - end.x, start.y - end.y);
  // If start and end points are close, it's likely a closed poly shape; if far, likely an open angle shape
  const isOpen = endDistance > bboxSize * 0.3; // If end points are more than 30% of bbox apart, likely an open shape

  // Adjust threshold based on whether the shape is open or closed
  // Closed shapes (rectangles, triangles) need more sensitive corner detection
  // Open shapes (angles) may have sharper corners
  const adjustedThreshold = isOpen ?
    Math.PI * 0.35 : // open shapes (angles), use standard threshold
    Math.PI * 0.18;  // closed polygons, use very sensitive threshold (π*0.18 ≈ 32°) to catch all corners
    
  // 先找出所有超过阈值的角点
  const allCorners = angles.filter(a => a.angle > adjustedThreshold);
  
  if (allCorners.length < 2) return allCorners;
  


  // 计算相对距离阈值（基于包围盒大小）
  const minDistance = Math.max(10, bboxSize * minDistanceRatio);
  
  // For simple shapes (fewer corners): avoid excessive merging, may need more sensitive approach
  // If overall number of corners is small, we don't want to merge corners that are nearby, so keep original detection logic
  if (allCorners.length < 8) {  // 简单形状，用原版避免过分归并
    const merged: AngleResult[] = [allCorners[0]];
    
    for (let i = 1; i < allCorners.length; i++) {
      const current = allCorners[i];
      const lastMerged = merged[merged.length - 1];
      
      const p1 = points[current.index];
      const p2 = points[lastMerged.index];
      const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      
      if (distance >= minDistance) {
        merged.push(current);
      }
    }
    
    return merged;
  } else {
    // 对于复杂形状 (较多的角点)：使用分组方法，避免相近的角点被视为独立角
    const sortedCorners = [...allCorners].sort((a, b) => a.index - b.index);
    
    // 分组：将距离小于阈值的角点分到同一组
    const groups: AngleResult[][] = [];
    let currentGroup: AngleResult[] = [sortedCorners[0]];
    
    for (let i = 1; i < sortedCorners.length; i++) {
      const current = sortedCorners[i];
      const lastInGroup = currentGroup[currentGroup.length - 1];
      
      const p1 = points[current.index];
      const p2 = points[lastInGroup.index];
      const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      
      if (distance < minDistance) {
        // 同一组，添加进去
        currentGroup.push(current);
      } else {
        // 新的一组
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    // 添加最后一组
    groups.push(currentGroup);
    
    // 从每组中选择角度最大的角点
    const merged = groups.map(group => {
      return group.reduce((max, current) => current.angle > max.angle ? current : max);
    });
    
    return merged;
  }
}

/**
 * 计算路径上各点的局部曲率
 * 曲率 κ = |v1 × v2| / (|v1| * |v2|)
 * 
 * @param points 轨迹点
 * @param step 计算步长（默认4）
 * @returns 各点的曲率信息
 */
export function computeCurvatures(points: Point[], step: number = 4): CurvatureResult[] {
  const curvatures: CurvatureResult[] = [];
  
  for (let i = step; i < points.length - step; i++) {
    const p0 = points[i - step];
    const p1 = points[i];
    const p2 = points[i + step];
    
    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    
    const cross = Math.abs(v1.x * v2.y - v1.y * v2.x);
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    const denom = len1 * len2 + 1e-9;
    const curvature = cross / denom;
    
    curvatures.push({ index: i, curvature });
  }
  
  return curvatures;
}

/**
 * 计算轨迹的包围盒和纵横比
 * 
 * @param points 轨迹点
 * @returns 包围盒信息
 */
export function getBoundingBox(points: Point[]): BoundingBox {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    aspectRatio: width / (height + 1e-9),
  };
}

/**
 * 计算路径总长度
 * 
 * @param points 轨迹点
 * @returns 路径长度
 */
export function computePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.hypot(dx, dy);
  }
  return length;
}

/**
 * 检测轨迹是否封闭
 * 
 * @param points 轨迹点
 * @param thresholdRatio 距离阈值比例（默认0.25，即包围盒宽度的25%，更宽松）
 * @returns 是否封闭及首尾距离
 */
export function detectClosedShape(points: Point[], thresholdRatio: number = 0.25): { isClosed: boolean; distance: number } {
  if (points.length < 3) {
    return { isClosed: false, distance: Infinity };
  }
  
  const start = points[0];
  const end = points[points.length - 1];
  const distance = Math.hypot(start.x - end.x, start.y - end.y);
  
  const bbox = getBoundingBox(points);
  const bboxSize = Math.max(bbox.width, bbox.height);
  
  // Use bbox-based threshold
  const threshold = bboxSize * thresholdRatio;
  
  // Also check relative to path length - if distance is small compared to path length,
  // it's likely a closed shape with a small gap
  const pathLength = computePathLength(points);
  const relativeThreshold = pathLength * 0.08; // 8% of path length
  
  // NEW: Check if distance is small relative to bounding box size
  // This handles cases where start and end points are close but bbox is large
  const relativeToBbox = bboxSize > 0 ? distance / bboxSize : 1;
  const isClosedByRelativeBbox = relativeToBbox < 0.10; // 10% of bbox size
  
  // Shape is considered closed if either:
  // 1. Distance is below bbox-based threshold
  // 2. Distance is below path-length-based threshold (for large shapes with small gaps)
  // 3. Distance is small relative to bbox size (for shapes like triangles with small gaps)
  const isClosed = distance < threshold || distance < relativeThreshold || isClosedByRelativeBbox;
  
  return {
    isClosed,
    distance,
  };
}

/**
 * 综合分析轨迹特征
 * 这是图形识别的主入口函数
 * 
 * @param points 轨迹点
 * @returns 完整的特征分析结果
 */
export function analyzeShapeFeatures(points: Point[]): ShapeFeatures {
  // 计算转角
  const angles = computeAngles(points);
  
  // 检测是否封闭
  const { isClosed, distance } = detectClosedShape(points);
  
  // 找出转角超过阈值的点（锐角/直角）
  let corners = findCorners(angles, points);
  
  // For closed shapes, also check if there's a corner at the start/end point
  // This handles cases like rectangles where the 4th corner is at index 0
  // Only add if we have fewer than 4 corners (to avoid adding false corners to triangles)
  if (isClosed && points.length >= 6 && corners.length < 4) {
    const step = 3; // Same as computeAngles default
    
    // Check angle at start point (wrapping around)
    const pPrev = points[points.length - 1 - step];
    const pStart = points[0];
    const pNext = points[step];
    
    const v1 = { x: pStart.x - pPrev.x, y: pStart.y - pPrev.y };
    const v2 = { x: pNext.x - pStart.x, y: pNext.y - pStart.y };
    
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    if (len1 > 1e-9 && len2 > 1e-9) {
      const cos = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
      const startAngle = Math.acos(Math.min(1, Math.max(-1, cos)));
      
      // Use a lower threshold for the start point corner to catch shallow angles
      // Some triangles have very shallow angles at the start/end junction
      const threshold = Math.PI * 0.08; // ~14.4 degrees, more sensitive
      
      if (startAngle > threshold) {
        // Check if this corner is far enough from existing corners
        const minDistance = Math.max(10, Math.max(
          Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
          Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))
        ) * 0.025);
        
        const isFarEnough = corners.every(c => {
          const dist = Math.hypot(points[c.index].x - pStart.x, points[c.index].y - pStart.y);
          return dist > minDistance * 0.5; // Slightly relaxed distance check
        });
        
        if (isFarEnough) {
          corners = [...corners, { index: 0, angle: startAngle }];
          // Re-sort by index
          corners.sort((a, b) => a.index - b.index);
        }
      }
      
      // Special case: if we have exactly 2 corners in a closed shape, 
      // we likely missed the corner at the start/end junction (e.g., a triangle with shallow angle)
      // Force add the start point as a corner
      if (corners.length === 2) {
        // Check if start point is far enough from existing corners
        const minDistance = Math.max(10, Math.max(
          Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
          Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))
        ) * 0.025);
        
        const isFarEnough = corners.every(c => {
          const dist = Math.hypot(points[c.index].x - pStart.x, points[c.index].y - pStart.y);
          return dist > minDistance * 0.3; // Very relaxed check
        });
        
        if (isFarEnough) {
          corners = [...corners, { index: 0, angle: startAngle }];
          // Re-sort by index
          corners.sort((a, b) => a.index - b.index);
        }
      }
    }
  }
  
  // 计算曲率
  const curvatures = computeCurvatures(points);
  const avgCurvature = curvatures.length > 0
    ? curvatures.reduce((a, b) => a + b.curvature, 0) / curvatures.length
    : 0;
  const maxCurvature = curvatures.length > 0
    ? Math.max(...curvatures.map(c => c.curvature))
    : 0;
  
  // 计算包围盒
  const bbox = getBoundingBox(points);
  
  // 计算路径长度
  const pathLength = computePathLength(points);
  
  // 计算角点角度特征（用于区分三角形和矩形）
  const cornerAngleFeatures = computeCornerAngleFeatures(points, corners);
  
  return {
    angles,
    corners,
    cornerAngleFeatures,
    curvatures,
    avgCurvature,
    maxCurvature,
    bbox,
    isClosed,
    closedDistance: distance,
    pathLength,
  };
}

/**
 * 计算角点角度特征
 * 用于区分三角形（3个角，和约180°）和矩形（4个角，各约90°）
 * 
 * @param points 轨迹点
 * @param corners 角点索引
 * @returns 角度特征
 */
export interface CornerAngleFeatures {
  interiorAngles: number[]; // 各内角（弧度）
  avgInteriorAngle: number; // 平均内角
  angleVariance: number; // 内角方差（矩形应该很小）
  isRectLike: boolean; // 是否类似矩形（4个接近90°的角）
  isTriangleLike: boolean; // 是否类似三角形（3个角，和约180°）
}

export function computeCornerAngleFeatures(points: Point[], corners: AngleResult[]): CornerAngleFeatures {
  if (corners.length < 3) {
    return {
      interiorAngles: [],
      avgInteriorAngle: 0,
      angleVariance: 0,
      isRectLike: false,
      isTriangleLike: false,
    };
  }
  
  // 按索引排序角点，确保按路径顺序
  let sortedCorners = [...corners].sort((a, b) => a.index - b.index);
  
  // 提取角点处的内角
  let interiorAngles: number[] = calculateInteriorAngles(points, sortedCorners);
  let angleSum = interiorAngles.reduce((a, b) => a + b, 0);
  
  // 对于3个角点的情况，检查是三角形还是矩形（带一个圆角）
  // 三角形内角和 ≈ 180° (π)，3角矩形内角和 ≈ 270° (3π/2，每个角~90°)
  if (sortedCorners.length === 3) {
    const sumDegrees = angleSum * 180 / Math.PI;
    
    // 如果内角和在 240°-300° 之间，可能是矩形的一个角被圆滑了
    // 这种情况下，3个角都应该是接近90°的
    if (sumDegrees > 240 && sumDegrees < 300) {
      // 检查是否所有3个角都接近90°（矩形特征）
      const allNear90 = interiorAngles.every(a => {
        const deg = a * 180 / Math.PI;
        return Math.abs(deg - 90) < 25; // 允许±25°的误差
      });
      
      if (allNear90) {
        // 这是矩形！保留所有3个角，不要移除
        // 标记为矩形特征，后续代码会设置 isRectLike3 = true
      }
    }
    // 如果内角和在 210°-240° 之间，可能是三角形或混合情况
    else if (sumDegrees > 210 && sumDegrees < 240) {
      // 尝试找出并移除最可能是假角点的那个（原有逻辑）
      let rectLikeIndex = -1;
      let maxRectLikeness = 0;
      
      for (let i = 0; i < interiorAngles.length; i++) {
        const angleDegrees = interiorAngles[i] * 180 / Math.PI;
        const rectLikeness = 1 - Math.abs(angleDegrees - 90) / 90;
        
        if (rectLikeness > maxRectLikeness && rectLikeness > 0.5) {
          maxRectLikeness = rectLikeness;
          rectLikeIndex = i;
        }
      }
      
      // 如果找到了接近90°的角点，且其他两个角更像三角形
      if (rectLikeIndex >= 0) {
        const remainingAngles = interiorAngles.filter((_, i) => i !== rectLikeIndex);
        const remainingSum = remainingAngles.reduce((a, b) => a + b, 0) * 180 / Math.PI;
        
        if (Math.abs(remainingSum - 180) < 60) {
          sortedCorners = sortedCorners.filter((_, i) => i !== rectLikeIndex);
          interiorAngles = calculateInteriorAngles(points, sortedCorners);
          angleSum = interiorAngles.reduce((a, b) => a + b, 0);
        }
      }
    }
  }
  
  // 计算统计特征
  const avgInteriorAngle = interiorAngles.reduce((a, b) => a + b, 0) / interiorAngles.length;
  const squaredDiffs = interiorAngles.map(a => Math.pow(a - avgInteriorAngle, 2));
  const angleVariance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length);
  
  // 判断是否类似矩形：4个角，每个接近90°，方差小
  const isRectLike4 = sortedCorners.length === 4 && 
    interiorAngles.every(a => Math.abs(a - Math.PI / 2) < 0.5) &&
    angleVariance < 0.4;
  
  // 对于可能被合并的矩形（3个角）：
  // 关键特征分析：
  // - 矩形合并后：通常有1个明显的直角（~90°），另外2个是锐角（~45°），内角和~180°
  // - 三角形：3个角都在30°-120°之间，没有明显的直角
  const rightAngleCount = interiorAngles.filter(a => Math.abs(a - Math.PI / 2) < 0.175).length; // ±10°，更严格
  const sumDegrees = angleSum * 180 / Math.PI;
  
  // 3角矩形的特征（情况1：一个角被合并检测，形成2个~45°角 + 1个~90°角）：
  // 1. 至少1个明显的直角（90±10°）
  // 2. 另外两个角接近相等（差值<20°）且都是锐角（<60°）
  // 3. 内角和约180°（150-210°）
  let isRectLike3 = false;
  if (sortedCorners.length === 3 && rightAngleCount >= 1 && sumDegrees > 150 && sumDegrees < 210) {
    // 找到直角，检查另外两个角是否对称（类似矩形的两个45°角）
    const nonRightAngles = interiorAngles.filter(a => Math.abs(a - Math.PI / 2) >= 0.175);
    if (nonRightAngles.length === 2) {
      const angle1 = nonRightAngles[0] * 180 / Math.PI;
      const angle2 = nonRightAngles[1] * 180 / Math.PI;
      // 两个非直角应该接近且都是锐角
      if (Math.abs(angle1 - angle2) < 20 && angle1 < 60 && angle2 < 60) {
        isRectLike3 = true;
      }
    }
  }
  
  // 3角矩形的特征（情况2：一个角被圆滑/未检测到，剩下3个角都是~90°）：
  // 所有3个角都接近90°，内角和约270°
  if (sortedCorners.length === 3 && sumDegrees > 240 && sumDegrees < 300) {
    const allNear90 = interiorAngles.every(a => {
      const deg = a * 180 / Math.PI;
      return Math.abs(deg - 90) < 25; // 允许±25°的误差
    });
    if (allNear90) {
      isRectLike3 = true;
    }
  }
  
  const isRectLike = isRectLike4 || isRectLike3;
  
  // 判断是否类似三角形：3个角，内角和接近180°（π），且不符合矩形特征
  const isTriangleLike = sortedCorners.length === 3 && 
    sumDegrees > 150 && sumDegrees < 210 &&
    !isRectLike;
  
  return {
    interiorAngles,
    avgInteriorAngle,
    angleVariance,
    isRectLike,
    isTriangleLike,
  };
}

/**
 * 计算角点处的内角
 */
function calculateInteriorAngles(points: Point[], corners: AngleResult[]): number[] {
  const angles: number[] = [];
  
  for (let i = 0; i < corners.length; i++) {
    const prevIdx = i === 0 ? corners.length - 1 : i - 1;
    const nextIdx = (i + 1) % corners.length;
    
    const p1 = points[corners[prevIdx].index];
    const p2 = points[corners[i].index];
    const p3 = points[corners[nextIdx].index];
    
    const angle = calculateInteriorAngle(p1, p2, p3);
    angles.push(angle);
  }
  
  return angles;
}

function calculateInteriorAngle(p1: Point, p2: Point, p3: Point): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;

  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);

  if (len1 < 0.001 || len2 < 0.001) return 0;

  const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
}

/**
 * 计算点到线段的距离
 * 
 * @param point 点
 * @param lineStart 线段起点
 * @param lineEnd 线段终点
 * @returns 点到线段的距离
 */
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  
  const projX = lineStart.x + clampedT * dx;
  const projY = lineStart.y + clampedT * dy;
  
  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * 计算所有点到首尾连线的平均偏差
 * 用于判断是否为直线
 * 
 * @param points 轨迹点
 * @returns 平均偏差
 */
export function computeLineDeviation(points: Point[]): number {
  if (points.length < 3) return 0;
  
  const start = points[0];
  const end = points[points.length - 1];
  
  let totalDeviation = 0;
  for (let i = 1; i < points.length - 1; i++) {
    totalDeviation += pointToLineDistance(points[i], start, end);
  }
  
  return totalDeviation / (points.length - 2);
}
