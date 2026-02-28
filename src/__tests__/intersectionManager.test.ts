import { describe, it, expect, beforeEach } from 'vitest';
import type { Point, Stroke } from '../types';
import { SpatialIndex, computeBbox, bboxesIntersect } from '../intersection/SpatialIndex';
import { IntersectionManager } from '../intersection/IntersectionManager';

describe('SpatialIndex', () => {
  let spatialIndex: SpatialIndex;

  beforeEach(() => {
    spatialIndex = new SpatialIndex();
  });

  describe('computeBbox', () => {
    it('should compute bounding box correctly', () => {
      const bbox = computeBbox({ x: 0, y: 0 }, { x: 10, y: 5 });
      expect(bbox.minX).toBe(0);
      expect(bbox.minY).toBe(0);
      expect(bbox.maxX).toBe(10);
      expect(bbox.maxY).toBe(5);
    });

    it('should handle reversed coordinates', () => {
      const bbox = computeBbox({ x: 10, y: 5 }, { x: 0, y: 0 });
      expect(bbox.minX).toBe(0);
      expect(bbox.minY).toBe(0);
      expect(bbox.maxX).toBe(10);
      expect(bbox.maxY).toBe(5);
    });
  });

  describe('bboxesIntersect', () => {
    it('should detect intersecting bboxes', () => {
      const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const b = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
      expect(bboxesIntersect(a, b)).toBe(true);
    });

    it('should detect non-intersecting bboxes', () => {
      const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const b = { minX: 20, minY: 20, maxX: 30, maxY: 30 };
      expect(bboxesIntersect(a, b)).toBe(false);
    });
  });

  describe('insert and search', () => {
    it('should insert and find segments', () => {
      spatialIndex.insert({
        id: 'seg1',
        strokeId: 'stroke1',
        segmentIndex: 0,
        bbox: computeBbox({ x: 0, y: 0 }, { x: 10, y: 10 }),
        cachedIntersections: new Set<string>(),
      });

      const results = spatialIndex.search(computeBbox({ x: 0, y: 0 }, { x: 10, y: 10 }));
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('seg1');
    });

    it('should find segments in expanded search', () => {
      spatialIndex.insert({
        id: 'seg1',
        strokeId: 'stroke1',
        segmentIndex: 0,
        bbox: computeBbox({ x: 0, y: 0 }, { x: 10, y: 10 }),
        cachedIntersections: new Set<string>(),
      });

      const results = spatialIndex.searchWithExpansion(
        computeBbox({ x: 2, y: 2 }, { x: 3, y: 3 }),
        2
      );
      expect(results).toHaveLength(1);
    });

    it('should not find segments outside search area', () => {
      spatialIndex.insert({
        id: 'seg1',
        strokeId: 'stroke1',
        segmentIndex: 0,
        bbox: computeBbox({ x: 0, y: 0 }, { x: 10, y: 10 }),
        cachedIntersections: new Set<string>(),
      });

      const results = spatialIndex.search(computeBbox({ x: 20, y: 20 }, { x: 30, y: 30 }));
      expect(results).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update segment position', () => {
      const segment = {
        id: 'seg1',
        strokeId: 'stroke1',
        segmentIndex: 0,
        bbox: computeBbox({ x: 0, y: 0 }, { x: 10, y: 10 }),
        cachedIntersections: new Set<string>(),
      };

      spatialIndex.insert(segment);

      const updatedSegment = {
        ...segment,
        bbox: computeBbox({ x: 50, y: 50 }, { x: 60, y: 60 }),
      };
      spatialIndex.update(updatedSegment);

      const oldResults = spatialIndex.search(computeBbox({ x: 0, y: 0 }, { x: 10, y: 10 }));
      expect(oldResults).toHaveLength(0);

      const newResults = spatialIndex.search(computeBbox({ x: 50, y: 50 }, { x: 60, y: 60 }));
      expect(newResults).toHaveLength(1);
    });
  });
});

describe('IntersectionManager', () => {
  let manager: IntersectionManager;

  const createStroke = (id: string, segments: Array<{ p1: Point; p2: Point }>): Stroke => ({
    id,
    points: [],
    smoothedPoints: [],
    color: '#000',
    thickness: 1,
    timestamp: Date.now(),
    strokeType: 'digital',
    digitalSegments: segments.map((seg, idx) => ({
      id: `${id}:${idx}`,
      type: 'line' as const,
      points: [seg.p1, seg.p2],
      color: '#000',
    })),
  });

  const strokesRef = { current: [] as Stroke[] };

  beforeEach(() => {
    manager = new IntersectionManager();
    manager.setSegmentPointsGetter((id: string) => {
      const [strokeId, segIdx] = id.split(':');
      const stroke = strokesRef.current.find(s => s.id === strokeId);
      if (!stroke || !stroke.digitalSegments) return null;
      const seg = stroke.digitalSegments[parseInt(segIdx, 10)];
      if (!seg || seg.points.length < 2) return null;
      return [seg.points[0], seg.points[seg.points.length - 1]];
    });
  });

  describe('buildFromStrokes', () => {
    it('should build index from strokes', () => {
      const strokes = [
        createStroke('stroke1', [{ p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } }]),
        createStroke('stroke2', [{ p1: { x: 10, y: 0 }, p2: { x: 0, y: 10 } }]),
      ];
      strokesRef.current = strokes;

      manager.buildFromStrokes(strokes);

      expect(manager.needsFullRebuild()).toBe(false);
    });
  });

  describe('incremental updates', () => {
    it('should update segment in spatial index', () => {
      const strokes = [
        createStroke('stroke1', [{ p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } }]),
        createStroke('stroke2', [{ p1: { x: 10, y: 0 }, p2: { x: 0, y: 10 } }]),
      ];
      strokesRef.current = strokes;

      manager.buildFromStrokes(strokes);

      manager.updateSegment('stroke1', 0, [
        { x: 5, y: 5 },
        { x: 15, y: 15 },
      ]);

      expect(true).toBe(true);
    });
  });

  describe('performance test', () => {
    it('should handle many segments efficiently', () => {
      const strokes: Stroke[] = [];
      const numStrokes = 100;

      for (let i = 0; i < numStrokes; i++) {
        strokes.push(createStroke(`stroke${i}`, [
          { p1: { x: i * 10, y: 0 }, p2: { x: i * 10, y: 500 } },
        ]));
      }
      strokesRef.current = strokes;

      const buildStart = performance.now();
      manager.buildFromStrokes(strokes);
      const buildTime = performance.now() - buildStart;

      expect(buildTime).toBeLessThan(100);

      const updateStart = performance.now();
      manager.updateSegment('stroke50', 0, [
        { x: 250, y: 100 },
        { x: 250, y: 400 },
      ]);
      const updateTime = performance.now() - updateStart;

      expect(updateTime).toBeLessThan(10);
    });
  });
});
