# 架构决策分析：分离 Artistic 和 Digital 模式

**日期**: 2026-03-29  
**提议**: 将 artistic 模式和 digital 模式分离成两个独立的 web 应用  
**分析者**: AI Assistant

---

## 当前架构状态

### 共享组件

```
共享层 (100% 复用):
├── src/store.ts (状态管理)
├── src/managers/DrawingStateManager.ts
├── src/controllers/DrawingCommander.ts
├── src/renderers/ (Canvas2D + WebGL)
├── src/renderers/commands/RenderCommand.ts
└── src/utils/ (坐标转换、几何计算)

模式特定层 (分离):
├── src/hooks/useArtisticDrawing.ts (艺术绘制)
├── src/hooks/useDigitalDrawing.ts (数字绘制)
├── src/hooks/useMeasureTools.ts (测量工具)
└── src/hooks/useSelectTool.ts (选择工具 - 部分共享)

UI 层 (共享):
├── src/components/DrawingCanvas.tsx
├── src/components/Toolbar.tsx
├── src/components/PropertyPanel.tsx
└── src/components/DrawToolPanel.tsx
```

### 代码复用分析

| 模块 | 行数 | 共享度 | 说明 |
|------|------|--------|------|
| **Renderer** | 1719 | 100% | 两个模式使用相同的渲染器 |
| **Command 系统** | 566 | 100% | 命令格式完全相同 |
| **DrawingStateManager** | 706 | 100% | 状态管理逻辑相同 |
| **DrawingCommander** | 213 | 100% | 渲染编排相同 |
| **Store** | ~600 | 80% | 大部分状态共享 (pan/zoom/strokes) |
| **Hooks** | 879 | 0% | 完全分离 (artistic vs digital) |
| **UI 组件** | ~500 | 90% | Toolbar 根据模式显示不同内容 |

**共享代码**: ~3800 行 (75%)  
**模式特定代码**: ~1000 行 (25%)

---

## 分离方案评估

### 方案 A: 完全分离 (两个独立应用)

```
web-stroker-artistic/          web-stroker-digital/
├── src/                       ├── src/
│   ├── components/            │   ├── components/
│   ├── hooks/                 │   ├── hooks/
│   │   └── useArtisticDrawing │   │   ├── useDigitalDrawing
│   ├── store.ts (精简版)      │   │   ├── useMeasureTools
│   ├── renderers/ (复制)      │   │   └── useSelectTool
│   └── managers/ (复制)       │   ├── store.ts (精简版)
└── package.json               │   ├── renderers/ (复制)
                               │   └── managers/ (复制)
                               └── package.json
```

#### ✅ 优点

1. **清晰的职责分离**: 每个应用只关注一个领域
2. **独立演进**: artistic 可以添加新功能不影响 digital
3. **减小编译体积**: 每个应用只包含必要代码
4. **独立部署**: 可以分别发布和更新
5. **用户认知清晰**: 用户不会混淆两个模式

#### ❌ 缺点

1. **代码重复**: ~3800 行共享代码需要复制两份
   - renderers/ (1719 行)
   - Command 系统 (566 行)
   - DrawingStateManager (706 行)
   - DrawingCommander (213 行)
   - Store 基础部分 (~400 行)

2. **维护成本翻倍**:
   - Bug 修复需要在两个仓库中进行
   - 功能增强需要实现两次
   - 测试需要运行两次

3. **不一致风险**:
   - 两个应用可能逐渐产生行为差异
   - 用户需要学习两个不同的界面

4. **构建/部署复杂度**:
   - 需要维护两个 CI/CD 流水线
   - 需要两个域名/入口点
   - 版本需要同步管理

5. **用户不便**:
   - 需要记住两个 URL
   - 无法在同一会话中切换模式
   - 文件不兼容风险

---

### 方案 B: 保持统一，增强隔离 (推荐)

```
web-stroker/ (单一应用)
├── src/
│   ├── components/
│   │   └── DrawingCanvas.tsx (事件路由)
│   ├── hooks/
│   │   ├── artistic/ (艺术模式专用)
│   │   │   └── useArtisticDrawing.ts
│   │   └── digital/ (数字模式专用)
│   │       ├── useDigitalDrawing.ts
│   │       ├── useMeasureTools.ts
│   │       └── useSelectTool.ts
│   ├── core/ (共享核心)
│   │   ├── renderers/
│   │   ├── commands/
│   │   ├── managers/
│   │   └── store.ts
│   └── ui/ (共享 UI)
│       ├── Toolbar.tsx
│       └── PropertyPanel.tsx
└── package.json
```

