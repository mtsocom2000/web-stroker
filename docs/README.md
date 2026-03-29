# Web Stroker 文档索引

**最后更新**: 2026-03-29  
**重构状态**: Phase 4 & 5 ✅ 完成

---

## 📚 核心文档

### 架构文档
| 文档 | 状态 | 说明 |
|------|------|------|
| [`ARCHITECTURE_CURRENT.md`](./ARCHITECTURE_CURRENT.md) | ✅ **最新** | **当前架构** - Phase 4&5 重构后的架构说明 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 🟡 待更新 | 原始架构设计文档（部分内容已过时） |
| [`ARCHITECTURE_REVIEW_2026_03_29.md`](./ARCHITECTURE_REVIEW_2026_03_29.md) | ✅ 最新 | 架构审查报告（2026-03-29） |

### 重构文档
| 文档 | 状态 | 说明 |
|------|------|------|
| [`REFACTORING_PLAN.md`](./REFACTORING_PLAN.md) | ✅ 已完成 | 重构计划（Phase 1-5 全部完成） |
| [`PHASE5_PLAN.md`](./PHASE5_PLAN.md) | ⚠️ 已合并 | Phase 5 计划（已执行，内容合并到 REFACTORING_PLAN） |

### 决策记录
| 文档 | 状态 | 说明 |
|------|------|------|
| [`SPLIT_ANALYSIS_3D.md`](./SPLIT_ANALYSIS_3D.md) | ✅ 最新 | 2D/3D 分离架构分析（含 3D 建模需求） |
| [`SPLIT_ANALYSIS.md`](./SPLIT_ANALYSIS.md) | 🟡 参考 | 分离架构初步分析（被 3D 版本替代） |

### 历史文档
| 文档 | 状态 | 说明 |
|------|------|------|
| [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) | ⚠️ 过时 | 旧版架构审查（已被 2026-03-29 版本替代） |
| [`MIGRATION_THREEJS.md`](./MIGRATION_THREEJS.md) | ✅ 已完成 | Three.js 迁移文档（已完成） |

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
1. 📘 [ARCHITECTURE_CURRENT.md](./ARCHITECTURE_CURRENT.md) - 了解当前架构
2. 📗 [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - 了解重构历史
3. 📙 [SPLIT_ANALYSIS_3D.md](./SPLIT_ANALYSIS_3D.md) - 了解未来方向

### 架构师/贡献者
1. [ARCHITECTURE_CURRENT.md](./ARCHITECTURE_CURRENT.md) - 当前架构
2. [ARCHITECTURE_REVIEW_2026_03_29.md](./ARCHITECTURE_REVIEW_2026_03_29.md) - 架构审查
3. [SPLIT_ANALYSIS_3D.md](./SPLIT_ANALYSIS_3D.md) - 架构决策

---

## 📊 重构成果总结

### Phase 4 & 5 完成 (2026-03-29)

**代码精简**:
```
DrawingCanvas: 3130 行 → 339 行 (-89%)
删除未使用文件：35KB
净减少：~1900 行代码
```

**新架构**:
```
5 个专用 hooks (879 行)
├── useSnapSystem (195 行)
├── useSelectTool (237 行)
├── useMeasureTools (148 行)
├── useArtisticDrawing (134 行)
└── useDigitalDrawing (165 行)

核心组件 (980 行)
├── DrawingStateManager (706 行)
├── DrawingCommander (213 行)
└── Renderer 接口 (61 行)
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

**维护者**: Development Team  
**最后审查**: 2026-03-29
