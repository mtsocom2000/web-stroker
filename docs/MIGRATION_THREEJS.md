# Three.js 渲染迁移 - 功能清单与风险矩阵

## 必须保留的功能清单

### Artistic Mode (艺术模式)
- [x] **笔刷类型**：pencil, pen, brush, ballpen, eraser
- [x] **颜色系统**：currentColor 支持
- [x] **笔刷粗细**：thickness 支持
- [x] **不透明度**：opacity 支持（0-1）
- [x] **硬度设置**：hardness
- [x] **间距设置**：spacing
- [x] **曲率适应**：curvatureAdaptation
- [x] **笔刷预设**：所有预设参数

### Stroke Modes (笔划模式)
- [x] **Original Mode**：原始点直接渲染
- [x] **Smooth Mode**：Catmull-Rom 平滑曲线
- [x] **Predict Mode**：形状预测 + 验证

### Digital Mode (数字模式)
- [x] **Line Tool**：直线预览 + 绘制
- [x] **Circle Tool**：圆心半径/三点圆 + 预览
- [x] **Arc Tool**：圆弧 + 预览
- [x] **Curve Tool**：Bezier 曲线 + 预览
- [x] **Element Selection**：端点/控制点选择高亮
- [x] **Element Hover**：悬浮高亮效果

### 视觉反馈
- [x] **当前笔划实时显示**：鼠标移动时实时绘制
- [x] **预览线**：虚线预览（测量、数字工具）
- [x] **选择框**：拖拽选择矩形框
- [x] **高亮效果**：选中/悬浮笔划高亮
- [x] **橡皮擦预览**：光标大小预览

### 渲染细节
- [x] **TubeGeometry**：圆头线帽，平滑连接
- [x] **抗锯齿**：高质量线条
- [x] **混合模式**：正确的颜色叠加
- [x] **像素比例**：高DPI屏幕支持
- [x] **裁剪**：只绘制在画布区域内

## 风险矩阵

### 高风险 (必须解决)
| 风险项 | 描述 | 缓解策略 |
|--------|------|----------|
| **笔刷纹理** | Three.js TubeGeometry 可能不支持纹理笔刷 | 预先生成几何体或使用 ShaderMaterial |
| **半透明混合** | WebGL 混合模式与 2D Canvas 不同 | 自定义混合模式或预乘Alpha |
| **实时预览** | 频繁更新 Geometry 可能内存泄漏 | 使用 BufferGeometry.updateAttribute |
| **预测模式回退** | 相似度检查失败时需平滑渲染 | 保留平滑渲染逻辑作为 fallback |

### 中风险 (需要验证)
| 风险项 | 描述 | 缓解策略 |
|--------|------|----------|
| **性能对比** | Three.js 可能在简单场景更慢 | 性能测试 + 自动回退机制 |
| **内存占用** | Geometry 对象占用更多内存 | 及时 dispose + 对象池 |
| **缩放一致性** | TubeGeometry 粗细随相机变化 | 使用 shader 保持像素一致 |

### 低风险 (可接受)
| 风险项 | 描述 | 缓解策略 |
|--------|------|----------|
| **颜色格式** | Three.js 使用不同颜色格式 | 转换函数 |
| **坐标系** | Three.js Y轴向上 vs Canvas Y轴向下 | 坐标转换 |

## 渐进式迁移计划

### Phase 1: 并行渲染层 (1-2天)
- 创建 `ThreeJsRenderer` 类
- 实现 `renderStrokeToThree` 函数
- **并行运行**：2D Canvas 和 Three.js 同时渲染
- **验证**：对比两个渲染结果是否一致

### Phase 2: 功能开关 (2-3天)
- 添加 `useThreeJsRenderer` feature flag
- 仅 Artistic Mode 使用 Three.js
- Digital Mode 保持 2D Canvas
- **回滚**：设置中可切换回 2D

### Phase 3: 完整迁移 (3-4天)
- Digital Mode 迁移到 Three.js
- 移除 2D Canvas 代码
- **性能测试**：验证所有场景

### Phase 4: 优化 (2天)
- InstancedMesh 批处理优化
- LOD (Level of Detail) 支持
- 内存池优化

## 回滚策略

### 快速回滚开关
```typescript
// store.ts
interface DrawingState {
  // ...
  renderer: 'canvas2d' | 'threejs';
}

// DrawingCanvas.tsx
const Renderer = useRenderer(rendererType);
```

### 数据兼容性
- Stroke 数据结构保持不变
- 只有渲染层变化
- 保存/加载功能不受影响

## 验证清单

### 迁移前必须完成
- [ ] 所有 visual test cases 通过
- [ ] 性能基准测试记录
- [ ] 功能开关实现
- [ ] 回滚方案测试

### 每阶段验证
- [ ] Artistic Mode 单笔画
- [ ] Artistic Mode 多笔画 (10+)
- [ ] Smooth Mode 渲染
- [ ] Predict Mode 渲染
- [ ] Digital Mode 预览
- [ ] Digital Mode 绘制
- [ ] 橡皮擦功能
- [ ] 撤销/重做
- [ ] 保存/加载
- [ ] 导出图片

## 验收标准

### 性能标准
- 绘制 50 个笔划时：> 55fps
- 绘制 100 个笔划时：> 45fps
- 内存占用：< 200MB (当前基线的 120% 以内)

### 功能标准
- 所有现有测试通过
- 视觉对比差异 < 1% (像素级)
- 交互响应延迟 < 16ms

## 决策检查点

### Check Point 1: Phase 1 完成后
- [ ] Three.js 渲染结果与 2D Canvas 一致
- [ ] 性能无明显下降
- **决策**：是否继续 Phase 2?

### Check Point 2: Phase 2 完成后
- [ ] Artistic Mode 所有功能正常
- [ ] Feature flag 可正常工作
- [ ] 社区测试无重大 bug
- **决策**：是否继续 Phase 3?

### Check Point 3: Phase 3 完成后
- [ ] 所有模式功能正常
- [ ] 性能提升符合预期
- [ ] 内存使用合理
- **决策**：是否移除 2D Canvas 代码?
