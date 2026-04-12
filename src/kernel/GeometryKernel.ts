/**
 * GeometryKernel - OpenCascade WASM 封装层
 * 
 * 提供 3D 几何建模核心功能：
 * - 基础形状创建 (Box, Cylinder, Sphere...)
 * - 2D→3D 操作 (Extrude, Revolve, Sweep...)
 * - 布尔运算 (Union, Subtract, Intersect)
 * - 修改操作 (Fillet, Chamfer...)
 */

import type { TopoDS_Shape, ShapeResult, XYZ, XYZLike } from './lib/chili-wasm';

// 懒加载 WASM 模块
let wasmModule: any = null;

async function loadWasm(): Promise<any> {
    if (wasmModule) return wasmModule;
    
    // 动态导入 WASM 模块
    const wasmPath = new URL('./lib/chili-wasm.wasm', import.meta.url).pathname;
    
    // @ts-ignore - WASM 模块加载
    wasmModule = await import('./lib/chili-wasm.js');
    await wasmModule.default({ locateFile: () => wasmPath });
    
    return wasmModule;
}

export interface Result<T, E = string> {
    isOk: boolean;
    value?: T;
    error?: E;
}

function convertShapeResult(result: ShapeResult): Result<IShape> {
    const res: Result<IShape> = {
        isOk: result.isOk,
    };
    
    if (result.isOk) {
        res.value = new OccShape(result.shape);
    } else {
        res.error = result.error;
    }
    
    result.delete();
    return res;
}

/**
 * 3D 几何形状抽象
 */
export interface IShape {
    id: string;
    dispose(): void;
    getShape(): TopoDS_Shape;
}

class OccShape implements IShape {
    readonly id: string;
    
