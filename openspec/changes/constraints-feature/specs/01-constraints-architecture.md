# Constraints Feature - Architecture Specification

**Spec ID**: constraints-001  
**Status**: Ready for implementation  
**Created**: 2026-03-29  
**Author**: Development Team

---

## 1. Overview

### 1.1 Purpose

Add **parametric constraints** to Digital Mode, allowing users to set exact values for distances, angles, and radii. The system enforces these constraints during editing.

### 1.2 Scope

**In Scope (Phase 1)**:
- Distance constraints (between any two points)
- Angle constraints (between any two lines)
- Radius constraints (for circles/arcs)
- Visual feedback (blue endpoints, hover labels)
- Hard constraint enforcement (cannot violate)
- Edit/delete constraints

**Out of Scope (Phase 2+)**:
- Equal radius constraints
- Point-to-line distance
- Horizontal/vertical constraints
- Parallel/perpendicular constraints

---

## 2. Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────┐
│                    DrawingCanvas                            │
│  - Event routing to constraint handlers                     │
│  - 2D UI rendering (constraint labels, markers)             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐
│ useSelectTool│ │ Constraint   │ │ DrawingStateManager │
│ (selection)  │ │ Manager      │ │ (state + commands)  │
└──────────────┘ └──────────────┘ └─────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │ Store (Zustand) │
                        │ - constraints[] │
                        └─────────────────┘
```

### 2.2 Key Components

1. **Constraint Manager** (new) - Core constraint logic
2. **Constraint Store Slice** (new) - State management
3. **Constraint UI** (new) - Input box, visual markers
4. **Drag Constraint System** (modification) - Enforce during drag

---

## 3. Data Model

### 3.1 Constraint Interface

```typescript
type ConstraintType = 'distance' | 'angle' | 'radius';

interface Constraint {
  id: string;
  type: ConstraintType;
  value: number;  // mm for distance/radius, degrees for angle
  
  // Constrained elements
  targets: ConstraintTarget[];
  
  // Metadata
  createdAt: number;
}

interface ConstraintTarget {
  strokeId: string;
  segmentIndex?: number;  // For lines/arcs
  pointIndex?: number;    // 0=start, 1=end (for distance)
}
```

### 3.2 Examples

**Distance Constraint** (line length = 100mm):
```json
{
  "id": "c-1",
  "type": "distance",
  "value": 100,
  "targets": [
    { "strokeId": "s-1", "segmentIndex": 0, "pointIndex": 0 },
    { "strokeId": "s-1", "segmentIndex": 0, "pointIndex": 1 }
  ]
}
```

**Angle Constraint** (line1 ⟂ line2):
```json
{
  "id": "c-2",
  "type": "angle",
  "value": 90,
  "targets": [
    { "strokeId": "s-1", "segmentIndex": 0 },
    { "strokeId": "s-2", "segmentIndex": 0 }
  ]
}
```

**Radius Constraint** (circle R = 50mm):
```json
{
  "id": "c-3",
  "type": "radius",
  "value": 50,
  "targets": [
    { "strokeId": "s-3", "segmentIndex": 0 }
  ]
}
```

### 3.3 Store Integration

```typescript
// src/store.ts
interface DrawingState {
  // ... existing fields
  
  // Constraints
  constraints: Constraint[];
  addConstraint: (constraint: Constraint) => void;
  updateConstraint: (id: string, value: number) => void;
  removeConstraint: (id: string) => void;
  getConstraintsForPoint: (strokeId: string, pointIndex: number) => Constraint[];
}
```

---

## 4. User Interaction

### 4.1 Constraint Creation Flow

```
1. User selects Constraint Tool
         ↓
2. Click first target (point/line)
         ↓
3. Click second target (for distance/angle)
         ↓
4. Floating input box appears
   - Pre-filled with current measurement
   - Focused, ready for input
         ↓
5. User types value → presses Enter
         ↓
6. Constraint created
   - Geometry updates to match value
   - Endpoints turn blue
   - Input box disappears
```

### 4.2 Constraint Edit Flow

```
1. User double-clicks constraint marker (blue endpoint)
         ↓
2. Floating input box appears
   - Shows current constraint value
         ↓
3. User types new value → presses Enter
         ↓
4. Constraint updated
   - Geometry updates
   - Input box disappears
```

### 4.3 Constraint Delete Flow

```
1. User selects constrained element
         ↓
2. Press Delete key
         ↓
3. Constraint removed
   - Endpoints return to black
   - Geometry is now free
```

---

## 5. Visual Design

### 5.1 Endpoint States

| State | Appearance |
|-------|------------|
| Normal | Black circle ○ |
| Constrained | Blue circle ● |
| Hover (constrained) | Blue + label "d=100mm 🔒" |
| Drag (constrained) | Blue + restricted movement |

### 5.2 Floating Input Box

```
┌─────────────────┐
│ Length: [100]mm │  ← Pre-filled, focused
│   ✓ Enter to apply   │
│   ✗ Esc to cancel   │
└─────────────────┘
```

**Position**: Near the measurement line/element  
**Behavior**: Non-modal, click outside to cancel

### 5.3 Hover Label

```
     ┌──────────────┐
     │ d=100mm  🔒 │  ← Constraint value + lock icon
     └──────────────┘
            │
      ●─────●─────●  ← Blue endpoints
