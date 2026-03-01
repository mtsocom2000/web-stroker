import { describe, it, expect } from 'vitest';
import {
  findLineIntersection,
  isPointOnSegment,
  closestPointOnSegment,
  lineCircleIntersections,
} from '../measurements';

describe('findLineIntersection', () => {
  it('should find intersection of two crossing lines', () => {
    // Line 1: horizontal from (0, 0) to (10, 0)
    // Line 2: vertical from (5, -5) to (5, 5)
    const intersection = findLineIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: -5 },
      { x: 5, y: 5 }
    );
    expect(intersection.x).toBeCloseTo(5, 5);
    expect(intersection.y).toBeCloseTo(0, 5);
  });

  it('should find intersection of two diagonal lines', () => {
    // Line 1: from (0, 0) to (10, 10)
    // Line 2: from (0, 10) to (10, 0)
    const intersection = findLineIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 }
    );
    expect(intersection.x).toBeCloseTo(5, 5);
    expect(intersection.y).toBeCloseTo(5, 5);
  });

  it('should handle parallel lines by returning midpoint', () => {
    // Two horizontal parallel lines
    // Line 1: from (0, 0) to (10, 0)
    // Line 2: from (0, 5) to (10, 5)
    const intersection = findLineIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 }
    );
    // Should return a point between the midpoints of the two lines
    expect(intersection.x).toBeCloseTo(5, 5);
    expect(intersection.y).toBeCloseTo(2.5, 5);
  });

  it('should work with negative coordinates', () => {
    const intersection = findLineIntersection(
      { x: -10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
      { x: 10, y: -10 }
    );
    expect(intersection.x).toBeCloseTo(0, 5);
    expect(intersection.y).toBeCloseTo(0, 5);
  });
});

