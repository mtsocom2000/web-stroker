# Fill Region System Documentation

## Overview

The fill region system detects closed areas formed by strokes and allows users to fill them with patterns and move them interactively.

---

## Architecture

```
User draws strokes
    │
    ▼
Stroke completes → predictShape() detects closed shape
    │
    ▼
If closed shape detected → createFillFromShape()
    │
    ▼
Multiple strokes → buildPlanarGraph() → extractFaces()
    │
    ▼
FillRegionManager manages all regions
    │
    ▼
Render fill regions → Hit test → Drag & Move
```

---

## File Structure

```
src/fillRegion/
├── types.ts           # Core data structures
├── planarGraph.ts     # Build graph from strokes
├── faceExtraction.ts  # Face walking algorithm
├── hitTest.ts         # Point in polygon testing
├── pattern.ts         # Pattern rendering (hatch, grid, dots)
├── renderer.ts        # Canvas rendering
└── index.ts          # FillRegionManager class
```

---

## Core Data Structures

### Vertex
```typescript
interface Vertex {
  id: string;
  position: Point;
  incidentEdges: Edge[];
}
```

### Edge
```typescript
interface Edge {
  id: string;
  v1: Vertex;
  v2: Vertex;
  strokeId: string;
  visitedLeft: boolean;
  visitedRight: boolean;
}
```

### Face
```typescript
interface Face {
  id: string;
  vertices: Vertex[];
  area: number;
  centroid: Point;
}
```

### FillRegion
```typescript
interface FillRegion {
  id: string;
  polygon: Point[];
  fillStyle: FillStyle;
  bounds: { min: Point; max: Point };
  transform: { x: number; y: number };
}
```

### FillStyle
```typescript
type PatternType = 'hatch' | 'grid' | 'dots' | 'crosshatch';

interface FillStyle {
  type: PatternType;
  color: string;
  backgroundColor: string;
  spacing: number;
  angle: number;
}
```

---

## Detection Methods

### 1. Single Stroke (Shape Prediction)

When a stroke completes with shape prediction enabled:
1. `predictShape()` returns simplified points
2. `isClosedShape()` checks if start-end distance < threshold
3. If closed, `createFillFromShape()` creates a FillRegion

### 2. Multiple Strokes (Planar Graph)

When multiple strokes exist:
1. `buildPlanarGraph()` converts strokes to edges
2. `splitEdgesAtIntersections()` handles stroke intersections
3. `mergeNearbyVertices()` snaps close points together
4. `buildAdjacency()` creates vertex-edge relationships
5. `extractFaces()` walks the graph to find closed loops

---

## Planar Graph Building

### Algorithm

```
1. Convert each stroke to line segments
2. Detect intersections between all edge pairs
3. Split edges at intersection points
4. Merge vertices within snap tolerance (5px)
5. Sort incident edges by angle at each vertex
```

### Spatial Hashing

For performance, uses spatial hash grid:
- Cell size: 20px
- O(1) vertex lookup instead of O(n)

---

## Face Extraction

### Half-Edge Walking Algorithm

```
1. For each unvisited edge:
   a. Start face walk (left or right)
   b. At each vertex, find next edge (smallest turn)
   c. Mark edge as visited on that side
   d. Continue until return to start

2. Filter faces:
   - Remove outer infinite face (largest area)
   - Remove faces with area < minArea (1000px²)
```

### Get Next Edge

At each vertex, incident edges are sorted by angle. For a left walk:
- Next edge = previous edge in sorted list
- This ensures consistent CCW traversal

---

## Pattern Rendering

### Supported Patterns

| Pattern | Description |
|---------|-------------|
| `hatch` | Parallel lines at specified angle |
| `grid` | Horizontal + vertical lines |
| `dots` | Circular dots in grid |
| `crosshatch` | Two sets of parallel lines |

### Rendering Process

```
1. Create pattern canvas (32x32)
2. Draw pattern to canvas
3. Create CanvasPattern from canvas
4. On render:
   a. Begin path with polygon
   b. Fill with background color
   c. Clip to polygon
   d. Fill with pattern (50% opacity)
   e. If selected, draw dashed border
```

---

## Hit Testing

### Algorithm

```
1. Bounding box check first (fast reject)
2. Ray casting algorithm (point in polygon)
   - Cast horizontal ray from point
   - Count intersections with polygon edges
   - Odd count = inside, Even = outside
```

### Z-Order

Tests regions in reverse order (top-most first).

---

## Interaction

### Mouse Events

| Event | Action |
|-------|--------|
| Click on fill | Select region, start drag |
| Drag | Move selected region |
| Release | End drag |

### Transform

- Uses `transform: { x, y }` offset
- Does NOT modify original strokes
- Polygon points stay in original coordinates

---

## Integration with Store

### State

```typescript
interface DrawingState {
  fillRegions: FillRegion[];
  setFillRegions: (regions: FillRegion[]) => void;
  selectedFillRegionId: string | null;
  setSelectedFillRegionId: (id: string | null) => void;
}
```

### DrawingCanvas Integration

1. `FillRegionManager` instance created on mount
2. Strokes changes trigger `rebuild()`
3. Fill regions rendered before strokes
4. Hit testing in `handleMouseDown`
5. Drag handling in `handleMouseMove`

---

## Usage

### Create Fill from Shape

```typescript
import { createFillFromShape } from './fillRegion';

const region = createFillFromShape(points);
if (region) {
  // region is a closed FillRegion
}
```

### FillRegionManager API

```typescript
const manager = new FillRegionManager();

// Add single stroke and detect fill
manager.addStroke({ id, points, displayPoints });

// Rebuild from all strokes
manager.setStrokes(strokes);
manager.rebuild();

// Hit testing
const region = manager.hitTest(point);

// Selection
manager.setSelectedRegionId(id);

// Drag
manager.startDrag(point);
manager.updateDrag({ x: 10, y: 10 });
manager.endDrag();

// Rendering
manager.render(ctx);

// Styling
manager.setFillStyle({ type: 'hatch', color: '#4A90D9' });
```

---

## Thresholds

| Parameter | Value | Description |
|-----------|-------|-------------|
| SNAP_TOLERANCE | 5px | Vertex merge distance |
| GRID_CELL_SIZE | 20px | Spatial hash cell size |
| MIN_FACE_AREA | 1000px² | Minimum face area |
| CLOSED_THRESHOLD | max(10, 5%) | Start-end distance ratio |

---

## Limitations

1. **No holes support** - Cannot detect holes within faces
2. **No curves** - Only straight-line strokes supported
3. **Full rebuild** - Rebuilds entire graph on stroke change
4. **Translation only** - No rotation or scaling

---

## Future Enhancements

- Hole detection with even-odd rendering
- Incremental graph updates
- Rotation/scaling handles
- Pattern customization UI
