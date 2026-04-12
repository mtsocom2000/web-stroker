import type { Point, Stroke, SelectableElement, DigitalSegment } from '../types';
import type { RenderCommand, RenderStyle, Geometry } from '../renderers/commands/RenderCommand';
import { RenderCommandFactory, VISUAL_THEME } from '../renderers/commands/RenderCommand';

/**
 * Preview state for different drawing tools
 */
export interface PreviewState {
  line?: {
    points: Point[];
    previewEnd: Point | null;
  };
  polyline?: {
    points: Point[];
    previewEnd: Point | null;
  };
  circle?: {
    center: Point;
    radiusPoint: Point | null;
  };
  threePointCircle?: {
    points: Point[];
  };
  arc?: {
    points: Point[];
    radiusPoint: Point | null;
  };
  curve?: {
    points: Point[];
  };
}

/**
 * Selection state
 */
export interface SelectionState {
  selectedElements: SelectableElement[];
  hoveredElement: SelectableElement | null;
  hoveredDigitalStrokeId: string | null;
}

/**
 * Drag state for rendering
 */
export interface DragRenderState {
  isDragging: boolean;
  dragOffset: Point;
  strokeId: string | null;
  segmentIndex: number | null;
}

/**
 * DrawingStateManager - Centralized state management for drawing operations
 *
 * This class:
 * 1. Manages preview state for all drawing tools
 * 2. Tracks selection and hover state
 * 3. Generates RenderCommands based on current state
 * 4. Filters commands based on select mode
 *
 * Architecture:
 * - DrawingCanvas sets state via public methods
 * - DrawingCommander reads state via getRenderCommands()
 * - Renderer executes the commands
 */
export class DrawingStateManager {
  // Preview state
  private previewState: PreviewState = {};

  // Selection state
  private selectionState: SelectionState = {
    selectedElements: [],
    hoveredElement: null,
    hoveredDigitalStrokeId: null,
  };

  // Drag state
  private dragState: DragRenderState = {
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    strokeId: null,
    segmentIndex: null,
  };

  // Current tool info (for filtering)
  private currentTool: 'select' | 'line' | 'circle' | 'arc' | 'curve' = 'select';
  private selectMode: 'point' | 'line' | 'arc' = 'point';

  // Strokes reference (for generating commands)
  private strokes: Stroke[] = [];

  // Measure mode state
  private measureState: {
    tool: 'distance' | 'angle' | 'radius' | 'face' | null;
    firstLine: { strokeId: string; segmentIndex: number } | null;
    secondLine: { strokeId: string; segmentIndex: number } | null;
    startPoint: Point | null;
    endPoint: Point | null;
  } = {
    tool: null,
    firstLine: null,
    secondLine: null,
    startPoint: null,
    endPoint: null,
  };

  // ============================================================================
  // State Setters
  // ============================================================================

  setPreviewState(preview: PreviewState): void {
    this.previewState = preview;
  }

  updatePreviewState(updates: Partial<PreviewState>): void {
    this.previewState = { ...this.previewState, ...updates };
  }

  clearPreviewState(): void {
    this.previewState = {};
  }

  setSelectionState(state: Partial<SelectionState>): void {
    this.selectionState = { ...this.selectionState, ...state };
  }

  setSelectedElements(elements: SelectableElement[]): void {
    this.selectionState.selectedElements = elements;
  }

  setHoveredElement(element: SelectableElement | null): void {
    this.selectionState.hoveredElement = element;
  }

  setHoveredDigitalStrokeId(id: string | null): void {
    this.selectionState.hoveredDigitalStrokeId = id;
  }

  setDragState(state: Partial<DragRenderState>): void {
    this.dragState = { ...this.dragState, ...state };
  }

  setDragOffset(offset: Point): void {
    this.dragState.dragOffset = offset;
  }

  setCurrentTool(tool: 'select' | 'line' | 'circle' | 'arc' | 'curve'): void {
    this.currentTool = tool;
  }

  setSelectMode(mode: 'point' | 'line' | 'arc'): void {
    this.selectMode = mode;
  }

  setStrokes(strokes: Stroke[]): void {
    this.strokes = strokes;
  }

  setSelectedStrokeIds(_ids: string[]): void {
    // Reserved for future selection highlighting
  }

