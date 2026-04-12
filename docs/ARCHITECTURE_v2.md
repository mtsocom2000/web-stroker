# Web Stroker 架构设计 v2.0

**版本**: 2.0  
**日期**: 2026-04-12  
**状态**: 重构完成 (Phases 1-5 ✅)

---

## 1. 系统概览

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19.2.0 |
| 语言 | TypeScript | 5.9.3 |
| 构建工具 | Vite | 7.2.4 |
| 状态管理 | Zustand | 4.4.0 |
| 3D 渲染 | Three.js | 0.128.0 |
| 测试框架 | Vitest | 4.0.18 |
| 空间索引 | RBush | 4.0.1 |

### 双模式架构

```
┌─────────────────────────────────────────────────────────┐
│                    Web Stroker                          │
├─────────────────────────────────────────────────────────┤
│  Artistic Mode          │  Digital Mode                │
│  - 自由手绘             │  - 精确几何绘制              │
│  - 笔刷：pencil/pen/brush/ballpen │  - 工具：line/circle/arc/curve │
│  - 模式：original/smooth/predict │  - 测量：distance/angle/radius/face │
│  - 形状预测识别         │  - 选择/拖拽编辑             │
└─────────────────────────────────────────────────────────┘
```

### 双渲染器支持

| 渲染器 | 技术 | 适用场景 |
|--------|------|----------|
| **Canvas2DRenderer** | HTML5 Canvas 2D API | 轻量级、UI 元素、网格/吸附指示器 |
| **WebGLRenderer** | Three.js + WebGL | 复杂场景、硬件加速、3D 扩展 |

**运行时切换**: 用户可通过 Toolbar 动态切换渲染器，状态自动同步。

---

## 2. 核心架构

### 架构分层

```
┌─────────────────────────────────────────────────────────┐
│              DrawingCanvas.tsx (419 行)                  │
│  - 事件路由 (根据 toolCategory 分发到 hooks)              │
│  - 2D UI 渲染 (网格、吸附指示器、测量预览)                │
│  - 渲染器/commander 初始化                                │
│  - 动画循环管理                                          │
└─────────────────────────────────────────────────────────┘
                            ↓ 事件路由
┌─────────────────────────────────────────────────────────┐
│              Hooks 层 (6 个专用 hooks)                     │
│  - useSnapSystem: 坐标转换 + 吸附检测                    │
│  - useSelectTool: 元素选择/拖拽                          │
│  - useMeasureTools: 测量工具逻辑                         │
│  - useArtisticDrawing: 艺术模式自由绘制                  │
│  - useDigitalDrawing: 数字模式精确绘制                   │
│  - useConstraints: 约束管理                             │
└─────────────────────────────────────────────────────────┘
                            ↓ 状态更新
┌─────────────────────────────────────────────────────────┐
│           DrawingStateManager (700 行)                    │
│  - 集中管理预览状态 (PreviewState)                       │
│  - 集中管理选择状态 (SelectionState)                     │
│  - 生成 RenderCommand[]                                  │
│  - syncFromStore: 与 Zustand store 同步                  │
└─────────────────────────────────────────────────────────┘
                            ↓ 渲染命令
┌─────────────────────────────────────────────────────────┐
│            DrawingCommander (213 行)                      │
│  - render(): 调用 stateManager.getRenderCommands()       │
│  - renderer.executeCommands(): 执行命令                  │
│  - 防止重入渲染 (isRendering 标志)                        │
│  - 便捷方法设置预览状态                                  │
└─────────────────────────────────────────────────────────┘
                            ↓ executeCommands
┌─────────────────────────────────────────────────────────┐
│              Renderer 接口 (83 行)                        │
│  - executeCommands(commands: RenderCommand[]): void     │
│  - 生命周期：initialize, dispose, resize, render        │
│  - 视图变换：setViewState, worldToScreen, screenToWorld │
│  - Legacy API: addStroke, updateDigitalXxxPreview 等    │
└─────────────────────────────────────────────────────────┘
                    ↓                    ↓
        Canvas2DRenderer (816 行)    WebGLRenderer (842 行)
```

### 代码统计

