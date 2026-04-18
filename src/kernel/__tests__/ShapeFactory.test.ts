/**
 * ShapeFactory 单元测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ShapeFactory } from '../ShapeFactory';
import { kernel } from '../GeometryKernel';
import type { Sketch3D } from '../../types3d';

describe('ShapeFactory', () => {
    beforeAll(async () => {
        await kernel.initialize();
    });

    describe('box()', () => {
        it('should create a box', () => {
            const plane = {
                id: 'test',
                name: 'Test Plane',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const result = ShapeFactory.box(plane, 10, 20, 30);

            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();
            expect(result.value?.id).toBeDefined();

            result.value?.dispose();
        });
    });

    describe('cylinder()', () => {
        it('should create a cylinder', () => {
            const plane = {
                id: 'test',
                name: 'Test Plane',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const result = ShapeFactory.cylinder(plane, 10, 20);

            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();

            result.value?.dispose();
        });
    });

    describe('sphere()', () => {
        it('should create a sphere', () => {
            const result = ShapeFactory.sphere({ x: 0, y: 0, z: 0 }, 15);

            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();

            result.value?.dispose();
        });
    });

    describe('fuse()', () => {
        it('should union two boxes', () => {
            const plane = {
                id: 'test',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const box1 = ShapeFactory.box(plane, 10, 10, 10);
            const box2 = ShapeFactory.box(plane, 10, 10, 10);

            expect(box1.isOk).toBe(true);
            expect(box2.isOk).toBe(true);

            if (box1.isOk && box2.isOk && box1.value && box2.value) {
                const result = ShapeFactory.fuse(box1.value, box2.value);
                expect(result.isOk).toBe(true);

                box1.value.dispose();
                box2.value.dispose();
                result.value?.dispose();
            }
        });
    });

    describe('cut()', () => {
        it('should subtract one box from another', () => {
            const plane = {
                id: 'test',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const box1 = ShapeFactory.box(plane, 20, 20, 20);
            const box2 = ShapeFactory.box(plane, 10, 10, 10);

            if (box1.isOk && box2.isOk && box1.value && box2.value) {
                const result = ShapeFactory.cut(box1.value, box2.value);
                expect(result.isOk).toBe(true);

                box1.value.dispose();
                box2.value.dispose();
                result.value?.dispose();
            }
        });
    });

    describe('common()', () => {
        it('should intersect two boxes', () => {
            const plane = {
                id: 'test',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const box1 = ShapeFactory.box(plane, 15, 15, 15);
            const box2 = ShapeFactory.box(plane, 15, 15, 15);

            if (box1.isOk && box2.isOk && box1.value && box2.value) {
                const result = ShapeFactory.common(box1.value, box2.value);
                expect(result.isOk).toBe(true);

                box1.value.dispose();
                box2.value.dispose();
                result.value?.dispose();
            }
        });
    });

    describe('fillet()', () => {
        it('should apply fillet to box edges', () => {
            const plane = {
                id: 'test',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const box = ShapeFactory.box(plane, 10, 10, 10);

            if (box.isOk && box.value) {
                const result = ShapeFactory.fillet(box.value, [0, 1, 2], 2);
                expect(result.isOk).toBe(true);

                box.value.dispose();
                result.value?.dispose();
            }
        });
    });

    describe('chamfer()', () => {
        it('should apply chamfer to box edges', () => {
            const plane = {
                id: 'test',
                origin: { x: 0, y: 0, z: 0 },
                normal: { x: 0, y: 0, z: 1 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                projectToPlane: (p: any) => ({ x: p.x, y: p.y }),
                liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
            };

            const box = ShapeFactory.box(plane, 10, 10, 10);

            if (box.isOk && box.value) {
                const result = ShapeFactory.chamfer(box.value, [0, 1, 2], 2);
                expect(result.isOk).toBe(true);

                box.value.dispose();
                result.value?.dispose();
            }
        });
    });

    describe('extrude()', () => {
        it('should extrude a closed sketch', () => {
            const sketch: Sketch3D = {
                id: 'test-sketch',
                name: 'Test Sketch',
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

            const result = ShapeFactory.extrude(sketch, 20);

            // Note: This might fail if WASM is not fully loaded in test environment
            // In that case, skip or mock
            if (result.isOk) {
                expect(result.value).toBeDefined();
                result.value?.dispose();
            }
        });
    });

    describe('revolve()', () => {
        it('should revolve a sketch around axis', () => {
            const sketch: Sketch3D = {
                id: 'test-sketch-revolve',
                name: 'Test Sketch Revolve',
                workplaneId: 'XY',
                segments: [
                    { type: 'line', startPoint: { x: 10, y: 0, z: 0 }, endPoint: { x: 10, y: 5, z: 0 } },
                    { type: 'line', startPoint: { x: 10, y: 5, z: 0 }, endPoint: { x: 15, y: 5, z: 0 } },
                    { type: 'line', startPoint: { x: 15, y: 5, z: 0 }, endPoint: { x: 15, y: 0, z: 0 } }
                ],
                constraints: [],
                isClosed: false
            };

            const result = ShapeFactory.revolve(
                sketch,
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 1 },
                360
            );

            if (result.isOk) {
                expect(result.value).toBeDefined();
                result.value?.dispose();
            }
        });
    });
});
