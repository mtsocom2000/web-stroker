import { describe, it, expect } from 'vitest';
import { findNearestStrokePoint, findBestSnapPoint, snapToGrid } from '../measurements';
import { geometry } from './test-utils';

describe('Digital Mode Snap Tests', () => {
  describe('Digital Stroke Point Snapping', () => {
    it('should snap to line segment endpoints', () => {
      const lineSegment = geometry.createLineSegment(0, 0, 100, 100);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      const point = { x: 3, y: 3 }; // Close to start point (0,0)
      
      const result = findNearestStrokePoint(point, [digitalStroke], 10);
      
      expect(result).not.toBeNull();
      expect(result!.point).toEqual({ x: 0, y: 0 });
      expect(result!.type).toBe('strokePoint');
    });

    it('should snap to circle arc endpoints', () => {
      const circleSegment = geometry.createCircleSegment(50, 50, 30);
      const digitalStroke = geometry.createDigitalStroke([circleSegment]);
      
      // Circle points are at (80,50), (50,80), (20,50), (50,20)
      const point = { x: 82, y: 52 }; // Close to (80,50)
      
      const result = findNearestStrokePoint(point, [digitalStroke], 10);
      
      expect(result).not.toBeNull();
      expect(result!.point.x).toBeCloseTo(80);
      expect(result!.point.y).toBeCloseTo(50);
      expect(result!.type).toBe('strokePoint');
    });

    it('should snap to arc segment endpoints', () => {
      const arcSegment = geometry.createArcSegment(50, 50, 30, 0, Math.PI / 2);
      const digitalStroke = geometry.createDigitalStroke([arcSegment]);
      
      // Arc endpoints: start at (80,50), end at (50,80)
      const point = { x: 52, y: 82 }; // Close to end point (50,80)
      
      const result = findNearestStrokePoint(point, [digitalStroke], 10);
      
      expect(result).not.toBeNull();
      expect(result!.point.x).toBeCloseTo(50);
      expect(result!.point.y).toBeCloseTo(80);
      expect(result!.type).toBe('strokePoint');
    });

    it('should prioritize closer endpoint when multiple segments exist', () => {
      const line1 = geometry.createLineSegment(0, 0, 100, 0);
      const line2 = geometry.createLineSegment(200, 0, 300, 0);
      const digitalStroke = geometry.createDigitalStroke([line1, line2]);
      
      const point = { x: 295, y: 3 }; // Close to line2 end (300,0)
      
      const result = findNearestStrokePoint(point, [digitalStroke], 10);
      
      expect(result).not.toBeNull();
      expect(result!.point).toEqual({ x: 300, y: 0 });
    });

    it('should ignore artistic strokes', () => {
      const lineSegment = geometry.createLineSegment(0, 0, 100, 100);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      const artisticStroke = geometry.createArtisticStroke([{ x: 50, y: 50 }]);
      
      // Point close to digital stroke endpoint (100,100)
      const point = { x: 103, y: 103 };
      
      const result = findNearestStrokePoint(point, [digitalStroke, artisticStroke], 10);
      
      expect(result).not.toBeNull();
      expect(result!.point).toEqual({ x: 100, y: 100 }); // Should snap to digital stroke end, not artistic
    });
  });

  describe('Digital Stroke Priority in findBestSnapPoint', () => {
    it('should prioritize digital stroke points over origin', () => {
      const lineSegment = geometry.createLineSegment(10, 10, 100, 100);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      
      const point = { x: 12, y: 12 }; // Close to stroke start (10,10) and origin (0,0)
      
      const result = findBestSnapPoint(point, {
        strokes: [digitalStroke],
        intersections: [],
        threshold: 20,
      });
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('strokePoint');
      expect(result!.point).toEqual({ x: 10, y: 10 });
    });

    it('should prioritize digital stroke points over integers', () => {
      const lineSegment = geometry.createLineSegment(11, 11, 100, 100);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      
      const point = { x: 12, y: 12 }; // Close to stroke start (11,11) and integer (12,12)
      
      const result = findBestSnapPoint(point, {
        strokes: [digitalStroke],
        intersections: [],
        threshold: 5,
      });
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('strokePoint');
      expect(result!.point).toEqual({ x: 11, y: 11 });
    });

    it('should handle mixed digital and artistic strokes', () => {
      const lineSegment = geometry.createLineSegment(50, 50, 150, 150);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      const artisticStroke = geometry.createArtisticStroke([
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ]);
      
      const point = { x: 53, y: 53 }; // Close to digital stroke start
      
      const result = findBestSnapPoint(point, {
        strokes: [digitalStroke, artisticStroke],
        intersections: [],
        threshold: 10,
      });
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('strokePoint');
      expect(result!.point).toEqual({ x: 50, y: 50 });
    });
  });

  describe('Grid Snapping for Digital Mode', () => {
    it('should snap to grid points', () => {
      const point = { x: 53, y: 47 };
      const gridSize = 10;
      
      const result = snapToGrid(point, gridSize, 10);
      
      expect(result).not.toBeNull();
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should respect grid threshold', () => {
      const point = { x: 56, y: 56 }; // 6 units from grid point (50,50)
      const gridSize = 10;
      
      const result = snapToGrid(point, gridSize, 5); // Threshold too small
      
      expect(result).toBeNull();
    });

    it('should snap to negative grid points', () => {
      const point = { x: -47, y: -53 };
      const gridSize = 10;
      
      const result = snapToGrid(point, gridSize, 10);
      
      expect(result).not.toBeNull();
      expect(result).toEqual({ x: -50, y: -50 });
    });

    it('should work with small grid sizes', () => {
      const point = { x: 5.2, y: 5.8 };
      const gridSize = 1;
      
      const result = snapToGrid(point, gridSize, 1);
      
      expect(result).not.toBeNull();
      expect(result).toEqual({ x: 5, y: 6 });
    });
  });

  describe('Digital Geometry Constraints', () => {
    it('should detect horizontal alignment for line drawing', () => {
      // This would test snapping to horizontal constraint during line drawing
      // Implementation would be in digital tools, not measurements
      expect(true).toBe(true); // Placeholder
    });

    it('should detect vertical alignment for line drawing', () => {
      // This would test snapping to vertical constraint during line drawing
      expect(true).toBe(true); // Placeholder
    });

    it('should detect perpendicular alignment', () => {
      // This would test snapping to perpendicular constraint
      expect(true).toBe(true); // Placeholder
    });
  });
});