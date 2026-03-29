import { useEffect, useRef, useCallback } from 'react';
import type { Renderer } from '../renderers/Renderer';
import { Canvas2DRenderer, WebGLRenderer } from '../renderers';
import { DrawingCommander } from '../controllers/DrawingCommander';
import { DrawingStateManager } from '../managers/DrawingStateManager';
import type { Point, Stroke, SelectableElement } from '../types';

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
  // New props for DrawingCommander integration
  previewState?: {
    line?: { points: Point[]; previewEnd: Point | null };
    circle?: { center: Point; radiusPoint: Point | null };
    arc?: { points: Point[]; radiusPoint: Point | null };
    curve?: { points: Point[] };
  };
  hoveredElement?: SelectableElement | null;
  selectedElements?: SelectableElement[];
  toolCategory?: 'artistic' | 'digital' | 'measure';
  digitalMode?: 'select' | 'draw';
  digitalTool?: string;
  activeTool?: string;
}

interface UseCanvasRendererReturn {
  rendererRef: React.MutableRefObject<Renderer | null>;
  commanderRef: React.MutableRefObject<DrawingCommander | null>;
  stateManagerRef: React.MutableRefObject<DrawingStateManager | null>;
  worldToScreen: (point: Point) => { x: number; y: number };
  screenToWorld: (x: number, y: number) => Point;
  resize: () => void;
  render: () => void;
  // Preview methods
  setLinePreview: (points: Point[], previewEnd: Point | null) => void;
  setCirclePreview: (center: Point, radiusPoint: Point | null) => void;
  setArcPreview: (points: Point[], radiusPoint: Point | null) => void;
  setCurvePreview: (points: Point[]) => void;
  clearPreviews: () => void;
  // Selection methods
  setHoveredElement: (element: SelectableElement | null) => void;
  setSelectedElements: (elements: SelectableElement[]) => void;
}

/**
 * Hook for managing canvas renderer lifecycle and coordinate transformations
 * 
 * NEW ARCHITECTURE:
 * - Uses DrawingCommander and DrawingStateManager
 * - Generates RenderCommands instead of direct drawing
 * - Supports both Canvas2D and WebGL renderers through unified API
 * 
 * Architecture:
 * DrawingCanvas → useCanvasRenderer → DrawingCommander → Renderer.executeCommands()
 *                               ↕
 *                    DrawingStateManager (generates commands)
 * 
 * @param options - Configuration options for the renderer
 * @returns Renderer reference, commander, and utility functions
 */
export function useCanvasRenderer(options: UseCanvasRendererOptions): UseCanvasRendererReturn {
  const rendererRef = useRef<Renderer | null>(null);
  const stateManagerRef = useRef<DrawingStateManager | null>(null);
  const commanderRef = useRef<DrawingCommander | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const {
    renderer: rendererType,
    zoom,
    panX,
    panY,
    strokes,
    // currentStrokePoints, // Not used in new architecture
    // currentColor,
    // currentBrushSize,
    // currentBrushOpacity,
    container,
    previewState,
    hoveredElement,
    selectedElements,
    toolCategory,
    digitalMode,
    digitalTool,
    activeTool,
  } = options;

  // Initialize renderer, state manager, and commander
  useEffect(() => {
    if (!container) return;

    // Dispose old renderer on type change
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
      stateManagerRef.current = null;
      commanderRef.current = null;
    }

    // Create new renderer
    const renderer = rendererType === 'threejs'
      ? new WebGLRenderer()
      : new Canvas2DRenderer();
    
    renderer.initialize(container);
    renderer.setViewState(zoom, panX, panY);
    rendererRef.current = renderer;

    // Create state manager
    const stateManager = new DrawingStateManager();
    stateManagerRef.current = stateManager;

    // Create commander
    const commander = new DrawingCommander(stateManager, renderer);
    commanderRef.current = commander;

    // Sync initial strokes
    stateManager.setStrokes(strokes);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      stateManagerRef.current = null;
      commanderRef.current = null;
    };
  }, [rendererType, container]);

  // Update view state when zoom/pan changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewState(zoom, panX, panY);
    }
  }, [zoom, panX, panY]);

  // Sync strokes to state manager
  useEffect(() => {
    if (stateManagerRef.current) {
      stateManagerRef.current.setStrokes(strokes);
    }
  }, [strokes]);

  // Sync preview state
  useEffect(() => {
    if (stateManagerRef.current && previewState) {
      stateManagerRef.current.setPreviewState(previewState);
    }
  }, [previewState]);

  // Sync hovered element
  useEffect(() => {
    if (stateManagerRef.current) {
      stateManagerRef.current.setHoveredElement(hoveredElement ?? null);
    }
  }, [hoveredElement]);

  // Sync selected elements
  useEffect(() => {
    if (stateManagerRef.current) {
      stateManagerRef.current.setSelectedElements(selectedElements ?? []);
    }
  }, [selectedElements]);

  // Sync tool state
  useEffect(() => {
    if (stateManagerRef.current) {
      stateManagerRef.current.syncFromStore({
        strokes,
        selectedStrokeIds: (selectedElements ?? []).map(e => e.strokeId),
        selectMode: 'point',
        selectedElements: selectedElements ?? [],
        hoveredDigitalStrokeId: hoveredElement?.strokeId ?? null,
        toolCategory: toolCategory ?? 'digital',
        digitalMode: digitalMode ?? 'draw',
        digitalTool: digitalTool ?? 'line',
        activeTool: activeTool ?? 'digital',
      });
    }
  }, [toolCategory, digitalMode, digitalTool, activeTool, strokes, selectedElements, hoveredElement]);

  // Animation loop - render via commander
  useEffect(() => {
    const animate = () => {
      if (commanderRef.current) {
        commanderRef.current.render();
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Coordinate transformation functions
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
    if (commanderRef.current) {
      commanderRef.current.render();
    }
  }, []);

  // Preview methods
  const setLinePreview = useCallback((points: Point[], previewEnd: Point | null) => {
    commanderRef.current?.setLinePreview(points, previewEnd);
  }, []);

  const setCirclePreview = useCallback((center: Point, radiusPoint: Point | null) => {
    commanderRef.current?.setCirclePreview(center, radiusPoint);
  }, []);

  const setArcPreview = useCallback((points: Point[], radiusPoint: Point | null) => {
    commanderRef.current?.setArcPreview(points, radiusPoint);
  }, []);

  const setCurvePreview = useCallback((points: Point[]) => {
    commanderRef.current?.setCurvePreview(points);
  }, []);

  const clearPreviews = useCallback(() => {
    commanderRef.current?.clearPreviews();
  }, []);

  // Selection methods
  const setHoveredElement = useCallback((element: SelectableElement | null) => {
    commanderRef.current?.setHoveredElement(element);
  }, []);

  const setSelectedElements = useCallback((elements: SelectableElement[]) => {
    commanderRef.current?.setSelectedElements(elements);
  }, []);

  return {
    rendererRef,
    commanderRef,
    stateManagerRef,
    worldToScreen,
    screenToWorld,
    resize,
    render,
    setLinePreview,
    setCirclePreview,
    setArcPreview,
    setCurvePreview,
    clearPreviews,
    setHoveredElement,
    setSelectedElements,
  };
}
