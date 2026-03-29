# Phase 5: DrawingCanvas 精简计划

**目标**: 从 3130 行精简到 <1000 行（第一阶段）

**日期**: 2026-03-29

---

## 当前状态分析

### DrawingCanvas.tsx 结构 (3130 行)

**Refs (12 个)**:
- containerRef, canvasRef, rendererRef, commanderRef
- animationFrameRef, closedAreaManagerRef
- modifiedStrokeIdsRef, syncedStrokeIdsRef, isDraggingRef
- intersectionManagerRef, strokesRef, arcPointsRef
- panRef, brushSettingsRef, lastMousePosRef
- currentSnapRef, snapThresholdRef, measurePreviewRef, mouseWorldRef
- currentStrokeRef

**State (23 个)**:
- isDrawing, isPanning, isDragging, isDraggingArea
- lastDragPoint, draggedStrokeIds, panStart, dragStart
- currentStrokePoints
- digitalLinePoints, digitalLinePreviewEnd
- circleCenter, circleRadiusPoint, circlePoints
- curvePoints
- arcPoints, arcRadiusPoint
- hoveredDigitalElement, selectedDigitalElements
- isDraggingDigital, digitalDragStart, selectedIntersection

**Effects (12 个)**:
- store.strokes 同步
- store.toolCategory 变化处理
- store.activeTool 变化处理
- store.zoom/pan 同步
- panRef 同步
- brushSettingsRef 同步
- strokesRef 同步
- commander 预览状态同步
- commander strokes 同步
- commander selection 同步
- commander hover 同步
- 初始化和清理

**Callbacks (10+ 个)**:
- worldToScreen, screenToWorld
- applySnap
- render (2D canvas UI 层)
- distanceToSegment, findStrokeAtPosition
- findDigitalElementAtPosition, findAllDigitalElementsAtPosition
- handleMouseDown (940 行！)
- handleMouseMove (366 行)
- handleMouseUp (187 行)

---

## 精简策略

### 策略 1: 提取数字模式绘制逻辑

**目标**: 创建 `useDigitalDrawing` hook

**提取内容**:
- State: digitalLinePoints, digitalLinePreviewEnd, circleCenter, circleRadiusPoint, circlePoints, curvePoints, arcPoints, arcRadiusPoint
- Logic: handleMouseDown 中的数字模式部分 (line 1524-1800+)
- Logic: handleMouseMove 中的数字模式部分 (line 2157-2350+)
- Logic: handleMouseUp 中的数字模式部分 (line 2523-2650+)

**预计减少**: ~800 行

---

### 策略 2: 提取选择/拖拽逻辑

**目标**: 增强现有 `useSelectTool` hook

**提取内容**:
- State: hoveredDigitalElement, selectedDigitalElements, isDraggingDigital, digitalDragStart, selectedIntersection
- State: isDragging, isDraggingArea, lastDragPoint, draggedStrokeIds
- Logic: findDigitalElementAtPosition, findAllDigitalElementsAtPosition
- Logic: handleMouseDown 中的选择部分
- Logic: handleMouseMove 中的拖拽部分
- Logic: handleMouseUp 中的选择/拖拽部分

**预计减少**: ~600 行

---

### 策略 3: 提取测量工具逻辑

**目标**: 创建 `useMeasureTools` hook

**提取内容**:
- State: measurePreviewRef
- Logic: handleMouseDown 中的测量部分
- Logic: handleMouseMove 中的测量部分
- Logic: handleMouseUp 中的测量部分

**预计减少**: ~300 行

---

### 策略 4: 提取吸附系统逻辑

**目标**: 创建 `useSnapSystem` hook

**提取内容**:
- State: currentSnapRef, snapThresholdRef
- Logic: applySnap, worldToScreen, screenToWorld
- Logic: snap 指示器渲染

**预计减少**: ~150 行

---

### 策略 5: 提取艺术模式绘制逻辑

**目标**: 创建 `useArtisticDrawing` hook

**提取内容**:
- State: currentStrokePoints, isDrawing
- Logic: handleMouseDown 中的艺术模式部分
- Logic: handleMouseMove 中的艺术模式部分
- Logic: handleMouseUp 中的艺术模式部分

**预计减少**: ~400 行

---

## 实施顺序

### Step 1: 提取吸附系统 (最简单) ✅

**文件**: `src/hooks/useSnapSystem.ts`

**依赖**: 无

**API**:
```typescript
interface UseSnapSystemReturn {
  applySnap: (point: Point, polylinePoints?: Point[]) => { point: Point; snap: SnapResult | null };
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  screenToWorld: (screenX: number, screenY: number) => Point;
  currentSnap: SnapResult | null;
}
```

---

### Step 2: 提取选择/拖拽逻辑

**文件**: 增强 `src/hooks/useSelectTool.ts`

**依赖**: useSnapSystem

