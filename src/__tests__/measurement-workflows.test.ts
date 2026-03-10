// Measurement workflow tests
import { describe, it, expect } from 'vitest';
import {
  measureDistance,
  measureAngle,
  measureRadius,
  calculateAngleBetweenLines,
  checkParallelLines,
} from '../measurements';

describe('Measurement Workflows', () => {
  describe('Distance Measurement', () => {
    it('should measure horizontal distance in mm', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 378, y: 0 };
      
      const result = measureDistance(start, end, 'mm', 3.78);
      
      expect(result.value).toBe(100);
      expect(result.formatted).toBe('100mm');
    });

    it('should measure vertical distance in cm', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 0, y: 378 };
      
      const result = measureDistance(start, end, 'cm', 37.8);
      
      expect(result.value).toBe(10);
      expect(result.formatted).toBe('10cm');
    });

    it('should measure diagonal distance in inch', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 96, y: 96 };
      
      const result = measureDistance(start, end, 'inch', 96);
      
      expect(result.value).toBeCloseTo(1.414); // √2 inches
      expect(result.formatted).toBe('1.4inch');
    });

    it('should measure distance in pixels', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };
      
      const result = measureDistance(start, end, 'px', 1);
      
      expect(result.value).toBeCloseTo(141.42); // √(100² + 100²)
      expect(result.formatted).toBe('141px');
    });

    it('should handle negative coordinates', () => {
      const start = { x: -50, y: -50 };
      const end = { x: 50, y: 50 };
      
      const result = measureDistance(start, end, 'mm', 3.78);
      
      expect(result.value).toBeCloseTo(141.42 / 3.78);
    });
  });

  describe('Angle Measurement', () => {
    it('should measure 90 degree angle', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: 0, y: 100 };
      const line2End = { x: 100, y: 0 };
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(Math.PI / 2); // 90° in radians
      expect(result.formatted).toBe('90.0°');
    });

    it('should measure 45 degree angle', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: 0, y: 100 };
      const line2End = { x: 100, y: 100 };
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(Math.PI / 4); // 45° in radians
      expect(result.formatted).toBe('45.0°');
    });

    it('should measure 180 degree angle and return acute angle (0)', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2End = { x: -100, y: 0 };
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(0); // Acute angle of 180° is 0°
      expect(result.formatted).toBe('0.0°');
    });

    it('should measure angle in radians', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: 0, y: 100 };
      const line2End = { x: 100, y: 0 };
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'radian');
      
      expect(result.value).toBeCloseTo(Math.PI / 2);
      expect(result.formatted).toBe('1.57rad');
    });

    it('should handle obtuse angles and return acute version', () => {
      const vertex = { x: 0, y: 0 };
      const line1End = { x: 0, y: 100 };
      const line2End = { x: -100, y: 100 };
      
      const result = measureAngle({ x: -50, y: 0 }, vertex, line1End, line2End, 'degree');
      
      // 135° angle -> acute angle is 45°
      expect(result.value).toBeCloseTo(Math.PI / 4);
      expect(result.formatted).toBe('45.0°');
    });
  });

  describe('Radius Measurement', () => {
    it('should measure radius of circle in mm', () => {
      const center = { x: 100, y: 100 };
      const edgePoint = { x: 378 + 100, y: 100 };
      
      const result = measureRadius(center, edgePoint, 'mm', 3.78);
      
      expect(result.value).toBe(100);
      expect(result.formatted).toBe('100mm');
    });

    it('should measure radius of circle in cm', () => {
      const center = { x: 100, y: 100 };
      const edgePoint = { x: 378 + 100, y: 100 };
      
      const result = measureRadius(center, edgePoint, 'cm', 37.8);
      
      expect(result.value).toBe(10);
      expect(result.formatted).toBe('10cm');
    });

    it('should measure radius at diagonal position', () => {
      const center = { x: 100, y: 100 };
      const edgePoint = { x: 100 + 96, y: 100 + 96 };
      
      const result = measureRadius(center, edgePoint, 'inch', 96);
      
      expect(result.value).toBeCloseTo(1.414); // √2 inches
      expect(result.formatted).toBe('1.4inch');
    });

    it('should handle negative coordinates', () => {
      const center = { x: -50, y: -50 };
      const edgePoint = { x: 50, y: 50 };
      
      const result = measureRadius(center, edgePoint, 'mm', 3.78);
      
      expect(result.value).toBeCloseTo(141.42 / 3.78);
    });
  });

  describe('Angle Between Lines', () => {
    it('should calculate angle between intersecting lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 0 };
      const line2End = { x: 0, y: 100 };
      
      const result = calculateAngleBetweenLines(line1Start, line1End, line2Start, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(Math.PI / 2); // 90°
      expect(result.formatted).toBe('90.0°');
    });

    it('should calculate acute angle for obtuse intersection', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 0 };
      const line2End = { x: -100, y: 100 };
      
      const result = calculateAngleBetweenLines(line1Start, line1End, line2Start, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(Math.PI / 4); // Acute angle of 135° is 45°
      expect(result.formatted).toBe('45.0°');
    });

    it('should calculate angle for parallel lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 50 };
      const line2End = { x: 100, y: 50 };
      
      const result = calculateAngleBetweenLines(line1Start, line1End, line2Start, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(0); // 0°
      expect(result.formatted).toBe('0.0°');
    });

    it('should calculate angle for perpendicular lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 50, y: 0 };
      const line2End = { x: 50, y: 100 };
      
      const result = calculateAngleBetweenLines(line1Start, line1End, line2Start, line2End, 'degree');
      
      expect(result.value).toBeCloseTo(Math.PI / 2); // 90°
      expect(result.formatted).toBe('90.0°');
    });
  });

  describe('Parallel Line Detection', () => {
    it('should detect parallel lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 50 };
      const line2End = { x: 100, y: 50 };
      
      const isParallel = checkParallelLines(line1Start, line1End, line2Start, line2End);
      
      expect(isParallel).toBe(true);
    });

    it('should detect non-parallel lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 0 };
      const line2End = { x: 50, y: 50 };
      
      const isParallel = checkParallelLines(line1Start, line1End, line2Start, line2End);
      
      expect(isParallel).toBe(false);
    });

    it('should detect perpendicular lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 50, y: 0 };
      const line2End = { x: 50, y: 100 };
      
      const isParallel = checkParallelLines(line1Start, line1End, line2Start, line2End);
      
      expect(isParallel).toBe(false);
    });

    it('should handle zero-length lines', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 0, y: 0 };
      const line2Start = { x: 100, y: 100 };
      const line2End = { x: 100, y: 100 };
      
      const isParallel = checkParallelLines(line1Start, line1End, line2Start, line2End);
      
      expect(isParallel).toBe(false);
    });

    it('should respect threshold parameter', () => {
      const line1Start = { x: 0, y: 0 };
      const line1End = { x: 100, y: 0 };
      const line2Start = { x: 0, y: 0 };
      const line2End = { x: 100, y: 2 }; // 2 units off over 100 = ~1.15 degrees
      
      // With default threshold (0.01) should be false (~1.15 degrees)
      const withDefault = checkParallelLines(line1Start, line1End, line2Start, line2End);
      expect(withDefault).toBe(false);
      
      // With looser threshold should be true
      const withLoose = checkParallelLines(line1Start, line1End, line2Start, line2End, 0.02);
      expect(withLoose).toBe(true);
    });
  });

  describe('Measurement Integration', () => {
    it('should maintain consistency between distance measurements', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 378, y: 0 };
      
      const distanceMM = measureDistance(start, end, 'mm', 3.78);
      const distanceCM = measureDistance(start, end, 'cm', 37.8);
      
      expect(distanceMM.value).toBe(100);
      expect(distanceCM.value).toBe(10);
      expect(distanceMM.formatted).toBe('100mm');
      expect(distanceCM.formatted).toBe('10cm');
    });

    it('should handle edge cases gracefully', () => {
      // Same point distance
      const start = { x: 100, y: 100 };
      const distanceResult = measureDistance(start, start, 'mm', 3.78);
      expect(distanceResult.value).toBe(0);
      expect(distanceResult.formatted).toBe('0.00mm');

      // Zero length lines for angle
      const vertex = { x: 0, y: 0 };
      const samePoint = { x: 0, y: 0 };
      const angleResult = measureAngle(vertex, vertex, samePoint, samePoint, 'degree');
      expect(angleResult.value).toBe(0);
      expect(angleResult.formatted).toBe('0.0°');
    });

    it('should work with real-world scenarios', () => {
      // Scenario: Measure a right triangle
      const triangleStart = { x: 0, y: 0 };
      const triangleRight = { x: 300, y: 0 };
      const triangleTop = { x: 0, y: 400 };

      // Measure horizontal leg
      const horizontal = measureDistance(triangleStart, triangleRight, 'mm', 3.78);
      expect(horizontal.value).toBeCloseTo(300 / 3.78);

      // Measure vertical leg
      const vertical = measureDistance(triangleStart, triangleTop, 'mm', 3.78);
      expect(vertical.value).toBeCloseTo(400 / 3.78);

      // Measure diagonal (hypotenuse)
      const diagonal = measureDistance(triangleRight, triangleTop, 'mm', 3.78);
      expect(diagonal.value).toBeCloseTo(500 / 3.78); // 3-4-5 triangle

      // Measure angle at origin (right angle between vertical and horizontal)
      // measureAngle(unused, vertex, line1End, line2End)
      const angle = measureAngle(triangleStart, triangleStart, triangleRight, triangleTop, 'degree');
      expect(angle.value).toBeCloseTo(Math.PI / 2); // Right angle
      expect(angle.formatted).toBe('90.0°');
    });
  });
});