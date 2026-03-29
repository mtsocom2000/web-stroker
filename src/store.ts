import { create } from 'zustand';
import type { Stroke, CanvasState, ToolCategory, ArtisticTool, DigitalTool, MeasureTool, Point, LengthUnit, AngleUnit, SelectableElement, Constraint } from './types';
import type { BrushType, BrushSettings } from './brush/presets';
import type { FillRegion } from './fillRegion';
import { ConstraintManager } from './constraints/ConstraintManager';

/** Stroke processing mode: original, smooth, or predict */
export type StrokeMode = 'original' | 'smooth' | 'predict';

const DEFAULT_PIXELS_PER_UNIT: Record<LengthUnit, number> = {
  mm: 3.78,
  cm: 37.8,
  inch: 96,
  px: 1,
};

type DigitalMode = 'select' | 'draw';

type CircleCreationMode = 'centerRadius' | 'threePoint';

interface DigitalElement {
  strokeId: string;
  segmentId: string;
  pointIndex: number;
  point: Point;
  type: 'endpoint' | 'control' | 'cross';
}

interface DrawingState {
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
  
  // Digital Mode (draw vs select for digital elements)
  digitalMode: DigitalMode;
  setDigitalMode: (mode: DigitalMode) => void;
  
  // Circle creation mode
  circleCreationMode: CircleCreationMode;
  setCircleCreationMode: (mode: CircleCreationMode) => void;

  // Measure Tool
  measureTool: MeasureTool | null;
  measureStartPoint: Point | null;
  measureEndPoint: Point | null;
  measureFirstLine: { strokeId: string; segmentIndex: number } | null;
  measureSecondLine: { strokeId: string; segmentIndex: number } | null;
  measureFaceId: string | null;
  selectMode: 'point' | 'line' | 'arc';
  lastMeasureValue: string;
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
  drawingClearCounter: number;
  incrementClearCounter: () => void;

  // Digital Selection
  selectedDigitalStrokeIds: string[];
  setSelectedDigitalStrokeIds: (ids: string[]) => void;
  selectedDigitalElement: DigitalElement | null;
  setSelectedDigitalElement: (element: DigitalElement | null) => void;
  hoveredDigitalElement: DigitalElement | null;
  setHoveredDigitalElement: (element: DigitalElement | null) => void;
  hoveredDigitalStrokeId: string | null;
  setHoveredDigitalStrokeId: (id: string | null) => void;
  
  // Selection (new architecture)
  selectedElements: SelectableElement[];
  setSelectedElements: (elements: SelectableElement[]) => void;
  activeTool: string;
  setActiveTool: (tool: string) => void;

  // Constraints
  constraints: Constraint[];
  constraintManager: ConstraintManager;
  addConstraint: (constraint: Constraint) => void;
  removeConstraint: (id: string) => void;
  updateConstraint: (id: string, value: number) => void;
  getConstraintsForPoint: (strokeId: string, pointIndex: number) => Constraint[];

  // Strokes
  strokes: Stroke[];
  addStroke: (stroke: Stroke) => void;
  addStrokesBatch: (strokes: Stroke[]) => void;
  removeStroke: (id: string) => void;
  updateStroke: (id: string, stroke: Stroke, skipHistory?: boolean) => void;
  updateStrokes: (strokes: { id: string; stroke: Stroke }[]) => void;
  updateStrokePoints: (id: string, points: Point[]) => void; // For animation replay
  clearStrokes: () => void;

  // Fill Regions
  fillRegions: FillRegion[];
  setFillRegions: (regions: FillRegion[]) => void;
  selectedFillRegionId: string | null;
  setSelectedFillRegionId: (id: string | null) => void;

  // Selection
  selectedStrokeIds: string[];
  setSelectedStrokeIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;

  // Drawing tools (legacy - for backward compatibility)
  currentColor: string;
  currentThickness: number;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;

  // Stroke mode: original, smooth, or predict
  strokeMode: StrokeMode;
  setStrokeMode: (mode: StrokeMode) => void;

  // Snap (digital mode snapping)
  snapEnabled: boolean;
  snapThreshold: number;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapThreshold: (threshold: number) => void;

  // New Brush System
  currentBrushType: BrushType;
  currentBrushSettings: BrushSettings;
  setBrushType: (type: BrushType) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  setBrushHardness: (hardness: number) => void;

