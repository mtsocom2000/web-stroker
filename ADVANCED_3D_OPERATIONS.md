# 高级 3D 操作文档

> 版本：0.3.0  
> 更新日期：2026-04-12

---

## 更新概述

### ✅ 已移除
- **Artistic 模式**: 完全移除艺术画笔模式，专注于数字建模
  - 移除 `ArtisticTool` 类型
  - 移除 `artistic` ToolCategory
  - `StrokeType` 现在只有 `'digital'`

### ✅ 新增功能
1. **扫掠 (Sweep)**: 沿路径扫掠截面创建 3D 实体
2. **放样 (Loft)**: 在多个截面之间放样创建 3D 实体
3. **抽壳 (Shell)**: 将实体抽壳成薄壁结构

---

## 新增 API

### 1. 扫掠 (Sweep)

```typescript
ShapeFactory.sweep(section: Sketch3D, path: Sketch3D): Result<IShape>
```

**参数**:
- `section`: 截面草图 (必须闭合)
- `path`: 路径草图 (通常开放)

**示例**:
```typescript
const section: Sketch3D = {
    id: 'section-1',
    workplaneId: 'XY',
    segments: [ /* 矩形截面 */ ],
    isClosed: true
};

const path: Sketch3D = {
    id: 'path-1',
    workplaneId: 'XZ',
    segments: [ /* 直线路径 */ ],
    isClosed: false
};

const result = ShapeFactory.sweep(section, path);
if (result.isOk) {
    console.log('Sweep created:', result.value.id);
}
```

**OCCT 实现**: `BRepOffsetAPI_MakePipe`

---

### 2. 放样 (Loft)

```typescript
ShapeFactory.loft(sketches: Sketch3D[]): Result<IShape>
```

**参数**:
- `sketches`: 截面草图数组 (至少 2 个)

**示例**:
```typescript
const sketches: Sketch3D[] = [
    { id: 'section-1', /* 底部截面 */ },
    { id: 'section-2', /* 中间截面 */ },
    { id: 'section-3', /* 顶部截面 */ }
];

const result = ShapeFactory.loft(sketches);
if (result.isOk) {
    console.log('Loft created:', result.value.id);
}
```

**OCCT 实现**: `BRepOffsetAPI_ThruSections`

---

### 3. 抽壳 (Shell)

```typescript
ShapeFactory.shell(shape: IShape, facesToRemove: number[], thickness: number): Result<IShape>
```

**参数**:
- `shape`: 基础实体
- `facesToRemove`: 要移除的面索引数组
- `thickness`: 壳体厚度

**示例**:
```typescript
// 创建一个长方体
const box = ShapeFactory.box(plane, 20, 20, 20);

// 抽壳 (移除顶面 [5], 厚度 2mm)
if (box.isOk) {
    const result = ShapeFactory.shell(box.value, [5], 2);
    if (result.isOk) {
        console.log('Shell created:', result.value.id);
    }
}
```

**OCCT 实现**: `BRepOffsetAPI_MakeThickSolid`

---

## 命令系统

### SweepCommand

```typescript
CommandStore.create('3d.sweep', {
    sectionSketchId: 'sketch-001',
    pathSketchId: 'sketch-002'
});
```

### LoftCommand

```typescript
CommandStore.create('3d.loft', {
    sketchIds: ['sketch-001', 'sketch-002', 'sketch-003']
});
```

### ShellCommand

```typescript
CommandStore.create('3d.shell', {
    shapeId: 'shape-001',
    facesToRemove: [5],
    thickness: 2
});
```

---

## 使用场景

### 扫掠 (Sweep)
- 管道系统
- 电线/电缆
- 装饰线条
- 沿曲线挤压的型材

### 放样 (Loft)
- 渐变截面
- 空气动力学外形
- 艺术造型
- 复杂过渡曲面

### 抽壳 (Shell)
- 薄壁零件
- 容器/盒子
- 外壳设计
- 减轻重量

---

## 技术实现

### 扫掠流程
```
1. Section Sketch → OCCT Wire
2. Path Sketch → OCCT Wire
3. BRepOffsetAPI_MakePipe(pathWire, sectionWire)
4. Build → Shape
```

### 放样流程
```
1. Multiple Sketches → OCCT Wires
2. BRepOffsetAPI_ThruSections()
3. AddWire() for each section
4. Build() → Shape
```

### 抽壳流程
```
1. Base Shape (must be solid)
2. BRepOffsetAPI_MakeThickSolid(shape, faces, thickness)
3. Build → Hollow Shape
```

---

## 限制与注意事项

### 扫掠
- ✅ 截面必须闭合
- ✅ 路径通常开放
- ⚠️ 路径不能自相交
- ⚠️ 截面方向影响结果

### 放样
- ✅ 至少需要 2 个截面
- ✅ 截面应该拓扑相似
- ⚠️ 截面数量影响性能
- ⚠️ 截面间距影响质量

### 抽壳
- ✅ 基础必须是实体
- ✅ 可以移除多个面
- ⚠️ 厚度不能超过最小特征尺寸
- ⚠️ 复杂形状可能失败

---

## 测试

运行高级操作测试：
```bash
npm run test -- src/__tests__/AdvancedOperations.test.ts
```

测试覆盖：
- ✅ Sweep 基本功能
- ✅ Loft 多截面
- ✅ Loft 错误处理 (< 2 sketches)
- ✅ Shell 抽壳操作

---

## 性能考虑

| 操作 | 复杂度 | 建议 |
|------|--------|------|
| Sweep | 中等 | 路径点数 < 100 |
| Loft | 高 | 截面数 < 10 |
| Shell | 中等 | 厚度 > 0.1mm |

---

## 下一步计划

- [ ] 添加管道 (Pipe) 操作
- [ ] 添加加厚 (Thicken) 操作
- [ ] 添加拔模 (Draft) 操作
- [ ] 优化扫掠路径控制
- [ ] 支持引导线放样

---

## 相关文档

- [3D 功能使用指南](README-3D-FEATURES.md)
- [实现总结](IMPLEMENTATION_SUMMARY.md)
- [测试指南](TESTING.md)
