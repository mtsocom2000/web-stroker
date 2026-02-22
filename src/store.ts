import { create } from 'zustand';
import type { Stroke, CanvasState, DigitalSegment, ToolCategory, ArtisticTool, DigitalTool, Point } from './types';
import type { BrushType, BrushSettings } from './brush/presets';
import type { FillRegion } from './fillRegion';

type DrawingMode = 'select' | 'draw';

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

  // Mode (for backward compatibility - select/draw)
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;

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
  removeStroke: (id: string) => void;
  updateStroke: (id: string, stroke: Stroke) => void;
  updateStrokes: (strokes: { id: string; stroke: Stroke }[]) => void;
  clearStrokes: () => void;
  
  // Digital segments (helper - get all digital segments from strokes)
  getDigitalSegments: () => DigitalSegment[];

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

  // Predict (shape detection)
  predictEnabled: boolean;
  setPredictEnabled: (enabled: boolean) => void;

  // Smooth (stroke smoothing) - legacy
  smoothEnabled: boolean;
  setSmoothEnabled: (enabled: boolean) => void;

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
}

export const useDrawingStore = create<DrawingState>((set) => {
  const initialCanvasState: CanvasState = {
    strokes: [],
    canvasWidth: 100,
    canvasHeight: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    predictEnabled: false,
    smoothEnabled: true,
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
    toolCategory: 'artistic',
    setToolCategory: (category) => set({ toolCategory: category }),

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
    selectedStrokeIds: [],
    history: [initialCanvasState],
    historyIndex: 0,

    currentBrushType: 'pencil',
    currentBrushSettings: defaultBrushSettings,

    // Mode
    setMode: (mode) => set({ mode }),

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
          predictEnabled: state.predictEnabled,
          smoothEnabled: state.smoothEnabled,
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
          predictEnabled: state.predictEnabled,
          smoothEnabled: state.smoothEnabled,
        });
        return {
          strokes: newStrokes,
          selectedStrokeIds: state.selectedStrokeIds.filter((sid) => sid !== id),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    updateStroke: (id, stroke) =>
      set((state) => {
        const newStrokes = state.strokes.map((s) => (s.id === id ? stroke : s));
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push({
          strokes: newStrokes,
          canvasWidth: state.canvasWidth,
          canvasHeight: state.canvasHeight,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
          predictEnabled: state.predictEnabled,
          smoothEnabled: state.smoothEnabled,
        });
        return {
          strokes: newStrokes,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
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
          predictEnabled: _state.predictEnabled,
          smoothEnabled: _state.smoothEnabled,
        });
        return {
          strokes: [],
          selectedStrokeIds: [],
          fillRegions: [],
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
          predictEnabled: state.predictEnabled,
          smoothEnabled: state.smoothEnabled,
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

    setPredictEnabled: (enabled) => set({ predictEnabled: enabled }),
    setSmoothEnabled: (enabled) => set({ smoothEnabled: enabled }),

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

    // Helper to get all digital segments from strokes
    getDigitalSegments: () => {
      const segments: DigitalSegment[] = [];
      return segments;
    },
  };
});
