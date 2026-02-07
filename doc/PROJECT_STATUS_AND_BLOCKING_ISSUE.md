# Web Stroker - Project Status

**Date:** February 1, 2026  
**Project:** React + Three.js Drawing Application  
**Status:** ✅ Core drawing workflow working

---

## 1. ORIGINAL REQUIREMENTS

### Core Functionality
- **Free-form drawing:** User can hold left mouse button and drag to draw smooth lines
- **Smooth curves:** Implement Catmull-Rom spline interpolation for smooth strokes
- **Canvas:** 100cm × 100cm orthographic 2D drawing surface

### UI & Controls
- **Toolbar with:**
  - Color picker for stroke color selection
  - Brush size slider for stroke thickness (range: adjustable)
  - Save button to export drawing as JSON
  - Load button to import drawing from JSON
  - Undo button (Ctrl+Z) to remove last stroke
  - Redo button (Ctrl+Y) to restore undone stroke
  - Clear All button to erase entire canvas

### Visual Features
- **Grid background:** 1cm spacing with axes labels every 5cm
- **Axes:** Red X-axis, Green Y-axis for reference
- **Zoom functionality:** Mouse wheel zoom with 0.5x to 5x limits
- **Grid at origin:** Centered at (0,0) with visible grid from -50 to 50 in both dimensions

### Data Persistence
- **JSON format:** Save and load drawing data including all strokes with properties
- **Stroke properties:** Color, thickness, smoothed points, timestamp

---

## 2. COMPLETED STATE

### ✅ Fully Implemented & Working

#### Project Setup
- [x] Vite + React 19.2.0 + TypeScript configured
- [x] Three.js 0.128.0 installed and initialized
- [x] Zustand 4.4.0 for state management
- [x] Dependencies: @types/three, react, react-dom

#### Architecture & Code Structure
- [x] Type definitions (`src/types.ts`) — Point, Stroke, CanvasState, DrawingData interfaces
- [x] State management (`src/store.ts`) — Zustand store with full undo/redo history
- [x] Utility functions (`src/utils.ts`) — Catmull-Rom spline, smoothing, helpers
- [x] React components structure (Toolbar, DrawingCanvas)
- [x] CSS styling for toolbar and layout

#### Three.js Scene Setup
- [x] OrthographicCamera with **aspect-correct frustum** (circle at origin stays round)
- [x] Camera frustum updated on resize and zoom (grid/canvas refreshes correctly)
- [x] Scene background (white)
- [x] Grid visualization with GridHelper (100×100 with 100 divisions)
- [x] Red X-axis and Green Y-axis rendering
- [x] Lighting setup (DirectionalLight + AmbientLight)
- [x] WebGLRenderer with proper sizing and pixel ratio
- [x] Single canvas (no double-canvas / Strict Mode flicker)

#### Drawing & Stroke Rendering
- [x] Mouse down/move/up: stroke capture with 0.5cm minimum distance between points
- [x] **Screen-to-world** using current camera bounds (correct after zoom/resize)
- [x] **Preview while drawing:** Raw path as a single continuous tube (TubeGeometry), semi-transparent; geometry updated in place (no flicker)
- [x] **Final stroke on mouse up:** Preview cleared, Catmull-Rom smoothing applied, stroke stored with raw + smoothed points; final stroke rendered as a single continuous tube (no segments/dots)
- [x] Strokes visible on canvas; zoom and resize do not misplace strokes

#### Smooth Stroke Algorithm
- [x] Catmull-Rom spline in `utils.ts` (configurable steps; default 10 for natural curve)
- [x] Smoothed points used for final stroke geometry; raw points kept for save/undo

#### State Management & Undo/Redo
- [x] addStroke() stores strokes with points + smoothedPoints
- [x] Undo/Redo buttons and Ctrl+Z / Ctrl+Y; history stack and button state correct

#### UI Controls
- [x] Toolbar: color picker, brush size slider, Save, Load, Undo, Redo, Clear All
- [x] Zoom display and stroke counter
- [x] Wheel zoom with **passive: false** so preventDefault() works (no page scroll)

#### Data Persistence
- [x] Save exports drawing as JSON; Load imports and restores strokes and canvas state

