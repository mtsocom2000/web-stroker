/**
 * ThreeRenderer - Three.js 渲染器
 * 
 * 负责：
 * - 3D 场景管理
 * - OCCT 形状网格化并渲染
 * - 相机控制 (OrbitControls)
 * - 形状选择 (Raycasting)
 * - 工作平面可视化
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { IShape, MeshData, kernel } from '../kernel';
import type { Point3D, Vector3, Shape3DData, Workplane } from '../types3d';
import { generateId } from '../utils';

/**
 * Three.js 渲染器配置
 */
export interface ThreeRendererConfig {
    container: HTMLElement;
    backgroundColor?: number;
    antialias?: boolean;
    pixelRatio?: number;
}

/**
 * 可选中的 3D 对象
 */
export interface SelectableObject {
    id: string;
    mesh: THREE.Mesh | THREE.LineSegments;
    shapeData?: Shape3DData;
}

/**
 * Three.js 渲染器主类
 */
export class ThreeRenderer {
    // Three.js 核心组件
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    
    // 射线检测
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    
    // 对象管理
    private objects: Map<string, SelectableObject> = new Map();
    private workplanes: Map<string, THREE.Group> = new Map();
    
    // 状态
    private container: HTMLElement;
    private animationId: number | null = null;
    private needsUpdate = false;
    
    // 配置
    private config: Required<ThreeRendererConfig>;

