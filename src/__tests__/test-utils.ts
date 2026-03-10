// Test utilities for digital mode testing
import { create } from 'zustand';
import type { Point, Stroke, DigitalSegment, LengthUnit, ToolCategory, ArtisticTool, DigitalTool, MeasureTool, AngleUnit } from '../types';
import type { BrushSettings } from '../brush/presets';

// Constants for testing
const DEFAULT_PIXELS_PER_UNIT: Record<LengthUnit, number> = {
  mm: 3.78,
  cm: 37.8,
  inch: 96,
  px: 1,
};

// Define test store type based on actual store.ts
interface DigitalElement {
  strokeId: string;
  segmentId: string;
  pointIndex: number;
  point: Point;
  type: 'endpoint' | 'control' | 'cross';
}

interface FillRegion {
  id: string;
  points: Point[];
  color: string;
  opacity: number;
}

interface TestStoreState {
  // Tool Category
  toolCategory: ToolCategory;
  setToolCategory: (category: ToolCategory) => void;

  // Unit System
  unit: LengthUnit;
  angleUnit: AngleUnit;
  pixelsPerUnit: number;
  setUnit: (unit: LengthUnit) => void;
  setAngleUnit: (unit: AngleUnit) => void;
  setPixelsPerUnit: (pixels: number) => void;

  // Artistic Tool
  artisticTool: ArtisticTool;
  setArtisticTool: (tool: ArtisticTool) => void;

  // Digital Tool
  digitalTool: DigitalTool;
  setDigitalTool: (tool: DigitalTool) => void;
  
  // Digital Mode
  digitalMode: 'select' | 'draw';
  setDigitalMode: (mode: 'select' | 'draw') => void;
  
  // Circle Creation Mode
  circleCreationMode: 'centerRadius' | 'threePoint';
  setCircleCreationMode: (mode: 'centerRadius' | 'threePoint') => void;

  // Measure Tool
  measureTool: MeasureTool | null;
  measureStartPoint: Point | null;
  measureEndPoint: Point | null;
  measureFirstLine: { strokeId: string; segmentIndex: number } | null;
  measureSecondLine: { strokeId: string; segmentIndex: number } | null;
  measureFaceId: string | null;
  selectMode: 'point' | 'line' | 'arc';
  lastMeasureValue: string;
  drawingClearCounter: number;
  setMeasureTool: (tool: MeasureTool | null) => void;
  setMeasureStartPoint: (point: Point | null) => void;
  setMeasureEndPoint: (point: Point | null) => void;
  setMeasureFirstLine: (line: { strokeId: string; segmentIndex: number } | null) => void;
  setMeasureSecondLine: (line: { strokeId: string; segmentIndex: number } | null) => void;
  setMeasureFaceId: (id: string | null) => void;
  setSelectMode: (mode: 'point' | 'line' | 'arc') => void;
  setLastMeasureValue: (value: string) => void;
  clearMeasure: () => void;
  clearCurrentMeasurement: () => void;
  incrementClearCounter: () => void;

  // Mode (for backward compatibility - select/draw)
  mode: 'select' | 'draw';
  setMode: (mode: 'select' | 'draw') => void;

  // Digital Selection
  selectedDigitalStrokeIds: string[];
  setSelectedDigitalStrokeIds: (ids: string[]) => void;
  selectedDigitalElement: DigitalElement | null;
  setSelectedDigitalElement: (element: DigitalElement | null) => void;
  hoveredDigitalElement: DigitalElement | null;
  setHoveredDigitalElement: (element: DigitalElement | null) => void;
  hoveredDigitalStrokeId: string | null;
  setHoveredDigitalStrokeId: (id: string | null) => void;

  // Strokes
  strokes: Stroke[];
  addStroke: (stroke: Stroke) => void;
  addStrokesBatch: (strokes: Stroke[]) => void;
  removeStroke: (id: string) => void;
  updateStroke: (id: string, stroke: Stroke, skipHistory?: boolean) => void;
  updateStrokes: (strokes: { id: string; stroke: Stroke }[]) => void;
  clearStrokes: () => void;
  
  // Fill Regions
  fillRegions: FillRegion[];
  selectedFillRegionId: string | null;
  setFillRegions: (regions: FillRegion[]) => void;
  setSelectedFillRegionId: (id: string | null) => void;

  // Canvas State
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  currentColor: string;
  currentThickness: number;
  predictEnabled: boolean;
  smoothEnabled: boolean;
  snapEnabled: boolean;
  snapThreshold: number;
  selectedStrokeIds: string[];
  setSelectedStrokeIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  setPredictEnabled: (enabled: boolean) => void;
  setSmoothEnabled: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapThreshold: (threshold: number) => void;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;

