import type { Point } from '../types';

export interface PointDensity {
  densities: number[];
  normalizedDensities: number[];
  localMaxima: number[];
  localMinima: number[];
  avgDensity: number;
  maxDensity: number;
  minDensity: number;
  windowSize: number;
}

export interface DensityOptions {
  windowSize: number;
  maximaThreshold: number;
  minimaThreshold: number;
  minDistanceBetweenMaxima: number;
}

export const DEFAULT_DENSITY_OPTIONS: DensityOptions = {
  windowSize: 10,
  maximaThreshold: 1.5,
  minimaThreshold: 0.5,
  minDistanceBetweenMaxima: 15,
};

/**
 * Analyzes point density along a stroke.
 * Crowded areas indicate corners or endpoints where users slow down.
 * Sparse areas indicate smooth curves or straight lines.
 */
export function analyzePointDensity(
  points: Point[],
  options: Partial<DensityOptions> = {}
): PointDensity {
  const opts = { ...DEFAULT_DENSITY_OPTIONS, ...options };

  if (points.length < 3) {
    return {
      densities: points.map(() => 1),
      normalizedDensities: points.map(() => 1),
      localMaxima: [],
      localMinima: [],
      avgDensity: 1,
      maxDensity: 1,
      minDensity: 1,
      windowSize: opts.windowSize,
    };
  }

  // Calculate density at each point
  // Density = number of points within window / window size
  const densities: number[] = [];
  const halfWindow = Math.floor(opts.windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    const startIdx = Math.max(0, i - halfWindow);
    const endIdx = Math.min(points.length - 1, i + halfWindow);

    // Calculate arc length within window
    let windowLength = 0;
    for (let j = startIdx + 1; j <= endIdx; j++) {
      const dx = points[j].x - points[j - 1].x;
      const dy = points[j].y - points[j - 1].y;
      windowLength += Math.sqrt(dx * dx + dy * dy);
    }

    // Density = points per unit length (higher = more crowded)
    // Avoid division by zero
    const pointCount = endIdx - startIdx + 1;
    const density = windowLength > 0.001 ? pointCount / windowLength : pointCount * 100;

    densities.push(density);
  }

  // Normalize densities to 0-1 range
  const maxDensity = Math.max(...densities);
  const minDensity = Math.min(...densities);
  const densityRange = maxDensity - minDensity;

  const normalizedDensities = densities.map((d) =>
    densityRange > 0 ? (d - minDensity) / densityRange : 0.5
  );

  // Find local maxima (crowded areas = likely corners)
  const localMaxima = findLocalMaxima(
    points,
    densities,
    opts.maximaThreshold,
    opts.minDistanceBetweenMaxima
  );

  // Find local minima (sparse areas = smooth curves)
  const localMinima = findLocalMinima(points, densities, opts.minimaThreshold);

  const avgDensity = densities.reduce((a, b) => a + b, 0) / densities.length;

  return {
    densities,
    normalizedDensities,
    localMaxima,
    localMinima,
    avgDensity,
    maxDensity,
    minDensity,
    windowSize: opts.windowSize,
  };
}

/**
 * Finds local maxima (density peaks) that indicate corners.
 */
function findLocalMaxima(
  points: Point[],
  densities: number[],
  threshold: number,
  minDistance: number
): number[] {
  const maxima: number[] = [];
  const avgDensity = densities.reduce((a, b) => a + b, 0) / densities.length;

  for (let i = 2; i < densities.length - 2; i++) {
    const current = densities[i];

    // Check if this is a local maximum
    const isLocalMax =
      current > densities[i - 1] &&
      current > densities[i - 2] &&
      current > densities[i + 1] &&
      current > densities[i + 2];

    // Check if it exceeds threshold
    const exceedsThreshold = current > avgDensity * threshold;

    if (isLocalMax && exceedsThreshold) {
      // Check distance from other maxima
      const tooClose = maxima.some((m) => {
        const dx = points[m].x - points[i].x;
        const dy = points[m].y - points[i].y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });

      if (!tooClose) {
        maxima.push(i);
      }
    }
  }

  return maxima;
}

/**
 * Finds local minima (density valleys) that indicate smooth curve sections.
 */
function findLocalMinima(
  _points: Point[],
  densities: number[],
  threshold: number
): number[] {
  const minima: number[] = [];
  const avgDensity = densities.reduce((a, b) => a + b, 0) / densities.length;

  for (let i = 2; i < densities.length - 2; i++) {
    const current = densities[i];

    // Check if this is a local minimum
    const isLocalMin =
      current < densities[i - 1] &&
      current < densities[i - 2] &&
      current < densities[i + 1] &&
      current < densities[i + 2];

    // Check if it's below threshold
    const belowThreshold = current < avgDensity * threshold;

    if (isLocalMin && belowThreshold) {
      minima.push(i);
    }
  }

  return minima;
}

/**
 * Checks if a point has high density (crowded area).
 */
export function isHighDensityPoint(
  density: PointDensity,
  index: number,
  threshold: number = 0.7
): boolean {
  if (index < 0 || index >= density.normalizedDensities.length) return false;
  return density.normalizedDensities[index] > threshold;
}

/**
 * Checks if a point is a density local maximum (likely corner).
 */
export function isDensityMaximum(
  density: PointDensity,
  index: number,
  windowSize: number = 3
): boolean {
  if (index < windowSize || index >= density.densities.length - windowSize) {
    return false;
  }

  const current = density.densities[index];
  for (let i = 1; i <= windowSize; i++) {
    if (current <= density.densities[index - i] || current <= density.densities[index + i]) {
      return false;
    }
  }

  return true;
}

/**
 * Gets the density score for a point (0-1, higher = more crowded).
 */
export function getDensityScore(density: PointDensity, index: number): number {
  if (index < 0 || index >= density.normalizedDensities.length) return 0;
  return density.normalizedDensities[index];
}

/**
 * Finds segments between density minima (smooth curve sections).
 */
export function findSmoothSegments(
  points: Point[],
  density: PointDensity,
  minSegmentLength: number = 20
): Array<{ start: number; end: number; avgDensity: number }> {
  const segments: Array<{ start: number; end: number; avgDensity: number }> = [];

  // Always include start point as a boundary
  const boundaries = [0, ...density.localMinima, points.length - 1];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];

    // Calculate actual distance
    let distance = 0;
    for (let j = start + 1; j <= end; j++) {
      const dx = points[j].x - points[j - 1].x;
      const dy = points[j].y - points[j - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }

    if (distance >= minSegmentLength) {
      const segmentDensities = density.densities.slice(start, end + 1);
      const avgDensity =
        segmentDensities.reduce((a, b) => a + b, 0) / segmentDensities.length;

      segments.push({ start, end, avgDensity });
    }
  }

  return segments;
}
