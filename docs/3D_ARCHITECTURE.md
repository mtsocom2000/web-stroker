# Web Stroker 3D 建模架构设计

**版本**: 1.0  
**日期**: 2026-04-12  
**状态**: ✅ 实现完成 (Phases 1-6)

---

## 1. 概述

基于 **Chili3D** 架构设计，在保留原有 2D 草图功能的基础上，为 web-stroker 项目完整实现了 3D 参数化建模能力。

**核心设计原则**:
- 2D/3D 一体化：同一应用中无缝切换
- 命令驱动：所有操作封装为可撤销命令
- 特征历史：参数化设计支持
- 轻量集成：仅引入必要依赖

---

## 2. 技术栈

| 类别 | 技术 | 版本 | 来源 |
|------|------|------|------|
| 几何内核 | OCCT WASM | 7.7.0 | Chili3D |
| 类型定义 | chili-wasm.d.ts | 25KB | Chili3D |
| 3D 渲染 | Three.js | 0.128.0 | 自研集成 |
| 约束求解 | Newton-Raphson | 自研 | 自研 |
| 前端框架 | React | 19.2.0 | 现有 |
| 状态管理 | Zustand | 4.4.0 | 现有 |

**WASM 二进制**: `src/kernel/lib/chili-wasm.wasm` (15.8 MB)

---

## 3. 架构分层

```
┌─────────────────────────────────────────────────────────┐
│              Presentation Layer                         │
│  - ThreeViewCanvas.tsx (3D 视图组件)                     │
│  - FeatureTreePanel.tsx (特征树面板)                     │
│  - Toolbar (2D/3D 切换)                                  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Application Layer                          │
│  - Command System (命令系统)                            │
│  - Transaction System (事务系统)                        │
│  - Event System (事件系统)                              │
│  - Store (Zustand 状态管理)                             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Domain Layer                               │
│  - FeatureTree (特征历史树)                             │
│  - SketchSolver (草图约束求解)                          │
│  - ShapeFactory (形状工厂)                              │
│  - SketchConverter (2D→3D 转换)                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Infrastructure Layer                       │
│  - GeometryKernel (OCCT WASM 封装)                      │
│  - ThreeRenderer (Three.js 渲染)                        │
│  - Storage (本地持久化)                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 核心模块

### 4.1 GeometryKernel (OCCT WASM 封装)

**文件**: `src/kernel/GeometryKernel.ts` (10KB)

**功能**:
```typescript
class GeometryKernel {
  // 初始化
  initialize(): Promise<void>
  
  // 基础形状
  createBox(origin, dx, dy, dz): Result<IShape>
  createCylinder(origin, radius, height): Result<IShape>
  createSphere(center, radius): Result<IShape>
  
  // 布尔运算
  booleanFuse(shapes[]): Result<IShape>
  booleanCut(shapeA, shapesB[]): Result<IShape>
  booleanCommon(shapes[]): Result<IShape>
  
  // 修改操作
  fillet(shape, edgeIndices, radius): Result<IShape>
  chamfer(shape, edgeIndices, distance): Result<IShape>
  
  // 2D→3D
  extrude(sketch, distance, taperAngle?): Result<IShape>
  revolve(sketch, axisStart, axisEnd, angle): Result<IShape>
  
  // 网格化 (用于 Three.js 渲染)
  tessellate(shape): MeshData
}
```

**使用示例**:
```typescript
import { kernel } from './kernel';

await kernel.initialize();

const box = kernel.createBox(
  { x: 0, y: 0, z: 0 },
  10, 20, 30
);

if (box.isOk) {
  const meshData = kernel.tessellate(box.value);
  // 使用 meshData 创建 Three.js 网格
}
```

---

### 4.2 Command System (命令系统)

**文件**:
- `src/commands/Command.ts` (4KB)
- `src/commands/CommandStore.ts` (2KB)

**核心类**:
```typescript
// 命令基类
abstract class CancelableCommand {
  abstract executeAsync(): Promise<void>;
  abstract undo(): Promise<void>;
  abstract redo(): Promise<void>;
}

// 多步骤命令 (交互式操作)
abstract class MultistepCommand extends CancelableCommand {
  abstract onStep(params): void;
  abstract complete(): void;
  abstract cancel(): void;
}

// 命令注册表
class CommandStore {
  register(key: string, ctor: CommandConstructor): void;
  create<T>(key: string, params?: any): T;
}

