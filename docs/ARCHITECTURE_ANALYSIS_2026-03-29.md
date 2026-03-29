# 架构分析与约束功能评估报告

**日期**: 2026-03-29  
**范围**: 当前架构合理性 + Constraints Feature 实现质量  
**参考**: `docs/ARCHITECTURE_CURRENT.md`, `docs/superpowers/plans/2026-03-29-constraints-feature.md`  
**状态**: ⚠️ 需要修复

---

## 总体评分

| 维度 | 文档声称 | 实际状态 | 差异 |
|------|----------|----------|------|
| **职责分离** | ⭐⭐⭐⭐⭐ 5/5 | ⭐⭐⭐⭐☆ 4/5 | -1 |
| **类型安全** | ⭐⭐⭐⭐☆ 4/5 | ⭐⭐☆☆☆ 2/5 | -2 |
| **代码质量** | ⭐⭐⭐⭐⭐ 5/5 | ⭐⭐⭐☆☆ 3/5 | -2 |
| **约束功能完成度** | (新增) | ⭐⭐☆☆☆ 2/5 | — |
| **可测试性** | ⭐⭐⭐☆☆ 3/5 | ⭐⭐⭐☆☆ 3/5 | = |
| **整体** | ⭐⭐⭐⭐☆ 4/5 | ⭐⭐⭐☆☆ 3/5 | -1 |

---

## 一、架构合理性：基础设计良好，局部存在侵蚀

### ✅ 成功的部分

- **分层清晰**：DrawingCanvas → Hooks → StateManager → Commander → Renderer 的分层依然成立
- DrawingCanvas 从 3130 行精简到 419 行（文档说 339 行，实际 419 行，仍在合理范围）
- **命令模式可靠**：RenderCommand 体系完整，executeCommands() 统一入口工作正常
- **测试基础扎实**：528 个测试通过，核心逻辑有保障
- **Hooks 职责分离**：5 个专用 Hook 各司其职，代码可独立理解

---

## 二、约束功能问题清单

> 约束功能当前完成度约 40%：类型系统完整，ConstraintManager 核心逻辑正确，但 UI 集成、拖拽执行、可视化反馈均未真正工作。

---

### 🔴 [BUG-001] DrawingCanvas 在回调中非法调用 Hook

**严重级别**: Critical  
**文件**: `src/components/DrawingCanvas.tsx:284`  
**状态**: ❌ 未修复

**问题代码**:
```typescript
// handleConstraintMouseDown 回调内部（约第 284 行）
const element = useSelectTool({ screenToWorld }).findElementAtPoint(snapped.point, 'point');
// ❌ React Hook "useSelectTool" cannot be called inside a callback
```

**问题**:
- 违反 React Rules of Hooks——Hook 只能在组件或自定义 Hook 的顶层调用
- 每次鼠标按下都会重新实例化整个 `useSelectTool` hook，导致内部状态重置
- 已被 `eslint` 标记为 error

**修复方案**:
```typescript
// DrawingCanvas 顶层（第 37 行附近）已调用 useSelectTool，补充解构 findElementAtPoint
const { handleSelectDown, handleSelectMove, handleSelectUp, findElementAtPoint } = useSelectTool({ screenToWorld });

// handleConstraintMouseDown 中直接使用
const element = findElementAtPoint(snapped.point, 'point');  // ✅
```

**验证**: `npm run lint` 不再报 `react-hooks/rules-of-hooks` 错误

---

### 🔴 [BUG-002] ConstraintManager 实例存储在 Zustand Store 中

**严重级别**: Critical  
**文件**: `src/store.ts:102, 303-314`  
**状态**: ❌ 未修复

**问题代码**:
```typescript
// store.ts
constraintManager: new ConstraintManager(),  // ❌ 类实例在 store 里

addConstraint: (constraint) => set((state) => {
  state.constraintManager.addConstraint(constraint);  // ❌ 直接突变
  return { constraints: state.constraintManager.getConstraints() };
}),
```

**三重问题**:
1. **状态双轨**: `constraints` 数组和 `constraintManager` Map 各存一份，同一数据两处，存在同步风险
2. **直接突变**: 绕过 Zustand 的不可变性原则，devtools 无法追踪此变化
3. **序列化失败**: 类实例无法序列化，导致 persist/devtools 插件失效

**修复方案**:
```typescript
// store 只存数据数组
interface DrawingState {
  constraints: Constraint[];  // ✅ 只存纯数据
  // 删除 constraintManager
}

// ConstraintManager 改为无状态工具类，或提取为纯函数
// 在需要执行约束的地方本地实例化：
// const manager = useMemo(() => new ConstraintManager(), []);
// 或改为纯函数：enforceDistanceConstraint(point, anchor, distance): Point
```

---

### 🔴 [BUG-003] 拖拽约束执行是 skeleton 代码，无实际效果

**严重级别**: Critical  
**文件**: `src/hooks/useSelectTool.ts:183-210`  
**状态**: ❌ 未实现

