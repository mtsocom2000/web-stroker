import type { Point, Stroke } from '../types';
import type { SegmentMetadata, IntersectionPoint } from './types';
import { SpatialIndex, computeBbox } from './SpatialIndex';

export class IntersectionManager {
  private spatialIndex: SpatialIndex;
  private segmentMap: Map<string, SegmentMetadata> = new Map();
  private dirtySegments: Set<string> = new Set();
  private fullRebuildNeeded: boolean = true;
  private rebuildTimeoutId: number | null = null;
  private pendingStrokes: Stroke[] | null = null;

  constructor() {
    this.spatialIndex = new SpatialIndex();
  }

  private getSegmentId(strokeId: string, segmentIndex: number): string {
    return `${strokeId}:${segmentIndex}`;
  }

  private getSegmentKey(id: string): { strokeId: string; segmentIndex: number } {
    const [strokeId, segmentIndex] = id.split(':');
    return { strokeId, segmentIndex: parseInt(segmentIndex, 10) };
  }

  buildFromStrokes(strokes: Stroke[]): void {
    // Debounce rebuilds to avoid blocking UI during rapid updates
    this.pendingStrokes = strokes;
    
    if (this.rebuildTimeoutId !== null) {
      cancelAnimationFrame(this.rebuildTimeoutId);
    }
    
    this.rebuildTimeoutId = requestAnimationFrame(() => {
      this.doBuildFromStrokes(this.pendingStrokes!);
      this.rebuildTimeoutId = null;
      this.pendingStrokes = null;
    });
  }

  private doBuildFromStrokes(strokes: Stroke[]): void {
    this.spatialIndex.clear();
    this.segmentMap.clear();

    for (const stroke of strokes) {
      if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;

      for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
        const segment = stroke.digitalSegments[segIdx];
        if (segment.points.length < 2) continue;

        const p1 = segment.points[0];
        const p2 = segment.points[segment.points.length - 1];
        const bbox = computeBbox(p1, p2);

        const id = this.getSegmentId(stroke.id, segIdx);
        const metadata: SegmentMetadata = {
          id,
          strokeId: stroke.id,
          segmentIndex: segIdx,
          bbox,
          cachedIntersections: new Set(),
        };

        this.segmentMap.set(id, metadata);
        this.spatialIndex.insert(metadata);
      }
    }