  // Brush System
  currentBrushType: string;
  currentBrushSettings: BrushSettings;
  setBrushType: (type: string) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  setBrushHardness: (hardness: number) => void;

  // History
  history: any[];
  historyIndex: number;
  pushHistory: (state: any) => void;
  undo: () => void;
  redo: () => void;

  // Helper methods
  getDigitalSegments: () => DigitalSegment[];
}

// Helper to create a test store instance (vanilla version for testing)
export function createTestStore() {
  // Create a vanilla store for testing (avoiding React hooks)
  return create<TestStoreState>((set) => ({
    // Tool Category
    toolCategory: 'digital',
    setToolCategory: (category) => set({ toolCategory: category }),

    // Unit System
    unit: 'mm',
    angleUnit: 'degree',
    pixelsPerUnit: 3.78,
    setUnit: (unit) => set({ unit, pixelsPerUnit: DEFAULT_PIXELS_PER_UNIT[unit] }),
    setAngleUnit: (angleUnit) => set({ angleUnit }),
    setPixelsPerUnit: (pixelsPerUnit) => set({ pixelsPerUnit }),

    // Artistic Tool
    artisticTool: 'pencil',
    setArtisticTool: (tool) => set({ artisticTool: tool }),

    // Digital Tool
    digitalTool: 'line',
    setDigitalTool: (tool) => set({ digitalTool: tool }),
    
    // Digital Mode
    digitalMode: 'draw',
    setDigitalMode: (mode) => set({ digitalMode: mode }),
    
    // Circle Creation Mode
    circleCreationMode: 'centerRadius',
    setCircleCreationMode: (mode) => set({ circleCreationMode: mode }),

    // Measure Tool
    measureTool: null,
    measureStartPoint: null,
    measureEndPoint: null,
    measureFirstLine: null,
    measureSecondLine: null,
    measureFaceId: null,
    selectMode: 'point',
    lastMeasureValue: '--',
    setMeasureTool: (tool) => set({ measureTool: tool }),
    setMeasureStartPoint: (point) => set({ measureStartPoint: point }),
    setMeasureEndPoint: (point) => set({ measureEndPoint: point }),
    setMeasureFirstLine: (line) => set({ measureFirstLine: line }),
    setMeasureSecondLine: (line) => set({ measureSecondLine: line }),
    setMeasureFaceId: (id) => set({ measureFaceId: id }),
    setSelectMode: (mode) => {
      set({ selectMode: mode });
    },
    setLastMeasureValue: (value) => set({ lastMeasureValue: value }),
    clearMeasure: () => set((state) => ({
      measureTool: state.measureTool,
      measureStartPoint: null,
      measureEndPoint: null,
      measureFirstLine: null,
      measureSecondLine: null,
      measureFaceId: null,
      lastMeasureValue: '--',
    })),
    clearCurrentMeasurement: () => set({ measureStartPoint: null, measureEndPoint: null, measureFirstLine: null, measureSecondLine: null, measureFaceId: null, lastMeasureValue: '--' }),
    drawingClearCounter: 0,
    incrementClearCounter: () => set((state) => ({ drawingClearCounter: state.drawingClearCounter + 1 })),

    // Mode (backward compatibility)
    mode: 'select',
    
    // Digital Selection
    selectedDigitalStrokeIds: [],
    setSelectedDigitalStrokeIds: (ids) => set({ selectedDigitalStrokeIds: ids }),
    selectedDigitalElement: null,
    setSelectedDigitalElement: (element) => set({ selectedDigitalElement: element }),
    hoveredDigitalElement: null,
    setHoveredDigitalElement: (element) => set({ hoveredDigitalElement: element }),
    hoveredDigitalStrokeId: null,
    setHoveredDigitalStrokeId: (id) => set({ hoveredDigitalStrokeId: id }),

    strokes: [],
    fillRegions: [],
    selectedFillRegionId: null,
    canvasWidth: 100,
    canvasHeight: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    currentColor: '#000000',
    currentThickness: 2,
    predictEnabled: false,
    smoothEnabled: true,
    snapEnabled: true,
    snapThreshold: 10,
    selectedStrokeIds: [],
    history: [{ strokes: [], canvasWidth: 100, canvasHeight: 100, zoom: 1, panX: 0, panY: 0, predictEnabled: false, smoothEnabled: true }],
    historyIndex: 0,

    currentBrushType: 'pencil',
    currentBrushSettings: { type: 'pencil', size: 2, opacity: 0.9, pressure: false, hardness: 0.95, spacing: 0.3, curvatureAdaptation: false },

    // Mode
    setMode: (mode) => set({ mode }),

    // Stroke operations (simplified for testing)
    addStroke: (stroke) =>
      set((state) => {
        const newStrokes = [...state.strokes, stroke];
        return {
          strokes: newStrokes,
          selectedStrokeIds: [],
        };
      }),

    removeStroke: (id) =>
      set((state) => {
        const newStrokes = state.strokes.filter((s) => s.id !== id);
        return {
          strokes: newStrokes,
          selectedStrokeIds: state.selectedStrokeIds.filter((sid) => sid !== id),
        };
      }),

    updateStroke: (id, stroke, skipHistory?: boolean) =>
      set((state) => {
        const newStrokes = state.strokes.map((s) => (s.id === id ? stroke : s));
        return {
          strokes: newStrokes,
        };
      }),

    clearStrokes: () =>
      set(() => ({
        strokes: [],
        selectedStrokeIds: [],
        fillRegions: [],
      })),

    // Batch stroke operations
    addStrokesBatch: (strokes: Stroke[]) =>
      set((state) => {
        if (strokes.length === 0) return state;
        
        const newStrokes = [...state.strokes, ...strokes];
        return {
          strokes: newStrokes,
          selectedStrokeIds: [],
        };
      }),

    // Selection operations
    setSelectedStrokeIds: (ids) => set({ selectedStrokeIds: ids }),

    addToSelection: (id) =>
      set((state) => ({
        selectedStrokeIds: state.selectedStrokeIds.includes(id)
          ? state.selectedStrokeIds
          : [...state.selectedStrokeIds, id],
      })),

    removeFromSelection: (id) =>
      set((state) => ({
        selectedStrokeIds: state.selectedStrokeIds.filter((sid) => sid !== id),
      })),

    toggleSelection: (id) =>
      set((state) => ({
        selectedStrokeIds: state.selectedStrokeIds.includes(id)
          ? state.selectedStrokeIds.filter((sid) => sid !== id)
          : [...state.selectedStrokeIds, id],
      })),

    clearSelection: () => set({ selectedStrokeIds: [] }),

    // Fill Region operations
    setFillRegions: (regions) => set({ fillRegions: regions }),
    setSelectedFillRegionId: (id) => set({ selectedFillRegionId: id }),

    // Update multiple strokes at once (for move operations)
    updateStrokes: (updates) =>
      set((state) => {
        const newStrokes = state.strokes.map((s) => {
          const update = updates.find((u) => u.id === s.id);
          return update ? update.stroke : s;
        });
        return {
          strokes: newStrokes,
        };
      }),

    // Canvas operations
    setZoom: (zoom) =>
      set(() => {
        const clampedZoom = Math.max(0.5, Math.min(5, zoom));
        return { zoom: clampedZoom };
      }),

    setPan: (panX, panY) => set({ panX, panY }),

    setPredictEnabled: (enabled) => set({ predictEnabled: enabled }),
    setSmoothEnabled: (enabled) => set({ smoothEnabled: enabled }),
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    setSnapThreshold: (threshold) => set({ snapThreshold: threshold }),

    // New Brush System
    setBrushType: (type) => {
      const presets: Record<string, BrushSettings> = {
        pencil: { type: 'pencil', size: 2, opacity: 0.9, pressure: false, hardness: 0.95, spacing: 0.3, curvatureAdaptation: false },
        pen: { type: 'pen', size: 1.5, opacity: 0.85, pressure: true, hardness: 0.8, spacing: 0.2, curvatureAdaptation: true },
        brush: { type: 'brush', size: 8, opacity: 0.4, pressure: true, hardness: 0.3, spacing: 0.15, curvatureAdaptation: true },
        ballpen: { type: 'ballpen', size: 1, opacity: 0.7, pressure: false, hardness: 0.6, spacing: 0.25, curvatureAdaptation: false },
      };
      set({
        currentBrushType: type,
        currentBrushSettings: presets[type] || presets.pencil,
      });
    },
    setBrushSize: (size) =>
      set((state) => ({
        currentBrushSettings: { ...state.currentBrushSettings, size },
      })),
    setBrushOpacity: (opacity) =>
      set((state) => ({
        currentBrushSettings: { ...state.currentBrushSettings, opacity },
      })),
    setBrushHardness: (hardness) =>
      set((state) => ({
        currentBrushSettings: { ...state.currentBrushSettings, hardness },
      })),

    // Drawing tools
    setColor: (color) => set({ currentColor: color }),
    setThickness: (thickness) => set({ currentThickness: thickness }),

    // History (simplified for testing)
    pushHistory: (state) =>
      set((current) => {
        const newHistory = [...current.history, state];
        return {
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex > 0) {
          const previousState = state.history[state.historyIndex - 1];
          return {
            strokes: previousState.strokes,
            canvasWidth: previousState.canvasWidth,
            canvasHeight: previousState.canvasHeight,
            zoom: previousState.zoom,
            panX: previousState.panX,
            panY: previousState.panY,
            predictEnabled: previousState.predictEnabled ?? state.predictEnabled,
            historyIndex: state.historyIndex - 1,
          };
        }
        return state;
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          const nextState = state.history[state.historyIndex + 1];
          return {
            strokes: nextState.strokes,
            canvasWidth: nextState.canvasWidth,
            canvasHeight: nextState.canvasHeight,
            zoom: nextState.zoom,
            panX: nextState.panX,
            panY: nextState.panY,
            predictEnabled: nextState.predictEnabled ?? state.predictEnabled,
            historyIndex: state.historyIndex + 1,
          };
        }
        return state;
      }),

    // Helper to get all digital segments from strokes (stub implementation)
    getDigitalSegments: () => {
      const segments: DigitalSegment[] = [];
      return segments;
    },
  }));
}

