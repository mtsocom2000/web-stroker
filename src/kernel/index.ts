/**
 * Kernel 模块导出
 * 
 * 提供几何内核、形状工厂、特征树和草图转换功能
 */

// GeometryKernel - 几何内核封装
export { kernel, GeometryKernel, OccShape } from './GeometryKernel';
export type { IShape, MeshData, Result } from './GeometryKernel';

// ShapeFactory - 形状创建工厂
export { ShapeFactory } from './ShapeFactory';

// FeatureTree - 特征历史树
export { FeatureTree } from './FeatureTree';

// 从 types3d 导出相关类型
export type { Feature, FeatureType } from '../types3d';

// SketchConverter - 草图转换器
export { SketchConverter } from './SketchConverter';
