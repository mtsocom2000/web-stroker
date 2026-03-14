import type { Point } from '../types';

export interface MouseDynamics {
  velocities: number[];
  accelerations: number[];
  directions: number[];
  directionChanges: number[];
  speedPatterns: SpeedPattern[];
  avgVelocity: number;
  avgAcceleration: number;
  maxVelocity: number;
  minVelocity: number;
}

export type SpeedPattern =
  | 'constant'
  | 'accelerating'
  | 'decelerating'
  | 'mixed'
  | 'slow-corner'
  | 'unknown';

export interface DynamicsOptions {
  minTimeDelta: number;
  smoothingWindow: number;
}

export const DEFAULT_DYNAMICS_OPTIONS: DynamicsOptions = {
  minTimeDelta: 1,
  smoothingWindow: 3,
};

/**
 * Analyzes mouse movement dynamics for a stroke.
 * Extracts velocity, acceleration, direction, and speed patterns.
 */
export function analyzeMouseDynamics(
  points: Point[],
  options: Partial<DynamicsOptions> = {}
): MouseDynamics {
  const opts = { ...DEFAULT_DYNAMICS_OPTIONS, ...options };

  if (points.length < 2) {
    return {
      velocities: [0],
      accelerations: [0],
      directions: [0],
      directionChanges: [0],
      speedPatterns: ['unknown'],
      avgVelocity: 0,
      avgAcceleration: 0,
      maxVelocity: 0,
      minVelocity: 0,
    };
  }

  // Calculate velocities and directions
  const velocities: number[] = [0];
  const directions: number[] = [0];

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let timeDelta = opts.minTimeDelta;
    const currentTimestamp = points[i].timestamp ?? 0;
    const prevTimestamp = points[i - 1].timestamp ?? 0;
    if (currentTimestamp > 0 && prevTimestamp > 0) {
      timeDelta = Math.max(opts.minTimeDelta, currentTimestamp - prevTimestamp);
    }

    const velocity = dist / timeDelta;
    const direction = Math.atan2(dy, dx);

    velocities.push(velocity);
    directions.push(direction);
  }

  // Calculate accelerations (change in velocity)
  const accelerations: number[] = [0];
  for (let i = 1; i < velocities.length; i++) {
    let timeDelta = opts.minTimeDelta;
    const currentTimestamp = points[i].timestamp ?? 0;
    const prevTimestamp = points[i - 1].timestamp ?? 0;
    if (currentTimestamp > 0 && prevTimestamp > 0) {
      timeDelta = Math.max(opts.minTimeDelta, currentTimestamp - prevTimestamp);
    }
    const accel = (velocities[i] - velocities[i - 1]) / timeDelta;
    accelerations.push(accel);
  }

  // Calculate direction changes
  const directionChanges: number[] = [0];
  for (let i = 1; i < directions.length; i++) {
    let change = Math.abs(directions[i] - directions[i - 1]);
    if (change > Math.PI) {
      change = 2 * Math.PI - change;
    }
    directionChanges.push(change);
  }

  // Analyze speed patterns for each point
  const speedPatterns = analyzeSpeedPatterns(velocities, accelerations, points.length);

  // Calculate statistics
  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const avgAcceleration = accelerations.reduce((a, b) => Math.abs(a) + Math.abs(b), 0) / accelerations.length;
  const maxVelocity = Math.max(...velocities);
  const minVelocity = Math.min(...velocities.filter((v) => v > 0));

  return {
    velocities,
    accelerations,
    directions,
    directionChanges,
    speedPatterns,
    avgVelocity,
    avgAcceleration,
    maxVelocity,
    minVelocity: minVelocity === Infinity ? 0 : minVelocity,
  };
}

/**
 * Analyzes speed patterns at each point.
 * Detects acceleration/deceleration patterns that indicate corners or smooth curves.
 */
function analyzeSpeedPatterns(
  velocities: number[],
  accelerations: number[],
  pointCount: number
): SpeedPattern[] {
  const patterns: SpeedPattern[] = [];

  for (let i = 0; i < pointCount; i++) {
    if (i === 0 || i >= velocities.length) {
      patterns.push('unknown');
      continue;
    }

    const velocity = velocities[i];
    const acceleration = accelerations[i];
    const prevVelocity = velocities[i - 1];

    // Detect slow corner pattern: speed drops significantly
    if (velocity < prevVelocity * 0.3 && velocity < 0.5) {
      patterns.push('slow-corner');
      continue;
    }

    // Detect acceleration/deceleration
    const accelThreshold = 0.1;
    if (Math.abs(acceleration) < accelThreshold) {
      patterns.push('constant');
    } else if (acceleration > accelThreshold) {
      patterns.push('accelerating');
    } else if (acceleration < -accelThreshold) {
      patterns.push('decelerating');
    } else {
      patterns.push('mixed');
    }
  }

  return patterns;
}

/**
 * Detects if a segment has consistent speed (indicating smooth curve or straight line).
 */
export function hasConsistentSpeed(
  dynamics: MouseDynamics,
  startIndex: number,
  endIndex: number,
  threshold: number = 0.3
): boolean {
  const velocities = dynamics.velocities.slice(startIndex, endIndex + 1);
  if (velocities.length < 2) return true;

  const avg = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const max = Math.max(...velocities);
  const min = Math.min(...velocities);

  if (avg === 0) return true;
  const variation = (max - min) / avg;
  return variation < threshold;
}

/**
 * Detects if a point is a corner based on speed change pattern.
 * Corners typically show: fast → slow → fast pattern
 */
export function isCornerBySpeedPattern(
  dynamics: MouseDynamics,
  index: number,
  windowSize: number = 3
): boolean {
  if (index < windowSize || index >= dynamics.velocities.length - windowSize) {
    return false;
  }

  // Check for deceleration followed by acceleration
  const beforeVelocities = dynamics.velocities.slice(index - windowSize, index);
  const afterVelocities = dynamics.velocities.slice(index, index + windowSize);

  const beforeAvg = beforeVelocities.reduce((a, b) => a + b, 0) / beforeVelocities.length;
  const afterAvg = afterVelocities.reduce((a, b) => a + b, 0) / afterVelocities.length;
  const currentVelocity = dynamics.velocities[index];

  // Corner pattern: speed before > current < speed after (with minimum ratios)
  const isSlowPoint = currentVelocity < beforeAvg * 0.5 && currentVelocity < afterAvg * 0.5;
  const hasRecovery = afterAvg > currentVelocity * 1.5;

  return isSlowPoint && hasRecovery;
}

/**
 * Gets speed pattern for a segment.
 */
export function getSegmentSpeedPattern(
  dynamics: MouseDynamics,
  startIndex: number,
  endIndex: number
): SpeedPattern {
  const patterns = dynamics.speedPatterns.slice(startIndex, endIndex + 1);
  if (patterns.length === 0) return 'unknown';

  // Count pattern occurrences
  const counts: Record<SpeedPattern, number> = {
    constant: 0,
    accelerating: 0,
    decelerating: 0,
    mixed: 0,
    'slow-corner': 0,
    unknown: 0,
  };

  for (const pattern of patterns) {
    counts[pattern]++;
  }

  // Return most common pattern
  let maxCount = 0;
  let dominantPattern: SpeedPattern = 'unknown';
  for (const [pattern, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantPattern = pattern as SpeedPattern;
    }
  }

  return dominantPattern;
}
