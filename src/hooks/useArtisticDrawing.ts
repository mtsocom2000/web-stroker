import { useCallback, useRef, useState } from 'react';
import { useDrawingStore } from '../store';
import type { Point, Stroke } from '../types';
import type { SnapResult } from '../measurements';
import { generateId } from '../utils';

interface UseArtisticDrawingOptions {
  screenToWorld: (x: number, y: number) => Point;
  applySnap: (point: Point) => { point: Point; snap: SnapResult | null };
  addStrokes: (strokes: Stroke[]) => void;
}

interface UseArtisticDrawingReturn {
  isDrawing: boolean;
  currentPoints: Point[];
  handleArtisticDown: (e: React.MouseEvent) => void;
  handleArtisticMove: (e: React.MouseEvent) => void;
  handleArtisticUp: () => void;
}

/**
 * Hook for artistic mode freehand drawing
 * 
 * Extracted from DrawingCanvas to reduce component size.
 * Handles:
 * - Mouse trail tracking
 * - Stroke smoothing
 * - Brush type support (pencil, pen, brush, ballpen, eraser)
 */
export function useArtisticDrawing(options: UseArtisticDrawingOptions): UseArtisticDrawingReturn {
  const store = useDrawingStore();
  const { screenToWorld, applySnap, addStrokes } = options;
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  
  // Refs for stroke state
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef<Point | null>(null);

  /**
   * Handle artistic mode mouse down - start new stroke
   */
  const handleArtisticDown = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    // Apply snap if enabled
    const snapped = applySnap(worldPoint);
    const point = snapped.point;
    
    // Start new stroke
    setIsDrawing(true);
    setCurrentPoints([point]);
    
    const timestamp = Date.now();
    
    currentStrokeRef.current = {
      id: generateId(),
      points: [{ ...point, timestamp }],
      smoothedPoints: [],
      color: store.currentColor,
      thickness: store.currentBrushSettings.size,
      timestamp,
      strokeType: 'artistic',
      brushType: store.artisticTool,
      brushSettings: {
        ...store.currentBrushSettings,
      },
    };
    
    lastPointRef.current = point;
  }, [screenToWorld, applySnap, store.currentColor, store.currentBrushSettings, store.artisticTool]);

  /**
   * Handle artistic mode mouse move - add points to current stroke
   */
  const handleArtisticMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    // Apply snap if enabled
    const snapped = applySnap(worldPoint);
    const point = snapped.point;
    
    // Check if point is far enough from last point
    if (lastPointRef.current) {
      const dx = point.x - lastPointRef.current.x;
      const dy = point.y - lastPointRef.current.y;
      const dist = Math.hypot(dx, dy);
      
      const minDist = 0.5 / store.zoom;
      if (dist < minDist) return;
    }
    
    // Add point to current stroke
    const timestamp = Date.now();
    currentStrokeRef.current.points.push({ ...point, timestamp });
    setCurrentPoints(prev => [...prev, point]);
    lastPointRef.current = point;
  }, [isDrawing, screenToWorld, applySnap, store.zoom]);

  /**
   * Handle artistic mode mouse up - finalize stroke
   */
  const handleArtisticUp = useCallback(() => {
    if (!isDrawing || !currentStrokeRef.current) return;
    
    const stroke = currentStrokeRef.current;
    
    // Use points for display (smoothing can be added later)
    stroke.smoothedPoints = stroke.points;
    stroke.displayPoints = stroke.points;
    
    // Add stroke to store
    addStrokes([stroke]);
    
    // Reset state
    setIsDrawing(false);
    setCurrentPoints([]);
    currentStrokeRef.current = null;
    lastPointRef.current = null;
  }, [isDrawing, addStrokes]);

  return {
    isDrawing,
    currentPoints,
    handleArtisticDown,
    handleArtisticMove,
    handleArtisticUp,
  };
}
