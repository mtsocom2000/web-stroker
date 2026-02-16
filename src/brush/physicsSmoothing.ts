import type { Point } from '../types';
import type { PhysicsParams } from './presets';
import { DEFAULT_PHYSICS_PARAMS } from './presets';

export interface PhysicsState {
  position: Point;
  velocity: Point;
  acceleration: Point;
}

export interface SmoothedPoint extends Point {
  velocity: number;
  timestamp: number;
}

export class PhysicsSmoother {
  private params: PhysicsParams;
  private state: PhysicsState | null = null;

  constructor(params: Partial<PhysicsParams> = {}) {
    this.params = { ...DEFAULT_PHYSICS_PARAMS, ...params };
  }

  smooth(points: Point[]): SmoothedPoint[] {
    if (points.length < 2) {
      return points.map((p) => ({ ...p, velocity: 0, timestamp: p.timestamp ?? Date.now() }));
    }

    const smoothed: SmoothedPoint[] = [];
    const { inverseMass, dragCoefficient, interpolationSteps } = this.params;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const timestamp = p1.timestamp ?? Date.now();

      const vx = (p2.x - p1.x) / interpolationSteps;
      const vy = (p2.y - p1.y) / interpolationSteps;
      const velocity = Math.sqrt(vx * vx + vy * vy);

      for (let j = 0; j < interpolationSteps; j++) {
        const targetX = p1.x + vx * j;
        const targetY = p1.y + vy * j;

        if (this.state) {
          const ax = (targetX - this.state.position.x) * inverseMass;
          const ay = (targetY - this.state.position.y) * inverseMass;

          this.state.velocity.x = (this.state.velocity.x + ax) * dragCoefficient;
          this.state.velocity.y = (this.state.velocity.y + ay) * dragCoefficient;

          this.state.position.x += this.state.velocity.x;
          this.state.position.y += this.state.velocity.y;

          smoothed.push({
            x: this.state.position.x,
            y: this.state.position.y,
            timestamp: timestamp + j * 10,
            velocity: Math.sqrt(this.state.velocity.x ** 2 + this.state.velocity.y ** 2),
          });
        } else {
          this.state = {
            position: { x: targetX, y: targetY },
            velocity: { x: vx, y: vy },
            acceleration: { x: 0, y: 0 },
          };
          smoothed.push({
            x: targetX,
            y: targetY,
            timestamp: timestamp + j * 10,
            velocity,
          });
        }
      }
    }

    smoothed.push({
      ...points[points.length - 1],
      velocity: smoothed.length > 0 ? smoothed[smoothed.length - 1].velocity : 0,
      timestamp: points[points.length - 1].timestamp ?? Date.now(),
    });

    return smoothed;
  }

  reset(): void {
    this.state = null;
  }
}
