import { describe, it, expect } from 'vitest';
import { ConstraintManager } from '../constraints/ConstraintManager';
import type { Constraint } from '../constraints/ConstraintTypes';

describe('ConstraintManager', () => {
  it('creates a distance constraint', () => {
    const manager = new ConstraintManager();
    const constraint: Constraint = {
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [
        { strokeId: 's-1', segmentIndex: 0, pointIndex: 0 },
        { strokeId: 's-1', segmentIndex: 0, pointIndex: 1 }
      ],
      createdAt: Date.now()
    };
    
    manager.addConstraint(constraint);
    const constraints = manager.getConstraints();
    
    expect(constraints).toHaveLength(1);
    expect(constraints[0]).toEqual(constraint);
  });

  it('enforces distance constraint during drag', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [
        { strokeId: 's-1', segmentIndex: 0, pointIndex: 0 },
        { strokeId: 's-1', segmentIndex: 0, pointIndex: 1 }
      ],
      createdAt: Date.now()
    });

    const anchorPoint = { x: 0, y: 0 };
    const draggedPoint = { x: 150, y: 0 };
    
    const constrained = manager.enforceConstraint('c-1', draggedPoint, anchorPoint);
    
    expect(constrained).toBeDefined();
    const dx = constrained!.x - anchorPoint.x;
    const dy = constrained!.y - anchorPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(distance).toBeCloseTo(100, 5);
  });

  it('removes a constraint', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });
    
    manager.removeConstraint('c-1');
    expect(manager.getConstraints()).toHaveLength(0);
  });

  it('updates constraint value', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });
    
    manager.updateConstraint('c-1', 150);
    const constraints = manager.getConstraints();
    expect(constraints[0].value).toBe(150);
  });
});
