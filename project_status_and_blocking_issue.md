# Web Stroker - Project Status and Blocking Issues

## Current Status: Active Development

### ✅ Recently Fixed Issues (2026-02-08)
1. **Zero Point Size**: Reduced origin sphere radius from 2.0 to 0.5 units for less visual obstruction
2. **Axis Visualization**: Enhanced X and Y axes with directional arrows to clearly show positive directions
3. **Stroke Width Scaling**: Fixed stroke thickness calculation from `thickness/2` to `thickness*0.05` for proper visual scaling
   - Default 2px thickness now renders appropriately thin (0.1 radius instead of 1.0)
   - Applied consistently to both preview and final strokes
4. **Shape Prediction Auto-Closing**: Fixed shape prediction to not automatically close shapes that shouldn't be closed
   - **Triangle Detection**: Now only closes triangles if end point is within 15% of perimeter from start
   - **Line Detection**: Made more tolerant (2.5% deviation) and added direction change detection to avoid misclassifying L-shapes
   - **Polyline Detection**: Added basic L-shape detection to handle angular strokes properly
   - **Minimum Length**: Added 8-unit minimum length requirement for line detection
5. **Independent Smooth & Predict Controls**: Separated smoothing and prediction into independent options
   - **Separate Checkboxes**: Individual "Smooth" and "Predict" controls in toolbar
   - **Default Settings**: Smooth checked (on), Predict unchecked (off) - favor natural drawing
   - **Independent Logic**: Each option works independently without interference
   - **Flexible Combinations**: Users can choose Smooth only, Predict only, both, or neither
   - **State Management**: Both settings tracked separately in store and saved/loaded with files
   - **Clear User Intent**: Eliminates confusion about what each option does
6. **Stroke Smoothing Artifacts**: Implemented "Detection-First" principle to eliminate artificial corners
   - **Detection-First**: Predict user intent BEFORE any smoothing to preserve straight lines
   - **Smart Smoothing**: Only smooth freehand curves when NO clear geometric pattern is detected
   - **Preserved Endpoints**: Start and end points remain exactly as drawn, preventing small "kicks"
   - **Robust Line Detection**: Enhanced with multiple criteria (outlier count, angle changes, deviation checks)
   - **Raw Input Processing**: Shape detection now works with raw hand-drawn data (more tolerant thresholds)
   - **Reduced Smoothing**: Lowered interpolation steps to 6 for subtler curve handling only when needed
7. **Code Quality**: Fixed React linting errors by properly wrapping event handlers in useCallback and resolving function declaration order

## Current Known Issues

### 🟡 Moderate Priority Issues
1. **Missing Vitest Dependency**: Test imports failing due to vitest not in package.json
   - Error: Cannot find module 'vitest' in shapeRecognition.test.ts
   - Tests exist but can't run without installing vitest
   - **Impact**: Cannot run test suite, CI/CD would fail

2. **Save Functionality**: Ctrl+S shortcut exists but only placeholder implementation
   - Keyboard handler present but no actual save logic
   - **Impact**: Users cannot save their drawings

### 🟠 Low Priority Issues
1. **Visual Polish**:
   - Grid could be more subtle (current colors may be too prominent)
   - No visual feedback for tool selection
   - Missing cursor feedback for different tools

2. **Performance**:
   - No stroke pooling or optimization for large drawings
   - History state could grow unbounded
   - Three.js resource disposal needs verification

## Technical Debt

### 📋 Code Quality
- **Test Coverage**: Only shape recognition is tested; need component and integration tests
- **Error Handling**: Basic error handling exists but could be more robust
- **TypeScript**: Could enable stricter type checking rules

### 🏗️ Architecture
- **Component Coupling**: DrawingCanvas is quite large (~470 lines) - could be split
- **State Management**: Single large store - could be modularized
- **Three.js Cleanup**: Resource disposal pattern is inconsistent

## Feature Gaps

### 🚫 Missing Core Features
1. **File Operations**: No load/save/export functionality
2. **Selection Tools**: No way to select or edit existing strokes
3. **Eraser Tool**: Cannot erase parts of strokes
4. **Touch Support**: Mouse-only input, no mobile/tablet support
5. **Undo/Redo UI**: Keyboard shortcuts work but no visual undo/redo interface

### 💡 Enhancement Opportunities
1. **Brush Variety**: Only basic round brush available
2. **Layer System**: Single layer only
3. **Grid Snapping**: Optional grid with snap functionality
4. **Shape Tools**: Direct drawing of geometric shapes
5. **Collaboration**: Real-time multi-user features

## Blocking Issues

### 🔴 Critical Blockers
**None currently** - Core drawing functionality is working.

### 🟡 Near-Term Blockers
1. **Test Suite**: Cannot run tests due to missing vitest dependency
   - **Resolution**: Add vitest to package.json devDependencies
   - **ETA**: 15 minutes

2. **Save Implementation**: Users cannot persist their work
   - **Resolution**: Implement JSON/Canvas export functionality
   - **ETA**: 2-3 hours

## Recent Development Activity

### Last Changes (2026-02-08)
- Fixed canvas visualization issues (origin point, axes, stroke width)
- Comprehensive documentation updates (AGENTS.md, docs/features.md)
- Codebase analysis and architectural review

### Development Velocity
- **Active**: Yes, regular commits and improvements
- **Testing**: Infrastructure exists but currently broken
- **Documentation**: Recently updated and comprehensive

## Next Priorities

### Immediate (This Week)
1. Fix test suite by installing vitest
2. Implement basic save/load functionality
3. Add eraser tool

### Short Term (2-4 Weeks)
1. Add stroke selection and editing
2. Implement export options (PNG, SVG)
3. Add touch/mobile support
4. Performance optimization

### Medium Term (1-2 Months)
1. Layer system
2. Advanced brush options
3. Grid and snapping
4. Collaboration features

## Environment & Dependencies

### Tech Stack Health
- **React 19**: ✅ Latest stable
- **TypeScript**: ✅ Strict mode, well configured
- **Three.js**: ✅ Recent version (0.128.0)
- **Zustand**: ✅ Lightweight, appropriate choice
- **Vite**: ✅ Fast build tool, good HMR

### Dependency Issues
- **Missing**: vitest (blocking tests)
- **Potentially Outdated**: Should check if Three.js has newer stable releases
- **Unused**: Some dependencies may be unused (needs audit)

## Testing Status

### Current State
- **Framework**: Vitest configured but not installable
- **Coverage**: Limited to shape recognition algorithms
- **Types**: Unit tests for core logic only
- **E2E**: No end-to-end tests

### Needed Tests
1. Component rendering tests
2. User interaction tests
3. Canvas drawing integration tests
4. State management tests
5. File I/O tests (when implemented)

---

**Last Updated**: 2026-02-08
**Next Review**: 2026-02-15
**Project Status**: 🟢 Active Development