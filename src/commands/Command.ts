/**
 * 命令模式基础类
 * 
 * 设计原则：
 * - 所有用户操作封装为命令
 * - 支持撤销/重做
 * - 支持异步执行
 * - 支持取消操作
 */

import type { IShape } from '../kernel';

/**
 * 命令接口
 */
export interface ICommand {
    /**
     * 执行命令
     */
    execute(): Promise<void>;
    
    /**
     * 撤销命令
     */
    undo(): Promise<void>;
    
    /**
     * 重做命令
     */
    redo(): Promise<void>;
    
    /**
     * 命令名称 (用于历史记录)
     */
    readonly name: string;
}

/**
 * 可取消命令接口
 */
export interface ICancelableCommand extends ICommand {
    /**
     * 取消命令执行
     */
    cancel(): Promise<void>;
    
    /**
     * 是否已完成
     */
    readonly isCompleted: boolean;
    
    /**
     * 是否已取消
     */
    readonly isCanceled: boolean;
}

/**
 * 命令基类 - 实现通用逻辑
 */
export abstract class CancelableCommand implements ICancelableCommand {
    protected isCompleted = false;
    protected isCanceled = false;
    
    /**
     * 命令名称
     */
    abstract readonly name: string;

    /**
     * 执行命令 (模板方法)
     */
    async execute(): Promise<void> {
        if (this.isCompleted || this.isCanceled) {
            throw new Error('Command already executed or canceled');
        }

        try {
            this.beforeExecute();
            await this.executeAsync();
            this.isCompleted = true;
        } catch (error) {
            this.isCanceled = true;
            throw error;
        } finally {
            this.afterExecute();
        }
    }

    /**
     * 撤销命令 (抽象方法，子类实现)
     */
    abstract undo(): Promise<void>;

    /**
     * 重做命令 (抽象方法，子类实现)
     */
    abstract redo(): Promise<void>;

    /**
     * 取消命令执行
     */
    async cancel(): Promise<void> {
        this.isCanceled = true;
        await this.onCancel();
    }

    /**
     * 执行前钩子
     */
    protected beforeExecute(): void {
        // 子类可重写
    }

    /**
     * 执行后钩子
     */
    protected afterExecute(): void {
        // 子类可重写
    }

    /**
     * 取消时钩子
     */
    protected onCancel(): void {
        // 子类可重写
    }

    /**
     * 异步执行逻辑 (抽象方法，子类实现)
     */
    protected abstract executeAsync(): Promise<void>;
}

/**
 * 多步骤命令基类
 * 
 * 用于需要用户交互的命令 (如：选择→指定参数→执行)
 */
export abstract class MultistepCommand extends CancelableCommand {
    /**
     * 步骤数据
     */
    protected stepDatas: any[] = [];

    /**
     * 重置步骤数据
     */
    protected resetStepDatas(): void {
        this.stepDatas = [];
    }

    /**
     * 执行步骤
     */
    protected async executeSteps(): Promise<boolean> {
        const steps = this.getSteps();
        
        while (this.stepDatas.length < steps.length && !this.isCanceled) {
            const step = steps[this.stepDatas.length];
            const data = await step.execute();
            
            if (data === undefined || this.isCanceled) {
                return false;
            }
            
            this.stepDatas.push(data);
        }
        
        return !this.isCanceled;
    }

    /**
     * 执行主任务
     */
    protected abstract executeMainTask(): void;

    /**
     * 获取步骤列表
     */
    protected abstract getSteps(): IStep[];

    /**
     * 重写 executeAsync 以支持多步骤
     */
    protected async executeAsync(): Promise<void> {
        const canExecute = await this.canExecute();
        if (!canExecute) {
            return;
        }

        const stepsSuccess = await this.executeSteps();
        if (!stepsSuccess) {
            return;
        }

        this.executeMainTask();
    }

    /**
     * 检查是否可以执行
     */
    protected async canExecute(): Promise<boolean> {
        return true;
    }
}

/**
 * 命令步骤接口
 */
export interface IStep {
    /**
     * 执行步骤
     * @returns 步骤结果数据
     */
    execute(): Promise<any>;
}

/**
 * 简单步骤实现
 */
export class SimpleStep implements IStep {
    constructor(private executeFn: () => Promise<any>) {}

    async execute(): Promise<any> {
        return this.executeFn();
    }
}