**API**:
```typescript
interface UseSelectToolReturn {
  hoveredElement: SelectableElement | null;
  selectedElements: SelectableElement[];
  isDragging: boolean;
  handleSelectDown: (e: MouseEvent) => void;
  handleSelectMove: (e: MouseEvent) => void;
  handleSelectUp: () => void;
}
```

---

### Step 3: 提取测量工具逻辑

**文件**: `src/hooks/useMeasureTools.ts`

**依赖**: useSnapSystem

**API**:
```typescript
interface UseMeasureToolsReturn {
  handleMeasureDown: (e: MouseEvent) => void;
  handleMeasureMove: (e: MouseEvent) => void;
  handleMeasureUp: () => void;
}
```

---

### Step 4: 提取艺术模式绘制逻辑

**文件**: `src/hooks/useArtisticDrawing.ts`

**依赖**: useSnapSystem

**API**:
```typescript
interface UseArtisticDrawingReturn {
  isDrawing: boolean;
  currentPoints: Point[];
  handleArtisticDown: (e: MouseEvent) => void;
  handleArtisticMove: (e: MouseEvent) => void;
  handleArtisticUp: () => void;
}
```

---

### Step 5: 提取数字模式绘制逻辑

**文件**: `src/hooks/useDigitalDrawing.ts` (已存在，需要增强)

**依赖**: useSnapSystem

**API**:
```typescript
interface UseDigitalDrawingReturn {
  handleDigitalDown: (e: MouseEvent) => void;
  handleDigitalMove: (e: MouseEvent) => void;
  handleDigitalUp: () => void;
}
```

---

## 目标结构

### DrawingCanvas.tsx (目标 <1000 行)

```typescript
export function DrawingCanvas() {
  // 1. Refs (精简到 5 个)
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const commanderRef = useRef<DrawingCommander | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // 2. State (精简到 5 个)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // 3. Store
  const store = useDrawingStore();
  
  // 4. Hooks
  const { applySnap, worldToScreen, screenToWorld, currentSnap } = useSnapSystem();
  const { handleSelectDown, handleSelectMove, handleSelectUp } = useSelectTool({ renderer, commander, applySnap });
  const { handleMeasureDown, handleMeasureMove, handleMeasureUp } = useMeasureTools({ renderer, commander, applySnap });
  const { isDrawing, handleArtisticDown, handleArtisticMove, handleArtisticUp } = useArtisticDrawing({ renderer, commander, applySnap });
  const { handleDigitalDown, handleDigitalMove, handleDigitalUp } = useDigitalDrawing({ renderer, commander, applySnap });
  
  // 5. Renderer initialization
  useEffect(() => {
    // 初始化 renderer 和 commander
  }, [store.renderer]);
  
  // 6. Animation loop
  useEffect(() => {
    const animate = () => {
      if (commanderRef.current) {
        commanderRef.current.render();
      }
      render2DUI(); // 2D canvas UI 层
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }, []);
  
  // 7. Event routing (核心精简点)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (store.activeTool === 'select') handleSelectDown(e);
    else if (store.toolCategory === 'measure') handleMeasureDown(e);
    else if (store.toolCategory === 'artistic') handleArtisticDown(e);
    else if (store.toolCategory === 'digital') handleDigitalDown(e);
    else if (isPanningMode) handlePanDown(e);
  }, [store.activeTool, store.toolCategory, handleSelectDown, handleMeasureDown, handleArtisticDown, handleDigitalDown]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (store.activeTool === 'select') handleSelectMove(e);
    else if (store.toolCategory === 'measure') handleMeasureMove(e);
    else if (store.toolCategory === 'artistic') handleArtisticMove(e);
    else if (store.toolCategory === 'digital') handleDigitalMove(e);
    else if (isPanningMode) handlePanMove(e);
  }, [store.activeTool, store.toolCategory, handleSelectMove, handleMeasureMove, handleArtisticMove, handleDigitalMove]);
  
  const handleMouseUp = useCallback(() => {
    if (store.activeTool === 'select') handleSelectUp();
    else if (store.toolCategory === 'measure') handleMeasureUp();
    else if (store.toolCategory === 'artistic') handleArtisticUp();
    else if (store.toolCategory === 'digital') handleDigitalUp();
    else if (isPanningMode) handlePanUp();
  }, [store.activeTool, store.toolCategory, handleSelectUp, handleMeasureUp, handleArtisticUp, handleDigitalUp]);
  
  // 8. Render
  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} />
    </div>
  );
}
```

---

## 验收标准

- [ ] DrawingCanvas.tsx <1000 行
- [ ] 所有现有功能正常工作
- [ ] TypeScript 编译通过
- [ ] 测试通过
- [ ] 性能无回归

---

**开始时间**: 2026-03-29  
**预计完成**: 2026-04-05 (7 天)
