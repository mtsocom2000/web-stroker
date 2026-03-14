import type { Point } from './types';

/**
 * DETECTION-FIRST PRINCIPLE:
 * 1. Detect what user intended to draw (straight line, polyline, triangle, circle, etc.)
 * 2. Only smooth when we DON'T detect a clear geometric pattern
 * 3. This prevents artificial curves from straight lines and preserves user intent
 */

/** Max deviation from fitted line as fraction of segment length (0.04 = 4%). More tolerant for raw input. */
const STRAIGHT_LINE_MAX_DEVIATION_RATIO = 0.04;

/** Max deviation from fitted shape as fraction of shape "size" (perimeter). Relaxed for raw hand-drawn input. */
const SHAPE_MAX_DEVIATION_RATIO = 0.15;

/** Max deviation for circle fitting as fraction of radius */
// const CIRCLE_MAX_DEVIATION_RATIO = 0.20; // Now using inline value

/** Minimum points required for circle detection */
const MIN_CIRCLE_POINTS = 8;

/**
 * Try straight line first, then polyline, then triangle, then circle, etc.
 */
export function predictShape(points: Point[]): Point[] | null {
  if (points.length < 2) return null;
  return (
    detectStraightLine(points) ??
    detectPolyline(points) ??
    detectTriangle(points) ??
    detectCircle(points) ??
    null
  );
}

/**
 * Fit a line to points (y = ax + b via least squares). Compute max perpendicular
 * distance of any point to the line. If max distance < threshold fraction of
 * segment length, return [first, last]; else null.
 */
function detectStraightLine(points: Point[]): Point[] | null {
  const n = points.length;
  if (n < 4) return null; // Need more points for reliable line detection with raw input

  const first = points[0];
  const last = points[n - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);
  
  // Minimum length requirement to avoid detecting very short strokes as lines
  if (segmentLength < 10) return null; // Longer minimum for raw input
  
  // ROBUST LINE CHECK: Multiple criteria to avoid false positives
  
  // 1. Check overall direction consistency
  let maxDeviation = 0;
  let totalDeviation = 0;
  let outlierCount = 0;
  
  // Calculate expected line direction and check each point
  const nx = -dy / segmentLength;
  const ny = dx / segmentLength;
  const mx = (first.x + last.x) / 2;
  const my = (first.y + last.y) / 2;
  
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const vx = p.x - mx;
    const vy = p.y - my;
    const dist = Math.abs(vx * nx + vy * ny);
    
    maxDeviation = Math.max(maxDeviation, dist);
    totalDeviation += dist;
    
    // Count outliers (points significantly off the line)
    if (dist > segmentLength * STRAIGHT_LINE_MAX_DEVIATION_RATIO * 2) {
      outlierCount++;
    }
  }
  
  // 2. Reject if too many outliers (likely not a line)
  const outlierThreshold = Math.max(1, Math.floor(n * 0.15)); // Allow up to 15% outliers
  if (outlierCount > outlierThreshold) {
    return null; // Too many outliers, not a line
  }
  
  // 3. Check for significant direction changes (corners)
  const segmentSize = Math.max(3, Math.floor(n / 3));
  let maxAngleChange = 0;
  
  for (let i = segmentSize; i < n - segmentSize; i += segmentSize) {
    const p1 = points[i - segmentSize];
    const p2 = points[i];
    const p3 = points[i + segmentSize];
    
    const v1x = p2.x - p1.x;
    const v1y = p2.y - p1.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;
    
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    
    if (len1 > 1 && len2 > 1) {
      const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      maxAngleChange = Math.max(maxAngleChange, angle);
    }
  }
  
  // 4. Reject if significant angle change detected (L-shape, Z-shape)
  if (maxAngleChange > Math.PI * 0.4) { // > 72 degrees
    return null;
  }
  
  // 5. Final deviation check
  const avgDeviation = totalDeviation / n;
  const maxThreshold = segmentLength * STRAIGHT_LINE_MAX_DEVIATION_RATIO;
  const avgThreshold = maxThreshold * 0.4; // Stricter average check
  
  if (maxDeviation <= maxThreshold && avgDeviation <= avgThreshold) {
    return [first, last];
  }
  
  return null;
}

/**
 * Detect polylines (L-shapes, Z-shapes, V-shapes) by finding corner points.
 * Returns corner points without automatically closing the shape.
 */
