import { create } from 'zustand';
import type { Stroke, CanvasState } from './types';

type DrawingMode = 'select' | 'draw';

interface DrawingState {
  // Mode
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;

  // Strokes
  strokes: Stroke[];
  addStroke: (stroke: Stroke) => void;
  removeStroke: (id: string) => void;
  updateStroke: (id: string, stroke: Stroke) => void;
  updateStrokes: (strokes: { id: string; stroke: Stroke }[]) => void;
  clearStrokes: () => void;

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

  // Drawing tools
  currentColor: string;
  currentThickness: number;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;

  // Predict (shape detection)
  predictEnabled: boolean;
  setPredictEnabled: (enabled: boolean) => void;

  // Smooth (stroke smoothing)
  smoothEnabled: boolean;
  setSmoothEnabled: (enabled: boolean) => void;

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
    predictEnabled: false, // Default: unchecked
    smoothEnabled: true, // Default: checked
  };



  return {
    // Initial state
    mode: 'select',
    strokes: [],
    canvasWidth: 100,
    canvasHeight: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    currentColor: '#000000',
    currentThickness: 2,
    predictEnabled: false, // Default: unchecked
    smoothEnabled: true, // Default: checked
    selectedStrokeIds: [],
    history: [initialCanvasState],
    historyIndex: 0,

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
  };
});
