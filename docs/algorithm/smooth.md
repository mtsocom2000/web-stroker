# PredictPen - Smooth Algorithm

A stroke smoothing and path prediction algorithm designed to eliminate visual lag artifacts and jitter in digital drawing applications. It transforms discrete, potentially laggy mouse/stylus input into smooth, continuous brush strokes.

## Problem Statement

Raw input devices (mouse, stylus, touch) produce three categories of artifacts:

- **Temporal Jitter**: Irregular timing between sample points that creates inconsistent motion
- **Spatial Gaps**: Sparse sampling patterns create visible discontinuities or "kinks" in rendered strokes
- **Input Lag**: Delay between physical motion and the rendered output on screen

## Algorithm Architecture

The algorithm consists of three main components:

### 1. Physics-Based Smoothing

**Purpose**: Apply temporal smoothing through physics simulation

**Mechanism**:
- Simulates a **spring-mass-damper system** where the pen tip is connected to the cursor via an elastic string
- Treats input points as anchor points being pulled toward the cursor

**State Management**:
- Maintains three vectors for each point:
  - Position vector
  - Velocity vector
  - Acceleration vector

**Dynamic Interpolation**:
- Generates **6 intermediate points** between each pair of raw input points
- Uses iterative physics calculations to compute smooth transitions
- Preserves natural acceleration profiles

**Key Parameters**:
- **Inverse Mass (1-1)**: Controls responsiveness to input changes
- **Drag Coefficient (0.9213)**: Controls damping/smoothness tradeoff (higher = smoother but more lag)

**Result**: Eliminates sudden jumps and ensures smooth acceleration transitions throughout the stroke path

### 2. Adaptive Stamp Rendering

**Purpose**: Apply spatial smoothing through intelligent brush simulation

**Mechanism**:
- Renders strokes using **overlapping circular brush stamps** positioned along the smoothed path
- Creates natural-looking, continuous lines

**Linear Interpolation**:
- Fills gaps between smoothed points with densely-packed stamps
- Ensures no visible discontinuities

**Curvature-Aware Sizing**:
- Dynamically adjusts brush width based on stroke curvature
- Calculates angles between consecutive line segments

**Width Adaptation Rules**:
- **Straight lines**: Fuller brush width for consistent appearance
- **Sharp curves**: Reduced width for better curve definition and control

**Angular Rate Formula**:

$$\text{Angular Rate} = (\arccos(\text{dot\_product} / n) \times n) \times 25$$

This formula determines local curvature and proportionally adjusts stamp size.

**Result**: Natural, responsive brush appearance that adapts to stroke geometry

### 3. Advanced Path Prediction (Optional)

**Purpose**: Post-stroke optimization for advanced smoothing

**Methods**:
- **Spline Interpolation**: Uses external solver (Module.SolvePath()) with configurable tension and continuity parameters
- **Rolling Window Smoothing**: Averages curvature rates over recent path segments to smooth local variations
- **Fade Effects**: Applies natural tapering at stroke endpoints for refined appearance
- **Adaptive Density**: Increases stamp density in high-curvature regions for better definition

## Algorithm Flow

```
Raw Input Points
        ↓
Physics-Based Smoothing
  (spring-mass-damper)
        ↓
Interpolated Points
  (6 points per interval)
        ↓
Adaptive Stamp Rendering
  (curvature-aware sizing)
        ↓
Intermediate Visual Output
        ↓
[Optional: Advanced Path Prediction]
  ↓
Spline fitting
Curvature smoothing
Adaptive density
         ↓
Final Smooth Stroke
```

## Technical Highlights

1. **Physics Simulation**: Provides natural motion characteristics without explicit polynomial fitting
2. **Adaptive Rendering**: Responds to stroke geometry in real-time rather than applying uniform smoothing
3. **Modularity**: Physics, rendering, and prediction components are independent and can be enabled/disabled
4. **Parameter Tuning**: Inverse mass and drag coefficient allow fine-grained control over smoothness vs. responsiveness tradeoff
