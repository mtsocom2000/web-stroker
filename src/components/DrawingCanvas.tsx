import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useDrawingStore } from '../store';
import type { Point, Stroke } from '../types';
import { generateId, distance, smoothStroke } from '../utils';
import { predictShape } from '../shapePredict';

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
    addGridAndAxes(scene);

    // Add lighting for 3D strokes
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // DEBUG: Add a test red sphere at origin to verify rendering
    const testGeometry = new THREE.SphereGeometry(2, 16, 16);
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
    const vecs = points.map((p) => new THREE.Vector3(p.x, p.y, z));
    const curve = new THREE.CatmullRomCurve3(vecs);
    const tubularSegments = Math.max(32, Math.min(128, points.length * 4));
    const radialSegments = 12;
    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments);
  };

  // Create a single continuous tube mesh from points (no segments/dots — one smooth line)
  const createTubeFromPoints = (
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
  };

  // Add grid and axes to scene
  const addGridAndAxes = (scene: THREE.Scene) => {
    // Grid - GridHelper rotates the grid, we need to use it correctly for our 2D view
    const gridSize = 100;
    const gridDivisions = 100;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xdddddd, 0xf0f0f0);
    // Rotate grid to be in XY plane (default is XZ)
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1;
    scene.add(gridHelper);

    // X-axis (red) - from -50 to 50
    const xGeometry = new THREE.BufferGeometry();
    xGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-50, 0, 0, 50, 0, 0]), 3)
    );
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    scene.add(xAxis);

    // Y-axis (green) - from -50 to 50
    const yGeometry = new THREE.BufferGeometry();
    yGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, -50, 0, 0, 50, 0]), 3)
    );
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x00aa00, linewidth: 3 });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    scene.add(yAxis);
  };

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
      if (points.length < 2) return;

      let colorNum = parseInt(stroke.color.replace('#', ''), 16);
      if (colorNum === 0) colorNum = 0x222222;
      const radius = Math.max(stroke.thickness / 2, 0.3);

      const mesh = createTubeFromPoints(points, radius, colorNum, 1, 0.1);
      if (!mesh) return;
      const strokeGroup = new THREE.Group();
      strokeGroup.add(mesh);
      strokeGroup.userData.strokeId = stroke.id;
      sceneRef.current.add(strokeGroup);
      strokeLinesRef.current.set(stroke.id, strokeGroup);
    });
  }, [store.strokes]);

  // Screen to world using current camera frustum (correct after zoom/resize)
  const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    if (!rect || !cam) return null;
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    const x = cam.left + u * (cam.right - cam.left);
    const y = cam.top - v * (cam.top - cam.bottom);
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    setIsDrawing(true);
    setCurrentStrokePoints([world]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    const x = world.x;
    const y = world.y;

    const lastPoint = currentStrokePoints[currentStrokePoints.length - 1];

    // Only add point if distance is > 0.5cm
    if (distance(lastPoint, { x, y }) > 0.5) {
      const newPoints = [...currentStrokePoints, { x, y }];
      setCurrentStrokePoints(newPoints);

      // Render preview (single continuous tube) - draw preview line while user is drawing
      if (!sceneRef.current) return;

      const colorNum_raw = parseInt(store.currentColor.replace('#', ''), 16);
      const colorNum = colorNum_raw === 0 ? 0x222222 : colorNum_raw;
      const thickness = Math.max(store.currentThickness / 2, 0.3);
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

    // Finalize: smooth, optionally predict shape, add to store
    if (currentStrokePoints.length > 1) {
      const rawPoints = currentStrokePoints;
      const smoothedPoints = smoothStroke(rawPoints);

      const stroke: Stroke = {
        id: generateId(),
        points: rawPoints,
        smoothedPoints,
        color: store.currentColor,
        thickness: store.currentThickness,
        timestamp: Date.now(),
      };

      if (store.predictEnabled) {
        const predicted = predictShape(smoothedPoints);
        if (predicted) stroke.displayPoints = predicted;
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
