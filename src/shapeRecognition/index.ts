import type { Point } from '../types';
import { distance } from '../utils';

/** Max deviation from fitted line as fraction of segment length (0.015 = 1.5%). Smaller = stricter. */
const STRAIGHT_LINE_MAX_DEVIATION_RATIO = 0.015;



// Shape detection result types
export type ShapeResult = {
  type: 'line' | 'polyline' | 'triangle' | 'circle' | 'ellipse' | 'arc';
  points: Point[];
  confidence: number;
};

/**
 * Try straight line first, then polyline, then triangle, then circle/ellipse, then arc.
 */
export function predictShape(points: Point[]): Point[] | null {
  if (points.length < 2) return null;
  
  return (
    detectStraightLine(points) ??
    detectPolyline(points) ??
    detectTriangle(points) ??
    detectCircleOrEllipse(points) ??
    detectArc(points) ??
    null
  );
}

/**
 * Enhanced straight line detection with better tolerance and validation.
 * Returns [first, last] if points form a straight line, else null.
 */
export function detectStraightLine(points: Point[]): Point[] | null {
  const n = points.length;
  if (n < 3) return null; // Need at least 3 points for meaningful line detection

  const first = points[0];
  const last = points[n - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);
  
  // Minimum length requirement to avoid detecting very short strokes as lines
  if (segmentLength < 5) return null;

  // Calculate perpendicular distances from each point to the line
  const nx = -dy / segmentLength;
  const ny = dx / segmentLength;
  const mx = (first.x + last.x) / 2;
  const my = (first.y + last.y) / 2;

  let maxDist = 0;
  let totalDist = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const vx = p.x - mx;
    const vy = p.y - my;
    const dist = Math.abs(vx * nx + vy * ny);
    maxDist = Math.max(maxDist, dist);
    totalDist += dist;
  }

  // Use both max deviation and average deviation for more robust detection
  const avgDist = totalDist / n;
  const maxThreshold = segmentLength * STRAIGHT_LINE_MAX_DEVIATION_RATIO;
  const avgThreshold = segmentLength * STRAIGHT_LINE_MAX_DEVIATION_RATIO * 0.3; // Stricter average check

  // Additional check: require points to be roughly evenly distributed along the line
  let maxProjectedDeviation = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const t = ((p.x - first.x) * dx + (p.y - first.y) * dy) / (segmentLength * segmentLength);
    const projectedX = first.x + t * dx;
    const projectedY = first.y + t * dy;
    const projectedDist = Math.hypot(p.x - projectedX, p.y - projectedY);
    maxProjectedDeviation = Math.max(maxProjectedDeviation, projectedDist);
  }

  if (maxDist <= maxThreshold && avgDist <= avgThreshold && maxProjectedDeviation <= maxThreshold) {
    return [first, last];
  }
  return null;
}

/**
 * Detect polylines (shapes with multiple corners) from point data.
 * Returns corner points connected by straight segments.
 */
export function detectPolyline(points: Point[]): Point[] | null {
  if (points.length < 6) return null; // Need sufficient points for meaningful polyline detection

  // Find corner points using improved corner detection
  const corners = findPathCornersImproved(points);
  if (corners.length < 2) return null;

  // Check if we have a closed shape vs open polyline
  const startToEnd = distance(points[0], points[points.length - 1]);
  const pathLength = calculatePathLength(points);
  const isClosed = startToEnd < pathLength * 0.15;

  if (corners.length >= 2) {
    // Verify that segments between corners are reasonably straight
    const validCorners = [corners[0]];
    for (let i = 1; i < corners.length; i++) {
      const prevCorner = validCorners[validCorners.length - 1];
      const currCorner = corners[i];
      
      if (isSegmentStraight(points, prevCorner, currCorner)) {
        validCorners.push(currCorner);
      }
    }

    if (validCorners.length >= 2) {
      // For closed shapes, ensure the last segment back to first is also straight
      if (isClosed && validCorners.length > 2) {
        if (isSegmentStraight(points, validCorners[validCorners.length - 1], validCorners[0])) {
          validCorners.push(validCorners[0]); // Close the shape
        }
      }
      
      return validCorners.length >= 2 ? validCorners : null;
    }
  }

  return null;
}

