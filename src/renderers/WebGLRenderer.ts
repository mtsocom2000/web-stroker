import * as THREE from 'three';
import type { Point, Stroke } from '../types';
import type { Renderer } from './Renderer';
import type { RenderCommand, Geometry, RenderStyle } from './commands/RenderCommand';
import { worldToScreen as worldToScreenUtil, screenToWorld as screenToWorldUtil } from '../utils/coordinates';
import { VISUAL_THEME } from './RendererConfig';

// Visual constants - unified with Canvas2D
const VISUAL = {
  // Colors
  HOVER_COLOR: '#ff5722',
  SELECT_COLOR: '#2196f3',
  PREVIEW_OPACITY: 0.6,
  
  // Line widths
  HOVER_WIDTH_ADD: 2,
  SELECT_WIDTH_ADD: 3,
  
  // Dashed line pattern [dash, gap] in pixels
  DASH_PATTERN: [6, 4],
  
  // Z-depth layers
  Z_GRID: -1,
  Z_STROKES: 0.1,
  Z_PREVIEWS: 0.05,
  Z_HIGHLIGHTS: 0.15,
  Z_INDICATORS: 0.2,
};

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * WebGL/Three.js implementation of Renderer
 * Implements Renderer interface to execute RenderCommands.
 * Uses WebGL for hardware-accelerated rendering.
 *
 * Key features:
 * 1. Hardware-accelerated rendering via Three.js
 * 2. Instanced rendering for performance
 * 3. Proper z-depth layering
 * 4. Dashed line support via LineDashedMaterial
 */
export class WebGLRenderer implements Renderer {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private viewState: ViewState = { zoom: 1, panX: 0, panY: 0 };
  
  // Object tracking for cleanup
  private strokeObjects: THREE.Object3D[] = [];
  private previewObjects: THREE.Object3D[] = [];
  private highlightObjects: THREE.Object3D[] = [];
  private indicatorObjects: THREE.Object3D[] = [];
  private closedAreaObjects: THREE.Object3D[] = [];
  private labelObjects: THREE.Object3D[] = [];
  private gridObject: THREE.Object3D | null = null;

