import type { Constraint } from './ConstraintTypes';
import type { Point } from '../types';

export class ConstraintManager {
  private constraints: Map<string, Constraint> = new Map();

  addConstraint(constraint: Constraint): void {
    this.constraints.set(constraint.id, constraint);
  }

  removeConstraint(id: string): void {
    this.constraints.delete(id);
  }

  updateConstraint(id: string, value: number): void {
    const constraint = this.constraints.get(id);
    if (constraint) {
      constraint.value = value;
    }
  }

  getConstraints(): Constraint[] {
    return Array.from(this.constraints.values());
  }

  getConstraintsForTarget(strokeId: string, pointIndex?: number): Constraint[] {
    return this.getConstraints().filter(c =>
      c.targets.some(t => t.strokeId === strokeId && t.pointIndex === pointIndex)
    );
  }

  enforceConstraint(
    constraintId: string,
    draggedPoint: Point,
    anchorPoint: Point
  ): Point | null {
    const constraint = this.constraints.get(constraintId);
    if (!constraint) return null;

    switch (constraint.type) {
      case 'distance':
        return this.enforceDistanceConstraint(draggedPoint, anchorPoint, constraint.value);
      case 'angle':
        // Angle constraint enforcement is more complex - handled separately
        return draggedPoint;
      case 'radius':
        // Radius constraint - handled in circle context
        return draggedPoint;
      default:
        return draggedPoint;
    }
  }

  private enforceDistanceConstraint(
    draggedPoint: Point,
    anchorPoint: Point,
    distance: number
  ): Point {
    const dx = draggedPoint.x - anchorPoint.x;
    const dy = draggedPoint.y - anchorPoint.y;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (currentDistance === 0) {
      return { x: anchorPoint.x + distance, y: anchorPoint.y };
    }
    
    const scale = distance / currentDistance;
    return {
      x: anchorPoint.x + dx * scale,
      y: anchorPoint.y + dy * scale
    };
  }
}