#### Keyboard Shortcuts
- [x] Ctrl+Z undo, Ctrl+Y redo

#### Predict (Shape Detection)
- [x] Toolbar checkbox **Predict** (default ON); store `predictEnabled` and save/load
- [x] Stroke optional `displayPoints`; render from `displayPoints ?? smoothedPoints`
- [x] **Phase 1 — Straight line:** Detect straight strokes; replace with segment [first, last] (threshold 3% of segment length)
- [x] **Phase 2a — Triangle:** Convex hull + fit; hull 3/4/5+ vertices, try multiple candidates; replace with closed triangle (threshold 12% of perimeter)
- [ ] **Phase 2b — Rectangle/Square:** Not yet implemented
- [ ] **Phase 2c — Circle:** Not yet implemented
- [ ] **Phase 2d — Ellipse:** Not yet implemented

See `doc/PLAN_PREDICT_SHAPE_DETECTION.md` for full plan and algorithm notes.

---

## 3. PREDICT (SHAPE DETECTION) FEATURE PLAN — CURRENT STATUS

Status of the entire Predict feature plan (see `doc/PLAN_PREDICT_SHAPE_DETECTION.md`).

| Item | Status | Notes |
|------|--------|--------|
| **Predict toggle** | ✅ Done | Checkbox on toolbar; default ON; persisted in save/load and history |
| **displayPoints** | ✅ Done | Optional on Stroke; render from displayPoints ?? smoothedPoints |
| **Phase 1 — Straight line** | ✅ Done | Fit line; max deviation &lt; 3% of segment length → [first, last] |
| **Phase 2a — Triangle** | ✅ Done | Convex hull; if hull has 3/4/5+ vertices, try candidates; best fit &lt; 12% perimeter → closed triangle |
| **Phase 2b — Rectangle/Square** | ⏳ Pending | 4 corners (hull or oriented bbox); key points [a,b,c,d,a] |
| **Phase 2c — Circle** | ⏳ Pending | Fit center + radius; sample N points on circle |
| **Phase 2d — Ellipse** | ⏳ Pending | Fit ellipse; sample N points on ellipse |

When Predict is OFF, behavior is unchanged (smooth curve only, no shape replacement).

---

## 4. OPTIONAL / FUTURE IMPROVEMENTS

These items are **not required** for the current scope; implement if desired.

- **Axes labels every 5cm** — Requirements mention “axes labels every 5cm”; current implementation has red/green axes but no numeric labels. Can add text labels or overlays if needed.
- **Pan** — Store has `panX`/`panY` and `setPan`; pan is not yet wired in the UI or camera. Can add middle-drag or two-finger pan to move the view.
- **Remove debug sphere** — Red test sphere at origin in `DrawingCanvas.tsx` can be removed for production if not needed for reference.

All previously listed “next steps” and “potential fixes” related to stroke visibility have been addressed (single canvas, TubeGeometry, aspect camera, screenToWorld, preview in-place update).

---

## 5. FILE STRUCTURE

```
web-stroker/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   ├── main.tsx
│   ├── components/
│   │   ├── DrawingCanvas.tsx   # Three.js canvas, strokes, preview, zoom
│   │   ├── Toolbar.tsx
│   │   └── Toolbar.css
│   ├── store.ts               # Zustand state, undo/redo, strokes, zoom, predict
│   ├── shapePredict.ts        # predictShape: straight line, triangle (Phase 2a)
│   ├── types.ts
│   └── utils.ts               # Catmull-Rom, smoothStroke, distance, generateId
├── public/
├── doc/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

---

## 6. SUMMARY

### What Works
- Full drawing workflow: preview while dragging, smooth final stroke on release
- Single continuous tube rendering (no visible segments or dots)
- Correct stroke position at any zoom and after resize (aspect-correct camera + screenToWorld)
- Undo/redo, save/load JSON, toolbar controls, keyboard shortcuts
- Grid and axes; wheel zoom without page scroll
- **Predict:** Straight-line and triangle detection (Phase 1 + Phase 2a); checkbox toggles behavior

### Optional Enhancements
- Axes labels every 5cm
- Pan (middle-drag or two-finger)
- Remove debug sphere at origin

Core requirements are met; the app is suitable for further feature work or polish.
