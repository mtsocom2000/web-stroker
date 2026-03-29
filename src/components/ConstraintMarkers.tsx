import React from 'react';
import type { Point } from '../types';
import type { Constraint, ConstraintTarget } from '../constraints/ConstraintTypes';

interface ConstraintMarkersProps {
  constraints: Constraint[];
  getPointForTarget: (target: ConstraintTarget) => Point | null;
  worldToScreen: (point: Point) => { x: number; y: number };
}

export const ConstraintMarkers: React.FC<ConstraintMarkersProps> = ({
  constraints,
  getPointForTarget,
  worldToScreen
}) => {
  return (
    <g>
      {constraints.map(constraint =>
        constraint.targets.map((target, idx) => {
          const point = getPointForTarget(target);
          if (!point) return null;

          const screen = worldToScreen(point);

          return (
            <g key={`${constraint.id}-marker-${idx}`}>
              <circle
                cx={screen.x}
                cy={screen.y}
                r="5"
                fill="#2196f3"
                stroke="white"
                strokeWidth="2"
              />
            </g>
          );
        })
      )}
    </g>
  );
};
