# 单元测试指南

> 更新日期：2026-04-12

---

## 测试覆盖

已完成以下模块的单元测试：

| 模块 | 测试文件 | 测试用例数 | 状态 |
|------|---------|-----------|------|
| **GeometryKernel** | `kernel/__tests__/GeometryKernel.test.ts` | 15+ | ✅ |
| **SketchSolver** | `constraints/__tests__/SketchSolver.test.ts` | 20+ | ✅ |
| **Command System** | `commands/__tests__/Command.test.ts` | 15+ | ✅ |
| **FeatureTree** | `kernel/__tests__/FeatureTree.test.ts` | 20+ | ✅ |
| **ShapeFactory** | `kernel/__tests__/ShapeFactory.test.ts` | 12+ | ✅ |

**总计**: ~82 个测试用例

---

## 运行测试

### 安装测试依赖

```bash
npm install -D vitest @vitest/coverage-v8 happy-dom
```

### 运行所有测试

```bash
npm run test
```

### 运行特定测试文件

```bash
# GeometryKernel 测试
npm run test -- src/kernel/__tests__/GeometryKernel.test.ts

# SketchSolver 测试
npm run test -- src/constraints/__tests__/SketchSolver.test.ts

# 命令系统测试
npm run test -- src/commands/__tests__/Command.test.ts
```

### 监听模式 (开发时使用)

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

---

## 测试配置

### vite.config.ts

确保配置中包含测试配置：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/kernel/lib/']
    }
  }
});
```

### package.json

添加测试脚本：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## 测试用例详解

### GeometryKernel 测试

**测试内容**:
- ✅ WASM 初始化
- ✅ 基础形状创建 (Box, Cylinder, Sphere)
- ✅ 布尔运算 (Fuse, Cut, Common)
- ✅ 修改操作 (Fillet, Chamfer)
- ✅ 网格化 (Tessellate)
- ✅ 错误处理

**示例**:
```typescript
describe('createBox()', () => {
    it('should create a box successfully', () => {
        const result = kernel.createBox(
            { x: 0, y: 0, z: 0 },
            10, 20, 30
        );

        expect(result.isOk).toBe(true);
        expect(result.value).toBeDefined();
    });
});
```

### SketchSolver 测试

**测试内容**:
- ✅ 几何设置
- ✅ 约束添加/移除
- ✅ 固定点
- ✅ 约束求解 (水平/垂直/距离/重合)
- ✅ 多约束系统
- ✅ 静态辅助方法

**示例**:
```typescript
it('should solve with distance constraint', () => {
    solver.setGeometry({
        points: [
            { x: 0, y: 0 },
            { x: 5, y: 0 }  // Distance is 5, should be 10
        ]
    });

    solver.addConstraint(SketchSolver.distance(0, 1, 10));
    solver.fixPoint(0);

    const result = solver.solve();
    expect(result.success).toBe(true);

    const distance = Math.sqrt(
        Math.pow(result.points[1].x - result.points[0].x, 2) +
        Math.pow(result.points[1].y - result.points[0].y, 2)
    );
    expect(distance).toBeCloseTo(10, 3);
});
```

### Command 系统测试

**测试内容**:
- ✅ CancelableCommand 执行
- ✅ 取消操作
- ✅ 生命周期钩子
- ✅ MultistepCommand 多步骤
- ✅ CommandStore 注册/创建
- ✅ 装饰器使用

**示例**:
```typescript
it('should execute all steps successfully', async () => {
    class TestMultistepCommand extends MultistepCommand {
        name = 'Test';
        protected getSteps(): IStep[] {
            return [
                new SimpleStep(async () => ({ data: 1 })),
                new SimpleStep(async () => ({ data: 2 }))
            ];
        }
        protected executeMainTask(): void {}
        async undo(): Promise<void> {}
        async redo(): Promise<void> {}
    }

    const cmd = new TestMultistepCommand();
    await cmd.execute();

    expect(cmd.isCompleted).toBe(true);
});
```

### FeatureTree 测试

**测试内容**:
- ✅ 特征添加/删除
- ✅ 父子关系
- ✅ 特征更新
- ✅ 抑制/恢复
- ✅ 序列化/反序列化
- ✅ 辅助创建方法

**示例**:
```typescript
it('should delete children recursively', () => {
    const parent = createFeature('sketch', 'Sketch1', {});
    const child = createFeature('extrude', 'Extrude1', {}, parent.id);
    const grandchild = createFeature('fillet', 'Fillet1', {}, child.id);

    tree.addFeature(parent);
    tree.addFeature(child);
    tree.addFeature(grandchild);

    tree.deleteFeature(parent.id);

    expect(tree.getFeature(parent.id)).toBeUndefined();
    expect(tree.getFeature(child.id)).toBeUndefined();
});
```

### ShapeFactory 测试

**测试内容**:
- ✅ 基础形状创建
- ✅ 布尔运算
- ✅ 修改操作
- ✅ 拉伸/旋转 (集成测试)

---

## 测试最佳实践

### 1. 测试命名

```typescript
// ✅ 好的命名
it('should create a box successfully', () => {});
it('should return error for invalid parameters', () => {});
it('should dispose box after use', () => {});