// Type for store instance
export type TestStore = ReturnType<typeof createTestStore>;

// Geometry test helpers
export const geometry = {
  createPoint: (x: number, y: number): Point => ({ x, y }),
  
  createLineSegment: (x1: number, y1: number, x2: number, y2: number): DigitalSegment => ({
    id: `line-${Math.random().toString(36).substr(2, 9)}`,
    type: 'line',
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    color: '#000000',
  }),
  
  createCircleSegment: (centerX: number, centerY: number, radius: number): DigitalSegment => ({
    id: `circle-${Math.random().toString(36).substr(2, 9)}`,
    type: 'arc',
    points: [
      { x: centerX + radius, y: centerY },
      { x: centerX, y: centerY + radius },
      { x: centerX - radius, y: centerY },
      { x: centerX, y: centerY - radius },
    ],
    arcData: {
      center: { x: centerX, y: centerY },
      radius,
      startAngle: 0,
      endAngle: 2 * Math.PI,
    },
    color: '#000000',
  }),
  
  createArcSegment: (
    centerX: number, 
    centerY: number, 
    radius: number, 
    startAngle: number, 
    endAngle: number
  ): DigitalSegment => ({
    id: `arc-${Math.random().toString(36).substr(2, 9)}`,
    type: 'arc',
    points: [
      { x: centerX + radius * Math.cos(startAngle), y: centerY + radius * Math.sin(startAngle) },
      { x: centerX + radius * Math.cos((startAngle + endAngle) / 2), y: centerY + radius * Math.sin((startAngle + endAngle) / 2) },
      { x: centerX + radius * Math.cos(endAngle), y: centerY + radius * Math.sin(endAngle) },
    ],
    arcData: {
      center: { x: centerX, y: centerY },
      radius,
      startAngle,
      endAngle,
    },
    color: '#000000',
  }),
  
  createDigitalStroke: (
    segments: DigitalSegment[], 
    isClosed: boolean = false
  ): Stroke => ({
    id: `stroke-${Math.random().toString(36).substr(2, 9)}`,
    points: [],
    smoothedPoints: [],
    color: '#000000',
    thickness: 2,
    timestamp: Date.now(),
    strokeType: 'digital',
    digitalSegments: segments,
    isClosed,
  }),
  
  createArtisticStroke: (points: Point[]): Stroke => ({
    id: `stroke-${Math.random().toString(36).substr(2, 9)}`,
    points,
    smoothedPoints: points,
    color: '#000000',
    thickness: 2,
    timestamp: Date.now(),
    strokeType: 'artistic',
  }),
};

// Unit conversion test helpers
export const units = {
  DEFAULT_PIXELS_PER_UNIT: {
    mm: 3.78,
    cm: 37.8,
    inch: 96,
    px: 1,
  } as const,
  
  pixelsToUnit: (pixels: number, unit: LengthUnit, pixelsPerUnit?: number): number => {
    const conversion = pixelsPerUnit || units.DEFAULT_PIXELS_PER_UNIT[unit];
    return pixels / conversion;
  },
  
  unitToPixels: (units: number, pixelsPerUnit: number): number => {
    return units * pixelsPerUnit;
  },
  
  radiansToDegrees: (radians: number): number => {
    return (radians * 180) / Math.PI;
  },
  
  degreesToRadians: (degrees: number): number => {
    return (degrees * Math.PI) / 180;
  },
};