  setMeasureState(state: {
    tool?: 'distance' | 'angle' | 'radius' | 'face' | null;
    firstLine?: { strokeId: string; segmentIndex: number } | null;
    secondLine?: { strokeId: string; segmentIndex: number } | null;
    startPoint?: Point | null;
    endPoint?: Point | null;
  }): void {
    this.measureState = { ...this.measureState, ...state };
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  getPreviewState(): PreviewState {
    return this.previewState;
  }

  getSelectionState(): SelectionState {
    return this.selectionState;
  }

  getDragState(): DragRenderState {
    return this.dragState;
  }

  getCurrentTool(): string {
    return this.currentTool;
  }

  getSelectMode(): string {
    return this.selectMode;
  }

  // ============================================================================
  // Command Generation
  // ============================================================================

  /**
   * Generate all render commands for current state
   * This is the main entry point for rendering
   */
  getRenderCommands(): RenderCommand[] {
    const commands: RenderCommand[] = [];

    // 1. Add stroke rendering commands
    commands.push(...this.generateStrokeCommands());

    // 2. Add preview commands (based on current tool)
    commands.push(...this.generatePreviewCommands());

    // 3. Add highlight commands (selection/hover)
    commands.push(...this.generateHighlightCommands());

    // 4. Add indicator commands (endpoints for selected elements)
    commands.push(...this.generateIndicatorCommands());

    // Sort by zIndex
    return commands.sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Generate commands for rendering all strokes
   */
  private generateStrokeCommands(): RenderCommand[] {
    const commands: RenderCommand[] = [];

    // Helper to check if segment is hovered
    const isSegmentHovered = (strokeId: string, segmentIndex: number): boolean => {
      return this.selectionState.hoveredElement?.strokeId === strokeId &&
             this.selectionState.hoveredElement?.segmentIndex === segmentIndex;
    };

    // Helper to check if segment is selected
    const isSegmentSelected = (strokeId: string, segmentIndex: number): boolean => {
      return this.selectionState.selectedElements.some(
        sel => sel.strokeId === strokeId && sel.segmentIndex === segmentIndex
      );
    };

    // Helper to check if segment is part of measure selection
    const isMeasureSelected = (strokeId: string, segmentIndex: number): boolean => {
      const { firstLine, secondLine } = this.measureState;
      if (!firstLine || !secondLine) return false;
      return (
        (firstLine.strokeId === strokeId && firstLine.segmentIndex === segmentIndex) ||
        (secondLine.strokeId === strokeId && secondLine.segmentIndex === segmentIndex)
      );
    };

    for (const stroke of this.strokes) {
      if (stroke.strokeType === 'digital' && stroke.digitalSegments) {
        // Digital strokes - render each segment
        for (let i = 0; i < stroke.digitalSegments.length; i++) {
          const segment = stroke.digitalSegments[i];
          const geometry = this.segmentToGeometry(segment);

          if (geometry) {
            // Determine style based on hover/select/measure state
            let color = segment.color;
            let lineWidth = stroke.thickness;

            // Measure mode styling (highest priority)
            if (this.measureState.tool && isMeasureSelected(stroke.id, i)) {
              color = '#ff9800'; // Orange for measure selected lines
              lineWidth = 2;
            } else if (isSegmentSelected(stroke.id, i)) {
              // Selection styling
              color = VISUAL_THEME.SELECT_COLOR;
              lineWidth += 2;
            } else if (isSegmentHovered(stroke.id, i)) {
              // Hover styling
              color = VISUAL_THEME.HOVER_COLOR;
              lineWidth += 1;
            }

            // Create the stroke command
            commands.push(RenderCommandFactory.createStrokeCommand(
              geometry,
              { color, lineWidth, lineStyle: 'solid', opacity: 1 },
              stroke.id
            ));
          }
        }
      } else if (stroke.strokeType === 'artistic') {
        // Artistic strokes - render as polyline
        const points = stroke.displayPoints ?? stroke.smoothedPoints ?? stroke.points;
        if (points.length >= 2) {
          const style: RenderStyle = {
            color: stroke.color,
            lineWidth: stroke.thickness,
            lineStyle: 'solid',
            opacity: stroke.brushSettings?.opacity ?? 1,
          };

          // Create command for each segment of the polyline
          for (let i = 0; i < points.length - 1; i++) {
            commands.push(RenderCommandFactory.createStrokeCommand(
              { type: 'line', points: [points[i], points[i + 1]] },
              style,
              stroke.id
            ));
          }
        }
      }
    }

    return commands;
  }

  /**
   * Generate preview commands based on current drawing state
   */
  private generatePreviewCommands(): RenderCommand[] {
    const commands: RenderCommand[] = [];
    const previewStyle: Partial<RenderStyle> = {
      color: VISUAL_THEME.PREVIEW_COLOR,
      lineWidth: 2,
      lineStyle: 'dashed',
      opacity: VISUAL_THEME.PREVIEW_OPACITY,
    };

    // Line preview
    if (this.previewState.line) {
      const { points, previewEnd } = this.previewState.line;
      if (points.length > 0 && previewEnd) {
        const lastPoint = points[points.length - 1];
        commands.push(RenderCommandFactory.createPreviewCommand(
          { type: 'line', points: [lastPoint, previewEnd] },
          previewStyle
        ));
      }
    }

    // Polyline preview
    if (this.previewState.polyline) {
      const { points, previewEnd } = this.previewState.polyline;

      // Draw completed segments
      for (let i = 0; i < points.length - 1; i++) {
        commands.push(RenderCommandFactory.createStrokeCommand(
          { type: 'line', points: [points[i], points[i + 1]] },
          { ...previewStyle, lineStyle: 'solid', opacity: 1 }
        ));
      }

      // Draw preview line
      if (previewEnd && points.length > 0) {
        const lastPoint = points[points.length - 1];
        commands.push(RenderCommandFactory.createPreviewCommand(
          { type: 'line', points: [lastPoint, previewEnd] },
          previewStyle
        ));
      }
    }

    // Circle preview
    if (this.previewState.circle) {
      const { center, radiusPoint } = this.previewState.circle;
      if (radiusPoint) {
        const radius = Math.sqrt(
          Math.pow(radiusPoint.x - center.x, 2) +
          Math.pow(radiusPoint.y - center.y, 2)
        );
        commands.push(RenderCommandFactory.createPreviewCommand(
          { type: 'circle', center, radius },
          previewStyle
        ));

        // Draw dashed line from center to radius point
        commands.push(RenderCommandFactory.createPreviewCommand(
          { type: 'line', points: [center, radiusPoint] },
          previewStyle
        ));
      }
    }

    // Three-point circle preview
    if (this.previewState.threePointCircle) {
      const { points } = this.previewState.threePointCircle;
      // Draw points
      for (const point of points) {
        commands.push(RenderCommandFactory.createIndicatorCommand(
          point,
          'endpoint',
          false,
          false
        ));
      }
      // If we have 3 points, draw the circle
      if (points.length === 3) {
        const circle = this.calculateCircleFromThreePoints(points[0], points[1], points[2]);
        if (circle) {
          commands.push(RenderCommandFactory.createPreviewCommand(
            { type: 'circle', center: circle.center, radius: circle.radius },
            previewStyle
          ));
        }
      }
    }

    // Arc preview
    if (this.previewState.arc) {
      const { points, radiusPoint } = this.previewState.arc;
      if (points.length >= 2 && radiusPoint) {
        const center = points[0];
        const startPoint = points[1];
        const radius = Math.sqrt(
          Math.pow(radiusPoint.x - center.x, 2) +
          Math.pow(radiusPoint.y - center.y, 2)
        );
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        const endAngle = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x);

        commands.push(RenderCommandFactory.createPreviewCommand(
          {
            type: 'arc',
            center,
            radius,
            startAngle,
            endAngle: endAngle > startAngle ? endAngle : endAngle + 2 * Math.PI
          },
          previewStyle
        ));

        // Draw dashed line from center to current point
        commands.push(RenderCommandFactory.createPreviewCommand(
          { type: 'line', points: [center, radiusPoint] },
          previewStyle
        ));
      }
    }

    // Curve preview
    if (this.previewState.curve) {
      const { points } = this.previewState.curve;
      if (points.length >= 2) {
        // Draw as dashed polyline for preview
        for (let i = 0; i < points.length - 1; i++) {
          commands.push(RenderCommandFactory.createPreviewCommand(
            { type: 'line', points: [points[i], points[i + 1]] },
            previewStyle
          ));
        }
      }
    }

    return commands;
  }

  /**
   * Generate highlight commands for selected/hovered elements
   * Filters based on current select mode
   */
  private generateHighlightCommands(): RenderCommand[] {
    const commands: RenderCommand[] = [];

    // Only highlight if in select mode
    if (this.currentTool !== 'select') {
      return commands;
    }

    // Highlight selected elements
    for (const element of this.selectionState.selectedElements) {
      if (!this.isElementSelectableInCurrentMode(element)) {
        continue;
      }

      const geometry = this.elementToGeometry(element);
      if (geometry) {
        commands.push(RenderCommandFactory.createHighlightCommand(
          geometry,
          true, // isSelected
          false, // isHovered
          element.strokeId,
          element.segmentIndex
        ));
      }
    }

    // Highlight hovered element
    if (this.selectionState.hoveredElement) {
      const element = this.selectionState.hoveredElement;
      if (this.isElementSelectableInCurrentMode(element)) {
        const geometry = this.elementToGeometry(element);
        if (geometry) {
          commands.push(RenderCommandFactory.createHighlightCommand(
            geometry,
            false, // isSelected
            true, // isHovered
            element.strokeId,
            element.segmentIndex
          ));
        }
      }
    }

    return commands;
  }

  /**
   * Generate indicator commands for endpoints of selected elements
   */
  private generateIndicatorCommands(): RenderCommand[] {
    const commands: RenderCommand[] = [];

    // Only show indicators if in select mode
    if (this.currentTool !== 'select') {
      return commands;
    }

    // Show indicators for selected endpoints
    for (const element of this.selectionState.selectedElements) {
      if (element.type === 'endpoint') {
        const endpointElement = element as SelectableElement & { point?: Point };
        if (endpointElement.point) {
          commands.push(RenderCommandFactory.createIndicatorCommand(
            endpointElement.point,
            'endpoint',
            true, // isSelected
            false
          ));
        }
      }
    }

    // Show indicators for hovered endpoints
    if (this.selectionState.hoveredElement?.type === 'endpoint') {
      const endpointElement = this.selectionState.hoveredElement as SelectableElement & { point?: Point };
      if (endpointElement.point) {
        commands.push(RenderCommandFactory.createIndicatorCommand(
          endpointElement.point,
          'endpoint',
          false,
          true // isHovered
        ));
      }
    }

    return commands;
  }

  // ============================================================================
  // Geometry Conversion Helpers
  // ============================================================================

  /**
   * Convert a digital segment to geometry
   */
  private segmentToGeometry(segment: DigitalSegment): Geometry | null {
    switch (segment.type) {
      case 'line':
        if (segment.points.length >= 2) {
          return {
            type: 'line',
            points: [segment.points[0], segment.points[segment.points.length - 1]]
          };
        }
        break;
      case 'arc':
        if (segment.arcData) {
          return {
            type: 'arc',
            center: segment.arcData.center,
            radius: segment.arcData.radius,
            startAngle: segment.arcData.startAngle,
            endAngle: segment.arcData.endAngle,
          };
        }
        break;
      case 'bezier':
        if (segment.points.length >= 4) {
          return {
            type: 'bezier',
            points: segment.points.slice(0, 4),
          };
        }
        break;
    }
    return null;
  }

  /**
   * Convert a selectable element to geometry for highlighting
   */
  private elementToGeometry(element: SelectableElement): Geometry | null {
    const stroke = this.strokes.find(s => s.id === element.strokeId);
    if (!stroke || !stroke.digitalSegments) return null;

    const segment = stroke.digitalSegments[element.segmentIndex];
    if (!segment) return null;

    return this.segmentToGeometry(segment);
  }

  /**
   * Check if an element is selectable in current select mode
   */
  private isElementSelectableInCurrentMode(element: SelectableElement): boolean {
    switch (this.selectMode) {
      case 'point':
        return element.type === 'endpoint';
      case 'line':
        return element.type === 'segment';
      case 'arc':
        return element.type === 'arc';
      default:
        return true;
    }
  }

  /**
   * Calculate circle from three points
   */
  private calculateCircleFromThreePoints(p1: Point, p2: Point, p3: Point): { center: Point; radius: number } | null {
    const ax = p1.x, ay = p1.y;
    const bx = p2.x, by = p2.y;
    const cx = p3.x, cy = p3.y;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-10) return null;

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    const center = { x: ux, y: uy };
    const radius = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);

