import type { SmoothedPoint } from './physicsSmoothing';
import type { BrushSettings } from './presets';
import { BRUSH_PRESETS, type BrushType } from './presets';

export interface Stamp {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

export interface StampRenderData {
  stamps: Stamp[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export class StampRenderer {
  private brushSettings: BrushSettings;

  constructor(brushType: BrushType = 'pencil') {
    this.brushSettings = BRUSH_PRESETS[brushType];
  }

  setBrushType(type: BrushType): void {
    this.brushSettings = BRUSH_PRESETS[type];
  }

  setBrushSettings(settings: Partial<BrushSettings>): void {
    this.brushSettings = { ...this.brushSettings, ...settings };
  }

  render(
    points: SmoothedPoint[],
    velocityMultiplier: number = 1
  ): StampRenderData {
    if (points.length < 2) {
      return {
        stamps: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      };
    }

    const stamps: Stamp[] = [];
    const { size, opacity, spacing, curvatureAdaptation } = this.brushSettings;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      if (segmentLength < 0.01) continue;

      const stampSpacing = size * spacing;
      const numStamps = Math.max(1, Math.ceil(segmentLength / stampSpacing));

      let curvatureFactor = 1;
      if (curvatureAdaptation && i > 0 && i < points.length - 1) {
        const prev = points[i - 1];
        const next = points[i + 1];

        const angle1 = Math.atan2(p1.y - prev.y, p1.x - prev.x);
        const angle2 = Math.atan2(next.y - p1.y, next.x - p1.x);
        let angleDiff = Math.abs(angle2 - angle1);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        const angularRate = angleDiff * 25;
        curvatureFactor = Math.max(0.5, 1 - angularRate * 0.1);
      }

      const avgVelocity = (p1.velocity + p2.velocity) / 2;
      const velocityFactor = Math.min(1.5, Math.max(0.5, avgVelocity * velocityMultiplier));

      const baseRadius = size * curvatureFactor * velocityFactor;

      for (let j = 0; j <= numStamps; j++) {
        const t = j / numStamps;
        const x = p1.x + dx * t;
        const y = p1.y + dy * t;

        minX = Math.min(minX, x - baseRadius);
        minY = Math.min(minY, y - baseRadius);
        maxX = Math.max(maxX, x + baseRadius);
        maxY = Math.max(maxY, y + baseRadius);

        stamps.push({
          x,
          y,
          radius: baseRadius,
          opacity,
        });
      }
    }

    return {
      stamps,
      bounds: { minX, minY, maxX, maxY },
    };
  }

  getBrushSettings(): BrushSettings {
    return this.brushSettings;
  }
}
