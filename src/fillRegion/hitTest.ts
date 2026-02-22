import type { Point } from '../types';
import type { FillRegion } from './types';

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

export function pointInBounds(point: Point, bounds: { min: Point; max: Point }): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y
  );
}

export function hitTestFillRegion(point: Point, region: FillRegion): boolean {
  if (!pointInBounds(point, region.bounds)) {
    return false;
  }

  return pointInPolygon(point, region.polygon);
}

export function hitTestAllRegions(point: Point, regions: FillRegion[]): FillRegion | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    if (hitTestFillRegion(point, regions[i])) {
      return regions[i];
    }
  }
  return null;
}

export function translatePolygon(polygon: Point[], delta: Point): Point[] {
  return polygon.map(p => ({
    x: p.x + delta.x,
    y: p.y + delta.y,
  }));
}

export function translateBounds(bounds: { min: Point; max: Point }, delta: Point): { min: Point; max: Point } {
  return {
    min: { x: bounds.min.x + delta.x, y: bounds.min.y + delta.y },
    max: { x: bounds.max.x + delta.x, y: bounds.max.y + delta.y },
  };
}
