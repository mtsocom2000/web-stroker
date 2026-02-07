import type { Point } from './types';

/** Max deviation from fitted line as fraction of segment length (0.03 = 3%). Smaller = stricter. */
const STRAIGHT_LINE_MAX_DEVIATION_RATIO = 0.03;

/** Max deviation from fitted shape as fraction of shape "size" (perimeter). Relaxed for hand-drawn. */
const SHAPE_MAX_DEVIATION_RATIO = 0.12;

/**
 * Try straight line first, then triangle, then (later) rect, circle, ellipse.
 */
export function predictShape(points: Point[]): Point[] | null {
  if (points.length < 2) return null;
  return (
    detectStraightLine(points) ??
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
  if (n < 2) return null;

  const first = points[0];
  const last = points[n - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);
  if (segmentLength < 1e-6) return [first, last]; // degenerate: single point

  // Least-squares line: minimize sum of perpendicular distances.
  // Use line through (first + last)/2 with direction (dx, dy).
  const mx = (first.x + last.x) / 2;
  const my = (first.y + last.y) / 2;
  const nx = -dy / segmentLength;
  const ny = dx / segmentLength;

  let maxDist = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const vx = p.x - mx;
    const vy = p.y - my;
    const dist = Math.abs(vx * nx + vy * ny);
    if (dist > maxDist) maxDist = dist;
  }

  const threshold = segmentLength * STRAIGHT_LINE_MAX_DEVIATION_RATIO;
  if (maxDist <= threshold) return [first, last];
  return null;
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
  let bestPerimeter = 0;

  for (const [a, b, c] of candidates) {
    const perimeter = trianglePerimeter(a, b, c);
    if (perimeter < 1e-6) continue;
    const maxDist = maxDistToTriangle(points, a, b, c);
    const threshold = perimeter * SHAPE_MAX_DEVIATION_RATIO;
    if (maxDist <= threshold && maxDist < bestMaxDist) {
      bestMaxDist = maxDist;
      bestPerimeter = perimeter;
      best = [a, b, c];
    }
  }

  if (best) {
    const [a, b, c] = best;
    return [a, b, c, a];
  }
  return null;
}
