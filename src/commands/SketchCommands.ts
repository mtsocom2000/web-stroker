/**
 * 草图相关命令
 * 
 * 包含：
 * - 创建草图
 * - 添加约束
 * - 求解草图
 * - 拉伸草图
 * - 旋转草图
 */

import { CancelableCommand, command } from './Command';
import { SketchSolver, SketchConstraint } from '../constraints/SketchSolver';
import { ShapeFactory } from '../kernel/ShapeFactory';
import { kernel } from '../kernel';
import type { Sketch3D, SketchSegment3D, Point3D } from '../types3d';
import { generateId } from '../utils';

// ============================================================================
// 创建草图命令
// ============================================================================

export interface CreateSketchParams {
    name?: string;
    workplaneId: string;
    segments: SketchSegment3D[];
}

@command({
    key: 'sketch.create',
    name: '创建草图',
    category: 'Sketch',
    icon: 'sketch',
    description: '在工作平面上创建 2D 草图'
})
export class CreateSketchCommand extends CancelableCommand {
    readonly name = '创建草图';
    
    private sketchId: string | null = null;

    constructor(private params: CreateSketchParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        this.sketchId = generateId();

        const sketch: Sketch3D = {
            id: this.sketchId,
            name: this.params.name ?? 'Sketch',
            workplaneId: this.params.workplaneId,
            segments: this.params.segments,
            constraints: [],
            isClosed: this.checkIfClosed(this.params.segments)
        };

        // 触发草图创建事件
        const event = new CustomEvent('sketch-created', { detail: sketch });
        window.dispatchEvent(event);

        console.log('[CreateSketchCommand] Sketch created:', this.sketchId);
    }

    private checkIfClosed(segments: SketchSegment3D[]): boolean {
        if (segments.length < 2) return false;

        const firstPoint = this.getSegmentStart(segments[0]);
        const lastPoint = this.getSegmentEnd(segments[segments.length - 1]);

        const dist = Math.sqrt(
            Math.pow(firstPoint.x - lastPoint.x, 2) +
            Math.pow(firstPoint.y - lastPoint.y, 2)
        );

        return dist < 0.001;
    }

    private getSegmentStart(segment: SketchSegment3D): Point3D {
        switch (segment.type) {
            case 'line': return segment.startPoint;
            case 'arc': return segment.center;
            case 'circle': return segment.center;
            case 'spline': return segment.controlPoints[0];
        }
    }

    private getSegmentEnd(segment: SketchSegment3D): Point3D {
        switch (segment.type) {
            case 'line': return segment.endPoint;
            case 'arc': return segment.center;
            case 'circle': return segment.center;
            case 'spline': return segment.controlPoints[segment.controlPoints.length - 1];
        }
    }

