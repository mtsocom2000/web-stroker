import { describe, it, expect } from 'vitest';
import { ConstraintManager } from '../constraints/ConstraintManager';
import type { Constraint } from '../constraints/ConstraintTypes';

describe('Constraints Integration', () => {
  it('creates and manages constraints', () => {
    const manager = new ConstraintManager();
    
    const constraint: Constraint = {
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    };
    
    manager.addConstraint(constraint);
    const constraints = manager.getConstraints();
    
    expect(constraints).toHaveLength(1);
    expect(constraints[0].value).toBe(100);
  });

  it('enforces distance constraint', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-1',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });

    const anchorPoint = { x: 0, y: 0 };
    const draggedPoint = { x: 150, y: 0 };
    
    const enforced = manager.enforceConstraint('c-1', draggedPoint, anchorPoint);
    
    expect(enforced).toBeDefined();
    if (enforced) {
      const dx = enforced.x - anchorPoint.x;
      const dy = enforced.y - anchorPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeCloseTo(100, 5);
    }
  });

  it('removes constraint', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-remove',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });
    
    manager.removeConstraint('c-remove');
    expect(manager.getConstraints()).toHaveLength(0);
  });

  it('updates constraint value', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-update',
      type: 'distance',
      value: 100,
      targets: [],
      createdAt: Date.now()
    });

    manager.updateConstraint('c-update', 150);
    const constraints = manager.getConstraints();
    expect(constraints[0].value).toBe(150);
  });

  it('gets constraints for target', () => {
    const manager = new ConstraintManager();
    manager.addConstraint({
      id: 'c-target',
      type: 'distance',
      value: 100,
      targets: [
        { strokeId: 'line-1', segmentIndex: 0, pointIndex: 0 }
      ],
      createdAt: Date.now()
    });

    const constraints = manager.getConstraintsForTarget('line-1', 0);
    expect(constraints).toHaveLength(1);
    expect(constraints[0].id).toBe('c-target');
  });
});