// ❌ 不好的命名
it('test box', () => {});
it('box test 2', () => {});
```

### 2. Arrange-Act-Assert 模式

```typescript
it('should add constraint', () => {
    // Arrange
    const constraint: SketchConstraint = {
        id: 'c1',
        type: 'horizontal',
        targets: [...]
    };

    // Act
    solver.addConstraint(constraint);

    // Assert
    expect(() => solver.addConstraint(constraint)).not.toThrow();
});
```

### 3. 测试隔离

```typescript
describe('SketchSolver', () => {
    let solver: SketchSolver;

    beforeEach(() => {
        // 每个测试前创建新实例
        solver = new SketchSolver();
    });

    it('test 1', () => {
        // 不影响其他测试
    });

    it('test 2', () => {
        // 独立运行
    });
});
```

### 4. 资源清理

```typescript
it('should dispose after use', () => {
    const result = kernel.createBox({ x: 0, y: 0, z: 0 }, 10, 10, 10);
    
    expect(result.isOk).toBe(true);
    
    // 清理 WASM 资源
    expect(() => result.value?.dispose()).not.toThrow();
});
```

---

## 持续集成

### GitHub Actions 示例

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm run test
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage.json
```

---

## 测试覆盖率目标

| 指标 | 目标 | 当前 |
|------|------|------|
| 语句覆盖率 | >80% | TBD |
| 分支覆盖率 | >70% | TBD |
| 函数覆盖率 | >85% | TBD |
| 行覆盖率 | >80% | TBD |

生成覆盖率报告后查看具体数值：

```bash
npm run test:coverage
# 打开 coverage/index.html
```

---

## 故障排除

### WASM 加载失败

**错误**: `Failed to load WASM`

**解决**:
```typescript
// 在测试 setup 文件中 mock WASM
vi.mock('../kernel/GeometryKernel', () => ({
    kernel: {
        initialize: vi.fn(),
        createBox: vi.fn(() => ({ isOk: true, value: { id: 'test' } }))
    }
}));
```

### 异步测试超时

**错误**: `Test timed out`

**解决**:
```typescript
it('should complete async operation', async () => {
    // 增加超时时间
}, 10000);  // 10 秒
```

### 全局变量未定义

**错误**: `describe is not defined`

**解决**: 确保 `vite.config.ts` 中配置 `globals: true`

---

## 下一步

### 待添加的测试

- [ ] ThreeRenderer 测试 (需要 mock Three.js)
- [ ] Component 测试 (需要 React Testing Library)
- [ ] 集成测试 (完整工作流)
- [ ] E2E 测试 (Playwright/Cypress)

### 性能测试

```typescript
it('should solve constraints within time limit', () => {
    const start = performance.now();
    
    solver.solve();
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);  // 100ms
});
```

---

## 参考资源

- [Vitest 文档](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Vitest 最佳实践](https://vitest.dev/guide/best-practices.html)