// 声明式注册
function @command(options: { key, name, category }) {
  // 装饰器逻辑
}
```

**使用示例**:
```typescript
@command({
  key: 'create.box',
  name: '创建长方体',
  category: '3D'
})
class CreateBoxCommand extends CancelableCommand {
  async executeAsync() {
    const box = await kernel.createBox(
      this.params.position,
      this.params.width,
      this.params.height,
      this.params.depth
    );
    if (box.isOk) {
      store.addShape3D({ ... });
    }
  }
  
  async undo() {
    store.removeShape3D(this.params.id);
  }
  
  async redo() {
    await this.executeAsync();
  }
}

// 使用
const cmd = CommandStore.create<CreateBoxCommand>('create.box', {
  position: { x: 0, y: 0, z: 0 },
  width: 10, height: 20, depth: 30
});
await cmd.execute();
```

---

### 4.3 Transaction System (事务系统)

**文件**: `src/foundation/Transaction.ts` (5KB)

**功能**:
- 批量操作原子性执行
- 失败自动回滚
- 与 History 系统集成

**使用示例**:
```typescript
Transaction.execute('doc1', 'Extrude Feature', () => {
  const shape = ShapeFactory.extrude(sketch, distance);
  store.addShape(shape);
  store.addFeature({ type: 'extrude', sketchId: sketch.id, distance });
});
```

---

### 4.4 FeatureTree (特征历史树)

**文件**: `src/kernel/FeatureTree.ts` (7KB)

**功能**:
```typescript
class FeatureTree {
  addFeature(feature: Feature): void;
  deleteFeature(id: string): void;
  updateFeature(id: string, params: Record<string, any>): void;
  suppressFeature(id: string, suppressed: boolean): void;
  rebuildFrom(id: string): void;
  getAllFeatures(): Feature[];
  getRootFeatures(): Feature[];
  getTreeStructure(): any[];
  serialize(): any;
  deserialize(data: any): void;
}
```

**Feature 数据结构**:
```typescript
interface Feature {
  id: string;
  type: FeatureType;  // 'sketch' | 'extrude' | 'revolve' | 'boolean' | ...
  name: string;
  parentId: string | null;
  children: string[];
  parameters: Record<string, any>;
  resultShapeId: string | null;
  suppressed: boolean;
  createdAt: number;
  updatedAt: number;
}
```

---

### 4.5 ShapeFactory (形状工厂)

**文件**: `src/kernel/ShapeFactory.ts` (7KB)

**功能**:
```typescript
class ShapeFactory {
  // 基础形状
  static box(plane, dx, dy, dz): Result<IShape>
  static cylinder(plane, radius, height): Result<IShape>
  static sphere(center, radius): Result<IShape>
  
  // 2D→3D
  static extrude(sketch, distance, taperAngle?): Result<IShape>
  static revolve(sketch, axisStart, axisEnd, angle): Result<IShape>
  
  // 布尔运算
  static fuse(shapeA, shapeB): Result<IShape>
  static cut(shapeA, shapeB): Result<IShape>
  static common(shapeA, shapeB): Result<IShape>
  
  // 修改操作
  static fillet(shape, edgeIndices, radius): Result<IShape>
  static chamfer(shape, edgeIndices, distance): Result<IShape>
}
```

---

### 4.6 SketchSolver (草图约束求解器)

**文件**: `src/constraints/SketchSolver.ts` (15KB)

**功能**:
- Newton-Raphson 迭代求解
- 几何约束：重合/水平/垂直/固定
- 尺寸约束：距离/角度/半径

**使用示例**:
```typescript
import { SketchSolver } from './constraints/SketchSolver';

// 创建草图
const sketch = {
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }],
  constraints: [
    SketchSolver.fixed(0),           // 点 0 固定
    SketchSolver.horizontal(0, 1),   // 线段 0-1 水平
    SketchSolver.distance(0, 1, 20)  // 距离约束
  ]
};

// 求解
const solved = await SketchSolver.solve(sketch);
```

---

### 4.7 ThreeRenderer (Three.js 渲染器)

**文件**: `src/renderers/ThreeRenderer.ts` (16KB)

**功能**:
```typescript
class ThreeRenderer {
  constructor(config: ThreeRendererConfig)
  
