/**
 * 3D 相关类型定义
 */

import type { IShape } from './kernel';
import type { Point } from './types';

/**
 * 3D 点
 */
export interface Point3D {
    x: number;
    y: number;
    z: number;
}

/**
 * 3D 向量
 */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * 4x4 矩阵 (简化版)
 */
export interface Matrix4 {
    elements: number[];  // 16 个元素，列优先
}

/**
 * 工作平面
 */
export interface Workplane {
    id: string;
    name: string;
    origin: Point3D;
    normal: Vector3;
    xAxis: Vector3;
    yAxis: Vector3;
    
    /**
     * 将 3D 点投影到工作平面 (返回 2D 坐标)
     */
    projectToPlane(point: Point3D): Point;
    
    /**
     * 将 2D 草图点转换到 3D 空间
     */
    liftTo3D(point: Point, z?: number): Point3D;
}

/**
 * 3D 形状类型
 */
export type Shape3DType = 
    | 'box'
    | 'cylinder'
    | 'sphere'
    | 'cone'
    | 'extrusion'
    | 'revolve'
    | 'boolean'
    | 'custom';

/**
 * 3D 形状数据
 */
export interface Shape3DData {
    id: string;
    type: Shape3DType;
    shape: IShape;  // OCCT 形状引用
    position: Point3D;
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    visible: boolean;
    color: string;
    
    // 类型特定参数
    dimensions?: {
        width?: number;
        height?: number;
        depth?: number;
        radius?: number;
        radiusTop?: number;
        angle?: number;
    };
    
    // 父特征 ID (用于特征树)
    featureId?: string;
    
    // 网格缓存 (用于 Three.js 渲染)
    meshData?: {
        vertices: number[];
        normals: number[];
        uvs: number[];
        indices: number[];
    };
}

/**
 * 特征类型
 */
export type FeatureType = 
    | 'sketch'
    | 'extrude'
    | 'revolve'
    | 'sweep'
    | 'loft'
    | 'boolean'
    | 'fillet'
    | 'chamfer'
    | 'shell'
    | 'hole'
    | 'pattern';

/**
 * 特征数据
 */
export interface Feature {
    id: string;
    type: FeatureType;
    name: string;
    parentId: string | null;
    children: string[];
    parameters: Record<string, any>;
    resultShapeId: string | null;
    suppressed: boolean;
    createdAt: number;
    updatedAt: number;
}

/**
 * 草图 (3D 上下文中的 2D 草图)
 */
export interface Sketch3D {
    id: string;
    name: string;
    workplaneId: string;
    segments: SketchSegment3D[];
    constraints: any[];  // 约束定义
    isClosed: boolean;
    featureId?: string;
}

/**
 * 草图段
 */
export type SketchSegment3D = 
    | { type: 'line'; startPoint: Point3D; endPoint: Point3D }
    | { type: 'arc'; center: Point3D; radius: number; startAngle: number; endAngle: number }
    | { type: 'circle'; center: Point3D; radius: number }
    | { type: 'spline'; controlPoints: Point3D[] };

/**
 * 布尔运算类型
 */
export type BooleanOperationType = 'union' | 'subtract' | 'intersect';

/**
 * 布尔运算特征数据
 */
export interface BooleanFeature {
    type: 'boolean';
    operation: BooleanOperationType;
    toolShapes: string[];  // 形状 ID 列表
    targetShape: string;   // 目标形状 ID
}

/**
 * 拉伸特征数据
 */
export interface ExtrudeFeature {
    type: 'extrude';
    sketchId: string;
    distance: number;
    direction: 'one-way' | 'symmetric' | 'two-way';
    taperAngle?: number;
}

/**
 * 旋转特征数据
 */
export interface RevolveFeature {
    type: 'revolve';
    sketchId: string;
    axisStart: Point3D;
    axisEnd: Point3D;
    angle: number;
}
