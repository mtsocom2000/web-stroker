export type ToolCategory = 'artistic' | 'digital';
export type ArtisticTool = 'pencil' | 'pen' | 'brush' | 'ballpen' | 'eraser';
export type DigitalTool = 'line' | 'circle' | 'curve';
export type StrokeType = 'artistic' | 'digital';

export interface Point {
  x: number;
  y: number;
  /** Timestamp in milliseconds for speed analysis */
  timestamp?: number;
}

export interface DigitalSegment {
  id: string;
  type: 'line' | 'arc' | 'bezier';
  points: Point[];
  /** For arcs: center and radius */
  arcData?: {
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
  /** For bezier: control points are in points array */
  color: string;
  originalId?: string;
  isClosed?: boolean;
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
  strokeType: StrokeType;
  /** Digital segments - only for digital strokes */
  digitalSegments?: DigitalSegment[];
  /** Whether this digital stroke forms a closed shape */
  isClosed?: boolean;
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