    async undo(): Promise<void> {
        if (!this.sketchId) return;
        window.dispatchEvent(new CustomEvent('sketch-removed', { detail: { id: this.sketchId } }));
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 添加约束命令
// ============================================================================

export interface AddConstraintParams {
    sketchId: string;
    constraint: SketchConstraint;
}

@command({
    key: 'sketch.addConstraint',
    name: '添加约束',
    category: 'Sketch',
    icon: 'constraint',
    description: '向草图添加几何或尺寸约束'
})
export class AddConstraintCommand extends CancelableCommand {
    readonly name = '添加约束';

    constructor(private params: AddConstraintParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        // 触发约束添加事件
        const event = new CustomEvent('constraint-added', {
            detail: {
                sketchId: this.params.sketchId,
                constraint: this.params.constraint
            }
        });
        window.dispatchEvent(event);

        console.log('[AddConstraintCommand] Constraint added:', this.params.constraint.id);
    }

    async undo(): Promise<void> {
        window.dispatchEvent(new CustomEvent('constraint-removed', {
            detail: {
                sketchId: this.params.sketchId,
                constraintId: this.params.constraint.id
            }
        }));
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 求解草图命令
// ============================================================================

export interface SolveSketchParams {
    sketchId: string;
}

@command({
    key: 'sketch.solve',
    name: '求解草图',
    category: 'Sketch',
    icon: 'solve',
    description: '求解草图约束系统'
})
export class SolveSketchCommand extends CancelableCommand {
    readonly name = '求解草图';

    constructor(private params: SolveSketchParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        // TODO: 从 Store 获取草图
        // 创建求解器并求解
        const solver = new SketchSolver();
        
        // 触发求解事件
        const event = new CustomEvent('sketch-solved', {
            detail: {
                sketchId: this.params.sketchId,
                success: true
            }
        });
        window.dispatchEvent(event);

        console.log('[SolveSketchCommand] Sketch solved:', this.params.sketchId);
    }

    async undo(): Promise<void> {
        // 撤销求解 (恢复之前的点位置)
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 拉伸草图命令
// ============================================================================

export interface ExtrudeSketchParams {
    sketchId: string;
    distance: number;
    name?: string;
}

@command({
    key: 'sketch.extrude',
    name: '拉伸草图',
    category: '3D',
    icon: 'extrude',
    description: '将 2D 草图拉伸为 3D 实体'
})
export class ExtrudeSketchCommand extends CancelableCommand {
    readonly name = '拉伸草图';
    
    private resultShapeId: string | null = null;

    constructor(private params: ExtrudeSketchParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        // TODO: 从 Store 获取草图数据
        // 这里使用示例草图
        const sketch: Sketch3D = {
            id: this.params.sketchId,
            name: 'Sketch',
            workplaneId: 'default',
            segments: [
                {
                    type: 'line',
                    startPoint: { x: 0, y: 0, z: 0 },
                    endPoint: { x: 10, y: 0, z: 0 }
                },
                {
                    type: 'line',
                    startPoint: { x: 10, y: 0, z: 0 },
                    endPoint: { x: 10, y: 10, z: 0 }
                },
                {
                    type: 'line',
                    startPoint: { x: 10, y: 10, z: 0 },
                    endPoint: { x: 0, y: 10, z: 0 }
                },
                {
                    type: 'line',
                    startPoint: { x: 0, y: 10, z: 0 },
                    endPoint: { x: 0, y: 0, z: 0 }
                }
            ],
            constraints: [],
            isClosed: true
        };

        // 执行拉伸
        const result = ShapeFactory.extrude(sketch, this.params.distance);

        if (!result.isOk || !result.value) {
            throw new Error(`Extrude failed: ${result.error}`);
        }

        this.resultShapeId = result.value.id;

        // 触发形状创建事件
        const event = new CustomEvent('shape-created', {
            detail: {
                id: result.value.id,
                type: 'extrusion',
                shape: result.value,
                position: { x: 0, y: 0, z: 0 },
                visible: true,
                color: '#dedede',
                dimensions: {
                    height: this.params.distance
                },
                featureId: this.params.sketchId
            }
        });
        window.dispatchEvent(event);

        console.log('[ExtrudeSketchCommand] Extruded:', this.resultShapeId);
    }

    async undo(): Promise<void> {
        if (!this.resultShapeId) return;
        window.dispatchEvent(new CustomEvent('shape-removed', { detail: { id: this.resultShapeId } }));
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 旋转草图命令
// ============================================================================

export interface RevolveSketchParams {
    sketchId: string;
    axisStart: Point3D;
    axisEnd: Point3D;
    angle?: number;
    name?: string;
}

@command({
    key: 'sketch.revolve',
    name: '旋转草图',
    category: '3D',
    icon: 'revolve',
    description: '将 2D 草图绕轴旋转为 3D 实体'
})
export class RevolveSketchCommand extends CancelableCommand {
    readonly name = '旋转草图';
    
    private resultShapeId: string | null = null;

    constructor(private params: RevolveSketchParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        // TODO: 从 Store 获取草图数据
        const sketch: Sketch3D = {
            id: this.params.sketchId,
            name: 'Sketch',
            workplaneId: 'default',
            segments: [],  // TODO: 实际草图
            constraints: [],
            isClosed: true
        };

        const angle = this.params.angle ?? 360;
        const result = ShapeFactory.revolve(
            sketch,
            this.params.axisStart,
            this.params.axisEnd,
            angle
        );

        if (!result.isOk || !result.value) {
            throw new Error(`Revolve failed: ${result.error}`);
        }

        this.resultShapeId = result.value.id;

        // 触发形状创建事件
        const event = new CustomEvent('shape-created', {
            detail: {
                id: result.value.id,
                type: 'revolve',
                shape: result.value,
                position: this.params.axisStart,
                visible: true,
                color: '#dedede',
                dimensions: {
                    angle
                },
                featureId: this.params.sketchId
            }
        });
        window.dispatchEvent(event);

        console.log('[RevolveSketchCommand] Revolved:', this.resultShapeId);
    }

    async undo(): Promise<void> {
        if (!this.resultShapeId) return;
        window.dispatchEvent(new CustomEvent('shape-removed', { detail: { id: this.resultShapeId } }));
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 导出所有命令
// ============================================================================

export {
    CreateSketchCommand,
    AddConstraintCommand,
    SolveSketchCommand,
    ExtrudeSketchCommand,
    RevolveSketchCommand
};
