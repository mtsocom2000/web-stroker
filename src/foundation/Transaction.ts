/**
 * 事务系统
 * 
 * 支持批量操作的原子性执行，失败自动回滚
 * 与 History 系统集成，支持撤销/重做
 */

import { useDrawingStore } from '../store';

/**
 * 历史记录接口
 */
export interface IHistoryRecord {
    /**
     * 记录名称
     */
    readonly name: string;
    
    /**
     * 撤销操作
     */
    undo(): void;
    
    /**
     * 重做操作
     */
    redo(): void;
    
    /**
     * 释放资源
     */
    dispose(): void;
}

/**
 * 事务类
 */
export class Transaction {
    /**
     * 事务栈 (每文档独立)
     */
    private static stack: Map<string, IHistoryRecord[]> = new Map();

    /**
     * 执行事务 (同步)
     * 
     * @param documentId 文档 ID
     * @param name 事务名称
     * @param action 操作函数
     * 
     * 示例:
     * ```ts
     * Transaction.execute('doc1', 'Extrude', () => {
     *     const shape = ShapeFactory.extrude(sketch, distance);
     *     store.addShape(shape);
     * });
     * ```
     */
    static execute(documentId: string, name: string, action: () => void): void {
        Transaction.start(documentId, name);
        try {
            action();
            Transaction.commit(documentId);
        } catch (error) {
            Transaction.rollback(documentId);
            throw error;
        }
    }

    /**
     * 执行事务 (异步)
     * 
     * @param documentId 文档 ID
     * @param name 事务名称
     * @param action 异步操作函数
     */
    static async executeAsync(
        documentId: string,
        name: string,
        action: () => Promise<void>
    ): Promise<void> {
        Transaction.start(documentId, name);
        try {
            await action();
            Transaction.commit(documentId);
        } catch (error) {
            Transaction.rollback(documentId);
            throw error;
        }
    }

    /**
     * 开始事务
     * @param documentId 文档 ID
     * @param name 事务名称
     */
    static start(documentId: string, name: string): void {
        if (Transaction.stack.has(documentId)) {
            throw new Error(`Transaction already started for document: ${documentId}`);
        }
        Transaction.stack.set(documentId, []);
    }

    /**
     * 添加历史记录
     * @param documentId 文档 ID
     * @param record 历史记录
     */
    static add(documentId: string, record: IHistoryRecord): void {
        const records = Transaction.stack.get(documentId);
        if (records !== undefined) {
            records.push(record);
        } else {
            // 没有活动事务，直接添加到历史
            useDrawingStore.getState().history.add(record);
        }
    }

    /**
     * 提交事务
     * @param documentId 文档 ID
     */
    static commit(documentId: string): void {
        const records = Transaction.stack.get(documentId);
        
        if (records && records.length > 0) {
            // 批量添加到历史记录
            const batchRecord: IHistoryRecord = {
                name: records[0].name,
                undo: () => {
                    // 逆序撤销
                    for (let i = records.length - 1; i >= 0; i--) {
                        records[i].undo();
                    }
                },
                redo: () => {
                    // 顺序重做
                    records.forEach(record => record.redo());
                },
                dispose: () => {
                    records.forEach(record => record.dispose());
                }
            };
            
            useDrawingStore.getState().history.add(batchRecord);
        }
        
        Transaction.stack.delete(documentId);
    }

    /**
     * 回滚事务
     * @param documentId 文档 ID
     */
    static rollback(documentId: string): void {
        const records = Transaction.stack.get(documentId);
        
        if (records) {
            // 逆序撤销所有操作
            for (let i = records.length - 1; i >= 0; i--) {
                records[i].undo();
            }
        }
        
        Transaction.stack.delete(documentId);
    }

    /**
     * 获取当前事务状态
     * @param documentId 文档 ID
     */
    static hasActiveTransaction(documentId: string): boolean {
        return Transaction.stack.has(documentId);
    }

    /**
     * 清除所有事务
     */
    static clear(): void {
        Transaction.stack.clear();
    }
}

/**
 * 简单历史记录实现
 */
export class SimpleHistoryRecord implements IHistoryRecord {
    constructor(
        public readonly name: string,
        private undoFn: () => void,
        private redoFn: () => void,
        private disposeFn?: () => void
    ) {}

    undo(): void {
        this.undoFn();
    }

    redo(): void {
        this.redoFn();
    }

    dispose(): void {
        this.disposeFn?.();
    }
}

/**
 * 属性变更历史记录
 */
export class PropertyHistoryRecord implements IHistoryRecord {
    readonly name: string;

    constructor(
        private object: any,
        private property: string | symbol | number,
        private oldValue: any,
        private newValue: any
    ) {
        this.name = `Change ${String(property)}`;
    }

    undo(): void {
        this.object[this.property] = this.oldValue;
    }

    redo(): void {
        this.object[this.property] = this.newValue;
    }

    dispose(): void {
        // 无资源需要释放
    }
}
