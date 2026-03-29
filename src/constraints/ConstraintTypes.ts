export type ConstraintType = 'distance' | 'angle' | 'radius';

export interface ConstraintTarget {
  strokeId: string;
  segmentIndex?: number;
  pointIndex?: number;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  value: number;
  targets: ConstraintTarget[];
  createdAt: number;
}

export interface ConstraintState {
  constraints: Constraint[];
  isCreatingConstraint: boolean;
  constraintType: ConstraintType | null;
  pendingTargets: ConstraintTarget[];
}
