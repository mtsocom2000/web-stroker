/**
 * SketchSolver 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SketchSolver, SketchConstraint } from '../SketchSolver';

describe('SketchSolver', () => {
    let solver: SketchSolver;

    beforeEach(() => {
        solver = new SketchSolver();
    });

    describe('setGeometry()', () => {
        it('should set geometry successfully', () => {
            const geometry = {
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 }
                ],
                lines: [
                    { id: 'l1', start: 0, end: 1 },
                    { id: 'l2', start: 1, end: 2 }
                ],
                circles: [],
                arcs: []
            };

            expect(() => solver.setGeometry(geometry)).not.toThrow();
        });
    });

    describe('addConstraint()', () => {
        it('should add constraint successfully', () => {
            const constraint: SketchConstraint = {
                id: 'c1',
                type: 'horizontal',
                targets: [
                    { type: 'point', id: 'p0', pointIndex: 0 },
                    { type: 'point', id: 'p1', pointIndex: 1 }
                ]
            };

            expect(() => solver.addConstraint(constraint)).not.toThrow();
        });

        it('should add multiple constraints', () => {
            const constraints: SketchConstraint[] = [
                {
                    id: 'c1',
                    type: 'horizontal',
                    targets: [
                        { type: 'point', id: 'p0', pointIndex: 0 },
                        { type: 'point', id: 'p1', pointIndex: 1 }
                    ]
                },
                {
                    id: 'c2',
                    type: 'vertical',
                    targets: [
                        { type: 'point', id: 'p1', pointIndex: 1 },
                        { type: 'point', id: 'p2', pointIndex: 2 }
                    ]
                }
            ];

            constraints.forEach(c => solver.addConstraint(c));
        });
    });

    describe('removeConstraint()', () => {
        it('should remove constraint by id', () => {
            const constraint: SketchConstraint = {
                id: 'c1',
                type: 'horizontal',
                targets: [
                    { type: 'point', id: 'p0', pointIndex: 0 },
                    { type: 'point', id: 'p1', pointIndex: 1 }
                ]
            };

            solver.addConstraint(constraint);
            solver.removeConstraint('c1');
        });
    });

    describe('fixPoint()', () => {
        it('should fix a point', () => {
            solver.fixPoint(0);
            solver.fixPoint(1);
        });

        it('should unfix a point', () => {
            solver.fixPoint(0);
            solver.unfixPoint(0);
        });
    });

    describe('solve()', () => {
        it('should solve simple geometry without constraints', () => {
            solver.setGeometry({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 }
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            const result = solver.solve();
            expect(result.success).toBe(true);
            expect(result.points.length).toBe(3);
        });

        it('should solve with horizontal constraint', () => {
            solver.setGeometry({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 5 },  // Not horizontal initially
                    { x: 10, y: 10 }
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            solver.addConstraint(SketchSolver.horizontal(0, 1));
            solver.fixPoint(0);

            const result = solver.solve();
            expect(result.success).toBe(true);
            
            // After solving, points 0 and 1 should have same Y
            expect(result.points[0].y).toBeCloseTo(result.points[1].y, 5);
        });

        it('should solve with vertical constraint', () => {
            solver.setGeometry({
                points: [
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },  // Not vertical initially
                    { x: 5, y: 10 }
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            solver.addConstraint(SketchSolver.vertical(1, 2));
            solver.fixPoint(0);

            const result = solver.solve();
            expect(result.success).toBe(true);
            
            // After solving, points 1 and 2 should have same X
            expect(result.points[1].x).toBeCloseTo(result.points[2].x, 5);
        });

        it('should solve with distance constraint', () => {
            solver.setGeometry({
                points: [
                    { x: 0, y: 0 },
                    { x: 5, y: 0 }  // Distance is 5, should be 10
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            solver.addConstraint(SketchSolver.distance(0, 1, 10));
            solver.fixPoint(0);

            const result = solver.solve();
            expect(result.success).toBe(true);

            // After solving, distance should be 10
            const distance = Math.sqrt(
                Math.pow(result.points[1].x - result.points[0].x, 2) +
                Math.pow(result.points[1].y - result.points[0].y, 2)
            );
            expect(distance).toBeCloseTo(10, 3);
        });

        it('should solve with coincident constraint', () => {
            solver.setGeometry({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 }  // Not coincident
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            solver.addConstraint(SketchSolver.coincident(0, 1));
            solver.fixPoint(0);

            const result = solver.solve();
            expect(result.success).toBe(true);

            // After solving, points should be at same position
            expect(result.points[0].x).toBeCloseTo(result.points[1].x, 5);
            expect(result.points[0].y).toBeCloseTo(result.points[1].y, 5);
        });

        it('should handle multiple constraints', () => {
            solver.setGeometry({
                points: [
                    { x: 0, y: 0 },
                    { x: 8, y: 2 },   // Should be horizontal at y=0, distance 10
                    { x: 8, y: 10 }   // Should be vertical from point 1
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            solver.addConstraint(SketchSolver.fixed(0));
            solver.addConstraint(SketchSolver.horizontal(0, 1));
            solver.addConstraint(SketchSolver.distance(0, 1, 10));
            solver.addConstraint(SketchSolver.vertical(1, 2));

            const result = solver.solve();
            expect(result.success).toBe(true);
        });

        it('should return error if geometry not set', () => {
            const result = solver.solve();
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should respect fixed points', () => {
            const initialPoint = { x: 5, y: 5 };
            
            solver.setGeometry({
                points: [
                    { ...initialPoint },
                    { x: 10, y: 10 }
                ],
                lines: [],
                circles: [],
                arcs: []
            });

            solver.fixPoint(0);
            solver.addConstraint(SketchSolver.coincident(0, 1));

            const result = solver.solve();
            expect(result.success).toBe(true);

            // Fixed point should not move
            expect(result.points[0].x).toBeCloseTo(initialPoint.x, 5);
            expect(result.points[0].y).toBeCloseTo(initialPoint.y, 5);
        });
    });

    describe('static helper methods', () => {
        describe('createConstraint()', () => {
            it('should create constraint with all properties', () => {
                const constraint = SketchSolver.createConstraint(
                    'distance',
                    [
                        { type: 'point', id: 'p0', pointIndex: 0 },
                        { type: 'point', id: 'p1', pointIndex: 1 }
                    ],
                    10,
                    'mm'
                );

                expect(constraint.id).toBeDefined();
                expect(constraint.type).toBe('distance');
                expect(constraint.value).toBe(10);
                expect(constraint.unit).toBe('mm');
            });
        });

        describe('coincident()', () => {
            it('should create coincident constraint', () => {
                const constraint = SketchSolver.coincident(0, 1);
                expect(constraint.type).toBe('coincident');
                expect(constraint.targets.length).toBe(2);
            });
        });

        describe('horizontal()', () => {
            it('should create horizontal constraint', () => {
                const constraint = SketchSolver.horizontal(0, 1);
                expect(constraint.type).toBe('horizontal');
            });
        });

        describe('vertical()', () => {
            it('should create vertical constraint', () => {
                const constraint = SketchSolver.vertical(0, 1);
                expect(constraint.type).toBe('vertical');
            });
        });

        describe('distance()', () => {
            it('should create distance constraint with value', () => {
                const constraint = SketchSolver.distance(0, 1, 15);
                expect(constraint.type).toBe('distance');
                expect(constraint.value).toBe(15);
                expect(constraint.unit).toBe('mm');
            });
        });

        describe('fixed()', () => {
            it('should create fixed constraint', () => {
                const constraint = SketchSolver.fixed(0);
                expect(constraint.type).toBe('fixed');
            });
        });
    });

    describe('ConstraintManager', () => {
        it('should create manager and solve', () => {
            const { ConstraintManager } = require('../SketchSolver');
            const manager = new ConstraintManager();

            manager.getSolver().setGeometry({
                points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
                lines: [],
                circles: [],
                arcs: []
            });

            manager.addConstraint(SketchSolver.horizontal(0, 1));
            
            const result = manager.solve();
            expect(result.success).toBe(true);
        });
    });
});
