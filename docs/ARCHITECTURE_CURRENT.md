# Web Stroker 当前架构 (2026-03-29)

**文档版本**: 1.0  
**最后更新**: 2026-03-29  
**状态**: 重构完成 (Phase 4 & 5)

---

## 架构概览

### 目标
将 3130 行的 `DrawingCanvas` 精简到 339 行，通过职责分离和命令模式实现清晰的架构分层。

### 重构成果
- **DrawingCanvas**: 3130 行 → **339 行** (-89%)
- **新 hooks**: 5 个专用 hooks (879 行)
- **净减少**: ~1900 行代码

---

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                    DrawingCanvas (339 行)                │
│  - 事件路由 (根据 toolCategory 分发到 hooks)              │
│  - 2D UI 渲染 (网格、吸附指示器、测量预览)                │
│  - 渲染器/commander 初始化                                │
│  - 动画循环管理                                          │
└─────────────────────────────────────────────────────────┘
                            ↓ 事件路由
┌─────────────────────────────────────────────────────────┐
│              Hooks 层 (879 行)                            │
│  - useSnapSystem: 坐标转换 + 吸附检测                    │
│  - useSelectTool: 元素选择/拖拽                          │
│  - useMeasureTools: 测量工具逻辑                         │
│  - useArtisticDrawing: 艺术模式自由绘制                  │
│  - useDigitalDrawing: 数字模式精确绘制                   │
└─────────────────────────────────────────────────────────┘
                            ↓ 状态更新
┌─────────────────────────────────────────────────────────┐
│           DrawingStateManager (706 行)                    │
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
│              Renderer 接口 (61 行)                        │
│  - executeCommands(commands: RenderCommand[]): void     │
│  - 生命周期：initialize, dispose, resize, render        │
│  - 视图变换：setViewState, worldToScreen, screenToWorld │
│  - Legacy API: addStroke, updateDigitalXxxPreview 等    │
└─────────────────────────────────────────────────────────┘
                    ↓                    ↓
        Canvas2DRenderer (816 行)    WebGLRenderer (842 行)
```

---

## 数据流

### 1. 用户交互流程

```
用户鼠标事件
    ↓
DrawingCanvas.handleMouseDown/Move/Up
    ↓
根据 toolCategory 路由到对应 hook
    ↓
hook 处理交互逻辑
    ↓
更新 store (通过 addStrokes 等)
    ↓
触发 commander 同步
    ↓
commander.render()
    ↓
renderer.executeCommands()
    ↓
屏幕渲染
```

### 2. 渲染流程

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

### 3. 状态同步流程

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

## 关键文件

### 核心组件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/components/DrawingCanvas.tsx` | 339 | 事件路由 + 2D UI 渲染 |
| `src/store.ts` | ~600 | Zustand 状态管理 |

### Hooks

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/hooks/useSnapSystem.ts` | 195 | 坐标转换 + 吸附检测 |
| `src/hooks/useSelectTool.ts` | 237 | 元素选择/拖拽 |
| `src/hooks/useMeasureTools.ts` | 148 | 测量工具逻辑 |
| `src/hooks/useArtisticDrawing.ts` | 134 | 艺术模式自由绘制 |
| `src/hooks/useDigitalDrawing.ts` | 165 | 数字模式精确绘制 |

### 状态管理

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/managers/DrawingStateManager.ts` | 706 | 状态管理 + 命令生成 |
| `src/controllers/DrawingCommander.ts` | 213 | 渲染编排 |

