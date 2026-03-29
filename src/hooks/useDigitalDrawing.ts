import { useCallback, useRef, useState } from 'react';
import { useDrawingStore } from '../store';
import type { Point, Stroke, DigitalSegment } from '../types';
import type { SnapResult } from '../measurements';
import { generateId } from '../utils';

interface UseDigitalDrawingOptions {
  screenToWorld: (x: number, y: number) => Point;
  applySnap: (point: Point) => { point: Point; snap: SnapResult | null };
  addStrokes: (strokes: Stroke[]) => void;
}

interface UseDigitalDrawingReturn {
  linePoints: Point[];
  circleCenter: Point | null;
  circleRadiusPoint: Point | null;
  arcPoints: Point[];
  arcRadiusPoint: Point | null;
  curvePoints: Point[];
  handleDigitalDown: (e: React.MouseEvent) => void;
  handleDigitalMove: (e: React.MouseEvent) => void;
  handleDigitalUp: () => void;
}

/**
 * Hook for digital mode precision drawing
 * Handles line, circle, arc, and curve tools
 */
export function useDigitalDrawing(options: UseDigitalDrawingOptions): UseDigitalDrawingReturn {
  const store = useDrawingStore();
  const { screenToWorld, applySnap, addStrokes } = options;
  
  // State for previews
  const [linePoints, setLinePoints] = useState<Point[]>([]);
  const [circleCenter, setCircleCenter] = useState<Point | null>(null);
  const [circleRadiusPoint, setCircleRadiusPoint] = useState<Point | null>(null);
  const [arcPoints, setArcPoints] = useState<Point[]>([]);
  const [arcRadiusPoint, setArcRadiusPoint] = useState<Point | null>(null);
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  
  // Refs for tool state
  const digitalToolRef = useRef<string | null>(null);
  const clickCountRef = useRef(0);
  const firstPointRef = useRef<Point | null>(null);

  /**
   * Handle digital mode mouse down
   */
  const handleDigitalDown = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    const snapped = applySnap(worldPoint);
    const point = snapped.point;
    
    const tool = store.digitalTool;
    digitalToolRef.current = tool;
    
    if (tool === 'line') {
      if (clickCountRef.current === 0) {
        clickCountRef.current = 1;
        firstPointRef.current = point;
        setLinePoints([point]);
      } else {
        if (firstPointRef.current) {
          const stroke: Stroke = createDigitalStroke('line', [firstPointRef.current, point], store);
          addStrokes([stroke]);
        }
        clickCountRef.current = 0;
        firstPointRef.current = null;
        setLinePoints([]);
      }
    } else if (tool === 'circle') {
      if (clickCountRef.current === 0) {
        clickCountRef.current = 1;
        setCircleCenter(point);
      } else {
        if (circleCenter) {
          const radius = Math.hypot(point.x - circleCenter.x, point.y - circleCenter.y);
          const stroke: Stroke = createDigitalStroke('circle', [circleCenter, point], store, {
            center: circleCenter,
            radius,
            startAngle: 0,
            endAngle: Math.PI * 2,
          });
          addStrokes([stroke]);
        }
        clickCountRef.current = 0;
        setCircleCenter(null);
        setCircleRadiusPoint(null);
      }
    } else if (tool === 'arc') {
      if (clickCountRef.current === 0) {
        clickCountRef.current = 1;
        setArcPoints([point]);
      } else if (clickCountRef.current === 1) {
        clickCountRef.current = 2;
        setArcPoints(prev => [...prev, point]);
      } else {
        if (arcPoints.length >= 2) {
          const center = arcPoints[0];
          const startPoint = arcPoints[1];
          const radius = Math.hypot(startPoint.x - center.x, startPoint.y - center.y);
          const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
          const endAngle = Math.atan2(point.y - center.y, point.x - center.x);
          
          const stroke: Stroke = createDigitalStroke('arc', arcPoints, store, {
            center,
            radius,
            startAngle,
            endAngle,
          });
          addStrokes([stroke]);
        }
        clickCountRef.current = 0;
        setArcPoints([]);
        setArcRadiusPoint(null);
      }
    } else if (tool === 'curve') {
      const newCurvePoints = [...curvePoints, point];
      setCurvePoints(newCurvePoints);
      
      if (newCurvePoints.length >= 4) {
        const stroke: Stroke = createDigitalStroke('bezier', newCurvePoints, store);
        addStrokes([stroke]);
        setCurvePoints([]);
      }
    }
  }, [screenToWorld, applySnap, store.digitalTool, store, addStrokes, circleCenter, arcPoints, curvePoints]);

  /**
   * Handle digital mode mouse move - update preview
   */
  const handleDigitalMove = useCallback((e: React.MouseEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y);
    
    const snapped = applySnap(worldPoint);
    const point = snapped.point;
    
    const tool = digitalToolRef.current;
    
    if (tool === 'line' && clickCountRef.current === 1 && firstPointRef.current) {
      setLinePoints([firstPointRef.current, point]);
    } else if (tool === 'circle' && clickCountRef.current === 1 && circleCenter) {
      setCircleRadiusPoint(point);
    } else if (tool === 'arc' && clickCountRef.current === 2 && arcPoints.length >= 2) {
      setArcRadiusPoint(point);
    }
  }, [screenToWorld, applySnap, circleCenter, arcPoints]);

  /**
   * Handle digital mode mouse up
   */
  const handleDigitalUp = useCallback(() => {
    // Cleanup if needed
  }, []);

  return {
    linePoints,
    circleCenter,
    circleRadiusPoint,
    arcPoints,
    arcRadiusPoint,
    curvePoints,
    handleDigitalDown,
    handleDigitalMove,
    handleDigitalUp,
  };
}

function createDigitalStroke(
  type: 'line' | 'circle' | 'arc' | 'bezier',
  points: Point[],
  store: any,
  arcData?: { center: Point; radius: number; startAngle: number; endAngle: number }
): Stroke {
  let segment: DigitalSegment;
  
  if (type === 'line') {
    segment = { id: generateId(), type: 'line', points, color: store.currentColor };
  } else if (type === 'circle' || type === 'arc') {
    segment = { id: generateId(), type: 'arc', points, color: store.currentColor, arcData: arcData! };
  } else {
    segment = { id: generateId(), type: 'bezier', points, color: store.currentColor };
  }
  
  return {
    id: generateId(),
    points,
    smoothedPoints: points,
    displayPoints: points,
    color: store.currentColor,
    thickness: store.currentBrushSettings.size,
    timestamp: Date.now(),
    strokeType: 'digital',
    digitalSegments: [segment],
  };
}
