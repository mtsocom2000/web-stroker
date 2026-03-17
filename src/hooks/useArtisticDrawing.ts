import { useState, useCallback, useRef } from 'react';
import type { Point, Stroke } from '../types';
import { generateId } from '../utils';
import { simplifyStroke } from '../brush/strokeSimplifier';
import { smoothStrokeCatmullRom, smoothStrokeEnhanced } from '../brush/curveSmoothing';
import { predictShape } from '../predict';
import { validateShapePrediction } from '../predict/shapeSimilarity';
import type { BrushSettings } from '../brush/presets';

export type StrokeMode = 'original' | 'smooth' | 'predict';

interface UseArtisticDrawingOptions {
  strokeMode: StrokeMode;
  currentColor: string;
  currentThickness: number;
  brushSettings: BrushSettings;
  addStroke: (stroke: Stroke) => void;
  setLastStrokeOriginalData: (data: { 
    id: string; 
    originalPoints: Point[]; 
    simplifiedPoints?: Point[]; 
    displayPoints?: Point[] 
  } | null) => void;
}

interface UseArtisticDrawingReturn {
  currentStrokePoints: Point[];
  isDrawing: boolean;
  startDrawing: (point: Point) => void;
  addPoint: (point: Point) => void;
  endDrawing: () => void;
  cancelDrawing: () => void;
}

/**
 * Hook for managing artistic/freehand drawing
 * 
 * Responsibilities:
 * - Handle drawing state (start, move, end)
 * - Apply stroke processing (simplify, smooth, predict)
 * - Create and save strokes to store
 * - Support undo predict functionality
 * 
 * @param options - Configuration options
 * @returns Drawing state and control functions
 */
export function useArtisticDrawing(options: UseArtisticDrawingOptions): UseArtisticDrawingReturn {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);
  
  // Refs to store original data for undo predict
  const originalPointsRef = useRef<Point[]>([]);
  const strokeIdRef = useRef<string>('');

  const {
    strokeMode,
    currentColor,
    currentThickness,
    brushSettings,
    addStroke,
    setLastStrokeOriginalData,
  } = options;

  const startDrawing = useCallback((point: Point) => {
    const timestamp = Date.now();
    setIsDrawing(true);
    setCurrentStrokePoints([{ ...point, timestamp }]);
    originalPointsRef.current = [{ ...point, timestamp }];
    strokeIdRef.current = generateId();
  }, []);

  const addPoint = useCallback((point: Point) => {
    if (!isDrawing) return;
    
    const timestamp = Date.now();
    const newPoint = { ...point, timestamp };
    
    setCurrentStrokePoints(prev => [...prev, newPoint]);
    originalPointsRef.current.push(newPoint);
  }, [isDrawing]);

  const endDrawing = useCallback(() => {
    if (!isDrawing || currentStrokePoints.length < 2) {
      setIsDrawing(false);
      setCurrentStrokePoints([]);
      return;
    }

    const originalPoints = originalPointsRef.current;
    let processedPoints: Point[] = [...originalPoints];
    let displayPoints: Point[] | undefined;

    // Step 1: Simplify stroke
    if (originalPoints.length >= 3) {
      const result = simplifyStroke(originalPoints);
      processedPoints = result.simplifiedPoints;
    }

    // Step 2: Apply smoothing or prediction based on mode
    if (strokeMode === 'smooth' && processedPoints.length >= 3) {
      processedPoints = smoothStrokeCatmullRom(processedPoints, { tension: 0.5, segmentCount: 4 });
    } else if (strokeMode === 'predict' && processedPoints.length >= 3) {
      const predicted = predictShape(processedPoints);
      if (predicted && validateShapePrediction(processedPoints, predicted)) {
        displayPoints = predicted;
      } else {
        // Fall back to smoothing if prediction fails
        processedPoints = smoothStrokeEnhanced(processedPoints);
      }
    }

    // Create stroke object
    const stroke: Stroke = {
      id: strokeIdRef.current,
      points: originalPoints,
      smoothedPoints: processedPoints,
      displayPoints,
      color: currentColor,
      thickness: currentThickness,
      timestamp: Date.now(),
      strokeType: 'artistic',
      brushType: brushSettings.type,
      brushSettings,
    };

    // Save original data for undo predict
    setLastStrokeOriginalData({
      id: strokeIdRef.current,
      originalPoints: [...originalPoints],
      simplifiedPoints: [...processedPoints],
      displayPoints: displayPoints ? [...displayPoints] : undefined,
    });

    // Add stroke to store
    addStroke(stroke);

    // Reset drawing state
    setIsDrawing(false);
    setCurrentStrokePoints([]);
    originalPointsRef.current = [];
  }, [isDrawing, currentStrokePoints, strokeMode, currentColor, currentThickness, brushSettings, addStroke, setLastStrokeOriginalData]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setCurrentStrokePoints([]);
    originalPointsRef.current = [];
  }, []);

  return {
    currentStrokePoints,
    isDrawing,
    startDrawing,
    addPoint,
    endDrawing,
    cancelDrawing,
  };
}
