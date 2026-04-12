/**
 * ShapeFactory - 几何形状工厂
 * 
 * 基于 Chili3D 的 ShapeFactory 设计，提供高级形状创建 API
 */

import { kernel, type IShape, type Result } from './GeometryKernel';
import type { Point3D, Workplane, Sketch3D } from '../types3d';

/**
 * 形状工厂类
 */
export class ShapeFactory {
    /**
     * 创建长方体
     */
    static box(plane: Workplane, dx: number, dy: number, dz: number): Result<IShape> {
        return kernel.createBox(plane.origin, dx, dy, dz);
    }

    /**
     * 创建圆柱体
     */
    static cylinder(plane: Workplane, radius: number, height: number): Result<IShape> {
        return kernel.createCylinder(plane.origin, radius, height);
    }

    /**
     * 创建球体
     */
    static sphere(center: Point3D, radius: number): Result<IShape> {
        return kernel.createSphere(center, radius);
    }

    /**
     * 创建圆锥体
     */
    static cone(plane: Workplane, radius: number, height: number): Result<IShape> {
        // TODO: 需要 OCCT 支持
        return { isOk: false, error: 'Cone not implemented yet' };
    }

    /**
     * 拉伸操作
     * 
     * @param sketch 2D 草图
     * @param distance 拉伸距离
     * @param taperAngle 拔模角度 (可选)
     */
    static extrude(sketch: Sketch3D, distance: number, taperAngle: number = 0): Result<IShape> {
        try {
            // 确保内核已初始化
            if (!kernel || !(kernel as any).initialized) {
                return { isOk: false, error: 'Kernel not initialized' };
            }

            const wasm = (kernel as any).wasm;
            if (!wasm) {
                return { isOk: false, error: 'WASM module not available' };
            }

            // 1. 将 Sketch3D 转换为 OCCT Wire
            const wire = SketchConverter.sketchToWire(sketch, wasm);
            
            // 2. 确定拉伸方向 (默认 Z 轴)
            const direction = new wasm.gp_Dir(0, 0, 1);
            
            // 3. 创建棱柱
            const prismBuilder = new wasm.BRepPrimAPI_MakePrism(wire, direction.Translated(new wasm.gp_Vec(0, 0, distance)));
            
            if (!prismBuilder.IsDone()) {
                return { isOk: false, error: 'Extrude operation failed' };
            }

            const shape = new OccShape(prismBuilder.Shape());
            return { isOk: true, value: shape };
            
        } catch (error) {
            console.error('[ShapeFactory.extrude] Error:', error);
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 旋转操作
     * 
     * @param sketch 2D 草图
     * @param axisStart 旋转轴起点
     * @param axisEnd 旋转轴终点
     * @param angle 旋转角度 (度)
     */
    static revolve(
        sketch: Sketch3D,
        axisStart: Point3D,
        axisEnd: Point3D,
        angle: number = 360
    ): Result<IShape> {
        try {
            if (!kernel || !(kernel as any).initialized) {
                return { isOk: false, error: 'Kernel not initialized' };
            }

            const wasm = (kernel as any).wasm;
            if (!wasm) {
                return { isOk: false, error: 'WASM module not available' };
            }

            // 1. 将 Sketch3D 转换为 OCCT Wire
            const wire = SketchConverter.sketchToWire(sketch, wasm);
            
            // 2. 创建旋转轴
            const axisStart_pnt = new wasm.gp_Pnt(axisStart.x, axisStart.y, axisStart.z);
            const axisEnd_pnt = new wasm.gp_Pnt(axisEnd.x, axisEnd.y, axisEnd.z);
            const axis = new wasm.gp_Ax1(axisStart_pnt, new wasm.gp_Dir(
                axisEnd.x - axisStart.x,
                axisEnd.y - axisStart.y,
                axisEnd.z - axisStart.z
            ));
            
            // 3. 创建旋转体
            const angleRad = (angle * Math.PI) / 180;
            const revolveBuilder = new wasm.BRepPrimAPI_MakeRevol(wire, axis, angleRad);
            
            if (!revolveBuilder.IsDone()) {
                return { isOk: false, error: 'Revolve operation failed' };
            }

            const shape = new OccShape(revolveBuilder.Shape());
            return { isOk: true, value: shape };
            
        } catch (error) {
            console.error('[ShapeFactory.revolve] Error:', error);
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 扫掠操作
     * 
     * @param sketch 截面草图
     * @param path 路径草图
     */
    static sweep(sketch: Sketch3D, path: Sketch3D): Result<IShape> {
        try {
            if (!kernel || !(kernel as any).initialized) {
                return { isOk: false, error: 'Kernel not initialized' };
            }

            const wasm = (kernel as any).wasm;
            if (!wasm) {
                return { isOk: false, error: 'WASM module not available' };
            }

            // 1. 将截面和路径转换为 OCCT Wire
            const sectionWire = SketchConverter.sketchToWire(sketch, wasm);
            const pathWire = SketchConverter.sketchToWire(path, wasm);
            
            // 2. 创建扫掠体
            const sweepBuilder = new wasm.BRepOffsetAPI_MakePipe(pathWire, sectionWire);
            
            if (!sweepBuilder.IsDone()) {
                return { isOk: false, error: 'Sweep operation failed' };
            }

            const shape = new OccShape(sweepBuilder.Shape());
            return { isOk: true, value: shape };
            
        } catch (error) {
            console.error('[ShapeFactory.sweep] Error:', error);
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 放样操作
     * 
     * @param sketches 多个截面草图 (至少 2 个)
     */
    static loft(sketches: Sketch3D[]): Result<IShape> {
        try {
            if (!kernel || !(kernel as any).initialized) {
                return { isOk: false, error: 'Kernel not initialized' };
            }

            const wasm = (kernel as any).wasm;
            if (!wasm) {
                return { isOk: false, error: 'WASM module not available' };
            }

            if (sketches.length < 2) {
                return { isOk: false, error: 'Loft requires at least 2 sketches' };
            }

            // 1. 将所有截面转换为 OCCT Wire
            const wires: any[] = [];
            for (const sketch of sketches) {
                const wire = SketchConverter.sketchToWire(sketch, wasm);
                wires.push(wire);
            }
            
            // 2. 创建放样体
            const loftBuilder = new wasm.BRepOffsetAPI_ThruSections(false, false);
            
            for (const wire of wires) {
                loftBuilder.AddWire(wire);
            }
            
            loftBuilder.Build();
            
            if (!loftBuilder.IsDone()) {
                return { isOk: false, error: 'Loft operation failed' };
            }

            const shape = new OccShape(loftBuilder.Shape());
            return { isOk: true, value: shape };
            
        } catch (error) {
            console.error('[ShapeFactory.loft] Error:', error);
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 布尔并集
     */
    static fuse(shapeA: IShape, shapeB: IShape): Result<IShape> {
        return kernel.booleanFuse([shapeA, shapeB]);
    }

    /**
     * 布尔差集
     */
    static cut(shapeA: IShape, shapeB: IShape): Result<IShape> {
        return kernel.booleanCut(shapeA, [shapeB]);
    }

    /**
     * 布尔交集
     */
    static common(shapeA: IShape, shapeB: IShape): Result<IShape> {
        return kernel.booleanCommon([shapeA, shapeB]);
    }

    /**
     * 圆角
     */
    static fillet(shape: IShape, edgeIndices: number[], radius: number): Result<IShape> {
        return kernel.fillet(shape, edgeIndices, radius);
    }

    /**
     * 倒角
     */
    static chamfer(shape: IShape, edgeIndices: number[], distance: number): Result<IShape> {
        return kernel.chamfer(shape, edgeIndices, distance);
    }

    /**
     * 抽壳
     * 
     * @param shape 基础形状
     * @param facesToRemove 要移除的面索引数组
     * @param thickness 壳体厚度
     */
    static shell(shape: IShape, facesToRemove: number[], thickness: number): Result<IShape> {
        try {
            if (!kernel || !(kernel as any).initialized) {
                return { isOk: false, error: 'Kernel not initialized' };
            }

            const wasm = (kernel as any).wasm;
            if (!wasm) {
                return { isOk: false, error: 'WASM module not available' };
            }

            const occShape = (shape as OccShape).getShape();
            
            // 创建抽壳构建器
            const shellBuilder = new wasm.BRepOffsetAPI_MakeThickSolid(
                occShape,
                facesToRemove,
                thickness,
                0.001  // 公差
            );
            
            if (!shellBuilder.IsDone()) {
                return { isOk: false, error: 'Shell operation failed' };
            }

            const resultShape = new OccShape(shellBuilder.Shape());
            return { isOk: true, value: resultShape };
            
        } catch (error) {
            console.error('[ShapeFactory.shell] Error:', error);
            return { isOk: false, error: String(error) };
        }
    }

    /**
     * 将 Sketch3D 转换为 OCCT Wire
     * 
     * @internal
     */
    private static sketchToWire(sketch: Sketch3D, wasm: any): any {
        return SketchConverter.sketchToWire(sketch, wasm);
    }

    /**
     * 创建 2D 草图线段
     */
    static createLine(start: Point3D, end: Point3D): Result<any> {
        // TODO: 需要 OCCT 2D 曲线支持
        return { isOk: false, error: 'Line creation not implemented yet' };
    }

    /**
     * 创建 2D 草图圆弧
     */
    static createArc(
        center: Point3D,
        radius: number,
        startAngle: number,
        endAngle: number
    ): Result<any> {
        // TODO: 需要 OCCT 2D 曲线支持
        return { isOk: false, error: 'Arc creation not implemented yet' };
    }

    /**
     * 创建 2D 草图圆
     */
    static createCircle(center: Point3D, radius: number): Result<any> {
        // TODO: 需要 OCCT 2D 曲线支持
        return { isOk: false, error: 'Circle creation not implemented yet' };
    }
}
