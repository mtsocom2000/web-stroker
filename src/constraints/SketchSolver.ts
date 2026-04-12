/**
 * SketchSolver - 2D 草图约束求解器
 * 
 * 支持几何约束和尺寸约束的求解
 * 使用数值优化方法 (Newton-Raphson)
 * 
 * 约束类型:
 * - 几何约束：重合、水平、垂直、平行、相切、同心
 * - 尺寸约束：距离、角度、半径、直径
 */

import type { Point, Point2D } from '../types';
import type { Point3D } from '../types3d';

/**
 * 约束类型枚举
 */
export type ConstraintType =
    | 'coincident'      // 重合
    | 'horizontal'      // 水平
    | 'vertical'        // 垂直
    | 'parallel'        // 平行
    | 'perpendicular'   // 垂直
    | 'tangent'         // 相切
    | 'concentric'      // 同心
    | 'equal'           // 相等
    | 'symmetric'       // 对称
    | 'distance'        // 距离
    | 'angle'           // 角度
    | 'radius'          // 半径
    | 'diameter'        // 直径
    | 'fixed'           // 固定;

/**
 * 约束目标
 */
export interface ConstraintTarget {
    type: 'point' | 'line' | 'circle' | 'arc';
    id: string;
    pointIndex?: number;  // 对于点/线端点
}

/**
 * 约束定义
 */
export interface SketchConstraint {
    id: string;
    type: ConstraintType;
    targets: ConstraintTarget[];
    value?: number;  // 对于尺寸约束
    unit?: 'mm' | 'deg' | 'rad';
    suppressed?: boolean;
}

/**
 * 草图几何元素
 */
export interface SketchGeometry {
    points: Point2D[];
    lines: { id: string; start: number; end: number }[];
    circles: { id: string; center: number; radius: number }[];
    arcs: { id: string; center: number; start: number; end: number; radius: number }[];
}

/**
 * 求解结果
 */
export interface SolveResult {
    success: boolean;
    points: Point2D[];
    iterations: number;
    error?: string;
}

/**
 * 约束求解器类
 */
export class SketchSolver {
    private geometry: SketchGeometry | null = null;
    private constraints: SketchConstraint[] = [];
    private fixedPoints: Set<number> = new Set();
    
    /**
     * 设置草图几何
     */
    setGeometry(geometry: SketchGeometry): void {
        this.geometry = geometry;
    }

    /**
     * 添加约束
     */
    addConstraint(constraint: SketchConstraint): void {
        this.constraints.push(constraint);
    }

    /**
     * 移除约束
     */
    removeConstraint(id: string): void {
        this.constraints = this.constraints.filter(c => c.id !== id);
    }

    /**
     * 清除所有约束
     */
    clearConstraints(): void {
        this.constraints = [];
    }

    /**
     * 固定点
     */
    fixPoint(pointIndex: number): void {
        this.fixedPoints.add(pointIndex);
    }

    /**
     * 解除固定点
     */
    unfixPoint(pointIndex: number): void {
        this.fixedPoints.delete(pointIndex);
    }

    /**
     * 求解约束系统
     * 
     * 使用 Newton-Raphson 迭代法
     */
    solve(maxIterations: number = 50, tolerance: number = 1e-6): SolveResult {
        if (!this.geometry) {
            return {
                success: false,
                points: [],
                iterations: 0,
                error: 'Geometry not set'
            };
        }

        // 深拷贝点数组
        let points = this.geometry.points.map(p => ({ ...p }));
        
        // 迭代求解
        let iteration = 0;
        let maxError = Infinity;

        while (iteration < maxIterations && maxError > tolerance) {
            maxError = 0;

            // 对每个约束计算误差并修正
            for (const constraint of this.constraints) {
                if (constraint.suppressed) continue;

                const error = this.evaluateConstraint(constraint, points);
                if (error !== null && Math.abs(error) > maxError) {
                    maxError = Math.abs(error);
                }

                // 应用修正
                this.applyConstraintCorrection(constraint, points, tolerance);
            }

            iteration++;
        }

        const success = maxError <= tolerance || iteration < maxIterations;

        return {
            success,
            points,
            iterations: iteration,
            error: success ? undefined : `Did not converge after ${maxIterations} iterations`
        };
    }

    /**
     * 评估约束误差
     */
    private evaluateConstraint(constraint: SketchConstraint, points: Point2D[]): number | null {
        switch (constraint.type) {
            case 'coincident':
                return this.evalCoincident(constraint, points);
            case 'horizontal':
                return this.evalHorizontal(constraint, points);
            case 'vertical':
                return this.evalVertical(constraint, points);
            case 'distance':
                return this.evalDistance(constraint, points);
            case 'angle':
                return this.evalAngle(constraint, points);
            case 'radius':
                return this.evalRadius(constraint, points);
            case 'fixed':
                return 0;  // 固定点无误差
            default:
                return 0;
        }
    }

