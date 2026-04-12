# 架构决策分析：2D/3D 分离架构 (更新版)

**日期**: 2026-03-29  
**新需求**: Digital 模式升级到 3D 建模（拉伸、旋转、放样生成 3D 模型）  
**分析者**: AI Assistant

---

## 新需求分析

### 用户工作流

#### Artistic Mode (纯 2D)
```
用户绘制 → 平滑/预测 → 2D 作品完成
              ↓
         保存为 2D 图像/矢量
```

#### Digital Mode (2D → 3D)
```
用户绘制 2D 草图 → 精确几何 → 选择轮廓 → 3D 操作
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
                拉伸 (Extrude)    旋转 (Revolve)    放样 (Loft)
                    ↓                 ↓                 ↓
                3D 实体            3D 回转体          3D 放样体
                    ↓                 ↓                 ↓
                    └─────────────────┴─────────────────┘
                                      ↓
                                3D 模型导出 (STL/OBJ)
```

### 技术需求对比

| 功能 | Artistic (2D) | Digital (2D+3D) |
|------|---------------|-----------------|
| **2D 渲染** | Canvas/WebGL | Canvas/WebGL |
| **3D 渲染** | ❌ 不需要 | ✅ Three.js/Babylon.js |
| **几何内核** | ❌ 不需要 | ✅ CGAL/OpenCASCADE |
| **网格生成** | ❌ 不需要 | ✅ 拉伸/旋转/放样算法 |
| **相机控制** | 2D 平移/缩放 | 3D 轨道控制 + 2D 视图 |
| **文件导出** | PNG/SVG | STL/OBJ/STEP + PNG/SVG |
| **交互模式** | 自由绘制 | 草图 + 特征操作 |

---

## 架构方案重新评估

### 方案 A: 分离成两个应用 (现在推荐 ⭐)

```
web-stroker-artistic/              web-stroker-digital/
(纯 2D 艺术绘制应用)                 (2D 草图 + 3D 建模应用)
├── src/                           ├── src/
│   ├── components/                │   ├── components/
│   │   └── DrawingCanvas.tsx      │   │   ├── DrawingCanvas.tsx (2D)
│   ├── hooks/                     │   │   └── ModelingCanvas.tsx (3D)
│   │   └── useArtisticDrawing.ts  │   ├── hooks/
│   ├── core/                      │   │   ├── useDigitalDrawing.ts
│   │   ├── renderers/             │   │   └── use3DModeling.ts
│   │   │   └── Canvas2DRenderer   │   ├── core/
│   │   └── store.ts               │   │   ├── renderers/
│   └── package.json               │   │   │   ├── Canvas2DRenderer
│                                  │   │   │   └── WebGL3DRenderer
│                                  │   │   ├── modeling/
│                                  │   │   │   ├── extrude.ts
│                                  │   │   │   ├── revolve.ts
│                                  │   │   │   └── loft.ts
│                                  │   │   └── store.ts
│                                  │   └── package.json
│                                  └── dependencies:
│                                      - three.js
│                                      - @types/three
│                                      - (可选) CGAL.js
```

#### ✅ 优点 (在新需求下)

1. **技术栈分离**:
   - Artistic: 轻量级，只包含 2D 渲染
   - Digital: 包含 3D 引擎和几何内核

2. **性能优化**:
   - Artistic: 无需加载 3D 库，启动快
   - Digital: 可以针对性优化 3D 性能

3. **用户体验清晰**:
   - 用户明确知道选择哪个应用
   - 避免模式混淆

4. **独立演进**:
   - Artistic: 专注艺术功能（新笔刷、形状预测）
   - Digital: 专注建模功能（布尔运算、参数化建模）

5. **依赖管理**:
   - Artistic: 小 bundle size (~500KB)
   - Digital: 可接受大 bundle (~2MB+)

6. **2D→3D 工作流清晰**:
   - 2D 草图完成后，点击"导出到 3D"
   - 可以在 Digital 应用中打开 2D 文件

#### ❌ 缺点及缓解

1. **代码重复** (~3800 行共享代码)
   - **缓解**: 提取为 npm 包 `@web-stroker/core`
   - 包含：Renderer 接口、Command 系统、Store 基础