#### ✅ 优点

1. **代码复用**: 75% 代码共享，避免重复
2. **单一维护点**: Bug 修复一次完成
3. **一致性保证**: 两个模式使用相同的核心逻辑
4. **用户便利**: 同一应用内切换模式
5. **文件兼容**: 两种模式的文件可以在同一应用中打开
6. **构建简单**: 单一 CI/CD 流水线

#### ❌ 缺点

1. **模式切换逻辑**: 需要在 UI 层处理模式切换
2. **代码组织**: 需要清晰的目录结构区分共享/特定代码
3. **初始复杂度**: 需要理解架构分层

---

### 方案 C: 混合方案 (Monorepo)

```
web-stroker/ (Monorepo)
├── packages/
│   ├── core/ (共享核心 - npm 包)
│   │   ├── renderers/
│   │   ├── commands/
│   │   ├── managers/
│   │   └── store-base.ts
│   ├── artistic/ (艺术模式应用)
│   │   ├── src/
│   │   │   ├── hooks/useArtisticDrawing.ts
│   │   │   └── main.tsx
│   │   └── package.json
│   └── digital/ (数字模式应用)
│       ├── src/
│       │   ├── hooks/ (digital 专用)
│       │   └── main.tsx
│       └── package.json
├── package.json (workspace)
└── tsconfig.json
```

#### ✅ 优点

1. **代码复用**: 通过 npm 包共享核心逻辑
2. **独立部署**: 两个应用可以分别构建和部署
3. **清晰边界**: 核心层和应用层分离
4. **版本管理**: core 可以独立版本化

#### ❌ 缺点

1. **复杂度**: Monorepo 管理复杂
2. **构建时间**: 需要构建多个包
3. **本地开发**: 需要 workspace 配置
4. **过度工程**: 对于当前项目规模可能过于复杂

---

## 详细对比

| 维度 | 方案 A: 完全分离 | 方案 B: 统一隔离 | 方案 C: Monorepo |
|------|-----------------|-----------------|-----------------|
| **代码复用** | ❌ 0% (复制两份) | ✅ 75% | ✅ 75% |
| **维护成本** | ❌ 高 (2x) | ✅ 低 (1x) | 🟡 中 (1.5x) |
| **构建复杂度** | ✅ 低 (简单) | ✅ 低 (简单) | ❌ 高 (Monorepo) |
| **部署复杂度** | ❌ 高 (两个应用) | ✅ 低 (一个应用) | 🟡 中 (两个应用) |
| **用户体验** | ❌ 差 (两个 URL) | ✅ 好 (一个应用) | ❌ 差 (两个 URL) |
| **文件兼容** | ❌ 风险高 | ✅ 完全兼容 | 🟡 需要约定 |
| **演进灵活性** | ✅ 高 (独立演进) | 🟡 中 (需要协调) | ✅ 高 (核心稳定) |
| **适合规模** | 大型项目 | 中小型项目 | 大型项目 |

---

## 推荐方案：**方案 B - 保持统一，增强隔离**

### 理由

1. **当前项目规模**: ~5000 行代码，属于中小型项目
2. **高共享度**: 75% 代码完全共享
3. **用户需求**: 用户可能需要在两种模式间切换
4. **维护效率**: 单一代码库便于快速迭代
5. **文件兼容**: 两种模式的文件可以互相打开

### 实施建议

#### 1. 重构目录结构

