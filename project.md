# Web Stroker - Project Overview

**Type**: 2D Geometry Drawing Application  
**Tech Stack**: React 19 + TypeScript + Vite + Three.js + Zustand  
**Architecture**: Command-based rendering with hooks-driven interaction

## Core Features

### Artistic Mode
- Freehand drawing with stroke smoothing
- Shape prediction (line, circle, rectangle, triangle, etc.)
- Brush types: pencil, pen, brush, ballpen, eraser

### Digital Mode
- Precision geometric drawing: line, circle, arc, curve
- Measurement tools: distance, angle, radius, face area
- Grid snapping and endpoint snapping

### File Management
- Save/load drawings (JSON format)
- Undo/redo history

## Current Architecture (Post Phase 4&5 Refactoring)

```
src/
├── components/
│   └── DrawingCanvas.tsx (339 lines) - Event routing + 2D UI
├── hooks/
│   ├── useSnapSystem.ts - Coordinate transforms + snap detection
│   ├── useSelectTool.ts - Element selection/dragging
│   ├── useMeasureTools.ts - Measurement tools
│   ├── useArtisticDrawing.ts - Freehand drawing
│   └── useDigitalDrawing.ts - Precision geometric drawing
├── core/
│   ├── renderers/ - Canvas2D + WebGL renderers
│   ├── commands/ - RenderCommand system
│   ├── managers/ - DrawingStateManager, DrawingCommander
│   └── store.ts - Zustand state management
└── utils/ - Helper functions
```

## Documentation
- `docs/ARCHITECTURE_CURRENT.md` - Current architecture reference
- `docs/REFACTORING_PLAN.md` - Refactoring history (Phase 1-5 complete)
- `docs/OPENSPEC_SETUP.md` - OpenSpec setup guide

## Active Development

### Current Change: Constraints Feature

**Status**: Design phase complete, ready for implementation

**Summary**: Add parametric constraints to digital mode, allowing users to:
- Set exact distance between two points
- Set exact angle between two lines
- Set exact radius for circles/arcs
- Visual feedback for constrained elements (blue endpoints)
- Hard constraints (cannot violate during drag)

**Spec Location**: `openspec/changes/constraints-feature/specs/`

## OpenSpec Workflow

```bash
# Create new change
openspec change <name>

# Verify implementation
openspec verify <name>

# Archive when complete
openspec archive <name>
```

---

**Last Updated**: 2026-03-29  
**Team**: Development Team
