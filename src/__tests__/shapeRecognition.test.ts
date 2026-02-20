import { describe, it, expect } from 'vitest';
import type { Point } from '../types';
import { predictShape, predictShapeWithDetails } from '../shapeRecognition';

describe('Shape Recognition Tests', () => {
  describe('predictShape - Lines', () => {
    it('should detect a perfect horizontal line', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        points.push({ x: i * 5, y: 50 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0]).toEqual({ x: 0, y: 50 });
      expect(result![1]).toEqual({ x: 50, y: 50 });
    });

    it('should detect a perfect vertical line', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        points.push({ x: 25, y: i * 5 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0]).toEqual({ x: 25, y: 0 });
      expect(result![1]).toEqual({ x: 25, y: 50 });
    });

    it('should detect a diagonal line', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        points.push({ x: i * 5, y: i * 3 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });
  });

  describe('predictShape - Polylines', () => {
    it('should detect a simple L-shape', () => {
      const points: Point[] = [];
      // Horizontal segment
      for (let i = 0; i <= 10; i++) {
        points.push({ x: i * 3, y: 25 });
      }
      // Vertical segment  
      for (let i = 1; i <= 10; i++) {
        points.push({ x: 30, y: 25 + i * 3 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect a Z-shape', () => {
      const points: Point[] = [];
      // First horizontal segment
      for (let i = 0; i <= 8; i++) {
        points.push({ x: 10 + i * 3, y: 20 });
      }
      // Diagonal segment
      for (let i = 1; i <= 8; i++) {
        points.push({ x: 34 - i * 2, y: 20 + i * 2 });
      }
      // Second horizontal segment
      for (let i = 1; i <= 8; i++) {
        points.push({ x: 18 + i * 3, y: 36 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('predictShape - Closed Shapes', () => {
    it('should detect a closed square as rectangle', () => {
      const points: Point[] = [];
      const size = 30;
      const startX = 10, startY = 10;
      
      // Top edge
      for (let i = 0; i <= 10; i++) {
        points.push({ x: startX + i * size / 10, y: startY });
      }
      // Right edge
      for (let i = 1; i <= 10; i++) {
        points.push({ x: startX + size, y: startY + i * size / 10 });
      }
      // Bottom edge
      for (let i = 1; i <= 10; i++) {
        points.push({ x: startX + size - i * size / 10, y: startY + size });
      }
      // Left edge (back to start)
      for (let i = 1; i < 10; i++) {
        points.push({ x: startX, y: startY + size - i * size / 10 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
    });

    it('should detect a closed triangle', () => {
      const points: Point[] = [];
      const size = 30;
      const startX = 25, startY = 5;
      
      // First edge
      for (let i = 0; i <= 10; i++) {
        points.push({ x: startX, y: startY + i * size / 10 });
      }
      // Second edge
      for (let i = 1; i <= 10; i++) {
        points.push({ x: startX + size - i * size / 10, y: startY + size - i * size / 20 });
      }
      // Third edge (back to start)
      for (let i = 1; i <= 10; i++) {
        points.push({ x: startX - size + i * size / 10, y: startY + i * size / 10 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
    });
  });

  describe('predictShapeWithDetails', () => {
    it('should return shape type and confidence', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        points.push({ x: i * 5, y: 50 });
      }
      
      const result = predictShapeWithDetails(points);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('line');
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it('should return null for insufficient points', () => {
      const points: Point[] = [{ x: 0, y: 0 }];
      
      const result = predictShapeWithDetails(points);
      expect(result).toBeNull();
    });
  });

  describe('predictShape', () => {
    it('should return null for empty input', () => {
      const result = predictShape([]);
      expect(result).toBeNull();
    });

    it('should return null for single point', () => {
      const result = predictShape([{ x: 0, y: 0 }]);
      expect(result).toBeNull();
    });
  });
});
