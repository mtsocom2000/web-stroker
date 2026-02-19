import { useEffect, useRef, useState, useCallback } from 'react';
import { useDrawingStore } from '../store';
import type { Point, Stroke } from '../types';
import { generateId, distance } from '../utils';
import { PhysicsSmoother } from '../brush/physicsSmoothing';
import './DrawingCanvas.css';

interface CanvasProps {
  onStrokeComplete?: (stroke: Stroke) => void;
}

export const DrawingCanvas: React.FC<CanvasProps> = ({ onStrokeComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);

  const strokesRef = useRef<Stroke[]>([]);
  const store = useDrawingStore();
  const panRef = useRef({ x: store.panX, y: store.panY, zoom: store.zoom });
  const brushSettingsRef = useRef(store.currentBrushSettings);

  useEffect(() => {
    strokesRef.current = store.strokes;
  }, [store.strokes]);

  useEffect(() => {
    panRef.current = { x: store.panX, y: store.panY, zoom: store.zoom };
  }, [store.panX, store.panY, store.zoom]);

  useEffect(() => {
    brushSettingsRef.current = store.currentBrushSettings;
  }, [store.currentBrushSettings]);

  const worldToScreen = useCallback((x: number, y: number) => {
    const { x: panX, y: panY, zoom } = panRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    return {
      x: (x - panX) * zoom + width / 2,
      y: height / 2 - (y - panY) * zoom
    };
  }, []);

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const { x: panX, y: panY, zoom } = panRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    return {
      x: (screenX - width / 2) / zoom + panX,
      y: (height / 2 - screenY) / zoom + panY
    };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height, panRef.current);

    strokesRef.current.forEach((stroke) => {
      const points = stroke.displayPoints ?? stroke.smoothedPoints;
      if (points.length < 2) return;
      const opacity = stroke.brushSettings?.opacity ?? 1;
      drawStroke(ctx, points, stroke.color, stroke.thickness, worldToScreen, opacity);
    });

    if (currentStrokePoints.length > 1) {
      drawStroke(ctx, currentStrokePoints, store.currentColor, store.currentBrushSettings.size, worldToScreen, store.currentBrushSettings.opacity);
    }
  }, [currentStrokePoints, store.currentColor, store.currentBrushSettings.size, store.currentBrushSettings.opacity, worldToScreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  const distanceToSegment = useCallback((point: { x: number; y: number }, segStart: Point, segEnd: Point): number => {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-10) {
      return Math.hypot(point.x - segStart.x, point.y - segStart.y);
    }

    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = segStart.x + t * dx;
    const projY = segStart.y + t * dy;

    return Math.hypot(point.x - projX, point.y - projY);
  }, []);

  const findStrokeAtPosition = useCallback((world: { x: number; y: number }): string | null => {
    const { zoom } = panRef.current;
    const clickThreshold = 5.0 / zoom;

    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const stroke = strokesRef.current[i];
      const points = stroke.displayPoints ?? stroke.smoothedPoints;
      if (points.length < 2) continue;

      for (let j = 0; j < points.length - 1; j++) {
        const dist = distanceToSegment(world, points[j], points[j + 1]);
        if (dist <= clickThreshold) {
          return stroke.id;
        }
      }
    }

    return null;
  }, [distanceToSegment]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (!world) return;

    if (store.mode === 'select') {
      const clickedStrokeId = findStrokeAtPosition(world);

      if (e.ctrlKey || e.metaKey) {
        if (clickedStrokeId) {
          store.toggleSelection(clickedStrokeId);
        }
      } else if (clickedStrokeId) {
        store.setSelectedStrokeIds([clickedStrokeId]);
      } else {
        store.clearSelection();
      }

      if (store.selectedStrokeIds.length > 0 || clickedStrokeId) {
        setIsDragging(true);
        setDragStart(world);
      }
      return;
    }

    const timestamp = Date.now();
    setIsDrawing(true);
    setCurrentStrokePoints([{ ...world, timestamp }]);
  }, [store, screenToWorld, findStrokeAtPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const newPanX = panRef.current.x - dx / panRef.current.zoom;
      const newPanY = panRef.current.y + dy / panRef.current.zoom;
      store.setPan(newPanX, newPanY);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDragging && store.mode === 'select' && store.selectedStrokeIds.length > 0) {
      if (!world) return;
      const dx = world.x - dragStart.x;
      const dy = world.y - dragStart.y;
      store.selectedStrokeIds.forEach((strokeId) => {
        const stroke = strokesRef.current.find((s) => s.id === strokeId);
        if (stroke) {
          const movePoints = (points: Point[]): Point[] =>
            points.map((p) => ({ x: p.x + dx, y: p.y + dy, timestamp: p.timestamp }));
          store.updateStroke(strokeId, {
            ...stroke,
            points: movePoints(stroke.points),
            smoothedPoints: movePoints(stroke.smoothedPoints),
            displayPoints: stroke.displayPoints ? movePoints(stroke.displayPoints) : undefined,
          });
        }
      });
      setDragStart(world);
      return;
    }

    if (!isDrawing || !world) return;

    const lastPoint = currentStrokePoints[currentStrokePoints.length - 1];
    if (distance(lastPoint, world) > 0.1) {
      setCurrentStrokePoints((prev) => [...prev, { ...world, timestamp: Date.now() }]);
    }
  }, [isPanning, isDragging, isDrawing, panStart, store, screenToWorld, currentStrokePoints, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDragging && store.mode === 'select') {
      setIsDragging(false);
      setDragStart({ x: 0, y: 0 });
      return;
    }

    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentStrokePoints.length > 1) {
      const smoother = new PhysicsSmoother();
      const smoothedPoints = smoother.smooth(currentStrokePoints);

      const stroke: Stroke = {
        id: generateId(),
        points: currentStrokePoints,
        smoothedPoints: smoothedPoints,
        color: store.currentColor,
        thickness: store.currentBrushSettings.size,
        timestamp: Date.now(),
        brushType: store.currentBrushType,
        brushSettings: {
          size: store.currentBrushSettings.size,
          opacity: store.currentBrushSettings.opacity,
          hardness: store.currentBrushSettings.hardness,
          spacing: store.currentBrushSettings.spacing,
          curvatureAdaptation: store.currentBrushSettings.curvatureAdaptation,
        },
      };

      store.addStroke(stroke);
      onStrokeComplete?.(stroke);
    }

    setCurrentStrokePoints([]);
  }, [isPanning, isDragging, isDrawing, currentStrokePoints, store, onStrokeComplete]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = store.zoom + delta;
      store.setZoom(newZoom);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [store]);

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="drawing-canvas" />
    </div>
  );
};

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number; zoom: number }
): void {
  const { x: panX, y: panY, zoom } = pan;
  const gridSize = 50;
  const majorInterval = 5;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const visibleLeftWorld = (-halfWidth / zoom) + panX;
  const visibleRightWorld = (halfWidth / zoom) + panX;
  const visibleTopWorld = (halfHeight / zoom) + panY;
  const visibleBottomWorld = (-halfHeight / zoom) + panY;

  const startX = Math.floor(visibleLeftWorld / gridSize) * gridSize;
  const endX = Math.ceil(visibleRightWorld / gridSize) * gridSize;
  const startY = Math.floor(visibleBottomWorld / gridSize) * gridSize;
  const endY = Math.ceil(visibleTopWorld / gridSize) * gridSize;

  ctx.font = '10px sans-serif';

  const originX = (0 - panX) * zoom + halfWidth;
  const originY = halfHeight - (0 - panY) * zoom;

  for (let worldX = startX; worldX <= endX; worldX += gridSize) {
    const screenX = (worldX - panX) * zoom + halfWidth;
    const isMajor = worldX === 0 || worldX % (gridSize * majorInterval) === 0;

    if (screenX >= 0 && screenX <= width) {
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.strokeStyle = isMajor ? '#c0c0c0' : '#e8e8e8';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const labelY = originY + (originY > 0 && originY < height ? 12 : -6);
        ctx.fillText(Math.round(worldX).toString(), screenX, labelY);
      }
    }
  }

  for (let worldY = startY; worldY <= endY; worldY += gridSize) {
    const screenY = halfHeight - (worldY - panY) * zoom;
    const isMajor = worldY === 0 || worldY % (gridSize * majorInterval) === 0;

    if (screenY >= 0 && screenY <= height) {
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.strokeStyle = isMajor ? '#c0c0c0' : '#e8e8e8';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#555';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const labelX = originX > 0 && originX < width ? originX - 6 : 12;
        ctx.fillText(Math.round(worldY).toString(), labelX, screenY);
      }
    }
  }

  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 2;

  if (originX >= 0 && originX <= width) {
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();
  }

  if (originY >= 0 && originY <= height) {
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
  }

  if (originX >= 4 && originX <= width - 4 && originY >= 4 && originY <= height - 4) {
    ctx.beginPath();
    ctx.arc(originX, originY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#404040';
    ctx.fill();
  }
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  thickness: number,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  opacity: number
): void {
  if (points.length < 2) return;

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;

  const radius = thickness / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = worldToScreen(points[i].x, points[i].y);
    const p2 = worldToScreen(points[i + 1].x, points[i + 1].y);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.5) {
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const numSteps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
    for (let j = 0; j <= numSteps; j++) {
      const t = j / numSteps;
      const x = p1.x + dx * t;
      const y = p1.y + dy * t;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const lastPoint = worldToScreen(points[points.length - 1].x, points[points.length - 1].y);
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}
