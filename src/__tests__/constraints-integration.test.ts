import { describe, it, expect, beforeEach } from 'vitest';
import { useDrawingStore } from '../store';

describe('Constraints Integration', () => {
  beforeEach(() => {
    // Reset store state
    useDrawingStore.getState().clearStrokes();
  });

  it('creates and stores a distance constraint', () => {
    const store = useDrawingStore.getState();

    // Add a test stroke
    store.addStroke({
      id: 'line-1',
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      smoothedPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      color: '#000000',
      thickness: 2,
      timestamp: Date.now(),
      strokeType: 'digital',
      digitalSegments: [{
        id: 'seg-1',
        type: 'line',
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
        color: '#000000'
      }]
    });

    // Create constraint
    store.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [
        { strokeId: 'line-1', segmentIndex: 0, pointIndex: 0 },
        { strokeId: 'line-1', segmentIndex: 0, pointIndex: 1 }
      ],
      createdAt: Date.now()
    });

    // Verify constraint created
    expect(store.constraints).toHaveLength(1);
    expect(store.constraints[0].value).toBe(100);
    expect(store.constraints[0].type).toBe('distance');
  });

  it('enforces constraint through ConstraintManager', () => {
    const store = useDrawingStore.getState();

    // Add constraint
    store.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });

    // Test constraint enforcement
    const anchorPoint = { x: 0, y: 0 };
    const draggedPoint = { x: 150, y: 0 };
    
    const enforced = store.constraintManager.enforceConstraint(
      'c-1',
      draggedPoint,
      anchorPoint
    );

    expect(enforced).toBeDefined();
    if (enforced) {
      const dx = enforced.x - anchorPoint.x;
      const dy = enforced.y - anchorPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeCloseTo(100, 5);
    }
  });

  it('removes constraint', () => {
    const store = useDrawingStore.getState();

    // Add constraint
    store.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });

    expect(store.constraints).toHaveLength(1);

    // Remove constraint
    store.removeConstraint('c-1');

    expect(store.constraints).toHaveLength(0);
  });

  it('updates constraint value', () => {
    const store = useDrawingStore.getState();

    // Add constraint
    store.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });

    // Update constraint
    store.updateConstraint('c-1', 150);

    expect(store.constraints[0].value).toBe(150);
  });

  it('gets constraints for a specific point', () => {
    const store = useDrawingStore.getState();

    // Add multiple constraints
    store.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [
        { strokeId: 'line-1', segmentIndex: 0, pointIndex: 0 }
      ],
      createdAt: Date.now()
    });
    store.addConstraint({
      id: 'c-2',
      type: 'distance',
      value: 50,
      targets: [
        { strokeId: 'line-2', segmentIndex: 0, pointIndex: 0 }
      ],
      createdAt: Date.now()
    });

    // Get constraints for specific point
    const constraints = store.getConstraintsForPoint('line-1', 0);
    expect(constraints).toHaveLength(1);
    expect(constraints[0].id).toBe('c-1');
  });
});
