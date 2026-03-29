import { useRef, useCallback } from 'react';
import { useDrawingStore } from '../store';
import type { Point } from '../types';
import type { SnapResult } from '../measurements';
import { distance } from '../utils';

/**
 * Hook for snap system and coordinate transformations
 * 
 * Extracted from DrawingCanvas to reduce component size.
 * Handles:
 * - World/screen coordinate conversions
 * - Snap point detection (integer, stroke points, intersections, origin)
 * - Snap indicator rendering
 * 
 * @returns Snap system API
 */
export function useSnapSystem() {
  const store = useDrawingStore();
  
  // Refs for current state (avoid re-creating callbacks)
  const currentSnapRef = useRef<SnapResult | null>(null);
  const snapThresholdRef = useRef(5);
  const panRef = useRef({ x: store.panX, y: store.panY, zoom: store.zoom });

  // Update refs when store changes
  panRef.current = { x: store.panX, y: store.panY, zoom: store.zoom };
  snapThresholdRef.current = store.snapThreshold;

  /**
   * Convert world coordinates to screen coordinates
   */
  const worldToScreen = useCallback((point: Point): { x: number; y: number } => {
    const panState = panRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      x: (point.x - panState.x) * panState.zoom + width / 2,
      y: height / 2 - (point.y - panState.y) * panState.zoom,
    };
  }, []);

  /**
   * Convert screen coordinates to world coordinates
   */
  const screenToWorld = useCallback((screenX: number, screenY: number): Point => {
    const panState = panRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      x: (screenX - width / 2) / panState.zoom + panState.x,
      y: (height / 2 - screenY) / panState.zoom + panState.y,
    };
  }, []);

  /**
   * Find the closest integer point within threshold
   */
  const findIntegerSnap = useCallback((point: Point, threshold: number): Point | null => {
    const { zoom } = panRef.current;
    const screenThreshold = threshold / zoom;
    
    const xInt = Math.round(point.x);
    const yInt = Math.round(point.y);
    
    const dx = Math.abs(point.x - xInt);
    const dy = Math.abs(point.y - yInt);
    
    if (dx <= screenThreshold && dy <= screenThreshold) {
      return { x: xInt, y: yInt };
    }
    
    return null;
  }, []);

  /**
   * Find the closest stroke point within threshold
   */
  const findStrokePointSnap = useCallback(
    (point: Point, threshold: number, excludeStrokeId?: string): Point | null => {
      const { zoom } = panRef.current;
      const screenThreshold = threshold / zoom;
      const strokes = useDrawingStore.getState().strokes;

      let closest: Point | null = null;
      let minDist = screenThreshold;

      for (const stroke of strokes) {
        if (stroke.id === excludeStrokeId) continue;

        const points = stroke.displayPoints ?? stroke.smoothedPoints ?? stroke.points;
        for (const p of points) {
          const dist = distance(point, p);
          if (dist < minDist) {
            minDist = dist;
            closest = p;
          }
        }
      }

      return closest;
    },
    []
  );

  /**
   * Check if point is close to origin
   */
  const findOriginSnap = useCallback((point: Point, threshold: number): Point | null => {
    const { zoom } = panRef.current;
    const screenThreshold = threshold / zoom;
    
    const distToOrigin = Math.hypot(point.x, point.y);
    
    if (distToOrigin <= screenThreshold) {
      return { x: 0, y: 0 };
    }
    
    return null;
  }, []);

  /**
   * Apply snap to a point based on current settings
   * 
   * @param point - The point to snap
   * @returns Snapped point and snap result
   */
  const applySnap = useCallback(
    (point: Point): { point: Point; snap: SnapResult | null } => {
      if (!store.snapEnabled || store.toolCategory !== 'digital') {
        return { point, snap: null };
      }

      const threshold = snapThresholdRef.current;
      currentSnapRef.current = null;

      // Priority 1: Origin
      const originSnap = findOriginSnap(point, threshold);
      if (originSnap) {
        currentSnapRef.current = { type: 'origin', point: originSnap, distance: 0 };
        return { point: originSnap, snap: currentSnapRef.current };
      }

      // Priority 2: Integer grid points
      const integerSnap = findIntegerSnap(point, threshold);
      if (integerSnap) {
        const dist = Math.hypot(point.x - integerSnap.x, point.y - integerSnap.y);
        currentSnapRef.current = { type: 'integer', point: integerSnap, distance: dist };
        return { point: integerSnap, snap: currentSnapRef.current };
      }

      // Priority 3: Stroke points
      const strokePointSnap = findStrokePointSnap(point, threshold);
      if (strokePointSnap) {
        const dist = distance(point, strokePointSnap);
        currentSnapRef.current = { type: 'strokePoint', point: strokePointSnap, distance: dist };
        return { point: strokePointSnap, snap: currentSnapRef.current };
      }

      // No snap found
      return { point, snap: null };
    },
    [store.snapEnabled, store.toolCategory, findOriginSnap, findIntegerSnap, findStrokePointSnap]
  );

  /**
   * Get current snap result
   */
  const getCurrentSnap = useCallback((): SnapResult | null => {
    return currentSnapRef.current;
  }, []);

  /**
   * Clear current snap
   */
  const clearSnap = useCallback(() => {
    currentSnapRef.current = null;
  }, []);

  return {
    // Coordinate transformations
    worldToScreen,
    screenToWorld,
    
    // Snap functions
    applySnap,
    getCurrentSnap,
    clearSnap,
    
    // Current snap state
    currentSnap: currentSnapRef.current,
  };
}
