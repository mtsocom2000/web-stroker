import type { Point, Stroke } from '../types';

/**
 * Hit Testing Utilities
 *
 * This file contains all hit testing and intersection detection functions
 * extracted from DrawingCanvas.tsx
 */

/**
 * Calculate distance from point to line segment
 */
export function distanceToSegment(
  point: { x: number; y: number },
  segStart: Point,
  segEnd: Point
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-10) {
    return Math.hypot(point.x - segStart.x, point.y - segStart.y);
  }

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;

  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * Find stroke at position (for artistic strokes)
 */
export function findStrokeAtPosition(
  world: { x: number; y: number },
  strokes: Stroke[],
  zoom: number
): string | null {
  const clickThreshold = 5.0 / zoom;

  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    const points = stroke.displayPoints ?? stroke.smoothedPoints ?? stroke.points;
    if (!points || points.length < 2) continue;

    for (let j = 0; j < points.length - 1; j++) {
      const dist = distanceToSegment(world, points[j], points[j + 1]);
      if (dist <= clickThreshold) {
        return stroke.id;
      }
    }
  }

  return null;
}

/**
 * Get intersection point of two line segments
 */
export function getLineIntersection(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): Point | null {
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

/**
 * Find nearby intersections using spatial index
 */
export function findNearbyIntersections(
  world: { x: number; y: number },
  strokes: Stroke[],
  zoom: number,
  radius: number = 20
): Array<{
  point: Point;
  segments: Array<{ strokeId: string; segmentIndex: number }>;
}> {
  const searchRadius = radius / zoom;
  const results: Array<{
    point: Point;
    segments: Array<{ strokeId: string; segmentIndex: number }>;
  }> = [];

  const digitalStrokes = strokes.filter(
    s => s.strokeType === 'digital' && s.digitalSegments
  );

  // Only check segments within the search radius of mouse position
  for (const stroke of digitalStrokes) {
    if (!stroke.digitalSegments) continue;

    for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
      const segment = stroke.digitalSegments[segIdx];
      if (segment.type !== 'line' || segment.points.length < 2) continue;

      const p1 = segment.points[0];
      const p2 = segment.points[1];

      // Quick bbox check first
      const minX = Math.min(p1.x, p2.x) - searchRadius;
      const maxX = Math.max(p1.x, p2.x) + searchRadius;
      const minY = Math.min(p1.y, p2.y) - searchRadius;
      const maxY = Math.max(p1.y, p2.y) + searchRadius;

      if (world.x < minX || world.x > maxX || world.y < minY || world.y > maxY) {
        continue;
      }

      // Check if segment is near mouse position
      const distToSegment = distanceToSegment(world, p1, p2);

      if (distToSegment > searchRadius) continue;

      // Now check intersections with other nearby segments
      for (const otherStroke of digitalStrokes) {
        if (!otherStroke.digitalSegments) continue;

        for (let otherSegIdx = 0; otherSegIdx < otherStroke.digitalSegments.length; otherSegIdx++) {
          const otherSegment = otherStroke.digitalSegments[otherSegIdx];
          if (otherSegment.type !== 'line' || otherSegment.points.length < 2) continue;
          if (stroke.id === otherStroke.id && segIdx === otherSegIdx) continue;

          const p3 = otherSegment.points[0];
          const p4 = otherSegment.points[1];

          const intersection = getLineIntersection(p1, p2, p3, p4);
          if (intersection) {
            // Check if intersection is near mouse
            const distToIntersection = Math.hypot(intersection.x - world.x, intersection.y - world.y);
            if (distToIntersection <= searchRadius) {
              results.push({
                point: intersection,
                segments: [
                  { strokeId: stroke.id, segmentIndex: segIdx },
                  { strokeId: otherStroke.id, segmentIndex: otherSegIdx },
                ],
              });
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Digital element hit testing
 */
export function findDigitalElementAtPosition(
  world: { x: number; y: number },
  strokes: Stroke[],
  mode: 'point' | 'line' | 'arc' | 'all' = 'all',
  zoom: number
): {
  strokeId: string;
  segmentIndex: number;
  pointIndex: number;
  type: 'endpoint' | 'control';
} | null {
  const endpointThreshold = 12.0 / zoom;
  const controlThreshold = 10.0 / zoom;
  const lineThreshold = 15.0 / zoom;
  const arcThreshold = 15.0 / zoom;

  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;

    for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
      const segment = stroke.digitalSegments[segIdx];

      // In 'point' mode, only check endpoints
      if (mode === 'point') {
        if (segment.type === 'line' && segment.points.length >= 2) {
          const startDist = Math.hypot(world.x - segment.points[0].x, world.y - segment.points[0].y);
          if (startDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
          const endDist = Math.hypot(world.x - segment.points[1].x, world.y - segment.points[1].y);
          if (endDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 1, type: 'endpoint' };
          }
        }
        if (segment.type === 'arc' && segment.points.length >= 2) {
          const startDist = Math.hypot(world.x - segment.points[0].x, world.y - segment.points[0].y);
          if (startDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
          const endDist = Math.hypot(world.x - segment.points[1].x, world.y - segment.points[1].y);
          if (endDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 1, type: 'endpoint' };
          }
        }
        continue;
      }

      // In 'line' mode, only check line segments
      if (mode === 'line') {
        if (segment.type === 'line' && segment.points.length >= 2) {
          const lineDist = distanceToSegment(world, segment.points[0], segment.points[1]);
          if (lineDist <= lineThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
        }
        continue;
      }

      // In 'arc' mode, only check arc/circle segments
      if (mode === 'arc') {
        if (segment.type === 'arc' && segment.arcData) {
          const distToCenter = Math.hypot(world.x - segment.arcData.center.x, world.y - segment.arcData.center.y);
          const distToArc = Math.abs(distToCenter - segment.arcData.radius);

          if (distToArc <= arcThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
        }
        continue;
      }

      // 'all' mode - check everything
      // Check endpoints first
      if (segment.points.length >= 2) {
        const startDist = Math.hypot(world.x - segment.points[0].x, world.y - segment.points[0].y);
        if (startDist <= endpointThreshold) {
          return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
        }

        if (segment.type !== 'bezier' || segment.points.length < 4) {
          const endDist = Math.hypot(world.x - segment.points[1].x, world.y - segment.points[1].y);
          if (endDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 1, type: 'endpoint' };
          }
        }
      }

      // Check control points for bezier
      if (segment.type === 'bezier' && segment.points.length >= 4) {
        for (let i = 2; i < segment.points.length; i++) {
          const dist = Math.hypot(world.x - segment.points[i].x, world.y - segment.points[i].y);
          if (dist <= controlThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: i, type: 'control' };
          }
        }
      }

      // Check line segments
      if (segment.type === 'line' && segment.points.length >= 2) {
        const lineDist = distanceToSegment(world, segment.points[0], segment.points[1]);
        if (lineDist <= lineThreshold) {
          return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
        }
      }

      // Check arc segments
      if (segment.type === 'arc' && segment.arcData) {
        const distToCenter = Math.hypot(world.x - segment.arcData.center.x, world.y - segment.arcData.center.y);
        const distToArc = Math.abs(distToCenter - segment.arcData.radius);

        if (distToArc <= arcThreshold) {
          // Check if point is within arc angle range
          const angle = Math.atan2(world.y - segment.arcData.center.y, world.x - segment.arcData.center.x);
          const startAngle = segment.arcData.startAngle;
          const endAngle = segment.arcData.endAngle;

          // Normalize angles
          let normalizedAngle = angle;
          let normalizedStart = startAngle;
          let normalizedEnd = endAngle;

          while (normalizedAngle < normalizedStart) normalizedAngle += Math.PI * 2;
          while (normalizedEnd < normalizedStart) normalizedEnd += Math.PI * 2;

          if (normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
        }
      }

      // Check bezier curves
      if (segment.type === 'bezier' && segment.points.length >= 4) {
        // Approximate bezier with line segments
        const p0 = segment.points[0];
        const p1 = segment.points[1];
        const p2 = segment.points[2];
        const p3 = segment.points[3];

        const steps = 10;
        for (let i = 0; i < steps; i++) {
          const t1 = i / steps;
          const t2 = (i + 1) / steps;

          const x1 = (1-t1)*(1-t1)*(1-t1)*p0.x + 3*(1-t1)*(1-t1)*t1*p1.x + 3*(1-t1)*t1*t1*p2.x + t1*t1*t1*p3.x;
          const y1 = (1-t1)*(1-t1)*(1-t1)*p0.y + 3*(1-t1)*(1-t1)*t1*p1.y + 3*(1-t1)*t1*t1*p2.y + t1*t1*t1*p3.y;

          const x2 = (1-t2)*(1-t2)*(1-t2)*p0.x + 3*(1-t2)*(1-t2)*t2*p1.x + 3*(1-t2)*t2*t2*p2.x + t2*t2*t2*p3.x;
          const y2 = (1-t2)*(1-t2)*(1-t2)*p0.y + 3*(1-t2)*(1-t2)*t2*p1.y + 3*(1-t2)*t2*t2*p2.y + t2*t2*t2*p3.y;

          const dist = distanceToSegment(world, { x: x1, y: y1 }, { x: x2, y: y2 });
          if (dist <= lineThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Find all digital elements at position
 */
export function findAllDigitalElementsAtPosition(
  world: { x: number; y: number },
  strokes: Stroke[],
  mode: 'point' | 'line' | 'arc' | 'all' = 'all',
  zoom: number
): Array<{
  strokeId: string;
  segmentIndex: number;
  pointIndex: number;
  type: 'endpoint' | 'control' | 'segment' | 'arc';
}> {
  const results: Array<{
    strokeId: string;
    segmentIndex: number;
    pointIndex: number;
    type: 'endpoint' | 'control' | 'segment' | 'arc';
  }> = [];

  const endpointThreshold = 12.0 / zoom;
  const controlThreshold = 10.0 / zoom;
  const lineThreshold = 15.0 / zoom;
  const arcThreshold = 15.0 / zoom;

  for (const stroke of strokes) {
    if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;

    for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
      const segment = stroke.digitalSegments[segIdx];

      // Check based on mode
      if (mode === 'point') {
        // Only endpoints
        if (segment.points.length >= 1) {
          const startDist = Math.hypot(world.x - segment.points[0].x, world.y - segment.points[0].y);
          if (startDist <= endpointThreshold) {
            results.push({ strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' });
          }
        }
        if (segment.points.length >= 2) {
          const endDist = Math.hypot(world.x - segment.points[1].x, world.y - segment.points[1].y);
          if (endDist <= endpointThreshold) {
            results.push({ strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 1, type: 'endpoint' });
          }
        }
      } else if (mode === 'line' && segment.type === 'line') {
        // Line segments
        if (segment.points.length >= 2) {
          const lineDist = distanceToSegment(world, segment.points[0], segment.points[1]);
          if (lineDist <= lineThreshold) {
            results.push({ strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'segment' });
          }
        }
      } else if (mode === 'arc' && segment.type === 'arc') {
        // Arc segments
        if (segment.arcData) {
          const distToCenter = Math.hypot(world.x - segment.arcData.center.x, world.y - segment.arcData.center.y);
          const distToArc = Math.abs(distToCenter - segment.arcData.radius);

          if (distToArc <= arcThreshold) {
            results.push({ strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'arc' });
          }
        }
      } else if (mode === 'all') {
        // Check everything
        const element = findDigitalElementAtPosition(world, [stroke], 'all', zoom);
        if (element && element.strokeId === stroke.id && element.segmentIndex === segIdx) {
          results.push({
            strokeId: stroke.id,
            segmentIndex: segIdx,
            pointIndex: element.pointIndex,
            type: element.type === 'control' ? 'control' : 'endpoint',
          });
        }
      }
    }
  }

  return results;
}
