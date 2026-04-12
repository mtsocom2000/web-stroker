/**
 * 创建 3D 形状命令集合
 * 
 * 包含：
 * - CreateBoxCommand (重构版)
 * - CreateCylinderCommand
 * - CreateSphereCommand
 */

import { CancelableCommand, command } from './Command';
import { CommandStore } from './CommandStore';
import { Transaction, SimpleHistoryRecord } from '../foundation/Transaction';
import { kernel } from '../kernel';
import { ShapeFactory } from '../kernel/ShapeFactory';
import type { Point3D, Shape3DData } from '../types3d';
import { generateId } from '../utils';

// ============================================================================
// 创建长方体命令
// ============================================================================

export interface CreateBoxParams {
    position: Point3D;
    width: number;
    height: number;
    depth: number;
    color?: string;
}

@command({
    key: 'create.box',
    name: '创建长方体',
    category: '3D',
    icon: 'box',
    description: '在指定位置创建一个长方体'
})
export class CreateBoxCommand extends CancelableCommand {
    readonly name = '创建长方体';
    
    private createdShapeId: string | null = null;
    private shapeData: Shape3DData | null = null;

    constructor(private params: CreateBoxParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        // 确保内核已初始化
        await kernel.initialize();

        // 创建长方体
        const plane = {
            id: 'default',
            name: 'XY Plane',
            origin: this.params.position,
            normal: { x: 0, y: 0, z: 1 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 1, z: 0 },
            projectToPlane: (p: Point3D) => ({ x: p.x, y: p.y }),
            liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
        };

        const result = ShapeFactory.box(plane, this.params.width, this.params.height, this.params.depth);

        if (!result.isOk || !result.value) {
            throw new Error(`Failed to create box: ${result.error}`);
        }

        const shape = result.value;
        this.createdShapeId = shape.id;

        // 创建形状数据
        this.shapeData = {
            id: shape.id,
            type: 'box',
            shape: shape,
            position: this.params.position,
            visible: true,
            color: this.params.color ?? '#dedede',
            dimensions: {
                width: this.params.width,
                height: this.params.height,
                depth: this.params.depth
            }
        };

        // 添加到全局形状管理器 (TODO: 需要实现)
        const event = new CustomEvent('shape-created', { detail: this.shapeData });
        window.dispatchEvent(event);
    }

    async undo(): Promise<void> {
        if (!this.createdShapeId || !this.shapeData) return;

        // 触发删除事件
        const event = new CustomEvent('shape-removed', { detail: { id: this.createdShapeId } });
        window.dispatchEvent(event);

        // 释放资源
        this.shapeData.shape.dispose();
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }

    protected afterExecute(): void {
        console.log('[CreateBoxCommand] Executed:', this.createdShapeId);
    }
}

// ============================================================================
// 创建圆柱体命令
// ============================================================================

export interface CreateCylinderParams {
    position: Point3D;
    radius: number;
    height: number;
    color?: string;
}

@command({
    key: 'create.cylinder',
    name: '创建圆柱体',
    category: '3D',
    icon: 'cylinder',
    description: '在指定位置创建一个圆柱体'
})
export class CreateCylinderCommand extends CancelableCommand {
    readonly name = '创建圆柱体';
    
    private createdShapeId: string | null = null;
    private shapeData: Shape3DData | null = null;

    constructor(private params: CreateCylinderParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        const plane = {
            id: 'default',
            name: 'XY Plane',
            origin: this.params.position,
            normal: { x: 0, y: 0, z: 1 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 1, z: 0 },
            projectToPlane: (p: Point3D) => ({ x: p.x, y: p.y }),
            liftTo3D: (p: any, z?: number) => ({ x: p.x, y: p.y, z: z ?? 0 })
        };

        const result = ShapeFactory.cylinder(plane, this.params.radius, this.params.height);

        if (!result.isOk || !result.value) {
            throw new Error(`Failed to create cylinder: ${result.error}`);
        }

        const shape = result.value;
        this.createdShapeId = shape.id;

        this.shapeData = {
            id: shape.id,
            type: 'cylinder',
            shape: shape,
            position: this.params.position,
            visible: true,
            color: this.params.color ?? '#dedede',
            dimensions: {
                radius: this.params.radius,
                height: this.params.height
            }
        };

        const event = new CustomEvent('shape-created', { detail: this.shapeData });
        window.dispatchEvent(event);
    }

    async undo(): Promise<void> {
        if (!this.createdShapeId || !this.shapeData) return;
        const event = new CustomEvent('shape-removed', { detail: { id: this.createdShapeId } });
        window.dispatchEvent(event);
        this.shapeData.shape.dispose();
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 创建球体命令
// ============================================================================

export interface CreateSphereParams {
    position: Point3D;
    radius: number;
    color?: string;
}

@command({
    key: 'create.sphere',
    name: '创建球体',
    category: '3D',
    icon: 'sphere',
    description: '在指定位置创建一个球体'
})
export class CreateSphereCommand extends CancelableCommand {
    readonly name = '创建球体';
    
    private createdShapeId: string | null = null;
    private shapeData: Shape3DData | null = null;

    constructor(private params: CreateSphereParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        const result = ShapeFactory.sphere(this.params.position, this.params.radius);

        if (!result.isOk || !result.value) {
            throw new Error(`Failed to create sphere: ${result.error}`);
        }

        const shape = result.value;
        this.createdShapeId = shape.id;

        this.shapeData = {
            id: shape.id,
            type: 'sphere',
            shape: shape,
            position: this.params.position,
            visible: true,
            color: this.params.color ?? '#dedede',
            dimensions: {
                radius: this.params.radius
            }
        };

        const event = new CustomEvent('shape-created', { detail: this.shapeData });
        window.dispatchEvent(event);
    }

    async undo(): Promise<void> {
        if (!this.createdShapeId || !this.shapeData) return;
        const event = new CustomEvent('shape-removed', { detail: { id: this.createdShapeId } });
        window.dispatchEvent(event);
        this.shapeData.shape.dispose();
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}

// ============================================================================
// 布尔运算命令
// ============================================================================

export interface BooleanOperationParams {
    operation: 'union' | 'subtract' | 'intersect';
    shapeAId: string;
    shapeBId: string;
}

@command({
    key: 'modify.boolean',
    name: '布尔运算',
    category: 'Modify',
    icon: 'boolean',
    description: '执行布尔运算 (并集/差集/交集)'
})
export class BooleanOperationCommand extends CancelableCommand {
    readonly name = '布尔运算';
    
    private resultShapeId: string | null = null;
    private resultShapeData: Shape3DData | null = null;

    constructor(private params: BooleanOperationParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        // TODO: 从 Store 获取形状
        // 这里简化处理，假设形状已通过事件传递
        console.log('[BooleanOperationCommand] Executing:', this.params);
        
        // 实际实现需要：
        // 1. 从 Store 获取 shapeA 和 shapeB
        // 2. 执行布尔运算
        // 3. 创建新形状
        // 4. 删除或隐藏原形状
    }

    async undo(): Promise<void> {
        // TODO: 实现撤销
    }

    async redo(): Promise<void> {
        await this.executeAsync();
    }
}
