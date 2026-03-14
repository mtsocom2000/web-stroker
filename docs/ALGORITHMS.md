# Web Stroker 智能绘图算法文档

## 目录

1. [Smooth 平滑模式](#smooth-平滑模式)
2. [Predict 预测模式](#predict-预测模式)

---

## Smooth 平滑模式

### 概述

Smooth 模式通过分层处理算法，将手绘的抖动轨迹转换为平滑的 C1 连续曲线。整个处理流程分为四个阶段：降噪 → 切角平滑 → 路径简化 → 样条插值。

### 算法流程

```
原始轨迹点
    ↓
① 距离过滤（降噪）
    ↓
② Chaikin 切角平滑
    ↓
③ Douglas-Peucker 路径简化
    ↓
④ Catmull-Rom 样条插值
    ↓
平滑后的 C1 连续曲线
```

### 第一层：距离过滤（降噪预处理）

**目的**：去除鼠标/触摸屏采样时产生的抖动噪声点

**算法**：

```typescript
function filterByDistance(points: Point[], minDist: number = 3): Point[] {
  const result = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const d = Math.hypot(points[i].x - prev.x, points[i].y - prev.y);
    if (d >= minDist) {
      result.push(points[i]);
    }
  }
  
  return result;
}
```

**原理**：
- 保留点之间的距离必须 ≥ minDist（默认 3 像素）
- 过滤掉因手抖产生的极近冗余点
- 保留起点，确保轨迹连续性

**参数建议**：
- `minDist = 2-5`：轻微防抖
- `minDist = 5-10`：中等防抖（推荐）
- `minDist > 10`：强防抖（可能丢失细节）

---

### 第二层：Chaikin 切角算法

**目的**：通过切角操作将折线逐渐趋近于光滑曲线，同时不偏离原始轨迹

**算法原理**：

Chaikin 算法是一种细分（Subdivision）算法，每次迭代将每条边替换为两条更短的边，形成"切角"效果。

对于每条边 (Pᵢ, Pᵢ₊₁)，生成两个新点：

```
P_new1 = 0.75 × Pᵢ + 0.25 × Pᵢ₊₁    (靠近 Pᵢ)
P_new2 = 0.25 × Pᵢ + 0.75 × Pᵢ₊₁    (靠近 Pᵢ₊₁)
```

**实现**：

```typescript
function chaikinSmooth(points: Point[], iterations: number = 2): Point[] {
  let pts = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [pts[0]];  // 保留起点
    
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      
      // 第一个新点（靠近 p1）
      next.push({
        x: 0.75 * p1.x + 0.25 * p2.x,
        y: 0.75 * p1.y + 0.25 * p2.y,
      });
      
      // 第二个新点（靠近 p2）
      next.push({
        x: 0.25 * p1.x + 0.75 * p2.x,
        y: 0.25 * p1.y + 0.75 * p2.y,
      });
    }
    
    next.push(pts[pts.length - 1]);  // 保留终点
    pts = next;
  }
  
  return pts;
}
```

**特性**：
- **收敛性**：迭代次数越多，曲线越光滑
- **保形性**：不会过度偏离原始轨迹
- **局部性**：只影响相邻点，计算高效

**参数建议**：
- `iterations = 1`：轻微平滑
- `iterations = 2-3`：推荐值，平衡平滑度和性能
- `iterations > 3`：过度平滑，点数量指数增长

**复杂度**：
- 时间：O(n × iterations)
- 空间：O(n × 2^iterations)

---

### 第三层：Douglas-Peucker 路径简化

**目的**：在保持形状特征的前提下，减少点的数量，提高后续计算效率

**算法原理**：

递归地找出离首尾连线最远的点，如果距离超过阈值则保留该点并分割路径。

```
1. 连接首尾点形成基准线
2. 找出离基准线最远的点
3. 如果最远距离 > ε：
   - 保留该点
   - 对该点两侧递归简化
4. 否则：用首尾两点代替整个路径
```

**核心代码**（已有实现）：

```typescript
function simplifyRDP(points: Point[], epsilon: number = 5): Point[] {
  if (points.length < 3) return points;
  
  // 找出离首尾连线最远的点
  let maxDist = 0, maxIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // 如果距离超过阈值，保留该点并递归分割
  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyRDP(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  // 否则简化为首尾两点
  return [points[0], points[points.length - 1]];
}
```

**参数建议**：
- `epsilon = 2-5`：精细简化，保留更多细节
- `epsilon = 5-10`：推荐值，平衡简化和保形
- `epsilon = 10-20`：强力简化，适合长路径

---

### 第四层：Catmull-Rom 样条插值

**目的**：通过所有控制点生成 C1 连续的平滑曲线

**算法原理**：

Catmull-Rom 样条是一种插值样条，保证曲线通过所有控制点，并在连接处达到 C1 连续（切线连续）。

**公式**：

对于控制点 P₀, P₁, P₂, P₃，在 P₁ 和 P₂ 之间插值：

```
P(t) = 0.5 × [(2×P₁) +
              (-P₀+P₂)×t +
              (2×P₀-5×P₁+4×P₂-P₃)×t² +
              (-P₀+3×P₁-3×P₂+P₃)×t³]
```

其中 t ∈ [0, 1]

**实现**：

```typescript
function smoothStrokeCatmullRom(
  points: Point[],
  options: { tension?: number; segmentCount?: number } = {}
): Point[] {
  const { tension = 0.5, segmentCount = 10 } = options;
  
  if (points.length < 4) return points;
  
  const smoothed: Point[] = [];
  
  // 添加镜像控制点（保证边界切线）
  const startControl: Point = {
    x: points[0].x - (points[1].x - points[0].x),
    y: points[0].y - (points[1].y - points[0].y),
  };
  const endControl: Point = {
    x: points[points.length - 1].x + (points[points.length - 1].x - points[points.length - 2].x),
    y: points[points.length - 1].y + (points[points.length - 1].y - points[points.length - 2].y),
  };
  
  const controlPoints = [startControl, ...points, endControl];
  
  // Catmull-Rom 插值
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = controlPoints[i];
    const p1 = controlPoints[i + 1];
    const p2 = controlPoints[i + 2];
    const p3 = controlPoints[i + 3];
    
    for (let step = 0; step < segmentCount; step++) {
      const t = step / segmentCount;
      const point = catmullRomInterpolate(p0, p1, p2, p3, t, tension);
      smoothed.push(point);
    }
  }
  
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

function catmullRomInterpolate(
  p0: Point, p1: Point, p2: Point, p3: Point,
  t: number, tension: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  
  // Catmull-Rom 基函数
  const f0 = -0.5 * t + t2 - 0.5 * t3;
  const f1 = 1 - 1.5 * t2 + 0.5 * t3;
  const f2 = 0.5 * t + t2 - 0.5 * t3;
  const f3 = -0.5 * t2 + 0.5 * t3;
  
  return {
    x: f0 * p0.x + f1 * p1.x + f2 * p2.x + f3 * p3.x,
    y: f0 * p0.y + f1 * p1.y + f2 * p2.y + f3 * p3.y,
  };
}
```

**参数说明**：
- `tension`：张力系数（0-1）
  - `0`：标准 Catmull-Rom，曲线较松
  - `0.5`：推荐值，平衡平滑和保形
  - `1`：接近线性，曲线较紧
- `segmentCount`：每段插值点数，越多越平滑但性能越低

**转换为贝塞尔曲线**（用于 Canvas 绘制）：

Catmull-Rom 可直接转换为三次贝塞尔曲线的控制点：

```
CP1 = P₁ + (P₂ - P₀) / (6 × tension)
CP2 = P₂ - (P₃ - P₁) / (6 × tension)
```

---

### 完整流程整合

```typescript
function smoothStrokeEnhanced(points: Point[]): Point[] {
  // 第1层：距离过滤（去除抖动噪声）
  let result = filterByDistance(points, 3);
  
  if (result.length < 4) return result;
  
  // 第2层：Chaikin 切角平滑
  result = chaikinSmooth(result, 2);
  
  // 第3层：Douglas-Peucker 路径简化（在 strokeSimplifier 中）
  // result = simplifyRDP(result, epsilon);
  
  // 第4层：Catmull-Rom 样条插值
  result = smoothStrokeCatmullRom(result, {
    tension: 0.5,
    segmentCount: 10
  });
  
  return result;
}
```

### 性能优化建议

1. **分层可调**：根据设备性能调整各层参数
2. **点数限制**：对超长路径先进行粗简化
3. **Web Worker**：复杂计算放入 Worker 线程
4. **缓存结果**：相同参数的计算结果可缓存

---

## Predict 预测模式

### 概述

Predict 模式通过特征提取和图形评分系统，识别用户手绘的几何图形（直线、圆、矩形等），并生成规整的几何图形替代原始笔迹。

### 整体流程

```
原始轨迹
    ↓
① 特征提取（速度、密度、转角、包围盒）
    ↓
② 各图形候选评分
    ↓
③ 最高分图形 → 参数拟合
    ↓
④ 用规整图形替换笔迹
```

---

### 第一步：特征提取

#### 1.1 转角检测

**目的**：识别轨迹中的顶点和拐角

**算法**：使用向量夹角计算局部转角

```typescript
function computeAngles(points: Point[], step: number = 5): AngleResult[] {
  const angles: AngleResult[] = [];
  
  for (let i = step; i < points.length - step; i++) {
    const p0 = points[i - step];
    const p1 = points[i];
    const p2 = points[i + step];
    
    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    if (len1 < 1e-9 || len2 < 1e-9) continue;
    
    // 余弦相似度计算夹角
    const cos = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
    const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
    
    angles.push({ index: i, angle });
  }
  
  return angles;
}

function findCorners(angles: AngleResult[], threshold: number = Math.PI * 0.4): AngleResult[] {
  return angles.filter(a => a.angle > threshold);
}
```

**参数说明**：
- `step`：计算步长，越大抗噪声能力越强，但会漏检小拐角
- `threshold`：转角阈值（默认 72°），超过则认为是顶点

#### 1.2 曲率计算

**目的**：区分直线和曲线段

**公式**：

```
κ = |v₁ × v₂| / (|v₁| × |v₂|)
```

其中 × 表示二维叉积：v₁ × v₂ = v₁.x × v₂.y - v₁.y × v₂.x

**实现**：

```typescript
function computeCurvatures(points: Point[], step: number = 4): CurvatureResult[] {
  const curvatures: CurvatureResult[] = [];
  
  for (let i = step; i < points.length - step; i++) {
    const p0 = points[i - step];
    const p1 = points[i];
    const p2 = points[i + step];
    
    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    
    // 叉积绝对值
    const cross = Math.abs(v1.x * v2.y - v1.y * v2.x);
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    const curvature = cross / (len1 * len2 + 1e-9);
    
    curvatures.push({ index: i, curvature });
  }
  
  return curvatures;
}
```

**特性**：
- 直线：κ ≈ 0
- 圆弧：κ ≈ 常数
- 尖锐拐角：κ 很大

#### 1.3 包围盒与纵横比

**目的**：获取图形的整体尺寸和比例特征

```typescript
function getBoundingBox(points: Point[]): BoundingBox {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  return {
    minX, minY, maxX, maxY,
    width,
    height,
    cx: (minX + maxX) / 2,      // 中心 X
    cy: (minY + maxY) / 2,      // 中心 Y
    aspectRatio: width / (height + 1e-9),  // 宽高比
  };
}
```

**应用**：
- 判断正方形（aspectRatio ≈ 1）
- 判断椭圆（有明显长短轴）
- 归一化尺寸比较

#### 1.4 封闭检测

**目的**：判断轨迹是否形成封闭图形

```typescript
function detectClosedShape(points: Point[], thresholdRatio: number = 0.2): {
  isClosed: boolean;
  distance: number;
} {
  if (points.length < 3) {
    return { isClosed: false, distance: Infinity };
  }
  
  const start = points[0];
  const end = points[points.length - 1];
  const distance = Math.hypot(start.x - end.x, start.y - end.y);
  
  const bbox = getBoundingBox(points);
  const threshold = bbox.width * thresholdRatio;
  
  return {
    isClosed: distance < threshold,
    distance,
  };
}
```

**阈值策略**：
- 使用包围盒宽度的比例作为阈值，适应不同尺寸的图形
- 默认 20%，可根据识别灵敏度调整

#### 1.5 路径长度与直线偏差

**目的**：判断是否为直线或估算圆的周长

```typescript
function computePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }
  return length;
}

function computeLineDeviation(points: Point[]): number {
  const start = points[0];
  const end = points[points.length - 1];
  
  let totalDeviation = 0;
  for (let i = 1; i < points.length - 1; i++) {
    totalDeviation += pointToLineDistance(points[i], start, end);
  }
  
  return totalDeviation / (points.length - 2);
}
```

---

### 第二步：图形评分系统

#### 评分框架

对每个候选图形计算 0-1 的评分，评分依据包括：
- 顶点数量
- 曲率特征
- 包围盒比例
- 封闭性
- 路径长度匹配度

#### 图形识别逻辑

| 图形 | 核心判断条件 | 评分权重 |
|------|-------------|----------|
| **直线** | 顶点数≈0，平均曲率极低，直线偏差小 | 顶点(40%) + 曲率(30%) + 偏差(30%) |
| **角/折线** | 顶点数=1，非封闭，两侧曲率低 | 顶点数(50%) + 曲率(30%) + 长度(20%) |
| **三角形** | 顶点数≈3，封闭，低曲率 | 顶点(50%) + 曲率(30%) + 封闭(20%) |
| **四边形** | 顶点数≈4，封闭，低曲率，合理宽高比 | 顶点(50%) + 曲率(30%) + 比例(20%) |
| **正方形** | 继承矩形 + 宽高比≈1 | 矩形基础(70%) + 比例(30%) |
| **圆形** | 顶点数≈0，曲率均匀，封闭，周长匹配 | 无顶点(30%) + 均匀(30%) + 周长(25%) + 比例(15%) |
| **椭圆** | 继承圆形 + 明显长短轴 | 圆形基础(70%) + 长短轴(30%) |
| **圆弧** | 曲率均匀，部分封闭 | 曲率均匀(40%) + 曲率适中(30%) + 非封闭(30%) |

#### 评分示例（直线）

```typescript
function scoreLine(points: Point[], features: ShapeFeatures): ShapeScore {
  const cornerCount = features.corners.length;
  const avgCurvature = features.avgCurvature;
  const lineDeviation = computeLineDeviation(points);
  const bbox = features.bbox;
  
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
  }
  
  // 直线偏差评分（相对于包围盒尺寸）
  const relativeDeviation = lineDeviation / Math.max(bbox.width, bbox.height);
  if (relativeDeviation < 0.05) {
    score += 0.3;
    reasons.push('偏差极小');
  }
  
  return {
    type: 'line',
    score,
    confidence: score,
    reason: reasons.join(', ') || '不符合直线特征',
  };
}
```

#### 曲率均匀性评估

用于识别圆形和圆弧：

```typescript
function computeCurvatureVariance(features: ShapeFeatures): number {
  const mean = features.avgCurvature;
  const squaredDiffs = features.curvatures.map(c => 
    Math.pow(c.curvature - mean, 2)
  );
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  return Math.sqrt(variance);  // 标准差
}
```

**判断标准**：
- 标准差 < 0.1：曲率非常均匀（可能是圆）
- 标准差 0.1-0.2：曲率较均匀（可能是圆弧）
- 标准差 > 0.2：曲率不均匀（不规则曲线）

---

### 第三步：参数拟合

根据识别出的图形类型，拟合规整的几何参数并生成标准图形。

#### 直线

```typescript
// 直接用首尾点
return [points[0], points[points.length - 1]];
```

#### 矩形/正方形

```typescript
const bbox = features.bbox;
const w = type === 'square' ? bbox.width : bbox.width;
const h = type === 'square' ? bbox.width : bbox.height;

return [
  { x: bbox.minX, y: bbox.minY },
  { x: bbox.minX + w, y: bbox.minY },
  { x: bbox.minX + w, y: bbox.minY + h },
  { x: bbox.minX, y: bbox.minY + h },
  { x: bbox.minX, y: bbox.minY },  // 闭合
];
```

#### 圆形

```typescript
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

// 使用包围盒中心，半径取宽高平均值的一半
const center = { x: bbox.cx, y: bbox.cy };
const radius = (bbox.width + bbox.height) / 4;
```

#### 椭圆

```typescript
function generateEllipsePoints(
  center: Point,
  a: number,  // 半长轴
  b: number,  // 半短轴
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

// a = width / 2, b = height / 2
```

#### 圆弧

```typescript
function generateArcPoints(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  numPoints: number = 32
): Point[] {
  const points: Point[] = [];
  let coverage = endAngle - startAngle;
  if (coverage < 0) coverage += 2 * Math.PI;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startAngle + t * coverage;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return points;
}

// 从原始轨迹的首尾点反推角度
const startAngle = Math.atan2(points[0].y - center.y, points[0].x - center.x);
const endAngle = Math.atan2(
  points[points.length - 1].y - center.y,
  points[points.length - 1].x - center.x
);
```

---

### 第四步：置信度判断

```typescript
const MIN_CONFIDENCE = 0.6;  // 最低置信度阈值

if (bestScore.score < MIN_CONFIDENCE) {
  // 置信度不足，保留原始平滑笔迹
  return originalPoints;
}

// 置信度足够，用规整图形替换
return generateShapePoints(bestScore.type, points, features);
```

**置信度分级**：
- `score >= 0.9`：极高置信度，自动替换
- `score 0.7-0.9`：高置信度，建议替换
- `score 0.6-0.7`：中等置信度，可选替换
- `score < 0.6`：低置信度，保留原样

---

## 性能与优化

### 时间复杂度

| 算法 | 复杂度 | 说明 |
|------|--------|------|
| 距离过滤 | O(n) | 单次遍历 |
| Chaikin 平滑 | O(n × k) | k 为迭代次数 |
| Douglas-Peucker | O(n log n) | 最坏情况 |
| Catmull-Rom | O(n × m) | m 为插值点数 |
| 转角计算 | O(n) | 单次遍历 |
| 曲率计算 | O(n) | 单次遍历 |
| 图形评分 | O(1) | 固定 11 种图形 |

### 优化建议

1. **提前退出**：
   - 如果点数 < 3，直接返回原样
   - 如果包围盒过小，跳过复杂计算

2. **采样降频**：
   - 超长路径先进行粗采样
   - 保留特征点，减少计算量

3. **并行计算**：
   - 各种图形的评分可并行
   - 使用 Web Worker 避免阻塞 UI

4. **缓存策略**：
   - 相同参数的平滑结果可缓存
   - 特征提取结果可复用

---

## 扩展方向

### Smooth 模式扩展

1. **自适应参数**：根据绘制速度自动调整平滑强度
2. **多尺度平滑**：对不同曲率区域使用不同参数
3. **机器学习**：用神经网络学习最优平滑参数

### Predict 模式扩展

1. **更多图形**：增加星形、心形、箭头等常见图形
2. **图形组合**：识别由多个基本图形组成的复合图形
3. **学习用户习惯**：根据用户历史修正评分权重
4. **实时预览**：绘制过程中实时显示预测结果

---

*文档版本：1.0*
*更新日期：2026-03-10*