    constructor(config: ThreeRendererConfig) {
        this.container = config.container;
        this.config = {
            backgroundColor: config.backgroundColor ?? 0x1a1a1a,
            antialias: config.antialias ?? true,
            pixelRatio: config.pixelRatio ?? window.devicePixelRatio,
            ...config
        };

        // 初始化场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor);

        // 初始化相机
        this.camera = new THREE.PerspectiveCamera(
            60,  // FOV
            this.getAspectRatio(),
            0.1,  // near
            10000  // far
        );
        this.camera.position.set(100, 100, 100);
        this.camera.lookAt(0, 0, 0);

        // 初始化渲染器
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.config.antialias
        });
        this.renderer.setPixelRatio(this.config.pixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.container.appendChild(this.renderer.domElement);

        // 初始化相机控制器
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 10000;

        // 初始化射线检测
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // 添加灯光
        this.setupLights();

        // 添加网格辅助
        this.addHelperGrid();

        // 监听窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 监听鼠标事件
        this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // 开始渲染循环
        this.animate();
    }

    /**
     * 设置灯光
     */
    private setupLights(): void {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // 主方向光
        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(100, 100, 50);
        mainLight.castShadow = true;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 500;
        mainLight.shadow.camera.left = -100;
        mainLight.shadow.camera.right = 100;
        mainLight.shadow.camera.top = 100;
        mainLight.shadow.camera.bottom = -100;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // 补光
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-50, 50, -50);
        this.scene.add(fillLight);
    }

    /**
     * 添加辅助网格
     */
    private addHelperGrid(): void {
        // XY 平面网格
        const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
        this.scene.add(gridHelper);

        // 坐标轴
        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);
    }

    /**
     * 获取宽高比
     */
    private getAspectRatio(): number {
        return this.container.clientWidth / this.container.clientHeight;
    }

    /**
     * 处理窗口大小变化
     */
    private handleResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        
        this.needsUpdate = true;
    }

    /**
     * 处理鼠标按下
     */
    private handleMouseDown(event: MouseEvent): void {
        this.updateMousePosition(event);
        
        const intersects = this.raycast();
        if (intersects.length > 0) {
            const firstHit = intersects[0];
            const objectId = (firstHit.object as any).__objectId;
            
            if (objectId) {
                this.onObjectSelected(objectId);
            }
        }
    }

    /**
     * 处理鼠标移动
     */
    private handleMouseMove(event: MouseEvent): void {
        this.updateMousePosition(event);
        
        const intersects = this.raycast();
        if (intersects.length > 0) {
            const objectId = (intersects[0].object as any).__objectId;
            this.onObjectHovered(objectId);
        } else {
            this.onObjectHovered(null);
        }
    }

    /**
     * 更新鼠标位置
     */
    private updateMousePosition(event: MouseEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /**
     * 射线检测
     */
    private raycast(): THREE.Intersection[] {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const meshes = Array.from(this.objects.values()).map(obj => obj.mesh);
        return this.raycaster.intersectObjects(meshes, true);
    }

    /**
     * 对象选中回调
     */
    private onObjectSelected(objectId: string): void {
        console.log('[ThreeRenderer] Object selected:', objectId);
        // 触发选中事件 (后续可集成事件系统)
        window.dispatchEvent(new CustomEvent('object-selected', { detail: { objectId } }));
    }

    /**
     * 对象悬停回调
     */
    private onObjectHovered(objectId: string | null): void {
        // 触发悬停事件
        window.dispatchEvent(new CustomEvent('object-hovered', { detail: { objectId } }));
    }

    /**
     * 渲染循环
     */
    private animate = (): void => {
        this.animationId = requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };

    /**
     * 从 OCCT 形状创建 Three.js 网格
     */
    createMeshFromShape(shape: IShape, shapeData: Shape3DData): THREE.Group {
        const group = new THREE.Group();
        
        try {
            // 获取 OCCT 内核实例 (需要从外部传入)
            const kernelInstance = (window as any).__kernel__;
            if (!kernelInstance) {
                console.warn('[ThreeRenderer] Kernel not available, skipping tessellation');
                return group;
            }

            // 网格化
            const meshData: MeshData = kernelInstance.tessellate(shape);

            // 创建面网格
            if (meshData.vertices.length > 0) {
                const geometry = new THREE.BufferGeometry();
                
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
                geometry.setIndex(meshData.indices);

                const material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(shapeData.color),
                    metalness: 0.3,
                    roughness: 0.7,
                    side: THREE.DoubleSide
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                (mesh as any).__objectId = shapeData.id;
                
                group.add(mesh);
            }

            // 创建边线网格
            if (meshData.edgeVertices.length > 0) {
                const edgeGeometry = new THREE.BufferGeometry();
                edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.edgeVertices, 3));
                
                const edgeMaterial = new THREE.LineBasicMaterial({
                    color: 0x000000,
                    linewidth: 1
                });

                const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
                (edges as any).__objectId = shapeData.id;
                
                group.add(edges);
            }

            // 存储引用
            shapeData.meshData = {
                vertices: meshData.vertices,
                normals: meshData.normals,
                uvs: meshData.uvs,
                indices: meshData.indices
            };

        } catch (error) {
            console.error('[ThreeRenderer] Failed to create mesh from shape:', error);
        }

        return group;
    }

    /**
     * 添加 3D 形状到场景
     */
    addShape(shapeData: Shape3DData): void {
        try {
            const kernelInstance = (window as any).__kernel__;
            if (!kernelInstance) {
                console.warn('[ThreeRenderer] Kernel not available');
                return;
            }

            // 创建网格
            const group = this.createMeshFromShape(shapeData.shape, shapeData);
            group.position.set(shapeData.position.x, shapeData.position.y, shapeData.position.z);
            
            if (shapeData.rotation) {
                group.rotation.set(
                    shapeData.rotation.x ?? 0,
                    shapeData.rotation.y ?? 0,
                    shapeData.rotation.z ?? 0
                );
            }

            // 添加到场景
            this.scene.add(group);
            
            // 存储引用
            const mesh = group.children[0] as THREE.Mesh;
            this.objects.set(shapeData.id, {
                id: shapeData.id,
                mesh: mesh,
                shapeData
            });

            this.needsUpdate = true;
            console.log('[ThreeRenderer] Shape added:', shapeData.id);

        } catch (error) {
            console.error('[ThreeRenderer] Failed to add shape:', error);
        }
    }

    /**
     * 从场景移除形状
     */
    removeShape(shapeId: string): void {
        const obj = this.objects.get(shapeId);
        if (obj) {
            this.scene.remove(obj.mesh.parent);
            obj.mesh.geometry.dispose();
            if (obj.mesh.material instanceof THREE.Material) {
                obj.mesh.material.dispose();
            }
            this.objects.delete(shapeId);
            this.needsUpdate = true;
        }
    }

    /**
     * 添加工作平面
     */
    addWorkplane(workplane: Workplane): void {
        const size = 100;
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });

        const plane = new THREE.Mesh(geometry, material);
        plane.position.set(workplane.origin.x, workplane.origin.y, workplane.origin.z);
        plane.lookAt(
            workplane.origin.x + workplane.normal.x,
            workplane.origin.y + workplane.normal.y,
            workplane.origin.z + workplane.normal.z
        );

        // 添加边框
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const border = new THREE.LineSegments(edges, lineMaterial);
        plane.add(border);

        const group = new THREE.Group();
        group.add(plane);
        this.scene.add(group);
        
        this.workplanes.set(workplane.id, group);
        this.needsUpdate = true;
    }

    /**
     * 移除工作平面
     */
    removeWorkplane(workplaneId: string): void {
        const group = this.workplanes.get(workplaneId);
        if (group) {
            this.scene.remove(group);
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
            this.workplanes.delete(workplaneId);
            this.needsUpdate = true;
        }
    }

    /**
     * 适配视图到内容
     */
    fitToContent(): void {
        if (this.objects.size === 0) return;

        // 计算包围盒
        const box = new THREE.Box3();
        this.objects.forEach(obj => {
            box.expandByObject(obj.mesh);
        });

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // 设置相机位置
        const distance = maxDim * 2;
        this.camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        this.camera.lookAt(center);
        
        this.controls.target.copy(center);
        this.controls.update();
        
        this.needsUpdate = true;
    }

    /**
     * 设置相机位置
     */
    setCameraPosition(position: Point3D, target?: Point3D): void {
        this.camera.position.set(position.x, position.y, position.z);
        if (target) {
            this.camera.lookAt(target.x, target.y, target.z);
            this.controls.target.set(target.x, target.y, target.z);
        }
        this.controls.update();
        this.needsUpdate = true;
    }

    /**
     * 获取场景
     */
    getScene(): THREE.Scene {
        return this.scene;
    }

    /**
     * 获取相机
     */
    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    /**
     * 获取渲染器 DOM 元素
     */
    getDomElement(): HTMLElement {
        return this.renderer.domElement;
    }

    /**
     * 销毁渲染器
     */
    dispose(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
        }

        window.removeEventListener('resize', this.handleResize.bind(this));
        
        this.objects.forEach(obj => {
            obj.mesh.geometry.dispose();
            if (obj.mesh.material instanceof THREE.Material) {
                obj.mesh.material.dispose();
            }
        });
        
        this.workplanes.forEach(group => {
            group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
        });

        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
        
        this.objects.clear();
        this.workplanes.clear();
    }
}

// 导出辅助函数
export function createVector3(x: number, y: number, z: number): Vector3 {
    return { x, y, z };
}

export function createPoint3D(x: number, y: number, z: number): Point3D {
    return { x, y, z };
}