| 模块 | 文件 | 行数 | 职责 |
|------|------|------|------|
| **核心组件** | `DrawingCanvas.tsx` | 419 | 事件路由 + 2D UI 渲染 |
| **状态管理** | `store.ts` | ~600 | Zustand Store |
| **Hooks** | `hooks/*` | 879 | 6 个专用 hooks |
| **状态管理器** | `DrawingStateManager.ts` | 700 | 状态管理 + 命令生成 |
| **渲染编排** | `DrawingCommander.ts` | 213 | 渲染编排 |
| **渲染器接口** | `Renderer.ts` | 83 | 接口定义 |
| **Canvas2D 渲染** | `Canvas2DRenderer.ts` | 816 | 2D Canvas 实现 |
| **WebGL 渲染** | `WebGLRenderer.ts` | 842 | Three.js 实现 |
| **命令系统** | `RenderCommand.ts` | 353 | 命令类型定义 |

**重构成果**: DrawingCanvas 从 3130 行精简到 419 行 (-87%)

---

## 3. 数据流

### 3.1 用户交互流程

```
用户鼠标事件
    ↓
DrawingCanvas.handleMouseDown/Move/Up
    ↓
根据 toolCategory 路由到对应 hook
    ↓
hook 处理交互逻辑
    ↓
更新 store (通过 addStrokes 等 actions)
    ↓
useEffect 触发 commander 同步
    ↓
commander.render()
    ↓
renderer.executeCommands()
    ↓
屏幕渲染
```

### 3.2 渲染流程

```
Animation Frame (requestAnimationFrame)
    ↓
commander.render()
    ↓
stateManager.getRenderCommands()
    ↓
按 zIndex 排序命令
    ↓
renderer.executeCommands(commands)
    ↓
Canvas2D: clearCanvas → 遍历命令 → 绘制到 2D context
WebGL: beginFrame → 遍历命令 → 创建 Three.js 对象 → render()
```

### 3.3 状态同步流程

```
Zustand Store 变化
    ↓
useEffect 触发
    ↓
commander.syncFromStore(store)
    ↓
stateManager.syncFromStore(store)
    ↓
更新内部状态
    ↓
下次渲染时生效
```

---

## 4. 渲染系统

### 4.1 Renderer 接口设计

```typescript
interface Renderer {
  // 生命周期
  initialize(container: HTMLElement): void;
  dispose(): void;
  resize(): void;
  render(): void;
  
  // 视图状态
  setViewState(zoom: number, panX: number, panY: number): void;
  
  // 新架构核心：命令执行
  executeCommands(commands: RenderCommand[]): void;
  
  // Legacy API (向后兼容)
  addStroke(stroke: Stroke): void;
  removeStroke(strokeId: string): void;
  updateCurrentStroke(points: Point[], ...): void;
  // ... 17 个 legacy 方法
}
```

### 4.2 命令系统

**RenderCommand 类型**:

```typescript
type CommandType = 'stroke' | 'preview' | 'highlight' | 'indicator' | 'label' | 'closedArea';
type GeometryType = 'line' | 'circle' | 'arc' | 'bezier' | 'point' | 'polygon';

interface RenderCommand {
  type: CommandType;
  zIndex: number;
  style: RenderStyle;
  geometry: Geometry;
  strokeId?: string;
  segmentIndex?: number;
}
```

**Z-Index 层级**:

```
CLOSED_AREA: -5   // 背景填充
GRID: -1          // 网格线
STROKE: 0         // 最终笔划
PREVIEW: 10       // 绘制预览
HIGHLIGHT: 20     // 悬停/选中高亮
INDICATOR: 30     // 端点/控制点指示器
LABEL: 40         // 文本标签
UI: 50            // UI 元素
```

### 4.3 坐标转换

**统一工具函数** (`src/utils/coordinates.ts`):

```typescript
export function worldToScreen(point: Point, view: ViewState, width: number, height: number) {
  return {
    x: (point.x - view.panX) * view.zoom + width / 2,
    y: height / 2 - (point.y - view.panY) * view.zoom,
  };
}

export function screenToWorld(sx: number, sy: number, view: ViewState, width: number, height: number): Point {
  return {
    x: (sx - width / 2) / view.zoom + view.panX,
    y: (height / 2 - sy) / view.zoom + view.panY,
  };
}
```

