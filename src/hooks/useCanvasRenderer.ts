import { useEffect, useRef, useCallback } from 'react';
import type { Renderer } from '../renderers/Renderer';
import { Canvas2DRenderer, WebGLRenderer } from '../renderers';
import type { Point, Stroke } from '../types';

interface UseCanvasRendererOptions {
  renderer: 'canvas2d' | 'threejs';
  zoom: number;
  panX: number;
  panY: number;
  strokes: Stroke[];
  currentStrokePoints: Point[];
  currentColor: string;
  currentBrushSize: number;
  currentBrushOpacity: number;
  container: HTMLElement | null;
}

interface UseCanvasRendererReturn {
  rendererRef: React.MutableRefObject<Renderer | null>;
  worldToScreen: (point: Point) => { x: number; y: number };
  screenToWorld: (x: number, y: number) => Point;
  resize: () => void;
  render: () => void;
}

/**
 * Hook for managing canvas renderer lifecycle and coordinate transformations
 * 
 * Responsibilities:
 * - Initialize and dispose renderer based on type (canvas2d/threejs)
 * - Sync strokes to renderer (delta sync for performance)
 * - Provide coordinate transformation functions
 * - Handle renderer resize
 * 
 * @param options - Configuration options for the renderer
 * @returns Renderer reference and utility functions
 */
export function useCanvasRenderer(options: UseCanvasRendererOptions): UseCanvasRendererReturn {
  const rendererRef = useRef<Renderer | null>(null);
  const syncedStrokeIdsRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);

  const {
    renderer: rendererType,
    zoom,
    panX,
    panY,
    strokes,
    currentStrokePoints,
    currentColor,
    currentBrushSize,
    currentBrushOpacity,
    container,
  } = options;

  // Initialize renderer and handle type changes
  useEffect(() => {
    if (!container) return;

    // Dispose old renderer on type change
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
      syncedStrokeIdsRef.current.clear();
    }

    // Create new renderer
    const renderer = rendererType === 'threejs'
      ? new WebGLRenderer()
      : new Canvas2DRenderer();
    
    renderer.initialize(container);
    renderer.setViewState(zoom, panX, panY);
    rendererRef.current = renderer;

    // Sync all existing strokes to new renderer
    strokes.forEach(stroke => {
      if (stroke.strokeType === 'digital') {
        renderer.addDigitalStroke(stroke);
      } else {
        renderer.addStroke(stroke);
      }
      syncedStrokeIdsRef.current.add(stroke.id);
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      syncedStrokeIdsRef.current.clear();
    };
  }, [rendererType, container]);

  // Update view state when zoom/pan changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewState(zoom, panX, panY);
    }
  }, [zoom, panX, panY]);

  // Animation loop for stroke sync
  useEffect(() => {
    const animate = () => {
      if (rendererRef.current) {
        const currentIds = new Set(strokes.map(s => s.id));
        
        // Add new strokes (delta sync)
        strokes.forEach(stroke => {
          if (!syncedStrokeIdsRef.current.has(stroke.id)) {
            if (stroke.strokeType === 'digital') {
              rendererRef.current!.addDigitalStroke(stroke);
            } else {
              rendererRef.current!.addStroke(stroke);
            }
            syncedStrokeIdsRef.current.add(stroke.id);
          }
        });
        
        // Remove deleted strokes
        syncedStrokeIdsRef.current.forEach(id => {
          if (!currentIds.has(id)) {
            rendererRef.current!.removeStroke(id);
            rendererRef.current!.removeDigitalStroke(id);
            syncedStrokeIdsRef.current.delete(id);
          }
        });
        
        // Update current stroke
        rendererRef.current.updateCurrentStroke(
          currentStrokePoints,
          currentColor,
          currentBrushSize,
          currentBrushOpacity
        );
        
        rendererRef.current.render();
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [strokes, currentStrokePoints, currentColor, currentBrushSize, currentBrushOpacity]);

  const worldToScreen = useCallback((point: Point): { x: number; y: number } => {
    if (!rendererRef.current) return { x: 0, y: 0 };
    return rendererRef.current.worldToScreen(point);
  }, []);

  const screenToWorld = useCallback((x: number, y: number): Point => {
    if (!rendererRef.current) return { x: 0, y: 0 };
    return rendererRef.current.screenToWorld(x, y);
  }, []);

  const resize = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.resize();
    }
  }, []);

  const render = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.render();
    }
  }, []);

  return {
    rendererRef,
    worldToScreen,
    screenToWorld,
    resize,
    render,
  };
}
