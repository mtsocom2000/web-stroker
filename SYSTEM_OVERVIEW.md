# Web Stroker - System Overview

## Project Description
**Web Stroker** is a 2D geometry drawing, picking, intersecting, and measuring application built with React, TypeScript, Three.js, and Zustand. The application supports two distinct drawing modes with specialized features for artistic and digital workflows.

## Core Application Features

### Drawing Modes
1. **Artistic Mode** - Freehand drawing with stroke smoothing and shape prediction
   - Free drawing with mouse trail tracking
   - Stroke smoothing algorithms
   - Shape prediction for automatic geometric recognition
   - Natural drawing tools (pencil, pen, brush, ballpen, eraser)

2. **Digital Mode** - Precision geometric drawing and measurement
   - Line, circle, arc, and curve tools
   - Distance, angle, radius, and face area measurements
   - X-axis and Y-axis display with scale values and units
   - Grid-based snapping functionality

### Application-Level Features
- **File Management**: Save drawings to file and load from file (JSON format)
- **Undo/Redo**: Full history management with keyboard shortcuts (Ctrl+Z/Ctrl+Y)
- **Clear Canvas**: Complete drawing area reset
- **Unit System**: Support for multiple units (mm, cm, inch, px)

## Technology Stack
- **Frontend**: React 19 + TypeScript + Vite
- **3D Rendering**: Three.js with WebGL canvas
- **State Management**: Zustand with immer-like updates
- **Build Tool**: Vite with hot module replacement
- **Testing**: Vitest for unit testing

## Key Architectural Components

### State Management (`src/store.ts`)
- Centralized Zustand store with typed interfaces
- Separate state domains: strokes, canvas, tools, history
- Undo/redo stack with canvas state snapshots
- Unit system configuration (length and angle units)

### Data Structures (`src/types.ts`)
- **Point**: `{ x, y, timestamp? }` - 2D coordinate with optional timing
- **Stroke**: Main drawing entity with raw points, smoothed points, and optional display points
- **DigitalSegment**: Geometric segments for digital mode (line, arc, bezier)
- **CanvasState**: Complete canvas state for persistence

### Core Components
- **DrawingCanvas.tsx**: Three.js rendering canvas with drawing logic
- **Toolbar.tsx**: Mode selection and tool controls
- **PropertyPanel.tsx**: Tool properties and settings
- **DrawToolPanel.tsx**: Drawing mode-specific controls

### Specialized Modules
- **shapePredict.ts**: Stroke analysis and geometric shape recognition
- **strokeAnalysis.ts**: Stroke processing and feature extraction
- **strokeAnalyzer.ts**: Stroke characteristic point detection
- **measurements.ts**: Digital measurement calculations

## Drawing System

### Stroke Processing Pipeline
1. **Raw Input Capture**: Mouse position tracking with timestamps
2. **Smoothing**: Catmull-Rom spline interpolation for natural curves
3. **Shape Prediction**: Automatic detection of straight lines, triangles, circles
4. **Digital Segmentation**: Conversion to geometric primitives (digital mode)
5. **Rendering**: Three.js TubeGeometry for smooth stroke display

### Digital Mode Features
- **Precision Tools**: Line, circle, arc, and curve drawing
- **Measurement Tools**: Distance, angle, radius, face area
- **Grid System**: X/Y axes with unit-based scaling
- **Snap Functionality**: Precision point alignment

## File Format

### Saved Drawing Structure
```json
{
  "version": "1.0",
  "timestamp": 1741593345678,
  "canvasState": {
    "strokes": [...],
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

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm test` - Run test suite
- `npm run lint` - ESLint code quality check

## Documentation Structure
- **`SYSTEM_OVERVIEW.md`** (this file) - High-level project summary
- **`docs/ARCHITECTURE.md`** - Detailed technical architecture
- **`docs/features.md`** - Feature implementation status
- **`docs/algorithm/`** - Algorithm documentation
- **`doc/`** - Development planning and status

## Future Development Guidance
When modifying or adding features, consider:
1. **Mode Separation**: Artistic vs digital functionality differences
2. **State Management**: Follow existing Zustand patterns
3. **Three.js Resources**: Proper cleanup of geometries and materials
4. **Type Safety**: Maintain TypeScript strict mode compliance
5. **Testing**: Add Vitest tests for new functionality

This document serves as the primary reference for understanding the application's scope, architecture, and development patterns.