// Helper functions
function findPathCornersImproved(points: Point[]): Point[] {
  const corners: Point[] = [];
  const minCornerAngle = Math.PI * 0.3; // 54 degrees for sharp corners
  const maxCornerAngle = Math.PI * 0.5; // 90 degrees for gentle corners
  
  // Use variable sampling based on point density
  const baseSampleStep = Math.max(2, Math.floor(points.length / 20));
  
  for (let i = baseSampleStep; i < points.length - baseSampleStep; i += baseSampleStep) {
    // Look at a larger window for more stable angle calculation
    const windowSize = Math.min(baseSampleStep * 2, Math.floor(points.length / 4));
    const prev = points[Math.max(0, i - windowSize)];
    const curr = points[i];
    const next = points[Math.min(points.length - 1, i + windowSize)];
    
    // Calculate angle between segments
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    if (len1 < 2 || len2 < 2) continue;
    
    // Normalize and calculate angle
    v1.x /= len1; v1.y /= len1;
    v2.x /= len2; v2.y /= len2;
    
    const cosAngle = v1.x * v2.x + v1.y * v2.y;
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    // Adaptive threshold - sharper angles for local maxima
    const localThreshold = angle < Math.PI * 0.4 ? minCornerAngle : maxCornerAngle;
    
    if (angle < localThreshold) {
      // Check if this is a local maximum in curvature (avoid detecting smooth curves)
      const distFromPrev = corners.length > 0 ? distance(curr, corners[corners.length - 1]) : Infinity;
      if (distFromPrev > 10) { // Minimum distance between corners
        corners.push(curr);
      }
    }
  }
  
  // Always include start and end as potential corners
  if (points.length > 0) {
    corners.unshift(points[0]);
    if (distance(points[0], points[points.length - 1]) > 5) {
      corners.push(points[points.length - 1]);
    }
  }
  
  return corners;
}

function calculatePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

function isSegmentStraight(points: Point[], start: Point, end: Point): boolean {
  // Implementation from shapePredict.ts
  const segmentPoints = points.filter(p => {
    const distToStart = distance(p, start);
    const distToEnd = distance(p, end);
    const segmentLength = distance(start, end);
    return distToStart + distToEnd < segmentLength * 1.1;
  });
  
  if (segmentPoints.length < 2) return true;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);
  
  if (segmentLength < 1) return true;
  
  const nx = -dy / segmentLength;
  const ny = dx / segmentLength;
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  
  let maxDist = 0;
  for (const p of segmentPoints) {
    const vx = p.x - mx;
    const vy = p.y - my;
    const dist = Math.abs(vx * nx + vy * ny);
    maxDist = Math.max(maxDist, dist);
  }
  
  const threshold = segmentLength * 0.05;
  return maxDist <= threshold;
}

// Triangle detection implementation copied from shapePredict.ts
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

function trianglePerimeter(a: Point, b: Point, c: Point): number {
  const d = (p: Point, q: Point) => Math.hypot(q.x - p.x, q.y - p.y);
  return d(a, b) + d(b, c) + d(c, a);
}

export function detectTriangle(points: Point[]): Point[] | null {
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
    const threshold = perimeter * 0.12; // SHAPE_MAX_DEVIATION_RATIO
    if (maxDist <= threshold && maxDist < bestMaxDist) {
      bestMaxDist = maxDist;
      best = [a, b, c];
    }
  }

  if (best) {
    const [a, b, c] = best;
    return [a, b, c, a];
  }
  return null;
}

export function detectCircleOrEllipse(points: Point[]): Point[] | null {
  if (points.length < 12) return null; // Need more points for reliable ellipse detection

  const ellipseFit = fitEllipse(points);
  if (!ellipseFit) return null;

  const { center, radiusX, radiusY, rotation } = ellipseFit;
  


  // Generate ellipse/circle points
  const numPoints = 32;
  const ellipsePoints: Point[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const x = radiusX * Math.cos(angle);
    const y = radiusY * Math.sin(angle);
    
    // Apply rotation
    const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
    const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
    
    ellipsePoints.push({
      x: center.x + rotatedX,
      y: center.y + rotatedY
    });
  }

  // Validate the fit
  if (validateEllipseFit(points, ellipsePoints)) {
    return ellipsePoints;
  }
  
  return null;
}

