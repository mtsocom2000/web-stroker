/**
 * GeometryKernel 单元测试
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { GeometryKernel, kernel } from '../GeometryKernel';

describe('GeometryKernel', () => {
    beforeAll(async () => {
        // 初始化内核
        await kernel.initialize();
    });

    beforeEach(() => {
        // 每个测试前重置状态
    });

    describe('initialize()', () => {
        it('should initialize successfully', async () => {
            const testKernel = new GeometryKernel();
            await expect(testKernel.initialize()).resolves.not.toThrow();
        });

        it('should not reinitialize if already initialized', async () => {
            const testKernel = new GeometryKernel();
            await testKernel.initialize();
            await expect(testKernel.initialize()).resolves.not.toThrow();
        });
    });

    describe('createBox()', () => {
        it('should create a box successfully', () => {
            const result = kernel.createBox(
                { x: 0, y: 0, z: 0 },
                10, 20, 30
            );

            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();
            expect(result.value?.id).toBeDefined();
        });

        it('should create box with different dimensions', () => {
            const result1 = kernel.createBox({ x: 0, y: 0, z: 0 }, 5, 5, 5);
            const result2 = kernel.createBox({ x: 0, y: 0, z: 0 }, 100, 50, 25);

            expect(result1.isOk).toBe(true);
            expect(result2.isOk).toBe(true);
        });

        it('should dispose box after use', () => {
            const result = kernel.createBox({ x: 0, y: 0, z: 0 }, 10, 10, 10);
            
            expect(result.isOk).toBe(true);
            expect(() => result.value?.dispose()).not.toThrow();
        });
    });

    describe('createCylinder()', () => {
        it('should create a cylinder successfully', () => {
            const result = kernel.createCylinder(
                { x: 0, y: 0, z: 0 },
                10,  // radius
                20   // height
            );

            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();
        });

        it('should handle different radius and height', () => {
            const result1 = kernel.createCylinder({ x: 0, y: 0, z: 0 }, 5, 10);
            const result2 = kernel.createCylinder({ x: 0, y: 0, z: 0 }, 20, 50);

            expect(result1.isOk).toBe(true);
            expect(result2.isOk).toBe(true);
        });
    });

    describe('createSphere()', () => {
        it('should create a sphere successfully', () => {
            const result = kernel.createSphere(
                { x: 0, y: 0, z: 0 },
                15  // radius
            );

            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();
        });

        it('should handle different radii', () => {
            const result1 = kernel.createSphere({ x: 0, y: 0, z: 0 }, 5);
            const result2 = kernel.createSphere({ x: 0, y: 0, z: 0 }, 50);

            expect(result1.isOk).toBe(true);
            expect(result2.isOk).toBe(true);
        });
    });

    describe('booleanFuse()', () => {
        it('should union two shapes successfully', () => {
            const box1 = kernel.createBox({ x: 0, y: 0, z: 0 }, 10, 10, 10);
            const box2 = kernel.createBox({ x: 5, y: 0, z: 0 }, 10, 10, 10);

            expect(box1.isOk).toBe(true);
            expect(box2.isOk).toBe(true);

            if (box1.isOk && box2.isOk && box1.value && box2.value) {
                const result = kernel.booleanFuse([box1.value, box2.value]);
                expect(result.isOk).toBe(true);
                
                // Cleanup
                box1.value.dispose();
                box2.value.dispose();
                if (result.value) result.value.dispose();
            }
        });
    });

    describe('booleanCut()', () => {
        it('should subtract shape successfully', () => {
            const box = kernel.createBox({ x: 0, y: 0, z: 0 }, 20, 20, 20);
            const cutter = kernel.createBox({ x: 5, y: 5, z: 5 }, 10, 10, 10);

            expect(box.isOk).toBe(true);
            expect(cutter.isOk).toBe(true);

            if (box.isOk && cutter.isOk && box.value && cutter.value) {
                const result = kernel.booleanCut(box.value, [cutter.value]);
                expect(result.isOk).toBe(true);

                // Cleanup
                box.value.dispose();
                cutter.value.dispose();
                if (result.value) result.value.dispose();
            }
        });
    });

    describe('fillet()', () => {
        it('should apply fillet to edges', () => {
            const box = kernel.createBox({ x: 0, y: 0, z: 0 }, 10, 10, 10);

            expect(box.isOk).toBe(true);

            if (box.isOk && box.value) {
                // Apply fillet to edge 0
                const result = kernel.fillet(box.value, [0], 2);
                expect(result.isOk).toBe(true);

                // Cleanup
                box.value.dispose();
                if (result.value) result.value.dispose();
            }
        });
    });

    describe('chamfer()', () => {
        it('should apply chamfer to edges', () => {
            const box = kernel.createBox({ x: 0, y: 0, z: 0 }, 10, 10, 10);

            expect(box.isOk).toBe(true);

            if (box.isOk && box.value) {
                const result = kernel.chamfer(box.value, [0], 2);
                expect(result.isOk).toBe(true);

                // Cleanup
                box.value.dispose();
                if (result.value) result.value.dispose();
            }
        });
    });

    describe('tessellate()', () => {
        it('should generate mesh data for shape', () => {
            const box = kernel.createBox({ x: 0, y: 0, z: 0 }, 10, 10, 10);

            expect(box.isOk).toBe(true);

            if (box.isOk && box.value) {
                const meshData = kernel.tessellate(box.value);
                
                expect(meshData.vertices).toBeDefined();
                expect(meshData.normals).toBeDefined();
                expect(meshData.indices).toBeDefined();
                
                // Box should have at least 8 vertices
                expect(meshData.vertices.length).toBeGreaterThanOrEqual(8 * 3);
                
                // Cleanup
                box.value.dispose();
            }
        });

        it('should generate valid mesh data', () => {
            const sphere = kernel.createSphere({ x: 0, y: 0, z: 0 }, 10);

            if (sphere.isOk && sphere.value) {
                const meshData = kernel.tessellate(sphere.value);
                
                // Vertices and normals should have same length
                expect(meshData.vertices.length).toBe(meshData.normals.length);
                
                // Cleanup
                sphere.value.dispose();
            }
        });
    });

    describe('error handling', () => {
        it('should return error for invalid parameters', () => {
            // Negative dimensions should fail
            const result = kernel.createBox({ x: 0, y: 0, z: 0 }, -10, 10, 10);
            expect(result.isOk).toBe(false);
        });
    });
});
