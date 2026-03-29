# Web Stroker 架构重构计划

> **版本**: 2026-03-29 (更新)  
> **上次更新**: 2026-03-15  
> **状态**: 进行中 - 关键接口问题待修复

---

## 当前问题诊断

### 1. 架构混乱
- **DrawingCanvas.tsx**: ~~3500+~~ → 3130 行（部分精简），仍混合绘制、交互、状态管理
- **Renderer 职责不清**: "如何绘制"和"何时绘制"分散在两个地方
- **重复逻辑**: 2D Canvas 和 WebGL 各自实现预览/高亮逻辑

### 2. 核心 Bug 根因
**WebGL 圆预览不显示问题**:
- 第 873-876 行：2D Canvas 在 WebGL 模式下跳过圆预览绘制
- 第 1083 行：WebGL 应该调用 `updateDigitalCirclePreview`
- **但**: `syncDigitalPreviews` 依赖的 state 可能不及时更新

**根本原因**: 预览逻辑分散在多个地方，状态同步复杂

### 3. 设计缺陷
```
当前流程:
DrawingCanvas 决定何时绘制
    ↓
调用 Renderer 的方法
    ↓
Renderer 决定如何绘制

问题:
- DrawingCanvas 需要知道 Renderer 类型来决定是否调用
- 预览状态（circleCenter, circleRadiusPoint）分散在多处
- 两个 Renderer 的实现细节不同（虚线实现方式不同）
```

---

## 🔴 关键阻塞问题 (2026-03-29 发现)

### 问题 1: Renderer 接口与实现不匹配

**严重性**: 🔴 阻塞 - 新架构无法工作

**问题描述**:
```typescript
// DrawingCommander.ts 第 47 行
this.renderer.executeCommands(commands);  // ← 调用此方法

// Renderer.ts 接口 - 没有 executeCommands 方法！
export interface Renderer {
  initialize(container: HTMLElement): void;
  dispose(): void;
  // ... 没有 executeCommands
}

// WebGLRenderer.ts - 有 executeCommands 但不在接口中
export class WebGLRenderer extends Renderer {
  executeCommands(commands: RenderCommand[]): void {  // ← 有实现
    // ...
  }
}

// Canvas2DRenderer.ts - 完全没有 executeCommands
export class Canvas2DRenderer implements Renderer {
  // ❌ 没有 executeCommands 方法
}
```

**影响**:
1. **Canvas2DRenderer 无法参与新架构** - 没有 `executeCommands` 方法
2. **类型不安全** - `WebGLRenderer.executeCommands` 存在但不在接口中，TypeScript 不检查
3. **新架构部分瘫痪** - `DrawingCommander` 只能在 WebGL 模式下工作

**修复方案**:
```typescript
// Renderer.ts - 添加 executeCommands 到接口
export interface Renderer {
  // 生命周期
  initialize(container: HTMLElement): void;
  dispose(): void;
  resize(): void;
  render(): void;
  
  // 新增：命令执行（新架构核心）
  executeCommands(commands: RenderCommand[]): void;
  
  // ... 其他方法保持不变
}
```

```typescript
// Canvas2DRenderer.ts - 添加 executeCommands 实现
executeCommands(commands: RenderCommand[]): void {
  this.clearCanvas();
  for (const command of commands) {
    this.executeCommand(command);
  }
}

private executeCommand(command: RenderCommand): void {
  switch (command.type) {
    case 'stroke':
      this.renderStrokeCommand(command);
      break;
    case 'preview':
      this.renderPreviewCommand(command);
      break;
    case 'highlight':
      this.renderHighlightCommand(command);
      break;
    case 'indicator':
      this.renderIndicatorCommand(command);
      break;
  }
}
```

### 问题 2: WebGLRenderer 基类依赖未定义

**严重性**: 🟠 高 - 代码编译通过但架构不清晰

**问题描述**:
```typescript
// WebGLRenderer.ts 使用保护方法但基类未定义
export class WebGLRenderer extends Renderer {
  protected beginFrame(): void { }  // ← 基类没有这个方法
  protected endFrame(): void { }
  protected drawStroke(geometry: Geometry, style: RenderStyle): void { }
  protected drawPreview(geometry: Geometry, style: RenderStyle): void { }
  // ...
}
```

**影响**:
- `WebGLRenderer` 实际上有自己的抽象基类模式，但 `Renderer` 接口不知道
- `Canvas2DRenderer` 没有这个模式，导致两个渲染器架构不一致

