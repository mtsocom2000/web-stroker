import { create } from 'zustand';
import type { Stroke, CanvasState, ToolCategory, ArtisticTool, DigitalTool, MeasureTool, Point, LengthUnit, AngleUnit, SelectableElement, Constraint, ConstraintType, ConstraintTarget, ConstraintTool } from './types';
import type { BrushType, BrushSettings } from './brush/presets';
import type { FillRegion } from './fillRegion';
import { ConstraintManager } from './constraints/ConstraintManager';
import type { Shape3DData, Feature, Workplane } from './types3d';
import { FeatureTree } from './kernel/FeatureTree';

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
  
  // Digital Mode
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

  // Constraint Tool
  constraintTool: ConstraintTool | null;
  setConstraintTool: (tool: ConstraintTool | null) => void;

  // Digital Selection
  selectedDigitalStrokeIds: string[];
  setSelectedDigitalStrokeIds: (ids: string[]) => void;
  selectedDigitalElement: DigitalElement | null;
  setSelectedDigitalElement: (element: DigitalElement | null) => void;
  hoveredDigitalElement: DigitalElement | null;
  setHoveredDigitalElement: (element: DigitalElement | null) => void;
  hoveredDigitalStrokeId: string | null;
  setHoveredDigitalStrokeId: (id: string | null) => void;
  
  // Selection
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
  
  // Constraint creation state
  isCreatingConstraint: boolean;
  constraintType: ConstraintType | null;
  constraintPendingTargets: ConstraintTarget[];
  setIsCreatingConstraint: (isCreating: boolean) => void;
  setConstraintType: (type: ConstraintType | null) => void;
  addConstraintTarget: (target: ConstraintTarget) => void;
  clearConstraintTargets: () => void;

  // Strokes
  strokes: Stroke[];
  addStroke: (stroke: Stroke) => void;
  addStrokesBatch: (strokes: Stroke[]) => void;
  removeStroke: (id: string) => void;
  updateStroke: (id: string, stroke: Stroke, skipHistory?: boolean) => void;
  updateStrokes: (strokes: { id: string; stroke: Stroke }[]) => void;
  updateStrokePoints: (id: string, points: Point[]) => void;
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

  // Drawing tools
  currentColor: string;
  currentThickness: number;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;

  // Stroke mode
  strokeMode: StrokeMode;
  setStrokeMode: (mode: StrokeMode) => void;

  // Snap
  snapEnabled: boolean;
  snapThreshold: number;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapThreshold: (threshold: number) => void;

  // Brush System
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

  // Animation Replay
  isAnimationReplay: boolean;
  setAnimationReplay: (enabled: boolean) => void;

  // Undo Predict
  lastStrokeOriginalData: { id: string; originalPoints: Point[]; simplifiedPoints?: Point[]; displayPoints?: Point[] } | null;
  setLastStrokeOriginalData: (data: { id: string; originalPoints: Point[]; simplifiedPoints?: Point[]; displayPoints?: Point[] } | null) => void;
  undoLastPredict: () => boolean;

  // Renderer Configuration
  renderer: 'canvas2d' | 'threejs';
  setRenderer: (renderer: 'canvas2d' | 'threejs') => void;

  // ============================================================================
  // 3D Shapes (新增)
  // ============================================================================
  shapes3D: Shape3DData[];
  addShape3D: (shape: Shape3DData) => void;
  removeShape3D: (id: string) => void;
  updateShape3D: (id: string, updates: Partial<Shape3DData>) => void;
  getShape3D: (id: string) => Shape3DData | undefined;

  // Workplanes
  workplanes: Workplane[];
  addWorkplane: (workplane: Workplane) => void;
  removeWorkplane: (id: string) => void;

  // Feature Tree
  featureTree: FeatureTree;
  setFeatureTree: (tree: FeatureTree) => void;
}

