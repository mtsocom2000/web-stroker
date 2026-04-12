# Web Stroker 文档索引

**最后更新**: 2026-04-12  
**重构状态**: Phase 1-5 ✅ 完成  
**文档清理**: ✅ 完成 (删除 6 文件，归档 3 文件)

---

## 📚 核心文档

### 架构文档
| 文档 | 状态 | 说明 |
|------|------|------|
| [`ARCHITECTURE_v2.md`](./ARCHITECTURE_v2.md) | ✅ **最新** | **当前架构 v2.0** - 完整架构设计文档 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 🟡 参考 | 原始架构设计文档（v1.0，详细但部分过时） |
| [`ARCHITECTURE_CURRENT.md`](./ARCHITECTURE_CURRENT.md) | 🟡 参考 | Phase 4&5 重构后架构说明（已过时） |

### 重构文档
| 文档 | 状态 | 说明 |
|------|------|------|
| [`REFACTORING_PLAN.md`](./REFACTORING_PLAN.md) | ✅ 已完成 | 重构计划（Phase 1-5 全部完成，已标注） |

### 决策记录
| 文档 | 状态 | 说明 |
|------|------|------|
| [`SPLIT_ANALYSIS_3D.md`](./SPLIT_ANALYSIS_3D.md) | 📁 已归档 | 2D/3D 分离架构分析（含 3D 建模需求） |
| [`SPLIT_ANALYSIS.md`](./SPLIT_ANALYSIS.md) | 📁 已归档 | 分离架构初步分析 |
| [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) | 📁 已归档 | 架构审查报告 |

---

## 🗂️ 子目录

### `algorithm/` - 算法文档
- `smooth.md` - 平滑算法说明

### `implementation/` - 实现细节
- `ARTISTIC.md` - 艺术模式实现
- `PREDICT.md` - 形状预测实现

---

## 📖 推荐阅读顺序

### 新开发者
1. 📘 [ARCHITECTURE_v2.md](./ARCHITECTURE_v2.md) - **当前架构 v2.0**
2. 📗 [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - 了解重构历史
3. 📙 [ARCHITECTURE.md](./ARCHITECTURE.md) - 详细设计参考

### 架构师/贡献者
1. [ARCHITECTURE_v2.md](./ARCHITECTURE_v2.md) - 当前架构
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - 详细设计
3. `archive/` - 历史决策记录

---

## 📊 重构成果总结

### Phase 1-5 完成 (2026-04-12)

**代码精简**:
```
DrawingCanvas: 3130 行 → 419 行 (-87%)
删除未使用文件：6 个 (~47KB)
归档历史文档：3 个 (~35KB)
新增架构文档：ARCHITECTURE_v2.md (12KB)
净减少：~1900 行代码
```

**新架构**:
```
6 个专用 hooks
├── useSnapSystem (坐标 + 吸附)
├── useSelectTool (选择/拖拽)
├── useMeasureTools (测量工具)
├── useArtisticDrawing (艺术绘制)
├── useDigitalDrawing (数字绘制)
└── useConstraints (约束管理)

核心组件
├── DrawingStateManager (700 行)
├── DrawingCommander (213 行)
└── Renderer 接口 (83 行)

双渲染器
├── Canvas2DRenderer (816 行)
└── WebGLRenderer (842 行)
```

**架构评分**: ⭐⭐⭐⭐⭐ **5/5**

---

## 🔧 文档维护指南

### 何时更新文档
- ✅ 架构变更时 → 更新 `ARCHITECTURE_CURRENT.md`
- ✅ 重大决策时 → 创建新的决策记录 `DECISION_*.md`
- ✅ 重构完成时 → 更新 `REFACTORING_PLAN.md` 状态
- ✅ 发现错误时 → 立即修正

### 文档命名规范
- `ARCHITECTURE_*.md` - 架构相关
- `REFACTORING_*.md` - 重构相关
- `SPLIT_*.md` - 分离架构分析
- `DECISION_*.md` - 架构决策记录
- `*_PLAN.md` - 计划文档

### 归档过时文档
过时文档不要删除，添加前缀 `_archive/` 或标记为过时：
```
docs/
├── _archive/
│   └── old_architecture.md
└── current.md
```

---

## 🗂️ 文档目录结构

```
docs/
├── ARCHITECTURE_v2.md          # ✅ 当前架构 v2.0（推荐）
├── ARCHITECTURE.md             # 🟡 原始架构 v1.0（参考）
├── ARCHITECTURE_CURRENT.md     # 🟡 Phase 4&5 架构（已过时）
├── REFACTORING_PLAN.md         # ✅ 重构计划（已完成）
├── README.md                   # 本文档
├── archive/                    # 📁 历史文档归档
│   ├── ARCHITECTURE_REVIEW.md
│   ├── SPLIT_ANALYSIS.md
│   └── SPLIT_ANALYSIS_3D.md
├── algorithm/                  # 算法文档
│   └── smooth.md
├── implementation/             # 实现细节
│   ├── ARTISTIC.md
│   └── PREDICT.md
└── superpowers/                # 功能计划
    └── plans/
```

## 📝 文档清理记录 (2026-04-12)

**删除** (6 个文件):
- `ARCHITECTURE_ANALYSIS_2026-03-29.md`
- `ARCHITECTURE_REVIEW_2026_03_29.md`
- `PHASE5_PLAN.md`
- `MIGRATION_THREEJS.md`
- `OPENSPEC_SETUP.md`
- `constraints-feature.md`

**归档到 `archive/`** (3 个文件):
- `ARCHITECTURE_REVIEW.md`
- `SPLIT_ANALYSIS.md`
- `SPLIT_ANALYSIS_3D.md`

---

**维护者**: Development Team  
**最后更新**: 2026-04-12  
**下次审查**: 重大架构变更时