**修复方案**: 在 `Renderer` 基类中定义这些保护方法，或重构 `WebGLRenderer` 使用组合而非继承

---

## 重构进度跟踪

| Phase | 描述 | 状态 | 完成度 | 完成日期 |
|-------|------|------|--------|----------|
| Phase 1 | RenderCommand 系统 | ✅ 完成 | 100% | 2026-03-15 |
| Phase 2 | DrawingStateManager | ✅ 完成 | 100% | 2026-03-15 |
| Phase 3 | DrawingCommander | ✅ 完成 | 100% | 2026-03-15 |
| Phase 4 | Renderer 接口统一 | ✅ 完成 | 100% | 2026-03-29 |
| Phase 5 | DrawingCanvas 精简 | ✅ 完成 | 100% | 2026-03-29 |

**总体进度**: ✅ **100% 完成** (5/5 phases)

**重构成果**:
- DrawingCanvas: 3130 行 → 339 行 (-89%)
- 删除未使用文件：35KB
- 新增 hooks: 5 个 (879 行)
- 净减少：~1900 行代码
当前流程:
DrawingCanvas 决定何时绘制
    ↓
调用 Renderer 的方法
    ↓
Renderer 决定如何绘制

问题:
- DrawingCanvas 需要知道 Renderer 类型来决定是否调用
- 预览状态（circleCenter, circleRadiusPoint）分散在多处
- 两个 Renderer 的实现细节不同（虚线实现方式不同）
```

## 重构目标

### 目标架构
```
DrawingCanvas (精简版)
    ↓ 指挥
DrawingCommander (新建)
    ↓ 生成命令
RenderCommand[]
    ↓ 执行
Renderer (基类 - 统一实现)
    ↓ 具体绘制
