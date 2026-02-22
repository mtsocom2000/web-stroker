import type { Point } from '../types';
import type { Stroke, ClosedArea, HighlightStyle } from './types';
import { buildPlanarGraph } from './planarGraph';
import { extractFaces, computeBounds } from './faceExtraction';
import { renderClosedAreas } from './renderer';
import { generateId, DEFAULT_HIGHLIGHT_STYLE } from './types';

export interface DragState {
  areaId: string;
  strokeIds: string[];
  startPoint: Point;
}

export class ClosedAreaManager {
  private strokes: Stroke[] = [];
  private closedAreas: ClosedArea[] = [];
  private hoveredAreaId: string | null = null;
  private selectedAreaId: string | null = null;
  private dragState: DragState | null = null;
  private highlightStyle: HighlightStyle;
  private onChangeCallback: (() => void) | null = null;

  constructor(highlightStyle?: Partial<HighlightStyle>) {
    this.highlightStyle = { ...DEFAULT_HIGHLIGHT_STYLE, ...highlightStyle };
  }

  onChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  private notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  setStrokes(strokes: Stroke[]): void {
    this.strokes = strokes;
    this.rebuild();
  }

  forceRebuild(): void {
    this.rebuild();
  }

  getStrokes(): Stroke[] {
    return this.strokes;
  }

  rebuild(): void {
    this.closedAreas = [];
    this.hoveredAreaId = null;
    this.selectedAreaId = null;

    if (this.strokes.length < 2) {
      this.notifyChange();
      return;
    }

    const { edges } = buildPlanarGraph(this.strokes);

    if (edges.length === 0) {
      this.notifyChange();
      return;
    }

    const faces = extractFaces(edges);

    for (const face of faces) {
      const strokeIds = [...new Set(face.edgeIds.map(eid => {
        const edge = edges.find(e => e.id === eid);
        return edge?.strokeId;
      }).filter(Boolean))] as string[];

      this.closedAreas.push({
        id: generateId(),
        faceId: face.id,
        strokeIds,
        edgeIds: face.edgeIds,
        polygon: face.vertices.map(v => v.position),
        bounds: computeBounds(face.vertices.map(v => v.position)),
        area: face.area,
      });
    }

    this.closedAreas.sort((a, b) => a.area - b.area);

    this.notifyChange();
  }

  getClosedAreas(): ClosedArea[] {
    return this.closedAreas;
  }

  getHoveredAreaId(): string | null {
    return this.hoveredAreaId;
  }

  setHoveredAreaId(id: string | null): void {
    this.hoveredAreaId = id;
    this.notifyChange();
  }

  getSelectedAreaId(): string | null {
    return this.selectedAreaId;
  }

  hitTest(point: Point): ClosedArea | null {
    for (const area of this.closedAreas) {
      if (point.x >= area.bounds.min.x && 
          point.x <= area.bounds.max.x &&
          point.y >= area.bounds.min.y && 
          point.y <= area.bounds.max.y) {
        
        let inside = false;
        const n = area.polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = area.polygon[i].x, yi = area.polygon[i].y;
          const xj = area.polygon[j].x, yj = area.polygon[j].y;
          if (((yi > point.y) !== (yj > point.y)) &&
              (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
          }
        }
        
        if (inside) {
          return area;
        }
      }
    }
    return null;
  }

  startDrag(point: Point): { area: ClosedArea | null; strokeIds: string[] } {
    const area = this.hitTest(point);
    if (area) {
      this.selectedAreaId = area.id;
      this.dragState = {
        areaId: area.id,
        strokeIds: area.strokeIds,
        startPoint: point,
      };
      this.notifyChange();
      return { area, strokeIds: area.strokeIds };
    }
    return { area: null, strokeIds: [] };
  }

  endDrag(): void {
    this.dragState = null;
    this.notifyChange();
  }

  isDragging(): boolean {
    return this.dragState !== null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderClosedAreas(ctx, this.closedAreas, this.hoveredAreaId, this.highlightStyle);
  }

  setHighlightStyle(style: Partial<HighlightStyle>): void {
    this.highlightStyle = { ...DEFAULT_HIGHLIGHT_STYLE, ...style };
    this.notifyChange();
  }

  clear(): void {
    this.strokes = [];
    this.closedAreas = [];
    this.hoveredAreaId = null;
    this.selectedAreaId = null;
    this.dragState = null;
    this.notifyChange();
  }
}

export type { ClosedArea, HighlightStyle, FillRegion, FillStyle, PatternType } from './types';
