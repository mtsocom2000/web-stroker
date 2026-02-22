import type { FillStyle } from './types';

export function createPatternCanvas(
  style: FillStyle,
  size: number = 32
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;

  switch (style.type) {
    case 'hatch':
      drawHatch(ctx, style, size);
      break;
    case 'grid':
      drawGrid(ctx, style, size);
      break;
    case 'dots':
      drawDots(ctx, style, size);
      break;
    case 'crosshatch':
      drawCrosshatch(ctx, style, size);
      break;
  }

  return canvas;
}

function drawHatch(ctx: CanvasRenderingContext2D, style: FillStyle, size: number) {
  const angle = style.angle || Math.PI / 4;
  const spacing = style.spacing || 8;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle);
  ctx.translate(-size / 2, -size / 2);

  ctx.beginPath();
  for (let i = -size; i < size * 2; i += spacing) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i - size, size);
  }
  ctx.stroke();

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, style: FillStyle, size: number) {
  const spacing = style.spacing || 8;

  ctx.beginPath();
  for (let i = 0; i <= size; i += spacing) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
  }
  ctx.stroke();
}

function drawDots(ctx: CanvasRenderingContext2D, style: FillStyle, size: number) {
  const spacing = style.spacing || 8;
  const radius = 1.5;

  ctx.beginPath();
  for (let x = spacing / 2; x < size; x += spacing) {
    for (let y = spacing / 2; y < size; y += spacing) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

function drawCrosshatch(ctx: CanvasRenderingContext2D, style: FillStyle, size: number) {
  const angle1 = style.angle || Math.PI / 4;
  const angle2 = angle1 + Math.PI / 2;
  const spacing = style.spacing || 8;

  ctx.save();
  
  ctx.beginPath();
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle1);
  ctx.translate(-size / 2, -size / 2);
  for (let i = -size; i < size * 2; i += spacing) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i - size, size);
  }
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle2);
  ctx.translate(-size / 2, -size / 2);
  for (let i = -size; i < size * 2; i += spacing) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i - size, size);
  }
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export function getPatternColor(style: FillStyle): CanvasPattern | null {
  const canvas = createPatternCanvas(style);
  const ctx = canvas.getContext('2d')!;
  return ctx.createPattern(canvas, 'repeat');
}