  addShape(shapeData: Shape3DData): void;
  removeShape(shapeId: string): void;
  addWorkplane(workplane: Workplane): void;
  removeWorkplane(id: string): void;
  fitToContent(): void;
  setCameraPosition(position, target?): void;
  getScene(): THREE.Scene;
  getCamera(): THREE.PerspectiveCamera;
  dispose(): void;
}
```

**配置**:
```typescript
interface ThreeRendererConfig {
  container: HTMLElement;
  backgroundColor?: string;
  showGrid?: boolean;
  enableOrbitControls?: boolean;
}
```

---

### 4.8 SketchConverter (2D→3D 转换器)

**文件**: `src/kernel/SketchConverter.ts` (9KB)

**功能**:
- 将 2D 草图转换为 OCCT 轮廓
- 支持拉伸/旋转操作
- 验证草图有效性 (封闭轮廓等)

**使用示例**:
```typescript
import { SketchConverter } from './kernel/SketchConverter';

// 2D 草图 → 3D 拉伸
const wires = SketchConverter.sketchToWires(sketch);
const solid = await kernel.extrude(wires, 30);

// 2D 草图 → 3D 旋转
const revolved = await kernel.revolve(wires, axisStart, axisEnd, 360);
```

---

## 5. 数据流

### 5.1 3D 形状创建流程

```
用户操作 (Toolbar/命令)
    ↓
Command.executeAsync()
    ↓
ShapeFactory.box/cylinder/sphere/extrude/revolve
    ↓
GeometryKernel.createXxx()
    ↓
OCCT WASM 创建几何
    ↓
tessellate() 网格化
    ↓
ThreeRenderer.addShape()
    ↓
Three.js 渲染到屏幕
    ↓
FeatureTree.addFeature()
    ↓
Store 更新状态
```

### 5.2 约束求解流程

```
用户添加约束
    ↓
SketchSolver.addConstraint()
    ↓
store.addConstraint()
    ↓
SketchSolver.solve()
    ↓
Newton-Raphson 迭代
    ↓
更新草图点位置
    ↓
ThreeRenderer 更新预览
```

### 5.3 特征更新流程

```
用户修改特征参数
    ↓
FeatureTree.updateFeature(id, params)
    ↓
rebuildFrom(id) 重建后续特征
    ↓
重新执行特征命令
    ↓
更新 3D 形状网格
    ↓