describe('isPointOnSegment', () => {
  it('should return true for point on segment', () => {
    // Segment from (0, 0) to (10, 0), point at (5, 0)
    const result = isPointOnSegment(
      { x: 5, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(result).toBe(true);
  });

  it('should return true for point at segment start', () => {
    const result = isPointOnSegment(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(result).toBe(true);
  });

  it('should return true for point at segment end', () => {
    const result = isPointOnSegment(
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(result).toBe(true);
  });

  it('should return false for point beyond segment end', () => {
    // Point (15, 0) is beyond the segment (0, 0) to (10, 0)
    const result = isPointOnSegment(
      { x: 15, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(result).toBe(false);
  });

  it('should return false for point before segment start', () => {
    // Point (-5, 0) is before the segment (0, 0) to (10, 0)
    const result = isPointOnSegment(
      { x: -5, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(result).toBe(false);
  });

  it('should return false for point off the line', () => {
    // Point (5, 5) is not on the horizontal line
    const result = isPointOnSegment(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(result).toBe(false);
  });

  it('should handle diagonal segments', () => {
    // Segment from (0, 0) to (10, 10), point at (5, 5)
    const result = isPointOnSegment(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 10 }
    );
    expect(result).toBe(true);
  });

  it('should handle point on degenerate segment (zero length)', () => {
    // Both start and end at (5, 5)
    const result = isPointOnSegment(
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 }
    );
    expect(result).toBe(true);
  });

  it('should return false for point off a degenerate segment', () => {
    // Segment is a point at (5, 5), but we're checking (6, 6)
    const result = isPointOnSegment(
      { x: 6, y: 6 },
      { x: 5, y: 5 },
      { x: 5, y: 5 }
    );
    expect(result).toBe(false);
  });

  it('should respect tolerance parameter', () => {
    // Point (5, 0.5) is slightly off the horizontal line
    const strictResult = isPointOnSegment(
      { x: 5, y: 0.5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      1e-10 // very tight tolerance
    );
    expect(strictResult).toBe(false);

    const looseResult = isPointOnSegment(
      { x: 5, y: 0.5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      1 // loose tolerance
    );
    expect(looseResult).toBe(true);
  });
});

describe('closestPointOnSegment', () => {
  it('should return the point itself if on segment', () => {
    const closest = closestPointOnSegment(
      { x: 5, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(closest.x).toBeCloseTo(5, 5);
    expect(closest.y).toBeCloseTo(0, 5);
  });

  it('should return segment start if point projects before it', () => {
    const closest = closestPointOnSegment(
      { x: -5, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(closest.x).toBeCloseTo(0, 5);
    expect(closest.y).toBeCloseTo(0, 5);
  });

  it('should return segment end if point projects beyond it', () => {
    const closest = closestPointOnSegment(
      { x: 15, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(closest.x).toBeCloseTo(10, 5);
    expect(closest.y).toBeCloseTo(0, 5);
  });

  it('should find perpendicular projection for off-segment point', () => {
    // Point (5, 10) projects to (5, 0) on segment (0, 0) to (10, 0)
    const closest = closestPointOnSegment(
      { x: 5, y: 10 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(closest.x).toBeCloseTo(5, 5);
    expect(closest.y).toBeCloseTo(0, 5);
  });

  it('should handle diagonal segments', () => {
    // Segment from (0, 0) to (10, 10), point at (10, 0)
    // Closest point should be somewhere on the diagonal
    const closest = closestPointOnSegment(
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 10 }
    );
    expect(closest.x).toBeCloseTo(5, 5);
    expect(closest.y).toBeCloseTo(5, 5);
  });

  it('should handle degenerate segment (zero length)', () => {
    // Segment is a point at (5, 5)
    const closest = closestPointOnSegment(
      { x: 100, y: 100 },
      { x: 5, y: 5 },
      { x: 5, y: 5 }
    );
    expect(closest.x).toBeCloseTo(5, 5);
    expect(closest.y).toBeCloseTo(5, 5);
  });

  it('should work with negative coordinates', () => {
    const closest = closestPointOnSegment(
      { x: 0, y: 0 },
      { x: -10, y: -10 },
      { x: 10, y: 10 }
    );
    expect(closest.x).toBeCloseTo(0, 5);
    expect(closest.y).toBeCloseTo(0, 5);
  });
});

describe('lineCircleIntersections', () => {
  it('should find two intersections for line through circle center', () => {
    // Circle at (0, 0) with radius 5
    // Horizontal line from (-10, 0) to (10, 0)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -10, y: 0 },
      { x: 10, y: 0 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(-5, 5);
    expect(intersections[0].y).toBeCloseTo(0, 5);
    expect(intersections[1].x).toBeCloseTo(5, 5);
    expect(intersections[1].y).toBeCloseTo(0, 5);
  });

  it('should find two intersections for vertical line through center', () => {
    // Circle at (0, 0) with radius 5
    // Vertical line from (0, -10) to (0, 10)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: 0, y: -10 },
      { x: 0, y: 10 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(0, 5);
    expect(intersections[0].y).toBeCloseTo(-5, 5);
    expect(intersections[1].x).toBeCloseTo(0, 5);
    expect(intersections[1].y).toBeCloseTo(5, 5);
  });

  it('should find two intersections for diagonal line through center', () => {
    // Circle at (0, 0) with radius 5√2
    // Diagonal line from (-10, -10) to (10, 10)
    const radius = 5 * Math.sqrt(2);
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      radius,
      { x: -10, y: -10 },
      { x: 10, y: 10 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(-5, 5);
    expect(intersections[0].y).toBeCloseTo(-5, 5);
    expect(intersections[1].x).toBeCloseTo(5, 5);
    expect(intersections[1].y).toBeCloseTo(5, 5);
  });

  it('should find two intersections for line not through center', () => {
    // Circle at (5, 5) with radius 5
    // Horizontal line from (0, 5) to (15, 5) (passes through center)
    const intersections = lineCircleIntersections(
      { x: 5, y: 5 },
      5,
      { x: 0, y: 5 },
      { x: 15, y: 5 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(0, 5);
    expect(intersections[0].y).toBeCloseTo(5, 5);
    expect(intersections[1].x).toBeCloseTo(10, 5);
    expect(intersections[1].y).toBeCloseTo(5, 5);
  });

  it('should find single intersection for tangent line', () => {
    // Circle at (0, 0) with radius 5
    // Horizontal line y = 5 (tangent from above)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -10, y: 5 },
      { x: 10, y: 5 }
    );
    expect(intersections).toHaveLength(1);
    expect(intersections[0].x).toBeCloseTo(0, 5);
    expect(intersections[0].y).toBeCloseTo(5, 5);
  });

  it('should find single intersection for tangent line from below', () => {
    // Circle at (0, 0) with radius 5
    // Horizontal line y = -5 (tangent from below)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -10, y: -5 },
      { x: 10, y: -5 }
    );
    expect(intersections).toHaveLength(1);
    expect(intersections[0].x).toBeCloseTo(0, 5);
    expect(intersections[0].y).toBeCloseTo(-5, 5);
  });

  it('should return empty array for line missing circle', () => {
    // Circle at (0, 0) with radius 5
    // Horizontal line y = 10 (far above)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -10, y: 10 },
      { x: 10, y: 10 }
    );
    expect(intersections).toHaveLength(0);
  });

  it('should return empty array for line on opposite side of circle', () => {
    // Circle at (0, 0) with radius 3
    // Horizontal line y = 5 (below the line y = 3)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      3,
      { x: -10, y: 5 },
      { x: 10, y: 5 }
    );
    expect(intersections).toHaveLength(0);
  });

  it('should handle circle center offset from origin', () => {
    // Circle at (5, 5) with radius 3
    // Vertical line x = 5 (through center)
    const intersections = lineCircleIntersections(
      { x: 5, y: 5 },
      3,
      { x: 5, y: 0 },
      { x: 5, y: 10 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(5, 5);
    expect(intersections[0].y).toBeCloseTo(2, 5);
    expect(intersections[1].x).toBeCloseTo(5, 5);
    expect(intersections[1].y).toBeCloseTo(8, 5);
  });

  it('should handle negative coordinates', () => {
    // Circle at (-5, -5) with radius 5
    // Horizontal line y = -5 (through center)
    const intersections = lineCircleIntersections(
      { x: -5, y: -5 },
      5,
      { x: -15, y: -5 },
      { x: 5, y: -5 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(-10, 5);
    expect(intersections[0].y).toBeCloseTo(-5, 5);
    expect(intersections[1].x).toBeCloseTo(0, 5);
    expect(intersections[1].y).toBeCloseTo(-5, 5);
  });

  it('should handle diagonal line with two intersections', () => {
    // Circle at (0, 0) with radius 5
    // Diagonal line from (-5, 0) to (5, 10)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -5, y: 0 },
      { x: 5, y: 10 }
    );
    expect(intersections).toHaveLength(2);
    // Verify both intersections are on the circle
    for (const point of intersections) {
      const dist = Math.sqrt(point.x * point.x + point.y * point.y);
      expect(dist).toBeCloseTo(5, 4);
    }
  });

  it('should handle line defined by two identical points (degenerate)', () => {
    // Circle at (0, 0) with radius 5
    // Line defined by point (0, 0) repeated (point at circle center)
    // Since the line is just a point at the center, there's no true line intersection
    // The function should return empty array for this edge case
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );
    // Degenerate line (zero length) at circle center returns empty since there's no direction
    expect(intersections).toHaveLength(0);
  });

  it('should handle line passing very close to circle (near tangent)', () => {
    // Circle at (0, 0) with radius 5
    // Horizontal line y = 5.0001 (just barely outside, within numerical tolerance)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -10, y: 5.00001 },
      { x: 10, y: 5.00001 }
    );
    // Should be 0 or 1 depending on numerical precision
    expect(intersections.length).toBeLessThanOrEqual(1);
  });

  it('should find intersections with offset circle and offset line', () => {
    // Circle at (3, 4) with radius 5
    // Line from (0, 0) to (6, 8) (distance formula: passes near center)
    const intersections = lineCircleIntersections(
      { x: 3, y: 4 },
      5,
      { x: -2, y: -1 },
      { x: 8, y: 9 }
    );
    expect(intersections).toHaveLength(2);
    // Verify both are on the circle
    for (const point of intersections) {
      const dx = point.x - 3;
      const dy = point.y - 4;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(5, 4);
    }
  });

  it('should return intersections in consistent order', () => {
    // Circle at (0, 0) with radius 5
    // Horizontal line (intersections should be left then right)
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      5,
      { x: -10, y: 0 },
      { x: 10, y: 0 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeLessThan(intersections[1].x);
  });

  it('should handle very small radius', () => {
    // Circle at (0, 0) with very small radius
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      0.001,
      { x: -1, y: 0 },
      { x: 1, y: 0 }
    );
    expect(intersections).toHaveLength(2);
    for (const point of intersections) {
      const dist = Math.sqrt(point.x * point.x + point.y * point.y);
      expect(dist).toBeCloseTo(0.001, 3);
    }
  });

  it('should handle very large radius', () => {
    // Circle at (0, 0) with large radius
    const intersections = lineCircleIntersections(
      { x: 0, y: 0 },
      1000,
      { x: -1500, y: 0 },
      { x: 1500, y: 0 }
    );
    expect(intersections).toHaveLength(2);
    expect(intersections[0].x).toBeCloseTo(-1000, 1);
    expect(intersections[1].x).toBeCloseTo(1000, 1);
  });
});
