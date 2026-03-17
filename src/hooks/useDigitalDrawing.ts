import { useState, useCallback, useRef } from 'react';
import type { Point, Stroke, DigitalSegment } from '../types';
import { generateId } from '../utils';

export type DigitalTool = 'line' | 'circle' | 'arc' | 'curve';
export type CircleCreationMode = 'centerRadius' | 'threePoint';

interface UseDigitalDrawingOptions {
  currentColor: string;
  currentThickness: number;
  snapEnabled: boolean;
  snapThreshold: number;
  circleCreationMode: CircleCreationMode;
  addStroke: (stroke: Stroke) => void;
}

interface UseDigitalDrawingReturn {
  // State
  digitalLinePoints: Point[];
  digitalLinePreviewEnd: Point | null;
  circleCenter: Point | null;
  circleRadiusPoint: Point | null;
  circlePoints: Point[];
  arcPoints: Point[];
  arcRadiusPoint: Point | null;
  curvePoints: Point[];
  isDrawing: boolean;
  
  // Actions
  startLine: (point: Point) => void;
  addLinePoint: (point: Point) => void;
  updateLinePreview: (point: Point) => void;
  endLine: () => void;
  
  startCircle: (point: Point) => void;
  updateCircleRadius: (point: Point) => void;
  addCirclePoint: (point: Point) => void;
  endCircle: () => void;
  
  startArc: (point: Point) => void;
  addArcPoint: (point: Point) => void;
  updateArcPreview: (point: Point) => void;
  endArc: () => void;
  
  startCurve: (point: Point) => void;
  addCurvePoint: (point: Point) => void;
  updateCurvePreview: (point: Point) => void;
  endCurve: () => void;
  
  cancelDrawing: () => void;
}

/**
 * Hook for managing digital/precision drawing (lines, circles, arcs, curves)
 * 
 * Responsibilities:
 * - Handle state for different digital tools (line, circle, arc, curve)
 * - Manage multi-point drawing sequences
 * - Create digital strokes with segments
 * - Support snapping and preview
 * 
 * @param options - Configuration options
 * @returns Drawing state and control functions
 */