两个渲染器和 DrawingCanvas 共享此工具，消除重复实现。

---

## 5. 模式详解

### 5.1 Artistic Mode (艺术模式)

**用途**: 自由手绘，支持自然笔触和自动形状识别

**工具**:
- `pencil`: 铅笔效果，较粗笔触
- `pen`: 钢笔效果，细线条
- `brush`: 毛笔效果，支持压感
- `ballpen`: 圆珠笔效果
- `eraser`: 橡皮擦（删除笔划）

**笔划模式**:
| 模式 | 说明 |
|------|------|
| `original` | 使用原始捕获点直接渲染 |
| `smooth` | Catmull-Rom 平滑曲线 |
| `predict` | 自动识别并纠正为几何形状 |

### 5.2 Digital Mode (数字模式)

**用途**: 精确几何绘制和测量

**绘制工具**:
| 工具 | 交互方式 |
|------|----------|
| `line` | 点击起点，拖拽到终点 |
| `circle` | 圆心 - 半径模式 / 三点模式 |
| `arc` | 圆心 + 半径 + 起止角度 |
| `curve` | Bezier 曲线，带控制点 |

**测量工具**:
| 工具 | 功能 |
|------|------|
| `distance` | 测量两点间距离或沿线长度 |
| `angle` | 测量两线间夹角 |
| `radius` | 测量圆/弧半径 |
| `face` | 计算封闭形状面积 |

**选择模式**:
- `point`: 选择端点/控制点
- `line`: 选择线段
- `arc`: 选择圆弧

### 5.3 模式切换

**快捷键**:
- `v`: 选择模式
- `d`: 绘制模式
- `m`: 测量模式

**状态持久化**: 当前模式保存在 store 中，切换工具时自动更新。

---

## 6. 形状预测流水线

### 6.1 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Predict Pipeline                     │
├─────────────────────────────────────────────────────────┤
│  Input: Point[] (原始轨迹点)                             │
│  Output: Point[] | null (预测形状点或 null)               │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 1: 特征分析 (analyzeShapeFeatures)                 │
│ • 计算转角 • 检测闭环 • 角点检测 • 曲率计算              │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 2: 分类评分 (classifyShapeImproved)                │
│ 11 个评分器：line/angle/triangle/rectangle/square/       │
│ circle/ellipse/arc/curve/polygon/polyline               │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 3: 评分排序与后处理                                │
│ 分数降序 + 平局打破规则 + 假角点处理                     │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 4: 形状点生成 (generateShapePointsImproved)        │
│ 根据形状类型生成标准化点集                               │
└─────────────────────────────────────────────────────────┘
```

### 6.2 形状类型

```typescript
type ImprovedShapeType =
  | 'line' | 'angle' | 'triangle' | 'rectangle' | 'square'
  | 'circle' | 'ellipse' | 'arc' | 'curve'
  | 'polygon' | 'polyline' | 'unknown';
```

### 6.3 关键算法

**角点检测** (`findCorners`):
- 自适应阈值：封闭图形 32°，开放图形 63°
- 距离合并：避免相邻角点
- 特殊处理：2 角点封闭形状强制添加起点

**闭环检测** (`detectClosedShape`):
```typescript
const isClosed = 
  distance < bboxSize * 0.25 ||           // 绝对距离
  distance < pathLength * 0.08 ||         // 相对路径长度
  distance / bboxSize < 0.10;             // 相对包围盒
```

**Triangle 验证**:
- 最小角度 ≥ 25°，最大角度 ≤ 160°
- 最多 1 个小角度 (<45°)
- 失败 → 假角点（可能是圆的绘制痕迹）

---

## 7. 状态管理

### 7.1 Store 结构

**核心状态**:
```typescript
interface DrawingState {
  // 工具类别
  toolCategory: 'artistic' | 'digital' | 'measure';
  
  // 单位系统
  unit: 'mm' | 'cm' | 'inch' | 'px';
  angleUnit: 'degree' | 'radian';
  pixelsPerUnit: number;
  
