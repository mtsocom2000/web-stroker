# Web Stroker - 架构文档

## 目录
1. [应用架构概览](#应用架构概览)
2. [状态管理系统](#状态管理系统)
3. [绘制模式](#绘制模式)
4. [形状预测流水线](#形状预测流水线)
5. [数据流](#数据流)
6. [Three.js渲染流水线](#threejs渲染流水线)
7. [文件格式规范](#文件格式规范)
8. [开发模式](#开发模式)

## 应用架构概览

### 技术栈
- **前端框架**: React 19 + TypeScript
- **构建系统**: Vite + React plugin
- **3D渲染**: Three.js (WebGL)
- **状态管理**: Zustand
- **样式**: CSS modules
- **测试**: Vitest

### 目录结构
```
web-stroker/
├── src/
│   ├── components/          # React组件
│   │   ├── DrawingCanvas.tsx    # 主画布组件
│   │   ├── Toolbar.tsx          # 工具栏界面
│   │   ├── PropertyPanel.tsx    # 工具属性面板
│   │   └── DrawToolPanel.tsx    # 绘制模式控制
│   ├── predict/            # 形状预测系统
│   │   ├── index.ts             # 主入口 & predictShape
│   │   ├── shapeAnalysis.ts     # 形状特征分析
│   │   ├── improvedClassifier.ts # 改进版分类器
│   │   ├── shapeSimilarity.ts   # 形状相似度验证
│   │   ├── shapeClassifier.ts   # 基础分类器
│   │   ├── enhancedClassifier.ts # 增强分类器
│   │   ├── cornerDetection.ts   # 角点检测
│   │   ├── mouseDynamics.ts     # 鼠标动态分析
│   │   └── pointDensity.ts      # 点密度分析
│   ├── store.ts            # Zustand状态管理
│   ├── types.ts            # TypeScript类型定义
│   ├── utils.ts            # 工具函数
│   ├── shapePredict.ts     # 基础形状识别 (旧版)
│   ├── shapeRecognition/   # 高级形状检测
│   ├── brush/             # 笔刷渲染系统
│   ├── fillRegion/        # 填充区域功能
│   ├── intersection/      # 几何相交计算
│   ├── measurements.ts    # 测量工具
│   └── __tests__/        # 测试文件
├── baseline/              # 基准测试数据
│   └── shapes/           # 分类测试用例
│       ├── angle/
│       ├── arc/
│       ├── circle/
│       ├── ellipse/
│       ├── line/
│       ├── polygon/
│       ├── rectangle/
│       └── triangle/
├── docs/                  # 文档
└── public/               # 静态资源
```

## 状态管理系统

### Store结构 (`src/store.ts`)
Zustand store按逻辑域组织：

#### 1. 工具类别管理
```typescript
toolCategory: ToolCategory // 'artistic' | 'digital' | 'measure'
artisticTool: ArtisticTool // 'pencil' | 'pen' | 'brush' | 'ballpen' | 'eraser'
digitalTool: DigitalTool   // 'line' | 'circle' | 'arc' | 'curve'
measureTool: MeasureTool | null // 'distance' | 'angle' | 'radius' | 'face'
```

#### 2. 单位系统配置
```typescript
unit: LengthUnit          // 'mm' | 'cm' | 'inch' | 'px'
angleUnit: AngleUnit      // 'degree' | 'radian'
pixelsPerUnit: number     // 转换因子
```

#### 3. 绘制状态
```typescript
strokes: Stroke[]         // 所有绘制的笔划
fillRegions: FillRegion[] // 填充区域数据
canvasWidth: number
canvasHeight: number
zoom: number              // 相机缩放 (0.5-5.0)
panX: number
panY: number
```

#### 4. 数字模式状态
```typescript
digitalMode: 'select' | 'draw'
circleCreationMode: 'centerRadius' | 'threePoint'
selectedDigitalStrokeIds: string[]
selectedDigitalElement: DigitalElement | null
```

#### 5. 笔划模式 ( Artistic )
```typescript
strokeMode: 'original' | 'smooth' | 'predict'
// original: 原始点
// smooth:   平滑曲线 (Catmull-Rom)
// predict:  形状预测识别
```

#### 6. 回放控制状态
```typescript
isReplaying: boolean
currentReplayStroke: number
totalReplayStrokes: number
replaySpeed: number // 0=即时, 0.5=慢速, 5=快速
```

#### 7. 历史管理
```typescript
history: CanvasState[]
historyIndex: number
```

### 状态更新模式
- **不可变更新**: 总是返回新的状态对象
- **批量操作**: 使用 `addStrokesBatch` 处理多个笔划
- **历史集成**: 每次状态变更更新历史栈
- **选择更新**: 只更新相关状态部分

## 绘制模式

### Artistic Mode (艺术模式)
**用途**: 自由手绘，支持自然笔触和自动形状识别

#### 功能
- **笔划平滑**: Catmull-Rom样条插值
- **形状预测**: 自动检测几何形状 (predict模式)
- **笔刷类型**: Pencil, pen, brush, ballpen
- **橡皮擦工具**: 笔划删除

#### 笔划模式
1. **Original (原始)**: 使用原始捕获点直接渲染
2. **Smooth (平滑)**: Catmull-Rom平滑曲线
3. **Predict (预测)**: 自动识别并纠正为几何形状

### Digital Mode (数字模式)
**用途**: 精确几何绘制和测量

#### 绘制工具
1. **Line Tool**: 直线段，带端点控制
2. **Circle Tool**: 
   - 圆心-半径模式: 点击圆心，拖拽半径
   - 三点模式: 点击圆周上三点
3. **Arc Tool**: 圆弧，带圆心、半径、起止角度
4. **Curve Tool**: Bezier曲线，带控制点

#### 测量工具
1. **Distance**: 测量两点间距离或沿线长度
2. **Angle**: 测量两线间夹角
3. **Radius**: 测量圆/弧半径
4. **Face Area**: 计算封闭形状面积

### 模式切换
- **工具类别选择**: artistic/digital/measure 模式切换
- **模式持久化**: 当前模式保存在画布状态中
- **快捷键**: 'v' (选择), 'd' (绘制), 'm' (测量)

## 形状预测流水线

### 架构概览
```
┌─────────────────────────────────────────────────────────────┐
│                    Predict Pipeline                         │
├─────────────────────────────────────────────────────────────┤
│  Input: Point[] (原始轨迹点)                                  │
│  Output: Point[] | null (预测形状点或null)                    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: 特征分析 (analyzeShapeFeatures)                     │
├─────────────────────────────────────────────────────────────┤
│ • 计算转角 (computeAngles) - 向量余弦相似度                    │
│ • 检测闭环 (detectClosedShape) - 首尾距离检查                  │
│ • 角点检测 (findCorners) - 自适应阈值 + 距离合并               │
│ • 曲率计算 (computeCurvatures) - 局部曲率分析                  │
│ • 起点角点补充 - 封闭图形额外检测起点夹角                       │
│ • 角点角度特征 (computeCornerAngleFeatures) - 内角分析         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: 分类评分 (classifyShapeImproved)                    │
├─────────────────────────────────────────────────────────────┤
│ 评分器列表 (按优先级):                                        │
│ 1. scoreLineImproved       - 直线检测                         │
│ 2. scoreAngleImproved      - 角度检测                         │
│ 3. scoreTriangleImproved   - 三角形 (含3角点验证)              │
│ 4. scoreRectangleImproved  - 矩形 (含直角检测)                 │
│ 5. scoreSquareImproved     - 正方形                           │
│ 6. scoreCircleImproved     - 圆形 (含假角点处理)               │
│ 7. scoreEllipseImproved    - 椭圆                             │
│ 8. scoreArcImproved        - 圆弧                             │
│ 9. scoreCurveImproved      - 曲线                             │
│ 10. scorePolygonImproved   - 多边形 (通用四边形)               │
│ 11. scorePolylineImproved  - 多段线                           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: 评分排序与后处理                                      │
├─────────────────────────────────────────────────────────────┤
│ 排序规则:                                                     │
│ • 主要排序: 分数降序                                          │
│ • 平局打破 (分数差 < 0.15):                                    │
│   - triangle vs rectangle: 看角点数量和直角数                  │
│   - polygon vs 具体形状: 看直角数量和分数差距                  │
│                                                               │
│ 后处理规则:                                                   │
│ • 4角+无直角+rectangle最佳 → 强制转为 triangle                │
│ • 3角+2+"直角"+isRectLike → 保持 rectangle                    │
│ • 4+角点+polygon高分 → 优先polygon (除非3+直角+rectScore≥0.7) │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: 形状点生成 (generateShapePointsImproved)            │
├─────────────────────────────────────────────────────────────┤
│ • line:    [起点, 终点]                                       │
│ • angle:   [起点, 角点, 终点]                                 │
│ • triangle: [角点1, 角点2, 角点3, 角点1]                      │
│ • rectangle/square: [4角点 + 闭合]                           │
│ • polygon:  [所有角点 + 闭合]                                 │
│ • circle:   32点均匀采样                                      │
│ • ellipse:  32点均匀采样                                      │
└─────────────────────────────────────────────────────────────┘
```

### 关键算法

#### 1. 角点检测 (findCorners)
```typescript
// 参数配置
const step = 3;  // 计算步长
const closedThreshold = Math.PI * 0.18;  // ~32° (封闭图形)
const openThreshold = Math.PI * 0.35;    // ~63° (开放图形)
const minDistance = Math.max(10, bboxSize * 0.025);  // 最小合并距离

// 特殊处理: 2角点封闭形状 → 强制添加起点作为第3角点
if (isClosed && corners.length === 2) {
  // 添加起点角点补偿 (三角形缺角情况)
}
```

#### 2. 闭环检测 (detectClosedShape)
```typescript
// 满足任一条件即视为闭环
const isClosed = 
  distance < bboxSize * 0.25 ||           // 绝对距离检查
  distance < pathLength * 0.08 ||         // 相对路径长度
  distance / bboxSize < 0.10;             // 相对包围盒大小
```

#### 3. Triangle 3角点验证
```typescript
// 验证真实三角形的条件
const isValidTriangle = 
  minAngle >= 25 &&           // 无过小角度
  maxAngle <= 160 &&          // 无过大角度
  smallAngles <= 1;           // 最多1个小角度(<45°)

// 失败 → 假角点 (可能是圆的绘制痕迹)
```

#### 4. Circle 3假角点处理
```typescript
// 不再直接拒绝3角点，而是验证是否为有效三角形
if (cornerCount === 3) {
  if (isValidTriangle) {
    return { score: 0, reason: '三角形特征明显' };
  }
  // 无效三角形 → 继续评分 (假角点)
  score += 0.05;  // 低基础分
}
```

#### 5. Rectangle 3角点降级
```typescript
// 3角点 (可能矩形缺一角)
if (rightAngleCount >= 2) {
  score += 0.25;  // 原0.45，降低避免与真矩形竞争
} else if (rightAngleCount >= 1) {
  score += 0.15;
} else {
  score += 0.10;
}
```

### 形状类型定义
```typescript
export type ImprovedShapeType =
  | 'line'      // 直线
  | 'angle'     // 角 (开放)
  | 'triangle'  // 三角形 (3角点 + 验证通过)
  | 'rectangle' // 矩形 (4角点 + 3+直角)
  | 'square'    // 正方形 (矩形 + 宽高比≈1)
  | 'circle'    // 圆形 (0-3假角点 + 均匀曲率)
  | 'ellipse'   // 椭圆 (0-3角点 + 基本均匀曲率)
  | 'arc'       // 圆弧
  | 'curve'     // 曲线
  | 'polygon'   // 多边形 (4+角点通用类型)
  | 'polyline'  // 多段线 (开放)
  | 'unknown';
```

## 数据流

### 笔划创建流程
```
鼠标事件 → 点捕获 → 笔划分析 → 形状预测 → 渲染
    ↓          ↓          ↓           ↓        ↓
 MouseDown   原始点    特征分析    几何替换   Three.js
 MouseMove   (points)  (corners)   (predict)  Geometry
 MouseUp
```

### Artistic Mode Predict 流程
```typescript
// DrawingCanvas.tsx
const handleMouseUp = () => {
  if (store.strokeMode === 'predict') {
    const predicted = predictShape(currentStrokePoints);
    if (predicted) {
      const isValid = validateShapePrediction(
        currentStrokePoints, 
        predicted, 
        0.3  // 相似度阈值
      );
      displayPoints = isValid ? predicted : smoothedPoints;
    }
  }
};
```

### 数字测量流程
```
1. 工具选择 → 2. 点选择 → 3. 计算 → 4. 显示
        ↓          ↓         ↓         ↓
   测量工具    点击点    几何计算    数值显示
```

## Three.js渲染流水线

### 场景设置
```typescript
// 相机配置
const camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
camera.position.z = 10;

// 场景层级
const scene = new THREE.Scene();
scene.add(gridHelper);      // 网格 z = -1
scene.add(axisHelper);      // 坐标轴 z = -0.5
scene.add(strokeLines);     // 笔划 z = 0.1
scene.add(previewLine);     // 预览 z = 0.05
```

### 笔划渲染
- **预览笔划**: TubeGeometry, z = 0.05, opacity = 0.6
- **最终笔划**: TubeGeometry, z = 0.1, opacity = 1.0
- **Tube几何**: 跨缩放级别保持一致的线宽
- **材质复用**: 性能优化

### 坐标系统
1. **屏幕坐标**: 鼠标位置 (像素)
2. **世界坐标**: 通过 `screenToWorld()` 转换
3. **归一化坐标**: Three.js渲染使用

### 相机管理
- **宽高比校正**: 保持一致缩放
- **缩放限制**: 0.5x 到 5.0x
- **平移支持**: 相机位置调整
- **大小调整**: 窗口resize事件监听

## 文件格式规范

### 绘制数据结构
```json
{
  "version": "1.0.0",
  "timestamp": 1741593345678,
  "canvasState": {
    "strokes": [
      {
        "id": "stroke-123",
        "points": [{"x": 10, "y": 20, "timestamp": 1234567890}, ...],
        "smoothedPoints": [{"x": 10, "y": 20}, ...],
        "displayPoints": [{"x": 10, "y": 20}, ...],
        "color": "#000000",
        "thickness": 2,
        "timestamp": 1741593345678,
        "strokeType": "artistic",
        "brushType": "pencil",
        "brushSettings": {...},
        "isClosed": false,
        "cornerPoints": [...],
        "cornerIndices": [...],
        "segments": [...]
      }
    ],
    "canvasWidth": 100,
    "canvasHeight": 100,
    "zoom": 1,
    "panX": 0,
    "panY": 0,
    "strokeMode": "predict",
    "smoothEnabled": true
  }
}
```

### 笔划属性
| 属性 | 类型 | 描述 |
|------|------|------|
| `id` | string | 唯一笔划标识符 |
| `points` | Point[] | 原始捕获点 (含timestamp) |
| `smoothedPoints` | Point[] | Catmull-Rom平滑点 |
| `displayPoints` | Point[] | 形状预测点 (可选) |
| `color` | string | 十六进制颜色 |
| `thickness` | number | 笔划粗细 (像素) |
| `strokeType` | string | 'artistic' 或 'digital' |
| `brushType` | string | 艺术笔刷类型 |
| `brushSettings` | object | 笔刷配置 |
| `isClosed` | boolean | 是否形成封闭形状 |
| `cornerPoints` | Point[] | 检测到的特征点 |
| `cornerIndices` | number[] | 特征点索引 |

### 基准测试数据 (baseline/)
```
baseline/shapes/
├── angle/              # 角度测试用例
│   ├── manual_2026-03-11.json
│   ├── perfect_l_shape.json
│   └── perfect_v_shape.json
├── arc/                # 圆弧测试用例
├── circle/             # 圆形测试用例
│   ├── drawing_2026-03-14-A.json   # 手绘圆
│   ├── drawing_2026-03-14-B.json   # 手绘圆
│   ├── handdrawn_circle.json
│   ├── manual_2026-03-11.json
│   └── perfect_circle.json
├── ellipse/            # 椭圆测试用例
├── line/               # 直线测试用例
├── polygon/            # 多边形测试用例
│   ├── handdrawn_rhombus.json
│   └── handdrawn_trapezoid.json
├── rectangle/          # 矩形测试用例
│   ├── handdrawn_square.json
│   ├── manual_2026-03-11.json
│   ├── manual_2026-03-12-A.json
│   ├── manual_2026-03-14-A.json
│   ├── manual_2026-03-14-B.json
│   ├── perfect_rectangle.json
│   └── perfect_square.json
└── triangle/           # 三角形测试用例
    ├── handdrawn_isosceles.json
    ├── manual_2026-03-11-1.json
    ├── manual_2026-03-11-2.json
    ├── manual_2026-03-11-3.json
    ├── manual_2026-03-14.json
    └── perfect_right_angle.json
```

## 开发模式

### 组件架构
- **函数组件**: 使用 React.FC + TypeScript接口
- **解构Props**: 在组件顶部提取props
- **useRef用于Three.js**: 在refs中存储Three.js对象
- **useEffect清理**: 在useEffect返回中正确清理

### 状态管理模式
```typescript
// Zustand Store 模式
const useDrawingStore = create<DrawingState>()((set, get) => ({
  // State属性
  strokes: [],
  
  // 类immer更新
  addStroke: (stroke) =>
    set((state) => ({
      strokes: [...state.strokes, stroke],
      history: updateHistory(state)
    })),
    
  // 计算值选择器
  getSelectedStrokes: () => get().strokes.filter(s => ...)
}));
```

### Three.js最佳实践
1. **资源清理**: 总是销毁几何体和材质
2. **单一渲染循环**: 每个组件使用一个requestAnimationFrame
3. **坐标转换**: 一致使用 `screenToWorld()` 辅助函数
4. **Z深度层级**: 保持一致的深度排序
5. **几何更新**: 原地更新以避免闪烁

### 错误处理
- **优雅降级**: 处理Three.js上下文丢失
- **空值检查**: 操作前验证scene/renderer
- **边界检查**: 验证缩放级别和坐标
- **输入验证**: 清理画布坐标

### 性能指南
- **几何池**: 尽可能复用Three.js几何体
- **渲染优化**: 只更新变更的笔划几何体
- **内存管理**: 销毁未使用的Three.js资源
- **事件监听清理**: 在useEffect返回中移除监听器

### 测试策略
- **单元测试**: 测试形状预测算法
- **集成测试**: 测试绘制工作流
- **视觉测试**: 测试渲染一致性
- **性能测试**: 监控内存使用和帧率

## 扩展点

### 添加新工具
1. 添加工具类型到 `ToolCategory` 或 `ArtisticTool`/`DigitalTool` 枚举
2. 在store中更新工具特定状态
3. 在相关模块中创建工具实现
4. 在适当面板中添加UI控件
5. 如需，更新快捷键

### 添加新测量类型
1. 添加测量类型到 `MeasureTool` 枚举
2. 在 `measurements.ts` 中实现计算
3. 添加测量状态到store
4. 创建测量选择和显示的UI
5. 添加到数字模式工具集

### 添加新笔刷类型
1. 在 `brush/presets.ts` 中定义笔刷类型
2. 添加笔刷设置接口
3. 在笔刷模块中实现渲染
4. 更新艺术工具UI
5. 添加到笔划数据结构

### 添加新形状类型
1. 在 `ImprovedShapeType` 中添加类型
2. 在 `improvedClassifier.ts` 中实现评分器
3. 在 `generateShapePointsImproved` 中实现点生成
4. 在 `shapeSimilarity.ts` 中添加相似度验证
5. 添加基准测试用例到 `baseline/shapes/`

---

**版本**: 2026-03-14  
**最新更新**: 形状预测流水线改进，添加假角点处理和3角点验证