### 渲染系统

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/renderers/Renderer.ts` | 61 | 渲染器接口 |
| `src/renderers/Canvas2DRenderer.ts` | 816 | 2D Canvas 实现 |
| `src/renderers/WebGLRenderer.ts` | 842 | WebGL/Three.js 实现 |
| `src/renderers/commands/RenderCommand.ts` | 353 | 命令类型定义 + 工厂 |

---

## 命令系统

### RenderCommand 类型

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

### Z-Index 层级

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

---

## 设计原则

### 1. 单一职责
- **DrawingCanvas**: 只处理事件路由和 2D UI 渲染
- **Hooks**: 处理特定交互逻辑
- **DrawingStateManager**: 只管理状态
- **DrawingCommander**: 只编排渲染
- **Renderer**: 只执行绘制

### 2. 命令模式
- 所有绘制操作转换为 `RenderCommand[]`
- 命令按 zIndex 排序确保正确层叠
- 渲染器只执行命令，不决定何时绘制

### 3. 类型安全
- TypeScript strict mode
- 所有接口和类型明确定义
- 编译时类型检查

### 4. 可测试性
- Hooks 可独立测试
- DrawingStateManager 可独立测试
- DrawingCommander 可独立测试
- Renderer 可 mock 测试

---

## 工具类别

### Artistic Mode (艺术模式)
- **工具**: pencil, pen, brush, ballpen, eraser
- **特点**: 自由手绘，支持平滑和形状预测
- **Hook**: `useArtisticDrawing`

### Digital Mode (数字模式)
- **工具**: line, circle, arc, curve
- **特点**: 精确几何绘制
- **Hook**: `useDigitalDrawing`

### Measure Mode (测量模式)
- **工具**: distance, angle, radius, face
- **特点**: 几何测量
- **Hook**: `useMeasureTools`

### Select Mode (选择模式)
- **选择**: point, line, arc
- **特点**: 元素选择和拖拽
- **Hook**: `useSelectTool`

---

## 性能考虑

### 当前实现
- 每帧调用 `commander.render()`
- 全量生成命令并执行
- WebGL 使用 Three.js 硬件加速

### 优化建议 (未来)
- 差量渲染 (只渲染变化的部分)
- 使用 `requestIdleCallback` 优化非关键渲染
- 添加渲染预算 (target 60fps)
- 命令缓存 (相同状态不重新生成)

---

## 测试策略

### 现有测试
- `DrawingCommander.test.ts` - 指挥官逻辑测试
- `DrawingStateManager.test.ts` - 状态管理测试
- `baseline.test.ts` - 形状识别基准测试
- `visual-baseline.test.ts` - 视觉回归测试

### 建议添加
- `useSnapSystem.test.ts` - 吸附逻辑测试
- `useSelectTool.test.ts` - 选择逻辑测试
- `useMeasureTools.test.ts` - 测量逻辑测试
- `useArtisticDrawing.test.ts` - 艺术绘制测试
- `useDigitalDrawing.test.ts` - 数字绘制测试

---

## 扩展指南

### 添加新工具

1. **添加工具类型**到 `types.ts`
2. **创建 hook**处理交互逻辑
3. **在 DrawingCanvas**中添加事件路由
4. **添加 UI**到 Toolbar/PropertyPanel

### 添加新命令类型

1. **添加命令类型**到 `RenderCommand.ts`
2. **在 DrawingStateManager**中生成新命令
3. **在 Renderer**中实现命令执行
4. **添加测试**验证命令执行

### 添加新渲染器

1. **实现 Renderer 接口**
2. **实现 executeCommands**方法
3. **在 Toolbar**中添加切换选项
4. **测试**渲染一致性

---

## 已知限制

1. **类型映射**: `syncFromStore` 使用 `any` 类型 (务实方案)
2. **Legacy API**: Renderer 接口保留 17 个未使用的方法
3. **性能**: 每帧全量渲染，未实现差量更新

---

## 变更历史

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-03-29 | 1.0 | Phase 4 & 5 重构完成 |
| 2026-03-15 | 0.2 | Phase 1-3 完成 |
| 2026-03-01 | 0.1 | 初始架构设计 |

---

## 参考文档

- `docs/ARCHITECTURE.md` - 详细架构设计
- `docs/ARCHITECTURE_REVIEW_2026_03_29.md` - 架构审查报告
- `docs/REFACTORING_PLAN.md` - 重构计划
- `SYSTEM_OVERVIEW.md` - 系统概览

---

**维护者**: Development Team  
**联系方式**: [内部]
