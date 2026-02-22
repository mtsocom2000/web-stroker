import type { Point, DigitalSegment } from '../types';

export interface Vertex {
  id: string;
  position: Point;
  incidentEdges: Edge[];
}

export interface Edge {
  id: string;
  v1: Vertex;
  v2: Vertex;
  strokeId: string;
  visitedLeft: boolean;
  visitedRight: boolean;
}

export interface Face {
  id: string;
  vertices: Vertex[];
  edgeIds: string[];
  area: number;
  centroid: Point;
}

export type PatternType = 'hatch' | 'grid' | 'dots' | 'crosshatch';

export interface FillStyle {
  type: PatternType;
  color: string;
  backgroundColor: string;
  spacing: number;
  angle: number;
}

export interface FillRegion {
  id: string;
  polygon: Point[];
  fillStyle: FillStyle;
  bounds: { min: Point; max: Point };
  transform: { x: number; y: number };
}

export interface ClosedArea {
  id: string;
  faceId: string;
  strokeIds: string[];
  edgeIds: string[];
  polygon: Point[];
  bounds: { min: Point; max: Point };
  area: number;
}

export interface HighlightStyle {
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderDash: number[];
}

export const DEFAULT_HIGHLIGHT_STYLE: HighlightStyle = {
  fillColor: 'rgba(74, 144, 217, 0.2)',
  borderColor: '#4A90D9',
  borderWidth: 2,
  borderDash: [5, 5],
};

export interface Stroke {
  id: string;
  points: Point[];
  displayPoints?: Point[];
  digitalSegments?: DigitalSegment[];
  isClosed?: boolean;
}

export const DEFAULT_FILL_STYLE: FillStyle = {
  type: 'hatch',
  color: '#4A90D9',
  backgroundColor: 'rgba(74, 144, 217, 0.1)',
  spacing: 8,
  angle: Math.PI / 4,
};

export function createFillStyle(overrides?: Partial<FillStyle>): FillStyle {
  return { ...DEFAULT_FILL_STYLE, ...overrides };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
