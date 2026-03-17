import type { Point } from '../types';

/**
 * View state for coordinate transformations
 */
export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Convert world coordinates to screen coordinates
 * 
 * @param point - World coordinate point
 * @param view - Current view state (zoom, pan)
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Screen coordinates { x, y }
 */
export function worldToScreen(
  point: Point,
  view: ViewState,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: (point.x - view.panX) * view.zoom + width / 2,
    y: height / 2 - (point.y - view.panY) * view.zoom,
  };
}

/**
 * Convert screen coordinates to world coordinates
 * 
 * @param sx - Screen X coordinate
 * @param sy - Screen Y coordinate
 * @param view - Current view state (zoom, pan)
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns World coordinates { x, y }
 */
export function screenToWorld(
  sx: number,
  sy: number,
  view: ViewState,
  width: number,
  height: number
): Point {
  return {
    x: (sx - width / 2) / view.zoom + view.panX,
    y: (height / 2 - sy) / view.zoom + view.panY,
  };
}

/**
 * Convert a distance in world units to screen pixels
 * 
 * @param distance - Distance in world units
 * @param zoom - Current zoom level
 * @returns Distance in screen pixels
 */
export function worldDistanceToScreen(distance: number, zoom: number): number {
  return distance * zoom;
}

/**
 * Convert a distance in screen pixels to world units
 * 
 * @param distance - Distance in screen pixels
 * @param zoom - Current zoom level
 * @returns Distance in world units
 */
export function screenDistanceToWorld(distance: number, zoom: number): number {
  return distance / zoom;
}
