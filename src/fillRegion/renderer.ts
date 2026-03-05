import type { ClosedArea, HighlightStyle } from './types';

export function renderHighlight(
  ctx: CanvasRenderingContext2D,
  area: ClosedArea,
  style: HighlightStyle
): void {
  const { polygon } = area;

  if (polygon.length < 3) return;

  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = style.fillColor;
  ctx.fill();

  ctx.strokeStyle = style.borderColor;
  ctx.lineWidth = style.borderWidth;
  ctx.setLineDash(style.borderDash);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderClosedAreas(
  ctx: CanvasRenderingContext2D,
  areas: ClosedArea[],
  hoveredId: string | null,
  selectedId: string | null,
  style: HighlightStyle
): void {
  for (const area of areas) {
    const isHighlighted = area.id === hoveredId || area.id === selectedId;
    if (isHighlighted) {
      renderHighlight(ctx, area, style);
    }
  }
}
