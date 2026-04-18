/**
 * 拉伸功能测试脚本
 * 
 * 测试 Sketch3D → OCCT Wire → Extrude 的完整流程
 */

import { kernel } from './GeometryKernel';
import { ShapeFactory } from './ShapeFactory';
import type { Sketch3D } from '../types3d';

export async function testExtrude(): Promise<void> {
    console.log('[Test] Starting Extrude test...');
    
    try {
        // 1. 初始化内核
        console.log('[Test] Initializing kernel...');
        await kernel.initialize();
        console.log('[Test] ✓ Kernel initialized');

        // 2. 创建示例草图 (矩形)
        console.log('[Test] Creating sketch...');
        const sketch: Sketch3D = {
            id: 'test-sketch-001',
            name: 'Test Sketch',
            workplaneId: 'XY',
            segments: [
                // 线段 1: (0,0) → (10,0)
                {
                    type: 'line',
                    startPoint: { x: 0, y: 0, z: 0 },
                    endPoint: { x: 10, y: 0, z: 0 }
                },
                // 线段 2: (10,0) → (10,10)
                {
                    type: 'line',
                    startPoint: { x: 10, y: 0, z: 0 },
                    endPoint: { x: 10, y: 10, z: 0 }
                },
                // 线段 3: (10,10) → (0,10)
                {
                    type: 'line',
                    startPoint: { x: 10, y: 10, z: 0 },
                    endPoint: { x: 0, y: 10, z: 0 }
                },
                // 线段 4: (0,10) → (0,0)
                {
                    type: 'line',
                    startPoint: { x: 0, y: 10, z: 0 },
                    endPoint: { x: 0, y: 0, z: 0 }
                }
            ],
            constraints: [],
            isClosed: true
        };
        console.log('[Test] ✓ Sketch created with', sketch.segments.length, 'segments');

        // 3. 执行拉伸
        console.log('[Test] Extruding sketch...');
        const distance = 20;
        const result = ShapeFactory.extrude(sketch, distance);

        if (!result.isOk || !result.value) {
            throw new Error(`Extrude failed: ${result.error}`);
        }

        console.log('[Test] ✓ Extrusion successful:', result.value.id);

        // 4. 网格化验证
        console.log('[Test] Tessellating shape...');
        const meshData = kernel.tessellate(result.value);
        
        console.log('[Test] ✓ Mesh data:');
        console.log('  - Vertices:', meshData.vertices.length / 3);
        console.log('  - Normals:', meshData.normals.length / 3);
        console.log('  - Indices:', meshData.indices.length);

        // 5. 验证顶点数量 (长方体应该有 8 个顶点)
        const vertexCount = meshData.vertices.length / 3;
        if (vertexCount < 8) {
            console.warn('[Test] ⚠ Unexpected vertex count:', vertexCount);
        } else {
            console.log('[Test] ✓ Vertex count looks correct');
        }

        // 6. 清理资源
        console.log('[Test] Cleaning up...');
        result.value.dispose();

        // 完成
        console.log('\n[Test] ✅ Extrude test passed!');
        console.log('=================================');
        console.log('拉伸功能工作正常!');
        console.log('下一步：测试旋转功能');
        console.log('=================================\n');

    } catch (error) {
        console.error('[Test] ❌ Extrude test failed:', error);
        throw error;
    }
}

/**
 * 旋转功能测试
 */
