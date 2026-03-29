import { useCallback } from 'react';
import type { ConstraintType, ConstraintTarget } from '../constraints/ConstraintTypes';

export function useConstraints() {

  const startCreation = useCallback((_type: ConstraintType) => {
    // TODO: Set store state to constraint creation mode
  }, []);

  const addTarget = useCallback((_target: ConstraintTarget) => {
    // TODO: Add target to pending targets
  }, []);

  const completeCreation = useCallback((value: number) => {
    // TODO: Create constraint from pending targets + value
    console.log('Complete constraint creation with value:', value);
  }, []);

  const cancelCreation = useCallback(() => {
    // TODO: Clear pending state
  }, []);

  return {
    isCreating: false,
    constraintType: null,
    pendingTargets: [],
    startCreation,
    addTarget,
    completeCreation,
    cancelCreation
  };
}