ThreeRenderer 刷新渲染
```

---

## 6. 文件结构

```
web-stroker/src/
├── kernel/
│   ├── lib/
│   │   ├── chili-wasm.wasm       (15.8 MB)  ← 从 Chili3D 复制
│   │   └── chili-wasm.d.ts       (25 KB)    ← 从 Chili3D 复制
│   ├── GeometryKernel.ts         (10 KB)    ← 自研
│   ├── ShapeFactory.ts           (7 KB)     ← 自研
│   ├── SketchConverter.ts        (9 KB)     ← 自研
│   ├── FeatureTree.ts            (7 KB)     ← 自研
│   └── __tests__/
│       ├── GeometryKernel.test.ts (7 KB)
│       └── ShapeFactory.test.ts   (9 KB)
│
├── renderers/
│   ├── ThreeRenderer.ts          (16 KB)    ← 自研
│   └── ThreeViewCanvas.tsx       (4 KB)     ← 自研
│
├── commands/
│   ├── Command.ts                (4 KB)     ← 自研
│   ├── CommandStore.ts           (2 KB)     ← 自研
│   ├── CreateShapeCommand.ts     (9 KB)     ← 自研
│   └── SketchCommands.ts         (11 KB)    ← 自研
│
├── constraints/
│   ├── SketchSolver.ts           (15 KB)    ← 自研
│   └── __tests__/
│       └── SketchSolver.test.ts  (11 KB)
│
├── foundation/
│   └── Transaction.ts            (5 KB)     ← 自研
│
├── components/
│   └── FeatureTreePanel.tsx      (6 KB)     ← 自研
│
├── types3d.ts                    (3 KB)     ← 自研
├── store.ts (扩展)               ← 自研
└── App.tsx (扩展)                ← 自研
```

**代码统计**:
- 自研代码：~165 KB (不含 WASM)
- 测试代码：~49 KB
- 第三方库：15.8 MB (WASM)

---

## 7. 与 Chili3D 对比

| 功能 | Chili3D | web-stroker | 说明 |
|------|---------|-------------|------|
| 几何内核 | OCCT WASM ✅ | OCCT WASM ✅ | 从 Chili3D 复制 |
| 2D 草图 | ✅ | ✅ | web-stroker 原有功能 |
| 3D 建模 | ✅ | ✅ | 基于 Chili3D 架构自研 |
| 约束求解 | Solvespace | Newton-Raphson 自研 | 不同求解器 |
| 特征树 | ✅ | ✅ | 架构参考 + 自研实现 |
| UI 系统 | Ribbon | React + Toolbar | 不同技术栈 |
| 渲染 | Three.js | Three.js | 相同 |
| 代码来源 | 100% 自研 | 借鉴架构 + 自研实现 | - |
| 成熟度 | 生产级 | Alpha | web-stroker 待完善 |

---

## 8. 核心功能

### 8.1 3D 建模

| 功能 | 状态 | 说明 |
|------|------|------|
| 长方体 | ✅ | `create.box` 命令 |
| 圆柱体 | ✅ | `create.cylinder` 命令 |
| 球体 | ✅ | `create.sphere` 命令 |
| 布尔并集 | ✅ | `boolean.fuse` |
| 布尔差集 | ✅ | `boolean.cut` |
| 布尔交集 | ✅ | `boolean.common` |
| 圆角 | ✅ | `modify.fillet` |
| 倒角 | ✅ | `modify.chamfer` |
| 拉伸 | ✅ | `sketch.extrude` (从 2D 草图) |
| 旋转 | ✅ | `sketch.revolve` (从 2D 草图) |
| 扫掠 | ❌ | 待实现 |
| 放样 | ❌ | 待实现 |

### 8.2 2D 草图

| 功能 | 状态 | 说明 |
|------|------|------|
| 草图创建 | ✅ | `sketch.create` |
| 草图编辑 | ✅ | `sketch.edit` |
| 重合约束 | ✅ | `constraint.coincident` |
| 水平约束 | ✅ | `constraint.horizontal` |
| 垂直约束 | ✅ | `constraint.vertical` |
| 固定约束 | ✅ | `constraint.fixed` |
| 距离约束 | ✅ | `constraint.distance` |
| 角度约束 | ⚠️ | 待完善 |
| 半径约束 | ⚠️ | 待完善 |
| 切线约束 | ❌ | 待实现 |
| 同心约束 | ❌ | 待实现 |

### 8.3 参数化设计

| 功能 | 状态 | 说明 |
|------|------|------|
| 特征历史树 | ✅ | FeatureTree |
| 特征更新 | ✅ | `updateFeature()` |
| 特征抑制 | ✅ | `suppressFeature()` |
| 特征恢复 | ✅ | `suppressFeature(false)` |
| 特征删除 | ✅ | `deleteFeature()` |
| 序列化 | ✅ | `serialize()` / `deserialize()` |
| 阵列 | ❌ | 待实现 |
| 抽壳 | ❌ | 待实现 |
| 孔特征 | ❌ | 待实现 |

### 8.4 渲染与交互

| 功能 | 状态 | 说明 |
|------|------|------|
| Three.js 渲染 | ✅ | ThreeRenderer |
| 3D 视图导航 | ✅ | OrbitControls |
| 形状选择 | ✅ | Raycasting |
| 2D/3D 切换 | ✅ | 快捷键 1/2 |
| 特征树 UI | ✅ | FeatureTreePanel |
| 工程图 | ❌ | 待实现 |

---

## 9. 使用示例

### 9.1 创建参数化零件

```typescript
import { CommandStore } from './commands/CommandStore';
import { SketchSolver } from './constraints/SketchSolver';

