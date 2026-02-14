import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useDrawingStore } from '../store';
import type { Point, Stroke } from '../types';
import { generateId, distance, smoothStroke } from '../utils';
import { predictShape } from '../shapePredict';
import { DynamicStrokeAnalyzer } from '../strokeAnalysis';

interface CanvasProps {
  onStrokeComplete?: (stroke: Stroke) => void;
}

export const DrawingCanvas: React.FC<CanvasProps> = ({ onStrokeComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const strokeLinesRef = useRef<Map<string, THREE.Group>>(new Map());
  const previewLineRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const xAxisRef = useRef<THREE.Line | null>(null);
  const yAxisRef = useRef<THREE.Line | null>(null);
  const xArrowRef = useRef<THREE.Line | null>(null);
  const yArrowRef = useRef<THREE.Line | null>(null);
  const axisLabelsRef = useRef<THREE.Sprite[]>([]);
  const updateAxisLabelsRef = useRef<((panX: number, panY: number) => void) | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const strokeAnalyzer = useRef<DynamicStrokeAnalyzer>(new DynamicStrokeAnalyzer());

  const store = useDrawingStore();

  // Initialize Three.js scene (single canvas only; avoid double canvas from React Strict Mode)
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    // Remove any existing canvas(es) so we never have two (e.g. from Strict Mode double-mount)
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup with enhanced background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);
    sceneRef.current = scene;

    const updateCameraFrustum = (cam: THREE.OrthographicCamera, w: number, h: number, zoom: number) => {
      const half = 50 / zoom;
      const aspect = w / h;
      const { panX, panY } = useDrawingStore.getState();
      if (aspect >= 1) {
        cam.left = -half * aspect + panX;
        cam.right = half * aspect + panX;
        cam.top = half + panY;
        cam.bottom = -half + panY;
      } else {
        cam.left = -half + panX;
        cam.right = half + panX;
        cam.top = half / aspect + panY;
        cam.bottom = -half / aspect + panY;
      }
      cam.updateProjectionMatrix();
    };

    // Camera setup (orthographic for 2D) — frustum set by updateCameraFrustum so aspect is correct (circle stays circle)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    updateCameraFrustum(camera, width, height, useDrawingStore.getState().zoom);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create number sprite for axis labels
    const createNumberSprite = (num: number, color: string): THREE.Sprite => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.font = 'bold 32px Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num.toString(), size / 2, size / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(3, 3, 1);
      return sprite;
    };

    // Update axis labels based on current viewport
    const updateAxisLabels = (panX: number, panY: number) => {
      const currentScene = sceneRef.current;
      const currentContainer = containerRef.current;
      if (!currentScene || !currentContainer) return;
      
      // Remove old labels
      axisLabelsRef.current.forEach(label => {
        currentScene.remove(label);
        label.material.dispose();
        if (label.material.map) (label.material.map as THREE.Texture).dispose();
      });
      axisLabelsRef.current = [];

      // Calculate visible range based on zoom
      const halfWidth = 50 / store.zoom;
      const halfHeight = halfWidth * (currentContainer.clientHeight / currentContainer.clientWidth);
      
      // Determine label interval based on zoom level
      let interval = 10;
      if (store.zoom < 0.3) interval = 50;
      else if (store.zoom < 0.6) interval = 20;
      else if (store.zoom > 2) interval = 5;

      // Add X-axis labels for visible range
      const startX = Math.floor((panX - halfWidth) / interval) * interval;
      const endX = Math.ceil((panX + halfWidth) / interval) * interval;
      
      for (let i = startX; i <= endX; i += interval) {
        if (i === 0) continue;
        const sprite = createNumberSprite(i, '#cc0000');
        sprite.position.set(i, -4, 0);
        currentScene.add(sprite);
        axisLabelsRef.current.push(sprite);
      }

      // Add Y-axis labels for visible range
      const startY = Math.floor((panY - halfHeight) / interval) * interval;
      const endY = Math.ceil((panY + halfHeight) / interval) * interval;
      
      for (let i = startY; i <= endY; i += interval) {
        if (i === 0) continue;
        const sprite = createNumberSprite(i, '#00aa00');
        sprite.position.set(-4, i, 0);
        currentScene.add(sprite);
        axisLabelsRef.current.push(sprite);
      }

      // Add origin label
      const originSprite = createNumberSprite(0, '#000000');
      originSprite.position.set(-4, -4, 0);
      currentScene.add(originSprite);
      axisLabelsRef.current.push(originSprite);
    };

    // Store update function ref for use in handlers
    updateAxisLabelsRef.current = updateAxisLabels;

    // Initial axis labels
    updateAxisLabels(0, 0);

    // Add grid and axes (fixed at world origin, not moving with pan)
    const addGridAndAxes = (scene: THREE.Scene) => {
      // Large grid for infinite-like effect
      const gridSize = 2000;
      const gridDivisions = 200;
      const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xdddddd, 0xf0f0f0);
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.position.z = -1;
      scene.add(gridHelper);
      gridRef.current = gridHelper;

      // X-axis (red) - extends far
      const xAxisLength = 1000;
      const xGeometry = new THREE.BufferGeometry();
      xGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([-xAxisLength, 0, 0, xAxisLength, 0, 0]), 3)
      );
      const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
      const xAxis = new THREE.Line(xGeometry, xMaterial);
      scene.add(xAxis);
      xAxisRef.current = xAxis;

      // X-axis arrow
      const xArrowGeometry = new THREE.BufferGeometry();
      xArrowGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([xAxisLength - 5, -2, 0, xAxisLength, 0, 0, xAxisLength - 5, 2, 0]), 3)
      );
      const xArrow = new THREE.Line(xArrowGeometry, xMaterial);
      scene.add(xArrow);
      xArrowRef.current = xArrow;

      // Y-axis (green) - extends far
      const yGeometry = new THREE.BufferGeometry();
      yGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, -xAxisLength, 0, 0, xAxisLength, 0]), 3)
      );
      const yMaterial = new THREE.LineBasicMaterial({ color: 0x00aa00, linewidth: 2 });
      const yAxis = new THREE.Line(yGeometry, yMaterial);
      scene.add(yAxis);
      yAxisRef.current = yAxis;

      // Y-axis arrow
      const yArrowGeometry = new THREE.BufferGeometry();
      yArrowGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([-2, xAxisLength - 5, 0, 0, xAxisLength, 0, 2, xAxisLength - 5, 0]), 3)
      );
      const yArrow = new THREE.Line(yArrowGeometry, yMaterial);
      scene.add(yArrow);
      yArrowRef.current = yArrow;

      // Initial axis labels
      updateAxisLabels(0, 0);
    };

    addGridAndAxes(scene);

    // Add lighting for 3D strokes
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // DEBUG: Add a small red sphere at origin to verify rendering
    const testGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const testMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const testSphere = new THREE.Mesh(testGeometry, testMaterial);
    testSphere.position.set(0, 0, 0);
    scene.add(testSphere);

    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize — update size and camera frustum so grid/canvas refresh correctly
    const handleResize = () => {
      const w = containerRef.current?.clientWidth ?? width;
      const h = containerRef.current?.clientHeight ?? height;
      renderer.setSize(w, h);
      updateCameraFrustum(camera, w, h, useDrawingStore.getState().zoom);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      console.log('Cleaning up Three.js scene');
      window.removeEventListener('resize', handleResize);
      const canvas = renderer.domElement;
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      renderer.dispose();
    };
  }, []);  // Empty dependency array - only initialize once

  // Create tube geometry only (for updating existing mesh in place — avoids flicker)
  const createTubeGeometryFromPoints = (
    points: Point[],
    radius: number,
    z = 0.1
  ): THREE.TubeGeometry | null => {
    if (points.length < 2) return null;
    
    // Create a curve that uses ALL our points directly, no Three.js smoothing
    const vecs = points.map((p) => new THREE.Vector3(p.x, p.y, z));
    const curve = new THREE.CatmullRomCurve3(vecs, false, 'chordal', 0.0); // chordal type preserves point distribution
    
    // Use as many segments as points to capture all our smoothness
    const tubularSegments = Math.min(points.length - 1, 1024); // Higher cap for ultra-smooth
    const radialSegments = 32; // Even higher for maximum smoothness
    
    console.log(`Creating tube with ${tubularSegments} segments from ${points.length} points`);
    
    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments);
  };



  // Create a single continuous tube mesh from points (no segments/dots — one smooth line)
  const createTubeFromPoints = useCallback((
    points: Point[],
    radius: number,
    color: number,
    opacity = 1,
    z = 0.1
  ): THREE.Mesh | null => {
    const geometry = createTubeGeometryFromPoints(points, radius, z);
    if (!geometry) return null;
    const material = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
    });
    return new THREE.Mesh(geometry, material);
  }, []);

  



  // Render finalized strokes as single continuous tubes (smoothed points, no segments/dots)
  useEffect(() => {
    if (!sceneRef.current) return;

    strokeLinesRef.current.forEach((group) => {
      sceneRef.current?.remove(group);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    });
    strokeLinesRef.current.clear();

    store.strokes.forEach((stroke) => {
      const points =
        stroke.displayPoints ??
        (stroke.smoothedPoints.length >= 2 ? stroke.smoothedPoints : stroke.points);
      
      console.log(`Rendering stroke: using ${points.length} points (displayPoints: ${stroke.displayPoints?.length}, smoothedPoints: ${stroke.smoothedPoints.length}, original: ${stroke.points.length})`);
      
      if (points.length < 2) return;

      let colorNum = parseInt(stroke.color.replace('#', ''), 16);
      if (colorNum === 0) colorNum = 0x222222;
      // Convert thickness to much smaller radius for proper visual scaling
      // 2px thickness -> 0.1 radius, scaled down significantly
      const radius = Math.max(stroke.thickness * 0.05, 0.05);

      // Highlight selected stroke
      const isSelected = stroke.id === selectedStrokeId;
      const finalOpacity = isSelected ? 0.6 : 1.0;
      const finalZ = isSelected ? 0.15 : 0.1; // Raise selected stroke slightly
      
      const mesh = createTubeFromPoints(points, radius, colorNum, finalOpacity, finalZ);
      if (!mesh || !sceneRef.current) return;
      
      // Add selection indicator (glow effect)
      if (isSelected) {
        // const glowRadius = radius + 1.5;
        const glowRadius = Math.max(stroke.thickness * 0.05, 0.05) + 1.5;
        const glowMesh = createTubeFromPoints(points, glowRadius, 0x00ff00, 0.3, 0.16);
        if (glowMesh) {
          const strokeGroup = new THREE.Group();
          strokeGroup.add(glowMesh);
          strokeGroup.add(mesh);
          strokeGroup.userData.strokeId = stroke.id;
          sceneRef.current.add(strokeGroup);
          strokeLinesRef.current.set(stroke.id, strokeGroup);
          return;
        }
      }
      
      const strokeGroup = new THREE.Group();
      strokeGroup.add(mesh);
      strokeGroup.userData.strokeId = stroke.id;
      sceneRef.current.add(strokeGroup);
      strokeLinesRef.current.set(stroke.id, strokeGroup);
    });
  }, [store.strokes, createTubeFromPoints, selectedStrokeId]);

  // Screen to world using current camera frustum (correct after zoom/resize)
  const screenToWorld = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    if (!rect || !cam) return null;
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    const x = cam.left + u * (cam.right - cam.left);
    const y = cam.top - v * (cam.top - cam.bottom);
    return { x, y };
  }, []);

  /**
   * Calculate distance from point to line segment.
   */
  const distanceToSegment = useCallback((point: { x: number; y: number }, segStart: Point, segEnd: Point): number => {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq < 1e-10) {
      return Math.hypot(point.x - segStart.x, point.y - segStart.y);
    }
    
    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projX = segStart.x + t * dx;
    const projY = segStart.y + t * dy;
    
    return Math.hypot(point.x - projX, point.y - projY);
  }, []);

  /**
   * Find which stroke is at the given world position.
   */
  const findStrokeAtPosition = useCallback((world: { x: number; y: number }): string | null => {
    const clickThreshold = 5.0; // Distance threshold for picking strokes
    
    for (const stroke of store.strokes) {
      const points = stroke.displayPoints ?? stroke.smoothedPoints;
      if (points.length < 2) continue;
      
      // Check distance from click point to stroke segments
      for (let i = 0; i < points.length - 1; i++) {
        const dist = distanceToSegment(world, points[i], points[i + 1]);
        if (dist <= clickThreshold) {
          return stroke.id;
        }
      }
    }
    
    return null;
  }, [store.strokes, distanceToSegment]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button - start pan mode
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    
    // Check if clicking on an existing stroke (for pick functionality)
    if (e.shiftKey) {
      const clickedStrokeId = findStrokeAtPosition(world);
      setSelectedStrokeId(clickedStrokeId);
      return;
    }
    
    const timestamp = Date.now();
    setIsDrawing(true);
    setCurrentStrokePoints([world]);
    
    // Reset stroke analyzer for new stroke
    strokeAnalyzer.current.reset();
    strokeAnalyzer.current.addPoint({ ...world, timestamp });
  }, [screenToWorld, findStrokeAtPosition]);

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle panning
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      
      // Calculate new pan position based on delta
      const newPanX = store.panX - dx / store.zoom;
      const newPanY = store.panY + dy / store.zoom;
      
      store.setPan(newPanX, newPanY);
      
      // Update camera frustum to show different part of world
      const cam = cameraRef.current;
      const container = containerRef.current;
      if (cam && container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const half = 50 / store.zoom;
        const aspect = width / height;
        
        if (aspect >= 1) {
          cam.left = -half * aspect + newPanX;
          cam.right = half * aspect + newPanX;
          cam.top = half + newPanY;
          cam.bottom = -half + newPanY;
        } else {
          cam.left = -half + newPanX;
          cam.right = half + newPanX;
          cam.top = half / aspect + newPanY;
          cam.bottom = -half / aspect + newPanY;
        }
        cam.updateProjectionMatrix();
      }
      
      // Update axis labels for new viewport
      if (updateAxisLabelsRef.current) {
        updateAxisLabelsRef.current(newPanX, newPanY);
      }
      
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    if (!isDrawing) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    const x = world.x;
    const y = world.y;

    const lastPoint = currentStrokePoints[currentStrokePoints.length - 1];

    // Only add point if distance is > 0.1cm (capture more points for smoother input)
    if (distance(lastPoint, { x, y }) > 0.1) {
      const newPoints = [...currentStrokePoints, { x, y }];
      setCurrentStrokePoints(newPoints);
      
      // Add point to stroke analyzer for velocity tracking
      strokeAnalyzer.current.addPoint({ x, y, timestamp: Date.now() });

      // Render preview (single continuous tube) - draw preview line while user is drawing
      if (!sceneRef.current) return;

      const colorNum_raw = parseInt(store.currentColor.replace('#', ''), 16);
      const colorNum = colorNum_raw === 0 ? 0x222222 : colorNum_raw;
      // Use same scaling as final strokes
      const thickness = Math.max(store.currentThickness * 0.05, 0.05);
      const newGeometry = createTubeGeometryFromPoints(newPoints, thickness, 0.05);

      if (!newGeometry) return;

      // Update existing preview mesh in place (no remove/re-add) to avoid flicker
      const existing = previewLineRef.current;
      if (existing && existing.children.length > 0) {
        const mesh = existing.children[0] as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = newGeometry;
      } else {
        const material = new THREE.MeshBasicMaterial({
          color: colorNum,
          toneMapped: false,
          transparent: true,
          opacity: 0.7,
        });
        const previewMesh = new THREE.Mesh(newGeometry, material);
        const group = new THREE.Group();
        group.add(previewMesh);
        previewLineRef.current = group;
        sceneRef.current.add(group);
      }
    }
  };

  const handleMouseUp = () => {
    // End pan mode
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    if (!isDrawing) return;

    setIsDrawing(false);

    // Clear preview
    if (previewLineRef.current && sceneRef.current) {
      sceneRef.current.remove(previewLineRef.current);
      previewLineRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      previewLineRef.current = null;
    }

    // Finalize: analyze stroke for velocity-based corners, then smooth and predict shape
    if (currentStrokePoints.length > 1) {
      const rawPoints = currentStrokePoints;
      
      // Analyze stroke for velocity-based corner detection
      const analysis = strokeAnalyzer.current.analyze();
      
      // DETECTION-FIRST: Predict what user intended to draw BEFORE any smoothing
      let pointsForPrediction = rawPoints;
      if (analysis.isMultiline && analysis.corners.length > 0) {
        // Use corner points as key points for shape prediction
        const cornerPoints = analysis.corners.map(idx => rawPoints[idx]);
        // Add start and end points if not already included
        if (!cornerPoints.includes(rawPoints[0])) cornerPoints.unshift(rawPoints[0]);
        if (!cornerPoints.includes(rawPoints[rawPoints.length - 1])) cornerPoints.push(rawPoints[rawPoints.length - 1]);
        pointsForPrediction = cornerPoints;
      }
      
      // RESPECT INDIVIDUAL OPTIONS: Apply detection and smoothing based on user settings
      
      let finalPoints: Point[] = rawPoints; // Default to raw input
      let displayPoints: Point[] | undefined;

      // STEP 1: Apply prediction if enabled
      if (store.predictEnabled) {
        const predicted = predictShape(pointsForPrediction);
        if (predicted) {
          // Shape detected - use predicted points for display
          finalPoints = pointsForPrediction; // Keep original for consistent strokes
          displayPoints = predicted;
        }
      }
      
      // STEP 2: Apply smoothing if enabled AND no shape was detected
      if (store.smoothEnabled && !displayPoints) {
        const beforeLength = finalPoints.length;
        finalPoints = smoothStroke(finalPoints);
        const afterLength = finalPoints.length;
        console.log(`Smoothing applied: ${beforeLength} -> ${afterLength} points`);
        
        // DEBUG: Also create unsmoothed version for comparison
        console.log('Original points (first 5):', rawPoints.slice(0, 5).map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
        console.log('Smoothed points (first 5):', finalPoints.slice(0, 5).map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
      }

      const stroke: Stroke = {
        id: generateId(),
        points: rawPoints,
        smoothedPoints: finalPoints,
        color: store.currentColor,
        thickness: store.currentThickness,
        timestamp: Date.now(),
      };

      // Store the display points if shape was predicted
      if (displayPoints) {
        stroke.displayPoints = displayPoints;
      }

      store.addStroke(stroke);
      onStrokeComplete?.(stroke);
    }

    setCurrentStrokePoints([]);
  };

  // Wheel zoom — native listener with { passive: false } so preventDefault() works (React's onWheel is passive)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = store.zoom + delta;
      store.setZoom(newZoom);
      const cam = cameraRef.current;
      if (cam && containerRef.current) {
        const c = containerRef.current;
        const half = 50 / newZoom;
        const aspect = c.clientWidth / c.clientHeight;
        const { panX, panY } = store;
        if (aspect >= 1) {
          cam.left = -half * aspect + panX;
          cam.right = half * aspect + panX;
          cam.top = half + panY;
          cam.bottom = -half + panY;
        } else {
          cam.left = -half + panX;
          cam.right = half + panX;
          cam.top = half / aspect + panY;
          cam.bottom = -half / aspect + panY;
        }
        cam.updateProjectionMatrix();
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [store]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 'calc(100vh - 60px)',
        cursor: isPanning ? 'grabbing' : 'crosshair',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};
