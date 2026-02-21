# Shape Detection Algorithm Documentation

## Overview

The shape detection system uses a **detection-first principle**: detect geometric patterns first, only fall back to smoothing if no clear shape is found. The system employs least-squares model fitting for robust shape detection.

---

## Architecture

### File Structure

```
src/shapeRecognition/
├── fitting.ts        # Least-squares fitting algorithms
├── scoring.ts        # Multi-model scoring system
├── index.ts          # Main entry point
├── classifier.ts     # Shape classification
├── cornerDetection.ts# Corner and segment detection
├── preprocessing.ts  # Point preprocessing
└── primitives.ts      # Geometric primitives
```

### Detection Pipeline

```
Raw Points
    │
    ▼
┌─────────────────┐
│  Preprocessing  │  Smoothing, resampling, filtering
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Scoring       │  Multi-model hypothesis testing
│   System        │  Line, Circle, Ellipse, Polygon
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Best Score     │  Select shape with highest confidence
│  Selection     │  Threshold: 0.6
└─────────────────┘
         │
         ▼
   Simplified Points
```

---

## Fitting Algorithms

### 1. Line Fitting (fitLine)

**Method**: Ordinary Least Squares (OLS) linear regression

**Algorithm**:
```
Given points P = [p1, p2, ..., pn]

1. Compute sums:
   - Σx, Σy, Σxy, Σx²
   
2. Calculate slope and intercept:
   slope = (n·Σxy - Σx·Σy) / (n·Σx² - Σx²)
   intercept = ȳ - slope·x̄
   
3. Compute normalized error:
   error = √(Σ(predicted_y - actual_y)² / n) / line_length
```

**Normalized Error**: `error < 3%` → accepted as line

---

### 2. Circle Fitting (fitCircleTaubin)

**Method**: Taubin algebraic circle fitting (numerically stable)

**Algorithm**:
```
Given points P = [p1, p2, ..., pn]

1. Compute moments:
   Mxx = Σ(x²) - Σ(x)²/n
   Myy = Σ(y²) - Σ(y)²/n  
   Mxy = Σ(xy) - Σ(x)·Σ(y)/n
   
2. Compute center:
   cx = (Myz·Mxy - Mxz·Myy) / (Mxx·Myy - Mxy²)
   cy = (Mxz·Mxy - Myz·Mxx) / (Mxx·Myy - Mxy²)
   
3. Compute radius:
   r = Σ√((xi-cx)² + (yi-cy)²) / n
   
4. Compute normalized error:
   error = √(Σ(di - r)² / n) / r
```

**Acceptance Criteria**:
- `normalizedError < 7%`
- `angularCoverage > 1.5π` (270°)
- Start-end distance < max(10px, 5% perimeter)

---

### 3. Ellipse Fitting (fitEllipse)

**Method**: Eigenvalue-based ellipse fitting using covariance matrix

**Algorithm**:
```
Given points P = [p1, p2, ..., pn]

1. Compute centroid:
   cx = Σx/n, cy = Σy/n
   
2. Compute centered coordinates and covariance:
   covXX = Σ(x-cx)² / n
   covYY = Σ(y-cy)² / n
   covXY = Σ(x-cx)(y-cy) / n
   
3. Compute eigenvalues/eigenvectors:
   trace = covXX + covYY
   det = covXX·covYY - covXY²
   
   eigen1 = trace/2 + √(trace²/4 - det)
   eigen2 = trace/2 - √(trace²/4 - det)
   
4. Extract axes:
   a = √eigen1 (major)
   b = √eigen2 (minor)
   
5. Compute rotation angle:
   θ = 0.5·atan2(2·covXY, covXX - covYY)
```

**Acceptance Criteria**:
- `normalizedError < 10%`
- `axisRatio (a/b) < 4`
- `angularCoverage > 1.5π`

---

## Scoring System

### Multi-Model Hypothesis

Instead of binary detection with priority ordering, the system computes confidence scores for each candidate shape and selects the best.

### Score Components

```typescript
interface ShapeScore {
  type: ShapeType;
  score: number;        // 0-1, higher is better
  normalizedError: number;
  confidence: number;
  points: Point[];
}
```

### Line Score Calculation

```
score = errorScore × 0.7 + closureScore × 0.3

where:
  errorScore = max(0, 1 - normalizedError / 0.05)
  closureScore = 1 - (startEndDist / perimeter)
```

### Circle/Ellipse Score Calculation

```
score = errorScore × 0.6 + coverageScore × 0.4 - shapePenalty

where:
  errorScore = max(0, 1 - normalizedError / threshold)
  coverageScore = angularCoverage / 2π
  shapePenalty = max(0, (axisRatio - 1) / 3) × 0.2  (ellipse only)
```

### Selection Algorithm

```typescript
function predictShapeWithScoring(points) {
  const scores = scoreShapes(points);
  
  // Find best score above threshold
  const best = scores.find(s => s.score > 0.6);
  
  // Fall back to best available
  return best ?? scores[0] ?? null;
}
```

---

## Classification

### Corner Detection

**Method**: Angle-based corner detection with velocity filtering