// 1. 创建草图 (矩形)
const sketchCmd = CommandStore.create('sketch.create', {
  workplaneId: 'XY',
  segments: [
    { type: 'line', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
    { type: 'line', points: [{ x: 20, y: 0 }, { x: 20, y: 30 }] },
    { type: 'line', points: [{ x: 20, y: 30 }, { x: 0, y: 30 }] },
    { type: 'line', points: [{ x: 0, y: 30 }, { x: 0, y: 0 }] }
  ]
});
await sketchCmd.execute();

// 2. 添加距离约束
const distCmd = CommandStore.create('sketch.addConstraint', {
  sketchId: sketchCmd.id,
  constraint: SketchSolver.distance(0, 1, 20)  // 宽度 20
});
await distCmd.execute();

// 3. 求解草图
const solveCmd = CommandStore.create('sketch.solve', {
  sketchId: sketchCmd.id
});
await solveCmd.execute();

// 4. 拉伸
const extrudeCmd = CommandStore.create('sketch.extrude', {
  sketchId: sketchCmd.id,
  distance: 10  // 拉伸 10mm
});
await extrudeCmd.execute();

// 5. 修改参数 (参数化更新)
CommandStore.create('feature.update', {
  featureId: distCmd.id,
  value: 25  // 修改宽度为 25
}).execute();
```

### 9.2 布尔运算

```typescript
// 创建两个长方体
const box1 = CommandStore.create('create.box', {
  position: { x: 0, y: 0, z: 0 },
  width: 20, height: 30, depth: 10
});
await box1.execute();

const box2 = CommandStore.create('create.box', {
  position: { x: 15, y: 0, z: 0 },
  width: 15, height: 30, depth: 10
});
await box2.execute();

// 并集
const fuseCmd = CommandStore.create('boolean.fuse', {
  shapes: [box1.result, box2.result]
});
await fuseCmd.execute();

// 差集 (在 box1 上挖去 box2)
const cutCmd = CommandStore.create('boolean.cut', {
  shapeA: box1.result,
  shapesB: [box2.result]
});
await cutCmd.execute();
```

---

## 10. 性能指标

| 操作 | 目标 | 实测 | 状态 |
|------|------|------|------|
| WASM 初始化 | <2s | TBD | ⚠️ |
| 约束求解 (<10 约束) | <100ms | TBD | ⚠️ |
| 拉伸操作 | <500ms | TBD | ⚠️ |
| 网格化 (<10k 面) | <200ms | TBD | ⚠️ |
| 特征树重建 | <1s | TBD | ⚠️ |

**注**: 性能测试待完成，当前为 Alpha 版本。

---

## 11. 已知限制

### 11.1 当前不支持

- ❌ 扫掠 (Sweep)
- ❌ 放样 (Loft)
- ❌ 阵列 (Pattern)
- ❌ 抽壳 (Shell)
- ❌ 孔特征 (Hole)
- ❌ STEP/IGES 导出
- ❌ 装配体
- ❌ 工程图生成

### 11.2 待完善功能

- ⚠️ 切线/同心约束
- ⚠️ 角度/半径约束求解
- ⚠️ 拔模拉伸
- ⚠️ 开放轮廓旋转
- ⚠️ 草图有效性验证
- ⚠️ 大模型性能优化

---

## 12. 后续计划

### 短期 (1-2 周)
- [ ] 扫掠 (Sweep) 功能
- [ ] 放样 (Loft) 功能
- [ ] 线性/圆形阵列
- [ ] 完善约束类型 (角度/半径)

### 中期 (1 个月)
- [ ] 抽壳 (Shell)
- [ ] 孔特征 (Hole)
- [ ] 螺纹孔支持
- [ ] STEP 导出

### 长期 (3 个月)
- [ ] 装配体支持
- [ ] 工程图生成
- [ ] 渲染增强 (材质/灯光)
- [ ] 性能优化 (InstancedMesh, LOD)

---

## 13. 测试覆盖率

```bash
npm run test:coverage

# 预期结果:
# GeometryKernel:    85%
# SketchSolver:      90%
# Command System:    88%
# FeatureTree:       92%
# ShapeFactory:      80%
# 总体覆盖率：       >85%
```

---

## 14. 故障排除

### WASM 加载失败

**错误**: `Failed to fetch chili-wasm.wasm`

**解决**:
1. 检查 `vite.config.ts` 是否配置 `assetsInclude: ['**/*.wasm']`
2. 确认 WASM 文件路径：`src/kernel/lib/chili-wasm.wasm`
3. 清除浏览器缓存

### Three.js 渲染黑屏

**错误**: 3D 视图全黑，看不到形状

**解决**:
1. 检查灯光是否正常添加
2. 确认相机位置是否合适
3. 调用 `renderer.fitToContent()` 适配视图

### 命令执行失败

**错误**: `Command not found: create.box`

**解决**:
1. 确保命令已注册 (`@command` 装饰器)
2. 检查 CommandStore 导入路径
3. 确认命令类正确继承 `CancelableCommand`

---

## 15. 参考文档

- **Chili3D**: https://github.com/xiangechen/chili3d (架构参考)
- **OpenCascade**: https://dev.opencascade.org/ (几何内核文档)
- **Three.js**: https://threejs.org/docs/ (渲染引擎文档)

---

## 16. 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-04-12 | 3D 建模功能完整实现 (Phases 1-6) |
| 0.2 | 2026-04-11 | Phase 1-3 完成 (基础架构 + 渲染 + 特征树) |
| 0.1 | 2026-04-10 | Phase 1 完成 (OCCT WASM 集成) |

---

**维护者**: Development Team  
**最后更新**: 2026-04-12
