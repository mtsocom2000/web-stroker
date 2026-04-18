/**
 * SketchConverter - 草图转换器
 * 
 * 负责 2D 草图与 OCCT 几何之间的转换:
 * - Sketch3D → OCCT Wire
 * - OCCT Wire → Sketch3D
 */

import type { Sketch3D, SketchSegment3D, Point3D } from '../types3d';
import type { Point } from '../types';

/**
 * 草图转换器类
 */
export class SketchConverter {
    /**
     * 将 Sketch3D 转换为 OCCT Wire
     * 
     * @param sketch 输入草图
     * @param wasm OCCT WASM 模块实例
     * @returns OCCT Wire 对象
     */
    static sketchToWire(sketch: Sketch3D, wasm: any): any {
        try {
            // 1. 创建边集合
            const edges: any[] = [];

            for (const segment of sketch.segments) {
                const edge = this.segmentToEdge(segment, wasm);
                if (edge) {
                    edges.push(edge);
                }
            }

            // 2. 组合成 Wire
            if (edges.length === 0) {
                throw new Error('No valid segments in sketch');
            }

            // 使用 OCCT 的 Wire 构建 API
            const wireBuilder = new wasm.BRepBuilderAPI_MakeWire();
            
            for (const edge of edges) {
                wireBuilder.Add(edge);
            }

            if (!wireBuilder.IsDone()) {
                throw new Error('Failed to build wire');
            }

            return wireBuilder.Wire();

        } catch (error) {
            console.error('[SketchConverter] sketchToWire failed:', error);
            throw error;
        }
    }

    /**
     * 将草图段转换为 OCCT 边
     */
    private static segmentToEdge(segment: SketchSegment3D, wasm: any): any {
        try {
            switch (segment.type) {
                case 'line':
                    return this.lineToEdge(segment, wasm);
                case 'arc':
                    return this.arcToEdge(segment, wasm);
                case 'circle':
                    return this.circleToEdge(segment, wasm);
                case 'spline':
                    return this.splineToEdge(segment, wasm);
                default:
                    console.warn('[SketchConverter] Unknown segment type:', segment.type);
                    return null;
            }
        } catch (error) {
            console.error('[SketchConverter] segmentToEdge failed:', error);
            return null;
        }
    }

    /**
     * 线段 → OCCT 边
     */
    private static lineToEdge(segment: { type: 'line'; startPoint: Point3D; endPoint: Point3D }, wasm: any): any {
        const p1 = new wasm.gp_Pnt(segment.startPoint.x, segment.startPoint.y, segment.startPoint.z);
        const p2 = new wasm.gp_Pnt(segment.endPoint.x, segment.endPoint.y, segment.endPoint.z);
        
        const line = new wasm.GC_MakeSegment(p1, p2);
        if (!line.IsDone()) {
            throw new Error('Failed to create line');
        }

        const edge = new wasm.BRepBuilderAPI_MakeEdge(line.Value());
        if (!edge.IsDone()) {
            throw new Error('Failed to create edge from line');
        }

        return edge.Edge();
    }

    /**
     * 圆弧 → OCCT 边
     */
    private static arcToEdge(segment: { type: 'arc'; center: Point3D; radius: number; startAngle: number; endAngle: number }, wasm: any): any {
        // 创建圆弧的平面
        const plane = new wasm.gp_Pln(
            new wasm.gp_Pnt(segment.center.x, segment.center.y, segment.center.z),
            new wasm.gp_Dir(0, 0, 1)
        );

        // 创建圆
        const circle = new wasm.gp_Circ(plane, segment.radius);

        // 计算起点和终点
        const startPoint = new wasm.gp_Pnt(
            segment.center.x + segment.radius * Math.cos(segment.startAngle),
            segment.center.y + segment.radius * Math.sin(segment.startAngle),
            segment.center.z
        );

        const endPoint = new wasm.gp_Pnt(
            segment.center.x + segment.radius * Math.cos(segment.endAngle),
            segment.center.y + segment.radius * Math.sin(segment.endAngle),
            segment.center.z
        );

        // 创建圆弧边
        const edge = new wasm.BRepBuilderAPI_MakeEdge(circle, startPoint, endPoint);
        if (!edge.IsDone()) {
            throw new Error('Failed to create arc edge');
        }

        return edge.Edge();
    }

    /**
     * 圆 → OCCT 边
     */
    private static circleToEdge(segment: { type: 'circle'; center: Point3D; radius: number }, wasm: any): any {
        const plane = new wasm.gp_Pln(
            new wasm.gp_Pnt(segment.center.x, segment.center.y, segment.center.z),
            new wasm.gp_Dir(0, 0, 1)
        );

        const circle = new wasm.gp_Circ(plane, segment.radius);
        const edge = new wasm.BRepBuilderAPI_MakeEdge(circle);

        if (!edge.IsDone()) {
            throw new Error('Failed to create circle edge');
        }

        return edge.Edge();
    }

