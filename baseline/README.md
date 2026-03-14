# Baseline Test Data

This folder contains stroke data for testing shape recognition algorithms.

## Structure

```
baseline/
├── shapes/           # Shape recognition test data
│   ├── line/         # Line strokes (straight lines)
│   ├── angle/        # Angle/V-shape strokes
│   ├── triangle/     # Triangle strokes
│   ├── rectangle/    # Rectangle/square strokes
│   ├── circle/       # Circle strokes
│   └── arc/          # Arc strokes
├── complex/          # Complex/multi-stroke drawings
└── test-utils/       # Test utilities for loading baseline data
```

## Data Types

Each category contains three types of baseline data:

### 1. `perfect_*.json` - Perfect Geometry
- **Purpose**: Algorithm-generated perfect shapes for comparison
- **Characteristics**: 
  - Perfect straight lines, exact angles, ideal curves
  - No jitter or noise
  - Mathematically precise
- **Use case**: Testing if algorithm correctly identifies perfect shapes

### 2. `handdrawn_*.json` - Simulated Hand-drawn
- **Purpose**: Computer-generated with slight irregularities to simulate real drawing
- **Characteristics**:
  - ±1-3px random jitter along edges
  - Slightly rounded corners on polygons
  - Minor deviations from perfect geometry
- **Use case**: Testing algorithm robustness with controlled "noise"

### 3. `manual_*.json` - Real User Drawn (You Create These!)
- **Purpose**: Your actual hand-drawn strokes
- **Characteristics**:
  - Real mouse/touch input with natural variations
  - Your personal drawing style
  - True human imperfection
- **Use case**: Testing algorithm on real-world input

## File Naming Convention

```
{type}_{description}.json

Examples:
- perfect_horizontal.json      # Perfect horizontal line
- handdrawn_circle.json        # Simulated hand-drawn circle
- manual_my_drawing_001.json   # Your actual drawing
```

## File Format

Each `.json` file contains a complete `DrawingData` object:

```typescript
interface DrawingData {
  version: string;
  timestamp: number;
  description: string;      // Human-readable description
  expectedShape: string;    // Expected shape type
  tags?: string[];          // Optional tags: ["handdrawn", "noisy", etc.]
  canvasState: {
    strokes: Stroke[];
    canvasWidth: number;
    canvasHeight: number;
    zoom: number;
    panX: number;
    panY: number;
    strokeMode: 'original' | 'smooth' | 'predict';
  };
}
```

## Creating New Baseline Data

### For `manual_*.json` (Recommended):

1. Run the application: `npm run dev`
2. Draw the shape you want to capture
3. Click **"Save"** button in toolbar
4. Move the downloaded `.json` file to appropriate `baseline/shapes/<category>/` folder
5. Rename with prefix: `manual_<your_description>.json`
   - Examples: `manual_circle_attempt1.json`, `manual_shaky_line.json`

### For `handdrawn_*.json`:

Use the generation utilities in `src/__tests__/test-utils/baseline.ts`:

```typescript
import { generatePerfectLine, generateHanddrawnLine } from './test-utils/baseline';

// Create a line with controlled jitter
const perfectPoints = generatePerfectLine({x: 50, y: 100}, {x: 150, y: 100}, 20);
const handdrawnPoints = addJitter(perfectPoints, 2); // ±2px jitter
```

## Using Baseline Data in Tests

```typescript
import { loadBaselineStroke, getBaselineFiles } from './test-utils/baseline';
import { predictShape } from '../predict';

// Load a specific baseline
const stroke = loadBaselineStroke('line', 'manual_my_drawing_001');
const result = predictShape(stroke.points);
expect(result).not.toBeNull();

// Test all manual baselines in a category
const manualFiles = getBaselineFiles('line')
  .filter(f => f.startsWith('manual_'));
  
manualFiles.forEach(file => {
  const stroke = loadBaselineStroke('line', file);
  test(`detects ${file}`, () => {
    expect(predictShape(stroke.points)).not.toBeNull();
  });
});
```

## Test Categories

### Line Tests
- `perfect_horizontal.json` - Perfect horizontal line
- `perfect_vertical.json` - Perfect vertical line
- `perfect_diagonal.json` - Perfect diagonal line
- `handdrawn_horizontal.json` - Simulated hand-drawn horizontal
- `handdrawn_vertical.json` - Simulated hand-drawn vertical
- `manual_*.json` - Your drawings

### Angle Tests
- `perfect_l_shape.json` - Perfect L-shape (90°)
- `perfect_v_shape.json` - Perfect V-shape
- `handdrawn_*.json` - Simulated versions
- `manual_*.json` - Your drawings

### Triangle Tests
- `perfect_equilateral.json` - Perfect equilateral triangle
- `perfect_right_angle.json` - Perfect right-angle triangle
- `handdrawn_equilateral.json` - Simulated hand-drawn
- `manual_*.json` - Your drawings

### Rectangle Tests
- `perfect_square.json` - Perfect square
- `perfect_rectangle.json` - Perfect rectangle
- `handdrawn_square.json` - Simulated hand-drawn square
- `manual_*.json` - Your drawings

### Circle Tests
- `perfect_circle.json` - Perfect circle
- `handdrawn_circle.json` - Simulated hand-drawn circle
- `manual_*.json` - Your drawings

### Arc Tests
- `perfect_semi_arc.json` - Perfect semi-circle
- `perfect_quarter_arc.json` - Perfect quarter circle
- `handdrawn_*.json` - Simulated versions
- `manual_*.json` - Your drawings

## Tips for Creating Good Manual Baselines

1. **Draw at moderate speed** - Not too fast (jittery) or too slow (overly perfect)
2. **Use consistent stroke width** - The default 2px is fine
3. **Draw in one continuous stroke** - Don't lift mouse mid-shape
4. **Don't close shapes perfectly** - Leave 5-10px gap for polygons
5. **Vary your attempts** - Create multiple versions with different quality
6. **Document your intent** - Use descriptive names like `manual_circle_wobbly.json`

## Contributing New Baselines

When adding new baseline data:

1. Place in correct category folder
2. Use appropriate prefix (`perfect_`, `handdrawn_`, or `manual_`)
3. Include `description` and `expectedShape` in JSON
4. Add `tags` array for additional metadata
5. Run tests to verify loading works: `npm run test:run -- --testNamePattern="Baseline"`
