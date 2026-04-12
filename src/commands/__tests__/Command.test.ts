/**
 * 命令系统单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    CancelableCommand, 
    MultistepCommand, 
    SimpleStep,
    type ICommand,
    type IStep
} from '../Command';
import { CommandStore, command } from '../CommandStore';

describe('Command System', () => {
    beforeEach(() => {
        CommandStore.clear();
    });

    describe('CancelableCommand', () => {
        it('should execute successfully', async () => {
            class TestCommand extends CancelableCommand {
                name = 'Test Command';
                executed = false;

                protected async executeAsync(): Promise<void> {
                    this.executed = true;
                }

                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestCommand();
            await cmd.execute();

            expect(cmd.executed).toBe(true);
            expect(cmd.isCompleted).toBe(true);
            expect(cmd.isCanceled).toBe(false);
        });

        it('should handle cancellation', async () => {
            class TestCommand extends CancelableCommand {
                name = 'Test Command';

                protected async executeAsync(): Promise<void> {
                    await this.cancel();
                }

                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestCommand();
            await cmd.execute();

            expect(cmd.isCanceled).toBe(true);
        });

        it('should throw if already executed', async () => {
            class TestCommand extends CancelableCommand {
                name = 'Test Command';

                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestCommand();
            await cmd.execute();

            await expect(cmd.execute()).rejects.toThrow();
        });

        it('should call beforeExecute and afterExecute hooks', async () => {
            const beforeExecute = vi.fn();
            const afterExecute = vi.fn();

            class TestCommand extends CancelableCommand {
                name = 'Test Command';

                protected beforeExecute(): void {
                    beforeExecute();
                }

                protected async executeAsync(): Promise<void> {}

                protected afterExecute(): void {
                    afterExecute();
                }

                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestCommand();
            await cmd.execute();

            expect(beforeExecute).toHaveBeenCalledTimes(1);
            expect(afterExecute).toHaveBeenCalledTimes(1);
        });
    });

    describe('MultistepCommand', () => {
        it('should execute all steps successfully', async () => {
            const stepResults: number[] = [];

            class TestMultistepCommand extends MultistepCommand {
                name = 'Test Multistep Command';

                protected getSteps(): IStep[] {
                    return [
                        new SimpleStep(async () => {
                            stepResults.push(1);
                            return { data: 1 };
                        }),
                        new SimpleStep(async () => {
                            stepResults.push(2);
                            return { data: 2 };
                        })
                    ];
                }

                protected executeMainTask(): void {
                    // Main task
                }

                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestMultistepCommand();
            await cmd.execute();

            expect(stepResults).toEqual([1, 2]);
            expect(cmd.isCompleted).toBe(true);
        });

        it('should stop if step fails', async () => {
            const stepResults: number[] = [];

            class TestMultistepCommand extends MultistepCommand {
                name = 'Test Multistep Command';

                protected getSteps(): IStep[] {
                    return [
                        new SimpleStep(async () => {
                            stepResults.push(1);
                            return { data: 1 };
                        }),
                        new SimpleStep(async () => {
                            stepResults.push(2);
                            return undefined;  // Fail
                        })
                    ];
                }

                protected executeMainTask(): void {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestMultistepCommand();
            await cmd.execute();

            expect(stepResults).toEqual([1, 2]);
            expect(cmd.isCompleted).toBe(false);  // Should not complete
        });

        it('should reset step datas on restart', async () => {
            class TestMultistepCommand extends MultistepCommand {
                name = 'Test Multistep Command';

                protected getSteps(): IStep[] {
                    return [
                        new SimpleStep(async () => ({ data: 1 }))
                    ];
                }

                protected executeMainTask(): void {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = new TestMultistepCommand();
            await cmd.execute();
            
            expect(cmd['stepDatas'].length).toBe(1);

            await cmd.cancel();
            cmd['resetStepDatas']();
            
            expect(cmd['stepDatas'].length).toBe(0);
        });
    });

    describe('SimpleStep', () => {
        it('should execute step function', async () => {
            const testFn = vi.fn(() => 'result');
            const step = new SimpleStep(testFn);

            const result = await step.execute();

            expect(testFn).toHaveBeenCalledTimes(1);
            expect(result).toBe('result');
        });

        it('should handle async step function', async () => {
            const testFn = vi.fn(async () => 'async result');
            const step = new SimpleStep(testFn);

            const result = await step.execute();

            expect(testFn).toHaveBeenCalledTimes(1);
            expect(result).toBe('async result');
        });
    });

    describe('CommandStore', () => {
        it('should register command', () => {
            @command({
                key: 'test.command',
                name: 'Test Command',
                category: 'Test'
            })
            class TestCommand extends CancelableCommand {
                name = 'Test Command';
                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            expect(CommandStore.has('test.command')).toBe(true);
        });

        it('should create command instance', () => {
            @command({
                key: 'test.command2',
                name: 'Test Command 2',
                category: 'Test'
            })
            class TestCommand2 extends CancelableCommand {
                name = 'Test Command 2';
                
                constructor(private value: number) {
                    super();
                }

                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const cmd = CommandStore.create<TestCommand2>('test.command2', 42);
            
            expect(cmd).toBeInstanceOf(TestCommand2);
            expect(cmd['value']).toBe(42);
        });

        it('should throw if command not found', () => {
            expect(() => CommandStore.create('nonexistent.command')).toThrow();
        });

        it('should get command metadata', () => {
            @command({
                key: 'test.command3',
                name: 'Test Command 3',
                category: 'Test',
                description: 'Test description'
            })
            class TestCommand3 extends CancelableCommand {
                name = 'Test Command 3';
                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const metadata = CommandStore.getMetadata('test.command3');
            
            expect(metadata).toBeDefined();
            expect(metadata?.name).toBe('Test Command 3');
            expect(metadata?.category).toBe('Test');
        });

        it('should get all commands', () => {
            @command({
                key: 'test.all1',
                name: 'All Test 1',
                category: 'Test'
            })
            class Test1 extends CancelableCommand {
                name = 'Test 1';
                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            @command({
                key: 'test.all2',
                name: 'All Test 2',
                category: 'Test'
            })
            class Test2 extends CancelableCommand {
                name = 'Test 2';
                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            const allCommands = CommandStore.getAllCommands();
            
            expect(allCommands.length).toBeGreaterThanOrEqual(2);
        });

        it('should unregister command', () => {
            @command({
                key: 'test.unregister',
                name: 'Unregister Test',
                category: 'Test'
            })
            class UnregisterTest extends CancelableCommand {
                name = 'Unregister Test';
                protected async executeAsync(): Promise<void> {}
                async undo(): Promise<void> {}
                async redo(): Promise<void> {}
            }

            expect(CommandStore.has('test.unregister')).toBe(true);
            CommandStore.unregister('test.unregister');
            expect(CommandStore.has('test.unregister')).toBe(false);
        });
    });

    describe('Integration', () => {
        it('should work with transaction pattern', async () => {
            const operations: string[] = [];

            @command({
                key: 'integration.test',
                name: 'Integration Test',
                category: 'Test'
            })
            class IntegrationTestCommand extends CancelableCommand {
                name = 'Integration Test';

                protected async executeAsync(): Promise<void> {
                    operations.push('execute');
                }

                async undo(): Promise<void> {
                    operations.push('undo');
                }

                async redo(): Promise<void> {
                    operations.push('redo');
                }
            }

            const cmd = CommandStore.create<IntegrationTestCommand>('integration.test');
            
            await cmd.execute();
            expect(operations).toContain('execute');

            await cmd.undo();
            expect(operations).toContain('undo');

            await cmd.redo();
            expect(operations).toContain('redo');
        });
    });
});