export const useDrawingStore = create<DrawingState>((set, get) => {
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
    setSelectMode: (mode) => set({ selectMode: mode }),
    setLastMeasureValue: (value) => set({ lastMeasureValue: value }),
    clearMeasure: () => set((state) => ({
      measureTool: state.measureTool,
      measureStartPoint: null,
      measureEndPoint: null,
      measureFirstLine: null,
      measureSecondLine: null,
      measureFaceId: null,
      lastMeasureValue: '--'
    })),
    clearCurrentMeasurement: () => set({ 
      measureStartPoint: null, 
      measureEndPoint: null, 
      measureFirstLine: null, 
      measureSecondLine: null, 
      measureFaceId: null, 
      lastMeasureValue: '--' 
    }),
    drawingClearCounter: 0,
    incrementClearCounter: () => set((state) => ({ drawingClearCounter: state.drawingClearCounter + 1 })),
    
    // Constraint Tool
    constraintTool: null,
    setConstraintTool: (tool) => set({ constraintTool: tool }),

    // Digital Selection
    selectedDigitalStrokeIds: [],
    setSelectedDigitalStrokeIds: (ids) => set({ selectedDigitalStrokeIds: ids }),
    selectedDigitalElement: null,
    setSelectedDigitalElement: (element) => set({ selectedDigitalElement: element }),
    hoveredDigitalElement: null,
    setHoveredDigitalElement: (element) => set({ hoveredDigitalElement: element }),
    hoveredDigitalStrokeId: null,
    setHoveredDigitalStrokeId: (id) => set({ hoveredDigitalStrokeId: id }),
    
    // Selection
    selectedElements: [],
    setSelectedElements: (elements) => set({ selectedElements: elements }),
    activeTool: 'select',
    setActiveTool: (tool) => set({ activeTool: tool }),

    // Constraints
    constraints: [],
    constraintManager: new ConstraintManager(),
    addConstraint: (constraint) => set((state) => ({ constraints: [...state.constraints, constraint] })),
    removeConstraint: (id) => set((state) => ({ 
      constraints: state.constraints.filter(c => c.id !== id) 
    })),
    updateConstraint: (id, value) => set((state) => ({
      constraints: state.constraints.map(c => c.id === id ? { ...c, value } : c)
    })),
    getConstraintsForPoint: (strokeId, pointIndex) => {
      return get().constraints.filter(c => 
        c.targets.some(t => t.strokeId === strokeId && t.pointIndex === pointIndex)
      );
    },
    
    isCreatingConstraint: false,
    constraintType: null,
    constraintPendingTargets: [],
    setIsCreatingConstraint: (isCreating) => set({ isCreatingConstraint: isCreating }),
    setConstraintType: (type) => set({ constraintType: type }),
    addConstraintTarget: (target) => set((state) => ({ 
      constraintPendingTargets: [...state.constraintPendingTargets, target] 
    })),
    clearConstraintTargets: () => set({ constraintPendingTargets: [] }),

    // Strokes
    strokes: [],
    addStroke: (stroke) => set((state) => ({ strokes: [...state.strokes, stroke] })),
    addStrokesBatch: (strokes) => set((state) => ({ strokes: [...state.strokes, ...strokes] })),
    removeStroke: (id) => set((state) => ({ strokes: state.strokes.filter(s => s.id !== id) })),
    updateStroke: (id, stroke) => set((state) => ({
      strokes: state.strokes.map(s => s.id === id ? stroke : s)
    })),
    updateStrokes: (updates) => set((state) => ({
      strokes: state.strokes.map(s => {
        const update = updates.find(u => u.id === s.id);
        return update ? update.stroke : s;
      })
    })),
    updateStrokePoints: (id, points) => set((state) => ({
      strokes: state.strokes.map(s => s.id === id ? { ...s, points } : s)
    })),
    clearStrokes: () => set({ strokes: [] }),

    // Fill Regions
    fillRegions: [],
    setFillRegions: (regions) => set({ fillRegions: regions }),
    selectedFillRegionId: null,
    setSelectedFillRegionId: (id) => set({ selectedFillRegionId: id }),

    // Selection
    selectedStrokeIds: [],
    setSelectedStrokeIds: (ids) => set({ selectedStrokeIds: ids }),
    addToSelection: (id) => set((state) => ({ 
      selectedStrokeIds: [...state.selectedStrokeIds, id] 
    })),
    removeFromSelection: (id) => set((state) => ({ 
      selectedStrokeIds: state.selectedStrokeIds.filter(sid => sid !== id) 
    })),
    toggleSelection: (id) => set((state) => ({
      selectedStrokeIds: state.selectedStrokeIds.includes(id)
        ? state.selectedStrokeIds.filter(sid => sid !== id)
        : [...state.selectedStrokeIds, id]
    })),
    clearSelection: () => set({ selectedStrokeIds: [] }),

    // Canvas settings
    canvasWidth: 100,
    canvasHeight: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    setZoom: (zoom) => set({ zoom }),
    setPan: (panX, panY) => set({ panX, panY }),

    // Drawing tools
    currentColor: '#000000',
    currentThickness: 2,
    setColor: (color) => set({ currentColor: color }),
    setThickness: (thickness) => set({ currentThickness: thickness }),

    // Stroke mode
    strokeMode: 'smooth',
    setStrokeMode: (mode) => set({ strokeMode: mode }),

    // Snap
    snapEnabled: true,
    snapThreshold: 10,
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    setSnapThreshold: (threshold) => set({ snapThreshold: threshold }),

    // Brush System
    currentBrushType: 'pencil',
    currentBrushSettings: defaultBrushSettings,
    setBrushType: (type) => set({ currentBrushType: type }),
    setBrushSize: (size) => set((state) => ({
      currentBrushSettings: { ...state.currentBrushSettings, size }
    })),
    setBrushOpacity: (opacity) => set((state) => ({
      currentBrushSettings: { ...state.currentBrushSettings, opacity }
    })),
    setBrushHardness: (hardness) => set((state) => ({
      currentBrushSettings: { ...state.currentBrushSettings, hardness }
    })),

    // Undo/Redo
    history: [],
    historyIndex: -1,
    pushHistory: (state) => set((current) => ({
      history: [...current.history.slice(0, current.historyIndex + 1), state],
      historyIndex: current.historyIndex + 1
    })),
    undo: () => set((current) => {
      if (current.historyIndex < 0) return current;
      return { ...current.history[current.historyIndex], historyIndex: current.historyIndex };
    }),
    redo: () => set((current) => {
      if (current.historyIndex >= current.history.length - 1) return current;
      return { ...current.history[current.historyIndex + 1], historyIndex: current.historyIndex + 1 };
    }),

    // Animation Replay
    isAnimationReplay: false,
    setAnimationReplay: (enabled) => set({ isAnimationReplay: enabled }),

    // Undo Predict
    lastStrokeOriginalData: null,
    setLastStrokeOriginalData: (data) => set({ lastStrokeOriginalData: data }),
    undoLastPredict: () => {
      const state = get();
      if (!state.lastStrokeOriginalData) return false;
      // TODO: 实现恢复逻辑
      return true;
    },

    // Renderer
    renderer: 'canvas2d',
    setRenderer: (renderer) => set({ renderer }),

    // 3D Shapes
    shapes3D: [],
    addShape3D: (shape) => set((state) => ({ shapes3D: [...state.shapes3D, shape] })),
    removeShape3D: (id) => set((state) => ({ shapes3D: state.shapes3D.filter(s => s.id !== id) })),
    updateShape3D: (id, updates) => set((state) => ({
      shapes3D: state.shapes3D.map(s => s.id === id ? { ...s, ...updates } : s)
    })),
    getShape3D: (id) => get().shapes3D.find(s => s.id === id),

    // Workplanes
    workplanes: [],
    addWorkplane: (workplane) => set((state) => ({ workplanes: [...state.workplanes, workplane] })),
    removeWorkplane: (id) => set((state) => ({ workplanes: state.workplanes.filter(w => w.id !== id) })),

    // Feature Tree
    featureTree: new FeatureTree(),
    setFeatureTree: (tree) => set({ featureTree: tree })
  };
});
