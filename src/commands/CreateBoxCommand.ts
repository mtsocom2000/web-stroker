/**
 * 创建长方体命令
 * 
 * 示例命令，演示如何使用命令系统
 */

import { CancelableCommand } from './Command';
import { command } from './CommandStore';
import { Transaction, SimpleHistoryRecord } from './Transaction';
import { kernel } from '../kernel';
import { generateId } from '../utils';
import type { Stroke } from '../types';

export interface CreateBoxCommandParams {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    depth: number;
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
    private previousShapeCount = 0;

    constructor(private params: CreateBoxCommandParams) {
        super();
    }

    protected async executeAsync(): Promise<void> {
        // 确保内核已初始化
        await kernel.initialize();

        // 创建长方体
        const origin = { x: this.params.x, y: this.params.y, z: this.params.z };
        const result = kernel.createBox(origin, this.params.width, this.params.height, this.params.depth);

        if (!result.isOk || !result.value) {
            throw new Error(`Failed to create box: ${result.error}`);
        }

        const shape = result.value;
        this.createdShapeId = shape.id;

        // 记录创建前的形状数量 (用于撤销)
        const store = useDrawingStore.getState();
        this.previousShapeCount = store.shapes3D?.length ?? 0;

        // 添加到 store
        store.addShape3D({
            id: shape.id,
            type: 'box',
            shape: shape,
            position: origin,
            dimensions: {
                width: this.params.width,
                height: this.params.height,
                depth: this.params.depth
            },
            visible: true,
            color: '#dedede'
        });
    }

    async undo(): Promise<void> {
        if (!this.createdShapeId) return;

        const store = useDrawingStore.getState();
        
        // 从 store 移除
        store.removeShape3D(this.createdShapeId);
        
        // 释放形状资源
        // 注意：实际项目中需要维护 shape 引用以释放 WASM 资源
    }

    async redo(): Promise<void> {
        if (!this.createdShapeId) return;

        // 重新执行创建逻辑
        await this.executeAsync();
    }

    protected afterExecute(): void {
        console.log('[CreateBoxCommand] Executed successfully');
    }

    protected onCancel(): void {
        console.log('[CreateBoxCommand] Canceled');
    }
}

// 需要导入 store 类型
import { useDrawingStore } from '../store';
