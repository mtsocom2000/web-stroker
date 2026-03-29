import type { Renderer } from '../renderers/Renderer';
import type { DrawingStateManager } from '../managers/DrawingStateManager';
import type { RenderCommand } from '../renderers/commands/RenderCommand';
import type { Point, Stroke, SelectableElement } from '../types';

/**
 * DrawingCommander - Orchestrates rendering based on state
 *
 * This class:
 * 1. Reads state from DrawingStateManager
 * 2. Generates RenderCommands
 * 3. Executes commands on Renderer
 *
 * Architecture:
 * DrawingCanvas → DrawingCommander → RenderCommand[] → Renderer
 *
 * Usage:
 * ```typescript
 * const commander = new DrawingCommander(stateManager, renderer);
 * commander.render(); // Call each frame
 * ```
 */
export class DrawingCommander {
  private stateManager: DrawingStateManager;
  private renderer: Renderer;
  private lastCommandCount: number = 0;
  private isRendering: boolean = false;

  constructor(stateManager: DrawingStateManager, renderer: Renderer) {
    this.stateManager = stateManager;
    this.renderer = renderer;
  }

  /**
   * Main render method - call this each frame
   */
  render(): void {
    if (this.isRendering) {
      // Prevent re-entrant rendering
      return;
    }

    this.isRendering = true;
    try {
      const commands = this.stateManager.getRenderCommands();
      this.lastCommandCount = commands.length;
      this.renderer.executeCommands(commands);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Render with custom commands (bypass state manager)
   * Useful for special cases like drag previews
   */
  renderCommands(commands: RenderCommand[]): void {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    try {
      this.lastCommandCount = commands.length;
      this.renderer.executeCommands(commands);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Get the renderer instance
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Get the state manager instance
   */
  getStateManager(): DrawingStateManager {
    return this.stateManager;
  }

  /**
   * Update the renderer (for switching between Canvas2D and WebGL)
   */
  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  /**
   * Get debug info
   */
  getDebugInfo(): { commandCount: number; isRendering: boolean } {
    return {
      commandCount: this.lastCommandCount,
      isRendering: this.isRendering,
    };
  }

  // ============================================================================
  // Convenience methods - delegate to state manager
  // ============================================================================

  /**
   * Set preview state for line drawing
   */
  setLinePreview(points: Point[], previewEnd: Point | null): void {
    this.stateManager.updatePreviewState({
      line: { points, previewEnd },
    });
  }

  /**
   * Set preview state for polyline drawing (with completed segments)
   */
  setPolylinePreview(points: Point[], previewEnd: Point | null): void {
    this.stateManager.updatePreviewState({
      polyline: { points, previewEnd },
    });
  }

  /**
   * Set preview state for circle drawing
   */
  setCirclePreview(center: Point, radiusPoint: Point | null): void {
    this.stateManager.updatePreviewState({
      circle: { center, radiusPoint },
    });
  }

  /**
   * Set preview state for arc drawing
   */
  setArcPreview(points: Point[], radiusPoint: Point | null): void {
    this.stateManager.updatePreviewState({
      arc: { points, radiusPoint },
    });
  }

  /**
   * Set preview state for curve drawing
   */
  setCurvePreview(points: Point[]): void {
    this.stateManager.updatePreviewState({
      curve: { points },
    });
  }

  /**
   * Clear all previews
   */
  clearPreviews(): void {
    this.stateManager.clearPreviewState();
  }

  /**
   * Set hovered element
   */
  setHoveredElement(element: SelectableElement | null): void {
    this.stateManager.setHoveredElement(element);
  }

  /**
   * Set selected elements
   */
  setSelectedElements(elements: SelectableElement[]): void {
    this.stateManager.setSelectedElements(elements);
  }

  /**
   * Set drag state
   */
  setDragOffset(offset: Point): void {
    this.stateManager.setDragOffset(offset);
  }

  /**
   * Sync state from store
   */
  syncFromStore(store: Parameters<DrawingStateManager['syncFromStore']>[0]): void {
    this.stateManager.syncFromStore(store);
  }

  /**
   * Set measure state
   */
  setMeasureState(state: Parameters<DrawingStateManager['setMeasureState']>[0]): void {
    this.stateManager.setMeasureState(state);
  }

  /**
   * Update strokes reference
   */
  setStrokes(strokes: Stroke[]): void {
    this.stateManager.setStrokes(strokes);
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create a DrawingCommander instance
 */
export function createDrawingCommander(
  stateManager: DrawingStateManager,
  renderer: Renderer
): DrawingCommander {
  return new DrawingCommander(stateManager, renderer);
}
