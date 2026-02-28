import { useEffect, useRef, useState, useCallback } from 'react';
import { useDrawingStore } from '../store';
import type { Point, Stroke, DigitalSegment } from '../types';
import { generateId, distance } from '../utils';
import { simplifyStroke } from '../brush/strokeSimplifier';
import { predictShape } from '../shapeRecognition';
import { ClosedAreaManager } from '../fillRegion';
import { IntersectionManager } from '../intersection/IntersectionManager';
import { formatLength, formatAngle, getAcuteAngle, distance as calcDistance, angleBetween } from '../measurements';
import './DrawingCanvas.css';

interface CanvasProps {
  onStrokeComplete?: (stroke: Stroke) => void;
}

export const DrawingCanvas: React.FC<CanvasProps> = ({ onStrokeComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closedAreaManagerRef = useRef<ClosedAreaManager | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingArea, setIsDraggingArea] = useState(false);
  const [lastDragPoint, setLastDragPoint] = useState<Point | null>(null);
  const [draggedStrokeIds, setDraggedStrokeIds] = useState<string[]>([]);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);
  
  // Digital line drawing state
  const [digitalLinePoints, setDigitalLinePoints] = useState<Point[]>([]);
  const [digitalLinePreviewEnd, setDigitalLinePreviewEnd] = useState<Point | null>(null);
  
  // Circle drawing state
  const [circleCenter, setCircleCenter] = useState<Point | null>(null);
  const [circleRadiusPoint, setCircleRadiusPoint] = useState<Point | null>(null);
  const [circlePoints, setCirclePoints] = useState<Point[]>([]);
  
  // Curve drawing state  
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  
  // Digital selection/dragging state
  const [hoveredDigitalElement, setHoveredDigitalElement] = useState<{
    strokeId: string;
    segmentIndex: number;
    pointIndex: number;
    type: 'endpoint' | 'control';
  } | null>(null);
  
  const [selectedDigitalElements, setSelectedDigitalElements] = useState<{
    strokeId: string;
    segmentIndex: number;
    pointIndex: number;
    type: 'endpoint' | 'control';
  }[]>([]);
  
  const [isDraggingDigital, setIsDraggingDigital] = useState(false);
  const [digitalDragStart, setDigitalDragStart] = useState<Point | null>(null);
  const [selectedIntersection, setSelectedIntersection] = useState<{
    point: Point;
    segments: Array<{ strokeId: string; segmentIndex: number }>;
  } | null>(null);

  // Track modified stroke IDs during drag for persistence on dragEnd
  const modifiedStrokeIdsRef = useRef<Set<string>>(new Set());

  // Track drag state to skip expensive operations during drag
  const isDraggingRef = useRef(false);

  // Intersection manager for efficient incremental updates
  const intersectionManagerRef = useRef<IntersectionManager | null>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const store = useDrawingStore();
  const panRef = useRef({ x: store.panX, y: store.panY, zoom: store.zoom });
  const brushSettingsRef = useRef(store.currentBrushSettings);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    closedAreaManagerRef.current = new ClosedAreaManager();
    intersectionManagerRef.current = new IntersectionManager();
    
    if (intersectionManagerRef.current) {
      intersectionManagerRef.current.setSegmentPointsGetter((id: string) => {
        const [strokeId, segmentIndex] = id.split(':');
        const stroke = strokesRef.current.find(s => s.id === strokeId);
        if (!stroke || !stroke.digitalSegments) return null;
        const seg = stroke.digitalSegments[parseInt(segmentIndex, 10)];
        if (!seg || seg.points.length < 2) return null;
        return [seg.points[0], seg.points[seg.points.length - 1]];
      });
    }
  }, []);

  useEffect(() => {
    strokesRef.current = store.strokes;
    
    // Rebuild spatial index for intersection calculation
    if (intersectionManagerRef.current) {
      intersectionManagerRef.current.buildFromStrokes(store.strokes);
    }
    
    // Only rebuild closed areas in select mode - skip during drawing for performance
    const isInSelectMode = (store.toolCategory === 'digital' && store.digitalMode === 'select') || 
                           (store.toolCategory === 'artistic' && store.mode === 'select');
    
    if (closedAreaManagerRef.current && isInSelectMode) {
      const digitalStrokeData = store.strokes
        .filter(s => s.strokeType === 'digital')
        .map(s => ({
          id: s.id,
          points: s.displayPoints ?? s.smoothedPoints ?? s.points,
          displayPoints: s.displayPoints,
          digitalSegments: s.digitalSegments,
          isClosed: s.isClosed,
        }));
      closedAreaManagerRef.current.setStrokes(digitalStrokeData);
    }
  }, [store.strokes, store.toolCategory, store.digitalMode, store.mode]);

  // Rebuild closed areas when switching to select mode (with debounce)
  useEffect(() => {
    const isInSelectMode = (store.toolCategory === 'digital' && store.digitalMode === 'select') || 
                           (store.toolCategory === 'artistic' && store.mode === 'select');
    
    if (isInSelectMode && closedAreaManagerRef.current) {
      const digitalStrokeData = store.strokes
        .filter(s => s.strokeType === 'digital')
        .map(s => ({
          id: s.id,
          points: s.displayPoints ?? s.smoothedPoints ?? s.points,
          displayPoints: s.displayPoints,
          digitalSegments: s.digitalSegments,
          isClosed: s.isClosed,
        }));
      
      // Skip rebuild during drag to avoid freeze
      if (isDraggingRef.current) {
        return;
      }
      
      // Use setTimeout for longer debounce to avoid blocking UI
      const timeoutId = setTimeout(() => {
        if (!isDraggingRef.current && closedAreaManagerRef.current) {
          closedAreaManagerRef.current.setStrokes(digitalStrokeData);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [store.toolCategory, store.digitalMode, store.mode]);

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

    const { toolCategory, pixelsPerUnit } = store;
    drawGrid(ctx, width, height, panRef.current, toolCategory, pixelsPerUnit);

    if (closedAreaManagerRef.current) {
      const { x: panX, y: panY, zoom } = panRef.current;
      
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, -zoom);
      ctx.translate(-panX, -panY);
      
      closedAreaManagerRef.current.render(ctx);
      
      ctx.restore();
    }

    // Draw digital strokes (lines, circles, curves)
    const isInSelectMode = (store.toolCategory === 'digital' && store.digitalMode === 'select') || 
                           (store.toolCategory === 'artistic' && store.mode === 'select');
    
    // Get hovered area stroke IDs if in select mode
    let hoveredAreaStrokeIds: string[] = [];
    if (isInSelectMode && closedAreaManagerRef.current) {
      const hoveredAreaId = closedAreaManagerRef.current.getHoveredAreaId();
      if (hoveredAreaId) {
        const hoveredArea = closedAreaManagerRef.current.getClosedAreas().find(a => a.id === hoveredAreaId);
        if (hoveredArea) {
          hoveredAreaStrokeIds = hoveredArea.strokeIds;
        }
      }
    }
    
    strokesRef.current.forEach((stroke) => {
      if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) return;
      
      stroke.digitalSegments.forEach((segment, segIdx) => {
        const isHovered = hoveredDigitalElement?.strokeId === stroke.id && 
                        hoveredDigitalElement?.segmentIndex === segIdx;
        
        const isSelected = selectedDigitalElements.some(
          sel => sel.strokeId === stroke.id && sel.segmentIndex === segIdx
        );
        
        // Check if this segment's stroke is part of the hovered closed area
        const isPartOfHoveredArea = hoveredAreaStrokeIds.includes(stroke.id);

        if (segment.type === 'line') {
          drawDigitalLine(ctx, segment.points, segment.color, worldToScreen, isHovered || isPartOfHoveredArea, isSelected);
        } else if (segment.type === 'arc' && segment.arcData) {
          drawDigitalArc(ctx, segment.arcData, segment.color, worldToScreen, panRef.current.zoom, isHovered || isPartOfHoveredArea, isSelected);
        } else if (segment.type === 'bezier') {
          drawDigitalBezier(ctx, segment.points, segment.color, worldToScreen, isHovered || isPartOfHoveredArea, isSelected);
        }

        // Draw endpoint indicators if hovered, selected, or part of hovered closed area
        if (isHovered || isSelected || isPartOfHoveredArea) {
          segment.points.forEach((point, pointIdx) => {
            const screen = worldToScreen(point.x, point.y);
            const isEndpoint = segment.type !== 'bezier' || pointIdx < 2;
            const size = isEndpoint ? 6 : 4;
            let color = '#2196f3';
            if (isSelected) color = '#ff6b6b';
            else if (isPartOfHoveredArea) color = '#ff9800';
            drawEndpointIndicator(ctx, screen, size, color);
          });
        }
      });
    });

    // Draw intersection points (crosses) in select mode
    // Use lazy calculation - only find intersections near mouse when hovering
    if (isInSelectMode && store.toolCategory === 'digital' && !isDraggingDigital) {
      const mousePos = lastMousePosRef.current;
      if (mousePos) {
        // Use lazy spatial search instead of O(n²) full calculation
        const nearbyIntersections = findNearbyIntersectionsWithSpatialIndex(mousePos, 30);
        
        // Draw only nearby intersection points (lazy rendering)
        nearbyIntersections.forEach(int => {
          const screen = worldToScreen(int.point.x, int.point.y);
          drawCrossIndicator(ctx, screen, 8, '#4caf50');
        });
      }
    }
    
    // During drag, draw only the selected intersection if any
    if (isDraggingDigital && selectedIntersection) {
      const screen = worldToScreen(selectedIntersection.point.x, selectedIntersection.point.y);
      drawCrossIndicator(ctx, screen, 8, '#ff6b6b');
    }

    // Draw digital line preview
    if (store.toolCategory === 'digital' && store.digitalMode === 'draw') {
      if (store.digitalTool === 'line' && digitalLinePoints.length > 0) {
        // Draw existing segments
        for (let i = 0; i < digitalLinePoints.length - 1; i++) {
          drawDigitalLine(ctx, [digitalLinePoints[i], digitalLinePoints[i + 1]], store.currentColor, worldToScreen);
        }
        
        // Draw start point indicator
        const startScreen = worldToScreen(digitalLinePoints[0].x, digitalLinePoints[0].y);
        drawEndpointIndicator(ctx, startScreen, 6, '#2196f3');
        
        // Draw preview from last point to cursor (always show when we have points)
        const lastPoint = digitalLinePoints[digitalLinePoints.length - 1];
        if (digitalLinePreviewEnd) {
          drawDigitalLinePreview(ctx, lastPoint, digitalLinePreviewEnd, store.currentColor, worldToScreen);
          
          // Draw distance measurement for preview line
          const distPx = calcDistance(lastPoint, digitalLinePreviewEnd);
          const distValue = distPx / store.pixelsPerUnit;
          const midPoint = {
            x: (lastPoint.x + digitalLinePreviewEnd.x) / 2,
            y: (lastPoint.y + digitalLinePreviewEnd.y) / 2,
          };
          const midScreen = worldToScreen(midPoint.x, midPoint.y);
          drawMeasurementLabel(ctx, midScreen, formatLength(distValue), store.currentColor);
          
          // Draw angle measurement for 2nd+ segments
          if (digitalLinePoints.length >= 2) {
            const prevPoint = digitalLinePoints[digitalLinePoints.length - 2];
            drawAngleArc(ctx, lastPoint, prevPoint, digitalLinePreviewEnd, worldToScreen);
          }
        } else {
          // If no mouse position yet, still draw endpoint at last point
          const lastScreen = worldToScreen(lastPoint.x, lastPoint.y);
          drawEndpointIndicator(ctx, lastScreen, 6, '#2196f3');
        }
      }
      
      // Circle preview
      if (store.digitalTool === 'circle' && store.circleCreationMode === 'centerRadius' && circleCenter) {
        if (circleRadiusPoint) {
          const centerScreen = worldToScreen(circleCenter.x, circleCenter.y);
          const radius = distance(circleCenter, circleRadiusPoint);
          const radiusScreen = Math.abs(radius * panRef.current.zoom);
          drawDigitalCirclePreview(ctx, centerScreen, radiusScreen, store.currentColor);
          
          // Draw radius measurement at midpoint of radius line
          const radiusValue = radius / store.pixelsPerUnit;
          const labelPos = {
            x: centerScreen.x + radiusScreen / 2,
            y: centerScreen.y,
          };
          drawMeasurementLabel(ctx, labelPos, formatLength(radiusValue), store.currentColor);
        } else {
          const centerScreen = worldToScreen(circleCenter.x, circleCenter.y);
          drawEndpointIndicator(ctx, centerScreen, 6, '#2196f3');
        }
      }
      
      // Three-point circle preview
      if (store.digitalTool === 'circle' && store.circleCreationMode === 'threePoint' && circlePoints.length > 0) {
        circlePoints.forEach((point) => {
          const screen = worldToScreen(point.x, point.y);
          drawEndpointIndicator(ctx, screen, 6, '#2196f3');
        });
        // Draw guide lines
        if (circlePoints.length >= 2) {
          const p1 = worldToScreen(circlePoints[0].x, circlePoints[0].y);
          const p2 = worldToScreen(circlePoints[1].x, circlePoints[1].y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = store.currentColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      
      // Curve preview
      if (store.digitalTool === 'curve' && curvePoints.length > 0) {
        curvePoints.forEach((point, i) => {
          const screen = worldToScreen(point.x, point.y);
          const isControl = i === 1 || i === 2;
          drawControlPointIndicator(ctx, screen, isControl ? 4 : 6, '#2196f3');
        });
        
        // Draw guide lines between control points
        if (curvePoints.length >= 2) {
          for (let i = 0; i < curvePoints.length - 1; i++) {
            const p1 = worldToScreen(curvePoints[i].x, curvePoints[i].y);
            const p2 = worldToScreen(curvePoints[i + 1].x, curvePoints[i + 1].y);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = store.currentColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        
        // Preview bezier curve when we have 3 points
        if (curvePoints.length === 3 && lastMousePosRef.current) {
          const p0 = curvePoints[0];
          const p1 = curvePoints[1];
          const p2 = curvePoints[2];
          const p3 = lastMousePosRef.current;
          drawDigitalBezier(ctx, [p0, p1, p2, p3], store.currentColor, worldToScreen, false, false);
        }
      }
    }

    strokesRef.current.forEach((stroke) => {
      if (stroke.strokeType === 'digital') return; // Skip digital strokes
      const points = stroke.displayPoints ?? stroke.smoothedPoints;
      if (points.length < 2) return;
      const opacity = stroke.brushSettings?.opacity ?? 1;
      drawStroke(ctx, points, stroke.color, stroke.thickness, worldToScreen, opacity);
    });

    if (currentStrokePoints.length > 1) {
      drawStroke(ctx, currentStrokePoints, store.currentColor, store.currentBrushSettings.size, worldToScreen, store.currentBrushSettings.opacity);
    }
  }, [currentStrokePoints, store.currentColor, store.currentBrushSettings.size, store.currentBrushSettings.opacity, worldToScreen, store.toolCategory, store.digitalMode, store.digitalTool, store.mode, hoveredDigitalElement, selectedDigitalElements, digitalLinePoints, digitalLinePreviewEnd, circleCenter, circleRadiusPoint, circlePoints, curvePoints, store.circleCreationMode, lastMousePosRef]);

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

  // Regular functions for intersection detection (no useCallback needed)
  function getLineIntersectionFn(
    p1: Point, p2: Point,
    p3: Point, p4: Point
  ): Point | null {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p4.x - p3.x;
    const dy2 = p4.y - p3.y;

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) < 1e-10) return null;

    const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / cross;
    const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / cross;

    if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) {
      return {
        x: p1.x + t * dx1,
        y: p1.y + t * dy1,
      };
    }

    return null;
  }

  // Lazy intersection search - only check near mouse position using spatial index
  function findNearbyIntersectionsWithSpatialIndex(world: { x: number; y: number }, radius: number = 20): Array<{
    point: Point;
    segments: Array<{ strokeId: string; segmentIndex: number }>;
  }> {
    const searchRadius = radius / panRef.current.zoom;
    const results: Array<{
      point: Point;
      segments: Array<{ strokeId: string; segmentIndex: number }>;
    }> = [];
    
    const digitalStrokes = strokesRef.current.filter(
      s => s.strokeType === 'digital' && s.digitalSegments
    );
    
    // Only check segments within the search radius of mouse position
    for (const stroke of digitalStrokes) {
      if (!stroke.digitalSegments) continue;
      
      for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
        const segment = stroke.digitalSegments[segIdx];
        if (segment.type !== 'line' || segment.points.length < 2) continue;
        
        const p1 = segment.points[0];
        const p2 = segment.points[1];
        
        // Quick bbox check first
        const minX = Math.min(p1.x, p2.x) - searchRadius;
        const maxX = Math.max(p1.x, p2.x) + searchRadius;
        const minY = Math.min(p1.y, p2.y) - searchRadius;
        const maxY = Math.max(p1.y, p2.y) + searchRadius;
        
        if (world.x < minX || world.x > maxX || world.y < minY || world.y > maxY) {
          continue;
        }
        
        // Check if segment is near mouse position
        const distToSegment = distanceToSegment(world, p1, p2);
        
        if (distToSegment > searchRadius) continue;
        
        // Now check intersections with other nearby segments
        for (const otherStroke of digitalStrokes) {
          if (!otherStroke.digitalSegments) continue;
          
          for (let otherSegIdx = 0; otherSegIdx < otherStroke.digitalSegments.length; otherSegIdx++) {
            const otherSegment = otherStroke.digitalSegments[otherSegIdx];
            if (otherSegment.type !== 'line' || otherSegment.points.length < 2) continue;
            if (stroke.id === otherStroke.id && segIdx === otherSegIdx) continue;
            
            const p3 = otherSegment.points[0];
            const p4 = otherSegment.points[1];
            
            const intersection = getLineIntersectionFn(p1, p2, p3, p4);
            if (intersection) {
              // Check if intersection is near mouse
              const distToIntersection = Math.hypot(intersection.x - world.x, intersection.y - world.y);
              if (distToIntersection <= searchRadius) {
                results.push({
                  point: intersection,
                  segments: [
                    { strokeId: stroke.id, segmentIndex: segIdx },
                    { strokeId: otherStroke.id, segmentIndex: otherSegIdx },
                  ],
                });
              }
            }
          }
        }
      }
    }
    
    return results;
  }

  // Digital element hit testing
  const findDigitalElementAtPosition = useCallback((world: { x: number; y: number }): {
    strokeId: string;
    segmentIndex: number;
    pointIndex: number;
    type: 'endpoint' | 'control';
  } | null => {
    const { zoom } = panRef.current;
    const endpointThreshold = 12.0 / zoom;
    const controlThreshold = 10.0 / zoom;
    const lineThreshold = 8.0 / zoom;

    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const stroke = strokesRef.current[i];
      if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;

      for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
        const segment = stroke.digitalSegments[segIdx];

        if (segment.type === 'line' && segment.points.length >= 2) {
          // Check endpoints first (higher priority)
          const startDist = Math.hypot(world.x - segment.points[0].x, world.y - segment.points[0].y);
          if (startDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
          const endDist = Math.hypot(world.x - segment.points[1].x, world.y - segment.points[1].y);
          if (endDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 1, type: 'endpoint' };
          }

          // Check line segment
          const lineDist = distanceToSegment(world, segment.points[0], segment.points[1]);
          if (lineDist <= lineThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
        }

        if (segment.type === 'arc' && segment.points.length >= 2) {
          // Check endpoints
          const startDist = Math.hypot(world.x - segment.points[0].x, world.y - segment.points[0].y);
          if (startDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 0, type: 'endpoint' };
          }
          const endDist = Math.hypot(world.x - segment.points[1].x, world.y - segment.points[1].y);
          if (endDist <= endpointThreshold) {
            return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: 1, type: 'endpoint' };
          }
        }

        if (segment.type === 'bezier' && segment.points.length >= 4) {
          // Check endpoints
          for (let p = 0; p < 2; p++) {
            const dist = Math.hypot(world.x - segment.points[p].x, world.y - segment.points[p].y);
            if (dist <= endpointThreshold) {
              return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: p, type: 'endpoint' };
            }
          }
          // Check control points
          for (let p = 2; p < 4; p++) {
            const dist = Math.hypot(world.x - segment.points[p].x, world.y - segment.points[p].y);
            if (dist <= controlThreshold) {
              return { strokeId: stroke.id, segmentIndex: segIdx, pointIndex: p, type: 'control' };
            }
          }
        }
      }
    }

    return null;
  }, [distanceToSegment]);

  // Find ALL digital elements at a position (including shared endpoints)
  const findAllDigitalElementsAtPosition = useCallback((world: { x: number; y: number }): Array<{
    strokeId: string;
    segmentIndex: number;
    pointIndex: number;
    type: 'endpoint' | 'control';
  }> => {
    const { zoom } = panRef.current;
    const threshold = 12.0 / zoom;
    const results: Array<{
      strokeId: string;
      segmentIndex: number;
      pointIndex: number;
      type: 'endpoint' | 'control';
    }> = [];

    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const stroke = strokesRef.current[i];
      if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;

      for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
        const segment = stroke.digitalSegments[segIdx];

        // Check all endpoints for lines, arcs, and beziers
        for (let p = 0; p < segment.points.length; p++) {
          const point = segment.points[p];
          const dist = Math.hypot(world.x - point.x, world.y - point.y);
          if (dist <= threshold) {
            // Check if this point position is already in results
            const isDuplicate = results.some(r => {
              const rPoint = strokesRef.current.find(s => s.id === r.strokeId)
                ?.digitalSegments?.[r.segmentIndex]?.points[r.pointIndex];
              return rPoint && Math.hypot(rPoint.x - point.x, rPoint.y - point.y) < threshold;
            });
            
            if (!isDuplicate) {
              results.push({
                strokeId: stroke.id,
                segmentIndex: segIdx,
                pointIndex: p,
                type: p < 2 ? 'endpoint' : 'control',
              });
            }
          }
        }
      }
    }

    return results;
  }, []);

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

    // Handle digital tool drawing
    if (store.toolCategory === 'digital' && store.digitalMode === 'draw') {
      const { digitalTool } = store;
      
      if (digitalTool === 'line') {
        const clickThreshold = 10 / panRef.current.zoom;
        
        // Check if clicking near start point to close the polyline
        if (digitalLinePoints.length >= 2) {
          const startPoint = digitalLinePoints[0];
          if (distance(world, startPoint) <= clickThreshold) {
            // Close the polyline - create separate strokes for each segment including closing segment
            for (let i = 0; i < digitalLinePoints.length - 1; i++) {
              const segmentPoints = [digitalLinePoints[i], digitalLinePoints[i + 1]];
              const segment: Stroke = {
                id: generateId(),
                points: segmentPoints,
                smoothedPoints: segmentPoints,
                color: store.currentColor,
                thickness: 1,
                timestamp: Date.now(),
                strokeType: 'digital',
                digitalSegments: [{
                  id: generateId(),
                  type: 'line',
                  points: segmentPoints,
                  color: store.currentColor,
                }],
                isClosed: false,
              };
              store.addStroke(segment);
            }
            // Add closing segment from last point to first point
            const lastIdx = digitalLinePoints.length - 1;
            const closingSegmentPoints = [digitalLinePoints[lastIdx], digitalLinePoints[0]];
            const closingSegment: Stroke = {
              id: generateId(),
              points: closingSegmentPoints,
              smoothedPoints: closingSegmentPoints,
              color: store.currentColor,
              thickness: 1,
              timestamp: Date.now(),
              strokeType: 'digital',
              digitalSegments: [{
                id: generateId(),
                type: 'line',
                points: closingSegmentPoints,
                color: store.currentColor,
              }],
              isClosed: false,
            };
            store.addStroke(closingSegment);
            
            setDigitalLinePoints([]);
            setDigitalLinePreviewEnd(null);
            return;
          }
        }
        
        // Add new point
        setDigitalLinePoints(prev => [...prev, world]);
        return;
      }
      
      if (digitalTool === 'circle') {
        if (store.circleCreationMode === 'centerRadius') {
          if (!circleCenter) {
            setCircleCenter(world);
          } else {
            // Complete circle
            const radius = distance(circleCenter, world);
            const segments: DigitalSegment[] = [{
              id: generateId(),
              type: 'arc',
              points: [circleCenter, world],
              color: store.currentColor,
              arcData: {
                center: circleCenter,
                radius,
                startAngle: Math.atan2(world.y - circleCenter.y, world.x - circleCenter.x),
                endAngle: Math.atan2(world.y - circleCenter.y, world.x - circleCenter.x) + Math.PI * 2,
              },
            }];
            
            const stroke: Stroke = {
              id: generateId(),
              points: [circleCenter, world],
              smoothedPoints: [circleCenter, world],
              color: store.currentColor,
              thickness: 1,
              timestamp: Date.now(),
              strokeType: 'digital',
              digitalSegments: segments,
              isClosed: true,
            };
            
            store.addStroke(stroke);
            setCircleCenter(null);
            setCircleRadiusPoint(null);
          }
          return;
        } else {
          // Three-point circle mode
          setCirclePoints(prev => [...prev, world]);
          
          if (circlePoints.length >= 2) {
            // Calculate circle from 3 points
            const p1 = circlePoints[0];
            const p2 = circlePoints[1];
            const p3 = world;
            
            // Use perpendicular bisectors intersection
            const D = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
            if (Math.abs(D) > 0.0001) {
              const centerX = ((p1.x * p1.x + p1.y * p1.y) * (p2.y - p3.y) + (p2.x * p2.x + p2.y * p2.y) * (p3.y - p1.y) + (p3.x * p3.x + p3.y * p3.y) * (p1.y - p2.y)) / D;
              const centerY = ((p1.x * p1.x + p1.y * p1.y) * (p3.x - p2.x) + (p2.x * p2.x + p2.y * p2.y) * (p1.x - p3.x) + (p3.x * p3.x + p3.y * p3.y) * (p2.x - p1.x)) / D;
              
              const center = { x: centerX, y: centerY };
              const radius = distance(center, p1);
              const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
              const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);
              
              let sweepAngle = endAngle - startAngle;
              if (sweepAngle < 0) sweepAngle += Math.PI * 2;
              
              const segments: DigitalSegment[] = [{
                id: generateId(),
                type: 'arc',
                points: [p1, p3],
                color: store.currentColor,
                arcData: {
                  center,
                  radius,
                  startAngle,
                  endAngle: startAngle + sweepAngle,
                },
              }];
              
              const stroke: Stroke = {
                id: generateId(),
                points: [p1, p2, p3],
                smoothedPoints: [p1, p2, p3],
                color: store.currentColor,
                thickness: 1,
                timestamp: Date.now(),
                strokeType: 'digital',
                digitalSegments: segments,
                isClosed: true,
              };
              
              store.addStroke(stroke);
              setCirclePoints([]);
              return;
            }
          }
        }
        return;
      }
      
      if (digitalTool === 'curve') {
        // Bezier curve: click for p0, p1(control), p2(control), then move to p3
        // Use functional update to get the latest state
        setCurvePoints(prev => {
          const newPoints = [...prev, world];
          
          // If we have 3 points + current mouse position = 4 points for bezier
          if (newPoints.length >= 4) {
            const p0 = newPoints[0];
            const p1 = newPoints[1];
            const p2 = newPoints[2];
            const p3 = newPoints[3]; // Current mouse position
            
            // Create the bezier curve stroke
            const segments: DigitalSegment[] = [{
              id: generateId(),
              type: 'bezier',
              points: [p0, p1, p2, p3],
              color: store.currentColor,
            }];
            
            const stroke: Stroke = {
              id: generateId(),
              points: [p0, p1, p2, p3],
              smoothedPoints: [p0, p1, p2, p3],
              color: store.currentColor,
              thickness: 1,
              timestamp: Date.now(),
              strokeType: 'digital',
              digitalSegments: segments,
              isClosed: false,
            };
            
            store.addStroke(stroke);
            return []; // Clear points
          }
          
          return newPoints;
        });
        
        // Check if clicking near start point to close (using current state)
        if (curvePoints.length >= 3) {
          const p0 = curvePoints[0];
          
          const clickThreshold = 10 / panRef.current.zoom;
          if (distance(world, p0) <= clickThreshold) {
            // Close the bezier curve - need at least 3 points + current = 4
            if (curvePoints.length >= 3) {
              const p1 = curvePoints[1];
              const p2 = curvePoints[2];
              
              const segments: DigitalSegment[] = [{
                id: generateId(),
                type: 'bezier',
                points: [p0, p1, p2, p0],
                color: store.currentColor,
              }];
              
              const stroke: Stroke = {
                id: generateId(),
                points: [p0, p1, p2, p0],
                smoothedPoints: [p0, p1, p2, p0],
                color: store.currentColor,
                thickness: 1,
                timestamp: Date.now(),
                strokeType: 'digital',
                digitalSegments: segments,
                isClosed: true,
              };
              
              store.addStroke(stroke);
              setCurvePoints([]);
            }
            return;
          }
        }
        return;
      }
      
      return;
    }

    // Handle digital select mode
    if (store.toolCategory === 'digital' && store.digitalMode === 'select') {
      // Use lazy spatial search for intersection hit testing (doesn't require full cache)
      const hitIntersections = findNearbyIntersectionsWithSpatialIndex(world, 15);
      
      if (hitIntersections.length > 0) {
        // Defer intersection splitting to next frame to avoid blocking UI
        // This prevents the freeze when clicking on a cross point with many segments
        const clickWorld = { ...world };
        
        requestAnimationFrame(() => {
          // Re-find the intersection since state might have changed
          const currentIntersections = findNearbyIntersectionsWithSpatialIndex(clickWorld, 15);
          if (currentIntersections.length === 0) return;
          
          const intersection = currentIntersections[0];
          
          // Split each line segment at the intersection point
          const newEndpointSelections: Array<{
            strokeId: string;
            segmentIndex: number;
            pointIndex: number;
            type: 'endpoint' | 'control';
          }> = [];
          
          const modifiedStrokes: Stroke[] = [];
          
          for (const segInfo of intersection.segments) {
            const stroke = strokesRef.current.find(s => s.id === segInfo.strokeId);
            if (!stroke || !stroke.digitalSegments) continue;
            
            const segment = stroke.digitalSegments[segInfo.segmentIndex];
            if (segment.type !== 'line' || segment.points.length < 2) continue;
            
            const p1 = segment.points[0];
            const p2 = segment.points[1];
            
            // Check which endpoint is further from the intersection to determine direction
            const dist1 = Math.hypot(p1.x - intersection.point.x, p1.y - intersection.point.y);
            const dist2 = Math.hypot(p2.x - intersection.point.x, p2.y - intersection.point.y);
            
            // Keep the endpoint that's closer to the intersection as the "fixed" end
            if (dist1 < dist2) {
              segment.points[1] = intersection.point;
              
              const newSegment: DigitalSegment = {
                id: generateId(),
                type: 'line',
                points: [intersection.point, p2],
                color: segment.color,
              };
              stroke.digitalSegments.splice(segInfo.segmentIndex + 1, 0, newSegment);
              
              newEndpointSelections.push({
                strokeId: stroke.id,
                segmentIndex: segInfo.segmentIndex + 1,
                pointIndex: 0,
                type: 'endpoint',
              });
            } else {
              segment.points[0] = intersection.point;
              
              const newSegment: DigitalSegment = {
                id: generateId(),
                type: 'line',
                points: [p1, intersection.point],
                color: segment.color,
              };
              stroke.digitalSegments.splice(segInfo.segmentIndex, 0, newSegment);
              
              newEndpointSelections.push({
                strokeId: stroke.id,
                segmentIndex: segInfo.segmentIndex,
                pointIndex: 1,
                type: 'endpoint',
              });
            }
            
            stroke.points = [...stroke.points];
            if (stroke.points.length >= 2) {
              stroke.points[0] = segment.points[0];
              stroke.points[1] = segment.points[1];
            }
            
            newEndpointSelections.push({
              strokeId: stroke.id,
              segmentIndex: segInfo.segmentIndex,
              pointIndex: dist1 < dist2 ? 1 : 0,
              type: 'endpoint',
            });
            
            modifiedStrokes.push(stroke);
          }
          
          // Batch update all modified strokes
          if (modifiedStrokes.length > 0) {
            modifiedStrokes.forEach(stroke => {
              store.updateStroke(stroke.id, stroke, true);
            });
            
            // Defer closed area rebuild
            requestAnimationFrame(() => {
              if (closedAreaManagerRef.current) {
                const updatedStrokes = strokesRef.current
                  .filter(s => s.strokeType === 'digital')
                  .map(s => ({
                    id: s.id,
                    points: s.displayPoints ?? s.smoothedPoints ?? s.points,
                    displayPoints: s.displayPoints,
                    digitalSegments: s.digitalSegments,
                    isClosed: s.isClosed,
                  }));
                closedAreaManagerRef.current.setStrokes(updatedStrokes);
              }
            });
          }
          
          // Set dragging state
          setSelectedDigitalElements(newEndpointSelections);
          setIsDraggingDigital(true);
          isDraggingRef.current = true;
          setDigitalDragStart(clickWorld);
          setSelectedIntersection(null);
        });
        
        return;
      }
      
      // Clear intersection selection when clicking elsewhere
      setSelectedIntersection(null);
      
      // Then check for regular endpoints
      const hitElements = findAllDigitalElementsAtPosition(world);
      
      if (hitElements.length > 0) {
        if (e.ctrlKey || e.metaKey) {
          // Toggle selection for all hit elements
          hitElements.forEach(hit => {
            const existingIdx = selectedDigitalElements.findIndex(
              el => el.strokeId === hit.strokeId && 
                   el.segmentIndex === hit.segmentIndex &&
                   el.pointIndex === hit.pointIndex
            );
            if (existingIdx >= 0) {
              setSelectedDigitalElements(prev => prev.filter((_, i) => i !== existingIdx));
            } else {
              setSelectedDigitalElements(prev => [...prev, hit]);
            }
          });
        } else {
          // Select ALL shared points at this position
          setSelectedDigitalElements(hitElements);
        }
        // Start dragging
        setIsDraggingDigital(true);
        isDraggingRef.current = true;
        setDigitalDragStart(world);
      } else {
        setSelectedDigitalElements([]);
      }
      return;
    }

    // Handle artistic tool drawing
    if (store.toolCategory === 'artistic') {
      if (store.mode === 'select') {
        // First check if clicking on a closed area (only for digital)
        if (closedAreaManagerRef.current) {
          const areaResult = closedAreaManagerRef.current.startDrag(world);
          if (areaResult.area && areaResult.strokeIds.length > 0) {
            setIsDraggingArea(true);
            setDraggedStrokeIds(areaResult.strokeIds);
            setLastDragPoint(world);
            return;
          }
        }

        // Otherwise check if clicking on a stroke
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
    }
  }, [store, screenToWorld, findStrokeAtPosition, findAllDigitalElementsAtPosition, digitalLinePoints, circleCenter, circlePoints, curvePoints, selectedDigitalElements]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Track mouse position for intersection highlighting
    if (world) {
      lastMousePosRef.current = world;
    }

    // Handle digital tool previews
    if (store.toolCategory === 'digital' && store.digitalMode === 'draw' && world) {
      if (store.digitalTool === 'line' && digitalLinePoints.length > 0) {
        setDigitalLinePreviewEnd(world);
      }
      if (store.digitalTool === 'circle' && store.circleCreationMode === 'centerRadius' && circleCenter) {
        setCircleRadiusPoint(world);
      }
    }

    // Handle digital hover and drag in both digital and artistic select mode
    const isInSelectMode = (store.toolCategory === 'digital' && store.digitalMode === 'select') || 
                           (store.toolCategory === 'artistic' && store.mode === 'select');
    if (isInSelectMode && world) {
      // Update hover state
      const hoverElement = findDigitalElementAtPosition(world);
      setHoveredDigitalElement(hoverElement);

      // Handle intersection dragging - split lines and move
      if (isDraggingDigital && selectedIntersection && digitalDragStart) {
        const dx = world.x - digitalDragStart.x;
        const dy = world.y - digitalDragStart.y;
        
        // Track all segment IDs that were moved
        const movedSegmentIds: string[] = [];
        
        // Move each segment's endpoint to the new position
        for (const segInfo of selectedIntersection.segments) {
          const stroke = strokesRef.current.find(s => s.id === segInfo.strokeId);
          if (!stroke || !stroke.digitalSegments || !stroke.digitalSegments[segInfo.segmentIndex]) continue;
          
          const segment = stroke.digitalSegments[segInfo.segmentIndex];
          if (segment.type !== 'line' || segment.points.length < 2) continue;
          
          // Move both endpoints toward the new position
          const newPoints = segment.points.map(p => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          segment.points = newPoints;
          
          // Update stroke.points directly in strokesRef for rendering during drag
          stroke.points = [...stroke.points];
          if (stroke.points.length >= 2) {
            stroke.points[0] = newPoints[0];
            stroke.points[1] = newPoints[1];
          }
          
          // Track this stroke ID for persistence on dragEnd
          modifiedStrokeIdsRef.current.add(stroke.id);
          
          // Track this segment for incremental intersection update
          const segmentId = `${stroke.id}:${segInfo.segmentIndex}`;
          movedSegmentIds.push(segmentId);
        }

        // Skip expensive updates during drag - only update visual position
        // These will be updated on dragEnd:
        // - store.updateStroke() to persist changes
        // - closedAreaManagerRef.current.setStrokes()
        // - intersection recalculation
      
      // Update the stored intersection point position
      setSelectedIntersection(prev => prev ? {
        ...prev,
        point: { x: prev.point.x + dx, y: prev.point.y + dy },
      } : null);
       
      setDigitalDragStart(world);
      return;
    }

    // Handle regular point dragging (only if no intersection selected)
      if (isDraggingDigital && digitalDragStart && selectedDigitalElements.length > 0 && !selectedIntersection) {
        const dx = world.x - digitalDragStart.x;
        const dy = world.y - digitalDragStart.y;

        // Get the original position from the first selected element
        const firstSel = selectedDigitalElements[0];
        const firstStroke = strokesRef.current.find(s => s.id === firstSel.strokeId);
        const originalPos = firstStroke?.digitalSegments?.[firstSel.segmentIndex]?.points[firstSel.pointIndex];
        
        if (!originalPos) {
          setDigitalDragStart(world);
          return;
        }

        // Find ALL points at the original position (across all strokes)
        const threshold = 1.0; // Use small threshold for finding points at same position
        const allPointsAtOriginalPos: Array<{
          strokeId: string;
          segmentIndex: number;
          pointIndex: number;
        }> = [];

        for (const stroke of strokesRef.current) {
          if (stroke.strokeType !== 'digital' || !stroke.digitalSegments) continue;
          
          for (let segIdx = 0; segIdx < stroke.digitalSegments.length; segIdx++) {
            const segment = stroke.digitalSegments[segIdx];
            
            for (let p = 0; p < segment.points.length; p++) {
              const point = segment.points[p];
              const dist = Math.hypot(point.x - originalPos.x, point.y - originalPos.y);
              if (dist < threshold) {
                // Check if already added
                const isDuplicate = allPointsAtOriginalPos.some(
                  existing => existing.strokeId === stroke.id && 
                             existing.segmentIndex === segIdx && 
                             existing.pointIndex === p
                );
                if (!isDuplicate) {
                  allPointsAtOriginalPos.push({ strokeId: stroke.id, segmentIndex: segIdx, pointIndex: p });
                }
              }
            }
          }
        }

        // Update ALL points at the original position
        const movedSegmentIds: string[] = [];
        
        allPointsAtOriginalPos.forEach(sel => {
          const stroke = strokesRef.current.find(s => s.id === sel.strokeId);
          if (stroke && stroke.digitalSegments && stroke.digitalSegments[sel.segmentIndex]) {
            const segment = stroke.digitalSegments[sel.segmentIndex];
            const newPoints = [...segment.points];
            newPoints[sel.pointIndex] = {
              x: newPoints[sel.pointIndex].x + dx,
              y: newPoints[sel.pointIndex].y + dy,
            };

            // Update arc center if moving an endpoint
            if (segment.type === 'arc' && segment.arcData) {
              const newArcData = { ...segment.arcData };
              if (sel.pointIndex === 0 || sel.pointIndex === 1) {
                newArcData.radius = Math.hypot(
                  newPoints[sel.pointIndex].x - newArcData.center.x,
                  newPoints[sel.pointIndex].y - newArcData.center.y
                );
              }
              segment.arcData = newArcData;
            }

            segment.points = newPoints;
            
            // Update stroke.points directly in strokesRef for rendering during drag
            stroke.points = [...stroke.points];
            if (stroke.points.length >= 2) {
              stroke.points[0] = segment.points[0];
              stroke.points[1] = segment.points[1];
            }
            
            // Track this stroke ID for persistence on dragEnd
            modifiedStrokeIdsRef.current.add(stroke.id);
            
            // Track this segment for incremental intersection update
            movedSegmentIds.push(`${stroke.id}:${sel.segmentIndex}`);
          }
        });

        // Skip expensive updates during drag - only update visual position
        // These will be updated on dragEnd:
        // - store.updateStroke() to persist changes
        // - closedAreaManagerRef.current.setStrokes()
        // - intersection recalculation

        setDigitalDragStart(world);
        return;
      }
    }

    // Handle hover for closed areas (skip during drag to avoid expensive recalculations)
    if (closedAreaManagerRef.current && isInSelectMode && !isDraggingDigital) {
      const hoveredArea = closedAreaManagerRef.current.hitTest(world);
      closedAreaManagerRef.current.setHoveredAreaId(hoveredArea?.id ?? null);
    }

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const newPanX = panRef.current.x - dx / panRef.current.zoom;
      const newPanY = panRef.current.y + dy / panRef.current.zoom;
      store.setPan(newPanX, newPanY);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDraggingArea && lastDragPoint && draggedStrokeIds.length > 0) {
      const dx = world.x - lastDragPoint.x;
      const dy = world.y - lastDragPoint.y;

      // Move the strokes that form the closed area
      store.selectedStrokeIds.forEach((strokeId) => {
        if (draggedStrokeIds.includes(strokeId)) {
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
        }
      });
      setLastDragPoint(world);
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
  }, [isPanning, isDragging, isDraggingArea, isDrawing, panStart, store, screenToWorld, currentStrokePoints, dragStart, lastDragPoint, draggedStrokeIds, selectedDigitalElements, digitalLinePoints, circleCenter, digitalDragStart, isDraggingDigital, findDigitalElementAtPosition]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDraggingArea) {
      if (closedAreaManagerRef.current) {
        closedAreaManagerRef.current.endDrag();
      }
      setIsDraggingArea(false);
      setLastDragPoint(null);
      setDraggedStrokeIds([]);
      return;
    }

    if (isDragging && store.mode === 'select') {
      setIsDragging(false);
      setDragStart({ x: 0, y: 0 });
      return;
    }

    if (isDraggingDigital) {
      // Persist modified strokes to store (only once at drag end)
      modifiedStrokeIdsRef.current.forEach(strokeId => {
        const stroke = strokesRef.current.find(s => s.id === strokeId);
        if (stroke) {
          store.updateStroke(stroke.id, stroke, true);
        }
      });
      modifiedStrokeIdsRef.current.clear();
      
      // Clear selection and highlight after drag ends
      setSelectedDigitalElements([]);
      if (closedAreaManagerRef.current) {
        closedAreaManagerRef.current.setHoveredAreaId(null);
      }
      
      setIsDraggingDigital(false);
      isDraggingRef.current = false;
      setDigitalDragStart(null);
      
      // Defer expensive intersection recalculation more aggressively
      requestAnimationFrame(() => {
        // Only invalidate cache if there were actual changes
        // Keep existing cache during idle periods
        
        // Rebuild the spatial index with updated segment positions
        if (intersectionManagerRef.current) {
          intersectionManagerRef.current.buildFromStrokes(strokesRef.current);
        }
        
        // Update closed area manager with final stroke positions
        if (closedAreaManagerRef.current) {
          const updatedStrokes = strokesRef.current
            .filter(s => s.strokeType === 'digital')
            .map(s => ({
              id: s.id,
              points: s.displayPoints ?? s.smoothedPoints ?? s.points,
              displayPoints: s.displayPoints,
              digitalSegments: s.digitalSegments,
              isClosed: s.isClosed,
            }));
          closedAreaManagerRef.current.setStrokes(updatedStrokes);
        }
        
        // Invalidate cache AFTER operations are done (lazy invalidation)
        // Next hover will trigger recalculation if needed
      });
      
      return;
    }

    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentStrokePoints.length > 1) {
      const { simplifiedPoints, cornerPoints, cornerIndices, segments } = simplifyStroke(currentStrokePoints);

      let displayPoints: Point[] | undefined;
      if (store.predictEnabled) {
        const predicted = predictShape(simplifiedPoints);
        if (predicted) {
          displayPoints = predicted;
        }
      }

      const stroke: Stroke = {
        id: generateId(),
        points: currentStrokePoints,
        smoothedPoints: simplifiedPoints,
        cornerPoints,
        cornerIndices,
        segments,
        displayPoints,
        color: store.currentColor,
        thickness: store.currentBrushSettings.size,
        timestamp: Date.now(),
        strokeType: 'artistic',
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
  }, [isPanning, isDragging, isDraggingArea, isDrawing, currentStrokePoints, store, onStrokeComplete, isDraggingDigital]);

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
      onContextMenu={(e) => {
        // Right-click to close line/curve segments
        e.preventDefault();
        
        // Handle line mode close
        if (store.toolCategory === 'digital' && store.digitalMode === 'draw' && store.digitalTool === 'line' && digitalLinePoints.length >= 2) {
          const strokesToAdd: Stroke[] = [];
          
          // Close the polyline by connecting last point to first point
          const closingSegmentPoints = [digitalLinePoints[digitalLinePoints.length - 1], digitalLinePoints[0]];
          const closingSegment: Stroke = {
            id: generateId(),
            points: closingSegmentPoints,
            smoothedPoints: closingSegmentPoints,
            color: store.currentColor,
            thickness: 1,
            timestamp: Date.now(),
            strokeType: 'digital',
            digitalSegments: [{
              id: generateId(),
              type: 'line',
              points: closingSegmentPoints,
              color: store.currentColor,
            }],
            isClosed: true,
          };
          strokesToAdd.push(closingSegment);
          
          // Also create strokes for each existing segment
          for (let i = 0; i < digitalLinePoints.length - 1; i++) {
            const segmentPoints = [digitalLinePoints[i], digitalLinePoints[i + 1]];
            const segment: Stroke = {
              id: generateId(),
              points: segmentPoints,
              smoothedPoints: segmentPoints,
              color: store.currentColor,
              thickness: 1,
              timestamp: Date.now(),
              strokeType: 'digital',
              digitalSegments: [{
                id: generateId(),
                type: 'line',
                points: segmentPoints,
                color: store.currentColor,
              }],
              isClosed: false,
            };
            strokesToAdd.push(segment);
          }
          
          // Batch add all strokes at once
          store.addStrokesBatch(strokesToAdd);
          
          setDigitalLinePoints([]);
          setDigitalLinePreviewEnd(null);
          return;
        }
        
        // Handle curve mode close
        if (store.toolCategory === 'digital' && store.digitalMode === 'draw' && store.digitalTool === 'curve' && curvePoints.length >= 3) {
          const p0 = curvePoints[0];
          const p1 = curvePoints[1];
          const p2 = curvePoints[2];
          
          const segments: DigitalSegment[] = [{
            id: generateId(),
            type: 'bezier',
            points: [p0, p1, p2, p0],
            color: store.currentColor,
          }];
          
          const stroke: Stroke = {
            id: generateId(),
            points: [p0, p1, p2, p0],
            smoothedPoints: [p0, p1, p2, p0],
            color: store.currentColor,
            thickness: 1,
            timestamp: Date.now(),
            strokeType: 'digital',
            digitalSegments: segments,
            isClosed: true,
          };
          
          store.addStroke(stroke);
          setCurvePoints([]);
          return;
        }
      }}
      onDoubleClick={(e) => {
        // Double-click to complete digital line or curve without closing
        e.preventDefault();
        
        // Handle line mode
        if (store.toolCategory === 'digital' && store.digitalMode === 'draw' && store.digitalTool === 'line' && digitalLinePoints.length >= 2) {
          const strokesToAdd: Stroke[] = [];
          
          // Create separate strokes for each segment
          for (let i = 0; i < digitalLinePoints.length - 1; i++) {
            const segmentPoints = [digitalLinePoints[i], digitalLinePoints[i + 1]];
            const segment: Stroke = {
              id: generateId(),
              points: segmentPoints,
              smoothedPoints: segmentPoints,
              color: store.currentColor,
              thickness: 1,
              timestamp: Date.now(),
              strokeType: 'digital',
              digitalSegments: [{
                id: generateId(),
                type: 'line',
                points: segmentPoints,
                color: store.currentColor,
              }],
              isClosed: false,
            };
            strokesToAdd.push(segment);
          }
          
          // Batch add all strokes at once
          store.addStrokesBatch(strokesToAdd);
          
          setDigitalLinePoints([]);
          setDigitalLinePreviewEnd(null);
          return;
        }
        
        // Handle curve mode - need at least 3 points, use last mouse position as end point
        if (store.toolCategory === 'digital' && store.digitalMode === 'draw' && store.digitalTool === 'curve' && curvePoints.length >= 3 && lastMousePosRef.current) {
          const p0 = curvePoints[0];
          const p1 = curvePoints[1];
          const p2 = curvePoints[2];
          const p3 = lastMousePosRef.current;
          
          const segments: DigitalSegment[] = [{
            id: generateId(),
            type: 'bezier',
            points: [p0, p1, p2, p3],
            color: store.currentColor,
          }];
          
          const stroke: Stroke = {
            id: generateId(),
            points: [p0, p1, p2, p3],
            smoothedPoints: [p0, p1, p2, p3],
            color: store.currentColor,
            thickness: 1,
            timestamp: Date.now(),
            strokeType: 'digital',
            digitalSegments: segments,
            isClosed: false,
          };
          
          store.addStroke(stroke);
          setCurvePoints([]);
          return;
        }
      }}
    >
      <canvas ref={canvasRef} className="drawing-canvas" />
    </div>
  );
};

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number; zoom: number },
  toolCategory: string,
  pixelsPerUnit: number
): void {
  if (toolCategory !== 'digital') {
    return;
  }

  const { x: panX, y: panY, zoom } = pan;
  const scaleInterval = 50;
  const tickLength = 10;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const visibleLeftWorld = (-halfWidth / zoom) + panX;
  const visibleRightWorld = (halfWidth / zoom) + panX;
  const visibleTopWorld = (halfHeight / zoom) + panY;
  const visibleBottomWorld = (-halfHeight / zoom) + panY;

  const startX = Math.floor(visibleLeftWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;
  const endX = Math.ceil(visibleRightWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;
  const startY = Math.floor(visibleBottomWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;
  const endY = Math.ceil(visibleTopWorld / pixelsPerUnit / scaleInterval) * pixelsPerUnit * scaleInterval;

  ctx.font = '11px sans-serif';

  const originX = (0 - panX) * zoom + halfWidth;
  const originY = halfHeight - (0 - panY) * zoom;

  const xAxisY = originY;
  const yAxisX = originX;

  for (let worldX = startX; worldX <= endX; worldX += pixelsPerUnit * scaleInterval) {
    const screenX = (worldX - panX) * zoom + halfWidth;
    const unitValue = worldX / pixelsPerUnit;

    if (screenX >= 0 && screenX <= width) {
      ctx.beginPath();
      ctx.moveTo(screenX, xAxisY - tickLength / 2);
      ctx.lineTo(screenX, xAxisY + tickLength / 2);
      ctx.strokeStyle = '#606060';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
        ctx.fillText(`${Math.round(unitValue)}`, screenX, xAxisY + tickLength);
    }
  }

  for (let worldY = startY; worldY <= endY; worldY += pixelsPerUnit * scaleInterval) {
    const screenY = halfHeight - (worldY - panY) * zoom;
    const unitValue = worldY / pixelsPerUnit;

    if (screenY >= 0 && screenY <= height) {
      ctx.beginPath();
      ctx.moveTo(yAxisX - tickLength / 2, screenY);
      ctx.lineTo(yAxisX + tickLength / 2, screenY);
      ctx.strokeStyle = '#606060';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(unitValue)}`, yAxisX - tickLength - 4, screenY);
    }
  }

  ctx.strokeStyle = '#404040';
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

  if (originX >= 6 && originX <= width - 6 && originY >= 6 && originY <= height - 6) {
    ctx.beginPath();
    ctx.arc(originX, originY, 5, 0, Math.PI * 2);
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

function drawDigitalLine(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  if (points.length < 2) return;
  
  const p1 = worldToScreen(points[0].x, points[0].y);
  const p2 = worldToScreen(points[1].x, points[1].y);
  
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = isHovered || isSelected ? 2 : 1;
  
  if (isSelected) {
    ctx.setLineDash([4, 4]);
  }
  
  if (isHovered) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
  }
  
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

function drawDigitalLinePreview(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number }
): void {
  const p1 = worldToScreen(start.x, start.y);
  const p2 = worldToScreen(end.x, end.y);
  
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw preview endpoint
  drawEndpointIndicator(ctx, p2, 4, color);
}

function drawDigitalArc(
  ctx: CanvasRenderingContext2D,
  arcData: { center: Point; radius: number; startAngle: number; endAngle: number },
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number,
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  const center = worldToScreen(arcData.center.x, arcData.center.y);
  const radius = arcData.radius * zoom;
  
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, arcData.startAngle, arcData.endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = isHovered || isSelected ? 2 : 1;
  
  if (isSelected) {
    ctx.setLineDash([4, 4]);
  }
  
  if (isHovered) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
  }
  
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

function drawDigitalCirclePreview(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radius: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw radius line
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(center.x + radius, center.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw center and edge points
  drawEndpointIndicator(ctx, center, 4, color);
  drawEndpointIndicator(ctx, { x: center.x + radius, y: center.y }, 4, color);
}

function drawDigitalBezier(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  if (points.length < 4) return;
  
  const p0 = worldToScreen(points[0].x, points[0].y);
  const p1 = worldToScreen(points[1].x, points[1].y);
  const p2 = worldToScreen(points[2].x, points[2].y);
  const p3 = worldToScreen(points[3].x, points[3].y);
  
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = isHovered || isSelected ? 2 : 1;
  
  if (isSelected) {
    ctx.setLineDash([4, 4]);
  }
  
  if (isHovered) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
  }
  
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  
  // Draw control lines (only when hovered)
  if (isHovered || isSelected) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawEndpointIndicator(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  radius: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawControlPointIndicator(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  size: number,
  color: string
): void {
  ctx.beginPath();
  ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawCrossIndicator(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  size: number,
  color: string
): void {
  ctx.beginPath();
  // Draw an X shape
  ctx.moveTo(point.x - size, point.y - size);
  ctx.lineTo(point.x + size, point.y + size);
  ctx.moveTo(point.x + size, point.y - size);
  ctx.lineTo(point.x - size, point.y + size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw a small circle in the center
  ctx.beginPath();
  ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawMeasurementLabel(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  text: string,
  color: string
): void {
  ctx.font = '11px sans-serif';
  const metrics = ctx.measureText(text);
  const padding = 4;
  const boxWidth = metrics.width + padding * 2;
  const boxHeight = 16;
  
  ctx.beginPath();
  ctx.arc(position.x, position.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#2196f3';
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    position.x + 6,
    position.y - boxHeight / 2,
    boxWidth,
    boxHeight
  );
  
  ctx.strokeStyle = '#2196f3';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    position.x + 6,
    position.y - boxHeight / 2,
    boxWidth,
    boxHeight
  );
  
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, position.x + 6 + padding, position.y);
}

function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  vertex: Point,
  line1End: Point,
  line2End: Point,
  worldToScreen: (x: number, y: number) => { x: number; y: number }
): { angle: number; arcCenter: { x: number; y: number } } {
  const vertexScreen = worldToScreen(vertex.x, vertex.y);
  const line1EndScreen = worldToScreen(line1End.x, line1End.y);
  const line2EndScreen = worldToScreen(line2End.x, line2End.y);

  const angle1 = Math.atan2(line1EndScreen.y - vertexScreen.y, line1EndScreen.x - vertexScreen.x);
  const angle2 = Math.atan2(line2EndScreen.y - vertexScreen.y, line2EndScreen.x - vertexScreen.x);

  const startAngle = angle1;
  const endAngle = angle2;
  
  let angleDiff = endAngle - startAngle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  const arcRadius = 40;
  const midAngle = startAngle + angleDiff / 2;

  ctx.beginPath();
  ctx.arc(vertexScreen.x, vertexScreen.y, arcRadius, startAngle, endAngle, angleDiff < 0);
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const labelX = vertexScreen.x + Math.cos(midAngle) * (arcRadius + 18);
  const labelY = vertexScreen.y + Math.sin(midAngle) * (arcRadius + 18);

  const angle = angleBetween(line1End, vertex, line2End);
  const acuteAngle = getAcuteAngle(angle);

  drawMeasurementLabel(ctx, { x: labelX, y: labelY }, formatAngle(acuteAngle, 'degree'), '#ff9800');

  return { angle: acuteAngle, arcCenter: vertexScreen };
}
