# Web Stroker 架构审查与改进计划

> 版本：2026-03-15  
> 审查范围：渲染器架构、状态管理、性能瓶颈、代码质量

---

## 目录

1. [架构总体评价](#架构总体评价)
2. [渲染器架构审查](#渲染器架构审查)
3. [状态管理审查](#状态管理审查)
4. [DrawingCanvas 组件审查](#drawingcanvas-组件审查)
5. [性能问题](#性能问题)
6. [代码质量问题](#代码质量问题)
7. [改进计划（可逐步实施）](#改进计划可逐步实施)

---

## 架构总体评价

### 优点

- **策略模式设计合理**：`Renderer` 接口的抽象做得好，`DrawingCanvas` 依赖接口而非具体实现，符合开闭原则。
- **坐标系统统一**：Canvas2D 和 WebGL 两个渲染器使用相同的 `worldToScreen` / `screenToWorld` 逻辑，避免坐标系不一致。
- **TypeScript 类型完整**：核心数据结构（`Stroke`, `Point`, `DigitalSegment`）类型定义清晰，强类型校验。
- **形状预测架构分层**：`predict/` 目录的多阶段分类器（分析 → 评分 → 点生成）职责分离清晰。
- **空间索引**：`IntersectionManager` 使用空间索引做交点检测，避免 O(n²) 暴力搜索。

### 明显问题

| 严重程度 | 问题 | 位置 |
|---|---|---|
| 🔴 严重 | 动画帧循环每帧对所有笔划调用 `addStroke/addDigitalStroke` | `DrawingCanvas.tsx:1134-1141` |
| 🔴 严重 | `DrawingCanvas` 单组件超过 3500 行，职责过重 | `DrawingCanvas.tsx` |
| 🟠 中等 | `Canvas2DRenderer` 接口方法大量为空实现（no-op） | `Canvas2DRenderer.ts` |
| 🟠 中等 | 渲染器切换时无 dispose + 重建逻辑 | `DrawingCanvas.tsx:1096-1113` |
| 🟠 中等 | `removeDigitalStroke` 用 `scene.traverse` 遍历（O(n)） | `WebGLRenderer.ts:514` |
| 🟡 轻微 | Store 中 `mode` 和 `digitalMode` 冗余，`DrawingMode` 重复定义 | `store.ts:16-18` |
| 🟡 轻微 | 两个渲染器各自维护 `worldToScreen` 副本，逻辑重复 | `Canvas2DRenderer.ts:79`, `WebGLRenderer.ts:145` |
| 🟡 轻微 | `BrushRenderer` 是独立的原始 WebGL 实现，游离于 Renderer 接口之外 | `brush/brushRenderer.ts` |

---

## 渲染器架构审查

### 当前架构

```
DrawingCanvas (3500行)
  ├── canvasRef (2D Canvas 用于网格/UI/测量)
  ├── rendererRef (Renderer接口 → Canvas2D或WebGL)
  └── rAF循环：每帧调用 renderer.addStroke(所有笔划)
```

### 问题 1：rAF 循环里每帧 `addStroke` 全量同步 🔴

**位置**：`DrawingCanvas.tsx:1131-1163`

```typescript
const animate = () => {
  if (rendererRef.current) {
    // 🔴 每帧对所有笔划都调用 addStroke —— 无论是否有变化
    strokesRef.current.forEach(stroke => {
      rendererRef.current!.addStroke(stroke);  // addStroke 内部先 removeStroke 再重建
    });
    rendererRef.current.render();
  }
  animationFrameRef.current = requestAnimationFrame(animate);
};
```

**影响**：100 个笔划 → 每帧 100 次 `removeStroke + addStroke` → 大量无效的 Three.js 几何体创建/销毁 → GC 压力、帧率下降。

**根因**：渲染器没有"已渲染集合"的持久记录，无法判断哪些是新增的。

> 注：`WebGLRenderer.addStroke` 内部已通过 `renderedArtisticIds: Set<string>` 做了幂等保护，但这个 Set 只用于防重复，并不阻止每帧的全量遍历本身。

**修复方向**：在 `DrawingCanvas` 层维护一个 `renderedIds: Set<string>`，只对差量（新增/删除）调用渲染器方法。

---

### 问题 2：Canvas2DRenderer 有大量 no-op 实现 🟠

`Canvas2DRenderer` 实现了 `Renderer` 接口，但超过一半的方法是空的：

```typescript
// Canvas2DRenderer.ts
addStroke(_stroke: Stroke): void { /* 空 */ }
removeStroke(_strokeId: string): void { /* 空 */ }
clearStrokes(): void { /* 空 */ }
updateCurrentStroke(_points: Point[], ...): void { /* 空 */ }
finalizeCurrentStroke(_strokeId: string): void { /* 空 */ }
addDigitalStroke(_stroke: Stroke): void { /* 空 */ }
removeDigitalStroke(_strokeId: string): void { /* 空 */ }
clearDigitalPreviews(): void { /* 空 */ }
clearHighlights(): void { /* 空 */ }
```

**根因**：`Canvas2DRenderer` 不是真正的持久化渲染器——它在 `DrawingCanvas` 的主 `render()` 函数里直接绘制（2D Canvas 的即时模式），而不是通过渲染器接口的增量方法。这导致接口契约形同虚设。

**真实渲染路径**（Canvas2D 模式）：
```
rAF → render() → ctx.drawXxx(所有笔划)    ← 实际渲染
rAF → rendererRef.addStroke(...)           ← no-op，啥都没干
```

**影响**：
- 接口对 Canvas2D 渲染器实际上是装饰性的，增加混淆
- `Canvas2DRenderer` 的实际有用方法（`getContext()`, `clearCanvas()`）不在接口里
- 违反"接口隔离"原则：实现了一堆它用不到的方法

---

### 问题 3：渲染器切换逻辑不健壮 🟠

**位置**：`DrawingCanvas.tsx:1096-1113`

```typescript
useEffect(() => {
  if (!rendererRef.current) {  // ← 只在 null 时初始化，不处理切换
    if (store.renderer === 'threejs') {
      rendererRef.current = new WebGLRenderer();
    } else {
      rendererRef.current = new Canvas2DRenderer();
    }
    rendererRef.current.initialize(container);
  }
  // ...
}, [render, store.renderer, store.zoom, store.panX, store.panY]);
```

**问题**：
1. `store.renderer` 在依赖数组里，但 effect 内部用 `if (!rendererRef.current)` 保护，导致切换时实际上不会重新初始化
2. 旧渲染器的 `dispose()` 没有被显式调用
3. 切换渲染器后，原有笔划没有被同步到新渲染器

---

### 问题 4：`removeDigitalStroke` 使用 `scene.traverse` 🟠

**位置**：`WebGLRenderer.ts:514`

```typescript
removeDigitalStroke(strokeId: string): void {
  const objectsToRemove: THREE.Object3D[] = [];
  this.scene.traverse((obj) => {  // 🟠 遍历整个场景图
    if (obj.userData?.strokeId === strokeId && obj.userData?.type === 'digital') {
      objectsToRemove.push(obj);
    }
  });
  // ...
}
```

`scene.traverse` 是 O(n) 遍历，场景中对象越多越慢。应该用 `Map<strokeId, THREE.Object3D[]>` 直接查找，像 `strokeMeshes` 那样。

---

### 问题 5：`BrushRenderer` 游离于接口体系之外 🟡

`src/brush/brushRenderer.ts` 是一个完全独立的原始 WebGL 2 渲染器（自写 shader，自管 VAO/VBO），用于笔刷印章渲染。它不实现 `Renderer` 接口，也不被任何渲染器调用——实际上是"第三个渲染器"，但没有被架构化。

---

### 问题 6：两个渲染器各自维护 `worldToScreen` 副本 🟡

`Canvas2DRenderer.ts:79-84` 和 `WebGLRenderer.ts:145-155` 的 `worldToScreen` 实现是一模一样的代码：

```typescript
// 完全相同的逻辑复制了两次
x: (point.x - this.viewState.panX) * this.viewState.zoom + width / 2,
y: height / 2 - (point.y - this.viewState.panY) * this.viewState.zoom
```

同时，`DrawingCanvas.tsx:223-245` 里还有第三份相同逻辑的 `worldToScreen` / `screenToWorld` 副本。

---

## 状态管理审查

### 问题 1：`mode` 与 `digitalMode` 冗余 🟡

```typescript
// store.ts 中存在两个几乎相同的模式类型定义
type DrawingMode = 'select' | 'draw';   // line 16
type DigitalMode = 'select' | 'draw';   // line 18 - 完全一样！

mode: DrawingMode;        // 注释为 "for backward compatibility"
digitalMode: DigitalMode; // 实际使用的
```

`mode` 带有 "legacy - for backward compatibility" 注释但仍在使用，造成混淆。

### 问题 2：History 只保存 strokes，不保存 fillRegions 🟡

```typescript
interface CanvasState {
  strokes: Stroke[];    // ✅ 保存
  // fillRegions 没有！undo 后填充区域会丢失
}
```

`clearStrokes()` 会清掉 `fillRegions`（store.ts:445），但 undo 不会恢复它们。

### 问题 3：brush presets 硬编码在 store 里 🟡

```typescript
// store.ts:539-544 - 笔刷 preset 数据硬编码在 setBrushType action 里
const presets = {
  pencil: { type: 'pencil', size: 2, opacity: 0.9, ... },
  pen: { type: 'pen', size: 1.5, opacity: 0.85, ... },
  // ...
};
```

这些数据与 `brush/presets.ts` 里的定义分离，存在重复维护风险。

### 问题 4：`getDigitalSegments` 是空实现 🟡

```typescript
// store.ts:623-626
getDigitalSegments: () => {
  const segments: DigitalSegment[] = [];
  return segments;  // 永远返回空数组！
},
```

这个方法完全是废代码。

---

## DrawingCanvas 组件审查

### 核心问题：单组件 3500 行，职责爆炸

`DrawingCanvas.tsx` 当前承担了：

1. **渲染器生命周期管理**（初始化、切换、dispose）
2. **rAF 动画循环 + 2D Canvas 即时渲染**
3. **艺术模式**：鼠标事件、笔划点收集、平滑、形状预测
4. **数字模式**：直线/圆/弧/贝塞尔的完整交互状态机（超过 10 个 useState）
5. **测量工具**：距离/角度/半径/面积的交互逻辑
6. **选择和拖拽**：端点拖拽、笔划选择、批量移动
7. **吸附系统**：网格、端点、交点吸附计算
8. **填充区域**：`ClosedAreaManager` 集成
9. **几何相交计算**：`IntersectionManager` 集成

**状态变量统计**：
- `useState`: 20+ 个
- `useRef`: 10+ 个
- `useCallback`: 15+ 个
- `useEffect`: 8+ 个

这违反了单一职责原则，导致：
- 每次 `useState` 更新都可能触发超大 `useCallback` 的重新计算
- 难以测试单个功能
- `render` useCallback 的依赖数组有 20+ 项（line 1039）

---

## 性能问题

### P1：每帧全量笔划同步（已在渲染器审查中详述）

60fps × 全量遍历 = 高 CPU 占用，即使画面静止也不停计算。

### P2：`render` useCallback 依赖数组过长

```typescript
// DrawingCanvas.tsx:1039
}, [currentStrokePoints, store.currentColor, store.currentBrushSettings.size, 
    store.currentBrushSettings.opacity, worldToScreen, store.toolCategory, 
    store.digitalMode, store.digitalTool, store.mode, hoveredDigitalElement, 
    selectedDigitalElements, digitalLinePoints, digitalLinePreviewEnd, 
    circleCenter, circleRadiusPoint, circlePoints, arcPoints, arcRadiusPoint, 
    curvePoints, store.circleCreationMode, lastMousePosRef, store.strokes, store.renderer]);
```

20+ 依赖 → 几乎任何操作都会让这个函数重新创建。

### P3：HistoryStack 存储完整 Stroke[] 快照

每次 addStroke 都复制整个 `strokes` 数组到 history 里。100 个笔划 × 多次操作 = 内存快速增长。应改用命令模式（只记录 diff）。

### P4：`console.log` 生产代码中未移除

```typescript
// DrawingCanvas.tsx:130-136
console.log('[face] setStrokes immediate', {
  strokes: store.strokes.length,
  // ...
});
```

rAF 附近的 log 会显著影响性能。

### P5：`WebGLRenderer` instancing 逻辑有缺陷

```typescript
// WebGLRenderer.ts:178
if (this.useInstancing && points.length <= 100) {
  this.addStrokeToBatch(stroke, points);
} else {
  // 用 TubeGeometry
}
```

Instancing 使用 `CylinderGeometry`（每段一个圆柱），而非 instancing 路径下也会创建 TubeGeometry，两者渲染质量不一致（instancing 路径是方形连接，tube 路径是圆滑管道）。阈值 `<= 100` 点的依据也不明确。

---

## 代码质量问题

### 重复的几何绘制函数

在 `DrawingCanvas.tsx` 里有多套独立的局部 draw 函数（`drawDigitalLine`, `drawDigitalArc`, `drawDigitalBezier`, `drawEndpointIndicator` 等），这些和 `Canvas2DRenderer` 里的实现存在逻辑重复，本应复用渲染器。

### `shapePredict.ts`（旧版）与 `predict/`（新版）并存

`src/shapePredict.ts` 是旧版形状识别，`src/predict/` 是重构后的版本。两者同时存在，旧版的 `detectStraightLine`, `detectPolyline` 等函数可能仍被部分代码引用，造成维护负担。

---

## 改进计划（可逐步实施）

以下计划按优先级排序，每个 Phase 可独立实施，互不依赖。

---

### Phase 1：修复关键性能 Bug（1-2天）

**目标**：消除每帧全量同步的性能瓶颈。

#### 1.1 实现差量笔划同步

在 `DrawingCanvas` 的 rAF 循环里改为差量更新：

```typescript
// 在组件层维护已同步的 Set
const syncedStrokeIdsRef = useRef<Set<string>>(new Set());

const animate = () => {
  if (rendererRef.current) {
    const currentIds = new Set(strokesRef.current.map(s => s.id));
    
    // 新增笔划
    strokesRef.current.forEach(stroke => {
      if (!syncedStrokeIdsRef.current.has(stroke.id)) {
        stroke.strokeType === 'digital'
          ? rendererRef.current!.addDigitalStroke(stroke)
          : rendererRef.current!.addStroke(stroke);
        syncedStrokeIdsRef.current.add(stroke.id);
      }
    });
    
    // 删除笔划
    syncedStrokeIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        rendererRef.current!.removeStroke(id);
        rendererRef.current!.removeDigitalStroke(id);
        syncedStrokeIdsRef.current.delete(id);
      }
    });
    
    rendererRef.current.updateCurrentStroke(/* ... */);
    rendererRef.current.render();
  }
  render();
  animationFrameRef.current = requestAnimationFrame(animate);
};
```

**验证**：Chrome DevTools Performance 面板，确认每帧调用次数从 O(n) 降到 O(diff)。

#### 1.2 移除生产环境 console.log

搜索并删除所有 `console.log('[face]', ...)` 调用，或替换为条件编译的 debug log。

---

### Phase 2：修复渲染器切换逻辑（1天）

**目标**：让 canvas2d ↔ threejs 切换正确 dispose 旧渲染器并同步状态。

```typescript
// DrawingCanvas.tsx 中改造 renderer 初始化 effect
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  // 1. Dispose 旧渲染器
  if (rendererRef.current) {
    rendererRef.current.dispose();
    rendererRef.current = null;
    syncedStrokeIdsRef.current.clear();  // 清空同步缓存
  }

  // 2. 创建新渲染器
  const renderer = store.renderer === 'threejs'
    ? new WebGLRenderer()
    : new Canvas2DRenderer();
  renderer.initialize(container);
  renderer.setViewState(store.zoom, store.panX, store.panY);
  rendererRef.current = renderer;

  // 3. 同步当前所有笔划到新渲染器
  strokesRef.current.forEach(stroke => {
    stroke.strokeType === 'digital'
      ? renderer.addDigitalStroke(stroke)
      : renderer.addStroke(stroke);
    syncedStrokeIdsRef.current.add(stroke.id);
  });

}, [store.renderer]);  // 只依赖 renderer 类型
```

---

### Phase 3：修复 WebGLRenderer 中的 `removeDigitalStroke` 🟠（半天）

**目标**：把 O(n) 遍历改为 O(1) Map 查找。

```typescript
// WebGLRenderer.ts 增加
private digitalStrokeMeshes: Map<string, THREE.Object3D[]> = new Map();

addDigitalStroke(stroke: Stroke): void {
  this.removeDigitalStroke(stroke.id);  // 幂等
  const objects: THREE.Object3D[] = [];
  // ... 创建几何体 ...
  objects.forEach(obj => this.scene!.add(obj));
  this.digitalStrokeMeshes.set(stroke.id, objects);  // 记录
}

removeDigitalStroke(strokeId: string): void {
  const objects = this.digitalStrokeMeshes.get(strokeId);
  if (!objects) return;
  objects.forEach(obj => {
    this.scene!.remove(obj);
    // dispose geometry/material
  });
  this.digitalStrokeMeshes.delete(strokeId);
}
```

---

### Phase 4：坐标转换工具函数提取（半天）

**目标**：消除三处重复的 `worldToScreen` / `screenToWorld` 逻辑。

新建 `src/utils/coordinates.ts`：

```typescript
export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

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

两个渲染器和 `DrawingCanvas` 都使用此函数，消除重复。

---

### Phase 5：DrawingCanvas 拆分（3-5天）

**目标**：将 3500 行的 God Component 拆分为职责单一的单元。

**建议拆分方向**：

```
src/
├── hooks/
│   ├── useRenderer.ts          # 渲染器生命周期：初始化、切换、dispose、rAF
│   ├── useArtisticDrawing.ts   # 艺术模式：点收集、平滑、形状预测
│   ├── useDigitalDrawing.ts    # 数字模式：直线/圆/弧/贝塞尔状态机
│   ├── useMeasureTools.ts      # 测量工具：距离/角度/半径/面积
│   ├── useDigitalSelection.ts  # 选择/拖拽：端点拖拽、批量移动
│   └── useSnapSystem.ts        # 吸附：网格/端点/交点
├── components/
│   └── DrawingCanvas.tsx       # 只负责：挂载 div、事件路由、调用 hooks
```

**拆分优先级**（建议顺序）：

1. `useRenderer` —— 最独立，影响面最小
2. `useSnapSystem` —— 纯计算，无 UI 副作用
3. `useMeasureTools` —— 相对独立
4. `useArtisticDrawing` —— 核心功能之一
5. `useDigitalDrawing` —— 最复杂，留到最后

---

### Phase 6：重构 Canvas2DRenderer 接口职责（2天）

**目标**：让两个渲染器都真正实现接口契约，消除 no-op 方法。

**方案 A（推荐）**：拆分接口，Canvas2DRenderer 只实现它真正能做的子集

```typescript
// 新增子接口
interface UIRenderer {
  // 只有 Canvas2D 需要实现的方法：坐标转换、指示器、高亮
  worldToScreen(point: Point): { x: number; y: number };
  screenToWorld(x: number, y: number): Point;
  clearCanvas(): void;
  getContext(): CanvasRenderingContext2D | null;
}

interface SceneRenderer {
  // WebGL 需要实现的方法：持久化笔划管理
  addStroke(stroke: Stroke): void;
  removeStroke(strokeId: string): void;
  // ...
}
```

**方案 B**：把 Canvas2DRenderer 的实际职责（即时绘制 UI）从 `Renderer` 接口分离，明确两个渲染器的用途差异。Canvas2D 专注 UI 层（网格、快照、测量指示），WebGL 专注笔划/几何层。

---

### Phase 7：History 改用命令模式（3天）

**目标**：解决 History 内存占用随笔划数量线性增长的问题。

**现状**：
```typescript
// 每次操作都保存完整快照
history: CanvasState[]  // 每个 CanvasState 包含完整的 Stroke[]
```

**改进**：
```typescript
type Command = 
  | { type: 'ADD_STROKE'; stroke: Stroke }
  | { type: 'REMOVE_STROKE'; id: string; stroke: Stroke }  // 记录原始数据用于 undo
  | { type: 'UPDATE_STROKE'; id: string; before: Stroke; after: Stroke }
  | { type: 'BATCH_ADD'; strokes: Stroke[] }
  | { type: 'CLEAR'; strokes: Stroke[] };  // 记录清除前的所有笔划

// store.ts
history: Command[];
historyIndex: number;

// undo: 反向执行 command
// redo: 正向执行 command
```

**好处**：
- 内存占用从 O(n × ops) 降到 O(ops)（每个 command 只记录 diff）
- `fillRegions` 可以一并加入命令系统

---

### Phase 8：清理遗留代码（1天）

1. **删除 `src/shapePredict.ts`（旧版）**，统一到 `src/predict/`
2. **删除 `store.ts` 中的 `mode` 字段**（已有 `digitalMode` 替代），修复所有引用
3. **删除空实现的 `getDigitalSegments`**（永远返回空数组）
4. **移除 `DrawingMode` 类型定义**（与 `DigitalMode` 完全重复）
5. **统一 brush preset 到 `brush/presets.ts`**，`store.ts` 中的 `setBrushType` 从 presets 文件读取

---

## 改进计划总览

| Phase | 工作量 | 收益 | 风险 |
|---|---|---|---|
| P1：差量笔划同步 | 1天 | 🔥 高（帧率提升） | 低 |
| P2：渲染器切换修复 | 1天 | 中（切换稳定性） | 低 |
| P3：removeDigitalStroke O(1) | 半天 | 中（大场景性能） | 低 |
| P4：坐标工具函数提取 | 半天 | 低（代码整洁） | 低 |
| P5：DrawingCanvas 拆分 | 3-5天 | 🔥 高（可维护性） | 中 |
| P6：Canvas2DRenderer 接口重构 | 2天 | 中（接口清晰） | 中 |
| P7：History 命令模式 | 3天 | 中（内存优化） | 高 |
| P8：遗留代码清理 | 1天 | 低（代码整洁） | 低 |

**建议执行顺序**：P1 → P2 → P3 → P4 → P8 → P5 → P6 → P7

- P1-P4 是独立的小修复，可以快速合并，立竿见影
- P5 是最高价值改进，应在 P1-P4 稳定后进行
- P7 风险最高（会改变 store 的核心契约），放在最后

---

## 附录：待确认的设计决策

1. **为什么需要双渲染器？** Canvas2D 渲染器的主要价值在于"调试/低端设备回退"还是"生产使用"？如果只是回退，可以简化接口契约。

2. **BrushRenderer 的归属**：`brush/brushRenderer.ts` 的原始 WebGL 实现应该被集成到 `WebGLRenderer`（通过扩展），还是保持独立？目前它没有被任何渲染器使用。

3. **数字笔划的持久化格式**：每个线段被存为独立 Stroke（每条线一个 Stroke），vs 一个多段线 Stroke（一个 Stroke 包含多个 DigitalSegment）。两种模型在代码中同时存在，需要明确统一。