  // 数字工具
  digitalTool: 'line' | 'circle' | 'arc' | 'curve';
  digitalMode: 'select' | 'draw';
  
  // 测量工具
  measureTool: 'distance' | 'angle' | 'radius' | 'face' | null;
  
  // 笔划数据
  strokes: Stroke[];
  fillRegions: FillRegion[];
  
  // 画布状态
  zoom: number;  // 0.5-5.0
  panX: number;
  panY: number;
  
  // 选择状态
  selectedDigitalStrokeIds: string[];
  selectedElements: SelectableElement[];
  hoveredDigitalElement: DigitalElement | null;
  
  // 约束
  constraints: Constraint[];
  constraintManager: ConstraintManager;
  
  // 历史
  history: CanvasState[];
  historyIndex: number;
}
```

### 7.2 状态更新模式

- **不可变更新**: 总是返回新的状态对象
- **批量操作**: 使用 `addStrokesBatch` 处理多个笔划
- **历史集成**: 每次状态变更更新历史栈
- **选择更新**: 只更新相关状态部分

---

## 8. 扩展指南

### 8.1 添加新工具

1. **添加类型定义**到 `types.ts`:
   ```typescript
   type NewTool = 'tool1' | 'tool2';
   ```

2. **创建 hook** 处理交互逻辑:
   ```typescript
   // src/hooks/useNewTool.ts
   export function useNewTool({ renderer, commander, applySnap }) {
     // 实现交互逻辑
   }
   ```

3. **在 DrawingCanvas** 中添加事件路由:
   ```typescript
   if (store.newTool === 'xxx') handleNewToolEvents(e);
   ```

4. **在 Toolbar** 中添加 UI 控件

### 8.2 添加新命令类型

1. **添加命令类型**到 `RenderCommand.ts`:
   ```typescript
   type CommandType = 'stroke' | 'preview' | 'highlight' | 'indicator' | 'label' | 'closedArea' | 'newType';
   ```

2. **在 DrawingStateManager** 中生成新命令:
   ```typescript
   commands.push({ type: 'newType', zIndex: 60, style, geometry });
   ```

3. **在 Renderer** 中实现命令执行:
   ```typescript
   case 'newType':
     this.renderNewTypeCommand(command);
     break;
   ```

### 8.3 添加新渲染器

1. **实现 Renderer 接口**:
   ```typescript
   class CustomRenderer implements Renderer {
     initialize(container: HTMLElement): void { ... }
     executeCommands(commands: RenderCommand[]): void { ... }
     // ... 其他方法
   }
   ```

2. **在 Toolbar** 中添加切换选项

3. **测试**渲染一致性与性能

---

## 9. 已知限制与 TODO

### 9.1 已知限制

| 限制 | 影响 | 缓解方案 |
|------|------|----------|
| 每帧全量渲染 | 高 CPU 占用 | 未来实现差量渲染 |
| History 存储完整快照 | 内存增长 | 改用命令模式记录 diff |
| Renderer 保留 17 个 legacy 方法 | 接口臃肿 | 下一版本移除 |
| ConstraintManager 在 store 中 | 序列化问题 | 重构为纯函数 |

### 9.2 TODO

- [ ] 实现差量渲染（只渲染变化的部分）
- [ ] History 改用命令模式
- [ ] 清理 legacy API
- [ ] 添加 hooks 单元测试
- [ ] 约束功能完整实现（angle/radius enforcement）
- [ ] 3D 建模功能（拉伸/旋转/放样）

---

## 10. 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0 | 2026-04-12 | Phases 1-5 重构完成，文档更新 |
| 1.0 | 2026-03-29 | Phase 4-5 完成，DrawingCanvas 精简到 339 行 |
| 0.2 | 2026-03-15 | Phase 1-3 完成，命令系统建立 |
| 0.1 | 2026-03-01 | 初始架构设计 |

---

## 11. 参考文档

- `docs/ARCHITECTURE.md` - 详细架构设计（v1.0）
- `docs/REFACTORING_PLAN.md` - 重构计划（已标注完成情况）
- `docs/archive/` - 历史审查报告
- `SYSTEM_OVERVIEW.md` - 系统概览

---

**维护者**: Development Team  
**最后更新**: 2026-04-12
