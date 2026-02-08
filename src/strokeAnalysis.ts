import type { Point } from './types';

export interface EnhancedPoint extends Point {
  x: number;
  y: number;
  timestamp: number;
  velocity: number;
  spacing: number;
  direction: number; // Angle in radians
}

export interface StrokeAnalysis {
  points: EnhancedPoint[];
  corners: number[]; // Indices of corner points
  segments: number[][]; // Indices of points per segment
  isMultiline: boolean;
  averageVelocity: number;
  velocityVariation: number;
}

/**
 * Enhanced point collection that tracks temporal dynamics during drawing.
 * This enables corner detection from velocity changes and spacing analysis.
 */
export class DynamicStrokeAnalyzer {
  private points: EnhancedPoint[] = [];
  private lastTimestamp: number = 0;
  private lastPoint: Point | null = null;

  private readonly velocityThreshold = 0.8; // Velocity drop threshold for corner detection
  private readonly spacingThreshold = 2.0; // Max spacing for straight segment
  private readonly directionChangeThreshold = Math.PI * 0.3; // 54 degrees

  addPoint(point: Point): void {
    const now = Date.now();
    let velocity = 0;
    let spacing = 0;
    let direction = 0;

    if (this.lastPoint && this.lastTimestamp > 0) {
      const dt = Math.max(now - this.lastTimestamp, 1); // Prevent division by zero
      const dx = point.x - this.lastPoint.x;
      const dy = point.y - this.lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      velocity = distance / dt * 100; // Convert to "units per 100ms"
      spacing = distance;
      direction = Math.atan2(dy, dx);
    }

    const enhancedPoint: EnhancedPoint = {
      ...point,
      timestamp: now,
      velocity,
      spacing,
      direction
    };

    this.points.push(enhancedPoint);
    this.lastPoint = point;
    this.lastTimestamp = now;
  }

  /**
   * Analyze the collected stroke to detect corners and segments.
   */
  analyze(): StrokeAnalysis {
    if (this.points.length < 3) {
      return {
        points: this.points,
        corners: [],
        segments: [this.points.map((_, i) => i)],
        isMultiline: false,
        averageVelocity: 0,
        velocityVariation: 0
      };
    }

    const corners = this.detectCorners();
    const segments = this.segmentizeByCorners(corners);
    const velocities = this.points.map(p => p.velocity);
    const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const velocityVariance = velocities.reduce((sum, v) => sum + Math.pow(v - averageVelocity, 2), 0) / velocities.length;

    return {
      points: this.points,
      corners,
      segments,
      isMultiline: corners.length > 0,
      averageVelocity,
      velocityVariation: Math.sqrt(velocityVariance)
    };
  }

  /**
   * Detect corners based on velocity drops and direction changes.
   */
  private detectCorners(): number[] {
    const corners: number[] = [];
    
    for (let i = 1; i < this.points.length - 1; i++) {
      const prev = this.points[i - 1];
      const curr = this.points[i];
      const next = this.points[i + 1];
      
      if (!next) continue;

      // Check for velocity drop (indicates corner)
      const velocityDrop = prev.velocity - curr.velocity;
      const isVelocityCorner = velocityDrop > this.velocityThreshold && 
                            curr.velocity < this.velocityThreshold;

      // Check for direction change
      const angle1 = prev.direction;
      const angle2 = curr.direction;
      const angle3 = next.direction;
      const directionChange1 = this.angleDifference(angle1, angle2);
      const directionChange2 = this.angleDifference(angle2, angle3);
      const isDirectionCorner = directionChange1 > this.directionChangeThreshold || 
                              directionChange2 > this.directionChangeThreshold;

      // Check for spacing anomaly (indicates new segment)
      const isSpacingCorner = curr.spacing > this.spacingThreshold;

      // Corner detected if multiple indicators align
      if ((isVelocityCorner && isDirectionCorner) || 
          (isDirectionCorner && isSpacingCorner) ||
          (isVelocityCorner && isSpacingCorner)) {
        corners.push(i);
      }
    }

    return corners;
  }

  /**
   * Segmentize the stroke into straight line segments based on detected corners.
   */
  private segmentizeByCorners(corners: number[]): number[][] {
    if (corners.length === 0) {
      return [this.points.map((_, i) => i)];
    }

    const segments: number[][] = [];
    let segmentStart = 0;

    for (const cornerIndex of corners) {
      const segment = this.points.slice(segmentStart, cornerIndex + 1);
      if (segment.length > 1) {
        segments.push(this.points.map((_, i) => segmentStart + i));
      }
      segmentStart = cornerIndex;
    }

    // Add final segment from last corner to end
    if (segmentStart < this.points.length - 1) {
      segments.push(this.points.map((_, i) => segmentStart + i));
    }

    return segments;
  }

  /**
   * Calculate the difference between two angles, normalized to [-π, π].
   */
  private angleDifference(angle1: number, angle2: number): number {
    let diff = angle2 - angle1;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    return Math.abs(diff);
  }

  /**
   * Reset the analyzer for a new stroke.
   */
  reset(): void {
    this.points = [];
    this.lastTimestamp = 0;
    this.lastPoint = null;
  }

  /**
   * Convert enhanced points back to regular points for compatibility.
   */
  toRegularPoints(points: EnhancedPoint[]): Point[] {
    return points.map(p => ({ x: p.x, y: p.y }));
  }
}