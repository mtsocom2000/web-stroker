import type { Point } from '../types';

export interface SmoothOptions {
  /** 张力系数 0-1，越小曲线越平滑（默认0.5） */
  tension?: number;
  /** 每段原始点之间的插值点数（默认10） */
  segmentCount?: number;
  /** 是否启用距离过滤（默认true） */
  enableDistanceFilter?: boolean;
  /** 距离过滤阈值（默认3像素） */
  distanceThreshold?: number;
  /** 是否启用Chaikin平滑（默认true） */
  enableChaikin?: boolean;
  /** Chaikin迭代次数（默认2） */
  chaikinIterations?: number;
}

const DEFAULT_OPTIONS: SmoothOptions = {
  tension: 0.3,
  segmentCount: 20,
  enableDistanceFilter: true,
  distanceThreshold: 3,
  enableChaikin: true,
  chaikinIterations: 2,
};

/**
 * Catmull-Rom 样条平滑算法
 * 通过现有轨迹点计算新的平滑轨迹，而不是删除点
 * 特点：保持曲线形态，不会变成直线
 *
 * @param points 原始轨迹点
 * @param options 平滑选项
 * @returns 平滑后的轨迹点
 */
export function smoothStrokeCatmullRom(
  points: Point[],
  options: Partial<SmoothOptions> = {}
): Point[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { tension, segmentCount } = opts;

  // 点数太少，无法平滑
  if (points.length < 4) {
    return points;
  }

  const smoothed: Point[] = [];

  // 添加起始控制点（镜像第二个点到起点）
  const startControl: Point = {
    x: points[0].x - (points[1].x - points[0].x),
    y: points[0].y - (points[1].y - points[0].y),
  };

  // 添加结束控制点（镜像倒数第二个点到终点）
  const endControl: Point = {
    x: points[points.length - 1].x +
      (points[points.length - 1].x - points[points.length - 2].x),
    y: points[points.length - 1].y +
      (points[points.length - 1].y - points[points.length - 2].y),
  };

  // 构建控制点数组（包含镜像控制点）
  const controlPoints: Point[] = [startControl, ...points, endControl];

  // Catmull-Rom 插值
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = controlPoints[i];
    const p1 = controlPoints[i + 1];
    const p2 = controlPoints[i + 2];
    const p3 = controlPoints[i + 3];

    // 在 p1 和 p2 之间插值
    for (let step = 0; step < segmentCount!; step++) {
      const t = step / segmentCount!;
      const point = catmullRomInterpolate(p0, p1, p2, p3, t, tension!);
      smoothed.push(point);
    }
  }

  // 添加最后一个点
  smoothed.push(points[points.length - 1]);

  return smoothed;
}

/**
 * Catmull-Rom 插值计算
 *
 * 公式：
 * P(t) = 0.5 * [(2*P1) +
 *              (-P0+P2)*t +
 *              (2*P0-5*P1+4*P2-P3)*t² +
 *              (-P0+3*P1-3*P2+P3)*t³]
 *
 * @param p0 前一个控制点
 * @param p1 当前起点
 * @param p2 当前终点
 * @param p3 后一个控制点
 * @param t 插值参数 0-1
 * @param tension 张力系数
 * @returns 插值点
 */
function catmullRomInterpolate(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
  tension: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom 基函数（带张力调整）
  // 张力影响：tension=0 是标准 Catmull-Rom，tension=1 接近线性
  const tt = tension * 0.5;

  const b0 = tt * (-t + 2 * t2 - t3);
  const b1 = 1 + tt * (t - 3 * t2 + 2 * t3) + (1 - tension) * (-2 * t2 + t3);
  const b2 = tt * (-t + 3 * t2 - 2 * t3) + (1 - tension) * (t2);
  const b3 = tt * (t2 - t3);

  // 标准 Catmull-Rom（tension=0.5 时）
  const c0 = -0.5 * t + t2 - 0.5 * t3;
  const c1 = 1 - 1.5 * t2 + 0.5 * t3;
  const c2 = 0.5 * t + t2 - 0.5 * t3;
  const c3 = -0.5 * t2 + 0.5 * t3;

  // 根据张力混合
  const f0 = tension === 0.5 ? c0 : b0;
  const f1 = tension === 0.5 ? c1 : b1;
  const f2 = tension === 0.5 ? c2 : b2;
  const f3 = tension === 0.5 ? c3 : b3;

  return {
    x: f0 * p0.x + f1 * p1.x + f2 * p2.x + f3 * p3.x,
    y: f0 * p0.y + f1 * p1.y + f2 * p2.y + f3 * p3.y,
  };
}

/**
 * 移动平均平滑（轻量级替代方案）
 * 适用于需要轻微平滑的场景
 *
 * @param points 原始轨迹点
 * @param windowSize 平滑窗口大小（默认3）
 * @returns 平滑后的轨迹点
 */
export function smoothStrokeMovingAverage(
  points: Point[],
  windowSize: number = 3
): Point[] {
  if (points.length < 3) return points;

  const smoothed: Point[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  // 保留起点
  smoothed.push(points[0]);

  // 中间点进行移动平均
  for (let i = 1; i < points.length - 1; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }

    // 给中心点更高权重
    const centerWeight = 2.0;
    sumX += points[i].x * centerWeight;
    sumY += points[i].y * centerWeight;
    count += centerWeight;

    smoothed.push({
      x: sumX / count,
      y: sumY / count,
    });
  }

  // 保留终点
  smoothed.push(points[points.length - 1]);

  return smoothed;
}

