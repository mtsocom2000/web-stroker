import type { Point } from '../types';

export interface SmoothedPoint extends Point {
  velocity: number;
  timestamp: number;
}

export class PhysicsSmoother {
  smooth(points: Point[]): SmoothedPoint[] {
    if (points.length < 2) {
      return points.map((p) => ({ ...p, velocity: 0, timestamp: p.timestamp ?? Date.now() }));
    }

    const smoothed: SmoothedPoint[] = [];
    const alpha = 0.15;

    let prevX = points[0].x;
    let prevY = points[0].y;
    let velocity = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      
      const x = prevX + alpha * (p.x - prevX);
      const y = prevY + alpha * (p.y - prevY);
      
      const dx = x - prevX;
      const dy = y - prevY;
      velocity = Math.sqrt(dx * dx + dy * dy);

      smoothed.push({
        x,
        y,
        timestamp: p.timestamp ?? Date.now(),
        velocity,
      });

      prevX = x;
      prevY = y;
    }

    return smoothed;
  }
}