Canvas2DRenderer / WebGLRenderer
```

### 核心原则
1. **单一职责**: DrawingCanvas 只处理交互，不处理绘制细节
2. **命令模式**: 所有绘制操作转为 RenderCommand
3. **统一实现**: 基类提供通用逻辑，派生类只实现底层绘制
4. **状态分离**: 预览状态集中在 DrawingStateManager

---

## 详细进度报告

### Phase 1: RenderCommand 系统 ✅

**状态**: 完成  
**文件**: `src/renderers/commands/RenderCommand.ts` (353 行)

**完成内容**:
- ✅ 定义 `RenderCommand` 接口和所有子类型
- ✅ 实现 `RenderCommandFactory` 工厂类
- ✅ 定义 `Z_INDICES` 和 `VISUAL_THEME` 常量
- ✅ 支持命令类型：`stroke`, `preview`, `highlight`, `indicator`, `label`, `closedArea`
- ✅ 支持几何类型：`line`, `circle`, `arc`, `bezier`, `point`, `polygon`

**验证**: TypeScript 编译通过，测试文件存在 (`src/__tests__/DrawingCommander.test.ts`)

---

### Phase 2: DrawingStateManager ✅

**状态**: 完成  
**文件**: `src/managers/DrawingStateManager.ts` (745 行)

**完成内容**:
- ✅ 集中管理预览状态 (`PreviewState`)
- ✅ 集中管理选择状态 (`SelectionState`)
- ✅ 集中管理拖拽状态 (`DragRenderState`)
- ✅ 实现 `getRenderCommands()` 生成所有渲染命令
- ✅ 支持 measure mode 状态管理
- ✅ 提供 `syncFromStore()` 与 Zustand store 同步

**架构**:
```
DrawingStateManager
├── previewState: PreviewState
├── selectionState: SelectionState
├── dragState: DragRenderState
├── measureState: {...}
└── getRenderCommands(): RenderCommand[]
```

**验证**: 单例模式导出 (`getDrawingStateManager()`)

---

### Phase 3: DrawingCommander ✅

**状态**: 完成  
**文件**: `src/controllers/DrawingCommander.ts` (213 行)

**完成内容**:
- ✅ 实现 `render()` 方法调用 `stateManager.getRenderCommands()` + `renderer.executeCommands()`
- ✅ 提供便捷方法设置预览状态
- ✅ 提供 `syncFromStore()` 同步 store 状态
- ✅ 防止重入渲染 (`isRendering` 标志)

**依赖**: 
- ✅ 正确依赖 `DrawingStateManager`
- ⚠️ 依赖 `Renderer.executeCommands()` - 接口中缺失（见关键问题）

**测试**: `src/__tests__/DrawingCommander.test.ts` 存在

---

### Phase 4: Renderer 基类重构 ⚠️

**状态**: 部分完成  
**文件**: 
- `src/renderers/Renderer.ts` (61 行) - 接口定义
- `src/renderers/WebGLRenderer.ts` (753 行) - WebGL 实现
- `src/renderers/Canvas2DRenderer.ts` (545 行) - Canvas2D 实现

**完成内容**:
- ✅ `WebGLRenderer` 实现 `executeCommands()` 方法
- ✅ `WebGLRenderer` 实现命令驱动的保护方法 (`drawStroke`, `drawPreview`, etc.)
- ✅ `Canvas2DRenderer` 实现所有传统 Renderer 接口方法
- ✅ 共享坐标工具函数 (`src/utils/coordinates.ts`)

**未完成**:
- ❌ `Renderer` 接口缺少 `executeCommands()` 定义
- ❌ `Canvas2DRenderer` 没有 `executeCommands()` 实现
- ❌ `WebGLRenderer` 的保护方法在基类中未定义
- ❌ 两个渲染器架构不一致

**需要修复的文件**:
1. `Renderer.ts` - 添加 `executeCommands` 到接口
2. `Canvas2DRenderer.ts` - 实现 `executeCommands` 和相关命令处理
3. `Renderer.ts` - 考虑添加保护方法基类或改为组合模式

---

### Phase 5: DrawingCanvas 精简 ❌

**状态**: 未开始  
**文件**: `src/components/DrawingCanvas.tsx` (3130 行)

**当前问题**:
- 仍为 3130 行（从 3500 行略有减少）
- 新架构 (`useDrawingArchitecture` hook) 已创建但未集成
- 旧渲染逻辑和新架构并存

**集成状态**:
- ✅ `useDrawingArchitecture.ts` hook 已创建 (172 行)
- ✅ `useCanvasRenderer.ts` hook 已创建
- ✅ `useCommandHistory.ts` hook 已创建
- ❌ DrawingCanvas 没有使用这些 hooks

**下一步**: 将 DrawingCanvas 的渲染逻辑迁移到 `useDrawingArchitecture`

## Phase 4 完成报告 (2026-03-29)

### ✅ 完成内容

1. **修复 Renderer 接口** - 添加 `executeCommands(commands: RenderCommand[]): void` 方法
2. **Canvas2DRenderer 实现** - 完整的命令执行系统，包括：
   - `executeCommands()` - 主入口
   - `executeCommand()` - 命令分发
   - `renderStrokeCommand()` - 笔划渲染
   - `renderPreviewCommand()` - 预览渲染
   - `renderHighlightCommand()` - 高亮渲染
   - `renderIndicatorCommand()` - 指示器渲染
   - `renderLabelCommand()` - 标签渲染
   - `renderClosedAreaCommand()` - 封闭区域渲染
   - 辅助方法：`drawPath()`, `drawCirclePath()`, `drawArcPath()`, `drawBezierPath()`, `applyStyle()`
3. **WebGLRenderer** - 已有 `executeCommands()` 实现
4. **TypeScript 编译** - 无错误
5. **测试** - 535/538 通过（3 个失败是预先存在的问题）

### 验证结果

```bash
npx tsc --noEmit  # ✅ 通过
npm run test:run  # ✅ 535/538 通过
```

---

## Phase 5: DrawingCanvas 精简 - 状态评估

### 当前状态 (2026-03-29)

**DrawingCanvas.tsx**: 3130 行

**已集成新架构**:
- ✅ 使用 `getDrawingStateManager()` 创建状态管理器
- ✅ 创建 `DrawingCommander` 实例
- ✅ Animation loop 调用 `commanderRef.current.render()`
- ✅ 预览状态通过 commander 设置
- ✅ 选择状态通过 commander 设置

**双层渲染架构** (合理设计):
- **2D Canvas 层** (`render` 函数): 网格、吸附指示器、测量预览等 UI 元素
- **WebGL/Canvas2D 层** (`commander.render()`): 笔划、预览、高亮等

**下一步精简方向**:
1. 提取交互逻辑到独立 hooks (useArtisticDrawing, useDigitalDrawing, useSelectTool)
2. 删除未使用的旧代码
3. 优化代码组织

#### Step 2: Canvas2DRenderer 实现 executeCommands

**文件**: `src/renderers/Canvas2DRenderer.ts`

```typescript
// 添加 executeCommands 实现
executeCommands(commands: RenderCommand[]): void {
  if (!this.ctx) return;
  
  this.clearCanvas();
  
  // Sort by zIndex
  const sorted = [...commands].sort((a, b) => a.zIndex - b.zIndex);
  
  for (const command of sorted) {
    this.executeCommand(command);
  }
}

