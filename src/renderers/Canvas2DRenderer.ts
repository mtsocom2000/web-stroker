import type { Point, Stroke } from '../types';
import type { Renderer } from './Renderer';

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Canvas2D implementation of Renderer
 * Uses HTML5 Canvas API for drawing
 */
export class Canvas2DRenderer implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLElement | null = null;
  private viewState: ViewState = { zoom: 1, panX: 0, panY: 0 };
  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;

  initialize(container: HTMLElement): void {
    this.container = container;
    this.dpr = window.devicePixelRatio || 1;
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    container.appendChild(this.canvas);
    this.resize();
  }

  dispose(): void {
    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
      this.container = null;
    }
  }

  resize(): void {
    if (!this.canvas || !this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    
    // Reset transform and scale for DPR
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
    }
  }

  render(): void {
    // Canvas 2D renders immediately on each draw call
    // No explicit render needed
  }

  setViewState(zoom: number, panX: number, panY: number): void {
    this.viewState = { zoom, panX, panY };
  }

  worldToScreen(point: Point): { x: number; y: number } {
    return {
      x: (point.x - this.viewState.panX) * this.viewState.zoom + this.width / 2,
      y: this.height / 2 - (point.y - this.viewState.panY) * this.viewState.zoom
    };
  }

  screenToWorld(x: number, y: number): Point {
    return {
      x: (x - this.width / 2) / this.viewState.zoom + this.viewState.panX,
      y: (this.height / 2 - y) / this.viewState.zoom + this.viewState.panY
    };
  }

  // Artistic strokes - Canvas2D renders immediately
  addStroke(_stroke: Stroke): void {
    // Canvas2D renders strokes directly in render loop
    // No persistent storage needed
  }

  removeStroke(_strokeId: string): void {
    // Canvas2D clears and redraws each frame
  }

  clearStrokes(): void {
    // Canvas2D clears canvas each frame
  }

  updateCurrentStroke(_points: Point[], _color: string, _thickness: number, _opacity: number): void {
    // Canvas2D renders current stroke in each frame
  }

  finalizeCurrentStroke(_strokeId: string): void {
    // Canvas2D just continues rendering
  }

  // Digital elements
  addDigitalStroke(_stroke: Stroke): void {
    // Canvas2D renders digital strokes directly
  }

  removeDigitalStroke(_strokeId: string): void {
    // Canvas2D clears and redraws
  }

  clearDigitalElements(): void {
    // Canvas2D clears canvas
  }

  // Digital previews
  updateDigitalLinePreview(start: Point, end: Point, color: string, thickness: number): void {
    if (!this.ctx) return;
    
    const p1 = this.worldToScreen(start);
    const p2 = this.worldToScreen(end);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.setLineDash([6, 4]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  updateDigitalPolylinePreview(points: Point[], previewEnd: Point | null, color: string, thickness: number): void {
    if (!this.ctx || points.length < 1) return;
    
    // Draw completed segments
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = this.worldToScreen(points[i]);
      const p2 = this.worldToScreen(points[i + 1]);
      
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = thickness;
      this.ctx.stroke();
    }
    
    // Draw preview line
    if (previewEnd && points.length > 0) {
      const last = this.worldToScreen(points[points.length - 1]);
      const end = this.worldToScreen(previewEnd);
      
      this.ctx.beginPath();
      this.ctx.moveTo(last.x, last.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = thickness;
      this.ctx.setLineDash([6, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  updateDigitalCirclePreview(center: Point, radius: number, color: string, thickness: number): void {
    if (!this.ctx) return;
    
    const c = this.worldToScreen(center);
    const r = Math.abs(radius * this.viewState.zoom);
    
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.stroke();
  }

  updateDigitalArcPreview(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    color: string,
    thickness: number
  ): void {
    if (!this.ctx) return;
    
    const c = this.worldToScreen(center);
    const r = Math.abs(radius * this.viewState.zoom);
    
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, r, -endAngle, -startAngle);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.stroke();
  }

  updateDigitalBezierPreview(points: Point[], color: string, thickness: number): void {
    if (!this.ctx || points.length < 4) return;
    
    this.ctx.beginPath();
    const p0 = this.worldToScreen(points[0]);
    this.ctx.moveTo(p0.x, p0.y);
    
    // Draw bezier curve
    for (let i = 1; i < points.length - 2; i += 3) {
      const p1 = this.worldToScreen(points[i]);
      const p2 = this.worldToScreen(points[i + 1]);
      const p3 = this.worldToScreen(points[i + 2]);
      this.ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.stroke();
  }

  clearDigitalPreviews(): void {
    // Canvas2D clears entire canvas each frame
  }

  // Selection indicators
  drawSelectionIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const p = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  drawHoverIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const p = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  clearIndicators(): void {
    // Canvas2D clears entire canvas each frame
  }

  // Selection/highlight rendering for digital elements
  highlightDigitalLine(points: Point[], color: string, thickness: number, isHovered: boolean, isSelected: boolean): void {
    if (!this.ctx || points.length < 2) return;
    
    const p1 = this.worldToScreen(points[0]);
    const p2 = this.worldToScreen(points[1]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = isHovered || isSelected ? 2 : thickness;
    
    if (isSelected) {
      this.ctx.setLineDash([4, 4]);
    }
    
    if (isHovered) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 4;
    }
    
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.shadowBlur = 0;
  }

  highlightDigitalArc(
    arcData: { center: Point; radius: number; startAngle: number; endAngle: number },
    color: string,
    thickness: number,
    isHovered: boolean,
    isSelected: boolean
  ): void {
    if (!this.ctx) return;
    
    const center = this.worldToScreen(arcData.center);
    const radius = Math.abs(arcData.radius * this.viewState.zoom);
    const startAngleScreen = -arcData.startAngle;
    const endAngleScreen = -arcData.endAngle;
    const sweep = endAngleScreen - startAngleScreen;
    const fullCircle = Math.abs(sweep) >= Math.PI * 2 - 1e-3;
    const anticlockwise = sweep < 0;
    const endAngle = fullCircle ? startAngleScreen + Math.PI * 2 : endAngleScreen;
    
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, startAngleScreen, endAngle, anticlockwise);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = isHovered || isSelected ? 2 : thickness;
    
    if (isSelected) {
      this.ctx.setLineDash([4, 4]);
    }
    
    if (isHovered) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 4;
    }
    
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.shadowBlur = 0;
  }

  highlightDigitalBezier(points: Point[], color: string, thickness: number, isHovered: boolean, isSelected: boolean): void {
    if (!this.ctx || points.length < 4) return;
    
    const p0 = this.worldToScreen(points[0]);
    const p1 = this.worldToScreen(points[1]);
    const p2 = this.worldToScreen(points[2]);
    const p3 = this.worldToScreen(points[3]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p0.x, p0.y);
    this.ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = isHovered || isSelected ? 2 : thickness;
    
    if (isSelected) {
      this.ctx.setLineDash([4, 4]);
    }
    
    if (isHovered) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 4;
    }
    
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.shadowBlur = 0;
    
    // Draw control lines when hovered or selected
    if (isHovered || isSelected) {
      this.ctx.beginPath();
      this.ctx.moveTo(p0.x, p0.y);
      this.ctx.lineTo(p1.x, p1.y);
      this.ctx.moveTo(p2.x, p2.y);
      this.ctx.lineTo(p3.x, p3.y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 0.5;
      this.ctx.setLineDash([2, 2]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  drawEndpointIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const p = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawControlPointIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const p = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawCrossIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const p = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p.x - size, p.y - size);
    this.ctx.lineTo(p.x + size, p.y + size);
    this.ctx.moveTo(p.x + size, p.y - size);
    this.ctx.lineTo(p.x - size, p.y + size);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw a small circle in the center
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  clearHighlights(): void {
    // Canvas2D clears entire canvas each frame
  }

  // Additional methods for Canvas2D
  clearCanvas(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
