/**
 * GeometryKernel 测试脚本
 * 
 * 使用方法:
 * 在浏览器控制台或测试环境中运行:
 * 
 * ```ts
 * import { testKernel } from './kernel/test-kernel';
 * await testKernel();
 * ```
 */

import { kernel } from './GeometryKernel';

export async function testKernel(): Promise<void> {
    console.log('[Test] Starting GeometryKernel test...');
    
    try {
        // 1. 初始化
        console.log('[Test] Initializing kernel...');
        await kernel.initialize();
        console.log('[Test] ✓ Kernel initialized');
        
        // 2. 创建长方体
        console.log('[Test] Creating box...');
        const boxResult = kernel.createBox(
            { x: 0, y: 0, z: 0 },
            10,  // width
            20,  // height
            30   // depth
        );
        
        if (!boxResult.isOk || !boxResult.value) {
            throw new Error(`Failed to create box: ${boxResult.error}`);
        }
        
        console.log('[Test] ✓ Box created:', boxResult.value.id);
        
        // 3. 创建圆柱体
        console.log('[Test] Creating cylinder...');
        const cylinderResult = kernel.createCylinder(
            { x: 50, y: 0, z: 0 },
            10,  // radius
            30   // height
        );
        
        if (!cylinderResult.isOk || !cylinderResult.value) {
            throw new Error(`Failed to create cylinder: ${cylinderResult.error}`);
        }
        
        console.log('[Test] ✓ Cylinder created:', cylinderResult.value.id);
        
        // 4. 创建球体
        console.log('[Test] Creating sphere...');
        const sphereResult = kernel.createSphere(
            { x: 100, y: 0, z: 0 },
            15  // radius
        );
        
        if (!sphereResult.isOk || !sphereResult.value) {
            throw new Error(`Failed to create sphere: ${sphereResult.error}`);
        }
        
        console.log('[Test] ✓ Sphere created:', sphereResult.value.id);
        
        // 5. 测试布尔运算 (并集)
        console.log('[Test] Testing boolean union...');
        const unionResult = kernel.booleanFuse([boxResult.value, cylinderResult.value]);
        
        if (!unionResult.isOk || !unionResult.value) {
            throw new Error(`Failed to union shapes: ${unionResult.error}`);
        }
        
        console.log('[Test] ✓ Union created:', unionResult.value.id);
        
        // 6. 测试网格化
        console.log('[Test] Testing tessellation...');
        const meshData = kernel.tessellate(unionResult.value);
        
        console.log('[Test] ✓ Mesh data:');
        console.log('  - Vertices:', meshData.vertices.length / 3);
        console.log('  - Normals:', meshData.normals.length / 3);
        console.log('  - UVs:', meshData.uvs.length / 2);
        console.log('  - Indices:', meshData.indices.length);
        
        // 7. 清理资源
        console.log('[Test] Cleaning up resources...');
        boxResult.value.dispose();
        cylinderResult.value.dispose();
        sphereResult.value.dispose();
        unionResult.value.dispose();
        
        console.log('[Test] ✓ Resources cleaned up');
        
        // 完成
        console.log('\n[Test] ✅ All tests passed!');
        console.log('=================================');
        console.log('GeometryKernel is working correctly!');
        console.log('Next step: Integrate with Three.js renderer');
        console.log('=================================\n');
        
    } catch (error) {
        console.error('[Test] ❌ Test failed:', error);
        throw error;
    }
}

// 自动运行测试 (如果在浏览器环境)
if (typeof window !== 'undefined') {
    (window as any).testKernel = testKernel;
    console.log('[Test] Call testKernel() in console to run tests');
}
