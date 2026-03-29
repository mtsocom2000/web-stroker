import type { Point, Stroke } from '../types';
import type { Renderer } from './Renderer';
import type { RenderCommand, RenderStyle } from './commands/RenderCommand';
import { worldToScreen, screenToWorld, type ViewState } from '../utils/coordinates';
import { 
  VISUAL_THEME, 
  getEndpointIndicatorStyle,
} from './RendererConfig';

/**
 * Canvas2D Rendering Options
 */
interface RenderOptions {
  antialias: boolean;
  dprAware: boolean;
}

/**
 * Canvas2D Renderer - Improved Implementation
 * 
 * Key improvements:
 * 1. Layer-based rendering for proper z-ordering
 * 2. Batch operations for performance
 * 3. Clear separation of render vs update
 * 4. Proper resource cleanup
 * 5. Support for partial redraws
 */
export class Canvas2DRenderer implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLElement | null = null;
  private viewState: ViewState = { zoom: 1, panX: 0, panY: 0 };
  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;
  
  // Stroke storage for batch rendering
  private strokes: Map<string, Stroke> = new Map();
  private needsRedraw: boolean = true;
  private renderOptions: RenderOptions = {
    antialias: true,
    dprAware: true,
  };

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
    
    this.ctx = this.canvas.getContext('2d', {
      antialias: this.renderOptions.antialias,
    }) as CanvasRenderingContext2D | null;
    
    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    container.appendChild(this.canvas);
    this.resize();
  }

  dispose(): void {
    // Clear all strokes
    this.strokes.clear();
    
    // Remove canvas from DOM
    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
    }
    
    // Nullify references
    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }

  resize(): void {
    if (!this.canvas || !this.container || !this.ctx) return;
    
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    // Set canvas size accounting for DPR
    if (this.renderOptions.dprAware) {
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
    } else {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
    
    this.needsRedraw = true;
  }

  render(): void {
    if (!this.ctx || !this.needsRedraw) return;
    
    // Clear canvas
    this.clearCanvas();
    
    // Render all strokes
    this.renderStrokes();
    
    this.needsRedraw = false;
  }

  /**
   * Request a redraw on next frame
   */
  invalidate(): void {
    this.needsRedraw = true;
  }

  private clearCanvas(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private renderStrokes(): void {
    if (!this.ctx) return;
    
    this.strokes.forEach(stroke => {
      if (stroke.strokeType === 'artistic') {
        this.renderArtisticStroke(stroke);
      } else if (stroke.strokeType === 'digital') {
        this.renderDigitalStroke(stroke);
      }
    });
  }

  private renderArtisticStroke(stroke: Stroke): void {
    if (!this.ctx) return;
    
    const points = stroke.displayPoints ?? stroke.smoothedPoints ?? stroke.points;
    if (points.length < 2) return;
    
    this.ctx.beginPath();
    
    // Convert first point to screen
    const firstScreen = this.worldToScreen(points[0]);
    this.ctx.moveTo(firstScreen.x, firstScreen.y);
    
    // Draw remaining points
    for (let i = 1; i < points.length; i++) {
      const screen = this.worldToScreen(points[i]);
      this.ctx.lineTo(screen.x, screen.y);
    }
    
    // Apply stroke style
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.thickness;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    // Apply opacity if specified
    if (stroke.brushSettings?.opacity !== undefined) {
      this.ctx.globalAlpha = stroke.brushSettings.opacity;
    }
    
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }

  private renderDigitalStroke(stroke: Stroke): void {
    if (!this.ctx || !stroke.digitalSegments) return;
    
    stroke.digitalSegments.forEach(segment => {
      switch (segment.type) {
        case 'line':
          this.renderDigitalLine(segment.points, segment.color, stroke.thickness);
          break;
        case 'arc':
          if (segment.arcData) {
            this.renderDigitalArc(
              segment.arcData.center,
              segment.arcData.radius,
              segment.arcData.startAngle,
              segment.arcData.endAngle,
              segment.color,
              stroke.thickness
            );
          }
          break;
        case 'bezier':
          this.renderDigitalBezier(segment.points, segment.color, stroke.thickness);
          break;
      }
    });
  }

  private renderDigitalLine(points: Point[], color: string, thickness: number): void {
    if (!this.ctx || points.length < 2) return;
    
    const start = this.worldToScreen(points[0]);
    const end = this.worldToScreen(points[1]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }

  private renderDigitalArc(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    color: string,
    thickness: number
  ): void {
    if (!this.ctx) return;
    
    const centerScreen = this.worldToScreen(center);
    const radiusScreen = radius * this.viewState.zoom;
    
    this.ctx.beginPath();
    this.ctx.arc(
      centerScreen.x,
      centerScreen.y,
      radiusScreen,
      -endAngle,
      -startAngle,
      false
    );
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.stroke();
  }

  private renderDigitalBezier(points: Point[], color: string, thickness: number): void {
    if (!this.ctx || points.length < 4) return;
    
    const p0 = this.worldToScreen(points[0]);
    const p1 = this.worldToScreen(points[1]);
    const p2 = this.worldToScreen(points[2]);
    const p3 = this.worldToScreen(points[3]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p0.x, p0.y);
    this.ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.stroke();
  }

  setViewState(zoom: number, panX: number, panY: number): void {
    this.viewState = { zoom, panX, panY };
    this.needsRedraw = true;
  }

  worldToScreen(point: Point): { x: number; y: number } {
    return worldToScreen(point, this.viewState, this.width, this.height);
  }

  screenToWorld(x: number, y: number): Point {
    return screenToWorld(x, y, this.viewState, this.width, this.height);
  }

  // Stroke management
  addStroke(stroke: Stroke): void {
    this.strokes.set(stroke.id, stroke);
    this.needsRedraw = true;
  }

  removeStroke(strokeId: string): void {
    this.strokes.delete(strokeId);
    this.needsRedraw = true;
  }

  clearStrokes(): void {
    this.strokes.clear();
    this.needsRedraw = true;
  }

  updateCurrentStroke(_points: Point[], _color: string, _thickness: number, _opacity: number): void {
    // Canvas2D renders current stroke inline
    this.needsRedraw = true;
  }

  finalizeCurrentStroke(_strokeId: string): void {
    // Canvas2D just continues rendering
    this.needsRedraw = true;
  }

  // Digital elements
  addDigitalStroke(stroke: Stroke): void {
    this.strokes.set(stroke.id, stroke);
    this.needsRedraw = true;
  }

  removeDigitalStroke(strokeId: string): void {
    this.strokes.delete(strokeId);
    this.needsRedraw = true;
  }

  clearDigitalElements(): void {
    // In Canvas2D, digital strokes are stored with regular strokes
    // Filter and remove only digital strokes
    this.strokes.forEach((stroke, id) => {
      if (stroke.strokeType === 'digital') {
        this.strokes.delete(id);
      }
    });
    this.needsRedraw = true;
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
    this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
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
      const preview = this.worldToScreen(previewEnd);
      
      this.ctx.beginPath();
      this.ctx.moveTo(last.x, last.y);
      this.ctx.lineTo(preview.x, preview.y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = thickness;
      this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  updateDigitalCirclePreview(center: Point, radius: number, color: string, thickness: number): void {
    if (!this.ctx) return;
    
    const centerScreen = this.worldToScreen(center);
    const radiusScreen = radius * this.viewState.zoom;
    
    this.ctx.beginPath();
    this.ctx.arc(centerScreen.x, centerScreen.y, radiusScreen, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
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
    
    const centerScreen = this.worldToScreen(center);
    const radiusScreen = radius * this.viewState.zoom;
    
    this.ctx.beginPath();
    this.ctx.arc(centerScreen.x, centerScreen.y, radiusScreen, -endAngle, -startAngle);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  updateDigitalBezierPreview(points: Point[], color: string, thickness: number): void {
    if (!this.ctx || points.length < 4) return;
    
    const p0 = this.worldToScreen(points[0]);
    const p1 = this.worldToScreen(points[1]);
    const p2 = this.worldToScreen(points[2]);
    const p3 = this.worldToScreen(points[3]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p0.x, p0.y);
    this.ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  clearDigitalPreviews(): void {
    // Previews are drawn inline, just mark for redraw
    this.needsRedraw = true;
  }

  // Highlights
  highlightDigitalLine(points: Point[], color: string, thickness: number, isHovered: boolean, isSelected: boolean): void {
    if (!this.ctx || points.length < 2) return;
    
    const start = this.worldToScreen(points[0]);
    const end = this.worldToScreen(points[1]);
    
    const highlightColor = isSelected ? VISUAL_THEME.SELECT_COLOR : isHovered ? VISUAL_THEME.HOVER_COLOR : color;
    const highlightWidth = thickness + (isSelected ? VISUAL_THEME.SELECT_WIDTH_ADD : isHovered ? VISUAL_THEME.HOVER_WIDTH_ADD : 0);
    
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.strokeStyle = highlightColor;
    this.ctx.lineWidth = highlightWidth;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }

  highlightDigitalArc(
    arcData: { center: Point; radius: number; startAngle: number; endAngle: number },
    color: string,
    thickness: number,
    isHovered: boolean,
    isSelected: boolean
  ): void {
    if (!this.ctx) return;
    
    const centerScreen = this.worldToScreen(arcData.center);
    const radiusScreen = arcData.radius * this.viewState.zoom;
    
    const highlightColor = isSelected ? VISUAL_THEME.SELECT_COLOR : isHovered ? VISUAL_THEME.HOVER_COLOR : color;
    const highlightWidth = thickness + (isSelected ? VISUAL_THEME.SELECT_WIDTH_ADD : isHovered ? VISUAL_THEME.HOVER_WIDTH_ADD : 0);
    
    this.ctx.beginPath();
    this.ctx.arc(
      centerScreen.x,
      centerScreen.y,
      radiusScreen,
      -arcData.endAngle,
      -arcData.startAngle,
      false
    );
    this.ctx.strokeStyle = highlightColor;
    this.ctx.lineWidth = highlightWidth;
    this.ctx.stroke();
  }

  highlightDigitalBezier(points: Point[], color: string, thickness: number, isHovered: boolean, isSelected: boolean): void {
    if (!this.ctx || points.length < 4) return;
    
    const p0 = this.worldToScreen(points[0]);
    const p1 = this.worldToScreen(points[1]);
    const p2 = this.worldToScreen(points[2]);
    const p3 = this.worldToScreen(points[3]);
    
    const highlightColor = isSelected ? VISUAL_THEME.SELECT_COLOR : isHovered ? VISUAL_THEME.HOVER_COLOR : color;
    const highlightWidth = thickness + (isSelected ? VISUAL_THEME.SELECT_WIDTH_ADD : isHovered ? VISUAL_THEME.HOVER_WIDTH_ADD : 0);
    
    this.ctx.beginPath();
    this.ctx.moveTo(p0.x, p0.y);
    this.ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    this.ctx.strokeStyle = highlightColor;
    this.ctx.lineWidth = highlightWidth;
    this.ctx.stroke();
  }

  drawEndpointIndicator(point: Point, color: string, _size: number): void {
    if (!this.ctx) return;
    
    const style = getEndpointIndicatorStyle(color);
    const screen = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, style.size, 0, Math.PI * 2);
    this.ctx.fillStyle = style.color;
    this.ctx.fill();
    this.ctx.strokeStyle = style.borderColor || '#ffffff';
    this.ctx.lineWidth = style.borderWidth || 1;
    this.ctx.stroke();
  }

  drawControlPointIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const screen = this.worldToScreen(point);
    const halfSize = size / 2;
    
    this.ctx.beginPath();
    this.ctx.rect(screen.x - halfSize, screen.y - halfSize, size, size);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawCrossIndicator(point: Point, color: string, size: number): void {
    if (!this.ctx) return;
    
    const screen = this.worldToScreen(point);
    const halfSize = size / 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(screen.x - halfSize, screen.y);
    this.ctx.lineTo(screen.x + halfSize, screen.y);
    this.ctx.moveTo(screen.x, screen.y - halfSize);
    this.ctx.lineTo(screen.x, screen.y + halfSize);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  clearHighlights(): void {
    // Highlights are drawn inline
    this.needsRedraw = true;
  }

  // ============================================================================
  // New Architecture - Command-based rendering
  // ============================================================================

  /**
   * Execute a batch of render commands
   * This is the primary rendering entry point for the new architecture
   */
  executeCommands(commands: RenderCommand[]): void {
    if (!this.ctx) return;

    // Clear canvas
    this.clearCanvas();

    // Sort commands by zIndex for proper layering
    const sortedCommands = [...commands].sort((a, b) => a.zIndex - b.zIndex);

    // Execute each command
    for (const command of sortedCommands) {
      this.executeCommand(command);
    }
  }

  /**
   * Execute a single render command
   */
  private executeCommand(command: RenderCommand): void {
    switch (command.type) {
      case 'stroke':
        this.renderStrokeCommand(command);
        break;
      case 'preview':
        this.renderPreviewCommand(command);
        break;
      case 'highlight':
        this.renderHighlightCommand(command);
        break;
      case 'indicator':
        this.renderIndicatorCommand(command);
        break;
      case 'label':
        this.renderLabelCommand(command);
        break;
      case 'closedArea':
        this.renderClosedAreaCommand(command);
        break;
    }
  }

  private renderStrokeCommand(command: RenderCommand): void {
    switch (command.geometry.type) {
      case 'line':
        this.drawPath(command.geometry.points, command.style);
        break;
      case 'circle':
        this.drawCirclePath(command.geometry.center, command.geometry.radius, command.style);
        break;
      case 'arc':
        this.drawArcPath(
          command.geometry.center,
          command.geometry.radius,
          command.geometry.startAngle,
          command.geometry.endAngle,
          command.style
        );
        break;
      case 'bezier':
        this.drawBezierPath(command.geometry.points, command.style);
        break;
    }
  }

  private renderPreviewCommand(command: RenderCommand): void {
    // Preview uses dashed lines
    const previewStyle: RenderStyle = {
      ...command.style,
      lineStyle: 'dashed',
    };

    switch (command.geometry.type) {
      case 'line':
        this.drawPath(command.geometry.points, previewStyle);
        break;
      case 'circle':
        this.drawCirclePath(command.geometry.center, command.geometry.radius, previewStyle);
        break;
      case 'arc':
        this.drawArcPath(
          command.geometry.center,
          command.geometry.radius,
          command.geometry.startAngle,
          command.geometry.endAngle,
          previewStyle
        );
        break;
      case 'bezier':
        this.drawBezierPath(command.geometry.points, previewStyle);
        break;
    }
  }

  private renderHighlightCommand(command: RenderCommand): void {
    switch (command.geometry.type) {
      case 'line':
        this.drawPath(command.geometry.points, command.style);
        break;
      case 'circle':
        this.drawCirclePath(command.geometry.center, command.geometry.radius, command.style);
        break;
      case 'arc':
        this.drawArcPath(
          command.geometry.center,
          command.geometry.radius,
          command.geometry.startAngle,
          command.geometry.endAngle,
          command.style
        );
        break;
      case 'bezier':
        this.drawBezierPath(command.geometry.points, command.style);
        break;
    }
  }

  private renderIndicatorCommand(command: RenderCommand): void {
    if (!this.ctx || command.geometry.type !== 'point') return;
    
    const point = command.geometry.point;
    const screen = this.worldToScreen(point);
    
    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, command.style.size || 5, 0, Math.PI * 2);
    this.ctx.fillStyle = command.style.color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  private renderLabelCommand(command: RenderCommand): void {
    if (!this.ctx || command.geometry.type !== 'point') return;
    
    const screen = this.worldToScreen(command.geometry.point);
    const text = (command as any).text as string;
    
    this.ctx.font = `${(command.style.lineWidth || 1) * 12}px sans-serif`;
    this.ctx.fillStyle = command.style.color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, screen.x, screen.y);
  }

  private renderClosedAreaCommand(command: RenderCommand): void {
    if (!this.ctx || command.geometry.type !== 'polygon') return;
    
    const points = command.geometry.points;
    if (points.length < 3) return;

    this.ctx.beginPath();
    const first = this.worldToScreen(points[0]);
    this.ctx.moveTo(first.x, first.y);
    
    for (let i = 1; i < points.length; i++) {
      const p = this.worldToScreen(points[i]);
      this.ctx.lineTo(p.x, p.y);
    }
    
    this.ctx.closePath();
    this.ctx.fillStyle = command.style.color;
    this.ctx.globalAlpha = command.style.opacity;
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Draw a path (polyline) with the given style
   */
  private drawPath(points: Point[], style: RenderStyle): void {
    if (!this.ctx || points.length < 2) return;

    this.ctx.beginPath();
    const first = this.worldToScreen(points[0]);
    this.ctx.moveTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const p = this.worldToScreen(points[i]);
      this.ctx.lineTo(p.x, p.y);
    }

    this.applyStyle(style);
    this.ctx.stroke();
  }

  /**
   * Draw a circle with the given style
   */
  private drawCirclePath(center: Point, radius: number, style: RenderStyle): void {
    if (!this.ctx) return;

    const screen = this.worldToScreen(center);
    const screenRadius = radius * this.viewState.zoom;

    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);

    this.applyStyle(style);
    this.ctx.stroke();
  }

  /**
   * Draw an arc with the given style
   */
  private drawArcPath(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    style: RenderStyle
  ): void {
    if (!this.ctx) return;

    const screen = this.worldToScreen(center);
    const screenRadius = radius * this.viewState.zoom;

    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, screenRadius, -endAngle, -startAngle, false);

    this.applyStyle(style);
    this.ctx.stroke();
  }

  /**
   * Draw a bezier curve with the given style
   */
  private drawBezierPath(points: Point[], style: RenderStyle): void {
    if (!this.ctx || points.length < 4) return;

    const p0 = this.worldToScreen(points[0]);
    const p1 = this.worldToScreen(points[1]);
    const p2 = this.worldToScreen(points[2]);
    const p3 = this.worldToScreen(points[3]);

    this.ctx.beginPath();
    this.ctx.moveTo(p0.x, p0.y);
    this.ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

    this.applyStyle(style);
    this.ctx.stroke();
  }

  /**
   * Apply render style to canvas context
   */
  private applyStyle(style: RenderStyle): void {
    if (!this.ctx) return;

    this.ctx.strokeStyle = style.color;
    this.ctx.lineWidth = style.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (style.lineStyle === 'dashed') {
      this.ctx.setLineDash(VISUAL_THEME.DASH_PATTERN);
    } else {
      this.ctx.setLineDash([]);
    }

    this.ctx.globalAlpha = style.opacity;
  }
}
