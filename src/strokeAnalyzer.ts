import type { Point } from './types';

export interface MovementPoint extends Point {
  x: number;
  y: number;
  timestamp: number;
  velocity: number;
  acceleration: number;
  direction: number; // Angle in radians
}

export interface StrokeSegment {
  startIndex: number;
  endIndex: number;
  startPoint: Point;
  endPoint: Point;
  isStraight: boolean;
  length: number;
  averageVelocity: number;
}

export interface DynamicStrokeAnalysis {
  points: MovementPoint[];
  segments: StrokeSegment[];
  corners: number[];
  isMultiline: boolean;
  averageVelocity: number;
  velocityVariation: number;
  directionChanges: number;
}

/**
 * Advanced stroke analyzer that detects corners, segments, and direction changes
 * based on mouse movement dynamics, velocity, and direction analysis.
 */
export class AdvancedStrokeAnalyzer {
  private points: MovementPoint[] = [];
  private lastPoint: MovementPoint | null = null;
  private readonly VELOCITY_DROP_THRESHOLD = 0.4; // 40% velocity drop indicates corner
  private readonly DIRECTION_CHANGE_THRESHOLD = Math.PI * 0.5; // 90 degrees indicates corner
  private readonly SPACING_ANOMALY_FACTOR = 2.5; // Points spaced > 2.5x average indicate new segment
  private readonly MIN_STRAIGHTNESS_RATIO = 0.95; // 95% of points must be collinear for straight line
  private readonly CORNER_DETECTION_WINDOW = 3; // Look at 3 points before/after each point

  addPoint(x: number, y: number): void {
    const now = Date.now();
    let velocity = 0;
    let acceleration = 0;
    let direction = 0;

    if (this.lastPoint) {
      const dt = Math.max(now - this.lastPoint.timestamp, 16); // 16ms minimum (60fps)
      if (dt > 0) {
        const dx = x - this.lastPoint.x;
        const dy = y - this.lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const newVelocity = distance / dt * 1000; // Convert to units/second
        acceleration = (newVelocity - this.lastPoint.velocity) / dt * 1000;
        direction = Math.atan2(dy, dx);
        velocity = newVelocity;
      }
    }

    const point: MovementPoint = {
      x,
      y,
      timestamp: now,
      velocity,
      acceleration,
      direction
    };

    this.points.push(point);
    this.lastPoint = point;
  }

  /**
   * Analyze the collected stroke to detect corners, segments, and direction changes.
   */
  analyze(): DynamicStrokeAnalysis {
    if (this.points.length < 3) {
      return this.createEmptyAnalysis();
    }

    // Detect corners using velocity and direction changes
    const corners = this.detectDynamicCorners();
    
    // Segmentize based on corners
    const segments = this.createSegments(corners);
    
    // Calculate movement statistics
    const velocities = this.points.map(p => p.velocity);
    const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const velocityVariance = velocities.reduce((sum, v) => sum + Math.pow(v - averageVelocity, 2), 0) / velocities.length;
    const velocityStdDev = Math.sqrt(velocityVariance);
    
    // Count significant direction changes
    const directionChanges = this.countDirectionChanges();

    return {
      points: this.points,
      corners,
      segments,
      isMultiline: corners.length > 0,
      averageVelocity,
      velocityVariation: velocityStdDev,
      directionChanges
    };
  }

  /**
   * Reset analyzer for new stroke.
   */
  reset(): void {
    this.points = [];
    this.lastPoint = null;
  }

  /**
   * Convert to regular Point array for compatibility.
   */
  toRegularPoints(movementPoints: MovementPoint[]): Point[] {
    return movementPoints.map(p => ({ x: p.x, y: p.y }));
  }

  /**
   * Detect corners using velocity drops and direction changes.
   */
  private detectDynamicCorners(): number[] {
    const corners: number[] = [];
    
    for (let i = this.CORNER_DETECTION_WINDOW; i < this.points.length - this.CORNER_DETECTION_WINDOW; i++) {
      const center = this.points[i];
      const window = this.points.slice(i - this.CORNER_DETECTION_WINDOW, i + this.CORNER_DETECTION_WINDOW + 1);
      
      if (this.isCornerAtPoint(center, window)) {
        corners.push(i);
      }
    }
    
    return corners;
  }

  /**
   * Check if a point is a corner based on local window analysis.
   */
  private isCornerAtPoint(point: MovementPoint, window: MovementPoint[]): boolean {
    // Check for significant velocity drop (indicates stopping/pausing)
    const velocityDrop = this.detectVelocityDrop(window);
    const isVelocityCorner = velocityDrop > this.VELOCITY_DROP_THRESHOLD;
    
    // Check for significant direction change
    const directionChange = this.detectDirectionChange(window);
    const isDirectionCorner = directionChange > this.DIRECTION_CHANGE_THRESHOLD;
    
    // Check for spacing anomaly (gap in drawing)
    const spacingAnomaly = this.detectSpacingAnomaly(window);
    const isSpacingCorner = spacingAnomaly > this.SPACING_ANOMALY_FACTOR;
    
    // Corner detected if multiple indicators align
    return (isVelocityCorner && isDirectionCorner) || 
           (isVelocityCorner && isSpacingCorner) ||
           (isDirectionCorner && isSpacingCorner);
  }

  /**
   * Detect significant velocity drop in a window of points.
   */
  private detectVelocityDrop(window: MovementPoint[]): number {
    let maxVelocity = 0;
    let minVelocity = Infinity;
    
    for (const point of window) {
      maxVelocity = Math.max(maxVelocity, point.velocity);
      minVelocity = Math.min(minVelocity, point.velocity);
    }
    
    return maxVelocity > 0 ? (maxVelocity - minVelocity) / maxVelocity : 0;
  }

