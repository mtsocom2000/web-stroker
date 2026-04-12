/**
 * 高级 3D 建模命令
 * 
 * 包含：
 * - 扫掠 (Sweep)
 * - 放样 (Loft)
 * - 抽壳 (Shell)
 */

import { CancelableCommand, command } from './Command';
import { ShapeFactory } from '../kernel/ShapeFactory';
import { kernel } from '../kernel';
import type { Sketch3D, Point3D } from '../types3d';

// ============================================================================
// 扫掠命令
// ============================================================================

export interface SweepParams {
    sectionSketchId: string;  // 截面草图
    pathSketchId: string;      // 路径草图
    name?: string;
}

@command({
    key: '3d.sweep',
    name: '扫掠',
    category: '3D',
    icon: 'sweep',
    description: '沿路径扫掠截面创建 3D 实体'
})
export class SweepCommand extends CancelableCommand {
    readonly name = '扫掠';
    
    private resultShapeId: string | null = null;

    constructor(private params: SweepParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        // TODO: 从 Store 获取草图
        // 这里使用示例草图
        const sectionSketch: Sketch3D = {
            id: this.params.sectionSketchId,
            name: 'Section',
            workplaneId: 'XY',
            segments: [
                { type: 'line', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 10, y: 0, z: 0 } },
                { type: 'line', startPoint: { x: 10, y: 0, z: 0 }, endPoint: { x: 10, y: 10, z: 0 } },
                { type: 'line', startPoint: { x: 10, y: 10, z: 0 }, endPoint: { x: 0, y: 10, z: 0 } },
                { type: 'line', startPoint: { x: 0, y: 10, z: 0 }, endPoint: { x: 0, y: 0, z: 0 } }
            ],
            constraints: [],
            isClosed: true
        };

        const pathSketch: Sketch3D = {
            id: this.params.pathSketchId,
            name: 'Path',
            workplaneId: 'XZ',
            segments: [
                { type: 'line', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 0, y: 0, z: 50 } }
            ],
            constraints: [],
            isClosed: false
        };

        // 执行扫掠
        const result = ShapeFactory.sweep(sectionSketch, pathSketch);

        if (!result.isOk || !result.value) {
            throw new Error(`Sweep failed: ${result.error}`);
        }

        this.resultShapeId = result.value.id;

        // 触发形状创建事件
        const event = new CustomEvent('shape-created', {
            detail: {
                id: result.value.id,
                type: 'sweep',
                shape: result.value,
                position: { x: 0, y: 0, z: 0 },
                visible: true,
                color: '#dedede'
            }
        });
        window.dispatchEvent(event);

        console.log('[SweepCommand] Sweep completed:', this.resultShapeId);
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
// 放样命令
// ============================================================================

export interface LoftParams {
    sketchIds: string[];  // 截面草图 ID 列表 (至少 2 个)
    name?: string;
}

@command({
    key: '3d.loft',
    name: '放样',
    category: '3D',
    icon: 'loft',
    description: '在多个截面之间放样创建 3D 实体'
})
export class LoftCommand extends CancelableCommand {
    readonly name = '放样';
    
    private resultShapeId: string | null = null;

    constructor(private params: LoftParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        if (this.params.sketchIds.length < 2) {
            throw new Error('Loft requires at least 2 sketches');
        }

        // TODO: 从 Store 获取草图
        // 这里使用示例草图
        const sketches: Sketch3D[] = this.params.sketchIds.map((id, index) => ({
            id,
            name: `Section ${index}`,
            workplaneId: 'XY',
            segments: [
                { type: 'line', startPoint: { x: -5 + index * 2, y: -5, z: index * 10 }, endPoint: { x: 5 + index * 2, y: -5, z: index * 10 } },
                { type: 'line', startPoint: { x: 5 + index * 2, y: -5, z: index * 10 }, endPoint: { x: 5 + index * 2, y: 5, z: index * 10 } },
                { type: 'line', startPoint: { x: 5 + index * 2, y: 5, z: index * 10 }, endPoint: { x: -5 + index * 2, y: 5, z: index * 10 } },
                { type: 'line', startPoint: { x: -5 + index * 2, y: 5, z: index * 10 }, endPoint: { x: -5 + index * 2, y: -5, z: index * 10 } }
            ],
            constraints: [],
            isClosed: true
        }));

        // 执行放样
        const result = ShapeFactory.loft(sketches);

        if (!result.isOk || !result.value) {
            throw new Error(`Loft failed: ${result.error}`);
        }

        this.resultShapeId = result.value.id;

        // 触发形状创建事件
        const event = new CustomEvent('shape-created', {
            detail: {
                id: result.value.id,
                type: 'loft',
                shape: result.value,
                position: { x: 0, y: 0, z: 0 },
                visible: true,
                color: '#dedede'
            }
        });
        window.dispatchEvent(event);

        console.log('[LoftCommand] Loft completed:', this.resultShapeId);
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
// 抽壳命令
// ============================================================================

export interface ShellParams {
    shapeId: string;
    facesToRemove: number[];  // 要移除的面索引
    thickness: number;
    name?: string;
}

@command({
    key: '3d.shell',
    name: '抽壳',
    category: '3D',
    icon: 'shell',
    description: '将实体抽壳成薄壁结构'
})
export class ShellCommand extends CancelableCommand {
    readonly name = '抽壳';
    
    private resultShapeId: string | null = null;

    constructor(private params: ShellParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        await kernel.initialize();

        // TODO: 从 Store 获取形状
        // 这里假设形状已通过事件传递
        console.log('[ShellCommand] Shell parameters:', this.params);
        
        // 实际实现需要：
        // 1. 从 Store 获取 shape
        // 2. 执行抽壳操作
        // 3. 创建新形状
        // 4. 替换或隐藏原形状
        
        // 示例代码：
        /*
        const shape = getShapeById(this.params.shapeId);
        const result = ShapeFactory.shell(shape, this.params.facesToRemove, this.params.thickness);
        
        if (result.isOk) {
            this.resultShapeId = result.value.id;
            // 触发事件...
        }
        */
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
    SweepCommand,
    LoftCommand,
    ShellCommand
};
