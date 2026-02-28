import type { Point } from '../types';

export interface SegmentBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SegmentMetadata {
  id: string;
  strokeId: string;
  segmentIndex: number;
  bbox: SegmentBBox;
  cachedIntersections: Set<string>;
}

export interface IntersectionPoint {
  point: Point;
  segments: Array<{ strokeId: string; segmentIndex: number }>;
}

export interface SegmentRef {
  strokeId: string;
  segmentIndex: number;
}