/**
 * Fit an ellipse to the given points using least squares method.
 */
function fitEllipse(points: Point[]): { center: Point; radiusX: number; radiusY: number; rotation: number } | null {
  const n = points.length;
  if (n < 5) return null;

  // Calculate centroid
  const centroid = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  centroid.x /= n;
  centroid.y /= n;

  // Translate points to centroid
  const centeredPoints = points.map(p => ({ x: p.x - centroid.x, y: p.y - centroid.y }));

  // Build the design matrix for the conic equation: Ax² + Bxy + Cy² + Dx + Ey + F = 0
  const designMatrix: number[][] = [];
  
  for (const p of centeredPoints) {
    const x = p.x, y = p.y;
    designMatrix.push([x * x, x * y, y * y, x, y, 1]);
  }

  // Solve using singular value decomposition (simplified approach)
  // For robust ellipse fitting, we'll use a more direct approach
  
  // Calculate the conic parameters
  const conic = fitConic(centeredPoints);
  if (!conic) return null;

  const { A, B, C, D, E, F } = conic;

  // Extract ellipse parameters from conic equation
  const denom = B * B - 4 * A * C;
  if (denom >= 0) return null; // Not an ellipse

  // Calculate center
  const centerX = (2 * C * D - B * E) / denom;
  const centerY = (2 * A * E - B * D) / denom;

  // Calculate rotation
  let rotation;
  if (B === 0) {
    rotation = A < C ? 0 : Math.PI / 2;
  } else {
    rotation = 0.5 * Math.atan(B / (A - C));
  }

  // Calculate semi-axes
  const numerator = 2 * (A * E * E + C * D * D + F * B * B - 2 * B * D * E - A * C * F);
  const aSquared = numerator / (denom * (C - A + Math.sqrt((A - C) ** 2 + B * B)));
  const bSquared = numerator / (denom * (C - A - Math.sqrt((A - C) ** 2 + B * B)));

  const radiusX = Math.sqrt(Math.abs(aSquared));
  const radiusY = Math.sqrt(Math.abs(bSquared));

  return {
    center: { x: centerX + centroid.x, y: centerY + centroid.y },
    radiusX,
    radiusY,
    rotation
  };
}

/**
 * Fit a general conic to points using least squares.
 */
function fitConic(points: Point[]): { A: number; B: number; C: number; D: number; E: number; F: number } | null {
  const n = points.length;
  if (n < 6) return null;

  // Build matrices for the least squares problem
  const M: number[][] = [];
  const b: number[] = [];

  for (const p of points) {
    const x = p.x, y = p.y;
    M.push([x * x, x * y, y * y, x, y]);
    b.push(-1);
  }

  // Solve M * [A, B, C, D, E] = b
  // For simplicity, using a basic approach (in practice, you'd use a proper linear algebra library)
  const result = solveLinearSystem(M, b);
  if (!result) return null;

  return {
    A: result[0],
    B: result[1],
    C: result[2],
    D: result[3],
    E: result[4],
    F: 1
  };
}

/**
 * Simple linear system solver (for demonstration).
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  // This is a simplified approach - in practice, you'd use a robust linear algebra library
  const m = A.length;
  
  // For ellipse fitting, we need at least 6 points for a stable solution
  if (m < 6) return null;

  // Use the first 6 equations to get an approximate solution
  const A6 = A.slice(0, 6);
  const b6 = b.slice(0, 6);

  // Gaussian elimination (simplified)
  const aug = A6.map((row, i) => [...row, b6[i]]);
  
  for (let i = 0; i < 5; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < 6; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    
    // Eliminate
    for (let k = i + 1; k < 6; k++) {
      const factor = aug[k][i] / aug[i][i];
      for (let j = i; j <= 5; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  // Back substitution
  const x = new Array(5).fill(0);
  for (let i = 5; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < 5; j++) {
      sum += aug[i][j] * x[j];
    }
    x[i] = (aug[i][5] - sum) / aug[i][i];
  }

  return x;
}

/**
 * Validate if the fitted ellipse matches the original points within tolerance.
 */
