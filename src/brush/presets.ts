export type BrushType = 'pencil' | 'pen' | 'brush' | 'ballpen';

export interface BrushSettings {
  type: BrushType;
  size: number;
  opacity: number;
  pressure: boolean;
  hardness: number;
  spacing: number;
  curvatureAdaptation: boolean;
}

export interface PhysicsParams {
  inverseMass: number;
  dragCoefficient: number;
  interpolationSteps: number;
}

export const DEFAULT_PHYSICS_PARAMS: PhysicsParams = {
  inverseMass: 1,
  dragCoefficient: 0.9213,
  interpolationSteps: 6,
};

export const BRUSH_PRESETS: Record<BrushType, BrushSettings> = {
  pencil: {
    type: 'pencil',
    size: 2,
    opacity: 0.9,
    pressure: false,
    hardness: 0.95,
    spacing: 0.3,
    curvatureAdaptation: false,
  },
  pen: {
    type: 'pen',
    size: 1.5,
    opacity: 0.85,
    pressure: true,
    hardness: 0.8,
    spacing: 0.2,
    curvatureAdaptation: true,
  },
  brush: {
    type: 'brush',
    size: 8,
    opacity: 0.4,
    pressure: true,
    hardness: 0.3,
    spacing: 0.15,
    curvatureAdaptation: true,
  },
  ballpen: {
    type: 'ballpen',
    size: 1,
    opacity: 0.7,
    pressure: false,
    hardness: 0.6,
    spacing: 0.25,
    curvatureAdaptation: false,
  },
};

export function getDefaultBrush(): BrushSettings {
  return { ...BRUSH_PRESETS.pencil };
}

export function mergeBrushSettings(
  base: BrushSettings,
  overrides: Partial<BrushSettings>
): BrushSettings {
  return { ...base, ...overrides };
}