**问题代码**:
```typescript
// handleSelectMove — 约束计算存在但拖拽本身未实现
// TODO: Apply drag offset to selected element
// This requires modifying strokes in the store
console.log('[useSelectTool] Dragging with constraints:', dragOffset);
// ❌ 只有 console.log，笔画位置从未被更新
```

**附加问题——anchorPoint 语义错误**:
```typescript
const anchorPoint = dragStartRef.current;  // ❌ 锚点用的是拖拽起始点
// 距离约束的锚点应该是另一端端点，而非拖拽起始位置
```

**附加问题——pointIndex 硬编码**:
```typescript
store.getConstraintsForPoint(selectedElementRef.current.strokeId, 0)
// ❌ TODO: Get point index from element  — 永远查询 index=0
```

**修复方向**:
1. 先实现拖拽移动逻辑（更新 store 中的笔画端点位置）
2. 从 `selectedElementRef.current` 中正确提取 pointIndex
3. 将约束锚点改为目标点的对侧端点

---

### 🔴 [BUG-004] ConstraintMarkers 永远渲染空内容

**严重级别**: High  
**文件**: `src/components/DrawingCanvas.tsx:395-400`  
**状态**: ❌ 未实现

**问题代码**:
```typescript
<ConstraintMarkers
  constraints={store.constraints}
  getPointForTarget={(_target) => {
    // TODO: Get point from stroke based on target
    return null;  // ❌ 永远返回 null，所有标记永远不渲染
  }}
  worldToScreen={worldToScreen}
/>
```

**修复方案 A（推荐）——走 RenderCommand 系统**:
```typescript
// DrawingStateManager 中添加，利用已有 indicator 命令类型
generateConstraintCommands(constraints: Constraint[], strokes: Stroke[]): RenderCommand[] {
  return constraints.flatMap(c =>
    c.targets.map(target => {
      const point = getPointForTarget(target, strokes);
      if (!point) return null;
      return RenderCommandFactory.createIndicator(point, {
        color: '#2196f3', radius: 5
      });
    }).filter(Boolean)
  );
}
```

**修复方案 B（快速）——实现 getPointForTarget**:
```typescript
getPointForTarget={(target) => {
  const stroke = store.strokes.find(s => s.id === target.strokeId);
  if (!stroke?.digitalSegments) return null;
  const seg = stroke.digitalSegments[target.segmentIndex ?? 0];
  if (!seg) return null;
  return seg.points[target.pointIndex ?? 0] ?? null;
}}
```

---

## 三、已有架构的遗留问题

---

### 🟠 [BUG-005] useEffect 依赖数组缺失，渲染依赖 stale closure

**严重级别**: Medium  
**文件**: `src/components/DrawingCanvas.tsx:273`  
**状态**: ❌ 未修复

**问题代码**:
```typescript
}, [store.renderer, store.zoom, store.panX, store.panY, store.strokes]);
// ❌ 缺少: currentPoints, currentSnap, isDrawing, measurePreview, worldToScreen, store
```

`render2DUI` 函数是闭包，引用了 `currentSnap`、`isDrawing`、`measurePreview`、`worldToScreen` 等状态，但这些不在依赖数组里。表现为：这些值的变化不会触发 effect 重新运行，`render2DUI` 始终使用过时的闭包值。

**当前被掩盖的原因**: `requestAnimationFrame` 每帧都调用 `render2DUI`，所以视觉上看起来正常，但实际是每帧都读取 stale 值。

**修复方案**:
```typescript
// 将 render2DUI 提取为 useCallback，把依赖的状态通过 ref 传入
// 或拆分 useEffect，将 render2DUI 的依赖正确声明
```

---

### 🟠 [BUG-006] DrawingStateManager 与 Store 类型手动映射，维护负担高

**严重级别**: Medium  
**文件**: `src/components/DrawingCanvas.tsx:111-126`  
**状态**: ❌ 未修复（前次审查遗留）

```typescript
stateManager.syncFromStore({
  strokes: store.strokes,
  selectedStrokeIds: store.selectedDigitalStrokeIds,  // 字段名不同
  measureTool: store.measureTool ?? undefined,          // 需要类型转换
  // ...12+ 个手动映射
});
```

**修复方案**:
```typescript
// DrawingStateManager 直接 import DrawingState 类型
import type { DrawingState } from '../store';
syncFromStore(store: Pick<DrawingState, 'strokes' | 'selectedDigitalStrokeIds' | ...>): void
```

---

### 🟡 [BUG-007] 约束创建状态分散，难以管理

**严重级别**: Low  
**文件**: `src/store.ts:109-115`  
**状态**: ⚠️ 可改进

```typescript
// ❌ 3 个分散的字段，形成隐式状态机
isCreatingConstraint: boolean;
constraintType: ConstraintType | null;
constraintPendingTargets: ConstraintTarget[];
```

**建议**:
```typescript
// ✅ 聚合为一个对象，null 表示非创建状态
constraintCreation: {
  type: ConstraintType;
  pendingTargets: ConstraintTarget[];
} | null;
```

---

### 🟡 [BUG-008] 约束数据不参与存档，save/load 会丢失

**严重级别**: Low  
**文件**: `src/types.ts:75-84`  
**状态**: ❌ 未实现