/**
 * 自适应平滑 - 根据曲线曲率自动调整平滑程度
 * 直线部分保持原样，曲线部分进行平滑
 *
 * @param points 原始轨迹点
 * @returns 自适应平滑后的轨迹点
 */
export function smoothStrokeAdaptive(points: Point[]): Point[] {
  if (points.length < 4) return points;

  // 首先检测直线段和曲线段
  const segments: { start: number; end: number; isStraight: boolean }[] = [];
  let currentStart = 0;

  for (let i = 2; i < points.length - 1; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[i + 1];

    // 计算角度变化
    const v1x = p1.x - p2.x;
    const v1y = p1.y - p2.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    let angle = 0;
    if (len1 > 0 && len2 > 0) {
      const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
      angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    }

    // 如果角度变化小，认为是直线
    const isStraight = angle < Math.PI * 0.1; // < 18度认为是直线

    if (segments.length === 0 || segments[segments.length - 1].isStraight !== isStraight) {
      if (currentStart < i - 1) {
        segments.push({ start: currentStart, end: i - 1, isStraight: !isStraight });
      }
      currentStart = i - 1;
    }
  }

  // 添加最后一段
  segments.push({ start: currentStart, end: points.length - 1, isStraight: true });

  // 合并结果
  const result: Point[] = [];

  for (const segment of segments) {
    const segmentPoints = points.slice(segment.start, segment.end + 1);

    if (segment.isStraight || segmentPoints.length < 4) {
      // 直线段或短段：使用原始点
      if (result.length === 0) {
        result.push(...segmentPoints);
      } else {
        result.push(...segmentPoints.slice(1));
      }
    } else {
      // 曲线段：使用 Catmull-Rom 平滑
      const smoothed = smoothStrokeCatmullRom(segmentPoints, { segmentCount: 8 });
      if (result.length === 0) {
        result.push(...smoothed);
      } else {
        result.push(...smoothed.slice(1));
      }
    }
  }

  return result;
}

/**
 * 第一层：距离过滤 - 去除抖动产生的极近点
 * 对原始鼠标点做距离过滤，减少噪声
 * 
 * @param points 原始轨迹点
 * @param minDist 最小距离阈值（默认3像素）
 * @returns 过滤后的点
 */
export function filterByDistance(points: Point[], minDist: number = 3): Point[] {
  if (points.length < 2) return points;
  
  const result: Point[] = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const d = Math.hypot(points[i].x - prev.x, points[i].y - prev.y);
    if (d >= minDist) {
      result.push(points[i]);
    }
  }
  
  return result;
}

/**
 * 第二层：Chaikin 切角算法平滑
 * 每次迭代把折线的每条边切掉两个角，迭代2~3次后折线趋近于光滑曲线
 * 且不会过度偏离原轨迹
 * 
 * 算法原理：
 * P_new1 = 0.75 * P_i + 0.25 * P_{i+1}
 * P_new2 = 0.25 * P_i + 0.75 * P_{i+1}
 * 
 * @param points 原始轨迹点
 * @param iterations 迭代次数（默认2，建议2-3）
 * @returns Chaikin平滑后的点
 */
export function chaikinSmooth(points: Point[], iterations: number = 2): Point[] {
  if (points.length < 2) return points;
  
  let pts = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [pts[0]];
    
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      
      // 第一个新点（靠近p1）
      next.push({
        x: 0.75 * p1.x + 0.25 * p2.x,
        y: 0.75 * p1.y + 0.25 * p2.y,
      });
      
      // 第二个新点（靠近p2）
      next.push({
        x: 0.25 * p1.x + 0.75 * p2.x,
        y: 0.25 * p1.y + 0.75 * p2.y,
      });
    }
    
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  
  return pts;
}

/**
 * 增强版平滑管线 - 分层处理
 * 第1层：距离过滤（降噪）
 * 第2层：Chaikin平滑（切角）
 * 第3层：Douglas-Peucker简化（去冗余）
 * 第4层：Catmull-Rom样条（C1连续）
 * 
 * @param points 原始轨迹点
 * @param options 平滑选项
 * @returns 增强平滑后的轨迹点
 */
export function smoothStrokeEnhanced(
  points: Point[],
  options: Partial<SmoothOptions> = {}
): Point[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (points.length < 4) return points;
  
  let result = [...points];
  
  // 第1层：距离过滤（去除抖动噪声）
  if (opts.enableDistanceFilter) {
    result = filterByDistance(result, opts.distanceThreshold);
  }
  
  if (result.length < 4) return result;
  
  // 第2层：Chaikin切角平滑
  if (opts.enableChaikin) {
    result = chaikinSmooth(result, opts.chaikinIterations);
  }
  
  // 第3层和第4层在DrawingCanvas中通过simplifyStroke和smoothStrokeCatmullRom处理
  // 这里返回Chaikin平滑后的结果供后续处理
  
  return result;
}

/**
 * 绘制 Catmull-Rom 样条曲线
 * 使用 Canvas API 绘制通过所有控制点的 C1 连续曲线
 * 
 * @param ctx Canvas 2D 上下文
 * @param points 控制点数组
 * @param tension 张力系数（默认0.5）
 */
export function drawCatmullRom(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  tension: number = 0.5
): void {
  if (points.length < 2) return;
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    
    // 转换为贝塞尔控制点（Catmull-Rom到Cubic Bezier）
    const cp1x = p1.x + (p2.x - p0.x) / (6 * tension);
    const cp1y = p1.y + (p2.y - p0.y) / (6 * tension);
    const cp2x = p2.x - (p3.x - p1.x) / (6 * tension);
    const cp2y = p2.y - (p3.y - p1.y) / (6 * tension);
    
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  
  ctx.stroke();
}