  // Undo/Redo
  history: CanvasState[];
  historyIndex: number;
  pushHistory: (state: CanvasState) => void;
  undo: () => void;
  redo: () => void;

  // Animation Replay State
  isAnimationReplay: boolean;
  setAnimationReplay: (enabled: boolean) => void;

  // Undo Predict - 恢复最后一次绘制的预测
  lastStrokeOriginalData: { id: string; originalPoints: Point[]; simplifiedPoints?: Point[]; displayPoints?: Point[] } | null;
  setLastStrokeOriginalData: (data: { id: string; originalPoints: Point[]; simplifiedPoints?: Point[]; displayPoints?: Point[] } | null) => void;
  undoLastPredict: () => boolean;

  // Renderer Configuration
  renderer: 'canvas2d' | 'threejs';
  setRenderer: (renderer: 'canvas2d' | 'threejs') => void;
}

export const useDrawingStore = create<DrawingState>((set) => {
  const initialCanvasState: CanvasState = {
    strokes: [],
    canvasWidth: 100,
    canvasHeight: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    strokeMode: 'smooth',
  };

  const defaultBrushSettings: BrushSettings = {
    type: 'pencil',
    size: 2,
    opacity: 0.9,
    pressure: false,
    hardness: 0.95,
    spacing: 0.3,
    curvatureAdaptation: false,
  };

  return {
    // Tool Category
    toolCategory: 'digital',
    setToolCategory: (category) => set({ toolCategory: category }),

    // Unit System
    unit: 'mm',
    angleUnit: 'degree',
    pixelsPerUnit: DEFAULT_PIXELS_PER_UNIT.mm,
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
    
    // Selection (new architecture)
    selectedElements: [],
    setSelectedElements: (elements) => set({ selectedElements: elements }),
    activeTool: 'select',
    setActiveTool: (tool) => set({ activeTool: tool }),

    // Constraints
    constraints: [],
    constraintManager: new ConstraintManager(),
    addConstraint: (constraint) => set((state) => {
      state.constraintManager.addConstraint(constraint);
      return { constraints: state.constraintManager.getConstraints() };
    }),
    removeConstraint: (id) => set((state) => {
      state.constraintManager.removeConstraint(id);
      return { constraints: state.constraintManager.getConstraints() };
    }),
    updateConstraint: (id, value) => set((state) => {
      state.constraintManager.updateConstraint(id, value);
      return { constraints: state.constraintManager.getConstraints() };
    }),
    getConstraintsForPoint: (strokeId: string, pointIndex: number): Constraint[] => {
      return useDrawingStore.getState().constraintManager.getConstraintsForTarget(strokeId, pointIndex);
    },

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
    strokeMode: 'smooth',
    snapEnabled: true,
    snapThreshold: 10,
    selectedStrokeIds: [],
    history: [initialCanvasState],
    historyIndex: 0,

    currentBrushType: 'pencil',
    currentBrushSettings: defaultBrushSettings,

    // Undo Predict state
    lastStrokeOriginalData: null,
    setLastStrokeOriginalData: (data) => set({ lastStrokeOriginalData: data }),
    undoLastPredict: () => {
      let success = false;
      set((state) => {
        if (!state.lastStrokeOriginalData) {
          return state;
        }
        
        const { id, originalPoints } = state.lastStrokeOriginalData;
        const strokeIndex = state.strokes.findIndex((s) => s.id === id);
        
        if (strokeIndex === -1) {
          return { ...state, lastStrokeOriginalData: null };
        }
        
        // 恢复到原始绘制数据：使用最原始的 points（有抖动）
        const stroke = state.strokes[strokeIndex];
        const updatedStroke: Stroke = {
          ...stroke,
          points: originalPoints, // 恢复最原始的绘制点（有抖动）
          smoothedPoints: originalPoints, // 也恢复为原始点，不要保留规整后的
          displayPoints: undefined, // 清除预测结果
          cornerPoints: undefined, // 清除角点数据
          cornerIndices: undefined,
          segments: undefined,
        };
        
        const newStrokes = [...state.strokes];
        newStrokes[strokeIndex] = updatedStroke;
        
        // 同时更新 history
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
        });
        
        success = true;
        return {
          strokes: newStrokes,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastStrokeOriginalData: null, // 清除已恢复的数据
        };
      });
      return success;
    },

    // Stroke operations
    addStroke: (stroke) =>
      set((state) => {
        const newStrokes = [...state.strokes, stroke];
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
        });
        return {
          strokes: newStrokes,
          selectedStrokeIds: [],
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    removeStroke: (id) =>
      set((state) => {
        const newStrokes = state.strokes.filter((s) => s.id !== id);
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
        });
        return {
          strokes: newStrokes,
          selectedStrokeIds: state.selectedStrokeIds.filter((sid) => sid !== id),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    updateStroke: (id, stroke, skipHistory: boolean = false) =>
      set((state) => {
        const newStrokes = state.strokes.map((s) => (s.id === id ? stroke : s));
        
        if (skipHistory) {
          return {
            strokes: newStrokes,
          };
        }
        
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
        });
        return {
          strokes: newStrokes,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    updateStrokePoints: (id: string, points: Point[]) =>
      set((state) => {
        const strokeIndex = state.strokes.findIndex((s) => s.id === id);
        if (strokeIndex === -1) return state;
        
        // Create new strokes array to trigger React re-render
        const newStrokes = [...state.strokes];
        newStrokes[strokeIndex] = {
          ...newStrokes[strokeIndex],
          points: [...points],
        };
        
        return { strokes: newStrokes };
      }),

    clearStrokes: () =>
      set((_state) => {
        const newHistory = _state.history.slice(0, _state.historyIndex + 1);
        newHistory.push({
          strokes: [],
          canvasWidth: _state.canvasWidth,
          canvasHeight: _state.canvasHeight,
          zoom: _state.zoom,
          panX: _state.panX,
          panY: _state.panY,
        });
        return {
          strokes: [],
          selectedStrokeIds: [],
          fillRegions: [],
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    // Batch stroke operations
    addStrokesBatch: (strokes: Stroke[]) =>
      set((state) => {
        if (strokes.length === 0) return state;
        
        const newStrokes = [...state.strokes, ...strokes];
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
        });
        return {
          strokes: newStrokes,
          selectedStrokeIds: [],
          history: newHistory,
          historyIndex: newHistory.length - 1,
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
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
        });
        return {
          strokes: newStrokes,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    // Canvas operations
    setZoom: (zoom) =>
      set(() => {
        const clampedZoom = Math.max(0.5, Math.min(5, zoom));
        return { zoom: clampedZoom };
      }),

    setPan: (panX, panY) => set({ panX, panY }),

    setStrokeMode: (mode) => set({ strokeMode: mode }),
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    setSnapThreshold: (threshold) => set({ snapThreshold: threshold }),

    // New Brush System
    setBrushType: (type) => {
      const presets = {
        pencil: { type: 'pencil', size: 2, opacity: 0.9, pressure: false, hardness: 0.95, spacing: 0.3, curvatureAdaptation: false },
        pen: { type: 'pen', size: 1.5, opacity: 0.85, pressure: true, hardness: 0.8, spacing: 0.2, curvatureAdaptation: true },
        brush: { type: 'brush', size: 8, opacity: 0.4, pressure: true, hardness: 0.3, spacing: 0.15, curvatureAdaptation: true },
        ballpen: { type: 'ballpen', size: 1, opacity: 0.7, pressure: false, hardness: 0.6, spacing: 0.25, curvatureAdaptation: false },
      };
      set({
        currentBrushType: type,
        currentBrushSettings: presets[type] as BrushSettings,
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

    // History
    pushHistory: (state) =>
      set((current) => {
        const newHistory = current.history.slice(0, current.historyIndex + 1);
        newHistory.push(state);
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
            strokeMode: previousState.strokeMode ?? state.strokeMode,
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
            strokeMode: nextState.strokeMode ?? state.strokeMode,
            historyIndex: state.historyIndex + 1,
          };
        }
        return state;
      }),

    // Animation Replay
    isAnimationReplay: false,
    setAnimationReplay: (enabled) => set({ isAnimationReplay: enabled }),

    // Renderer Configuration
    renderer: 'canvas2d',
    setRenderer: (renderer) => set({ renderer }),
  };
});