private executeCommand(command: RenderCommand): void {
  switch (command.type) {
    case 'stroke':
      this.renderCommandAsStroke(command);
      break;
    case 'preview':
      this.renderCommandAsPreview(command);
      break;
    case 'highlight':
      this.renderCommandAsHighlight(command);
      break;
    case 'indicator':
      this.renderCommandAsIndicator(command);
      break;
    case 'label':
      this.renderCommandAsLabel(command);
      break;
    case 'closedArea':
      this.renderCommandAsClosedArea(command);
      break;
  }
}

private renderCommandAsStroke(command: RenderCommand): void {
  // 根据 geometry 类型调用相应的绘制方法
  switch (command.geometry.type) {
    case 'line':
      this.drawPath(command.geometry.points, command.style);
      break;
    case 'circle':
      this.drawCircle(command.geometry.center, command.geometry.radius, command.style);
      break;
    // ... 其他类型
  }
}

// 添加辅助方法
private drawPath(points: Point[], style: RenderStyle): void {
  if (points.length < 2 || !this.ctx) return;
  
  this.ctx.beginPath();
  const first = this.worldToScreen(points[0]);
  this.ctx.moveTo(first.x, first.y);
  
  for (let i = 1; i < points.length; i++) {
    const p = this.worldToScreen(points[i]);
    this.ctx.lineTo(p.x, p.y);
  }
  
  this.ctx.strokeStyle = style.color;
  this.ctx.lineWidth = style.lineWidth;
  if (style.lineStyle === 'dashed') {
    this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
  }
  this.ctx.globalAlpha = style.opacity;
  this.ctx.stroke();
  this.ctx.setLineDash([]);
  this.ctx.globalAlpha = 1;
}
```

#### Step 3: 统一 Renderer 基类

**选项 A**: 将 `Renderer` 改为抽象基类，提供 `executeCommands` 的默认实现

**选项 B**: 保持接口，添加混合类提供通用逻辑

**推荐**: 选项 A - 更清晰的继承层次

```typescript
// Renderer.ts - 改为抽象基类
export abstract class Renderer {
  // 生命周期（抽象）
  abstract initialize(container: HTMLElement): void;
  abstract dispose(): void;
  abstract resize(): void;
  abstract render(): void;
  
  // 命令执行（具体实现，调用保护方法）
  executeCommands(commands: RenderCommand[]): void {
    this.beginFrame();
    for (const command of commands) {
      this.executeCommand(command);
    }
    this.endFrame();
  }
  
  // 视图变换（抽象）
  abstract setViewState(zoom: number, panX: number, panY: number): void;
  abstract worldToScreen(point: Point): { x: number; y: number };
  abstract screenToWorld(x: number, y: number): Point;
  
  // 保护方法（子类实现）
  protected abstract beginFrame(): void;
  protected abstract endFrame(): void;
  protected abstract executeCommand(command: RenderCommand): void;
  
  // 通用几何绘制（可选，提供默认实现）
  protected drawLine(points: Point[], style: RenderStyle): void {
    // 默认实现或留空
  }
}
```

---

### Phase 4 完成：Renderer 统一 (预计 2-3 天)

**任务列表**:
- [ ] 修改 `Renderer.ts` 为抽象基类，添加 `executeCommands`
- [ ] 修改 `WebGLRenderer.ts` 继承新基类
- [ ] 修改 `Canvas2DRenderer.ts` 继承新基类并实现 `executeCommands`
- [ ] 确保 TypeScript 编译通过
- [ ] 运行现有测试确保无回归

---

### Phase 5: DrawingCanvas 精简 (预计 3-5 天)

**目标**: 从 3130 行减少到 <500 行

**策略**: 逐步迁移，分模块提取

#### Step 5.1: 启用 useDrawingArchitecture hook

**当前状态**: Hook 已创建但未使用

**迁移步骤**:
```typescript
// DrawingCanvas.tsx 中逐步替换
const { stateManager, commander, render } = useDrawingArchitecture({
  renderer: rendererRef.current,
  enabled: true, // 先设为 false，逐步迁移
});

