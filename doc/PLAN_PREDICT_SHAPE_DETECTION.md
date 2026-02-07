# Plan: Predict (Shape Detection) Feature

**Goal:** Add a toolbar checkbox **"Predict"** (default ON). When ON, detect whether the user’s stroke is a straight line or a primitive shape (circle, ellipse, square, rectangle, triangle) and replace the stroke with a clean version (straight line or polygon through key points). When OFF, keep current behavior (smooth curve only).

---

## 1. State & UI

### 1.1 Store (`src/store.ts`)

- Add to state:
  - `predictEnabled: boolean` — default `true`
  - `setPredictEnabled: (enabled: boolean) => void`
- Optional for save/load: add `predictEnabled` to `CanvasState` and `DrawingData` so loaded files restore the checkbox state. If omitted, Predict defaults to ON after load.

### 1.2 Types (`src/types.ts`)

- On `Stroke`, add optional:
  - `displayPoints?: Point[]`
- Semantics:
  - If `displayPoints` is set, render the stroke using `displayPoints` (predicted shape).
  - If not set, render using `smoothedPoints` (current behavior).
- Save/load: persist `displayPoints` so the drawing looks the same when reopened.

### 1.3 Toolbar (`src/components/Toolbar.tsx`)

- Add a checkbox (and label) **"Predict"**:
  - Bound to `store.predictEnabled` and `store.setPredictEnabled`.
  - Place near other drawing options (e.g. after Brush Size, before Save/Load or before Undo/Redo).
- Tooltip/title: e.g. "Simplify strokes to straight lines and shapes when possible".

### 1.4 Persistence

- **Save:** Include `predictEnabled` in `canvasState` if you added it to `CanvasState`; include `displayPoints` on each stroke (already part of `Stroke`).
- **Load:** Restore `predictEnabled` and strokes with their `displayPoints`; render using `displayPoints ?? smoothedPoints` per stroke.

---

## 2. Pipeline: When to Apply Prediction

### 2.1 Where It Runs

- In **DrawingCanvas** `handleMouseUp`, after you have `rawPoints` and `smoothedPoints`:
  1. If **Predict is OFF:** set `displayPoints` to `undefined` (or omit it). Stroke renders as today (using `smoothedPoints`).
  2. If **Predict is ON:** call a new function, e.g. `predictShape(smoothedPoints): Point[] | null`. If it returns an array, set `stroke.displayPoints = that array`; otherwise leave `displayPoints` unset and keep `smoothedPoints`.

### 2.2 Rendering

- Where you currently build geometry from `stroke.smoothedPoints` (preview and final stroke), use **display points** when present:
  - `const pointsToRender = stroke.displayPoints ?? stroke.smoothedPoints;`
- Same tube/geometry logic; only the source array changes.

---

## 3. Phase 1: Straight-Line Detection

### 3.1 Module

- Add **`src/shapePredict.ts`** (or `src/utils/shapePredict.ts`) for all prediction logic.

### 3.2 Algorithm (Straight Line)

- Input: `points: Point[]` (e.g. `smoothedPoints`).
- Steps:
  1. If `points.length < 2` → return `null` (no prediction).
  2. Fit a line to the points (e.g. least-squares linear regression of y on x, or PCA and use the first principal direction).
  3. Measure deviation of each point from the line (e.g. perpendicular distance).
  4. Use a single threshold, e.g.:
     - Max deviation < ε, or
     - Mean squared deviation < ε², or
     - Max deviation < fraction of the segment length (e.g. 3% of distance from first to last point).
  5. If deviation is below threshold → return `[points[0], points[points.length - 1]]` (straight segment from start to end). Otherwise return `null`.

### 3.3 Tuning

- Expose a constant (e.g. `STRAIGHT_LINE_MAX_DEVIATION_RATIO = 0.03`) so you can tune sensitivity: smaller value = only very straight strokes become a line; larger = more strokes become lines.

### 3.4 Integration

- In `handleMouseUp`, when Predict is ON, call e.g. `predictShape(smoothedPoints)`.
- Phase 1 implementation of `predictShape`: only straight-line check; if it passes, return the two endpoints; else return `null` (keep smoothed curve).

---

## 4. Phase 2: Shape Detection (Circle, Ellipse, Square, Rectangle, Triangle)

### 4.1 Order of Checks

- Suggested order (simplest first, then more specific):
  1. **Straight line** (already in Phase 1).
  2. **Triangle** (3 corners).
  3. **Square / Rectangle** (4 corners).
  4. **Circle** (center + radius).
  5. **Ellipse** (center + axes + rotation).