  initialize(container: HTMLElement): void {
    this.container = container;
    
    // Create scene
    this.scene = new THREE.Scene();
    // No background - transparent to show 2D canvas underneath
    
    // Create camera
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
    this.clearAllObjects();
    
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
    const frustumSize = height / this.viewState.zoom;
    
    this.camera.left = -frustumSize * aspect / 2 + this.viewState.panX;
    this.camera.right = frustumSize * aspect / 2 + this.viewState.panX;
    this.camera.top = frustumSize / 2 + this.viewState.panY;
    this.camera.bottom = -frustumSize / 2 + this.viewState.panY;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  setViewState(zoom: number, panX: number, panY: number): void {
    this.viewState = { zoom, panX, panY };
    this.updateCamera();
  }

  private updateCamera(): void {
    if (!this.camera || !this.container) return;
    
    const aspect = this.container.clientWidth / this.container.clientHeight;
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
    
    return worldToScreenUtil(point, this.viewState, width, height);
  }

  screenToWorld(x: number, y: number): Point {
    if (!this.container) return { x: 0, y: 0 };
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    return screenToWorldUtil(x, y, this.viewState, width, height);
  }

  // ============================================================================
  // Renderer Base Class Implementation
  // ============================================================================

  protected beginFrame(): void {
    // Clear all objects before drawing new frame
    this.clearAllObjects();
  }

  protected endFrame(): void {
    // Nothing special needed - Three.js handles frame end
  }

  public render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Execute a batch of render commands
   */
  executeCommands(commands: RenderCommand[]): void {
    this.beginFrame();
    
    // Sort by zIndex
    const sortedCommands = [...commands].sort((a, b) => a.zIndex - b.zIndex);
    
    for (const command of sortedCommands) {
      this.processCommand(command);
    }
    
    this.endFrame();
    this.render();
  }

  /**
   * Process a single render command
   */
  private processCommand(command: RenderCommand): void {
    switch (command.type) {
      case 'stroke':
        this.drawStroke(command.geometry, command.style);
        break;
      case 'preview':
        this.drawPreview(command.geometry, command.style);
        break;
      case 'highlight':
        this.drawHighlight(command.geometry, command.style);
        break;
      case 'indicator':
        if (command.geometry.type === 'point') {
          this.drawIndicator(command.geometry.point, command.style);
        }
        break;
      case 'label':
        this.drawLabel({
          text: (command as any).text,
          position: command.geometry.type === 'point' ? command.geometry.point : { x: 0, y: 0 },
          style: command.style,
        });
        break;
      case 'closedArea':
        if (command.geometry.type === 'polygon') {
          this.drawClosedArea(command.geometry, command.style);
        }
        break;
    }
  }

  // ============================================================================
  // Low-level Drawing Primitives
  // ============================================================================

  protected drawStroke(geometry: Geometry, style: RenderStyle): void {
    if (!this.scene) return;

    let object: THREE.Object3D | null = null;

    switch (geometry.type) {
      case 'line':
        object = this.createLineObject(geometry.points, style, VISUAL.Z_STROKES);
        break;
      case 'circle':
        object = this.createCircleObject(geometry.center, geometry.radius, style, VISUAL.Z_STROKES);
        break;
      case 'arc':
        object = this.createArcObject(
          geometry.center, geometry.radius, 
          geometry.startAngle, geometry.endAngle, 
          style, VISUAL.Z_STROKES
        );
        break;
      case 'bezier':
        object = this.createBezierObject(geometry.points, style, VISUAL.Z_STROKES);
        break;
    }

    if (object) {
      object.userData = { type: 'stroke' };
      this.scene.add(object);
      this.strokeObjects.push(object);
    }
  }

  protected drawPreview(geometry: Geometry, style: RenderStyle): void {
    if (!this.scene) return;

    let object: THREE.Object3D | null = null;

    switch (geometry.type) {
      case 'line':
        object = this.createDashedLineObject(geometry.points, style, VISUAL.Z_PREVIEWS);
        break;
      case 'circle':
        object = this.createDashedCircleObject(geometry.center, geometry.radius, style, VISUAL.Z_PREVIEWS);
        break;
      case 'arc':
        object = this.createDashedArcObject(
          geometry.center, geometry.radius,
          geometry.startAngle, geometry.endAngle,
          style, VISUAL.Z_PREVIEWS
        );
        break;
      case 'bezier':
        object = this.createDashedBezierObject(geometry.points, style, VISUAL.Z_PREVIEWS);
        break;
    }

    if (object) {
      object.userData = { type: 'preview' };
      this.scene.add(object);
      this.previewObjects.push(object);
    }
  }

  protected drawHighlight(geometry: Geometry, style: RenderStyle): void {
    if (!this.scene) return;

    let object: THREE.Object3D | null = null;

    switch (geometry.type) {
      case 'line':
        object = this.createLineObject(geometry.points, style, VISUAL.Z_HIGHLIGHTS);
        break;
      case 'circle':
        object = this.createCircleObject(geometry.center, geometry.radius, style, VISUAL.Z_HIGHLIGHTS);
        break;
      case 'arc':
        object = this.createArcObject(
          geometry.center, geometry.radius,
          geometry.startAngle, geometry.endAngle,
          style, VISUAL.Z_HIGHLIGHTS
        );
        break;
      case 'bezier':
        object = this.createBezierObject(geometry.points, style, VISUAL.Z_HIGHLIGHTS);
        break;
    }

    if (object) {
      object.userData = { type: 'highlight' };
      this.scene.add(object);
      this.highlightObjects.push(object);
    }
  }

  protected drawIndicator(point: Point, style: RenderStyle): void {
    if (!this.scene) return;

    const size = style.size || VISUAL_THEME.ENDPOINT_SIZE;

    // Create a small circle mesh for the endpoint
    const geometry = new THREE.CircleGeometry(size, 16);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.color),
      side: THREE.DoubleSide
    });
    
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(point.x, point.y, VISUAL.Z_INDICATORS);
    circle.userData = { type: 'indicator' };
    this.scene.add(circle);
    this.indicatorObjects.push(circle);
    
    // Add white border
    const borderGeometry = new THREE.RingGeometry(size - 0.5, size + 0.5, 16);
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.position.set(point.x, point.y, VISUAL.Z_INDICATORS + 0.001);
    border.userData = { type: 'indicator' };
    this.scene.add(border);
    this.indicatorObjects.push(border);
  }

  protected drawClosedArea(geometry: Extract<Geometry, { type: 'polygon' }>, style: RenderStyle): void {
    if (!this.scene || geometry.points.length < 3) return;

    // Create a filled polygon using ShapeGeometry
    const shape = new THREE.Shape();
    shape.moveTo(geometry.points[0].x, geometry.points[0].y);
    
    for (let i = 1; i < geometry.points.length; i++) {
      shape.lineTo(geometry.points[i].x, geometry.points[i].y);
    }
    shape.closePath();

    const shapeGeometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.color),
      transparent: true,
      opacity: style.opacity,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(shapeGeometry, material);
    mesh.position.z = -5; // Below strokes
    mesh.userData = { type: 'closedArea' };
    this.scene.add(mesh);
    this.closedAreaObjects.push(mesh);
  }

  /**
   * Draw text label using Sprite + CanvasTexture
   */
  protected drawLabel(label: { text: string; position: Point; style: RenderStyle }): void {
    if (!this.scene) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const fontSize = (label.style.lineWidth || 1) * 12;
    ctx.font = `${fontSize}px sans-serif`;
    const metrics = ctx.measureText(label.text);
    const padding = 4;
    canvas.width = Math.ceil(metrics.width) + padding * 2;
    canvas.height = Math.ceil(fontSize * 1.5) + padding * 2;

    // Clear and draw text
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = label.style.color || '#000000';
    ctx.fillText(label.text, canvas.width / 2, canvas.height / 2);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    // Position and scale
    sprite.position.set(label.position.x, label.position.y, VISUAL.Z_INDICATORS + 0.01);
    sprite.scale.set(canvas.width * 0.15, canvas.height * 0.15, 1);

    this.scene.add(sprite);
    this.labelObjects.push(sprite);
  }

  /**
   * Draw grid
   */
  drawGrid(zoom: number, panX: number, panY: number): void {
    if (!this.scene || !this.container) return;

    // Remove old grid
    if (this.gridObject) {
      this.scene.remove(this.gridObject);
      this.gridObject = null;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const majorSpacing = 100; // Major grid line spacing in world units
    const minorSpacing = 20;  // Minor grid line spacing

    const group = new THREE.Group();

    // Calculate visible world bounds
    const halfWidth = (width / 2) / zoom;
    const halfHeight = (height / 2) / zoom;
    const minX = panX - halfWidth;
    const maxX = panX + halfWidth;
    const minY = panY - halfHeight;
    const maxY = panY + halfHeight;

    // Create grid lines
    const startX = Math.floor(minX / minorSpacing) * minorSpacing;
    const endX = Math.ceil(maxX / minorSpacing) * minorSpacing;
    const startY = Math.floor(minY / minorSpacing) * minorSpacing;
    const endY = Math.ceil(maxY / minorSpacing) * minorSpacing;

    const gridPoints: THREE.Vector3[] = [];

    // Vertical lines
    for (let x = startX; x <= endX; x += minorSpacing) {
      const isMajor = Math.abs(x % majorSpacing) < 0.01;
      const z = isMajor ? VISUAL.Z_GRID + 0.001 : VISUAL.Z_GRID;
      
      gridPoints.push(
        new THREE.Vector3(x, minY, z),
        new THREE.Vector3(x, maxY, z)
      );
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += minorSpacing) {
      const isMajor = Math.abs(y % majorSpacing) < 0.01;
      const z = isMajor ? VISUAL.Z_GRID + 0.001 : VISUAL.Z_GRID;
      
      gridPoints.push(
        new THREE.Vector3(minX, y, z),
        new THREE.Vector3(maxX, y, z)
      );
    }

    // Create geometry for all lines
    if (gridPoints.length > 0) {
      const geometry = new THREE.BufferGeometry().setFromPoints(gridPoints);
      const material = new THREE.LineBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.5
      });
      const lines = new THREE.LineSegments(geometry, material);
      group.add(lines);
    }

    // Draw axes
    const axisPoints = [
      new THREE.Vector3(minX, 0, VISUAL.Z_GRID + 0.002),
      new THREE.Vector3(maxX, 0, VISUAL.Z_GRID + 0.002),
      new THREE.Vector3(0, minY, VISUAL.Z_GRID + 0.002),
      new THREE.Vector3(0, maxY, VISUAL.Z_GRID + 0.002)
    ];
    const axisGeometry = new THREE.BufferGeometry().setFromPoints(axisPoints);
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });
    const axes = new THREE.LineSegments(axisGeometry, axisMaterial);
    group.add(axes);

    this.scene.add(group);
    this.gridObject = group;
  }

  // ============================================================================
  // Geometry Creation Helpers
  // ============================================================================

  private createLineObject(points: Point[], style: RenderStyle, z: number): THREE.Object3D | null {
    if (!this.scene || points.length < 2) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(points[0].x, points[0].y, z),
      new THREE.Vector3(points[1].x, points[1].y, z)
    ]);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      transparent: style.opacity < 1,
      opacity: style.opacity
    });
    
    return new THREE.Line(geometry, material);
  }

  private createCircleObject(center: Point, radius: number, style: RenderStyle, z: number): THREE.Object3D | null {
    if (!this.scene) return null;

    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      0, 2 * Math.PI,
      false,
      0
    );
    
    const points = curve.getPoints(64);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, z))
    );
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      transparent: style.opacity < 1,
      opacity: style.opacity
    });
    
    return new THREE.LineLoop(geometry, material);
  }

  private createArcObject(
    center: Point, radius: number, startAngle: number, endAngle: number,
    style: RenderStyle, z: number
  ): THREE.Object3D | null {
    if (!this.scene) return null;

    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      startAngle, endAngle,
      false,
      0
    );
    
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, z))
    );
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      transparent: style.opacity < 1,
      opacity: style.opacity
    });
    
    return new THREE.Line(geometry, material);
  }

  private createBezierObject(points: Point[], style: RenderStyle, z: number): THREE.Object3D | null {
    if (!this.scene || points.length < 4) return null;

    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(points[0].x, points[0].y, z),
      new THREE.Vector3(points[1].x, points[1].y, z),
      new THREE.Vector3(points[2].x, points[2].y, z),
      new THREE.Vector3(points[3].x, points[3].y, z)
    );
    
    const curvePoints = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      transparent: style.opacity < 1,
      opacity: style.opacity
    });
    
    return new THREE.Line(geometry, material);
  }

  // ============================================================================
  // Dashed Geometry Creation (for previews)
  // ============================================================================

  private createDashedLineObject(points: Point[], style: RenderStyle, z: number): THREE.Object3D | null {
    if (!this.scene || points.length < 2) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(points[0].x, points[0].y, z),
      new THREE.Vector3(points[1].x, points[1].y, z)
    ]);
    
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      scale: 1,
      dashSize: VISUAL_THEME.DASH_PATTERN[0],
      gapSize: VISUAL_THEME.DASH_PATTERN[1],
      opacity: style.opacity,
      transparent: true,
    });
    
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }

  private createDashedCircleObject(center: Point, radius: number, style: RenderStyle, z: number): THREE.Object3D | null {
    if (!this.scene) return null;

    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      0, 2 * Math.PI,
      false,
      0
    );
    
    const points = curve.getPoints(64);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, z))
    );
    
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      scale: 1,
      dashSize: VISUAL_THEME.DASH_PATTERN[0],
      gapSize: VISUAL_THEME.DASH_PATTERN[1],
      opacity: style.opacity,
      transparent: true,
    });
    
    const circle = new THREE.LineLoop(geometry, material);
    circle.computeLineDistances();
    return circle;
  }

  private createDashedArcObject(
    center: Point, radius: number, startAngle: number, endAngle: number,
    style: RenderStyle, z: number
  ): THREE.Object3D | null {
    if (!this.scene) return null;

    const curve = new THREE.EllipseCurve(
      center.x, center.y,
      radius, radius,
      startAngle, endAngle,
      false,
      0
    );
    
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y, z))
    );
    
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      scale: 1,
      dashSize: VISUAL_THEME.DASH_PATTERN[0],
      gapSize: VISUAL_THEME.DASH_PATTERN[1],
      opacity: style.opacity,
      transparent: true,
    });
    
    const arc = new THREE.Line(geometry, material);
    arc.computeLineDistances();
    return arc;
  }

  private createDashedBezierObject(points: Point[], style: RenderStyle, z: number): THREE.Object3D | null {
    if (!this.scene || points.length < 4) return null;

    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(points[0].x, points[0].y, z),
      new THREE.Vector3(points[1].x, points[1].y, z),
      new THREE.Vector3(points[2].x, points[2].y, z),
      new THREE.Vector3(points[3].x, points[3].y, z)
    );
    
    const curvePoints = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(style.color),
      linewidth: style.lineWidth,
      scale: 1,
      dashSize: VISUAL_THEME.DASH_PATTERN[0],
      gapSize: VISUAL_THEME.DASH_PATTERN[1],
      opacity: style.opacity,
      transparent: true,
    });
    
    const bezier = new THREE.Line(geometry, material);
    bezier.computeLineDistances();
    return bezier;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private clearAllObjects(): void {
    this.clearObjectList(this.strokeObjects);
    this.clearObjectList(this.previewObjects);
    this.clearObjectList(this.highlightObjects);
    this.clearObjectList(this.indicatorObjects);
    this.clearObjectList(this.closedAreaObjects);
    this.clearObjectList(this.labelObjects);
    if (this.gridObject) {
      this.scene?.remove(this.gridObject);
      this.gridObject = null;
    }
  }

  private clearObjectList(objects: THREE.Object3D[]): void {
    if (!this.scene) return;
    
    objects.forEach(obj => {
      this.scene!.remove(obj);
      // Dispose geometry and material
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    
    objects.length = 0;
  }

  // ============================================================================
  // Legacy API (for backward compatibility during migration)
  // All methods below are deprecated and will be removed.
  // Use executeCommands() instead.
  // ============================================================================

  /**
   * @deprecated Use executeCommands instead
   */
  invalidate(): void {
    // No-op for WebGL - it renders immediately
  }

  // ============================================================================
  // Legacy API - Stub implementations for backward compatibility
  // These methods are deprecated and will be removed after migration
  // ============================================================================

  addStroke(_stroke: Stroke): void {
    // Legacy API - not used in new architecture
  }

  removeStroke(_strokeId: string): void {
    // Legacy API - not used in new architecture
  }

  clearStrokes(): void {
    // Legacy API - not used in new architecture
  }

  updateCurrentStroke(_points: Point[], _color: string, _thickness: number, _opacity: number): void {
    // Legacy API - not used in new architecture
  }

  finalizeCurrentStroke(_strokeId: string): void {
    // Legacy API - not used in new architecture
  }

  addDigitalStroke(_stroke: Stroke): void {
    // Legacy API - not used in new architecture
  }

  removeDigitalStroke(_strokeId: string): void {
    // Legacy API - not used in new architecture
  }

  clearDigitalElements(): void {
    // Legacy API - not used in new architecture
  }

  updateDigitalLinePreview(_start: Point, _end: Point, _color: string, _thickness: number): void {
    // Legacy API - not used in new architecture
  }

  updateDigitalPolylinePreview(_points: Point[], _previewEnd: Point | null, _color: string, _thickness: number): void {
    // Legacy API - not used in new architecture
  }

  updateDigitalCirclePreview(_center: Point, _radius: number, _color: string, _thickness: number): void {
    // Legacy API - not used in new architecture
  }

  updateDigitalArcPreview(_center: Point, _radius: number, _startAngle: number, _endAngle: number, _color: string, _thickness: number): void {
    // Legacy API - not used in new architecture
  }

  updateDigitalBezierPreview(_points: Point[], _color: string, _thickness: number): void {
    // Legacy API - not used in new architecture
  }

  clearDigitalPreviews(): void {
    // Legacy API - not used in new architecture
  }

  highlightDigitalLine(_points: Point[], _color: string, _thickness: number, _isHovered: boolean, _isSelected: boolean): void {
    // Legacy API - not used in new architecture
  }

  highlightDigitalArc(_arcData: { center: Point; radius: number; startAngle: number; endAngle: number }, _color: string, _thickness: number, _isHovered: boolean, _isSelected: boolean): void {
    // Legacy API - not used in new architecture
  }

  highlightDigitalBezier(_points: Point[], _color: string, _thickness: number, _isHovered: boolean, _isSelected: boolean): void {
    // Legacy API - not used in new architecture
  }

  drawEndpointIndicator(_point: Point, _color: string, _size: number): void {
    // Legacy API - not used in new architecture
  }

  drawControlPointIndicator(_point: Point, _color: string, _size: number): void {
    // Legacy API - not used in new architecture
  }

  drawCrossIndicator(_point: Point, _color: string, _size: number): void {
    // Legacy API - not used in new architecture
  }

  clearHighlights(): void {
    // Legacy API - not used in new architecture
  }
}
