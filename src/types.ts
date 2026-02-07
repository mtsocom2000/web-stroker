export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  smoothedPoints: Point[];
  /** When set (Predict ON + shape detected), render using this instead of smoothedPoints */
  displayPoints?: Point[];
  color: string;
  thickness: number;
  timestamp: number;
}

export interface CanvasState {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  predictEnabled?: boolean;
}

export interface DrawingData {
  version: string;
  timestamp: number;
  canvasState: CanvasState;
}