function detectPolyline(points: Point[]): Point[] | null {
  if (points.length < 5) return null; // RELAXED: Need fewer points
  
  // Simple corner detection by looking for direction changes
  const corners: Point[] = [points[0]]; // Always include start point
  const angleThreshold = Math.PI * 0.75; // RELAXED: 135 degrees - more tolerant for V-shapes
  
  // Use a sliding window to detect corners more reliably
  for (let i = 3; i < points.length - 3; i++) {
    // Use points further apart for more stable angle calculation
    const prev = points[i - 3];
    const curr = points[i];
    const next = points[i + 3];
    
    // Calculate angle between segments
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    
    if (len1 < 3 || len2 < 3) continue;
    
    // Normalize and calculate angle
    const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    // If angle is sharp enough, it's a corner
    if (angle < angleThreshold) {
      const distFromLast = corners.length > 0 ? 
        Math.hypot(curr.x - corners[corners.length - 1].x, curr.y - corners[corners.length - 1].y) : Infinity;
      
      if (distFromLast > 10) { // RELAXED: Larger minimum distance between corners
        corners.push(curr);
      }
    }
  }
  
  corners.push(points[points.length - 1]); // Always include end point
  
  // RELAXED: Return as polyline if we found at least one corner (3 points total)
  // This allows V-shapes to be detected
  return corners.length >= 3 ? corners : null;
}

// --- Convex hull (Graham scan) ---
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];
  const pts = [...points];
  const idx = pts.map((_, i) => i);
  idx.sort((i, j) => pts[i].y !== pts[j].y ? pts[i].y - pts[j].y : pts[i].x - pts[j].x);
  const start = pts[idx[0]];
  idx.sort((i, j) => {
    const a = pts[i];
    const b = pts[j];
    const c = cross(start, a, b);
    if (Math.abs(c) < 1e-10) {
      const da = (a.x - start.x) ** 2 + (a.y - start.y) ** 2;
      const db = (b.x - start.x) ** 2 + (b.y - start.y) ** 2;
      return da - db;
    }
    return -c; // ascending polar angle (CCW hull)
  });
  const hull: Point[] = [];
  for (const i of idx) {
    const p = pts[i];
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }
  return hull;
}

/** Squared distance from point p to segment a-b. */
function pointToSegmentDistSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + t * dx;
  const qy = a.y + t * dy;
  return (p.x - qx) ** 2 + (p.y - qy) ** 2;
}

/** Max distance from any point in points to the triangle defined by [a, b, c]. */
function maxDistToTriangle(points: Point[], a: Point, b: Point, c: Point): number {
  let maxSq = 0;
  for (const p of points) {
    const dSq = Math.min(
      pointToSegmentDistSq(p, a, b),
      pointToSegmentDistSq(p, b, c),
      pointToSegmentDistSq(p, c, a)
    );
    if (dSq > maxSq) maxSq = dSq;
  }
  return Math.sqrt(maxSq);
}

/** Perimeter of triangle a-b-c. */
function trianglePerimeter(a: Point, b: Point, c: Point): number {
  const d = (p: Point, q: Point) => Math.hypot(q.x - p.x, q.y - p.y);
  return d(a, b) + d(b, c) + d(c, a);
}

/**
 * Step 2a: If stroke fits a triangle (hull has 3 vertices, or 4/5 with one candidate fitting),
 * return closed triangle [a, b, c, a].
 */
function detectTriangle(points: Point[]): Point[] | null {
  if (points.length < 3) return null;
  const hull = convexHull(points);
  if (hull.length < 3) return null;

  const candidates: [Point, Point, Point][] = [];

  if (hull.length === 3) {
    candidates.push([hull[0], hull[1], hull[2]]);
  } else if (hull.length === 4) {
    // Try all 4 triangles (omit one vertex); hull is CCW so each triple is CCW
    candidates.push([hull[1], hull[2], hull[3]]);
    candidates.push([hull[2], hull[3], hull[0]]);
    candidates.push([hull[3], hull[0], hull[1]]);
    candidates.push([hull[0], hull[1], hull[2]]);
  } else if (hull.length >= 5) {
    // Try triangles: consecutive (for 5-vertex hull) and spread-out (0, mid, n-1)
    const n = hull.length;
    for (let i = 0; i < n; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % n];
      const c = hull[(i + 2) % n];
      candidates.push([a, b, c]);
    }
    const mid = Math.floor(n / 2);
    candidates.push([hull[0], hull[mid], hull[n - 1]]);
  }

  let best: [Point, Point, Point] | null = null;
  let bestMaxDist = Infinity;

  for (const [a, b, c] of candidates) {
    const perimeter = trianglePerimeter(a, b, c);
    if (perimeter < 1e-6) continue;
    const maxDist = maxDistToTriangle(points, a, b, c);
    const threshold = perimeter * SHAPE_MAX_DEVIATION_RATIO;
    if (maxDist <= threshold && maxDist < bestMaxDist) {
      bestMaxDist = maxDist;
      best = [a, b, c];
    }
  }

  if (best) {
    const [a, b, c] = best;
    // Return open triangle (no need to close it)
    return [a, b, c];
  }
  return null;
}

/**
 * Detect circles using least squares fitting.
 * Returns sampled points along the fitted circle if detection succeeds.
 */