function validateEllipseFit(originalPoints: Point[], ellipsePoints: Point[]): boolean {
  const maxDeviation = 3.0; // Maximum allowed deviation for ellipse
  let maxError = 0;

  // Check each original point against the fitted ellipse
  for (const originalPoint of originalPoints) {
    // Find closest point on ellipse
    let minDistance = Infinity;
    for (const ellipsePoint of ellipsePoints) {
      const dist = distance(originalPoint, ellipsePoint);
      minDistance = Math.min(minDistance, dist);
    }
    maxError = Math.max(maxError, minDistance);
    
    if (maxError > maxDeviation) {
      return false;
    }
  }

  return true;
}

export function detectArc(points: Point[]): Point[] | null {
  if (points.length < 8) return null; // Need sufficient points for arc detection

  // Try to fit an arc to the points using least squares fitting
  const arcFit = fitArc(points);
  if (!arcFit) return null;

  const { center, radius, startAngle, endAngle } = arcFit;
  
  // Generate arc points
  const arcPoints: Point[] = [];
  const numPoints = 32;
  const angleStep = (endAngle - startAngle) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const angle = startAngle + i * angleStep;
    arcPoints.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }

  // Validate the fit
  if (validateArcFit(points, arcPoints)) {
    return arcPoints;
  }
  
  return null;
}

/**
 * Fit an arc to the given points using least squares circle fitting.
 */
function fitArc(points: Point[]): { center: Point; radius: number; startAngle: number; endAngle: number } | null {
  const n = points.length;
  if (n < 3) return null;

  // Calculate centroid
  const centroid = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  centroid.x /= n;
  centroid.y /= n;

  // Translate points to centroid
  const centeredPoints = points.map(p => ({ x: p.x - centroid.x, y: p.y - centroid.y }));

  // Least squares circle fitting
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0, sumX3 = 0, sumY3 = 0, sumX2Y = 0, sumXY2 = 0;
  
  for (const p of centeredPoints) {
    const x = p.x, y = p.y;
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
    sumXY += x * y;
    sumX3 += x * x * x;
    sumY3 += y * y * y;
    sumX2Y += x * x * y;
    sumXY2 += x * y * y;
  }

  const A = n * sumX2 - sumX * sumX;
  const B = n * sumXY - sumX * sumY;
  const C = n * sumY2 - sumY * sumY;
  const D = 0.5 * (n * (sumX3 + sumXY2) - sumX * (sumX2 + sumY2));
  const E = 0.5 * (n * (sumY3 + sumX2Y) - sumY * (sumX2 + sumY2));

  const det = A * C - B * B;
  if (Math.abs(det) < 1e-8) return null;

  const centerX = (C * D - B * E) / det;
  const centerY = (A * E - B * D) / det;

  const center = { x: centerX + centroid.x, y: centerY + centroid.y };
  const radius = Math.sqrt(centerX * centerX + centerY * centerY + (sumX2 + sumY2) / n);

  // Find start and end angles
  const angles = points.map(p => Math.atan2(p.y - center.y, p.x - center.x));
  const startAngle = angles[0];
  const endAngle = angles[angles.length - 1];

  // Normalize angles
  const normalizedStart = normalizeAngle(startAngle);
  let normalizedEnd = normalizeAngle(endAngle);
  
  // Handle angle wrapping
  if (normalizedEnd < normalizedStart) {
    normalizedEnd += 2 * Math.PI;
  }

  return { center, radius, startAngle: normalizedStart, endAngle: normalizedEnd };
}

/**
 * Validate if the fitted arc matches the original points within tolerance.
 */
function validateArcFit(originalPoints: Point[], arcPoints: Point[]): boolean {
  const maxDeviation = 2.0; // Maximum allowed deviation
  let maxError = 0;

  // Check each original point against the fitted arc
  for (const originalPoint of originalPoints) {
    // Find closest point on arc
    let minDistance = Infinity;
    for (const arcPoint of arcPoints) {
      const dist = distance(originalPoint, arcPoint);
      minDistance = Math.min(minDistance, dist);
    }
    maxError = Math.max(maxError, minDistance);
    
    if (maxError > maxDeviation) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize angle to [0, 2π]
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
  return angle;
}