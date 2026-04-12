/**
 * 命令注册表
 * 
 * 管理所有可用命令的注册和创建
 */

import type { ICommand } from './Command';

/**
 * 命令构造函数类型
 */
export type CommandConstructor = new (...args: any[]) => ICommand;

/**
 * 命令元数据
 */
export interface CommandMetadata {
    key: string;
    name: string;
    icon?: string;
    category?: string;
    description?: string;
}

/**
 * 命令注册表
 */
const commandRegistry = new Map<string, { ctor: CommandConstructor; metadata: CommandMetadata }>();

export class CommandStore {
    /**
     * 注册命令
     * @param metadata 命令元数据
     * @param ctor 命令构造函数
     */
    static register(metadata: CommandMetadata, ctor: CommandConstructor): void {
        commandRegistry.set(metadata.key, { ctor, metadata });
        
        // 设置元数据到原型
        (ctor.prototype as any).__commandMetadata = metadata;
    }

    /**
     * 创建命令实例
     * @param key 命令键
     * @param args 构造函数参数
     */
    static create<T extends ICommand>(key: string, ...args: any[]): T {
        const entry = commandRegistry.get(key);
        if (!entry) {
            throw new Error(`Command not found: ${key}`);
        }
        return new entry.ctor(...args) as T;
    }

    /**
     * 获取命令元数据
     * @param key 命令键
     */
    static getMetadata(key: string): CommandMetadata | undefined {
        return commandRegistry.get(key)?.metadata;
    }

    /**
     * 获取所有已注册的命令
     */
    static getAllCommands(): CommandMetadata[] {
        return Array.from(commandRegistry.values()).map(entry => entry.metadata);
    }

    /**
     * 检查命令是否存在
     * @param key 命令键
     */
    static has(key: string): boolean {
        return commandRegistry.has(key);
    }

    /**
     * 注销命令
     * @param key 命令键
     */
    static unregister(key: string): void {
        commandRegistry.delete(key);
    }

    /**
     * 清空所有注册
     */
    static clear(): void {
        commandRegistry.clear();
    }
}

/**
 * 命令装饰器
 * 
 * 用法:
 * @command({ key: 'extrude', name: '拉伸', category: '3D' })
 * class ExtrudeCommand extends CancelableCommand { ... }
 */
export function command(metadata: CommandMetadata) {
    return function <T extends CommandConstructor>(ctor: T): T {
        CommandStore.register(metadata, ctor);
        return ctor;
    };
}