function detectCircle(points: Point[]): Point[] | null {
  // Need enough points for reliable circle fitting
  if (points.length < MIN_CIRCLE_POINTS) return null;

  // Check if the stroke is roughly closed (start and end are close)
  const start = points[0];
  const end = points[points.length - 1];
  const startToEndDist = Math.hypot(start.x - end.x, start.y - end.y);
  const totalLength = calculatePathLength(points);

  // RELAXED: For a circle, start and end should be close (within 25% of total length)
  // This is more tolerant for hand-drawn circles
  if (startToEndDist > totalLength * 0.25) {
    return null;
  }

  // Use Kåsa method (linearized circle fitting)
  const circleFit = fitCircleLeastSquares(points);
  if (!circleFit) return null;

  const { center, radius } = circleFit;

  // Validate the fit
  // Calculate standard deviation of distances from center
  const distances = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);

  // RELAXED: Error tolerance increased to 20%
  const tolerance = avgDistance * 0.20;
  if (stdDev > tolerance) {
    return null;
  }

  // Additional check: ensure the points cover a good portion of the circle
  // Use more robust angle coverage calculation
  const angleCoverage = calculateAngleCoverage(points, center);

  // RELAXED: Should cover at least 180 degrees (0.5 * 2π) for hand-drawn circles
  if (angleCoverage < Math.PI) {
    return null;
  }

  // RELAXED: Also check aspect ratio to ensure it's roughly circular (not elliptical)
  // This is a simplified check - if it passes the stdDev check, it's likely circular enough

  // Generate circle points (32 samples for smooth circle)
  const numPoints = 32;
  const circlePoints: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    circlePoints.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  // Close the circle
  circlePoints.push(circlePoints[0]);

  return circlePoints;
}

/**
 * Calculate angle coverage of points around a center
 * More robust than simple min/max
 */
function calculateAngleCoverage(points: Point[], center: Point): number {
  const angles = points.map((p) => Math.atan2(p.y - center.y, p.x - center.x));
  
  // Sort angles
  angles.sort((a, b) => a - b);
  
  // Find the largest gap between consecutive angles
  let maxGap = 0;
  for (let i = 0; i < angles.length; i++) {
    const nextAngle = angles[(i + 1) % angles.length];
    let gap = nextAngle - angles[i];
    if (i === angles.length - 1) {
      gap += 2 * Math.PI; // Wrap around
    }
    maxGap = Math.max(maxGap, gap);
  }
  
  // Coverage is 2π minus the largest gap
  return 2 * Math.PI - maxGap;
}

/**
 * Calculate total path length of points
 */
function calculatePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/**
 * Fit a circle using Kåsa method (linearized least squares)
 * More robust and efficient than iterative methods
 */
function fitCircleLeastSquares(
  points: Point[]
): { center: Point; radius: number; error: number } | null {
  const n = points.length;
  if (n < 3) return null;

  // Calculate sums needed for the linear system
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let sumXY = 0;
  let sumX3 = 0;
  let sumXY2 = 0;
  let sumX2Y = 0;
  let sumY3 = 0;

  for (const p of points) {
    const x2 = p.x * p.x;
    const y2 = p.y * p.y;

    sumX += p.x;
    sumY += p.y;
    sumX2 += x2;
    sumY2 += y2;
    sumXY += p.x * p.y;
    sumX3 += x2 * p.x;
    sumXY2 += p.x * y2;
    sumX2Y += x2 * p.y;
    sumY3 += y2 * p.y;
  }

  // Build the linear system Ax = b
  // See: https://dtcenter.org/met/users/docs/write_ups/circle_fit.pdf
  const Cxx = sumX2 - (sumX * sumX) / n;
  const Cxy = sumXY - (sumX * sumY) / n;
  const Cyy = sumY2 - (sumY * sumY) / n;
  const Cxxx = sumX3 - (sumX2 * sumX) / n;
  const Cxyy = sumXY2 - (sumY2 * sumX) / n;
  const Cxxy = sumX2Y - (sumX2 * sumY) / n;
  const Cyyy = sumY3 - (sumY2 * sumY) / n;

  // Check if points are collinear (determinant close to zero)
  const det = Cxx * Cyy - Cxy * Cxy;
  if (Math.abs(det) < 1e-10) {
    return null; // Points are collinear, not a circle
  }

  // Solve for center coordinates
  const cx = (Cyyy * Cxy - Cxyy * Cyy - Cxxy * Cxy + Cxxx * Cyy) / (2 * det);
  const cy = (Cxxx * Cxy - Cxxy * Cxx - Cxyy * Cxy + Cyyy * Cxx) / (2 * det);

  const center: Point = {
    x: cx,
    y: cy,
  };

  // Calculate radius as average distance from center
  const distances = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
  const radius = distances.reduce((a, b) => a + b, 0) / n;

  // Calculate fitting error (mean squared error)
  const error = distances.reduce((sum, d) => sum + Math.pow(d - radius, 2), 0) / n;

  // Validate: radius should be reasonable
  if (radius < 5 || radius > 1000) {
    return null;
  }

  return { center, radius, error };
}