    return { center, radius };
  }

  // ============================================================================
  // Sync with Store
  // ============================================================================

  /**
   * Sync state from Zustand store
   * Call this when store state changes
   */
  syncFromStore(store: any): void {
    this.strokes = store.strokes;
    this.selectMode = store.selectMode;

    // Map store state to internal state
    this.selectionState.selectedElements = store.selectedElements;
    this.selectionState.hoveredDigitalStrokeId = store.hoveredDigitalStrokeId;

    // Determine current tool from store
    if (store.toolCategory === 'digital') {
      if (store.digitalMode === 'select') {
        this.currentTool = 'select';
      } else {
        this.currentTool = store.digitalTool as 'line' | 'circle' | 'arc' | 'curve';
      }
    } else if (store.activeTool === 'select') {
      this.currentTool = 'select';
    }

    // Sync measure state
    if (store.measureTool || store.measureFirstLine !== undefined) {
      this.measureState = {
        tool: store.measureTool ?? null,
        firstLine: store.measureFirstLine ?? null,
        secondLine: store.measureSecondLine ?? null,
        startPoint: store.measureStartPoint ?? null,
        endPoint: store.measureEndPoint ?? null,
      };
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.previewState = {};
    this.selectionState = {
      selectedElements: [],
      hoveredElement: null,
      hoveredDigitalStrokeId: null,
    };
    this.dragState = {
      isDragging: false,
      dragOffset: { x: 0, y: 0 },
      strokeId: null,
      segmentIndex: null,
    };
  }
}

// Singleton instance for easy access
let _instance: DrawingStateManager | null = null;

export function getDrawingStateManager(): DrawingStateManager {
  if (!_instance) {
    _instance = new DrawingStateManager();
  }
  return _instance;
}
