import { describe, it, expect } from 'vitest';
import type { Point } from '../src/types';
import { detectStraightLine, detectPolyline, predictShape } from '../src/shapeRecognition';

describe('Shape Recognition Tests', () => {
  describe('detectStraightLine', () => {
    it('should detect a perfect horizontal line', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        points.push({ x: i * 5, y: 50 });
      }
      
      const result = detectStraightLine(points);
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
      
      const result = detectStraightLine(points);
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
      
      const result = detectStraightLine(points);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it('should reject slightly curved lines', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 20; i++) {
        const x = i * 2.5;
        const y = 25 + Math.sin(i * 0.3) * 3; // Small sine wave
        points.push({ x, y });
      }
      
      const result = detectStraightLine(points);
      expect(result).toBeNull(); // Should be rejected due to curvature
    });

    it('should reject very short segments', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }
      ];
      
      const result = detectStraightLine(points);
      expect(result).toBeNull(); // Too short to be considered a line
    });
  });

  describe('detectPolyline', () => {
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
      
      const result = detectPolyline(points);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(3); // Start, corner, end
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
      
      const result = detectPolyline(points);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(4); // Multiple corners
    });

    it('should detect a closed square', () => {
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
      
      const result = detectPolyline(points);
      expect(result).not.toBeNull();
      // Should detect corners and close the shape
    });

    it('should reject smooth curves', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 30; i++) {
        const angle = (i / 30) * Math.PI;
        points.push({
          x: 25 + Math.cos(angle) * 20,
          y: 25 + Math.sin(angle) * 15
        });
      }
      
      const result = detectPolyline(points);
      expect(result).toBeNull(); // Should not detect as polyline
    });
  });

  describe('predictShape', () => {
    it('should predict line for straight horizontal points', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        points.push({ x: i * 4, y: 30 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2); // Line should return [start, end]
    });

    it('should predict polyline for L-shaped points', () => {
      const points: Point[] = [];
      // Horizontal
      for (let i = 0; i <= 8; i++) {
        points.push({ x: i * 4, y: 30 });
      }
      // Vertical
      for (let i = 1; i <= 8; i++) {
        points.push({ x: 32, y: 30 + i * 3 });
      }
      
      const result = predictShape(points);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(2); // Should have corner points
    });

    it('should return null for insufficient points', () => {
      const points: Point[] = [{ x: 0, y: 0 }];
      
      const result = predictShape(points);
      expect(result).toBeNull();
    });

    it('should return null for empty input', () => {
      const result = predictShape([]);
      expect(result).toBeNull();
    });
  });
});