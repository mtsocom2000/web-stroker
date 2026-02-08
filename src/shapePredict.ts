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

/**
 * Try straight line first, then triangle, then (later) rect, circle, ellipse.
 */
export function predictShape(points: Point[]): Point[] | null {
  if (points.length < 2) return null;
  return (
    detectStraightLine(points) ??
    detectPolyline(points) ??
    detectTriangle(points) ??
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
 * Detect polylines (L-shapes, Z-shapes) by finding corner points.
 * Returns corner points without automatically closing the shape.
 */
function detectPolyline(points: Point[]): Point[] | null {
  if (points.length < 6) return null; // Need sufficient points for meaningful polyline detection
  
  // Simple corner detection by looking for direction changes
  const corners: Point[] = [points[0]]; // Always include start point
  const angleThreshold = Math.PI * 0.6; // 108 degrees - allow gentle curves
  
  for (let i = 2; i < points.length - 2; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate angle between segments
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    
    if (len1 < 2 || len2 < 2) continue;
    
    // Normalize and calculate angle
    const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    // If angle is sharp enough, it's a corner
    if (angle < angleThreshold) {
      const distFromLast = corners.length > 0 ? 
        Math.hypot(curr.x - corners[corners.length - 1].x, curr.y - corners[corners.length - 1].y) : Infinity;
      
      if (distFromLast > 5) { // Minimum distance between corners
        corners.push(curr);
      }
    }
  }
  
  corners.push(points[points.length - 1]); // Always include end point
  
  // Only return as polyline if we found at least one corner
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
    // Only close the triangle if the user actually drew near the starting point
    const startToEnd = Math.hypot(a.x - c.x, a.y - c.y);
    const perimeter = trianglePerimeter(a, b, c);
    const shouldClose = startToEnd < perimeter * 0.15; // Close if end is within 15% of perimeter
    
    if (shouldClose) {
      return [a, b, c, a]; // Closed triangle
    } else {
      return [a, b, c]; // Open triangle shape
    }
  }
  return null;
}