    /**
     * 样条曲线 → OCCT 边
     */
    private static splineToEdge(segment: { type: 'spline'; controlPoints: Point3D[] }, wasm: any): any {
        if (segment.controlPoints.length < 2) {
            throw new Error('Spline requires at least 2 control points');
        }

        // 创建控制点数组
        const points = new wasm.TColgp_HArray1OfPnt(1, segment.controlPoints.length);
        
        for (let i = 0; i < segment.controlPoints.length; i++) {
            const p = segment.controlPoints[i];
            points.SetValue(i + 1, new wasm.gp_Pnt(p.x, p.y, p.z));
        }

        // 创建 BSpline 曲线
        const splineBuilder = new wasm.GEOMAbs_C0();  // C0 连续性
        const spline = new wasm.Geom_BSplineCurve(
            points,
            null,  // 权重数组 (可选)
            null,  // 节点数组 (可选)
            null,  // 节点重数 (可选)
            2,     // 次数
            false  // 是否周期
        );

        const edge = new wasm.BRepBuilderAPI_MakeEdge(spline);
        if (!edge.IsDone()) {
            throw new Error('Failed to create spline edge');
        }

        return edge.Edge();
    }

    /**
     * 从 OCCT Wire 重建 Sketch3D
     * 
     * @param wire OCCT Wire
     * @param wasm OCCT WASM 模块
     * @returns Sketch3D 对象
     */
    static wireToSketch(wire: any, wasm: any, workplaneId: string): Sketch3D {
        try {
            const segments: SketchSegment3D[] = [];
            
            // 遍历 Wire 的边
            const explorer = new wasm.TopExp_Explorer(wire, wasm.TopAbs_EDGE);
            
            while (explorer.More()) {
                const edge = explorer.Current();
                const segment = this.edgeToSegment(edge, wasm);
                if (segment) {
                    segments.push(segment);
                }
                explorer.Next();
            }

            return {
                id: `sketch_${Date.now()}`,
                name: 'Sketch',
                workplaneId,
                segments,
                constraints: [],
                isClosed: this.checkIfClosed(wire, wasm)
            };

        } catch (error) {
            console.error('[SketchConverter] wireToSketch failed:', error);
            throw error;
        }
    }

    /**
     * OCCT 边 → 草图段
     */
    private static edgeToSegment(edge: any, wasm: any): SketchSegment3D | null {
        try {
            const curve = new wasm.BRep_Tool_Curve(edge);
            const curveType = curve.constructor.name;

            // 直线
            if (curveType === 'Geom_Line') {
                const line = curve.Line();
                const start = line.Location();
                const dir = line.Position().Direction();
                const first = curve.FirstParameter();
                const last = curve.LastParameter();

                const startPoint = start.Transformed(new wasm.gp_Trsf().SetTranslation(dir.XYZ().Multiplied(first)));
                const endPoint = start.Transformed(new wasm.gp_Trsf().SetTranslation(dir.XYZ().Multiplied(last)));

                return {
                    type: 'line',
                    startPoint: { x: startPoint.X(), y: startPoint.Y(), z: startPoint.Z() },
                    endPoint: { x: endPoint.X(), y: endPoint.Y(), z: endPoint.Z() }
                };
            }

            // 圆
            if (curveType === 'Geom_Circle') {
                const circle = curve.Circle();
                const center = circle.Location();
                const radius = circle.Radius();

                return {
                    type: 'circle',
                    center: { x: center.X(), y: center.Y(), z: center.Z() },
                    radius
                };
            }

            // TODO: 处理其他曲线类型
            console.warn('[SketchConverter] Unhandled curve type:', curveType);
            return null;

        } catch (error) {
            console.error('[SketchConverter] edgeToSegment failed:', error);
            return null;
        }
    }

    /**
     * 检查 Wire 是否闭合
     */
    private static checkIfClosed(wire: any, wasm: any): boolean {
        try {
            const verifier = new wasm.ShapeAnalysis_Wire(wire);
            return verifier.CheckClosed();
        } catch (error) {
            console.error('[SketchConverter] checkIfClosed failed:', error);
            return false;
        }
    }

    /**
     * 将 2D 点提升到 3D
     */
    static liftTo3D(point: Point, workplaneZ: number = 0): Point3D {
        return {
            x: point.x,
            y: point.y,
            z: workplaneZ
        };
    }

    /**
     * 将 3D 点投影到 2D
     */
    static projectTo2D(point: Point3D): Point {
        return {
            x: point.x,
            y: point.y
        };
    }
}