    this.fullRebuildNeeded = false;
  }

  updateSegment(strokeId: string, segmentIndex: number, newPoints: Point[]): void {
    const id = this.getSegmentId(strokeId, segmentIndex);
    const existing = this.segmentMap.get(id);
    if (!existing || newPoints.length < 2) return;

    const newP1 = newPoints[0];
    const newP2 = newPoints[newPoints.length - 1];
    const newBbox = computeBbox(newP1, newP2);

    existing.bbox = newBbox;
    this.spatialIndex.update(existing);
  }

  markDirty(segmentId: string): void {
    this.dirtySegments.add(segmentId);
  }

  computeIncrementalIntersections(
    draggedSegmentId: string,
    newPoints: Point[]
  ): IntersectionPoint[] {
    const dragged = this.segmentMap.get(draggedSegmentId);
    if (!dragged) return [];

    const { strokeId, segmentIndex } = this.getSegmentKey(draggedSegmentId);

    const newP1 = newPoints[0];
    const newP2 = newPoints[newPoints.length - 1];
    const newBbox = computeBbox(newP1, newP2);
    dragged.bbox = newBbox;
    this.spatialIndex.update(dragged);

    for (const otherId of dragged.cachedIntersections) {
      const other = this.segmentMap.get(otherId);
      if (other) {
        other.cachedIntersections.delete(draggedSegmentId);
      }
    }
    dragged.cachedIntersections.clear();

    const candidates = this.spatialIndex.searchWithExpansion(newBbox, 2);
    const intersections: IntersectionPoint[] = [];

    for (const candidate of candidates) {
      if (candidate.id === draggedSegmentId) continue;

      const candidateSeg = this.segmentMap.get(candidate.id);
      if (!candidateSeg) continue;

      const intersection = this.computeLineIntersection(newP1, newP2, candidateSeg);
      if (intersection) {
        dragged.cachedIntersections.add(candidate.id);
        candidateSeg.cachedIntersections.add(draggedSegmentId);

        intersections.push({
          point: intersection,
          segments: [
            { strokeId, segmentIndex },
            { strokeId: candidate.strokeId, segmentIndex: candidate.segmentIndex },
          ],
        });
      }
    }

    this.dirtySegments.delete(draggedSegmentId);
    return intersections;
  }

  private computeLineIntersection(
    p1: Point,
    p2: Point,
    other: SegmentMetadata
  ): Point | null {
    const otherSegs = this.segmentPointsGetter(other.id);
    if (!otherSegs) return null;

    const p3 = otherSegs[0];
    const p4 = otherSegs[1];

    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p4.x - p3.x;
    const dy2 = p4.y - p3.y;

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) < 1e-10) return null;

    const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / cross;
    const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / cross;

    if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) {
      return {
        x: p1.x + t * dx1,
        y: p1.y + t * dy1,
      };
    }

    return null;
  }

  private segmentPointsGetter: (id: string) => [Point, Point] | null = () => null;

  setSegmentPointsGetter(getter: (id: string) => [Point, Point] | null): void {
    this.segmentPointsGetter = getter;
  }

  getCachedIntersections(segmentId: string): IntersectionPoint[] {
    const segment = this.segmentMap.get(segmentId);
    if (!segment) return [];

    const intersections: IntersectionPoint[] = [];

    for (const otherId of segment.cachedIntersections) {
      const other = this.segmentMap.get(otherId);
      if (!other) continue;

      const segPoints = this.segmentPointsGetter(segment.id);
      const otherPoints = this.segmentPointsGetter(otherId);
      if (!segPoints || !otherPoints) continue;

      const point = this.computeIntersectionPoint(segPoints[0], segPoints[1], otherPoints[0], otherPoints[1]);
      if (point) {
        intersections.push({
          point,
          segments: [
            { strokeId: segment.strokeId, segmentIndex: segment.segmentIndex },
            { strokeId: other.strokeId, segmentIndex: other.segmentIndex },
          ],
        });
      }
    }

    return intersections;
  }

  private computeIntersectionPoint(
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point
  ): Point | null {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p4.x - p3.x;
    const dy2 = p4.y - p3.y;

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) < 1e-10) return null;

    const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / cross;

    if (t > 0.001 && t < 0.999) {
      return {
        x: p1.x + t * dx1,
        y: p1.y + t * dy1,
      };
    }

    return null;
  }

  rebuildAll(strokes: Stroke[]): void {
    this.buildFromStrokes(strokes);
  }

  needsFullRebuild(): boolean {
    return this.fullRebuildNeeded;
  }

  clearDirty(): void {
    this.dirtySegments.clear();
  }

  isDirty(segmentId: string): boolean {
    return this.dirtySegments.has(segmentId);
  }
}

export function mergeCloseIntersections(
  intersections: IntersectionPoint[],
  threshold: number = 2.0
): IntersectionPoint[] {
  const merged: IntersectionPoint[] = [];

  for (const int of intersections) {
    const existingIdx = merged.findIndex(
      m => Math.hypot(m.point.x - int.point.x, m.point.y - int.point.y) < threshold
    );

    if (existingIdx >= 0) {
      for (const seg of int.segments) {
        if (!merged[existingIdx].segments.some(
          s => s.strokeId === seg.strokeId && s.segmentIndex === seg.segmentIndex
        )) {
          merged[existingIdx].segments.push(seg);
        }
      }
    } else {
      merged.push({ ...int, segments: [...int.segments] });
    }
  }

  return merged;
}
