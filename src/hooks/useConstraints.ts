import { useCallback } from 'react';
import { useDrawingStore } from '../store';
import type { ConstraintType, ConstraintTarget, Constraint } from '../constraints/ConstraintTypes';
import { generateId } from '../utils';

export function useConstraints() {
  const store = useDrawingStore();

  const startCreation = useCallback((type: ConstraintType) => {
    store.setIsCreatingConstraint(true);
    store.setConstraintType(type);
    store.clearConstraintTargets();
  }, [store]);

  const addTarget = useCallback((target: ConstraintTarget) => {
    store.addConstraintTarget(target);
  }, [store]);

  const completeCreation = useCallback((value: number) => {
    const constraint: Constraint = {
      id: generateId(),
      type: store.constraintType as ConstraintType,
      value,
      targets: store.constraintPendingTargets,
      createdAt: Date.now()
    };
    store.addConstraint(constraint);
    store.setIsCreatingConstraint(false);
    store.setConstraintType(null);
    store.clearConstraintTargets();
  }, [store]);

  const cancelCreation = useCallback(() => {
    store.setIsCreatingConstraint(false);
    store.setConstraintType(null);
    store.clearConstraintTargets();
  }, [store]);

  return {
    isCreating: store.isCreatingConstraint,
    constraintType: store.constraintType,
    pendingTargets: store.constraintPendingTargets,
    startCreation,
    addTarget,
    completeCreation,
    cancelCreation
  };
}