  /**
   * Detect significant direction change in a window of points.
   */
  private detectDirectionChange(window: MovementPoint[]): number {
    if (window.length < 3) return 0;
    
    let maxDirectionChange = 0;
    for (let i = 1; i < window.length; i++) {
      const angle1 = window[i - 1].direction;
      const angle2 = window[i].direction;
      const angleDiff = Math.abs(angle2 - angle1);
      
      maxDirectionChange = Math.max(maxDirectionChange, angleDiff);
    }
    
    return maxDirectionChange;
  }

  /**
   * Detect spacing anomalies (gaps) in the drawing.
   */
  private detectSpacingAnomaly(window: MovementPoint[]): number {
    if (window.length < 3) return 0;
    
    const distances: number[] = [];
    for (let i = 1; i < window.length; i++) {
      const dx = window[i].x - window[i - 1].x;
      const dy = window[i].y - window[i - 1].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      distances.push(distance);
    }
    
    const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const maxDistance = Math.max(...distances);
    
    return maxDistance / (averageDistance + 0.1); // Avoid division by zero
  }

  /**
   * Create segments based on detected corners.
   */
  private createSegments(corners: number[]): StrokeSegment[] {
    const segments: StrokeSegment[] = [];
    
    if (corners.length === 0) {
      // Single segment from all points
      const startPoint = this.points[0] || { x: 0, y: 0, timestamp: 0, velocity: 0, acceleration: 0, direction: 0 };
      const endPoint = this.points[this.points.length - 1] || startPoint;
      
      const isStraight = this.checkSegmentStraightness(this.points);
      const length = this.calculateSegmentLength(startPoint, endPoint);
      const velocities = this.points.map(p => p.velocity);
      const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
      
      segments.push({
        startIndex: 0,
        endIndex: this.points.length - 1,
        startPoint,
        endPoint,
        isStraight,
        length,
        averageVelocity
      });
    } else {
      // Multiple segments based on corners
      let segmentStart = 0;
      
      for (let i = 0; i <= corners.length; i++) {
        const cornerIndex = i < corners.length ? corners[i] : this.points.length - 1;
        const segmentPoints = this.points.slice(segmentStart, cornerIndex + 1);
        
        if (segmentPoints.length > 1) {
          const startPoint = segmentPoints[0] || this.points[0];
          const endPoint = segmentPoints[segmentPoints.length - 1] || this.points[this.points.length - 1];
          
          const isStraight = this.checkSegmentStraightness(segmentPoints);
          const length = this.calculateSegmentLength(startPoint, endPoint);
          const velocities = segmentPoints.map(p => p.velocity);
          const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
          
          segments.push({
            startIndex: segmentStart,
            endIndex: cornerIndex,
            startPoint,
            endPoint,
            isStraight,
            length,
            averageVelocity
          });
        }
        
        segmentStart = cornerIndex;
      }
    }
    
    return segments;
  }

  /**
   * Check if a segment of points is reasonably straight.
   */
  private checkSegmentStraightness(points: MovementPoint[]): boolean {
    if (points.length < 3) return true;
    
    let maxDeviation = 0;
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    
    // Calculate line equation
    const lineLength = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + 
      Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    if (lineLength < 1) return true;
    
    // Check deviation of each point from the line
    for (let i = 1; i < points.length - 1; i++) {
      const deviation = this.pointToLineDistance(points[i], startPoint, endPoint);
      maxDeviation = Math.max(maxDeviation, deviation);
    }
    
    // Segment is straight if most points are close to the line
    const straightPointCount = points.filter(p => 
      this.pointToLineDistance(p, startPoint, endPoint) < lineLength * 0.05
    ).length;
    
    return straightPointCount / points.length >= this.MIN_STRAIGHTNESS_RATIO;
  }

  /**
   * Calculate distance from point to line segment.
   */
  private pointToLineDistance(point: MovementPoint, lineStart: MovementPoint, lineEnd: MovementPoint): number {
    const A = lineEnd.y - lineStart.y;
    const B = lineStart.x - lineEnd.x;
    const C = lineEnd.x * lineStart.y - lineStart.x * lineEnd.y;
    
    const denominator = Math.sqrt(A * A + B * B);
    if (denominator === 0) return 0;
    
    const distance = Math.abs(A * point.x + B * point.y + C) / denominator;
    return distance;
  }

  /**
   * Calculate segment length.
   */
  private calculateSegmentLength(startPoint: MovementPoint, endPoint: MovementPoint): number {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Count significant direction changes across the entire stroke.
   */
  private countDirectionChanges(): number {
    let directionChanges = 0;
    
    for (let i = 1; i < this.points.length; i++) {
      const prevDirection = this.points[i - 1].direction;
      const currDirection = this.points[i].direction;
      const directionChange = Math.abs(currDirection - prevDirection);
      
      if (directionChange > this.DIRECTION_CHANGE_THRESHOLD) {
        directionChanges++;
      }
    }
    
    return directionChanges;
  }

  /**
   * Create empty analysis for insufficient data.
   */
  private createEmptyAnalysis(): DynamicStrokeAnalysis {
    return {
      points: this.points,
      corners: [],
      segments: [],
      isMultiline: false,
      averageVelocity: 0,
      velocityVariation: 0,
      directionChanges: 0
    };
  }

  /**
   * Get detected multi-line segments as separate strokes.
   */
  getDetectedLineSegments(): Point[][] {
    const analysis = this.analyze();
    return analysis.segments
      .filter(segment => segment.isStraight)
      .map(segment => [segment.startPoint, segment.endPoint]);
  }
}