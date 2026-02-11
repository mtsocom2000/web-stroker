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

  const [isDrawing, setIsDrawing] = useState(false);
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

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Camera setup (orthographic for 2D) — frustum set by updateCameraFrustum so aspect is correct (circle stays circle)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1000);
    camera.position.z = 10;
    cameraRef.current = camera;

    const updateCameraFrustum = (cam: THREE.OrthographicCamera, w: number, h: number, zoom: number) => {
      const half = 50 / zoom;
      const aspect = w / h;
      if (aspect >= 1) {
        cam.left = -half * aspect;
        cam.right = half * aspect;
        cam.top = half;
        cam.bottom = -half;
      } else {
        cam.left = -half;
        cam.right = half;
        cam.top = half / aspect;
        cam.bottom = -half / aspect;
      }
      cam.updateProjectionMatrix();
    };
    updateCameraFrustum(camera, width, height, useDrawingStore.getState().zoom);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add grid and axes
    const addGridAndAxes = (scene: THREE.Scene) => {
      // Grid - GridHelper rotates the grid, we need to use it correctly for our 2D view
      const gridSize = 100;
      const gridDivisions = 100;
      const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xdddddd, 0xf0f0f0);
      // Rotate grid to be in XY plane (default is XZ)
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.position.z = -1;
      scene.add(gridHelper);

      // X-axis (red) - from -50 to 50 with arrows
      const xGeometry = new THREE.BufferGeometry();
      xGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([-50, 0, 0, 50, 0, 0]), 3)
      );
      const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
      const xAxis = new THREE.Line(xGeometry, xMaterial);
      scene.add(xAxis);

      // X-axis arrow (positive direction)
      const xArrowGeometry = new THREE.BufferGeometry();
      xArrowGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([45, -2, 0, 50, 0, 0, 45, 2, 0]), 3)
      );
      const xArrow = new THREE.Line(xArrowGeometry, xMaterial);
      scene.add(xArrow);

      // Y-axis (green) - from -50 to 50 with arrows
      const yGeometry = new THREE.BufferGeometry();
      yGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, -50, 0, 0, 50, 0]), 3)
      );
      const yMaterial = new THREE.LineBasicMaterial({ color: 0x00aa00, linewidth: 2 });
      const yAxis = new THREE.Line(yGeometry, yMaterial);
      scene.add(yAxis);

      // Y-axis arrow (positive direction)
      const yArrowGeometry = new THREE.BufferGeometry();
      yArrowGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([-2, 45, 0, 0, 50, 0, 2, 45, 0]), 3)
      );
      const yArrow = new THREE.Line(yArrowGeometry, yMaterial);
      scene.add(yArrow);
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

  // Alternative: Direct geometry creation that bypasses Three.js curve entirely
  const createDirectCylinderGeometry = (
    points: Point[],
    radius: number,
    z = 0.1
  ): THREE.BufferGeometry | null => {
    if (points.length < 2) return null;

    const radialSegments = 16;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Create vertices for each point as a small cylinder segment
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const angle = (i / (points.length - 1)) * Math.PI * 2;
      
      // Create circle around each point
      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        vertices.push(
          p.x + Math.cos(theta) * radius,
          p.y + Math.sin(theta) * radius,
          z
        );
      }
    }

    // Create indices for triangle strips
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    
    return geometry;
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
        if (aspect >= 1) {
          cam.left = -half * aspect;
          cam.right = half * aspect;
          cam.top = half;
          cam.bottom = -half;
        } else {
          cam.left = -half;
          cam.right = half;
          cam.top = half / aspect;
          cam.bottom = -half / aspect;
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
        cursor: 'crosshair',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};
