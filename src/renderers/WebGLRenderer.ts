import * as THREE from 'three';
import type { Point, Stroke } from '../types';
import type { Renderer } from './Renderer';

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

// Track rendered IDs for efficient sync
interface StrokeBatch {
  color: string;
  thickness: number;
  instancedMesh: THREE.InstancedMesh;
  strokeIds: string[];
  matrices: Map<string, THREE.Matrix4[]>;
}

/**
 * WebGL/Three.js implementation of Renderer
 * Uses WebGL for hardware-accelerated rendering
 */
export class WebGLRenderer implements Renderer {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private viewState: ViewState = { zoom: 1, panX: 0, panY: 0 };
  
  // Stroke management
  private strokeMeshes: Map<string, THREE.Mesh[]> = new Map();
  private currentStrokeObject: THREE.Object3D | null = null;
  private renderedArtisticIds: Set<string> = new Set();
  private renderedDigitalIds: Set<string> = new Set();
  private strokeBatches: Map<string, StrokeBatch> = new Map();
  
  // Highlight management
  private highlightObjects: THREE.Object3D[] = [];
  private indicatorObjects: THREE.Object3D[] = [];
  
  // Configuration
  private useInstancing: boolean = true;
  private maxInstancesPerBatch: number = 1000;

  initialize(container: HTMLElement): void {
    this.container = container;
    
    // Create scene
    this.scene = new THREE.Scene();
    // No background - transparent to show 2D canvas underneath
    
    // Create camera
    // Use container height as frustum size for 1:1 world-to-screen mapping at zoom=1
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = container.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    this.camera.position.z = 100;
    
    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Style the canvas
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    
    container.appendChild(canvas);
    this.updateCamera();
  }