export async function testRevolve(): Promise<void> {
    console.log('[Test] Starting Revolve test...');
    
    try {
        // 1. 确保内核已初始化
        if (!kernel || !(kernel as any).initialized) {
            await kernel.initialize();
        }

        // 2. 创建示例草图 (矩形剖面)
        console.log('[Test] Creating sketch for revolve...');
        const sketch: Sketch3D = {
            id: 'test-sketch-revolve-001',
            name: 'Revolve Sketch',
            workplaneId: 'XY',
            segments: [
                {
                    type: 'line',
                    startPoint: { x: 10, y: 0, z: 0 },
                    endPoint: { x: 10, y: 5, z: 0 }
                },
                {
                    type: 'line',
                    startPoint: { x: 10, y: 5, z: 0 },
                    endPoint: { x: 15, y: 5, z: 0 }
                },
                {
                    type: 'line',
                    startPoint: { x: 15, y: 5, z: 0 },
                    endPoint: { x: 15, y: 0, z: 0 }
                }
            ],
            constraints: [],
            isClosed: false  // 开放轮廓也可以旋转
        };

        // 3. 执行旋转 (绕 Y 轴旋转 360 度)
        console.log('[Test] Revolving sketch...');
        const axisStart = { x: 0, y: 0, z: 0 };
        const axisEnd = { x: 0, y: 0, z: 1 };
        const angle = 360;

        const result = ShapeFactory.revolve(sketch, axisStart, axisEnd, angle);

        if (!result.isOk || !result.value) {
            throw new Error(`Revolve failed: ${result.error}`);
        }

        console.log('[Test] ✓ Revolve successful:', result.value.id);

        // 4. 网格化验证
        const meshData = kernel.tessellate(result.value);
        console.log('[Test] ✓ Mesh vertices:', meshData.vertices.length / 3);

        // 5. 清理
        result.value.dispose();

        console.log('\n[Test] ✅ Revolve test passed!');
        console.log('=================================');
        console.log('旋转功能工作正常!');
        console.log('=================================\n');

    } catch (error) {
        console.error('[Test] ❌ Revolve test failed:', error);
        throw error;
    }
}

/**
 * 约束求解器测试
 */
export async function testConstraintSolver(): Promise<void> {
    console.log('[Test] Starting Constraint Solver test...');
    
    try {
        const { SketchSolver } = await import('../constraints/SketchSolver');

        // 1. 创建求解器
        const solver = new SketchSolver();

        // 2. 设置几何 (三角形)
        solver.setGeometry({
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 5, y: 8 }
            ],
            lines: [
                { id: 'l1', start: 0, end: 1 },
                { id: 'l2', start: 1, end: 2 },
                { id: 'l3', start: 2, end: 0 }
            ],
            circles: [],
            arcs: []
        });

        // 3. 添加约束
        // 固定点 0
        solver.fixPoint(0);

        // 添加水平约束 (点 0 和点 1)
        solver.addConstraint(SketchSolver.horizontal(0, 1));

        // 添加距离约束
        solver.addConstraint(SketchSolver.distance(0, 1, 15));  // 底边长度 15

        // 4. 求解
        console.log('[Test] Solving constraints...');
        const result = solver.solve();

        if (!result.success) {
            throw new Error(`Solver failed: ${result.error}`);
        }

        console.log('[Test] ✓ Solver converged in', result.iterations, 'iterations');
        console.log('[Test] ✓ Result points:');
        result.points.forEach((p, i) => {
            console.log(`  Point ${i}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`);
        });

        // 5. 验证底边长度
        const baseLength = Math.sqrt(
            Math.pow(result.points[1].x - result.points[0].x, 2) +
            Math.pow(result.points[1].y - result.points[0].y, 2)
        );

        if (Math.abs(baseLength - 15) > 0.001) {
            throw new Error(`Distance constraint not satisfied: ${baseLength} != 15`);
        }

        console.log('[Test] ✓ Distance constraint satisfied:', baseLength.toFixed(6));

        console.log('\n[Test] ✅ Constraint solver test passed!');
        console.log('=================================');
        console.log('约束求解器工作正常!');
        console.log('=================================\n');

    } catch (error) {
        console.error('[Test] ❌ Constraint solver test failed:', error);
        throw error;
    }
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
    console.log('\n========================================');
    console.log('Running Phase 4-5 Test Suite');
    console.log('========================================\n');

    try {
        await testExtrude();
        await testRevolve();
        await testConstraintSolver();

        console.log('\n========================================');
        console.log('✅ All Phase 4-5 tests PASSED!');
        console.log('========================================\n');

    } catch (error) {
        console.error('\n========================================');
        console.error('❌ Test suite FAILED');
        console.error('========================================\n');
        throw error;
    }
}

// 自动注册到全局 (浏览器环境)
if (typeof window !== 'undefined') {
    (window as any).testExtrude = testExtrude;
    (window as any).testRevolve = testRevolve;
    (window as any).testConstraintSolver = testConstraintSolver;
    (window as any).runAllTests = runAllTests;
    console.log('[Test] Call runAllTests() in console to run all tests');
}
