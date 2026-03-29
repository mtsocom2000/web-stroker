# Constraints Feature Proposal

## Summary

Add **parametric constraints** to Digital Mode, transforming measurement tools from "read-only" to "editable constraints". Users can set exact values for distances, angles, and radii, and the system enforces these constraints during editing.

## Problem Statement

Currently, the measurement system only **displays** values:
- User measures a line → sees "100mm" (read-only)
- User measures an angle → sees "90°" (read-only)
- User measures a circle → sees "R=50mm" (read-only)

But users cannot **set** these values directly. They must manually drag endpoints to approximate the desired value, which is imprecise and time-consuming.

## Proposed Solution

Add a **Constraint Tool** that:
1. Reuses the measurement selection workflow (select 2 points, or 2 lines, or 1 circle)
2. Shows an **editable input box** instead of read-only label
3. User enters exact value → constraint is created
4. Constrained elements show visual feedback (blue endpoints)
5. Dragging constrained elements respects the constraint (hard constraint - cannot violate)

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Constraint lifetime | **Permanent** | Until user deletes - true parametric modeling |
| Violation handling | **Strict mode** | Cannot drag to violate - clear feedback |
| Visual feedback | **Hybrid** | Blue endpoints always + hover details |
| Input UI | **Floating input box** | Contextual, non-modal, easy to cancel |
| Constraint scope | **Distance, Angle, Radius** | Core types for MVP |

## Constraints Types (Phase 1)

1. **Distance Constraint** - Between any two points
2. **Angle Constraint** - Between any two lines
3. **Radius Constraint** - For circles/arcs

## User Stories

### US1: Create Distance Constraint
> As a user, I want to set an exact length for a line, so that I don't have to manually adjust it.

**Workflow**:
1. Select Constraint Tool → Distance
2. Click line endpoint A
3. Click line endpoint B
4. Input box appears with current length (e.g., "87.3mm")
5. User types "100" → presses Enter
6. Line length updates to 100mm, endpoints turn blue
7. Dragging either endpoint is restricted to maintain 100mm length

### US2: Create Angle Constraint
> As a user, I want to set an exact angle between two lines, so that I can create precise geometric relationships.

**Workflow**:
1. Select Constraint Tool → Angle
2. Click line 1
3. Click line 2
4. Input box appears with current angle (e.g., "73.5°")
5. User types "90" → presses Enter
6. Line 2 rotates to make 90° angle with line 1
7. Angle is maintained when either line is rotated

### US3: Edit Constraint
> As a user, I want to modify an existing constraint value, so that I can update my design.

**Workflow**:
1. Double-click constraint marker (blue endpoint)
2. Input box appears with current value
3. User types new value → presses Enter
4. Geometry updates to match new constraint

### US4: Delete Constraint
> As a user, I want to remove a constraint, so that I can freely edit the geometry.

**Workflow**:
1. Select constrained element (or click constraint marker)
2. Press Delete key
3. Constraint is removed, endpoints return to black

## Technical Approach

### Data Structure
```typescript
interface Constraint {
  id: string;
  type: 'distance' | 'angle' | 'radius';
  value: number;
  targets: ConstraintTarget[];
}
```

### Storage
- Independent array in store: `constraints: Constraint[]`
- Persisted in CanvasState (saved/loaded with drawing)

### Enforcement
- During drag: check all constraints involving dragged point
- Restrict movement to valid region (e.g., arc for distance constraint)
- If no valid region: prevent drag (strict mode)

## Success Criteria

- [ ] User can create distance constraint between two points
- [ ] User can create angle constraint between two lines
- [ ] User can create radius constraint on circle/arc
- [ ] Constrained elements show blue endpoints
- [ ] Dragging respects constraints (cannot violate)
- [ ] User can edit constraint value (double-click)
- [ ] User can delete constraint (Delete key)
- [ ] Constraints persist in saved files

## Out of Scope (Phase 2+)

- Equal radius constraints (two circles must have same radius)
- Point-to-line distance constraints
- Horizontal/vertical constraints
- Parallel/perpendicular constraints
- Temporary/disable constraints

## Dependencies

- Existing measurement system (`src/measurements.ts`)
- Digital mode selection (`src/hooks/useSelectTool.ts`)
- Store state management (`src/store.ts`)

## Risks

| Risk | Mitigation |
|------|------------|
| Constraint conflicts (impossible to satisfy all) | Strict mode - prevent drag that causes conflict |
| Performance with many constraints | Optimize constraint checking, lazy evaluation |
| User confusion about "why can't I drag this?" | Clear visual feedback + tooltip explanation |

## Next Steps

1. Write detailed spec (`specs/constraints-architecture.md`)
2. Create implementation plan
3. Implement in phases:
   - Phase 1: Distance constraint (MVP)
   - Phase 2: Angle + Radius constraints
   - Phase 3: Visual polish + edge cases

---

**Status**: Proposal approved  
**Created**: 2026-03-29  
**Author**: Development Team
