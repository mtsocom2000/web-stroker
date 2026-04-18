/**
 * FeatureTree 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureTree, createFeature, createExtrudeFeature, createRevolveFeature, createBooleanFeature } from '../FeatureTree';

describe('FeatureTree', () => {
    let tree: FeatureTree;

    beforeEach(() => {
        tree = new FeatureTree();
    });

    describe('addFeature()', () => {
        it('should add feature successfully', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            const retrieved = tree.getFeature(feature.id);
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('Extrude1');
        });

        it('should add feature with parent', () => {
            const parent = createFeature('sketch', 'Sketch1', {});
            const child = createFeature('extrude', 'Extrude1', { distance: 10 }, parent.id);

            tree.addFeature(parent);
            tree.addFeature(child);

            const parentFeatures = tree.getChildren(parent.id);
            expect(parentFeatures.length).toBe(1);
            expect(parentFeatures[0].id).toBe(child.id);
        });

        it('should add root feature', () => {
            const feature = createFeature('sketch', 'Sketch1', {});
            tree.addFeature(feature);

            const roots = tree.getRootFeatures();
            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe(feature.id);
        });
    });

    describe('getFeature()', () => {
        it('should return feature by id', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            const retrieved = tree.getFeature(feature.id);
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(feature.id);
        });

        it('should return undefined for non-existent feature', () => {
            const retrieved = tree.getFeature('non-existent');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('deleteFeature()', () => {
        it('should delete feature', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            tree.deleteFeature(feature.id);

            const retrieved = tree.getFeature(feature.id);
            expect(retrieved).toBeUndefined();
        });

        it('should delete children recursively', () => {
            const parent = createFeature('sketch', 'Sketch1', {});
            const child = createFeature('extrude', 'Extrude1', { distance: 10 }, parent.id);
            const grandchild = createFeature('fillet', 'Fillet1', { radius: 2 }, child.id);

            tree.addFeature(parent);
            tree.addFeature(child);
            tree.addFeature(grandchild);

            tree.deleteFeature(parent.id);

            expect(tree.getFeature(parent.id)).toBeUndefined();
            expect(tree.getFeature(child.id)).toBeUndefined();
            expect(tree.getFeature(grandchild.id)).toBeUndefined();
        });

        it('should remove from parent children list', () => {
            const parent = createFeature('sketch', 'Sketch1', {});
            const child = createFeature('extrude', 'Extrude1', { distance: 10 }, parent.id);

            tree.addFeature(parent);
            tree.addFeature(child);

            tree.deleteFeature(child.id);

            const updatedParent = tree.getFeature(parent.id);
            expect(updatedParent?.children.length).toBe(0);
        });
    });

    describe('updateFeature()', () => {
        it('should update feature parameters', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            tree.updateFeature(feature.id, { distance: 20 });

            const updated = tree.getFeature(feature.id);
            expect(updated?.parameters.distance).toBe(20);
        });

        it('should update timestamp', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            const beforeUpdate = feature.updatedAt;
            tree.updateFeature(feature.id, { distance: 20 });
            const afterUpdate = tree.getFeature(feature.id)?.updatedAt;

            expect(afterUpdate).toBeGreaterThanOrEqual(beforeUpdate);
        });
    });

    describe('suppressFeature()', () => {
        it('should suppress feature', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            tree.suppressFeature(feature.id, true);

            const suppressed = tree.getFeature(feature.id);
            expect(suppressed?.suppressed).toBe(true);
        });

        it('should restore suppressed feature', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            tree.suppressFeature(feature.id, true);
            tree.suppressFeature(feature.id, false);

            const restored = tree.getFeature(feature.id);
            expect(restored?.suppressed).toBe(false);
        });
    });

    describe('getChildren()', () => {
        it('should return all children', () => {
            const parent = createFeature('sketch', 'Sketch1', {});
            const child1 = createFeature('extrude', 'Extrude1', { distance: 10 }, parent.id);
            const child2 = createFeature('extrude', 'Extrude2', { distance: 20 }, parent.id);

            tree.addFeature(parent);
            tree.addFeature(child1);
            tree.addFeature(child2);

            const children = tree.getChildren(parent.id);
            expect(children.length).toBe(2);
        });

        it('should return empty array for no children', () => {
            const feature = createFeature('sketch', 'Sketch1', {});
            tree.addFeature(feature);

            const children = tree.getChildren(feature.id);
            expect(children.length).toBe(0);
        });
    });

    describe('getTreeStructure()', () => {
        it('should return tree structure', () => {
            const parent = createFeature('sketch', 'Sketch1', {});
            const child = createFeature('extrude', 'Extrude1', { distance: 10 }, parent.id);

            tree.addFeature(parent);
            tree.addFeature(child);

            const structure = tree.getTreeStructure();
            
            expect(structure.length).toBe(1);
            expect(structure[0].name).toBe('Sketch1');
            expect(structure[0].children.length).toBe(1);
            expect(structure[0].children[0].name).toBe('Extrude1');
        });
    });

    describe('serialize/deserialize()', () => {
        it('should serialize and deserialize', () => {
            const feature = createFeature('extrude', 'Extrude1', { distance: 10 });
            tree.addFeature(feature);

            const serialized = tree.serialize();
            const newTree = new FeatureTree();
            newTree.deserialize(serialized);

            const retrieved = newTree.getFeature(feature.id);
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('Extrude1');
        });
    });

    describe('clear()', () => {
        it('should clear all features', () => {
            const feature1 = createFeature('sketch', 'Sketch1', {});
            const feature2 = createFeature('extrude', 'Extrude1', { distance: 10 });

            tree.addFeature(feature1);
            tree.addFeature(feature2);

            tree.clear();

            expect(tree.getRootFeatures().length).toBe(0);
            expect(tree.getAllFeatures().length).toBe(0);
        });
    });

    describe('createFeature helpers', () => {
        describe('createFeature()', () => {
            it('should create feature with all properties', () => {
                const feature = createFeature('extrude', 'MyExtrude', { distance: 10 });

                expect(feature.id).toBeDefined();
                expect(feature.type).toBe('extrude');
                expect(feature.name).toBe('MyExtrude');
                expect(feature.parameters.distance).toBe(10);
                expect(feature.suppressed).toBe(false);
            });
        });

        describe('createExtrudeFeature()', () => {
            it('should create extrude feature', () => {
                const feature = createExtrudeFeature('sketch-001', 50);

                expect(feature.type).toBe('extrude');
                expect(feature.parameters.sketchId).toBe('sketch-001');
                expect(feature.parameters.distance).toBe(50);
            });
        });

        describe('createRevolveFeature()', () => {
            it('should create revolve feature', () => {
                const feature = createRevolveFeature(
                    'sketch-001',
                    { x: 0, y: 0, z: 0 },
                    { x: 0, y: 0, z: 1 },
                    360
                );

                expect(feature.type).toBe('revolve');
                expect(feature.parameters.sketchId).toBe('sketch-001');
                expect(feature.parameters.angle).toBe(360);
            });
        });

        describe('createBooleanFeature()', () => {
            it('should create boolean feature', () => {
                const feature = createBooleanFeature(
                    'union',
                    'shape-001',
                    ['shape-002', 'shape-003']
                );

                expect(feature.type).toBe('boolean');
                expect(feature.parameters.operation).toBe('union');
                expect(feature.parameters.targetShapeId).toBe('shape-001');
            });
        });
    });
});
