# web-stroker 3D 功能文档

> 版本：0.1.0 (Alpha)  
> 更新日期：2026-04-11

---

## 概述

web-stroker 现在支持**3D 参数化建模**功能，基于 OpenCascade 几何内核和 Three.js 渲染引擎。

### 核心功能

- ✅ 基础 3D 形状创建 (长方体、圆柱体、球体)
- ✅ 布尔运算 (并集、差集、交集)
- ✅ 修改操作 (圆角、倒角)
- ✅ 特征历史树管理
- ✅ 参数化设计支持
- ✅ 3D 视图导航 (旋转、平移、缩放)
- ✅ 2D/3D 视图切换

---

## 快速开始

### 1. 安装依赖

```bash
npm install three @types/three
```

### 2. 配置 Vite

在 `vite.config.ts` 中添加 WASM 支持:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['**/*.wasm']
  }
});
```

### 3. 启动应用

```bash
npm run dev
```

### 4. 切换到 3D 视图

- 按 `1` 键 - 切换到 3D 视图
- 按 `2` 键 - 切换到 2D 视图

---

## 使用指南

### 创建 3D 形状

#### 方法 1: 使用命令 (推荐)

```typescript
import { CommandStore } from './commands/CommandStore';

// 创建长方体
const boxCmd = CommandStore.create('create.box', {
    position: { x: 0, y: 0, z: 0 },
    width: 10,
    height: 20,
    depth: 30,
    color: '#ff0000'
});
await boxCmd.execute();

// 创建圆柱体
const cylinderCmd = CommandStore.create('create.cylinder', {
    position: { x: 50, y: 0, z: 0 },
    radius: 10,
    height: 30,
    color: '#00ff00'
});
await cylinderCmd.execute();

// 创建球体
const sphereCmd = CommandStore.create('create.sphere', {
    position: { x: 100, y: 0, z: 0 },
    radius: 15,
    color: '#0000ff'
});
await sphereCmd.execute();
```

#### 方法 2: 直接使用 API

```typescript
import { kernel } from './kernel';
import { ShapeFactory } from './kernel/ShapeFactory';

await kernel.initialize();

const plane = {
    origin: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 }
};

// 创建长方体
const box = ShapeFactory.box(plane, 10, 20, 30);
if (box.isOk) {
    console.log('Box created:', box.value.id);
}

// 创建圆柱体
const cylinder = ShapeFactory.cylinder(plane, 10, 30);
if (cylinder.isOk) {
    console.log('Cylinder created:', cylinder.value.id);
}

// 创建球体
const sphere = ShapeFactory.sphere({ x: 0, y: 0, z: 0 }, 15);
if (sphere.isOk) {
    console.log('Sphere created:', sphere.value.id);
}
```

### 布尔运算

```typescript
import { ShapeFactory } from './kernel/ShapeFactory';

// 假设有两个形状 shapeA 和 shapeB

// 并集 (Union)
const union = ShapeFactory.fuse(shapeA, shapeB);

// 差集 (Subtract)
const cut = ShapeFactory.cut(shapeA, shapeB);

// 交集 (Intersect)
const common = ShapeFactory.common(shapeA, shapeB);
```

### 修改操作

```typescript
import { ShapeFactory } from './kernel/ShapeFactory';

// 圆角 (Fillet)
// edgeIndices 是要倒圆角的边索引数组
const fillet = ShapeFactory.fillet(shape, [0, 1, 2], 2.0);

// 倒角 (Chamfer)
const chamfer = ShapeFactory.chamfer(shape, [0, 1, 2], 2.0);
```

### 特征树管理

```typescript
import { featureTreeInstance, createExtrudeFeature } from './kernel/FeatureTree';

// 添加特征
const extrudeFeature = createExtrudeFeature('sketch-001', 50);
featureTreeInstance.addFeature(extrudeFeature);

// 更新特征参数
featureTreeInstance.updateFeature(extrudeFeature.id, {
    distance: 60  // 修改拉伸距离
});

// 抑制特征
featureTreeInstance.suppressFeature(extrudeFeature.id, true);

// 删除特征
featureTreeInstance.deleteFeature(extrudeFeature.id);

// 获取所有特征
const allFeatures = featureTreeInstance.getAllFeatures();

// 获取树形结构
const treeStructure = featureTreeInstance.getTreeStructure();
```

---

## 3D 视图导航

### 鼠标操作

| 操作 | 鼠标动作 |
|------|---------|
| 旋转视图 | 左键拖拽 |
| 平移视图 | 右键拖拽 / 中键拖拽 |
| 缩放 | 滚轮滚动 |
| 选择形状 | 左键点击 |
| 适配视图 | 双击背景 |

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` | 切换到 3D 视图 |
| `2` | 切换到 2D 视图 |
| `F` | 适配视图到内容 |
| `H` | 显示/隐藏辅助网格 |

---

## API 参考