- For each shape: fit the shape, compute a fitting error; if error is below a threshold, compute **key points** and return them; otherwise try the next shape. If none match, return `null` (keep `smoothedPoints`).

### 4.2 Triangle

- **Detect:** Convex hull of points; if hull has 3 vertices (or 3 dominant corners from a corner detector), treat as triangle.
- **Key points:** The 3 vertices (optionally close the path: 4 points with first repeated).
- **Fit:** e.g. fit line to each side; use intersections as corners; compute distance error from stroke to the three segments.

### 4.3 Square / Rectangle

- **Detect:** Convex hull with 4 vertices, or fit a minimum-area oriented bounding rectangle (rotating calipers or PCA-based box). Check aspect ratio to distinguish square (≈1) vs rectangle.
- **Key points:** 4 corners (and optionally close: 5 points).
- **Fit:** Same idea: 4 segments, compute point-to-segment distance error.

### 4.4 Circle

- **Detect:** Fit circle (e.g. least-squares: center and radius). Measure error (e.g. radial distance variance or max deviation from circle).
- **Key points:** Sample N points on the circle (e.g. 32 or 64) so the tube still looks round when rendered. Alternatively use an arc/curve if you support it; for consistency with current tube, sampled points are fine.

### 4.5 Ellipse

- **Detect:** Fit ellipse (e.g. least-squares ellipse or RANSAC). Check deviation.
- **Key points:** Sample N points on the ellipse (same idea as circle).

### 4.6 Module Layout (Phase 2)

- In `shapePredict.ts`:
  - `predictShape(points: Point[]): Point[] | null` — runs straight line, then triangle, square/rect, circle, ellipse; returns first match or `null`.
  - Helpers: `fitStraightLine`, `fitTriangle`, `fitRectangle`, `fitSquare`, `fitCircle`, `fitEllipse`, each returning key points and optionally error.
- Use tunable thresholds per shape (e.g. max deviation as fraction of bounding box size) so behavior is consistent and adjustable.

### 4.7 Rendering

- No change: you already render from `displayPoints ?? smoothedPoints` as a single tube. For circle/ellipse, `displayPoints` will be many sampled points; for triangle/rect/square, 3 or 4 (or 5 closed) points; for straight line, 2 points.

---

## 5. Implementation Checklist

### Phase 1 (Straight line + Predict toggle)

- [ ] **Store:** Add `predictEnabled`, `setPredictEnabled`; optionally add to `CanvasState` / save-load.
- [ ] **Types:** Add `displayPoints?: Point[]` to `Stroke`.
- [ ] **Toolbar:** Add checkbox "Predict" (default checked), bound to store.
- [ ] **DrawingCanvas:** In `handleMouseUp`, if Predict ON call `predictShape(smoothedPoints)`; if result non-null set `stroke.displayPoints = result`; otherwise leave unset.
- [ ] **Rendering:** Use `stroke.displayPoints ?? stroke.smoothedPoints` everywhere a stroke is drawn (preview is unchanged; only final stroke uses this).
- [ ] **shapePredict.ts:** Implement straight-line detection only; `predictShape` returns `[first, last]` or `null`.
- [ ] **Save/Load:** Persist and restore `displayPoints` (and `predictEnabled` if in state).

### Phase 2 (Shapes)

- [ ] **Triangle:** Detect 3 corners; return 3 (or 4) key points; integrate into `predictShape` after straight line.
- [ ] **Rectangle / Square:** Detect 4 corners; return 4 (or 5) key points; integrate after triangle.
- [ ] **Circle:** Fit circle; sample N points on circle; integrate after rect.
- [ ] **Ellipse:** Fit ellipse; sample N points; integrate after circle.
- [ ] Tune thresholds so strokes that are clearly a shape get simplified, and messy strokes stay as smooth curves.

---

## 6. Summary

| Item | Action |
|------|--------|
| **Predict OFF** | No shape detection; stroke uses `smoothedPoints` only (current behavior). |
| **Predict ON** | Run `predictShape(smoothedPoints)`. If result exists, set `stroke.displayPoints = result`; render from `displayPoints`. |
| **Phase 1** | Checkbox + straight-line detection; render straight strokes as a segment between first and last point. |
| **Phase 2** | Add triangle → rectangle/square → circle → ellipse; each returns key points; render same tube pipeline from those points. |

This keeps the existing drawing and rendering pipeline; only the source of the point array (smoothed vs predicted) changes based on the Predict checkbox and detection results.
