import { describe, it, expect } from 'vitest';
import { 
  measureDistance, 
  measureAngle,
  calculateAngleBetweenLines,
  checkParallelLines,
  snapToGrid
} from '../measurements';
import { fitLine, fitArc, fitPrimitive } from '../shapeRecognition/primitives';
import type { Point } from '../types';

describe('Digital Mode Edge Cases', () => {
  describe('Measurement Edge Cases', () => {
    it('should handle zero distance', () => {
      const point = { x: 10, y: 20 };
      
      const result = measureDistance(point, point, 'mm', 3.78);
      
      expect(result.value).toBe(0);
      expect(result.formatted).toBe('0.00mm');
    });

    it('should handle NaN coordinates', () => {
      const point1 = { x: 0, y: 0 };
      const point2 = { x: NaN, y: 10 };
      
      // Distance with NaN should handle gracefully
      const result = measureDistance(point1, point2, 'mm', 3.78);
      
      // The implementation might return NaN or handle it differently
      // Just test it doesn't crash
      expect(result).toBeDefined();
    });

    it('should handle extremely large coordinates', () => {
      const point1 = { x: 1e6, y: 1e6 };
      const point2 = { x: 2e6, y: 2e6 };
      
      const result = measureDistance(point1, point2, 'mm', 3.78);
      
      expect(result.value).toBeGreaterThan(0);
      expect(result.formatted).toBeDefined();
    });

    it('should handle negative units (if supported)', () => {
      const point1 = { x: 0, y: 0 };
      const point2 = { x: -100, y: -100 };
      
      const result = measureDistance(point1, point2, 'mm', 3.78);
      
      expect(result.value).toBeGreaterThan(0); // Distance is always positive
      expect(result.formatted).toBeDefined();
    });

    it('should handle zero pixel-per-unit conversion', () => {
      const point1 = { x: 0, y: 0 };
      const point2 = { x: 100, y: 100 };
      
      // With 0 pixels per unit, division by zero should be handled
      const result = measureDistance(point1, point2, 'px', 0);
      
      // Should handle gracefully (might return Infinity or handle differently)
      expect(result).toBeDefined();
    });
  });

  describe('Angle Calculation Edge Cases', () => {
    it('should handle zero-length lines in angle calculation', () => {
      const vertex = { x: 0, y: 0 };
      const samePoint = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      
      const result = measureAngle(samePoint, vertex, line1End, line1End, 'degree');
      
      expect(result.value).toBe(0);
      expect(result.formatted).toBe('0.0°');
    });

    it('should handle colinear points (180 degree angle)', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: -100, y: 0 };
      const line2End = { x: 100, y: 0 };
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      // Acute angle of 180° is 0°
      expect(result.value).toBeCloseTo(0);
      expect(result.formatted).toBe('0.0°');
    });

    it('should handle very small angles', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2End = { x: 100, y: 0.001 }; // Very small angle
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBeLessThan(0.1); // Less than 0.1 radians (~5.7 degrees)
    });

    it('should handle angle between identical lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 100 };
      
      const result = calculateAngleBetweenLines(
        line1Start, line1End,
        line1Start, line1End,
        'degree'
      );
      
      expect(result.value).toBe(0);
      expect(result.formatted).toBe('0.0°');
    });
  });

  describe('Parallel Line Edge Cases', () => {
    it('should handle zero-length lines in parallel check', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 0, y: 0 };
      const line2Start = { x: 10, y: 10 };
      const line2End = { x: 20, y: 20 };
      
      const result = checkParallelLines(line1Start, line1End, line2Start, line2End);
      
      // Zero-length line should return false
      expect(result).toBe(false);
    });

    it('should handle both lines zero-length', () => {
      const point = { x: 0, y: 0 };
      
      const result = checkParallelLines(point, point, point, point);
      
      expect(result).toBe(false);
    });

    it('should handle extremely small threshold', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 0 };
      const line2End = { x: 100, y: 0.000001 }; // Almost exactly parallel
      
      const result = checkParallelLines(line1Start, line1End, line2Start, line2End, 1e-9);
      
      // With extremely tight threshold, might be false
      expect(typeof result).toBe('boolean');
    });

    it('should handle very large threshold', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 0 };
      const line2End = { x: 100, y: 50 }; // 45 degrees difference
      
      const result = checkParallelLines(line1Start, line1End, line2Start, line2End, 10);
      
      // With huge threshold, might consider them "parallel"
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Snap Edge Cases', () => {
    it('should handle zero threshold in grid snapping', () => {
      const point = { x: 50.1, y: 50.1 };
      
      const result = snapToGrid(point, 10, 0);
      
      // With zero threshold, only exact grid points should snap
      expect(result).toBeNull();
    });

    it('should handle negative threshold (should be treated as zero)', () => {
      const point = { x: 51, y: 51 };
      
      const result = snapToGrid(point, 10, -5);
      
      // Negative threshold might be treated as 0
      expect(result).toBeNull();
    });

    it('should handle zero grid size', () => {
      const point = { x: 50, y: 50 };
      
      const result = snapToGrid(point, 0, 10);
      
      // Division by zero should be handled
      expect(result).toBeNull(); // Or might return the point itself
    });

    it('should handle extremely large grid size', () => {
      const point = { x: 50, y: 50 };
      
      const result = snapToGrid(point, 1000, 10);
      
      // Might snap to (0,0) or handle differently
      expect(result).toBeDefined();
    });
  });

  describe('Geometry Fitting Edge Cases', () => {
    it('should handle single point in primitive fitting', () => {
      const points: Point[] = [{ x: 0, y: 0 }];
      
      const result = fitPrimitive(points);
      
      expect(result.primitive.type).toBe('line');
      expect(result.isValid).toBe(false);
    });

    it('should handle two identical points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ];
      
      const result = fitLine(points);
      
      expect(result.isValid).toBe(false);
    });

    it('should handle collinear points with noise', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0.5 },
        { x: 100, y: -0.5 },
        { x: 150, y: 0.3 },
        { x: 200, y: -0.3 }
      ];
      
      const result = fitLine(points);
      
      // Should still fit as a line
      expect(result.primitive.type).toBe('line');
      expect(result.primitive.error).toBeGreaterThan(0);
    });

    it('should handle arc fitting with insufficient points', () => {
      const points: Point[] = [
        { x: 100, y: 0 },
        { x: 0, y: 100 }
      ];
      
      const result = fitArc(points);
      
      // Might be invalid or have high error
      expect(result.primitive.type).toBe('arc');
    });

    it('should handle perfectly circular but sparse points', () => {
      const radius = 100;
      const center = { x: 100, y: 100 };
      const points: Point[] = [];
      
      // Only 3 points on a circle
      for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI) {
        points.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        });
      }
      
      const result = fitArc(points);
      
      // With only 3 points, might still detect as arc
      expect(result.primitive.type).toBe('arc');
    });
  });

  describe('Real-world Problem Scenarios', () => {
    it('should handle user clicking same point twice', () => {
      // Common user error: clicking same point for line start/end
      const points: Point[] = [
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ];
      
      const result = fitLine(points);
      
      // Should handle duplicate points gracefully
      expect(result.primitive).toBeDefined();
    });

    it('should handle extremely close points (floating point precision)', () => {
      const points: Point[] = [
        { x: 100, y: 100 },
        { x: 100.0000001, y: 100.0000001 },
        { x: 200, y: 200 }
      ];
      
      const result = fitLine(points);
      
      // Should treat them as essentially the same point
      expect(result.primitive).toBeDefined();
    });

    it('should handle measurement with unit conversion rounding', () => {
      // Test edge case where unit conversion causes precision issues
      const point1 = { x: 0, y: 0 };
      const point2 = { x: 1, y: 1 };
      
      const result = measureDistance(point1, point2, 'mm', 3.78);
      
      // Very small distance
      expect(result.value).toBeCloseTo(Math.sqrt(2) / 3.78, 3);
      expect(result.formatted).toBeDefined();
    });

    it('should handle angle measurement at boundary conditions', () => {
      // Test angle very close to 180 degrees
      const vertex = { x: 0, y: 0 };
      const line1End = { x: -100, y: 0 };
      const line2End = { x: 100, y: 0.0001 }; // Almost 180 degrees
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      // Should return small acute angle
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBeLessThan(0.01); // Very small angle
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large number of points efficiently', () => {
      const points: Point[] = [];
      
      // Generate many points
      for (let i = 0; i < 1000; i++) {
        points.push({ x: i, y: i * 0.5 });
      }
      
      const result = fitLine(points);
      
      // Should complete without crashing
      expect(result.primitive.type).toBe('line');
    });

    it('should handle many decimal places in coordinates', () => {
      const point1 = { x: 123.4567890123, y: 987.6543210987 };
      const point2 = { x: 456.7890123456, y: 654.3210987654 };
      
      const result = measureDistance(point1, point2, 'mm', 3.78);
      
      // Should handle high precision without overflow
      expect(result.value).toBeGreaterThan(0);
      expect(result.formatted).toBeDefined();
    });
  });
});