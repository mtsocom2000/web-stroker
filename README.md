# Web Stroker - 3D 参数化建模工具

> 基于 Web 的专业 3D CAD 建模工具  
> 版本：0.3.0 | 更新日期：2026-04-12

[![Test Status](https://img.shields.io/badge/tests-534%20passed-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)]()

---

## 🎯 功能特性

### 3D 建模
- ✅ **基础形状**: 长方体、圆柱体、球体
- ✅ **2D→3D**: 拉伸 (Extrude)、旋转 (Revolve)、扫掠 (Sweep)、放样 (Loft)
- ✅ **布尔运算**: 并集、差集、交集
- ✅ **修改操作**: 圆角 (Fillet)、倒角 (Chamfer)、抽壳 (Shell)

### 2D 草图
- ✅ **参数化草图**: 基于约束的 2D 草图系统
- ✅ **约束求解**: Newton-Raphson 数值求解器
- ✅ **几何约束**: 重合、水平、垂直、平行
- ✅ **尺寸约束**: 距离、角度、半径

### 特征管理
- ✅ **特征历史树**: 参数化设计历史
- ✅ **特征编辑**: 更新、抑制、删除
- ✅ **序列化**: 支持保存/加载

### 渲染与交互
- ✅ **Three.js 渲染**: 实时 3D 可视化
- ✅ **视图导航**: 旋转、平移、缩放
- ✅ **形状选择**: 射线检测
- ✅ **工作平面**: 多平面建模支持

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm run test          # 监听模式
npm run test:run      # 运行一次
npm run test:coverage # 生成覆盖率报告
```

---

## 📖 使用示例

### 创建长方体

```typescript
import { CommandStore } from './commands/CommandStore';

const box = CommandStore.create('create.box', {
    position: { x: 0, y: 0, z: 0 },
    width: 10,
    height: 20,
    depth: 30
});

await box.execute();
```

### 创建草图并拉伸

```typescript
// 1. 创建草图
const sketch = CommandStore.create('sketch.create', {
    workplaneId: 'XY',
    segments: [
        { type: 'line', startPoint: {x:0,y:0}, endPoint: {x:10,y:0} },
        { type: 'line', startPoint: {x:10,y:0}, endPoint: {x:10,y:10} },
        { type: 'line', startPoint: {x:10,y:10}, endPoint: {x:0,y:10} },
        { type: 'line', startPoint: {x:0,y:10}, endPoint: {x:0,y:0} }
    ]
});
await sketch.execute();

// 2. 添加约束
const dist = CommandStore.create('sketch.addConstraint', {
    sketchId: sketch.id,
    constraint: SketchSolver.distance(0, 1, 20)  // 边长 20mm
});
await dist.execute();

// 3. 求解草图
const solve = CommandStore.create('sketch.solve', { sketchId: sketch.id });
await solve.execute();

// 4. 拉伸
const extrude = CommandStore.create('sketch.extrude', {
    sketchId: sketch.id,
    distance: 30
});
await extrude.execute();
```

### 高级操作

```typescript
// 扫掠
const sweep = CommandStore.create('3d.sweep', {
    sectionSketchId: 'section-1',
    pathSketchId: 'path-1'
});
await sweep.execute();

// 放样
const loft = CommandStore.create('3d.loft', {
    sketchIds: ['sketch-1', 'sketch-2', 'sketch-3']
});
await loft.execute();

// 抽壳
const shell = CommandStore.create('3d.shell', {
    shapeId: 'box-1',
    facesToRemove: [5],  // 移除顶面
    thickness: 2
});
await shell.execute();
```

---

## 🏗️ 架构设计

### 技术栈
- **语言**: TypeScript 5.9
- **框架**: React 19 + Vite 7
- **状态管理**: Zustand
- **3D 渲染**: Three.js
- **几何内核**: OCCT WASM (OpenCascade)
- **测试**: Vitest

### 分层架构

```
┌─────────────────────────────────────┐
│      Presentation Layer             │
│  (React Components, Three.js View)  │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│      Application Layer              │
│  (Commands, Events, State Mgmt)     │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│      Domain Layer                   │
│  (FeatureTree, SketchSolver, etc)   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│      Infrastructure Layer           │
│  (OCCT WASM, Three.js, Storage)     │
└─────────────────────────────────────┘
```

### 设计模式
- **命令模式**: 所有用户操作封装为命令
- **事务模式**: 批量操作原子性执行
- **工厂模式**: ShapeFactory 封装几何创建
- **观察者模式**: 事件系统解耦模块

---

## 📁 项目结构

```
web-stroker/
├── src/
│   ├── kernel/              # 几何内核封装
│   │   ├── lib/             # OCCT WASM (15.8MB)
│   │   ├── GeometryKernel.ts
│   │   ├── ShapeFactory.ts
│   │   ├── SketchConverter.ts
│   │   └── FeatureTree.ts
│   │
│   ├── renderers/           # 渲染器
│   │   ├── ThreeRenderer.ts
│   │   └── Canvas2DRenderer.ts
│   │
│   ├── commands/            # 命令系统
│   │   ├── Command.ts
│   │   ├── CommandStore.ts
│   │   ├── CreateShapeCommand.ts
│   │   ├── SketchCommands.ts
│   │   └── AdvancedShapeCommands.ts
│   │
│   ├── constraints/         # 约束求解器
│   │   └── SketchSolver.ts
│   │
│   ├── components/          # React 组件
│   │   ├── ThreeViewCanvas.tsx
│   │   └── FeatureTreePanel.tsx
│   │
│   ├── foundation/          # 基础架构
│   │   └── Transaction.ts
│   │
│   ├── __tests__/           # 单元测试 (534 个用例)
│   │
│   ├── types.ts             # 类型定义
│   ├── types3d.ts           # 3D 类型
│   ├── store.ts             # Zustand Store
│   └── App.tsx              # 主应用
│
├── README.md                # 本文档
├── ADVANCED_3D_OPERATIONS.md # 高级操作指南
├── TESTING.md               # 测试指南
└── IMPLEMENTATION_SUMMARY.md # 实现总结
```

---

## 🧪 测试

### 测试覆盖

| 模块 | 测试用例 | 状态 |
|------|---------|------|
| GeometryKernel | 15+ | ✅ |
| SketchSolver | 20+ | ✅ |
| Command System | 15+ | ✅ |
| FeatureTree | 20+ | ✅ |
| ShapeFactory | 12+ | ✅ |
| Advanced Operations | 4+ | ✅ |
| **总计** | **534** | ✅ |

### 运行测试

```bash
# 完整测试套件
npm run test:run

# 特定模块测试
npm run test -- src/kernel/__tests__/GeometryKernel.test.ts
npm run test -- src/constraints/__tests__/SketchSolver.test.ts
npm run test -- src/__tests__/AdvancedOperations.test.ts
```

---

## 📚 文档

- [3D 功能使用指南](README-3D-FEATURES.md)
- [高级 3D 操作](ADVANCED_3D_OPERATIONS.md)
- [测试指南](TESTING.md)
- [实现总结](IMPLEMENTATION_SUMMARY.md)

---

## 🔧 开发

### 配置要求
- Node.js 20+
- npm 或 yarn
- 现代浏览器 (Chrome/Edge/Firefox)

### 构建配置

```typescript
// vite.config.ts
export default defineConfig({
  assetsInclude: ['**/*.wasm'],  // WASM 支持
  test: {
    globals: true,
    environment: 'happy-dom',
  }
})
```

### 代码规范

```bash
# 代码检查
npm run lint

# 格式化
npm run format
```

---

## 📊 性能指标

| 操作 | 目标 | 实测 |
|------|------|------|
| WASM 初始化 | <2s | ~1.5s |
| 约束求解 (<10 约束) | <100ms | ~50ms |
| 拉伸操作 | <500ms | ~200ms |
| 网格化 (<10k 面) | <200ms | ~100ms |
| 特征树重建 | <1s | ~300ms |

---

## 🛠️ 技术亮点

### 1. OCCT WASM 集成
- 15.8MB 工业级几何内核
- 支持 B-Rep 建模
- 精确布尔运算
- STEP/IGES 支持 (待实现)

### 2. 约束求解器
- Newton-Raphson 数值方法
- 支持几何/尺寸约束
- 实时求解 (<100ms)

### 3. 特征历史树
- 参数化设计
- 特征编辑与更新
- 撤销/重做支持

### 4. 命令系统
- 所有操作可撤销
- 事务原子性
- 命令缓存与重用

---

## 🚧 路线图

### 已完成 (v0.3.0)
- ✅ 基础 3D 形状
- ✅ 2D→3D 操作 (Extrude/Revolve/Sweep/Loft)
- ✅ 布尔运算
- ✅ 修改操作 (Fillet/Chamfer/Shell)
- ✅ 约束求解器
- ✅ 特征历史树
- ✅ Three.js 渲染
- ✅ 534 个单元测试

### 计划中 (v0.4.0)
- [ ] STEP/IGES 导入导出
- [ ] 阵列特征 (线性/圆形)
- [ ] 孔特征
- [ ] 拔模操作
- [ ] 装配体支持

### 长期目标
- [ ] 工程图生成
- [ ] 渲染增强 (材质/灯光)
- [ ] 协同编辑
- [ ] 插件系统

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

### 开发流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- **OpenCascade**: 工业级几何内核
- **Three.js**: WebGL 3D 库
- **Chili3D**: 架构参考
- **Vite**: 现代构建工具

---

## 📬 联系方式

- **GitHub**: https://github.com/mtsocom2000/web-stroker
- **Issues**: https://github.com/mtsocom2000/web-stroker/issues
- **当前分支**: `feature/3d-modeling`

---

<div align="center">

**Web Stroker** - 让 3D 建模更简单

Made with ❤️ using TypeScript + OCCT + Three.js

</div>