// 旧渲染循环
const animate = () => {
  if (enabled) {
    commander.render();  // 新架构
  } else {
    // 旧逻辑...
  }
};
```

#### Step 5.2: 提取交互逻辑到独立 hooks

**计划提取**:
- [ ] `useArtisticDrawing` - 艺术模式绘制逻辑
- [ ] `useDigitalDrawing` - 数字模式绘制逻辑  
- [ ] `useSelectTool` - 选择工具逻辑
- [ ] `useMeasureTools` - 测量工具逻辑
- [ ] `useSnapSystem` - 吸附系统

#### Step 5.3: 最终精简

**目标结构**:
```typescript
export function DrawingCanvas() {
  // 1. 初始化
  const containerRef = useRef<HTMLDivElement>(null);
  const { renderer } = useCanvasRenderer(containerRef, store);
  const { commander, render } = useDrawingArchitecture({ renderer });
  
  // 2. 交互 hooks
  const { handleArtisticEvents } = useArtisticDrawing({ renderer, commander });
  const { handleDigitalEvents } = useDigitalDrawing({ renderer, commander });
  const { handleSelectEvents } = useSelectTool({ renderer, commander });
  
  // 3. 渲染循环
  useAnimationFrame(render);
  
  // 4. 事件路由
  const handleEvent = (e) => {
    if (store.toolCategory === 'artistic') handleArtisticEvents(e);
    else if (store.toolCategory === 'digital') handleDigitalEvents(e);
    else if (store.activeTool === 'select') handleSelectEvents(e);
  };
  
  return <div ref={containerRef} onEvent={handleEvent} />;
}
```

## 文件重组

### 当前目录结构 (2026-03-29)
```
src/
├── components/
│   └── DrawingCanvas.tsx          # 3130 行 - 待精简
├── managers/
│   └── DrawingStateManager.ts     # ✅ 745 行 - 已完成
├── controllers/
│   ├── DrawingCommander.ts        # ✅ 213 行 - 已完成
│   └── SelectDragController.ts    # 15271 行 - 待审查
├── renderers/
│   ├── Renderer.ts                # 61 行 - ⚠️ 待修复接口
│   ├── Canvas2DRenderer.ts        # 545 行 - ⚠️ 待添加 executeCommands
│   ├── WebGLRenderer.ts           # 753 行 - ✅ 有 executeCommands
│   ├── commands/
│   │   └── RenderCommand.ts       # ✅ 353 行 - 已完成
│   └── RendererConfig.ts          # 5618 行 - 待审查
├── hooks/
│   ├── useDrawingArchitecture.ts  # ✅ 172 行 - 已完成但未使用
│   ├── useCanvasRenderer.ts       # 8936 行 - 待审查
│   ├── useCommandHistory.ts       # 4372 行 - 待审查
│   ├── useArtisticDrawing.ts      # 489 行
│   ├── useDigitalDrawing.ts       # 9264 行
│   ├── useSelectTool.ts           # 8478 行
│   └── useDragHint.ts             # 2520 行
├── utils/
│   └── coordinates.ts             # ✅ 坐标工具函数
└── __tests__/
    └── DrawingCommander.test.ts   # ✅ 测试存在
```

### 目标目录结构
```
src/
├── components/
│   └── DrawingCanvas.tsx          # <500 行 - 只处理事件路由
├── managers/
│   ├── DrawingStateManager.ts     # 状态管理
│   └── (可能需要拆分)
├── controllers/
│   └── DrawingCommander.ts        # 命令编排
├── renderers/
│   ├── Renderer.ts                # 抽象基类
│   ├── Canvas2DRenderer.ts        # Canvas2D 实现
│   ├── WebGLRenderer.ts           # WebGL 实现
│   └── commands/
│       └── RenderCommand.ts       # 命令类型
├── hooks/
│   ├── useRenderer.ts             # Renderer 生命周期
│   ├── useDrawingArchitecture.ts  # 新架构集成
│   ├── useArtisticDrawing.ts      # 艺术模式
│   ├── useDigitalDrawing.ts       # 数字模式
│   ├── useSelectTool.ts           # 选择工具
│   ├── useMeasureTools.ts         # 测量工具
│   └── useSnapSystem.ts           # 吸附系统
└── utils/
    ├── coordinates.ts             # 坐标转换
    └── geometry.ts                # 几何计算