    /**
     * 应用约束修正
     */
    private applyConstraintCorrection(
        constraint: SketchConstraint,
        points: Point2D[],
        tolerance: number
    ): void {
        const error = this.evaluateConstraint(constraint, points);
        if (error === null || Math.abs(error) <= tolerance) return;

        switch (constraint.type) {
            case 'coincident':
                this.fixCoincident(constraint, points, error);
                break;
            case 'horizontal':
                this.fixHorizontal(constraint, points, error);
                break;
            case 'vertical':
                this.fixVertical(constraint, points, error);
                break;
            case 'distance':
                this.fixDistance(constraint, points, error);
                break;
            case 'fixed':
                // 固定点不需要修正
                break;
        }
    }

    // ============================================================================
    // 几何约束评估
    // ============================================================================

    /**
     * 评估重合约束误差
     */
    private evalCoincident(constraint: SketchConstraint, points: Point2D[]): number {
        if (constraint.targets.length < 2) return 0;

        const p1 = this.getTargetPoint(constraint.targets[0], points);
        const p2 = this.getTargetPoint(constraint.targets[1], points);

        if (!p1 || !p2) return 0;

        // 距离误差
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 评估水平约束误差
     */
    private evalHorizontal(constraint: SketchConstraint, points: Point2D[]): number {
        if (constraint.targets.length < 2) return 0;

        const p1 = this.getTargetPoint(constraint.targets[0], points);
        const p2 = this.getTargetPoint(constraint.targets[1], points);

        if (!p1 || !p2) return 0;

        // Y 坐标差值
        return Math.abs(p1.y - p2.y);
    }

    /**
     * 评估垂直约束误差
     */
    private evalVertical(constraint: SketchConstraint, points: Point2D[]): number {
        if (constraint.targets.length < 2) return 0;

        const p1 = this.getTargetPoint(constraint.targets[0], points);
        const p2 = this.getTargetPoint(constraint.targets[1], points);

        if (!p1 || !p2) return 0;

        // X 坐标差值
        return Math.abs(p1.x - p2.x);
    }

    /**
     * 评估距离约束误差
     */
    private evalDistance(constraint: SketchConstraint, points: Point2D[]): number {
        if (constraint.targets.length < 2 || constraint.value === undefined) return 0;

        const p1 = this.getTargetPoint(constraint.targets[0], points);
        const p2 = this.getTargetPoint(constraint.targets[1], points);

        if (!p1 || !p2) return 0;

        const currentDist = Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );

        return currentDist - constraint.value;
    }

    /**
     * 评估角度约束误差
     */
    private evalAngle(constraint: SketchConstraint, points: Point2D[]): number {
        // TODO: 实现角度评估
        return 0;
    }

    /**
     * 评估半径约束误差
     */
    private evalRadius(constraint: SketchConstraint, points: Point2D[]): number {
        if (constraint.value === undefined || constraint.targets.length < 1) return 0;

        // TODO: 获取圆弧/圆的半径
        return 0;
    }

    // ============================================================================
    // 几何约束修正
    // ============================================================================

    /**
     * 修正重合约束
     */
    private fixCoincident(constraint: SketchConstraint, points: Point2D[], error: number): void {
        if (constraint.targets.length < 2) return;

        const t1 = constraint.targets[0];
        const t2 = constraint.targets[1];

        const idx1 = t1.pointIndex ?? 0;
        const idx2 = t2.pointIndex ?? 0;

        // 如果一个是固定点，移动另一个
        if (this.fixedPoints.has(idx1) && !this.fixedPoints.has(idx2)) {
            points[idx2].x = points[idx1].x;
            points[idx2].y = points[idx1].y;
        } else if (!this.fixedPoints.has(idx1) && this.fixedPoints.has(idx2)) {
            points[idx1].x = points[idx2].x;
            points[idx1].y = points[idx2].y;
        } else {
            // 都移动，取中点
            const midX = (points[idx1].x + points[idx2].x) / 2;
            const midY = (points[idx1].y + points[idx2].y) / 2;
            points[idx1].x = midX;
            points[idx1].y = midY;
            points[idx2].x = midX;
            points[idx2].y = midY;
        }
    }

    /**
     * 修正水平约束
     */
    private fixHorizontal(constraint: SketchConstraint, points: Point2D[], error: number): void {
        if (constraint.targets.length < 2) return;

        const idx1 = constraint.targets[0].pointIndex ?? 0;
        const idx2 = constraint.targets[1].pointIndex ?? 0;

        // 使 Y 坐标相等
        const avgY = (points[idx1].y + points[idx2].y) / 2;
        
        if (!this.fixedPoints.has(idx1)) {
            points[idx1].y = avgY;
        }
        if (!this.fixedPoints.has(idx2)) {
            points[idx2].y = avgY;
        }
    }

