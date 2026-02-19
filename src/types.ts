export interface Point {
  x: number;
  y: number;
  /** Timestamp in milliseconds for speed analysis */
  timestamp?: number;
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
  /** Brush settings for the new stamp-based rendering */
  brushType?: string;
  brushSettings?: {
    size: number;
    opacity: number;
    hardness: number;
    spacing: number;
    curvatureAdaptation: boolean;
  };
  /** Detected corner/characteristic points (for prediction/analysis) */
  cornerPoints?: Point[];
  cornerIndices?: number[];
  /** Segment information for shape detection (Phase 3) */
  segments?: StrokeSegment[];
}

export interface StrokeSegment {
  startIndex: number;
  endIndex: number;
  startPoint: Point;
  endPoint: Point;
  avgVelocity: number;
  angle: number;
  isStraight: boolean;
}

export interface CanvasState {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  predictEnabled?: boolean;
  smoothEnabled?: boolean;
}

export interface DrawingData {
  version: string;
  timestamp: number;
  canvasState: CanvasState;
}
