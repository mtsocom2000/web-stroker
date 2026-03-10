// Unit system tests - Pure functions without React hooks
import { describe, it, expect } from 'vitest';
import {
  pixelsToUnit,
  unitToPixels,
  formatLength,
  formatArea,
  formatAngle,
  getAcuteAngle,
  distance,
  angleBetween,
} from '../measurements';
import type { LengthUnit } from '../types';

describe('Unit System - Pure Functions', () => {
  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(distance(p1, p2)).toBe(5); // 3-4-5 triangle
    });

    it('should calculate distance with negative coordinates', () => {
      const p1 = { x: -2, y: -3 };
      const p2 = { x: 1, y: 1 };
      expect(distance(p1, p2)).toBeCloseTo(5, 5);
    });

    it('should return 0 for same point', () => {
      const p1 = { x: 5, y: 5 };
      const p2 = { x: 5, y: 5 };
      expect(distance(p1, p2)).toBe(0);
    });

    it('should calculate horizontal distance', () => {
      const p1 = { x: 0, y: 10 };
      const p2 = { x: 10, y: 10 };
      expect(distance(p1, p2)).toBe(10);
    });

    it('should calculate vertical distance', () => {
      const p1 = { x: 10, y: 0 };
      const p2 = { x: 10, y: 10 };
      expect(distance(p1, p2)).toBe(10);
    });
  });

  describe('angleBetween', () => {
    it('should calculate right angle', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 1, y: 1 };
      expect(angleBetween(p1, p2, p3)).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should calculate 135 degree angle', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 2, y: 1 };
      // v1 = (-1, 0), v2 = (1, 1), angle = 135 degrees = 3π/4
      expect(angleBetween(p1, p2, p3)).toBeCloseTo((3 * Math.PI) / 4, 5);
    });

    it('should calculate 180 degree angle (straight line)', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 2, y: 0 };
      expect(angleBetween(p1, p2, p3)).toBeCloseTo(Math.PI, 5);
    });

    it('should handle zero-length vectors', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 0, y: 0 };
      const p3 = { x: 1, y: 0 };
      expect(angleBetween(p1, p2, p3)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const p1 = { x: -1, y: -1 };
      const p2 = { x: 0, y: 0 };
      const p3 = { x: 1, y: -1 };
      expect(angleBetween(p1, p2, p3)).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('getAcuteAngle', () => {
    it('should return acute angle unchanged', () => {
      expect(getAcuteAngle(Math.PI / 4)).toBe(Math.PI / 4);
      expect(getAcuteAngle(Math.PI / 3)).toBe(Math.PI / 3);
      expect(getAcuteAngle(Math.PI / 6)).toBe(Math.PI / 6);
    });

    it('should convert obtuse angle to acute', () => {
      expect(getAcuteAngle((3 * Math.PI) / 4)).toBeCloseTo(Math.PI / 4, 10);
      expect(getAcuteAngle((2 * Math.PI) / 3)).toBeCloseTo(Math.PI / 3, 10);
      expect(getAcuteAngle((5 * Math.PI) / 6)).toBeCloseTo(Math.PI / 6, 10);
    });

    it('should handle exactly 90 degrees', () => {
      expect(getAcuteAngle(Math.PI / 2)).toBe(Math.PI / 2);
    });

    it('should handle exactly 180 degrees', () => {
      expect(getAcuteAngle(Math.PI)).toBe(0);
    });
  });

  describe('pixelsToUnit', () => {
    const testCases: Array<{
      pixels: number;
      unit: LengthUnit;
      pixelsPerUnit: number;
      expected: number;
    }> = [
      { pixels: 378, unit: 'mm', pixelsPerUnit: 3.78, expected: 100 },
      { pixels: 3780, unit: 'mm', pixelsPerUnit: 3.78, expected: 1000 },
      { pixels: 378, unit: 'cm', pixelsPerUnit: 37.8, expected: 10 },
      { pixels: 960, unit: 'inch', pixelsPerUnit: 96, expected: 10 },
      { pixels: 100, unit: 'px', pixelsPerUnit: 1, expected: 100 },
      { pixels: 0, unit: 'mm', pixelsPerUnit: 3.78, expected: 0 },
    ];

    testCases.forEach(({ pixels, unit, pixelsPerUnit, expected }) => {
      it(`should convert ${pixels}px to ${expected}${unit} with ${pixelsPerUnit}px/${unit}`, () => {
        const result = pixelsToUnit(pixels, unit, pixelsPerUnit);
        expect(result).toBeCloseTo(expected, 5);
      });
    });

    it('should use provided pixelsPerUnit', () => {
      // Test with specific pixelsPerUnit values
      expect(pixelsToUnit(378, 'mm', 3.78)).toBeCloseTo(100, 5);
      expect(pixelsToUnit(3780, 'mm', 3.78)).toBeCloseTo(1000, 5);
      expect(pixelsToUnit(378, 'cm', 37.8)).toBeCloseTo(10, 5);
      expect(pixelsToUnit(960, 'inch', 96)).toBeCloseTo(10, 5);
      expect(pixelsToUnit(100, 'px', 1)).toBeCloseTo(100, 5);
    });
  });

  describe('unitToPixels', () => {
    const testCases: Array<{
      units: number;
      pixelsPerUnit: number;
      expected: number;
    }> = [
      { units: 100, pixelsPerUnit: 3.78, expected: 378 },
      { units: 1000, pixelsPerUnit: 3.78, expected: 3780 },
      { units: 10, pixelsPerUnit: 37.8, expected: 378 },
      { units: 10, pixelsPerUnit: 96, expected: 960 },
      { units: 100, pixelsPerUnit: 1, expected: 100 },
      { units: 0, pixelsPerUnit: 3.78, expected: 0 },
    ];

    testCases.forEach(({ units, pixelsPerUnit, expected }) => {
      it(`should convert ${units} units to ${expected}px with ${pixelsPerUnit}px/unit`, () => {
        const result = unitToPixels(units, pixelsPerUnit);
        expect(result).toBeCloseTo(expected, 5);
      });
    });

    it('should handle fractional values', () => {
      expect(unitToPixels(0.5, 3.78)).toBeCloseTo(1.89, 5);
      expect(unitToPixels(1.5, 37.8)).toBeCloseTo(56.7, 5);
      expect(unitToPixels(2.25, 96)).toBeCloseTo(216, 5);
    });
  });

  describe('formatLength', () => {
    it('should format length without unit', () => {
      expect(formatLength(0.123)).toBe('0.12');
      expect(formatLength(1.234)).toBe('1.2');
      expect(formatLength(5.678)).toBe('5.7');
      expect(formatLength(12.34)).toBe('12');
      expect(formatLength(123.45)).toBe('123');
    });

    it('should format length in mm', () => {
      expect(formatLength(0.123, 'mm')).toBe('0.12mm');
      expect(formatLength(1.234, 'mm')).toBe('1.2mm');
      expect(formatLength(5.678, 'mm')).toBe('5.7mm');
      expect(formatLength(12.34, 'mm')).toBe('12mm');
      expect(formatLength(123.45, 'mm')).toBe('123mm');
    });

    it('should format length in cm', () => {
      expect(formatLength(0.123, 'cm')).toBe('0.12cm');
      expect(formatLength(1.234, 'cm')).toBe('1.2cm');
      expect(formatLength(5.678, 'cm')).toBe('5.7cm');
      expect(formatLength(12.34, 'cm')).toBe('12cm');
      expect(formatLength(123.45, 'cm')).toBe('123cm');
    });

    it('should format length in inch', () => {
      expect(formatLength(0.123, 'inch')).toBe('0.12inch');
      expect(formatLength(1.234, 'inch')).toBe('1.2inch');
      expect(formatLength(5.678, 'inch')).toBe('5.7inch');
      expect(formatLength(12.34, 'inch')).toBe('12inch');
      expect(formatLength(123.45, 'inch')).toBe('123inch');
    });

    it('should format length in px', () => {
      expect(formatLength(0.123, 'px')).toBe('0px');
      expect(formatLength(1.234, 'px')).toBe('1px');
      expect(formatLength(5.678, 'px')).toBe('6px');
      expect(formatLength(12.34, 'px')).toBe('12px');
      expect(formatLength(123.45, 'px')).toBe('123px');
    });

    it('should handle edge cases', () => {
      expect(formatLength(0, 'mm')).toBe('0.00mm');
      expect(formatLength(0.001, 'mm')).toBe('0.00mm');
      expect(formatLength(999.999, 'mm')).toBe('1000mm');
      expect(formatLength(-5.5, 'mm')).toBe('-5.50mm'); // Less than 10, shows 1 decimal
    });
  });

  describe('formatArea', () => {
    it('should format area without unit', () => {
      expect(formatArea(0.123)).toBe('0.12');
      expect(formatArea(1.234)).toBe('1.2');
      expect(formatArea(5.678)).toBe('5.7');
      expect(formatArea(12.34)).toBe('12');
      expect(formatArea(123.45)).toBe('123');
    });

    it('should format area in mm²', () => {
      expect(formatArea(0.123, 'mm')).toBe('0.12mm²');
      expect(formatArea(1.234, 'mm')).toBe('1.2mm²');
      expect(formatArea(5.678, 'mm')).toBe('5.7mm²');
      expect(formatArea(12.34, 'mm')).toBe('12mm²');
      expect(formatArea(123.45, 'mm')).toBe('123mm²');
    });

    it('should format area in cm²', () => {
      expect(formatArea(0.123, 'cm')).toBe('0.12cm²');
      expect(formatArea(1.234, 'cm')).toBe('1.2cm²');
      expect(formatArea(5.678, 'cm')).toBe('5.7cm²');
      expect(formatArea(12.34, 'cm')).toBe('12cm²');
      expect(formatArea(123.45, 'cm')).toBe('123cm²');
    });

    it('should format area in inch²', () => {
      expect(formatArea(0.123, 'inch')).toBe('0.12inch²');
      expect(formatArea(1.234, 'inch')).toBe('1.2inch²');
      expect(formatArea(5.678, 'inch')).toBe('5.7inch²');
      expect(formatArea(12.34, 'inch')).toBe('12inch²');
      expect(formatArea(123.45, 'inch')).toBe('123inch²');
    });

    it('should format area in px²', () => {
      expect(formatArea(0.123, 'px')).toBe('0.12px²');
      expect(formatArea(1.234, 'px')).toBe('1.2px²');
      expect(formatArea(5.678, 'px')).toBe('5.7px²');
      expect(formatArea(12.34, 'px')).toBe('12px²');
      expect(formatArea(123.45, 'px')).toBe('123px²');
    });

    it('should handle edge cases', () => {
      expect(formatArea(0, 'mm')).toBe('0.00mm²');
      expect(formatArea(0.001, 'mm')).toBe('0.00mm²');
      expect(formatArea(999.999, 'mm')).toBe('1000mm²');
      expect(formatArea(-5.5, 'mm')).toBe('-5.50mm²'); // Less than 10, shows 1 decimal
    });
  });

  describe('formatAngle', () => {
    it('should format angle in radians', () => {
      expect(formatAngle(0, 'radian')).toBe('0.00rad');
      expect(formatAngle(Math.PI / 2, 'radian')).toBe('1.57rad');
      expect(formatAngle(Math.PI, 'radian')).toBe('3.14rad');
      expect(formatAngle(2 * Math.PI, 'radian')).toBe('6.28rad');
      expect(formatAngle(0.123, 'radian')).toBe('0.12rad');
    });

    it('should format angle in degrees', () => {
      expect(formatAngle(0, 'degree')).toBe('0.0°');
      expect(formatAngle(Math.PI / 2, 'degree')).toBe('90.0°');
      expect(formatAngle(Math.PI, 'degree')).toBe('180.0°');
      expect(formatAngle(2 * Math.PI, 'degree')).toBe('360.0°');
      expect(formatAngle(Math.PI / 4, 'degree')).toBe('45.0°');
    });

    it('should handle negative angles', () => {
      expect(formatAngle(-Math.PI / 2, 'degree')).toBe('-90.0°');
      expect(formatAngle(-Math.PI, 'degree')).toBe('-180.0°');
      expect(formatAngle(-0.123, 'radian')).toBe('-0.12rad');
    });

    it('should handle very small angles', () => {
      expect(formatAngle(0.001, 'degree')).toBe('0.1°');
      expect(formatAngle(0.0001, 'degree')).toBe('0.0°');
      expect(formatAngle(0.001, 'radian')).toBe('0.00rad');
    });

    it('should handle very large angles', () => {
      expect(formatAngle(10 * Math.PI, 'degree')).toBe('1800.0°');
      expect(formatAngle(10 * Math.PI, 'radian')).toBe('31.42rad');
    });
  });

  describe('Unit Conversion Consistency', () => {
    it('should maintain pixel-to-unit and unit-to-pixel consistency', () => {
      const testValues = [0, 1, 10, 100, 0.5, 1.5, 25.75];
      const units: LengthUnit[] = ['mm', 'cm', 'inch', 'px'];
      const pixelsPerUnitValues = [3.78, 37.8, 96, 1];

      units.forEach((unit, index) => {
        const pixelsPerUnit = pixelsPerUnitValues[index];
        
        testValues.forEach(value => {
          const pixels = unitToPixels(value, pixelsPerUnit);
          const convertedBack = pixelsToUnit(pixels, unit, pixelsPerUnit);
          expect(convertedBack).toBeCloseTo(value, 5);
        });
      });
    });

    it('should maintain angle conversion consistency', () => {
      const testRadians = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI];
      
      testRadians.forEach(radians => {
        const formattedDegrees = formatAngle(radians, 'degree');
        // Extract numeric value from formatted string (remove °)
        const degreesValue = parseFloat(formattedDegrees.replace('°', ''));
        const convertedBackRadians = (degreesValue * Math.PI) / 180;
        expect(convertedBackRadians).toBeCloseTo(radians, 1); // Allow some formatting precision loss
      });
    });

    it('should handle unit system edge cases', () => {
      // Test with extreme values
      expect(() => pixelsToUnit(Number.MAX_SAFE_INTEGER, 'mm', 3.78)).not.toThrow();
      expect(() => pixelsToUnit(Number.MIN_SAFE_INTEGER, 'mm', 3.78)).not.toThrow();
      
      // Test with zero pixels per unit (should handle gracefully)
      expect(pixelsToUnit(100, 'mm', 0)).toBe(Infinity);
      expect(unitToPixels(100, 0)).toBe(0);
      
      // Test with very small pixels per unit
      expect(pixelsToUnit(100, 'mm', 0.001)).toBe(100000);
      expect(unitToPixels(100, 0.001)).toBe(0.1);
    });
  });
});