  dispose(): void {
    this.clearStrokes();
    
    if (this.renderer && this.container) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
      this.renderer = null;
      this.container = null;
      this.scene = null;
      this.camera = null;
    }
  }

  resize(): void {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;
    // frustumSize based on height for 1:1 mapping at zoom=1
    const frustumSize = height / this.viewState.zoom;
    
    this.camera.left = -frustumSize * aspect / 2 + this.viewState.panX;
    this.camera.right = frustumSize * aspect / 2 + this.viewState.panX;
    this.camera.top = frustumSize / 2 + this.viewState.panY;
    this.camera.bottom = -frustumSize / 2 + this.viewState.panY;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setViewState(zoom: number, panX: number, panY: number): void {
    this.viewState = { zoom, panX, panY };
    this.updateCamera();
  }

  private updateCamera(): void {
    if (!this.camera || !this.container) return;
    
    const aspect = this.container.clientWidth / this.container.clientHeight;
    // frustumSize based on height for 1:1 mapping at zoom=1
    const frustumSize = this.container.clientHeight / this.viewState.zoom;
    
    this.camera.left = -frustumSize * aspect / 2 + this.viewState.panX;
    this.camera.right = frustumSize * aspect / 2 + this.viewState.panX;
    this.camera.top = frustumSize / 2 + this.viewState.panY;
    this.camera.bottom = -frustumSize / 2 + this.viewState.panY;
    this.camera.updateProjectionMatrix();
  }

  worldToScreen(point: Point): { x: number; y: number } {
    if (!this.container) return { x: 0, y: 0 };
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    return {
      x: (point.x - this.viewState.panX) * this.viewState.zoom + width / 2,
      y: height / 2 - (point.y - this.viewState.panY) * this.viewState.zoom
    };
  }

  screenToWorld(x: number, y: number): Point {
    if (!this.container) return { x: 0, y: 0 };
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    return {
      x: (x - width / 2) / this.viewState.zoom + this.viewState.panX,
      y: (height / 2 - y) / this.viewState.zoom + this.viewState.panY
    };
  }

  // Artistic strokes
  addStroke(stroke: Stroke): void {
    if (stroke.strokeType === 'digital') return;
    
    const points = stroke.displayPoints ?? stroke.smoothedPoints ?? stroke.points;
    if (points.length < 2) return;
    
    this.removeStroke(stroke.id);
    
    if (this.useInstancing && points.length <= 100) {
      this.addStrokeToBatch(stroke, points);
    } else {
      const mesh = this.createStrokeMesh(
        points,
        stroke.color,
        stroke.thickness,
        stroke.brushSettings?.opacity ?? 1
      );
      
      if (mesh && this.scene) {
        mesh.userData = { strokeId: stroke.id, useInstancing: false };
        this.strokeMeshes.set(stroke.id, [mesh]);
        this.scene.add(mesh);
      }
    }
  }

  private addStrokeToBatch(stroke: Stroke, points: Point[]): void {
    if (!this.scene) return;
    
    const batchKey = `${stroke.color}-${stroke.thickness}`;
    let batch = this.strokeBatches.get(batchKey);
    
    if (!batch) {
      batch = this.createStrokeBatch(stroke.color, stroke.thickness);
      this.strokeBatches.set(batchKey, batch);
    }
    
    const matrices: THREE.Matrix4[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 0.001) continue;
      
      const matrix = new THREE.Matrix4();
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const angle = Math.atan2(dy, dx);
      
      const position = new THREE.Vector3(midX, midY, 0.1);
      const rotation = new THREE.Euler(0, 0, angle);
      const scale = new THREE.Vector3(dist, stroke.thickness, 1);
      
      matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
      matrices.push(matrix);
    }
    
    if (matrices.length > 0) {
      batch.strokeIds.push(stroke.id);
      batch.matrices.set(stroke.id, matrices);
      this.updateBatchInstances(batch);
    }
  }

  private createStrokeBatch(color: string, thickness: number): StrokeBatch {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    geometry.rotateZ(Math.PI / 2);
    
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide
    });
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxInstancesPerBatch);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    
    if (this.scene) {
      this.scene.add(instancedMesh);
    }
    
    return {
      color,
      thickness,
      instancedMesh,
      strokeIds: [],
      matrices: new Map()
    };
  }

  private updateBatchInstances(batch: StrokeBatch): void {
    const { instancedMesh, matrices } = batch;
    
    let instanceIndex = 0;
    
    for (const [, strokeMatrices] of matrices) {
      for (const matrix of strokeMatrices) {
        if (instanceIndex >= this.maxInstancesPerBatch) break;
        instancedMesh.setMatrixAt(instanceIndex, matrix);
        instanceIndex++;
      }
    }
    
    instancedMesh.count = instanceIndex;
    instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private createStrokeMesh(points: Point[], color: string, thickness: number, opacity: number): THREE.Mesh | null {
    if (points.length < 2 || !this.scene) return null;
    
    const vectors = points.map(p => new THREE.Vector3(p.x, p.y, 0.1));
    const curve = new THREE.CatmullRomCurve3(vectors);
    curve.curveType = 'catmullrom';
    curve.tension = 0.5;
    
    const geometry = new THREE.TubeGeometry(curve, points.length * 2, thickness / 2, 8, false);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: opacity < 1,
      opacity: opacity,
      side: THREE.DoubleSide
    });
    
    return new THREE.Mesh(geometry, material);
  }

  removeStroke(strokeId: string): void {
    // Remove from individual meshes
    const meshes = this.strokeMeshes.get(strokeId);
    if (meshes && this.scene) {
      meshes.forEach(mesh => {
        this.scene!.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      this.strokeMeshes.delete(strokeId);
      return;
    }
    
    // Remove from batches
    for (const [, batch] of this.strokeBatches) {
      if (batch.strokeIds.includes(strokeId)) {
        batch.strokeIds = batch.strokeIds.filter(id => id !== strokeId);
        batch.matrices.delete(strokeId);
        this.updateBatchInstances(batch);
        
        if (batch.strokeIds.length === 0 && this.scene) {
          this.scene.remove(batch.instancedMesh);
          batch.instancedMesh.geometry.dispose();
          (batch.instancedMesh.material as THREE.Material).dispose();
          this.strokeBatches.delete(`${batch.color}-${batch.thickness}`);
        }
        return;
      }
    }
  }

  clearStrokes(): void {
    if (!this.scene) return;
    
    // Clear individual meshes
    this.strokeMeshes.forEach((meshes) => {
      meshes.forEach(mesh => {
        this.scene!.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    });
    this.strokeMeshes.clear();
    this.renderedArtisticIds.clear();
    
    // Clear batches
    for (const [, batch] of this.strokeBatches) {
      this.scene.remove(batch.instancedMesh);
      batch.instancedMesh.geometry.dispose();
      (batch.instancedMesh.material as THREE.Material).dispose();
    }
    this.strokeBatches.clear();
    
    // Clear digital
    const digitalObjects: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj.userData?.type === 'digital') {
        digitalObjects.push(obj);
      }
    });
    digitalObjects.forEach(obj => {
      this.scene!.remove(obj);
    });
    this.renderedDigitalIds.clear();
    
    // Clear current stroke
    if (this.currentStrokeObject) {
      this.scene.remove(this.currentStrokeObject);
      this.currentStrokeObject = null;
    }
  }

  updateCurrentStroke(points: Point[], color: string, _thickness: number, opacity: number): void {
    if (!this.scene) return;
    
    if (points.length < 2) {
      if (this.currentStrokeObject) {
        this.scene.remove(this.currentStrokeObject);
        this.currentStrokeObject = null;
      }
      return;
    }
    
    // Create simple line geometry for performance
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = 0.05;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    if (this.currentStrokeObject) {
      (this.currentStrokeObject as THREE.Line).geometry.dispose();
      (this.currentStrokeObject as THREE.Line).geometry = geometry;
    } else {
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: opacity < 1,
        opacity: opacity
      });
      
      this.currentStrokeObject = new THREE.Line(geometry, material);
      this.scene.add(this.currentStrokeObject);
    }
  }

  finalizeCurrentStroke(_strokeId: string): void {
    this.currentStrokeObject = null;
  }

  // Digital elements
  addDigitalStroke(stroke: Stroke): void {
    if (!this.scene || stroke.strokeType !== 'digital') return;
    
    this.removeDigitalStroke(stroke.id);
    
    const segments = stroke.digitalSegments;
    if (segments && segments.length > 0) {
      segments.forEach(segment => {
        let object: THREE.Object3D | null = null;
        
        switch (segment.type) {
          case 'line':
            object = this.createDigitalLine(segment.points, segment.color, stroke.thickness);
            break;
          case 'arc':
            if (segment.arcData) {
              object = this.createDigitalArc(segment.arcData, segment.color, stroke.thickness);
            }
            break;
          case 'bezier':
            object = this.createDigitalBezier(segment.points, segment.color, stroke.thickness);
            break;
        }
        
        if (object && this.scene) {
          object.userData = { strokeId: stroke.id, type: 'digital' };
          this.scene.add(object);
        }
      });
    }
  }

  private createDigitalLine(points: Point[], color: string, thickness: number): THREE.Object3D | null {
    if (points.length < 2) return null;
    
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, 0.1))
    );
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: thickness
    });
    
    return new THREE.Line(geometry, material);
  }

  private createDigitalArc(arcData: {
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
  }, color: string, thickness: number): THREE.Object3D | null {
    const { center, radius, startAngle, endAngle } = arcData;
    
    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      startAngle, endAngle,
      false,
      0
    );
    
    const points = curve.getPoints(32).map(p => new THREE.Vector3(p.x, p.y, 0.1));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: thickness
    });
    
    return new THREE.Line(geometry, material);
  }

  private createDigitalBezier(points: Point[], color: string, thickness: number): THREE.Object3D | null {
    if (points.length < 4) return null;
    
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(points[0].x, points[0].y, 0.1),
      new THREE.Vector3(points[1].x, points[1].y, 0.1),
      new THREE.Vector3(points[2].x, points[2].y, 0.1),
      new THREE.Vector3(points[3].x, points[3].y, 0.1)
    );
    
    const curvePoints = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: thickness
    });
    
    return new THREE.Line(geometry, material);
  }

  removeDigitalStroke(strokeId: string): void {
    if (!this.scene) return;
    
    const objectsToRemove: THREE.Object3D[] = [];
    
    this.scene.traverse((obj) => {
      if (obj.userData?.strokeId === strokeId && obj.userData?.type === 'digital') {
        objectsToRemove.push(obj);
      }
    });
    
    objectsToRemove.forEach(obj => {
      this.scene!.remove(obj);
    });
  }

  clearDigitalElements(): void {
    if (!this.scene) return;
    
    const digitalObjects: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj.userData?.type === 'digital') {
        digitalObjects.push(obj);
      }
    });
    
    digitalObjects.forEach(obj => {
      this.scene!.remove(obj);
    });
  }

  // Digital previews
  updateDigitalLinePreview(start: Point, end: Point, color: string, _thickness: number): void {
    // thickness parameter reserved for future use
    this.updatePreviewLine([start, end], color, _thickness, 'linePreview');
  }

  updateDigitalPolylinePreview(points: Point[], previewEnd: Point | null, color: string, _thickness: number): void {
    // thickness parameter reserved for future use
    this.clearPreviewByType('polyline');
    
    if (!this.scene || points.length < 1) return;
    
    // Draw completed segments
    for (let i = 0; i < points.length - 1; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(points[i].x, points[i].y, 0.05),
        new THREE.Vector3(points[i + 1].x, points[i + 1].y, 0.05)
      ]);
      
      const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
      const segment = new THREE.Line(geometry, material);
      segment.userData = { isPreview: true, previewId: `polyline-segment-${i}` };
      this.scene.add(segment);
    }
    
    // Draw preview line
    if (previewEnd && points.length > 0) {
      const last = points[points.length - 1];
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(last.x, last.y, 0.05),
        new THREE.Vector3(previewEnd.x, previewEnd.y, 0.05)
      ]);
      
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.6
      });
      
      const preview = new THREE.Line(geometry, material);
      preview.userData = { isPreview: true, previewId: 'polyline-preview' };
      this.scene.add(preview);
    }
  }

  updateDigitalCirclePreview(center: Point, radius: number, color: string, _thickness: number): void {
    // thickness parameter reserved for future use
    if (!this.scene) return;
    
    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      0, 2 * Math.PI,
      false,
      0
    );
    
    const points = curve.getPoints(64);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, 0.05))
    );
    
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
    const circle = new THREE.LineLoop(geometry, material);
    circle.userData = { isPreview: true, previewId: 'circlePreview' };
    this.scene.add(circle);
  }

  updateDigitalArcPreview(center: Point, radius: number, startAngle: number, endAngle: number, color: string, _thickness: number): void {
    // thickness parameter reserved for future use
    this.clearPreviewByType('arc');
    
    if (!this.scene) return;
    
    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      startAngle, endAngle,
      false,
      0
    );
    
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, 0.05))
    );
    
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
    const arc = new THREE.Line(geometry, material);
    arc.userData = { isPreview: true, previewId: 'arcPreview' };
    this.scene.add(arc);
  }

  updateDigitalBezierPreview(points: Point[], color: string, _thickness: number): void {
    // thickness parameter reserved for future use
    if (!this.scene || points.length < 4) return;
    
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(points[0].x, points[0].y, 0.05),
      new THREE.Vector3(points[1].x, points[1].y, 0.05),
      new THREE.Vector3(points[2].x, points[2].y, 0.05),
      new THREE.Vector3(points[3].x, points[3].y, 0.05)
    );
    
    const curvePoints = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
    const bezier = new THREE.Line(geometry, material);
    bezier.userData = { isPreview: true, previewId: 'bezierPreview' };
    this.scene.add(bezier);
  }

  clearDigitalPreviews(): void {
    if (!this.scene) return;
    
    const previewsToRemove = this.scene.children.filter(
      child => child.userData?.isPreview === true
    );
    
    previewsToRemove.forEach(obj => {
      this.scene!.remove(obj);
    });
  }

  private clearPreviewByType(type: string): void {
    if (!this.scene) return;
    
    const previewsToRemove = this.scene.children.filter(
      child => child.userData?.isPreview === true && 
               child.userData?.previewId?.startsWith(type)
    );
    
    previewsToRemove.forEach(obj => {
      this.scene!.remove(obj);
    });
  }

  private updatePreviewLine(points: Point[], color: string, thickness: number, previewId: string): void {
    this.clearPreviewByType(previewId.replace('Preview', ''));
    
    if (!this.scene) return;
    
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, 0.05))
    );
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: thickness
    });
    
    const line = new THREE.Line(geometry, material);
    line.userData = { isPreview: true, previewId };
    this.scene.add(line);
  }

  // Selection/highlight rendering for digital elements
  highlightDigitalLine(points: Point[], color: string, _thickness: number, isHovered: boolean, isSelected: boolean): void {
    if (!this.scene || points.length < 2) return;
    
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(points[0].x, points[0].y, 0.15),
      new THREE.Vector3(points[1].x, points[1].y, 0.15)
    ]);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: isHovered || isSelected ? 2 : 1
    });
    
    const line = new THREE.Line(geometry, material);
    line.userData = { isHighlight: true };
    this.scene.add(line);
    this.highlightObjects.push(line);
  }

  highlightDigitalArc(
    arcData: { center: Point; radius: number; startAngle: number; endAngle: number },
    color: string,
    _thickness: number,
    isHovered: boolean,
    isSelected: boolean
  ): void {
    if (!this.scene) return;
    
    const curve = new THREE.EllipseCurve(
      arcData.center.x, arcData.center.y,
      arcData.radius, arcData.radius,
      arcData.startAngle, arcData.endAngle,
      false,
      0
    );
    
    const points = curve.getPoints(32).map(p => new THREE.Vector3(p.x, p.y, 0.15));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: isHovered || isSelected ? 2 : 1
    });
    
    const arc = new THREE.Line(geometry, material);
    arc.userData = { isHighlight: true };
    this.scene.add(arc);
    this.highlightObjects.push(arc);
  }

  highlightDigitalBezier(points: Point[], color: string, _thickness: number, isHovered: boolean, isSelected: boolean): void {
    if (!this.scene || points.length < 4) return;
    
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(points[0].x, points[0].y, 0.15),
      new THREE.Vector3(points[1].x, points[1].y, 0.15),
      new THREE.Vector3(points[2].x, points[2].y, 0.15),
      new THREE.Vector3(points[3].x, points[3].y, 0.15)
    );
    
    const curvePoints = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: isHovered || isSelected ? 2 : 1
    });
    
    const bezier = new THREE.Line(geometry, material);
    bezier.userData = { isHighlight: true };
    this.scene.add(bezier);
    this.highlightObjects.push(bezier);
  }

  drawEndpointIndicator(point: Point, color: string, size: number): void {
    if (!this.scene) return;
    
    // Create a small circle mesh for the endpoint
    const geometry = new THREE.CircleGeometry(size, 16);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide
    });
    
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(point.x, point.y, 0.2);
    circle.userData = { isIndicator: true };
    this.scene.add(circle);
    this.indicatorObjects.push(circle);
    
    // Add white border
    const borderGeometry = new THREE.RingGeometry(size - 0.5, size + 0.5, 16);
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.position.set(point.x, point.y, 0.21);
    border.userData = { isIndicator: true };
    this.scene.add(border);
    this.indicatorObjects.push(border);
  }

  drawControlPointIndicator(point: Point, color: string, size: number): void {
    if (!this.scene) return;
    
    // Create a square for control point
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide
    });
    
    const square = new THREE.Mesh(geometry, material);
    square.position.set(point.x, point.y, 0.2);
    square.userData = { isIndicator: true };
    this.scene.add(square);
    this.indicatorObjects.push(square);
  }

  drawCrossIndicator(point: Point, color: string, size: number): void {
    if (!this.scene) return;
    
    // Create cross lines
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color)
    });
    
    // Line 1: \
    const geometry1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(point.x - size, point.y - size, 0.2),
      new THREE.Vector3(point.x + size, point.y + size, 0.2)
    ]);
    const line1 = new THREE.Line(geometry1, material);
    line1.userData = { isIndicator: true };
    this.scene.add(line1);
    this.indicatorObjects.push(line1);
    
    // Line 2: /
    const geometry2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(point.x + size, point.y - size, 0.2),
      new THREE.Vector3(point.x - size, point.y + size, 0.2)
    ]);
    const line2 = new THREE.Line(geometry2, material);
    line2.userData = { isIndicator: true };
    this.scene.add(line2);
    this.indicatorObjects.push(line2);
    
    // Center dot
    const dotGeometry = new THREE.CircleGeometry(3, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide
    });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.position.set(point.x, point.y, 0.21);
    dot.userData = { isIndicator: true };
    this.scene.add(dot);
    this.indicatorObjects.push(dot);
  }

  clearHighlights(): void {
    if (!this.scene) return;
    
    // Remove all highlight objects
    this.highlightObjects.forEach(obj => {
      this.scene!.remove(obj);
    });
    this.highlightObjects = [];
    
    // Remove all indicator objects
    this.indicatorObjects.forEach(obj => {
      this.scene!.remove(obj);
    });
    this.indicatorObjects = [];
  }

  // Legacy selection indicators (kept for compatibility)
  drawSelectionIndicator(_point: Point, _color: string, _size: number): void {
    // Use drawEndpointIndicator instead
  }

  drawHoverIndicator(_point: Point, _color: string, _size: number): void {
    // Use drawEndpointIndicator instead
  }

  clearIndicators(): void {
    // Use clearHighlights instead
  }
}