### GeometryKernel

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
    
    // 网格化
    tessellate(shape): MeshData
}
```

### ShapeFactory

```typescript
class ShapeFactory {
    static box(plane, dx, dy, dz): Result<IShape>
    static cylinder(plane, radius, height): Result<IShape>
    static sphere(center, radius): Result<IShape>
    static extrude(sketch, distance, taperAngle?): Result<IShape>
    static revolve(sketch, axisStart, axisEnd, angle): Result<IShape>
    static fuse(shapeA, shapeB): Result<IShape>
    static cut(shapeA, shapeB): Result<IShape>
    static common(shapeA, shapeB): Result<IShape>
    static fillet(shape, edgeIndices, radius): Result<IShape>
    static chamfer(shape, edgeIndices, distance): Result<IShape>
}
```

### FeatureTree

```typescript
class FeatureTree {
    addFeature(feature: Feature): void
    deleteFeature(id: string): void
    updateFeature(id: string, params: Record<string, any>): void
    suppressFeature(id: string, suppressed: boolean): void
    rebuildFrom(id: string): void
    getAllFeatures(): Feature[]
    getRootFeatures(): Feature[]
    getTreeStructure(): any[]
    serialize(): any
    deserialize(data: any): void
}
```

### ThreeRenderer

```typescript
class ThreeRenderer {
    constructor(config: ThreeRendererConfig)
    
    addShape(shapeData: Shape3DData): void
    removeShape(shapeId: string): void
    addWorkplane(workplane: Workplane): void
    removeWorkplane(id: string): void
    fitToContent(): void
    setCameraPosition(position, target?): void
    getScene(): THREE.Scene
    getCamera(): THREE.PerspectiveCamera
    dispose(): void
}
```

---

## 数据类型

### Shape3DData

```typescript
interface Shape3DData {
    id: string;
    type: 'box' | 'cylinder' | 'sphere' | 'extrusion' | ...;
    shape: IShape;  // OCCT 形状引用
    position: Point3D;
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    visible: boolean;
    color: string;
    dimensions?: {
        width?: number;
        height?: number;
        depth?: number;
        radius?: number;
    };
    featureId?: string;
}
```

### Feature

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

### Point3D

```typescript
interface Point3D {
    x: number;
    y: number;
    z: number;
}
```

---

## 事件系统

### 自定义事件

```typescript
// 形状创建
window.addEventListener('shape-created', (e: CustomEvent<Shape3DData>) => {
    console.log('Shape created:', e.detail);
});

// 形状删除
window.addEventListener('shape-removed', (e: CustomEvent<{ id: string }>) => {
    console.log('Shape removed:', e.detail.id);
});

// 对象选中
window.addEventListener('object-selected', (e: CustomEvent<{ objectId: string }>) => {
    console.log('Object selected:', e.detail.objectId);
});

// 对象悬停
window.addEventListener('object-hovered', (e: CustomEvent<{ objectId: string | null }>) => {
    console.log('Object hovered:', e.detail.objectId);
});

// 特征树变更
window.addEventListener('feature-tree-changed', (e: CustomEvent) => {
    console.log('Feature tree changed');
});
```

---

## 限制与已知问题

### 当前限制

1. **拉伸/旋转**: 需要 2D 草图支持，目前仅框架完成
2. **扫掠/放样**: 未实现
3. **文件导入导出**: STEP/IGES 支持待开发
4. **参数化驱动**: 特征树重建逻辑待完善
5. **约束求解**: Solvespace 集成待开发

### 已知问题

1. WASM 文件加载可能需要额外配置
2. 大模型性能优化待改进
3. 形状选择精度需调整
4. 刷新页面后数据丢失 (未持久化)

---

## 开发计划

### 阶段 4 (约束求解器)
- [ ] 集成 Solvespace WASM
- [ ] 2D 草图约束系统
- [ ] 参数化尺寸驱动

### 阶段 5 (2D→3D 完善)
- [ ] 完善拉伸操作
- [ ] 完善旋转操作
- [ ] 实现扫掠
- [ ] 实现放样

### 阶段 6 (高级功能)
- [ ] STEP/IGES 导入导出
- [ ] 阵列特征
- [ ] 抽壳操作
- [ ] 孔特征

---

## 故障排除

### WASM 加载失败

**错误**: `Failed to fetch chili-wasm.wasm`

**解决**:
1. 检查 `vite.config.ts` 是否配置 `assetsInclude: ['**/*.wasm']`
2. 确保 WASM 文件在正确路径：`src/kernel/lib/chili-wasm.wasm`
3. 清除浏览器缓存

### Three.js 渲染黑屏

**错误**: 3D 视图全黑，看不到形状

**解决**:
1. 检查灯光是否正常添加
2. 确认相机位置是否合适
3. 调用 `fitToContent()` 适配视图

### 命令执行失败

**错误**: `Command not found: create.box`

**解决**:
1. 确保命令已注册 (使用 `@command` 装饰器)
2. 检查 CommandStore 导入路径
3. 确认命令类已正确继承 `CancelableCommand`

---

## 许可证

与主项目保持一致。

---

## 贡献

欢迎提交 Issue 和 Pull Request!
