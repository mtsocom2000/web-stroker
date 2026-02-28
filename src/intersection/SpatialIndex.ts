import RBush from 'rbush';
import type { SegmentBBox, SegmentMetadata } from './types';

interface RbushItem extends SegmentBBox, SegmentMetadata {}

export class SpatialIndex {
  private tree: RBush<RbushItem>;
  private itemsById: Map<string, RbushItem> = new Map();

  constructor(maxEntries: number = 16) {
    this.tree = new RBush(maxEntries);
  }

  insert(segment: SegmentMetadata): void {
    const item: RbushItem = {
      minX: segment.bbox.minX,
      minY: segment.bbox.minY,
      maxX: segment.bbox.maxX,
      maxY: segment.bbox.maxY,
      ...segment,
    };
    this.itemsById.set(segment.id, item);
    this.tree.insert(item);
  }

  remove(segment: SegmentMetadata): void {
    const existing = this.itemsById.get(segment.id);
    if (existing) {
      this.tree.remove(existing);
      this.itemsById.delete(segment.id);
    }
  }

  update(segment: SegmentMetadata): void {
    this.remove(segment);
    this.insert(segment);
  }

  search(bbox: SegmentBBox): SegmentMetadata[] {
    const results = this.tree.search({
      minX: bbox.minX,
      minY: bbox.minY,
      maxX: bbox.maxX,
      maxY: bbox.maxY,
    });
    return results.map(item => ({
      id: item.id,
      strokeId: item.strokeId,
      segmentIndex: item.segmentIndex,
      bbox: {
        minX: item.minX,
        minY: item.minY,
        maxX: item.maxX,
        maxY: item.maxY,
      },
      cachedIntersections: item.cachedIntersections,
    }));
  }

  searchWithExpansion(bbox: SegmentBBox, padding: number = 2): SegmentMetadata[] {
    const expanded: SegmentBBox = {
      minX: bbox.minX - padding,
      minY: bbox.minY - padding,
      maxX: bbox.maxX + padding,
      maxY: bbox.maxY + padding,
    };
    return this.search(expanded);
  }

  clear(): void {
    this.tree.clear();
    this.itemsById.clear();
  }

  load(segments: SegmentMetadata[]): void {
    this.itemsById.clear();
    const items: RbushItem[] = segments.map(segment => {
      const item: RbushItem = {
        minX: segment.bbox.minX,
        minY: segment.bbox.minY,
        maxX: segment.bbox.maxX,
        maxY: segment.bbox.maxY,
        ...segment,
      };
      this.itemsById.set(segment.id, item);
      return item;
    });
    this.tree.load(items);
  }

  get all(): SegmentMetadata[] {
    const allItems = this.tree.all();
    return allItems.map(item => ({
      id: item.id,
      strokeId: item.strokeId,
      segmentIndex: item.segmentIndex,
      bbox: {
        minX: item.minX,
        minY: item.minY,
        maxX: item.maxX,
        maxY: item.maxY,
      },
      cachedIntersections: item.cachedIntersections,
    }));
  }
}

export function computeBbox(p1: { x: number; y: number }, p2: { x: number; y: number }): SegmentBBox {
  return {
    minX: Math.min(p1.x, p2.x),
    minY: Math.min(p1.y, p2.y),
    maxX: Math.max(p1.x, p2.x),
    maxY: Math.max(p1.y, p2.y),
  };
}

export function bboxesIntersect(a: SegmentBBox, b: SegmentBBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}