    constructor(private shape: TopoDS_Shape) {
        this.id = `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getShape(): TopoDS_Shape {
        return this.shape;
    }
    
    dispose(): void {
        if (this.shape && !this.shape.isNull()) {
            this.shape.delete();
        }
    }
}

/**
 * 几何内核主类
 */
export class GeometryKernel {
    private initialized = false;
    private wasm: any = null;

    /**
     * 初始化 WASM 模块
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        try {
            this.wasm = await loadWasm();
            this.initialized = true;
            console.log('[GeometryKernel] OCCT WASM initialized');
        } catch (error) {
            console.error('[GeometryKernel] Failed to initialize WASM:', error);
            throw error;
        }
    }

    /**
     * 检查是否已初始化
     */
    ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('GeometryKernel not initialized. Call initialize() first.');
        }
    }

    // ============================================================================
    // 基础形状创建
    // ============================================================================

    /**
     * 创建长方体
     * @param origin 原点
     * @param dx X 方向尺寸
     * @param dy Y 方向尺寸
     * @param dz Z 方向尺寸
     */
    createBox(origin: XYZLike, dx: number, dy: number, dz: number): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const result = this.wasm.ShapeFactory.box(
                {
                    location: origin,
                    direction: { x: 0, y: 0, z: 1 },
                    xDirection: { x: 1, y: 0, z: 0 }
                },
                dx,
                dy,
                dz
            );
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 创建圆柱体
     * @param origin 底面中心
     * @param radius 半径
     * @param height 高度
     */
    createCylinder(origin: XYZLike, radius: number, height: number): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const result = this.wasm.ShapeFactory.cylinder(
                {
                    location: origin,
                    direction: { x: 0, y: 0, z: 1 },
                    xDirection: { x: 1, y: 0, z: 0 }
                },
                radius,
                height
            );
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 创建球体
     * @param center 球心
     * @param radius 半径
     */
    createSphere(center: XYZLike, radius: number): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const result = this.wasm.ShapeFactory.sphere(center, radius);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    // ============================================================================
    // 2D→3D 操作
    // ============================================================================

    /**
     * 拉伸操作
     * @param wire 闭合轮廓
     * @param distance 拉伸距离
     * @param direction 拉伸方向 (可选，默认 Z 轴)
     */
    extrude(wire: any, distance: number, direction?: XYZLike): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const dir = direction ?? { x: 0, y: 0, z: 1 };
            const result = this.wasm.ShapeFactory.extrude(wire, dir, distance);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 旋转操作
     * @param wire 轮廓
     * @param axisStart 旋转轴起点
     * @param axisEnd 旋转轴终点
     * @param angle 旋转角度 (度)
     */
    revolve(wire: any, axisStart: XYZLike, axisEnd: XYZLike, angle: number): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const result = this.wasm.ShapeFactory.revolve(wire, axisStart, axisEnd, angle);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    // ============================================================================
    // 布尔运算
    // ============================================================================

    /**
     * 布尔并集
     * @param shapes 形状数组
     */
    booleanFuse(shapes: IShape[]): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const occShapes = shapes.map(s => (s as OccShape).getShape());
            const result = this.wasm.ShapeFactory.booleanFuse(occShapes);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 布尔差集
     * @param shapeA 被减形状
     * @param shapesB 减去形状数组
     */
    booleanCut(shapeA: IShape, shapesB: IShape[]): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const occShapeA = (shapeA as OccShape).getShape();
            const occShapesB = shapesB.map(s => (s as OccShape).getShape());
            const result = this.wasm.ShapeFactory.booleanCut([occShapeA], occShapesB);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 布尔交集
     * @param shapes 形状数组
     */
    booleanCommon(shapes: IShape[]): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const occShapes = shapes.map(s => (s as OccShape).getShape());
            const result = this.wasm.ShapeFactory.booleanCommon(occShapes);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    // ============================================================================
    // 修改操作
    // ============================================================================

    /**
     * 圆角
     * @param shape 形状
     * @param edgeIndices 边索引数组
     * @param radius 圆角半径
     */
    fillet(shape: IShape, edgeIndices: number[], radius: number): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const occShape = (shape as OccShape).getShape();
            const result = this.wasm.ShapeFactory.fillet(occShape, edgeIndices, radius);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 倒角
     * @param shape 形状
     * @param edgeIndices 边索引数组
     * @param distance 倒角距离
     */
    chamfer(shape: IShape, edgeIndices: number[], distance: number): Result<IShape> {
        this.ensureInitialized();
        
        try {
            const occShape = (shape as OccShape).getShape();
            const result = this.wasm.ShapeFactory.chamfer(occShape, edgeIndices, distance);
            return convertShapeResult(result);
        } catch (error) {
            return { isOk: false, error: String(error) };
        }
    }

    // ============================================================================
    // 网格化 (用于 Three.js 渲染)
    // ============================================================================

    /**
     * 将形状转换为网格数据
     * @param shape 形状
     * @param linearDeflection 线性偏差 (默认 0.001)
     * @param angularDeflection 角度偏差 (默认 0.5)
     */
    tessellate(shape: IShape, linearDeflection = 0.001, angularDeflection = 0.5): MeshData {
        this.ensureInitialized();
        
        try {
            const occShape = (shape as OccShape).getShape();
            const mesher = this.wasm.Mesher.create(occShape, linearDeflection, angularDeflection);
            const meshData = mesher.mesh();
            
            const result: MeshData = {
                vertices: meshData.faceMeshData.position,
                normals: meshData.faceMeshData.normal,
                uvs: meshData.faceMeshData.uv,
                indices: meshData.faceMeshData.index,
                edgeVertices: meshData.edgeMeshData.position,
            };
            
            meshData.delete();
            mesher.delete();
            
            return result;
        } catch (error) {
            throw new Error(`Tessellation failed: ${error}`);
        }
    }
}

/**
 * 网格数据结构
 */
export interface MeshData {
    vertices: number[];      // 顶点坐标 [x1,y1,z1, x2,y2,z2, ...]
    normals: number[];       // 法线 [nx1,ny1,nz1, nx2,ny2,nz2, ...]
    uvs: number[];           // UV 坐标 [u1,v1, u2,v2, ...]
    indices: number[];       // 索引数组
    edgeVertices: number[];  // 边线顶点
}

// 单例实例
const kernelInstance = new GeometryKernel();

export { kernelInstance as kernel };
export { OccShape };