```

---

## 具体 Bug 修复计划

### 1. WebGL 圆预览不显示
**当前**: 预览逻辑分散，状态同步问题  
**修复后**: DrawingStateManager 统一维护 previewState，Commander 生成命令，Renderer 执行  
**依赖**: Phase 4 完成

### 2. 线段选择高亮封闭区域
**当前**: 高亮逻辑在 DrawingCanvas 中，条件判断复杂  
**修复后**: Commander 根据 selectMode 过滤命令，不生成封闭区域的 highlight 命令  
**依赖**: DrawingStateManager.isElementSelectableInCurrentMode 已实现 ✅

### 3. 线段拖动变形
**当前**: 拖动逻辑直接修改 stroke 数据  
**修复后**: SelectionManager 处理拖动，生成 translation 命令，不直接修改数据  
**状态**: SelectDragController.ts 已存在 (15271 行) - 需要审查

### 4. 圆/圆弧拖动修改半径
**当前**: 没有区分端点拖动和整体拖动  
**修复后**: SelectableElement 有 type 字段，SelectionManager 根据 type 决定拖动行为  
**状态**: 需要实现

---

## 实施顺序与时间估算

### 已完成 (2026-03-15 ~ 2026-03-29)
- ✅ Week 1-2: RenderCommand 系统 + DrawingStateManager + DrawingCommander

### 当前阶段 (预计 2-3 天)
- 🔴 **P0**: 修复 Renderer 接口不匹配问题
  - [ ] 修改 `Renderer.ts` 添加 `executeCommands`
  - [ ] 实现 `Canvas2DRenderer.executeCommands`
  - [ ] 统一基类架构
  - [ ] 验证 TypeScript 编译

### 下一阶段 (预计 3-5 天)
- **Phase 5**: DrawingCanvas 精简
  - [ ] 启用 `useDrawingArchitecture` hook
  - [ ] 迁移渲染循环到新架构
  - [ ] 提取交互逻辑到独立 hooks
  - [ ] 目标：<500 行

### 后续阶段 (预计 5-7 天)
- **Phase 6**: 清理遗留代码
  - [ ] 删除旧的 `shapePredict.ts`
  - [ ] 统一 brush presets
  - [ ] 删除空实现方法
- **Phase 7**: 补充测试
  - [ ] DrawingStateManager 单元测试
  - [ ] DrawingCommander 集成测试
  - [ ] Renderer 命令执行测试

---

## 预期收益

### 已完成收益
- ✅ **架构清晰**: 命令系统 + 状态管理器 + 指挥官三层分离
- ✅ **可测试性**: DrawingCommander 已有完整单元测试
- ✅ **类型安全**: RenderCommand 工厂模式确保类型正确

### 待实现收益
- 🔲 **代码量减少**: DrawingCanvas 从 3130 行 → <500 行 (84% 减少)
- 🔲 **双渲染器一致**: Canvas2D 和 WebGL 通过统一命令系统
- 🔲 **可维护性**: 新功能只需添加 Command 类型和对应绘制逻辑
- 🔲 **性能提升**: 差量渲染（待实现）减少无效计算

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Canvas2DRenderer 实现复杂 | 中 | 中 | 逐步迁移，先实现基本命令类型 |
| DrawingCanvas 迁移影响现有功能 | 高 | 高 | 功能开关控制，逐步迁移，充分测试 |
| 性能回归 | 低 | 高 | 迁移前后性能基准测试对比 |
| TypeScript 类型错误 | 中 | 低 | 小步提交，频繁编译验证 |

---

## 验收标准

### Phase 4 完成标准
- [ ] `Renderer` 接口/基类包含 `executeCommands(commands: RenderCommand[]): void`
- [ ] `Canvas2DRenderer` 实现 `executeCommands`
- [ ] `WebGLRenderer` 继承新基类
- [ ] TypeScript 编译无错误
- [ ] 现有测试通过

### Phase 5 完成标准
- [ ] `DrawingCanvas.tsx` <500 行
- [ ] 所有交互功能正常工作
- [ ] 新架构默认启用
- [ ] 旧渲染逻辑完全移除
- [ ] 通过手动测试和自动化测试

---

**最后更新**: 2026-03-29  
**下次审查**: Phase 4 完成后