    /**
     * 修正垂直约束
     */
    private fixVertical(constraint: SketchConstraint, points: Point2D[], error: number): void {
        if (constraint.targets.length < 2) return;

        const idx1 = constraint.targets[0].pointIndex ?? 0;
        const idx2 = constraint.targets[1].pointIndex ?? 0;

        // 使 X 坐标相等
        const avgX = (points[idx1].x + points[idx2].x) / 2;
        
        if (!this.fixedPoints.has(idx1)) {
            points[idx1].x = avgX;
        }
        if (!this.fixedPoints.has(idx2)) {
            points[idx2].x = avgX;
        }
    }

    /**
     * 修正距离约束
     */
    private fixDistance(constraint: SketchConstraint, points: Point2D[], error: number): void {
        if (constraint.targets.length < 2 || constraint.value === undefined) return;

        const idx1 = constraint.targets[0].pointIndex ?? 0;
        const idx2 = constraint.targets[1].pointIndex ?? 0;

        const p1 = points[idx1];
        const p2 = points[idx2];

        // 计算当前方向和距离
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const currentDist = Math.sqrt(dx * dx + dy * dy);

        if (currentDist < 1e-10) return;  // 避免除零

        // 计算需要的缩放因子
        const scale = constraint.value / currentDist;

        // 移动点
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        if (!this.fixedPoints.has(idx1)) {
            p1.x = midX + (p1.x - midX) * scale;
            p1.y = midY + (p1.y - midY) * scale;
        }
        if (!this.fixedPoints.has(idx2)) {
            p2.x = midX + (p2.x - midX) * scale;
            p2.y = midY + (p2.y - midY) * scale;
        }
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    /**
     * 获取约束目标点
     */
    private getTargetPoint(target: ConstraintTarget, points: Point2D[]): Point2D | null {
        if (target.type !== 'point' || target.pointIndex === undefined) {
            return null;
        }
        return points[target.pointIndex];
    }

    /**
     * 创建约束辅助函数
     */
    static createConstraint(
        type: ConstraintType,
        targets: ConstraintTarget[],
        value?: number,
        unit?: 'mm' | 'deg' | 'rad'
    ): SketchConstraint {
        return {
            id: `constraint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            targets,
            value,
            unit,
            suppressed: false
        };
    }

    /**
     * 创建重合约束
     */
    static coincident(point1Index: number, point2Index: number): SketchConstraint {
        return SketchSolver.createConstraint('coincident', [
            { type: 'point', id: `p${point1Index}`, pointIndex: point1Index },
            { type: 'point', id: `p${point2Index}`, pointIndex: point2Index }
        ]);
    }

    /**
     * 创建水平约束
     */
    static horizontal(point1Index: number, point2Index: number): SketchConstraint {
        return SketchSolver.createConstraint('horizontal', [
            { type: 'point', id: `p${point1Index}`, pointIndex: point1Index },
            { type: 'point', id: `p${point2Index}`, pointIndex: point2Index }
        ]);
    }

    /**
     * 创建垂直约束
     */
    static vertical(point1Index: number, point2Index: number): SketchConstraint {
        return SketchSolver.createConstraint('vertical', [
            { type: 'point', id: `p${point1Index}`, pointIndex: point1Index },
            { type: 'point', id: `p${point2Index}`, pointIndex: point2Index }
        ]);
    }

    /**
     * 创建距离约束
     */
    static distance(point1Index: number, point2Index: number, value: number): SketchConstraint {
        return SketchSolver.createConstraint('distance', [
            { type: 'point', id: `p${point1Index}`, pointIndex: point1Index },
            { type: 'point', id: `p${point2Index}`, pointIndex: point2Index }
        ], value, 'mm');
    }

    /**
     * 创建固定约束
     */
    static fixed(pointIndex: number): SketchConstraint {
        return SketchSolver.createConstraint('fixed', [
            { type: 'point', id: `p${pointIndex}`, pointIndex }
        ]);
    }
}

/**
 * 约束管理器
 */
export class ConstraintManager {
    private solver: SketchSolver;

    constructor() {
        this.solver = new SketchSolver();
    }

    /**
     * 添加约束
     */
    addConstraint(constraint: SketchConstraint): void {
        this.solver.addConstraint(constraint);
    }

    /**
     * 移除约束
     */
    removeConstraint(id: string): void {
        this.solver.removeConstraint(id);
    }

    /**
     * 求解
     */
    solve(): SolveResult {
        return this.solver.solve();
    }

    /**
     * 获取求解器
     */
    getSolver(): SketchSolver {
        return this.solver;
    }
}

// 导出类型
export type { SketchConstraint as Constraint, ConstraintTarget, SketchGeometry, SolveResult };