`CanvasState`（存档格式）不包含 `constraints` 字段，导致保存/加载文件时所有约束丢失。

```typescript
// 需要扩展 CanvasState
interface CanvasState {
  strokes: Stroke[];
  constraints?: Constraint[];  // 添加
  // ...
}
```

---

### 🟡 [BUG-009] angle/radius 约束 enforcement 是 stub

**严重级别**: Low  
**文件**: `src/constraints/ConstraintManager.ts:43-49`  
**状态**: ⚠️ 已知未实现

```typescript
case 'angle':
  // Angle constraint enforcement is more complex - handled separately
  return draggedPoint;  // ❌ 无效果
case 'radius':
  // Radius constraint - handled in circle context
  return draggedPoint;  // ❌ 无效果
```

---

### 🟡 [BUG-010] 两个约束测试文件内容高度重复

**严重级别**: Low  
**文件**: `src/__tests__/ConstraintManager.test.ts`, `src/__tests__/constraints-integration.test.ts`  
**状态**: ⚠️ 可改进

两个文件相似度 ~90%，且都只测试 `ConstraintManager` 本身，没有测试：
- Store 集成（`addConstraint` action 是否正确更新 store）
- UI 流程（`useConstraints` hook 的状态流转）
- 拖拽约束执行（端对端）

---

## 四、约束功能与现有架构的匹配性分析

| 设计决策 | 当前实现 | 架构中的正确做法 |
|---------|----------|-----------------|
| 约束数据存储 | Store 里存 `Constraint[]` + `ConstraintManager` 实例 | **只存 `Constraint[]`**，Manager 是无状态工具 |
| 约束执行时机 | `useSelectTool.handleSelectMove` | ✅ 正确位置，但未实现 |
| 约束可视化 | SVG overlay（`ConstraintMarkers`，永远为空） | **应走 `RenderCommand` 系统**（已有 `indicator` 类型） |
| 约束创建状态 | 3 个分散字段 | **聚合为 `constraintCreation` 对象** |

---

## 五、修复优先级路线图

### P0 — 立即修复（阻断功能正确性）

| ID | 问题 | 文件 | 估计工作量 |
|----|------|------|-----------|
| BUG-001 | Hook 在回调中调用 | DrawingCanvas.tsx:284 | 5 分钟 |
| BUG-003 | 拖拽逻辑未实现 + anchorPoint 错误 | useSelectTool.ts | 2-4 小时 |

### P1 — 短期重构（架构正确性）

| ID | 问题 | 文件 | 估计工作量 |
|----|------|------|-----------|
| BUG-002 | ConstraintManager 移出 Store | store.ts | 1-2 小时 |
| BUG-004 | ConstraintMarkers 实现 | DrawingCanvas.tsx | 1 小时 |
| BUG-005 | useEffect 依赖缺失 | DrawingCanvas.tsx:273 | 1-2 小时 |

### P2 — 中期改进（代码质量）

| ID | 问题 | 文件 | 估计工作量 |
|----|------|------|-----------|
| BUG-006 | StateManager 类型映射统一 | DrawingStateManager.ts | 1-2 小时 |
| BUG-007 | 约束创建状态聚合 | store.ts | 30 分钟 |
| BUG-008 | 约束数据加入存档格式 | types.ts + store.ts | 30 分钟 |

### P3 — 长期完善

| ID | 问题 | 文件 | 估计工作量 |
|----|------|------|-----------|
| BUG-009 | angle/radius 约束算法实现 | ConstraintManager.ts | 4-8 小时 |
| BUG-010 | 补充集成测试 | __tests__/ | 2-4 小时 |

---

## 六、验证检查单

修复完成后，按以下顺序验证：

```bash
# 1. 无 lint 错误
npm run lint
# 期望：0 errors（特别是 react-hooks/rules-of-hooks）

# 2. 所有测试通过
npm run test:run
# 期望：534+ tests pass, 0 constraint-related failures

# 3. 构建成功
npm run build
# 期望：exit code 0

# 4. 手动验证约束功能
# - 创建两条线，选择端点，添加距离约束
# - 拖拽端点，验证距离被约束
# - 蓝色标记点出现在约束端点上
# - 保存/加载文件后约束仍然存在
```

---

## 七、补充说明

### 现有架构的正面评价
- Hook 分层架构扎实，可继续沿用
- RenderCommand 命令系统设计合理，约束可视化应充分利用已有 `indicator` 命令类型
- ConstraintManager 的 `enforceDistanceConstraint` 算法本身正确（测试通过）
- TypeScript 类型定义（ConstraintTypes.ts、types.ts 的重新导出）结构清晰

### 技术债务现状
前次审查（2026-03-29）指出的问题，本次发现**均未修复**：
- `syncFromStore` 类型手动映射 → 仍存在（BUG-006）
- Renderer 接口 legacy API → 未清理
- hooks 缺少单元测试 → 未添加

建议在实现约束功能完整化之前，先解决 BUG-001（Hook 违规），避免 React 运行时更多潜在问题。

---

**报告生成时间**: 2026-03-29  
**下次审查建议**: BUG-001 ~ BUG-004 修复后
