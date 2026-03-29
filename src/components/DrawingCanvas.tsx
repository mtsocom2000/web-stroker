import { useEffect, useRef, useState, useCallback } from 'react';
import { useDrawingStore } from '../store';
import { ClosedAreaManager } from '../fillRegion';
import { IntersectionManager } from '../intersection/IntersectionManager';
import type { Renderer } from '../renderers/Renderer';
import { Canvas2DRenderer, WebGLRenderer } from '../renderers';
import { DrawingCommander } from '../controllers/DrawingCommander';
import { getDrawingStateManager } from '../managers/DrawingStateManager';
import { useSnapSystem } from '../hooks/useSnapSystem';
import { useSelectTool } from '../hooks/useSelectTool';
import { useMeasureTools } from '../hooks/useMeasureTools';
import { useArtisticDrawing } from '../hooks/useArtisticDrawing';
import { useDigitalDrawing } from '../hooks/useDigitalDrawing';
import { drawGrid } from '../utils/canvasDrawing';
import './DrawingCanvas.css';

export const DrawingCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const commanderRef = useRef<DrawingCommander | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closedAreaManagerRef = useRef<ClosedAreaManager | null>(null);
  const intersectionManagerRef = useRef<IntersectionManager | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const store = useDrawingStore();

  // New architecture hooks
  const { worldToScreen, screenToWorld, applySnap, currentSnap } = useSnapSystem();
  const { handleSelectDown, handleSelectMove, handleSelectUp } = useSelectTool({ screenToWorld });
  const { measurePreview, handleMeasureDown, handleMeasureMove, handleMeasureUp } = useMeasureTools({ screenToWorld, applySnap });
  const { isDrawing, currentPoints, handleArtisticDown, handleArtisticMove, handleArtisticUp } = useArtisticDrawing({
    screenToWorld,
    applySnap,
    addStrokes: (strokes) => {
      strokes.forEach(stroke => store.addStroke(stroke));
    },
  });
  const {
    linePoints,
    circleCenter,
    circleRadiusPoint,
    arcPoints,
    arcRadiusPoint,
    curvePoints,
    handleDigitalDown,
    handleDigitalMove,
    handleDigitalUp,
  } = useDigitalDrawing({
    screenToWorld,
    applySnap,
    addStrokes: (strokes) => {
      strokes.forEach(stroke => store.addStroke(stroke));
    },
  });

  // Sync digital drawing state with commander
  useEffect(() => {
    if (commanderRef.current) {
      if (store.digitalTool === 'line') {
        commanderRef.current.setLinePreview(linePoints, linePoints.length > 1 ? linePoints[1] : null);
      } else if (store.digitalTool === 'circle' && circleCenter) {
        commanderRef.current.setCirclePreview(circleCenter, circleRadiusPoint);
      } else if (store.digitalTool === 'arc') {
        commanderRef.current.setArcPreview(arcPoints, arcRadiusPoint);
      } else if (store.digitalTool === 'curve') {
        commanderRef.current.setCurvePreview(curvePoints);
      }
    }
  }, [store.digitalTool, linePoints, circleCenter, circleRadiusPoint, arcPoints, arcRadiusPoint, curvePoints]);

  // Initialize renderer and commander
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Initialize renderer
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    const renderer = store.renderer === 'threejs' ? new WebGLRenderer() : new Canvas2DRenderer();
    renderer.initialize(container);
    renderer.setViewState(store.zoom, store.panX, store.panY);
    rendererRef.current = renderer;

    // Initialize commander
    const stateManager = getDrawingStateManager();
    const commander = new DrawingCommander(stateManager, renderer);
    commanderRef.current = commander;
    stateManager.setStrokes(store.strokes);
    stateManager.syncFromStore({
      strokes: store.strokes,
      selectedStrokeIds: store.selectedDigitalStrokeIds,
      selectMode: store.selectMode,
      selectedElements: store.selectedElements,
      hoveredDigitalStrokeId: store.hoveredDigitalStrokeId,
      toolCategory: store.toolCategory,
      digitalMode: store.digitalMode,
      digitalTool: store.digitalTool,
      activeTool: store.activeTool,
      measureTool: store.measureTool ?? undefined,
      measureFirstLine: store.measureFirstLine,
      measureSecondLine: store.measureSecondLine,
      measureStartPoint: store.measureStartPoint,
      measureEndPoint: store.measureEndPoint,
    });

    // Initialize managers
    closedAreaManagerRef.current = new ClosedAreaManager();
    intersectionManagerRef.current = new IntersectionManager();

    // Resize handler
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      renderer.resize();
    };
    resize();
    window.addEventListener('resize', resize);

    // Animation loop
    const animate = () => {
      if (commanderRef.current) {
        commanderRef.current.render();
      }
      render2DUI();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    // 2D UI rendering
    function render2DUI() {
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Draw grid
      drawGrid(ctx, width, height, { x: store.panX, y: store.panY, zoom: store.zoom }, store.toolCategory, store.pixelsPerUnit);

      // Draw snap indicator
      if (currentSnap && (store.toolCategory === 'digital' || store.toolCategory === 'measure')) {
        const { panX, panY, zoom } = store;
        const screenX = (currentSnap.point.x - panX) * zoom + width / 2;
        const screenY = height / 2 - (currentSnap.point.y - panY) * zoom;

        const snapColors: Record<string, string> = {
          integer: '#00bcd4',
          strokePoint: '#e91e63',
          intersection: '#ffeb3b',
          origin: '#4caf50',
          polylinePoint: '#9c27b0',
        };

        const color = snapColors[currentSnap.type] ?? '#00bcd4';

        ctx.beginPath();
        ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw measure preview
      if (measurePreview && store.toolCategory === 'measure' && store.measureTool === 'distance') {
        const { startPoint, endPoint } = measurePreview;
        const { panX, panY, zoom } = store;

        const startScreenX = (startPoint.x - panX) * zoom + width / 2;
        const startScreenY = height / 2 - (startPoint.y - panY) * zoom;
        const endScreenX = (endPoint.x - panX) * zoom + width / 2;
        const endScreenY = height / 2 - (endPoint.y - panY) * zoom;

        // Draw dashed line
        ctx.beginPath();
        ctx.moveTo(startScreenX, startScreenY);
        ctx.lineTo(endScreenX, endScreenY);
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw end points
        ctx.beginPath();
        ctx.arc(startScreenX, startScreenY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5722';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(endScreenX, endScreenY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw measurement label
        const midX = (startScreenX + endScreenX) / 2;
        const midY = (startScreenY + endScreenY) / 2;
        const distance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
        const value = (distance / store.pixelsPerUnit).toFixed(2);
        ctx.fillStyle = '#000000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${value} ${store.unit}`, midX, midY - 10);
      }

      // Draw artistic drawing preview
      if (isDrawing && currentPoints.length > 0 && store.toolCategory === 'artistic') {
        ctx.beginPath();
        const first = worldToScreen(currentPoints[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < currentPoints.length; i++) {
          const p = worldToScreen(currentPoints[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = store.currentColor;
        ctx.lineWidth = store.currentBrushSettings.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [store.renderer, store.zoom, store.panX, store.panY, store.strokes]);

  // Event routing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click for panning
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (store.activeTool === 'select') {
      handleSelectDown(e);
    } else if (store.toolCategory === 'measure') {
      handleMeasureDown(e);
    } else if (store.toolCategory === 'artistic') {
      handleArtisticDown(e);
    } else if (store.toolCategory === 'digital') {
      handleDigitalDown(e);
    }
  }, [store.activeTool, store.toolCategory, handleSelectDown, handleMeasureDown, handleArtisticDown, handleDigitalDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const zoom = store.zoom;
      store.setPan(store.panX + dx / zoom, store.panY - dy / zoom);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (store.activeTool === 'select') {
      handleSelectMove(e);
    } else if (store.toolCategory === 'measure') {
      handleMeasureMove(e);
    } else if (store.toolCategory === 'artistic') {
      handleArtisticMove(e);
    } else if (store.toolCategory === 'digital') {
      handleDigitalMove(e);
    }
  }, [isPanning, panStart, store, handleSelectMove, handleMeasureMove, handleArtisticMove, handleDigitalMove]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (store.activeTool === 'select') {
      handleSelectUp();
    } else if (store.toolCategory === 'measure') {
      handleMeasureUp();
    } else if (store.toolCategory === 'artistic') {
      handleArtisticUp();
    } else if (store.toolCategory === 'digital') {
      handleDigitalUp();
    }
  }, [isPanning, store.activeTool, store.toolCategory, handleSelectUp, handleMeasureUp, handleArtisticUp, handleDigitalUp]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(5.0, store.zoom * zoomFactor));
    store.setZoom(newZoom);
  }, [store.zoom, store.setZoom]);

  return (
    <div ref={containerRef} className="drawing-canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};
