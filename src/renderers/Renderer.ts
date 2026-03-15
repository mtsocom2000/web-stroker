/**
 * Renderer Interface - Abstract drawing operations
 * 
 * Design Principle:
 * - DrawingCanvas depends on this interface, not concrete implementations
 * - Concrete renderers (Canvas2D, WebGL) implement these methods
 * - No renderer type checking in DrawingCanvas
 */

import type { Point, Stroke } from '../types';

export interface Renderer {
  // Lifecycle
  initialize(container: HTMLElement): void;
  dispose(): void;
  resize(): void;
  render(): void;
  
  // View state
  setViewState(zoom: number, panX: number, panY: number): void;
  
  // Artistic strokes
  addStroke(stroke: Stroke): void;
  removeStroke(strokeId: string): void;
  clearStrokes(): void;
  updateCurrentStroke(points: Point[], color: string, thickness: number, opacity: number): void;
  finalizeCurrentStroke(strokeId: string): void;
  
  // Digital elements
  addDigitalStroke(stroke: Stroke): void;
  removeDigitalStroke(strokeId: string): void;
  clearDigitalElements(): void;
  
  // Digital previews (during drawing)
  updateDigitalLinePreview(start: Point, end: Point, color: string, thickness: number): void;
  updateDigitalPolylinePreview(points: Point[], previewEnd: Point | null, color: string, thickness: number): void;
  updateDigitalCirclePreview(center: Point, radius: number, color: string, thickness: number): void;
  updateDigitalArcPreview(center: Point, radius: number, startAngle: number, endAngle: number, color: string, thickness: number): void;
  updateDigitalBezierPreview(points: Point[], color: string, thickness: number): void;
  clearDigitalPreviews(): void;
  
  // Selection/highlight rendering for digital elements
  highlightDigitalLine(points: Point[], color: string, thickness: number, isHovered: boolean, isSelected: boolean): void;
  highlightDigitalArc(arcData: { center: Point; radius: number; startAngle: number; endAngle: number }, color: string, thickness: number, isHovered: boolean, isSelected: boolean): void;
  highlightDigitalBezier(points: Point[], color: string, thickness: number, isHovered: boolean, isSelected: boolean): void;
  drawEndpointIndicator(point: Point, color: string, size: number): void;
  drawControlPointIndicator(point: Point, color: string, size: number): void;
  drawCrossIndicator(point: Point, color: string, size: number): void;
  clearHighlights(): void;
  
  // Utilities
  worldToScreen(point: Point): { x: number; y: number };
  screenToWorld(x: number, y: number): Point;
}

export type RendererType = 'canvas2d' | 'threejs';

export interface RendererConfig {
  type: RendererType;
  container: HTMLElement;
}