2. **2D 文件兼容**
   - **缓解**: 定义统一文件格式标准
   - Digital 应用可以导入 Artistic 的 2D 文件

3. **用户需要记住两个 URL**
   - **缓解**: 创建门户页面 web-stroker.app
   - 提供两个应用的入口和说明

---

### 方案 B: 单一应用，按需加载 3D (备选)

```
web-stroker/
├── src/
│   ├── core/                    # 共享核心
│   │   ├── renderers/
│   │   │   ├── Canvas2DRenderer.ts
│   │   │   └── WebGL3DRenderer.ts (懒加载)
│   │   └── store/
│   ├── features/
│   │   ├── artistic/
│   │   │   └── useArtisticDrawing.ts
│   │   └── digital/
│   │       ├── useDigitalDrawing.ts
│   │       └── use3DModeling.ts (懒加载)
│   └── App.tsx
│       └── 根据模式懒加载 3D 模块
└── package.json
    dependencies:
      - three.js (optional?)
```

#### ✅ 优点

1. **单一入口**: 用户一个 URL 访问所有功能
2. **代码复用**: 共享核心逻辑
3. **2D→3D 无缝**: 同一应用内切换

#### ❌ 缺点

1. **初始加载**: 即使用户只用 2D，也需要下载 3D 库（或复杂懒加载）
2. **复杂度**: 需要处理 2D/3D 状态切换
3. **内存占用**: 3D 引擎常驻内存
4. **bundle 大小**: 即使用户只用 artistic，也要下载 digital 的 3D 代码

---

## 推荐架构：分离 + 共享核心包

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│              @web-stroker/core (npm 包)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ RenderCommand│  │  Renderer    │  │   Store      │  │
│  │   (命令系统)  │  │   (接口)     │  │   (基础)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │DrawingState  │  │ DrawingCmd   │  │   Utils      │  │
│  │  Manager     │  │   erer       │  │   (坐标等)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
              ↑                    ↑
              │ 依赖               │ 依赖
              │                    │
┌─────────────┴──────┐   ┌─────────┴──────────┐
│ web-stroker-       │   │ web-stroker-       │
│ artistic           │   │ digital            │
│ (纯 2D 应用)         │   │ (2D+3D 应用)        │
│ ┌────────────────┐ │   │ ┌────────────────┐ │
│ │ useArtistic    │ │   │ │ useDigital     │ │
│ │ Drawing        │ │   │ │ Drawing        │ │
│ └────────────────┘ │   │ └────────────────┘ │
│ ┌────────────────┐ │   │ ┌────────────────┐ │
│ │ Canvas2D       │ │   │ │ Canvas2D       │ │
│ │ Renderer       │ │   │ │ Renderer       │ │
│ └────────────────┘ │   │ └────────────────┘ │
│                    │   │ ┌────────────────┐ │
│                    │   │ │ WebGL3D        │ │
│                    │   │ │ Renderer       │ │
│                    │   │ └────────────────┘ │
│                    │   │ ┌────────────────┐ │
│                    │   │ │ 3D Modeling    │ │
│                    │   │ │ - Extrude      │ │
│                    │   │ │ - Revolve      │ │
│                    │   │ │ - Loft         │ │
│                    │   │ └────────────────┘ │
└────────────────────┘   └────────────────────┘
```

### 2D → 3D 工作流支持

#### 场景 1: 用户在 Artistic 中绘制，想转 3D

```
Artistic 应用
    ↓
用户完成 2D 绘制
    ↓
点击"导出到 Digital"
    ↓
保存为 .wstroker 文件 (包含 2D 笔划数据)
    ↓
打开 Digital 应用
    ↓
导入 .wstroker 文件
    ↓
选择轮廓 → 拉伸/旋转/放样 → 3D 模型
```

#### 场景 2: 用户直接在 Digital 中完成全流程

```
Digital 应用
    ↓
2D 草图模式绘制精确几何
    ↓
切换到 3D 模式
    ↓
选择草图轮廓
    ↓
应用 3D 操作 (拉伸/旋转/放样)
    ↓