```
src/
├── core/                    # 共享核心 (不依赖模式)
│   ├── renderers/
│   ├── commands/
│   ├── managers/
│   ├── store/
│   │   ├── index.ts         # Store 创建
│   │   ├── types.ts         # 共享类型
│   │   └── slices/          # 状态切片
│   │       ├── canvas.ts    # pan/zoom/strokes
│   │       ├── artistic.ts  # artistic 特定状态
│   │       └── digital.ts   # digital 特定状态
│   └── utils/
├── features/                # 模式特定功能
│   ├── artistic/
│   │   ├── hooks/
│   │   │   └── useArtisticDrawing.ts
│   │   └── components/      # artistic 专用 UI
│   └── digital/
│       ├── hooks/
│       │   ├── useDigitalDrawing.ts
│       │   ├── useMeasureTools.ts
│       │   └── useSelectTool.ts
│       └── components/      # digital 专用 UI
├── components/              # 共享 UI
│   ├── DrawingCanvas.tsx    # 事件路由
│   ├── Toolbar.tsx          # 模式切换
│   └── PropertyPanel.tsx
└── App.tsx
```

#### 2. 明确模式边界

```typescript
// core/store/slices/artistic.ts
export interface ArtisticState {
  artisticTool: ArtisticTool;
  strokeMode: 'original' | 'smooth' | 'predict';
  // ... artistic 特定状态
}

// core/store/slices/digital.ts
export interface DigitalState {
  digitalTool: DigitalTool;
  digitalMode: 'select' | 'draw';
  measureTool: MeasureTool | null;
  // ... digital 特定状态
}

// features/artistic/hooks/useArtisticDrawing.ts
// 只依赖 ArtisticState，不访问 DigitalState

// features/digital/hooks/useDigitalDrawing.ts
// 只依赖 DigitalState，不访问 ArtisticState
```

#### 3. 模式切换清晰化

```typescript
// components/Toolbar.tsx
{store.toolCategory === 'artistic' && (
  <ArtisticToolbar />
)}
{store.toolCategory === 'digital' && (
  <DigitalToolbar />
)}
{store.toolCategory === 'measure' && (
  <MeasureToolbar />
)}
```

---

## 何时考虑分离？

### 触发条件 (满足任一即考虑分离)

1. **代码共享度 < 50%**: 两个模式的核心逻辑差异很大
2. **团队规模 > 10 人**: 需要独立团队维护不同模式
3. **发布频率差异大**: artistic 每周发布，digital 每月发布
4. **用户需求明确**: 大量用户要求独立应用
5. **性能瓶颈**: 共享代码导致无法针对性优化

### 当前状态评估

| 条件 | 当前状态 | 是否触发 |
|------|----------|----------|
| 代码共享度 | 75% | ❌ |
| 团队规模 | 1-2 人 | ❌ |
| 发布频率 | 同步发布 | ❌ |
| 用户需求 | 无明确反馈 | ❌ |
| 性能瓶颈 | 无明显瓶颈 | ❌ |

**结论**: 当前**不适合**分离，应保持统一架构。

---

## 风险缓解

### 如果保持统一，需要注意：

1. **避免模式耦合**:
   - hooks 之间不直接调用
   - 状态更新通过 store 进行
   - UI 组件根据模式条件渲染

2. **清晰的责任边界**:
   - 文档化每个模块的职责
   - 代码审查时检查边界
   - 添加架构测试验证隔离

3. **性能隔离**:
   - artistic 的频繁更新不影响 digital
   - 使用 React.memo 优化渲染
   - 按需加载模式特定代码

4. **测试策略**:
   - 单元测试按模式分组
   - E2E 测试覆盖两种模式
   - 回归测试确保模式切换正常

---

## 决策总结

### 推荐：**方案 B - 保持统一，增强隔离**

**核心理由**:
1. 75% 代码共享，分离会导致大量重复
2. 用户受益于模式切换的便利性
3. 维护成本低，适合当前团队规模
4. 文件兼容性好，用户体验统一

**实施成本**: 低 (只需重构目录结构)  
**长期收益**: 高 (维护效率、用户体验)  
**风险**: 低 (架构清晰，边界明确)

---

## 下一步行动

如果同意方案 B：

1. [ ] 重构目录结构 (core/, features/)
2. [ ] 添加架构测试验证隔离
3. [ ] 更新文档说明模式边界
4. [ ] 优化模式切换 UX

如果考虑方案 A 或 C：

1. [ ] 进行用户调研确认需求
2. [ ] 评估维护成本增加
3. [ ] 制定迁移计划
4. [ ] 考虑文件兼容方案

---

**建议**: 保持统一架构，通过目录重构增强隔离。6 个月后重新评估。