export function useDigitalDrawing(options: UseDigitalDrawingOptions): UseDigitalDrawingReturn {
  const [digitalLinePoints, setDigitalLinePoints] = useState<Point[]>([]);
  const [digitalLinePreviewEnd, setDigitalLinePreviewEnd] = useState<Point | null>(null);
  const [circleCenter, setCircleCenter] = useState<Point | null>(null);
  const [circleRadiusPoint, setCircleRadiusPoint] = useState<Point | null>(null);
  const [circlePoints, setCirclePoints] = useState<Point[]>([]);
  const [arcPoints, setArcPoints] = useState<Point[]>([]);
  const [arcRadiusPoint, setArcRadiusPoint] = useState<Point | null>(null);
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const currentToolRef = useRef<DigitalTool | null>(null);

  const {
    currentColor,
    currentThickness,
    addStroke,
  } = options;

  // Line drawing
  const startLine = useCallback((point: Point) => {
    setDigitalLinePoints([point]);
    setDigitalLinePreviewEnd(null);
    setIsDrawing(true);
    currentToolRef.current = 'line';
  }, []);

  const addLinePoint = useCallback((point: Point) => {
    setDigitalLinePoints(prev => [...prev, point]);
  }, []);

  const updateLinePreview = useCallback((point: Point) => {
    setDigitalLinePreviewEnd(point);
  }, []);

  const endLine = useCallback(() => {
    if (digitalLinePoints.length < 2) {
      cancelDrawing();
      return;
    }

    const segment: DigitalSegment = {
      id: generateId(),
      type: 'line',
      points: [...digitalLinePoints],
      color: currentColor,
    };

    const stroke: Stroke = {
      id: generateId(),
      points: [...digitalLinePoints],
      smoothedPoints: [...digitalLinePoints],
      color: currentColor,
      thickness: currentThickness,
      timestamp: Date.now(),
      strokeType: 'digital',
      digitalSegments: [segment],
    };

    addStroke(stroke);
    cancelDrawing();
  }, [digitalLinePoints, currentColor, currentThickness, addStroke]);

  // Circle drawing
  const startCircle = useCallback((point: Point) => {
    setCircleCenter(point);
    setCircleRadiusPoint(null);
    setCirclePoints([point]);
    setIsDrawing(true);
    currentToolRef.current = 'circle';
  }, []);

  const updateCircleRadius = useCallback((point: Point) => {
    setCircleRadiusPoint(point);
  }, []);

  const addCirclePoint = useCallback((point: Point) => {
    setCirclePoints(prev => [...prev, point]);
  }, []);

  const endCircle = useCallback(() => {
    if (!circleCenter || !circleRadiusPoint) {
      cancelDrawing();
      return;
    }

    const radius = Math.hypot(
      circleRadiusPoint.x - circleCenter.x,
      circleRadiusPoint.y - circleCenter.y
    );

    const segment: DigitalSegment = {
      id: generateId(),
      type: 'arc',
      points: [],
      color: currentColor,
      arcData: {
        center: circleCenter,
        radius,
        startAngle: 0,
        endAngle: Math.PI * 2,
      },
    };

    const stroke: Stroke = {
      id: generateId(),
      points: [circleCenter, circleRadiusPoint],
      smoothedPoints: [circleCenter, circleRadiusPoint],
      color: currentColor,
      thickness: currentThickness,
      timestamp: Date.now(),
      strokeType: 'digital',
      digitalSegments: [segment],
    };

    addStroke(stroke);
    cancelDrawing();
  }, [circleCenter, circleRadiusPoint, currentColor, currentThickness, addStroke]);

  // Arc drawing
  const startArc = useCallback((point: Point) => {
    setArcPoints([point]);
    setArcRadiusPoint(null);
    setIsDrawing(true);
    currentToolRef.current = 'arc';
  }, []);

  const addArcPoint = useCallback((point: Point) => {
    setArcPoints(prev => {
      const newPoints = [...prev, point];
      return newPoints;
    });
  }, []);

  const updateArcPreview = useCallback((point: Point) => {
    setArcRadiusPoint(point);
  }, []);

  const endArc = useCallback(() => {
    if (arcPoints.length < 2) {
      cancelDrawing();
      return;
    }

    const center = arcPoints[0];
    const startPoint = arcPoints[1];
    const radius = Math.hypot(startPoint.x - center.x, startPoint.y - center.y);
    
    // Calculate angles
    const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
    let endAngle = startAngle + Math.PI / 2; // Default 90 degrees
    
    if (arcPoints.length >= 3) {
      const endPoint = arcPoints[2];
      endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
    }

    const segment: DigitalSegment = {
      id: generateId(),
      type: 'arc',
      points: [...arcPoints],
      color: currentColor,
      arcData: {
        center,
        radius,
        startAngle,
        endAngle,
      },
    };

    const stroke: Stroke = {
      id: generateId(),
      points: [...arcPoints],
      smoothedPoints: [...arcPoints],
      color: currentColor,
      thickness: currentThickness,
      timestamp: Date.now(),
      strokeType: 'digital',
      digitalSegments: [segment],
    };

    addStroke(stroke);
    cancelDrawing();
  }, [arcPoints, currentColor, currentThickness, addStroke]);

  // Curve (Bezier) drawing
  const startCurve = useCallback((point: Point) => {
    setCurvePoints([point]);
    setIsDrawing(true);
    currentToolRef.current = 'curve';
  }, []);

  const addCurvePoint = useCallback((point: Point) => {
    setCurvePoints(prev => {
      if (prev.length >= 4) return prev; // Max 4 points for cubic bezier
      return [...prev, point];
    });
  }, []);

  const updateCurvePreview = useCallback((_point: Point) => {
    // For curve, we just track the last mouse position
    // Actual point is added on click
  }, []);

  const endCurve = useCallback(() => {
    if (curvePoints.length < 2) {
      cancelDrawing();
      return;
    }

    // Ensure we have at least 4 points for cubic bezier
    const points = [...curvePoints];
    while (points.length < 4) {
      const lastPoint = points[points.length - 1];
      points.push({ ...lastPoint });
    }

    const segment: DigitalSegment = {
      id: generateId(),
      type: 'bezier',
      points: points.slice(0, 4),
      color: currentColor,
    };

    const stroke: Stroke = {
      id: generateId(),
      points: [...curvePoints],
      smoothedPoints: [...curvePoints],
      color: currentColor,
      thickness: currentThickness,
      timestamp: Date.now(),
      strokeType: 'digital',
      digitalSegments: [segment],
    };

    addStroke(stroke);
    cancelDrawing();
  }, [curvePoints, currentColor, currentThickness, addStroke]);

  const cancelDrawing = useCallback(() => {
    setDigitalLinePoints([]);
    setDigitalLinePreviewEnd(null);
    setCircleCenter(null);
    setCircleRadiusPoint(null);
    setCirclePoints([]);
    setArcPoints([]);
    setArcRadiusPoint(null);
    setCurvePoints([]);
    setIsDrawing(false);
    currentToolRef.current = null;
  }, []);

  return {
    digitalLinePoints,
    digitalLinePreviewEnd,
    circleCenter,
    circleRadiusPoint,
    circlePoints,
    arcPoints,
    arcRadiusPoint,
    curvePoints,
    isDrawing,
    startLine,
    addLinePoint,
    updateLinePreview,
    endLine,
    startCircle,
    updateCircleRadius,
    addCirclePoint,
    endCircle,
    startArc,
    addArcPoint,
    updateArcPreview,
    endArc,
    startCurve,
    addCurvePoint,
    updateCurvePreview,
    endCurve,
    cancelDrawing,
  };
}