**Algorithm**:
```
For each point i (excluding endpoints):
  1. Compute turn angle:
     angle = angle(p[i-1], p[i], p[i+1])
     
  2. Compute velocity at point:
     velocity = distance(p[i], p[i-1])
     
  3. Corner if:
     - angle > angleThreshold (30°), OR
     - velocity < avgVelocity × velocityThreshold (30%)
     
  4. Filter by minimum corner distance (20px)
```

### Segment Creation

After corners detected, split stroke into segments:
```
Segments = split(points, cornerIndices)
```

### Shape Classification Rules

| Segments | Closed | Classification |
|----------|--------|----------------|
| 1 | No | Line (or arc/circle if curved) |
| 2 | No | Angle (L-shape) |
| 3 | Yes | Triangle |
| 4 | Yes | Rectangle (check perpendicular + parallel) |
| ≥5 | Yes | Polygon |
| ≥2 | No | Polyline |

---

## Rectangle Detection (Enhanced)

**Method**: Line fitting with geometric constraints

**Algorithm**:
```
Given 4 corner points [c0, c1, c2, c3]:

1. Fit lines between adjacent corners:
   lines = [c0→c1, c1→c2, c2→c3, c3→c0]
   
2. Check perpendicular (adjacent lines):
   For each pair (line[i], line[i+1]):
     dotProduct ≈ 0 within tolerance (0.2)
     
3. Check parallel (opposite lines):
   For each pair (line[i], line[i+2]):
     dotProduct ≈ 1 within tolerance (0.2)
     
4. Check equal sides:
   sideLengths = [d(c0,c1), d(c1,c2), d(c2,c3), d(c3,c0)]
   variation < 25%
   
5. Rectangle if:
   - perpendicularCount ≥ 3
   - parallelCount ≥ 2  
   - similarLengths ≥ 2
```

---

## Triangle Detection (Enhanced)

**Method**: Removed equilateral restriction

**Algorithm**:
```
Given 3 corner points [c0, c1, c2]:

1. Check minimum perimeter (> 30px)
   
2. Compute side lengths:
   s1 = d(c0, c1)
   s2 = d(c1, c2)
   s3 = d(c2, c0)
   
3. Compute variation:
   avg = (s1 + s2 + s3) / 3
   variation = max(|s1-avg|, |s2-avg|, |s3-avg|) / avg
   
4. Confidence:
   - variation < 30% → confidence = 0.85
   - variation < 50% → confidence = 0.75
   - otherwise → confidence = 0.70
```

---

## Closed Shape Detection

**Method**: Hybrid absolute + relative threshold

**Algorithm**:
```
function isClosedShape(points):
  startEndDist = distance(points[0], points[last])
  perimeter = computePerimeter(points)
  
  threshold = max(10, perimeter × 0.05)
  
  return startEndDist < threshold
```

**Threshold**: max(10px, 5% of perimeter)

---

## Thresholds Summary

| Parameter | Value | Description |
|-----------|-------|-------------|
| LINE_ERROR | 3% | Max deviation from fitted line |
| CIRCLE_ERROR | 7% | Max normalized radius error |
| ELLIPSE_ERROR | 10% | Max normalized axis error |
| ELLIPSE_RATIO | 4 | Max major/minor axis ratio |
| ANGULAR_COVERAGE | 1.5π | Min coverage (270°) |
| CORNER_ANGLE | 30° | Min turn angle for corner |
| CORNER_DISTANCE | 20px | Min distance between corners |
| MIN_PERIMETER | 30px | Min shape perimeter |
| CLOSED_THRESHOLD | max(10, 5%) | Start-end distance |

---

## Shape Types

```typescript
type ShapeType = 
  | 'line'        // Straight line
  | 'polyline'   // Multi-segment open shape
  | 'angle'      // L-shape (2 segments)
  | 'triangle'   // 3-sided closed
  | 'rectangle'  // 4-sided with right angles
  | 'circle'     // Circular closed shape
  | 'ellipse'    // Elliptical closed shape
  | 'arc'        // Partial circle
  | 'curve'      // Smooth curve
  | 'unknown';   // Unrecognized
```

---

## Usage

### Basic Usage

```typescript
import { predictShape, predictShapeWithDetails } from './shapeRecognition';

const points = [...]; // Array of {x, y} objects

// Get simplified shape points
const result = predictShape(points);
// Returns: Point[] or null

// Get detailed classification
const details = predictShapeWithDetails(points);
// Returns: { type, points, confidence } or null
```

### Using Scoring System

```typescript
import { predictShapeWithScoring, scoreShapes } from './shapeRecognition';

// Get all scored candidates
const allScores = scoreShapes(points);
// Returns: ShapeScore[] sorted by score

// Get best shape
const best = predictShapeWithScoring(points);
// Returns: Point[] or null
```

---

## Algorithm Complexity

| Operation | Complexity |
|-----------|------------|
| Line fitting | O(n) |
| Circle fitting | O(n) |
| Ellipse fitting | O(n) |
| Corner detection | O(n) |
| Scoring (all models) | O(n) |

Overall: **O(n)** where n = number of input points
