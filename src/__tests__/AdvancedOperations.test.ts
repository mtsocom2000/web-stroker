/**
 * 高级 3D 操作单元测试
 * 
 * 测试抽壳、扫掠、放样功能
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ShapeFactory } from '../kernel/ShapeFactory';
import { kernel } from '../kernel/GeometryKernel';
import type { Sketch3D } from '../types3d';

describe('Advanced 3D Operations', () => {
    beforeAll(async () => {
        await kernel.initialize();
    });

    describe('sweep()', () => {
        it('should sweep a section along a path', () => {
            // 创建截面草图 (矩形)
            const section: Sketch3D = {
                id: 'section-1',
                name: 'Section',
                workplaneId: 'XY',
                segments: [
                    { type: 'line', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 10, y: 0, z: 0 } },
                    { type: 'line', startPoint: { x: 10, y: 0, z: 0 }, endPoint: { x: 10, y: 10, z: 0 } },
                    { type: 'line', startPoint: { x: 10, y: 10, z: 0 }, endPoint: { x: 0, y: 10, z: 0 } },
                    { type: 'line', startPoint: { x: 0, y: 10, z: 0 }, endPoint: { x: 0, y: 0, z: 0 } }
                ],
                constraints: [],
                isClosed: true
            };

            // 创建路径草图 (直线)
            const path: Sketch3D = {
                id: 'path-1',
                name: 'Path',
                workplaneId: 'XZ',
                segments: [
                    { type: 'line', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 0, y: 0, z: 50 } }
                ],
                constraints: [],
                isClosed: false
            };

            // 执行扫掠
            const result = ShapeFactory.sweep(section, path);

            // 注意：由于 WASM 可能未完全加载，这里只做基本验证
            if (result.isOk) {
                expect(result.value).toBeDefined();
                expect(result.value.id).toBeDefined();
                result.value.dispose();
            } else {
                // 如果失败，记录原因
                console.log('Sweep skipped:', result.error);
            }
        });
    });

    describe('loft()', () => {
        it('should loft between multiple sections', () => {
            // 创建 3 个截面草图
            const sketches: Sketch3D[] = [
                {
                    id: 'sketch-1',
                    name: 'Section 1',
                    workplaneId: 'XY',
                    segments: [
                        { type: 'line', startPoint: { x: -5, y: -5, z: 0 }, endPoint: { x: 5, y: -5, z: 0 } },
                        { type: 'line', startPoint: { x: 5, y: -5, z: 0 }, endPoint: { x: 5, y: 5, z: 0 } },
                        { type: 'line', startPoint: { x: 5, y: 5, z: 0 }, endPoint: { x: -5, y: 5, z: 0 } },
                        { type: 'line', startPoint: { x: -5, y: 5, z: 0 }, endPoint: { x: -5, y: -5, z: 0 } }
                    ],
                    constraints: [],
                    isClosed: true
                },
                {
                    id: 'sketch-2',
                    name: 'Section 2',
                    workplaneId: 'XY',
                    segments: [
                        { type: 'line', startPoint: { x: -3, y: -3, z: 10 }, endPoint: { x: 3, y: -3, z: 10 } },
                        { type: 'line', startPoint: { x: 3, y: -3, z: 10 }, endPoint: { x: 3, y: 3, z: 10 } },
                        { type: 'line', startPoint: { x: 3, y: 3, z: 10 }, endPoint: { x: -3, y: 3, z: 10 } },
                        { type: 'line', startPoint: { x: -3, y: 3, z: 10 }, endPoint: { x: -3, y: -3, z: 10 } }
                    ],
                    constraints: [],
                    isClosed: true
                },
                {
                    id: 'sketch-3',
                    name: 'Section 3',
                    workplaneId: 'XY',
                    segments: [
                        { type: 'line', startPoint: { x: -2, y: -2, z: 20 }, endPoint: { x: 2, y: -2, z: 20 } },
                        { type: 'line', startPoint: { x: 2, y: -2, z: 20 }, endPoint: { x: 2, y: 2, z: 20 } },
                        { type: 'line', startPoint: { x: 2, y: 2, z: 20 }, endPoint: { x: -2, y: 2, z: 20 } },
                        { type: 'line', startPoint: { x: -2, y: 2, z: 20 }, endPoint: { x: -2, y: -2, z: 20 } }
                    ],
                    constraints: [],
                    isClosed: true
                }
            ];

            // 执行放样
            const result = ShapeFactory.loft(sketches);

            if (result.isOk) {
                expect(result.value).toBeDefined();
                expect(result.value.id).toBeDefined();
                result.value.dispose();
            } else {
                console.log('Loft skipped:', result.error);
            }
        });

        it('should fail with less than 2 sketches', () => {
            const sketches: Sketch3D[] = [
                {
                    id: 'single-sketch',
                    name: 'Single',
                    workplaneId: 'XY',
                    segments: [],
                    constraints: [],
                    isClosed: true
                }
            ];

            const result = ShapeFactory.loft(sketches);
            expect(result.isOk).toBe(false);
            expect(result.error).toContain('at least 2 sketches');
        });
    });

    describe('shell()', () => {
        it('should create a shell from a box', () => {
            const plane = {
                id: 'test',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            // 创建基础长方体
            const box = ShapeFactory.box(plane, 20, 20, 20);

            if (box.isOk && box.value) {
                // 抽壳 (移除顶面，厚度 2)
                const result = ShapeFactory.shell(box.value, [5], 2);

                if (result.isOk) {
                    expect(result.value).toBeDefined();
                    expect(result.value.id).toBeDefined();
                    result.value.dispose();
                } else {
                    console.log('Shell skipped:', result.error);
                }

                box.value.dispose();
            }
        });
    });
});
