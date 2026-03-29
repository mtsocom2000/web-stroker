import type { Point } from '../types';

/**
 * Canvas Drawing Utilities
 *
 * This file contains all pure drawing functions extracted from DrawingCanvas.tsx
 * These functions are stateless and only depend on their parameters.
 */

/**
 * Draw grid and axes on canvas
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number; zoom: number },
  toolCategory: string,
  pixelsPerUnit: number
): void {
  if (toolCategory !== 'digital' && toolCategory !== 'measure') {
    return;
  }

  const { x: panX, y: panY, zoom } = pan;
  const scaleInterval = 50;
  const tickLength = 10;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const visibleLeftWorld = (-halfWidth / zoom) + panX;
  const visibleRightWorld = (halfWidth / zoom) + panX;
  const visibleTopWorld = (halfHeight / zoom) + panY;
  const visibleBottomWorld = (-halfHeight / zoom) + panY;

  const startX = Math.floor(visibleLeftWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;
  const endX = Math.ceil(visibleRightWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;
  const startY = Math.floor(visibleBottomWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;
  const endY = Math.ceil(visibleTopWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;

  ctx.font = '11px sans-serif';

  const originX = (0 - panX) * zoom + halfWidth;
  const originY = halfHeight - (0 - panY) * zoom;

  const xAxisY = originY;
  const yAxisX = originX;

  for (let worldX = startX; worldX <= endX; worldX += pixelsPerUnit * scaleInterval) {
    const screenX = (worldX - panX) * zoom + halfWidth;
    const unitValue = worldX / pixelsPerUnit;

    if (screenX >= 0 && screenX <= width) {
      ctx.beginPath();
      ctx.moveTo(screenX, xAxisY - tickLength / 2);
      ctx.lineTo(screenX, xAxisY + tickLength / 2);
      ctx.strokeStyle = '#606060';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${Math.round(unitValue)}`, screenX, xAxisY + tickLength);
    }
  }

  for (let worldY = startY; worldY <= endY; worldY += pixelsPerUnit * scaleInterval) {
    const screenY = halfHeight - (worldY - panY) * zoom;
    const unitValue = worldY / pixelsPerUnit;

    if (screenY >= 0 && screenY <= height) {
      ctx.beginPath();
      ctx.moveTo(yAxisX - tickLength / 2, screenY);
      ctx.lineTo(yAxisX + tickLength / 2, screenY);
      ctx.strokeStyle = '#606060';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(unitValue)}`, yAxisX - tickLength - 4, screenY);
    }
  }

  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 2;

  if (originX >= 0 && originX <= width) {
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();
  }

  if (originY >= 0 && originY <= height) {
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
  }

  if (originX >= 6 && originX <= width - 6 && originY >= 6 && originY <= height - 6) {
    ctx.beginPath();
    ctx.arc(originX, originY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#404040';
    ctx.fill();
  }
}

/**
 * Draw artistic stroke (freehand)
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  thickness: number,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  opacity: number
): void {
  if (points.length < 2) return;

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;

  const radius = thickness / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = worldToScreen(points[i].x, points[i].y);
    const p2 = worldToScreen(points[i + 1].x, points[i + 1].y);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.5) {
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const numSteps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
    for (let j = 0; j <= numSteps; j++) {
      const t = j / numSteps;
      const x = p1.x + dx * t;
      const y = p1.y + dy * t;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const lastPoint = worldToScreen(points[points.length - 1].x, points[points.length - 1].y);
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

/**
 * Draw digital line segment
 */
export function drawDigitalLine(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  if (points.length < 2) return;

  const p1 = worldToScreen(points[0].x, points[0].y);
  const p2 = worldToScreen(points[1].x, points[1].y);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = isHovered || isSelected ? 2 : 1;

  if (isSelected) {
    ctx.setLineDash([4, 4]);
  }

  if (isHovered) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
  }

  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

/**
 * Draw digital line preview (dashed)
 */
export function drawDigitalLinePreview(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number }
): void {
  const p1 = worldToScreen(start.x, start.y);
  const p2 = worldToScreen(end.x, end.y);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw preview endpoint
  drawEndpointIndicator(ctx, p2, 4, color);
}

/**
 * Draw digital arc
 */
export function drawDigitalArc(
  ctx: CanvasRenderingContext2D,
  arcData: { center: Point; radius: number; startAngle: number; endAngle: number },
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number,
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  const center = worldToScreen(arcData.center.x, arcData.center.y);
  const radius = arcData.radius * zoom;
  const startAngleScreen = -arcData.startAngle;
  const endAngleScreen = -arcData.endAngle;
  const sweep = endAngleScreen - startAngleScreen;
  const fullCircle = Math.abs(sweep) >= Math.PI * 2 - 1e-3;
  const anticlockwise = sweep < 0;
  const endAngle = fullCircle ? startAngleScreen + Math.PI * 2 : endAngleScreen;

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, startAngleScreen, endAngle, anticlockwise);
  ctx.strokeStyle = color;
  ctx.lineWidth = isHovered || isSelected ? 2 : 1;

  if (isSelected) {
    ctx.setLineDash([4, 4]);
  }

  if (isHovered) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
  }

  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

