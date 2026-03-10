# Web Stroker - Architecture Documentation

## Table of Contents
1. [Application Architecture Overview](#application-architecture-overview)
2. [State Management System](#state-management-system)
3. [Drawing Modes](#drawing-modes)
4. [Data Flow](#data-flow)
5. [Three.js Rendering Pipeline](#threejs-rendering-pipeline)
6. [File Format Specification](#file-format-specification)
7. [Development Patterns](#development-patterns)

## Application Architecture Overview

### Tech Stack
- **Frontend Framework**: React 19 with TypeScript
- **Build System**: Vite with React plugin
- **3D Rendering**: Three.js (WebGL)
- **State Management**: Zustand
- **Styling**: CSS modules
- **Testing**: Vitest

### Directory Structure
```
web-stroker/
├── src/
│   ├── components/          # React components
│   │   ├── DrawingCanvas.tsx    # Main canvas component
│   │   ├── Toolbar.tsx          # Tool selection interface
│   │   ├── PropertyPanel.tsx    # Tool properties panel
│   │   └── DrawToolPanel.tsx    # Drawing mode controls
│   ├── store.ts            # Zustand state management
│   ├── types.ts            # TypeScript type definitions
│   ├── utils.ts            # Utility functions
│   ├── shapePredict.ts     # Shape recognition algorithms
│   ├── shapeRecognition/   # Advanced shape detection
│   ├── brush/             # Brush rendering system
│   ├── fillRegion/        # Fill region functionality
│   ├── intersection/      # Geometry intersection calculations
│   ├── measurements.ts    # Measurement tools
│   ├── strokeAnalysis.ts  # Stroke analysis utilities
│   ├── strokeAnalyzer.ts  # Stroke characteristic detection
│   └── __tests__/        # Test files
├── docs/                  # Documentation
├── doc/                  # Development documentation
└── public/              # Static assets
```

## State Management System

### Store Structure (`src/store.ts`)
The Zustand store is organized into logical domains:

#### 1. Tool Category Management
```typescript
toolCategory: ToolCategory // 'artistic' | 'digital' | 'measure'
artisticTool: ArtisticTool // 'pencil' | 'pen' | 'brush' | 'ballpen' | 'eraser'
digitalTool: DigitalTool   // 'line' | 'circle' | 'arc' | 'curve'
measureTool: MeasureTool | null // 'distance' | 'angle' | 'radius' | 'face'
```

#### 2. Unit System Configuration
```typescript
unit: LengthUnit          // 'mm' | 'cm' | 'inch' | 'px'
angleUnit: AngleUnit      // 'degree' | 'radian'
pixelsPerUnit: number     // Conversion factor
DEFAULT_PIXELS_PER_UNIT: Record<LengthUnit, number>
```

#### 3. Drawing State
```typescript
strokes: Stroke[]         // All drawn strokes
fillRegions: FillRegion[] // Fill region data
canvasWidth: number       // Canvas dimensions
canvasHeight: number
zoom: number              // Camera zoom level (0.5-5.0)
panX: number             // Camera pan position
panY: number
```

#### 4. Digital Mode State
```typescript
digitalMode: 'select' | 'draw'          // Digital mode state
circleCreationMode: 'centerRadius' | 'threePoint' // Circle creation method
selectedDigitalStrokeIds: string[]    // Selected digital strokes
selectedDigitalElement: DigitalElement | null // Selected element
```

#### 5. Measurement State
```typescript
measureStartPoint: Point | null        // Measurement start
measureEndPoint: Point | null          // Measurement end
measureFirstLine: { strokeId: string; segmentIndex: number } | null
measureSecondLine: { strokeId: string; segmentIndex: number } | null
measureFaceId: string | null           // Face measurement ID
lastMeasureValue: string               // Last measurement result
```

#### 6. History Management
```typescript
history: CanvasState[]    // Undo/redo stack
historyIndex: number      // Current position in history
```

### State Update Patterns
- **Immutable updates**: Always return new state objects
- **Batch operations**: Use `addStrokesBatch` for multiple strokes
- **History integration**: Each state change updates history stack
- **Selective updates**: Only update relevant parts of state

## Drawing Modes

### Artistic Mode
**Purpose**: Freehand drawing with natural tools and automatic shape recognition

#### Features
- **Stroke Smoothing**: Catmull-Rom spline interpolation
- **Shape Prediction**: Automatic detection of geometric shapes
- **Brush Types**: Pencil, pen, brush, ballpen
- **Eraser Tool**: Stroke removal tool

#### Shape Detection Pipeline
```
Raw Points → Smoothing → Characteristic Points Detection → Shape Classification
      ↓           ↓               ↓                    ↓
   Capture    Catmull-Rom     Corner Detection     Line/Triangle/Circle/Ellipse
```

#### Configuration Options
- **Smooth Enabled**: Apply curve smoothing (default: true)
- **Predict Enabled**: Automatic shape recognition (default: false)
- **Snap Enabled**: Snap to grid points (digital mode only)

### Digital Mode
**Purpose**: Precision geometric drawing and measurement

#### Drawing Tools
1. **Line Tool**: Straight line segments with endpoints
2. **Circle Tool**: 
   - Center-radius mode: Click center, drag radius
   - Three-point mode: Click three points on circumference
3. **Arc Tool**: Circular arc segments with center, radius, start/end angles
4. **Curve Tool**: Bezier curves with control points

#### Measurement Tools
1. **Distance**: Measure between two points or along a line
2. **Angle**: Measure angle between two lines
3. **Radius**: Measure radius of circles/arcs
4. **Face Area**: Calculate area of closed shapes

#### Digital Element Structure
```typescript
interface DigitalElement {
  strokeId: string;
  segmentId: string;
  pointIndex: number;
  point: Point;
  type: 'endpoint' | 'control' | 'cross';
}
```

### Mode Switching
- **Tool Category Selection**: Switch between artistic/digital/measure modes
- **Mode Persistence**: Current mode saved in canvas state
- **Keyboard Shortcuts**: 'v' (select), 'd' (draw), 'm' (measure)

## Data Flow

### Stroke Creation Flow
```
Mouse Events → Point Capture → Stroke Analysis → Shape Prediction → Rendering
    ↓             ↓               ↓                 ↓               ↓
 MouseDown     Raw Points    Characteristic     Geometric      Three.js
 MouseMove                  Points Detection    Replacement    Geometry
 MouseUp                                      (if predict on)
```

### Rendering Pipeline
```
1. Event Handling → 2. State Update → 3. Three.js Update → 4. Frame Render
      ↓                  ↓                ↓                 ↓
 Mouse/Wheel        Store Update      Scene Update       requestAnimationFrame
 Keyboard
```

### Digital Measurement Flow
```
1. Tool Selection → 2. Point Selection → 3. Calculation → 4. Display
        ↓               ↓                  ↓              ↓
  Measure Tool     Click Points        Geometry Math   Value Display
```

## Three.js Rendering Pipeline

### Scene Setup
```typescript
// Camera Configuration
const camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
camera.position.z = 10;

// Scene Organization
const scene = new THREE.Scene();
scene.add(gridHelper);      // Grid at z = -1
scene.add(axisHelper);      // Axes at z = -0.5
scene.add(strokeLines);     // Strokes at z = 0.1
scene.add(previewLine);     // Preview at z = 0.05
```

### Stroke Rendering
- **Preview Strokes**: TubeGeometry with z = 0.05, opacity = 0.6
- **Final Strokes**: TubeGeometry with z = 0.1, opacity = 1.0
- **Tube Geometry**: Consistent line thickness across zoom levels
- **Material Recycling**: Reuse materials for performance

### Coordinate Systems
1. **Screen Coordinates**: Mouse position in pixels
2. **World Coordinates**: Converted via `screenToWorld()` function
3. **Normalized Coordinates**: For Three.js rendering

### Camera Management
- **Aspect Ratio Correction**: Maintains consistent scaling
- **Zoom Bounds**: Limited to 0.5x to 5.0x
- **Pan Support**: Camera position adjustment
- **Resize Handling**: Window resize event listeners

## File Format Specification

### Drawing Data Structure
```json
{
  "version": "1.0",
  "timestamp": 1741593345678,
  "canvasState": {
    "strokes": [
      {
        "id": "stroke-123",
        "points": [{"x": 10, "y": 20}, ...],
        "smoothedPoints": [{"x": 10, "y": 20}, ...],
        "displayPoints": [{"x": 10, "y": 20}, ...],
        "color": "#000000",
        "thickness": 2,
        "timestamp": 1741593345678,
        "strokeType": "artistic",
        "digitalSegments": [...],
        "isClosed": false,
        "brushType": "pencil",
        "brushSettings": {...},
        "cornerPoints": [...],
        "cornerIndices": [...],
        "segments": [...]
      }
    ],
    "canvasWidth": 100,
    "canvasHeight": 100,
    "zoom": 1,
    "panX": 0,
    "panY": 0,
    "predictEnabled": false,
    "smoothEnabled": true
  }
}
```

### Stroke Properties
| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique stroke identifier |
| `points` | Point[] | Raw captured points |
| `smoothedPoints` | Point[] | Catmull-Rom smoothed points |
| `displayPoints` | Point[] | Shape-predicted points (optional) |
| `color` | string | Stroke color in hex format |
| `thickness` | number | Stroke thickness in pixels |
| `timestamp` | number | Creation timestamp |
| `strokeType` | string | 'artistic' or 'digital' |
| `digitalSegments` | DigitalSegment[] | Geometric segments (digital mode) |
| `isClosed` | boolean | Whether stroke forms closed shape |
| `brushType` | string | Brush type for artistic strokes |
| `brushSettings` | object | Brush configuration |
| `cornerPoints` | Point[] | Detected characteristic points |
| `cornerIndices` | number[] | Indices of corner points |
| `segments` | StrokeSegment[] | Analyzed stroke segments |

### Digital Segment Structure
```typescript
interface DigitalSegment {
  id: string;
  type: 'line' | 'arc' | 'bezier';
  points: Point[];
  arcData?: {
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
  color: string;
  originalId?: string;
  isClosed?: boolean;
}
```

## Development Patterns

### Component Architecture
- **Functional Components**: Use React.FC with TypeScript interfaces
- **Destructured Props**: Extract props at component top
- **useRef for Three.js**: Store Three.js objects in refs
- **useEffect Cleanup**: Proper cleanup in useEffect returns

### State Management Patterns
```typescript
// Zustand Store Pattern
const useDrawingStore = create<DrawingState>()((set, get) => ({
  // State properties
  strokes: [],
  
  // Actions with immer-like updates
  addStroke: (stroke) =>
    set((state) => ({
      strokes: [...state.strokes, stroke],
      history: updateHistory(state)
    })),
    
  // Selectors for computed values
  getSelectedStrokes: () => get().strokes.filter(s => ...)
}));
```

### Three.js Best Practices
1. **Resource Cleanup**: Always dispose geometries and materials
2. **Single Render Loop**: Use one requestAnimationFrame per component
3. **Coordinate Conversion**: Use `screenToWorld()` helper consistently
4. **Z-Depth Layering**: Maintain consistent depth ordering
5. **Geometry Updates**: Update in-place to avoid flicker

### Error Handling
- **Graceful Degradation**: Handle Three.js context loss
- **Null Checks**: Verify scene/renderer before operations
- **Bounds Checking**: Validate zoom levels and coordinates
- **Input Validation**: Sanitize canvas coordinates

### Performance Guidelines
- **Geometry Pooling**: Reuse Three.js geometries where possible
- **Render Optimization**: Update only changed stroke geometries
- **Memory Management**: Dispose unused Three.js resources
- **Event Listener Cleanup**: Remove listeners in useEffect returns

### Testing Strategy
- **Unit Tests**: Test shape prediction algorithms
- **Integration Tests**: Test drawing workflow
- **Visual Tests**: Test rendering consistency
- **Performance Tests**: Monitor memory usage and frame rate

## Extension Points

### Adding New Tools
1. Add tool type to `ToolCategory` or `ArtisticTool`/`DigitalTool` enums
2. Update store with tool-specific state
3. Create tool implementation in relevant module
4. Add UI controls to appropriate panel
5. Update keyboard shortcuts if needed

### Adding New Measurements
1. Add measurement type to `MeasureTool` enum
2. Implement calculation in `measurements.ts`
3. Add measurement state to store
4. Create UI for measurement selection and display
5. Add to digital mode toolset

### Adding New Brush Types
1. Define brush type in `brush/presets.ts`
2. Add brush settings interface
3. Implement rendering in brush module
4. Update artistic tools UI
5. Add to stroke data structure

This architecture documentation should be referenced when implementing new features or modifying existing functionality.