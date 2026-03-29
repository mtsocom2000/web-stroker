# Constraints Feature Guide

**Status**: Phase 1 Implementation Complete (2026-03-29)  
**Version**: 0.1.0

---

## Overview

The Constraints feature allows you to set exact values for distances, angles, and radii in your digital drawings. Once applied, constraints enforce these values during editing.

## Quick Start

### Creating a Distance Constraint

1. Select the Constraint Tool (coming soon)
2. Click two endpoints
3. Enter the desired length
4. Press Enter to apply

The line will now maintain that exact length.

### Visual Feedback

- **Blue endpoints** (●) indicate constrained points
- **Hover** over a constrained element to see the constraint value
- **Lock icon** (🔒) indicates active constraint

## Constraint Types (Phase 1)

### Distance Constraint

Constrains the distance between two points.

**Use case**: Set exact line lengths

**Example**:
- Select line endpoints A and B
- Enter "100mm"
- Line length is now fixed at 100mm
- Dragging either endpoint is restricted to maintain 100mm

### Angle Constraint

Constrains the angle between two lines.

**Use case**: Create perpendicular or parallel lines

**Example**:
- Select line 1
- Select line 2
- Enter "90°"
- Lines maintain 90° angle

### Radius Constraint

Constrains the radius of a circle or arc.

**Use case**: Set exact circle sizes

**Example**:
- Select circle
- Enter "50mm"
- Circle radius is fixed at 50mm

## Editing Constraints

### Change Constraint Value

1. Double-click the constraint marker (blue endpoint)
2. Input box appears with current value
3. Enter new value
4. Press Enter to apply

### Delete Constraint

1. Select the constrained element
2. Press Delete key

The constraint is removed and the element is now free to move.

## Technical Details

### Architecture

```
┌─────────────────────────────────────┐
│         DrawingCanvas               │
│  - ConstraintMarkers overlay        │
│  - ConstraintInputBox (on creation) │
└──────────────────┬──────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐
│useSelect   │ │Constraint  │ │ Store        │
│Tool        │ │Markers     │ │ (constraints)│
└────────────┘ └────────────┘ └──────────────┘
```

### Data Model

```typescript
interface Constraint {
  id: string;
  type: 'distance' | 'angle' | 'radius';
  value: number;
  targets: ConstraintTarget[];
  createdAt: number;
}
```

### Constraint Enforcement

During drag operations:
1. Check all constraints for the dragged point
2. Apply `ConstraintManager.enforceConstraint()`
3. Restrict movement to valid region
4. If no valid position: prevent drag (strict mode)

## Current Limitations (Phase 1)

- ❌ Constraint creation UI not yet implemented
- ❌ Only distance constraints enforced during drag
- ❌ Angle and radius constraints are stubs
- ❌ No constraint conflict detection
- ❌ No visual feedback for constraint type

## Roadmap

### Phase 2 (Next)
- [ ] Constraint creation workflow
- [ ] Angle constraint enforcement
- [ ] Radius constraint enforcement
- [ ] Constraint conflict detection

### Phase 3
- [ ] Equal radius constraints
- [ ] Point-to-line distance
- [ ] Horizontal/vertical constraints
- [ ] Parallel/perpendicular constraints

## Files

### Implementation
- `src/constraints/ConstraintTypes.ts` - Type definitions
- `src/constraints/ConstraintManager.ts` - Core logic
- `src/components/ConstraintInputBox.tsx` - Input UI
- `src/components/ConstraintMarkers.tsx` - Visual markers
- `src/hooks/useConstraints.ts` - React hook
- `src/store.ts` - Constraint state

### Tests
- `src/__tests__/ConstraintManager.test.ts` - Unit tests
- `src/__tests__/constraints-integration.test.ts` - Integration tests

## Troubleshooting

### "Why can't I drag this point?"

The point is constrained. Check for:
- Blue endpoint markers
- Hover to see constraint value

To free the point:
1. Select the constrained element
2. Press Delete to remove constraint

### "My constraint isn't working"

Check:
- Is the constraint type supported? (Phase 1: distance only)
- Are you dragging the correct point?
- Is there a constraint conflict?

---

**Last Updated**: 2026-03-29  
**Maintainer**: Development Team