/**
 * Draw digital arc preview (dashed)
 */
export function drawDigitalArcPreview(
  ctx: CanvasRenderingContext2D,
  arcData: { center: Point; radius: number; startAngle: number; endAngle: number },
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number
): void {
  const center = worldToScreen(arcData.center.x, arcData.center.y);
  const radius = arcData.radius * zoom;
  const startAngleScreen = -arcData.startAngle;
  const endAngleScreen = -arcData.endAngle;
  const sweep = endAngleScreen - startAngleScreen;
  const fullCircle = Math.abs(sweep) >= Math.PI * 2 - 1e-3;
  const anticlockwise = sweep < 0;
  const endAngle = fullCircle ? startAngleScreen + Math.PI * 2 : endAngleScreen;

  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, startAngleScreen, endAngle, anticlockwise);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draw digital circle preview
 */
export function drawDigitalCirclePreview(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radius: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw radius line
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(center.x + radius, center.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw center and edge points
  drawEndpointIndicator(ctx, center, 4, color);
  drawEndpointIndicator(ctx, { x: center.x + radius, y: center.y }, 4, color);
}

/**
 * Draw cubic bezier curve
 */
export function drawDigitalBezier(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  if (points.length < 4) return;

  const p0 = worldToScreen(points[0].x, points[0].y);
  const p1 = worldToScreen(points[1].x, points[1].y);
  const p2 = worldToScreen(points[2].x, points[2].y);
  const p3 = worldToScreen(points[3].x, points[3].y);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = isHovered || isSelected ? 2 : 1;

  if (isSelected) {
    ctx.setLineDash([4, 4]);
  }

  if (isHovered) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
  }

  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // Draw control lines (only when hovered)
  if (isHovered || isSelected) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Draw endpoint indicator (small circle)
 */
export function drawEndpointIndicator(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  size: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draw control point indicator (square)
 */
export function drawControlPointIndicator(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(point.x - size, point.y - size, size * 2, size * 2);
}

/**
 * Draw cross indicator (for intersections)
 */
export function drawCrossIndicator(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  size: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(point.x - size, point.y - size);
  ctx.lineTo(point.x + size, point.y + size);
  ctx.moveTo(point.x + size, point.y - size);
  ctx.lineTo(point.x - size, point.y + size);
  ctx.stroke();
}

/**
 * Normalize angle to [0, 2π)
 */
export function normalizeAnglePositive(angle: number): number {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized < 0) normalized += twoPi;
  return normalized;
}

/**
 * Check if angle is within arc
 */
export function isAngleWithinArc(startAngle: number, endAngle: number, testAngle: number): boolean {
  const twoPi = Math.PI * 2;
  const sweep = endAngle - startAngle;
  if (Math.abs(sweep) >= twoPi - 1e-3) return true;

  const start = normalizeAnglePositive(startAngle);
  const end = normalizeAnglePositive(endAngle);
  const test = normalizeAnglePositive(testAngle);
  const anticlockwise = sweep < 0;

  if (!anticlockwise) {
    if (end >= start) return test >= start && test <= end;
    return test >= start || test <= end;
  }

  if (start >= end) return test <= start && test >= end;
  return test <= start || test >= end;
}

/**
 * Compute arc data from three points
 */
export function computeArcDataFromThreePoints(start: Point, end: Point, mid: Point): {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
} | null {
  const D = 2 * (start.x * (end.y - mid.y) + end.x * (mid.y - start.y) + mid.x * (start.y - end.y));
  if (Math.abs(D) < 1e-6) return null;

  const startSq = start.x * start.x + start.y * start.y;
  const endSq = end.x * end.x + end.y * end.y;
  const midSq = mid.x * mid.x + mid.y * mid.y;

  const centerX = (startSq * (end.y - mid.y) + endSq * (mid.y - start.y) + midSq * (start.y - end.y)) / D;
  const centerY = (startSq * (mid.x - end.x) + endSq * (start.x - mid.x) + midSq * (end.x - start.x)) / D;
  const center = { x: centerX, y: centerY };
  const radius = Math.hypot(center.x - start.x, center.y - start.y);

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngleRaw = Math.atan2(end.y - center.y, end.x - center.x);
  const midAngle = Math.atan2(mid.y - center.y, mid.x - center.x);

  const sweepCW = normalizeAnglePositive(endAngleRaw - startAngle);
  const midSweep = normalizeAnglePositive(midAngle - startAngle);

  let endAngle = startAngle + sweepCW;
  if (midSweep > sweepCW) {
    const sweepCCW = sweepCW - Math.PI * 2;
    endAngle = startAngle + sweepCCW;
  }

  return { center, radius, startAngle, endAngle };
}
