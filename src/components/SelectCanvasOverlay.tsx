import { useEffect, useRef, useCallback } from 'react';
import { useDrawingStore } from '../store';
import { useSelectTool } from '../hooks/useSelectTool';
import { useDragHint } from '../hooks/useDragHint';
import type { Point } from '../types';

interface SelectCanvasOverlayProps {
  worldToScreen: (point: Point) => { x: number; y: number };
  screenToWorld: (x: number, y: number) => Point;
}

/**
 * Select Canvas Overlay
 * Handles select tool interactions (click to select, drag to move)
 * This overlay sits on top of the canvas and handles select-specific interactions
 */
export function SelectCanvasOverlay({ worldToScreen, screenToWorld }: SelectCanvasOverlayProps) {
  const store = useDrawingStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  
  const selectTool = useSelectTool({ screenToWorld });
  const dragHint = useDragHint();

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (store.activeTool !== 'select') return;
    
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenPoint: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    const element = selectTool.handleSelectClick(screenPoint);
    
    if (element) {
      const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
      selectTool.handleDragStart(element, worldPoint);
      isDraggingRef.current = true;
    }
  }, [store.activeTool, selectTool, screenToWorld]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || store.activeTool !== 'select') return;
    
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenPoint: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    selectTool.handleDragMove(worldPoint);
  }, [isDraggingRef, store.activeTool, selectTool, screenToWorld]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current && store.activeTool === 'select') {
      selectTool.handleDragEnd();
      isDraggingRef.current = false;
    }
  }, [isDraggingRef, store.activeTool, selectTool]);

  // Global mouse up listener to catch mouse release outside overlay
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current && store.activeTool === 'select') {
        selectTool.handleDragEnd();
        isDraggingRef.current = false;
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [store.activeTool, selectTool]);

  // Don't render if not in select mode
  if (store.activeTool !== 'select') {
    return null;
  }

  // Get hint text and position
  const hintText = dragHint.getHintText();
  const hintPos = dragHint.getHintPosition();
  const screenHintPos = hintText ? worldToScreen(hintPos) : null;

  return (
    <>
      {/* Transparent overlay for mouse events */}
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          cursor: isDraggingRef.current ? 'grabbing' : 'crosshair',
          zIndex: 100,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      
      {/* Drag hint label */}
      {hintText && screenHintPos && (
        <div
          style={{
            position: 'absolute',
            left: screenHintPos.x,
            top: screenHintPos.y,
            backgroundColor: '#ff5722',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 101,
            transform: 'translate(-50%, -100%)',
            whiteSpace: 'nowrap',
          }}
        >
          {hintText}
        </div>
      )}
    </>
  );
}