导出 3D 模型 (STL/OBJ)
```

### 文件格式设计

```json
{
  "version": "2.0",
  "type": "artistic|digital|mixed",
  "canvas2D": {
    "strokes": [...],
    "zoom": 1,
    "pan": { "x": 0, "y": 0 }
  },
  "model3D": {
    "features": [
      {
        "type": "extrude",
        "sketchId": "sketch-1",
        "depth": 10
      }
    ],
    "meshes": [...]
  }
}
```

---

## 技术栈建议

### Artistic 应用

```json
{
  "dependencies": {
    "react": "^19",
    "zustand": "^4",
    "three": "不安装"
  },
  "bundleSize": "~500KB (gzip)"
}
```

### Digital 应用

```json
{
  "dependencies": {
    "react": "^19",
    "zustand": "^4",
    "three": "^0.160",
    "@react-three/fiber": "^8",
    "@react-three/drei": "^9",
    "@web-stroker/core": "workspace:*"
  },
  "bundleSize": "~2MB (gzip)"
}
```

### 共享 Core 包

```json
{
  "name": "@web-stroker/core",
  "exports": {
    "./renderers": "./src/renderers/index.ts",
    "./commands": "./src/commands/index.ts",
    "./managers": "./src/managers/index.ts",
    "./store": "./src/store/index.ts",
    "./utils": "./src/utils/index.ts"
  }
}
```

---

## 实施路线图

### Phase 1: 提取 Core 包 (1-2 周)

```bash
packages/
└── core/
    ├── renderers/
    ├── commands/
    ├── managers/
    └── store/
```

### Phase 2: 分离应用 (2-3 周)

```bash
apps/
├── artistic/
│   └── src/ (精简版)
└── digital/
    └── src/ (完整版)
```

### Phase 3: Digital 添加 3D 功能 (4-6 周)

1. **3D 渲染器**: Three.js 集成
2. **相机控制**: 2D/3D 视图切换
3. **拉伸功能**: 2D 轮廓 → 3D 实体
4. **旋转功能**: 2D 轮廓 → 3D 回转体
5. **放样功能**: 多轮廓 → 3D 放样体

### Phase 4: 2D→3D 工作流 (2-3 周)

1. **文件兼容**: 统一文件格式
2. **导入导出**: 应用间文件传输
3. **门户页面**: web-stroker.app 入口

---

## 决策对比 (考虑 3D 需求)

| 维度 | 分离 (推荐) | 统一 + 懒加载 |
|------|------------|--------------|
| **2D 用户体验** | ✅ 轻量快速 | 🟡 需要下载 3D 库 |
| **3D 功能扩展** | ✅ 独立演进 | 🟡 受限于共享架构 |
| **代码复用** | ✅ Core 包 | ✅ 直接共享 |
| **2D→3D 工作流** | ✅ 文件导入 | ✅ 应用内切换 |
| **维护成本** | 🟡 两个应用 | ✅ 一个应用 |
| **Bundle 大小** | ✅ 按需加载 | ❌ 全部下载 |
| **技术栈灵活** | ✅ 独立选择 | 🟡 需要兼容 |

---

## 最终推荐

### ⭐ 方案：分离成两个应用 + 共享 Core 包

**理由**:

1. **3D 需求改变了一切**:
   - Digital 需要完整的 3D 引擎
   - Artistic 用户不需要为 3D 功能付费 (下载/内存)

2. **清晰的用户定位**:
   - Artistic: "我是来画画的"
   - Digital: "我是来建模的"

3. **技术栈独立**:
   - Artistic: 保持轻量
   - Digital: 可以集成 Three.js + 几何内核

4. **2D→3D 工作流**:
   - 通过文件格式兼容
   - 可以跨应用打开文件

5. **长期演进**:
   - Artistic: 专注艺术功能
   - Digital: 专注 CAD/建模功能

---

## 下一步行动

如果同意分离方案：

1. [ ] 创建 Monorepo 结构 (pnpm workspace)
2. [ ] 提取 @web-stroker/core 包
3. [ ] 拆分 artistic 和 digital 应用
4. [ ] 实现 Digital 的 3D 基础 (Three.js 集成)
5. [ ] 设计 2D→3D 文件格式
6. [ ] 创建门户页面

---

**建议**: 开始分离架构，支持 2D→3D 工作流。这是最适合长期发展的方案。