```

---

## 6. Constraint Enforcement

### 6.1 Distance Constraint

**Mathematical Model**:
- Point B must lie on circle centered at A with radius = constraint value
- During drag: project mouse position to valid arc
- If no valid position: prevent drag

**Implementation**:
```typescript
function enforceDistanceConstraint(
  draggedPoint: Point,
  anchorPoint: Point,
  constraintValue: number
): Point {
  // Project dragged point to circle
  const direction = normalize(subtract(draggedPoint, anchorPoint));
  return add(anchorPoint, scale(direction, constraintValue));
}
```

### 6.2 Angle Constraint

**Mathematical Model**:
- Line 2 must maintain fixed angle relative to Line 1
- During drag: rotate Line 2 to maintain angle
- Pivot point: intersection of Line 1 and Line 2

**Implementation**:
```typescript
function enforceAngleConstraint(
  line1: Line,
  line2: Line,
  constraintAngle: number
): Line {
  // Calculate required rotation
  const currentAngle = angleBetween(line1, line2);
  const rotation = constraintAngle - currentAngle;
  
  // Rotate line2 around intersection point
  return rotateLine(line2, rotation);
}
```

### 6.3 Radius Constraint

**Mathematical Model**:
- Circle/arc radius is fixed
- During drag: scale circle to maintain radius
- Center point can move freely

**Implementation**:
```typescript
function enforceRadiusConstraint(
  circle: Circle,
  draggedPoint: Point,
  constraintRadius: number
): Circle {
  // Update radius to match constraint
  return { ...circle, radius: constraintRadius };
}
```

### 6.4 Conflict Detection

**Scenario**: Multiple constraints on same point

```
Point A has:
- Distance(A, B) = 100
- Distance(A, C) = 50
- User drags A such that no position satisfies both
```

**Resolution**: Strict mode - prevent drag

```typescript
function canDragToPoint(
  point: Point,
  constraints: Constraint[]
): boolean {
  for (const constraint of constraints) {
    if (!satisfiesConstraint(point, constraint)) {
      return false;  // Strict mode
    }
  }
  return true;
}
```

---

## 7. Implementation Plan

### Phase 1: Foundation (Week 1)

**Files to create**:
- `src/constraints/ConstraintManager.ts`
- `src/constraints/ConstraintTypes.ts`
- `src/components/ConstraintInputBox.tsx`

**Files to modify**:
- `src/store.ts` - Add constraint state
- `src/components/DrawingCanvas.tsx` - Event routing
- `src/hooks/useSelectTool.ts` - Constraint selection

### Phase 2: Distance Constraint (Week 2)

- Implement distance constraint creation
- Implement distance constraint enforcement
- Visual feedback (blue endpoints)
- Edit/delete functionality

### Phase 3: Angle + Radius (Week 3)

- Implement angle constraint
- Implement radius constraint
- Polish visual feedback

### Phase 4: Testing + Polish (Week 4)

- Unit tests for ConstraintManager
- Integration tests for drag enforcement
- Edge case handling
- Performance optimization

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
describe('ConstraintManager', () => {
  test('creates distance constraint', () => {...});
  test('enforces distance constraint during drag', () => {...});
  test('detects constraint conflict', () => {...});
  test('updates constraint value', () => {...});
  test('removes constraint', () => {...});
});
```

### 8.2 Integration Tests

```typescript
describe('Constraint Creation Flow', () => {
  test('creates distance constraint via UI', async () => {
    // Select constraint tool
    // Click two endpoints
    // Type value and press Enter
    // Verify constraint created and geometry updated
  });
});

describe('Constraint Enforcement', () => {
  test('prevents drag that violates constraint', async () => {
    // Create distance constraint
    // Try to drag endpoint beyond constraint
    // Verify drag is restricted
  });
});
```

### 8.3 E2E Tests (OpenSpec + Playwright)

```typescript
test('complete constraint workflow', async () => {
  // 1. Draw a line
  // 2. Apply distance constraint
  // 3. Verify line length updates
  // 4. Try to drag - verify restriction
  // 5. Edit constraint value
  // 6. Delete constraint
  // 7. Verify line is now free
});
```

---

## 9. Dependencies

### 9.1 Internal

- `src/measurements.ts` - Distance/angle calculation functions
- `src/store.ts` - State management
- `src/hooks/useSelectTool.ts` - Selection logic

### 9.2 External

- None (pure TypeScript/React)

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Constraint conflicts | High | Strict mode - prevent invalid drag |
| Performance with many constraints | Medium | Lazy evaluation, spatial indexing |
| User confusion | Medium | Clear visual feedback + tooltips |
| Complex math (angle enforcement) | Low | Use existing geometry utilities |

---

## 11. Success Metrics

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E test passes
- [ ] User can create/edit/delete constraints
- [ ] Drag enforcement works correctly
- [ ] Visual feedback is clear
- [ ] Constraints persist in saved files

---

## 12. Open Questions

None - all design decisions have been validated.

---

**Approval**: Ready for implementation  
**Next Step**: Invoke writing-plans skill to create detailed implementation plan
