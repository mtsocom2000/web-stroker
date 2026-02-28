import type { Point, LengthUnit, AngleUnit } from './types';

export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle);
}

export function pixelsToUnit(pixels: number, _unit: LengthUnit, pixelsPerUnit: number): number {
  return pixels / pixelsPerUnit;
}

export function unitToPixels(units: number, pixelsPerUnit: number): number {
  return units * pixelsPerUnit;
}

export function formatLength(value: number, unit?: LengthUnit): string {
  if (!unit) {
    if (value < 1) {
      return value.toFixed(2);
    }
    if (value < 10) {
      return value.toFixed(1);
    }
    return `${Math.round(value)}`;
  }

  if (unit === 'px') {
    return `${Math.round(value)}px`;
  }

  if (value < 1) {
    return `${value.toFixed(2)}${unit}`;
  }

  if (value < 10) {
    return `${value.toFixed(1)}${unit}`;
  }

  return `${Math.round(value)}${unit}`;
}

export function formatAngle(value: number, unit: AngleUnit): string {
  if (unit === 'radian') {
    return `${value.toFixed(2)}rad`;
  }

  const degrees = (value * 180) / Math.PI;
  return `${degrees.toFixed(1)}°`;
}

export function getAcuteAngle(angle: number): number {
  return Math.min(angle, Math.PI - angle);
}

export function snapToGrid(
  point: Point,
  gridSize: number,
  threshold: number
): Point | null {
  const snappedX = Math.round(point.x / gridSize) * gridSize;
  const snappedY = Math.round(point.y / gridSize) * gridSize;

  const dx = point.x - snappedX;
  const dy = point.y - snappedY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= threshold) {
    return { x: snappedX, y: snappedY };
  }

  return null;
}

export interface MeasurementResult {
  value: number;
  formatted: string;
}

export function measureDistance(
  start: Point,
  end: Point,
  unit: LengthUnit,
  pixelsPerUnit: number
): MeasurementResult {
  const px = distance(start, end);
  const value = pixelsToUnit(px, unit, pixelsPerUnit);
  return { value, formatted: formatLength(value, unit) };
}

export function measureAngle(
  _line1Start: Point,
  vertex: Point,
  line1End: Point,
  line2End: Point,
  unit: AngleUnit
): MeasurementResult {
  const angle = angleBetween(line1End, vertex, line2End);
  const acuteAngle = getAcuteAngle(angle);
  const formatted = formatAngle(acuteAngle, unit);
  return { value: acuteAngle, formatted };
}

export function measureRadius(
  center: Point,
  edgePoint: Point,
  unit: LengthUnit,
  pixelsPerUnit: number
): MeasurementResult {
  const px = distance(center, edgePoint);
  const value = pixelsToUnit(px, unit, pixelsPerUnit);
  return { value, formatted: formatLength(value, unit) };
}
