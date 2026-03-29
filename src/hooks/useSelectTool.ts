import { useCallback, useRef, useState } from 'react';
import { useDrawingStore } from '../store';
import type { Point, Stroke, DigitalSegment } from '../types';
import { distance } from '../utils';

interface SelectableElement {
  type: 'endpoint' | 'segment' | 'arc' | 'control-point';
  strokeId: string;
  segmentIndex: number;
  point?: Point;
  arcData?: { center: Point; radius: number; startAngle: number; endAngle: number };
}

interface UseSelectToolOptions {
  screenToWorld: (x: number, y: number) => Point;
}

interface UseSelectToolReturn {
  hoveredElement: SelectableElement | null;
  selectedElements: SelectableElement[];
  isDragging: boolean;
  findElementAtPoint: (point: Point, selectMode: 'point' | 'line' | 'arc' | 'all') => SelectableElement | null;
  handleSelectDown: (e: React.MouseEvent) => void;
  handleSelectMove: (e: React.MouseEvent) => void;
  handleSelectUp: () => void;
}

/**
 * Hook for select tool functionality
 * Handles element selection, hovering, and dragging
 * 
 * Extracted from DrawingCanvas to reduce component size.
 */
export function useSelectTool(options: UseSelectToolOptions): UseSelectToolReturn {
  const store = useDrawingStore();
  const { screenToWorld } = options;
  
  // State for UI
  const [hoveredElement, setHoveredElement] = useState<SelectableElement | null>(null);
  const [selectedElements, setSelectedElements] = useState<SelectableElement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs for drag state
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const originalStrokesRef = useRef<Map<string, Stroke>>(new Map());
  const selectedElementRef = useRef<SelectableElement | null>(null);

  /**
   * Find endpoint at given position
   */
  const findEndpointAtPoint = useCallback((point: Point, stroke: Stroke, segIndex: number, segment: DigitalSegment): SelectableElement | null => {
    const threshold = 10 / store.zoom;
    
    if (segment.points.length < 2) return null;
    
    const startPoint = segment.points[0];
    const endPoint = segment.points[segment.points.length - 1];
    
    if (distance(point, startPoint) <= threshold) {
      return { type: 'endpoint', strokeId: stroke.id, segmentIndex: segIndex, point: startPoint };
    }
    
    if (distance(point, endPoint) <= threshold) {
      return { type: 'endpoint', strokeId: stroke.id, segmentIndex: segIndex, point: endPoint };
    }
    
    return null;
  }, [store.zoom]);

  /**
   * Find segment at given position
   */
  const findSegmentAtPoint = useCallback((point: Point, stroke: Stroke, segIndex: number, segment: DigitalSegment): SelectableElement | null => {
    const threshold = 8 / store.zoom;
    
    switch (segment.type) {
      case 'line': {
        if (segment.points.length < 2) return null;
        const p1 = segment.points[0];
        const p2 = segment.points[1];
        const dist = distanceToSegment(point, p1, p2);
        if (dist <= threshold) {
          return { type: 'segment', strokeId: stroke.id, segmentIndex: segIndex };
        }
        break;
      }
      case 'arc': {
        if (!segment.arcData) return null;
        const { center, radius } = segment.arcData;
        const distToCenter = distance(point, center);
        if (Math.abs(distToCenter - radius) <= threshold) {
          return { type: 'arc', strokeId: stroke.id, segmentIndex: segIndex, arcData: segment.arcData };
        }
        break;
      }
    }
    
    return null;
  }, []);

  /**
   * Find element at given point based on select mode
   */
  const findElementAtPoint = useCallback((point: Point, selectMode: 'point' | 'line' | 'arc' | 'all'): SelectableElement | null => {
    const { strokes } = store;
    
    // Filter digital strokes
    const digitalStrokes = strokes.filter(s => s.strokeType === 'digital' && s.digitalSegments);
    
    // Search from top to bottom (last to first)
    for (let i = digitalStrokes.length - 1; i >= 0; i--) {
      const stroke = digitalStrokes[i];
      if (!stroke.digitalSegments) continue;
      
      for (let segIndex = 0; segIndex < stroke.digitalSegments.length; segIndex++) {
        const segment = stroke.digitalSegments[segIndex];
        
        // Check endpoints
        const endpoint = findEndpointAtPoint(point, stroke, segIndex, segment);
        if (endpoint && (selectMode === 'point' || selectMode === 'all')) {
          return endpoint;
        }
        
        // Check segments/arcs based on mode
        if (selectMode === 'line' || selectMode === 'all') {
          const segElement = findSegmentAtPoint(point, stroke, segIndex, segment);
          if (segElement) return segElement;
        } else if (selectMode === 'arc' && segment.type === 'arc' && segment.arcData) {
          const arcElement = findSegmentAtPoint(point, stroke, segIndex, segment);
          if (arcElement) return arcElement;
        }
      }
    }
    
    return null;
  }, [store.strokes, findEndpointAtPoint, findSegmentAtPoint]);

  /**
   * Handle select tool mouse down
   */
  const handleSelectDown = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    const selectMode = store.selectMode;
    const element = findElementAtPoint(worldPoint, selectMode);
    
    if (element) {
      // Select element
      setSelectedElements([element]);
      selectedElementRef.current = element;
      
      // Start drag
      setIsDragging(true);
      dragStartRef.current = worldPoint;
      
      // Store original strokes for undo
      originalStrokesRef.current = new Map(
        store.strokes.map(s => [s.id, s])
      );
    } else {
      // Deselect
      setSelectedElements([]);
      selectedElementRef.current = null;
    }
  }, [screenToWorld, store.selectMode, store.strokes, findElementAtPoint]);

  /**
   * Handle select tool mouse move
   */
  const handleSelectMove = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    // Update hover state
    if (!isDragging) {
      const selectMode = store.selectMode;
      const element = findElementAtPoint(worldPoint, selectMode);
      setHoveredElement(element);
    }
    
    // Handle drag
    if (isDragging && selectedElementRef.current) {
      const dragOffset = {
        x: worldPoint.x - dragStartRef.current.x,
        y: worldPoint.y - dragStartRef.current.y,
      };
      
      // TODO: Apply drag offset to selected element
      // This requires modifying strokes in the store
      console.log('[useSelectTool] Dragging:', dragOffset);
    }
  }, [screenToWorld, store.selectMode, isDragging, findElementAtPoint]);

  /**
   * Handle select tool mouse up
   */
  const handleSelectUp = useCallback(() => {
    setIsDragging(false);
    // Drag complete - strokes should already be updated
  }, []);

  return {
    hoveredElement,
    selectedElements,
    isDragging,
    findElementAtPoint,
    handleSelectDown,
    handleSelectMove,
    handleSelectUp,
  };
}

/**
 * Calculate distance from point to line segment
 */
function distanceToSegment(point: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-10) {
    return distance(point, p1);
  }

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return distance(point, { x: projX, y: projY });
}
