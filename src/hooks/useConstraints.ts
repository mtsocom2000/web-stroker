import { useCallback } from 'react';
import { useDrawingStore } from '../store';
import type { ConstraintType, ConstraintTarget, Constraint } from '../constraints/ConstraintTypes';
import { generateId } from '../utils';

export function useConstraints() {
  const store = useDrawingStore();

  const startCreation = useCallback((type: ConstraintType) => {
    // Set store state to constraint creation mode
    // This will be handled by store actions
  }, []);

  const addTarget = useCallback((target: ConstraintTarget) => {
    // Add target to pending targets
  }, []);

  const completeCreation = useCallback((value: number) => {
    const state = useDrawingStore.getState();
    // Create constraint from pending targets + value
    const constraint: Constraint = {
      id: generateId(),
      type: state.constraintType as ConstraintType,
      value,
      targets: state.pendingTargets,
      createdAt: Date.now()
    };
    store.addConstraint(constraint);
  }, [store]);

  const cancelCreation = useCallback(() => {
    // Clear pending state
  }, []);

  return {
    isCreating: false, // TODO: Get from store
    constraintType: null, // TODO: Get from store
    pendingTargets: [], // TODO: Get from store
    startCreation,
    addTarget,
    completeCreation,
    cancelCreation
  };
}
