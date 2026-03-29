import { useCallback, useRef, useState } from 'react';
import { useDrawingStore } from '../store';
import type { Point } from '../types';
import type { SnapResult } from '../measurements';

interface UseMeasureToolsOptions {
  screenToWorld: (x: number, y: number) => Point;
  applySnap: (point: Point) => { point: Point; snap: SnapResult | null };
}

interface MeasurePreview {
  startPoint: Point;
  endPoint: Point;
  value: number;
}

interface UseMeasureToolsReturn {
  measurePreview: MeasurePreview | null;
  handleMeasureDown: (e: React.MouseEvent) => void;
  handleMeasureMove: (e: React.MouseEvent) => void;
  handleMeasureUp: () => void;
}

/**
 * Hook for measurement tools (distance, angle, radius, face area)
 * 
 * Extracted from DrawingCanvas to reduce component size.
 * Handles:
 * - Distance measurement (point-to-point or along line)
 * - Angle measurement (between two lines)
 * - Radius measurement (for circles/arcs)
 * - Face area calculation
 */
export function useMeasureTools(options: UseMeasureToolsOptions): UseMeasureToolsReturn {
  const store = useDrawingStore();
  const { screenToWorld, applySnap } = options;
  
  const [measurePreview, setMeasurePreview] = useState<MeasurePreview | null>(null);
  
  // Refs for measure state
  const measureStartPointRef = useRef<Point | null>(null);
  const measureEndPointRef = useRef<Point | null>(null);
  const firstLineRef = useRef<{ strokeId: string; segmentIndex: number } | null>(null);
  const secondLineRef = useRef<{ strokeId: string; segmentIndex: number } | null>(null);

  /**
   * Handle measure tool mouse down
   */
  const handleMeasureDown = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    // Apply snap if enabled
    const snapped = applySnap(worldPoint);
    const point = snapped.point;
    
    const measureTool = store.measureTool;
    
    if (measureTool === 'distance') {
      // Distance measurement: click two points
      if (!measureStartPointRef.current) {
        // First click - set start point
        measureStartPointRef.current = point;
        store.setMeasureStartPoint(point);
      } else {
        // Second click - set end point and complete measurement
        measureEndPointRef.current = point;
        store.setMeasureEndPoint(point);
        
        // Calculate distance
        const dx = point.x - measureStartPointRef.current.x;
        const dy = point.y - measureStartPointRef.current.y;
        const distance = Math.hypot(dx, dy);
        
        setMeasurePreview({
          startPoint: measureStartPointRef.current,
          endPoint: point,
          value: distance,
        });
      }
    } else if (measureTool === 'angle') {
      // Angle measurement: select two lines
      // TODO: Implement line selection
      console.log('[useMeasureTools] Angle measurement - line selection not yet implemented');
    } else if (measureTool === 'radius') {
      // Radius measurement: click on circle/arc
      // TODO: Implement circle/arc detection
      console.log('[useMeasureTools] Radius measurement - circle detection not yet implemented');
    } else if (measureTool === 'face') {
      // Face area: select closed region
      // TODO: Implement closed region detection
      console.log('[useMeasureTools] Face area - region detection not yet implemented');
    }
  }, [screenToWorld, applySnap, store.measureTool, store]);

  /**
   * Handle measure tool mouse move
   */
  const handleMeasureMove = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    // Apply snap if enabled
    const snapped = applySnap(worldPoint);
    const point = snapped.point;
    
    const measureTool = store.measureTool;
    
    if (measureTool === 'distance' && measureStartPointRef.current) {
      // Update preview while dragging
      const dx = point.x - measureStartPointRef.current.x;
      const dy = point.y - measureStartPointRef.current.y;
      const distance = Math.hypot(dx, dy);
      
      setMeasurePreview({
        startPoint: measureStartPointRef.current,
        endPoint: point,
        value: distance,
      });
    }
  }, [screenToWorld, applySnap, store.measureTool]);

  /**
   * Handle measure tool mouse up
   */
  const handleMeasureUp = useCallback(() => {
    // Reset if measurement completed
    if (measureEndPointRef.current) {
      // Measurement complete
      measureStartPointRef.current = null;
      measureEndPointRef.current = null;
      firstLineRef.current = null;
      secondLineRef.current = null;
      setMeasurePreview(null);
    }
  }, []);

  return {
    measurePreview,
    handleMeasureDown,
    handleMeasureMove,
    handleMeasureUp,
  };
}
