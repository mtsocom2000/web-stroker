import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrawingCommander } from '../controllers/DrawingCommander';
import { DrawingStateManager } from '../managers/DrawingStateManager';
import type { Point, Stroke } from '../types';

describe('DrawingCommander', () => {
  let commander: DrawingCommander;
  let mockRenderer: {
    executeCommands: ReturnType<typeof vi.fn>;
    worldToScreen: ReturnType<typeof vi.fn>;
    screenToWorld: ReturnType<typeof vi.fn>;
    setViewState: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
  };
  let stateManager: DrawingStateManager;

  beforeEach(() => {
    mockRenderer = {
      executeCommands: vi.fn(),
      worldToScreen: vi.fn((p: Point) => ({ x: p.x, y: p.y })),
      screenToWorld: vi.fn((x: number, y: number) => ({ x, y })),
      setViewState: vi.fn(),
      initialize: vi.fn(),
      dispose: vi.fn(),
      resize: vi.fn(),
    };

    stateManager = new DrawingStateManager();
    commander = new DrawingCommander(stateManager, mockRenderer as any);
  });

  describe('Command Generation', () => {
    it('should generate stroke commands', () => {
      const stroke: Stroke = {
        id: 'test-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [{
          id: 'seg-1',
          type: 'line',
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          color: '#000000'
        }]
      };

      stateManager.setStrokes([stroke]);
      stateManager.setCurrentTool('select');
      stateManager.setSelectMode('line');
      commander.render();

      expect(mockRenderer.executeCommands).toHaveBeenCalled();
      const commands = mockRenderer.executeCommands.mock.calls[0][0];
      expect(commands.length).toBeGreaterThanOrEqual(1);
      const strokeCmd = commands.find((c: any) => c.type === 'stroke');
      expect(strokeCmd).toBeDefined();
      expect(strokeCmd.geometry.type).toBe('line');
    });

    it('should generate preview commands with dashed style', () => {
      commander.setLinePreview(
        [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        { x: 150, y: 0 }
      );
      commander.render();

      const commands = mockRenderer.executeCommands.mock.calls[0][0];
      const previewCommand = commands.find((c: any) => c.type === 'preview');

      expect(previewCommand).toBeDefined();
      expect(previewCommand.style.lineStyle).toBe('dashed');
      expect(previewCommand.style.opacity).toBe(0.6);
    });

    it('should generate circle preview command', () => {
      commander.setCirclePreview(
        { x: 50, y: 50 },
        { x: 100, y: 50 }
      );
      commander.render();

      const commands = mockRenderer.executeCommands.mock.calls[0][0];
      const circleCommand = commands.find((c: any) =>
        c.type === 'preview' && c.geometry.type === 'circle'
      );

      expect(circleCommand).toBeDefined();
      expect(circleCommand.geometry.center).toEqual({ x: 50, y: 50 });
      expect(circleCommand.geometry.radius).toBe(50);
    });

    it('should generate highlight command for selected segment in select mode', () => {
      const stroke: Stroke = {
        id: 'test-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [{
          id: 'seg-1',
          type: 'line',
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          color: '#000000'
        }]
      };

      stateManager.setStrokes([stroke]);
      stateManager.setCurrentTool('select');
      stateManager.setSelectMode('line');
      stateManager.setSelectedElements([{
        type: 'segment',
        strokeId: 'test-1',
        segmentIndex: 0,
      }]);

      commander.render();

      const commands = mockRenderer.executeCommands.mock.calls[0][0];
      const highlightCommand = commands.find((c: any) => c.type === 'highlight');

      expect(highlightCommand).toBeDefined();
      expect(highlightCommand.style.color).toBe('#2196f3'); // SELECT_COLOR
    });

    it('should generate hover highlight with different color', () => {
      const stroke: Stroke = {
        id: 'test-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [{
          id: 'seg-1',
          type: 'line',
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          color: '#000000'
        }]
      };

      stateManager.setStrokes([stroke]);
      stateManager.setCurrentTool('select');
      stateManager.setSelectMode('line');
      stateManager.setHoveredElement({
        type: 'segment',
        strokeId: 'test-1',
        segmentIndex: 0,
      });

      commander.render();

      const commands = mockRenderer.executeCommands.mock.calls[0][0];
      const hoverCommand = commands.find((c: any) =>
        c.type === 'highlight' && c.isHovered === true
      );

      expect(hoverCommand).toBeDefined();
      expect(hoverCommand.style.color).toBe('#ff5722'); // HOVER_COLOR
    });
  });

  describe('Z-Index Ordering', () => {
    it('should order commands by zIndex', () => {
      const stroke: Stroke = {
        id: 'test-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [{
          id: 'seg-1',
          type: 'line',
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          color: '#000000'
        }]
      };

      stateManager.setStrokes([stroke]);
      commander.setLinePreview([{ x: 0, y: 0 }], null);
      commander.render();

      const commands = mockRenderer.executeCommands.mock.calls[0][0];

      // Verify zIndex ordering
      for (let i = 1; i < commands.length; i++) {
        expect(commands[i].zIndex).toBeGreaterThanOrEqual(commands[i - 1].zIndex);
      }
    });
  });

  describe('Clear Previews', () => {
    it('should clear all previews', () => {
      commander.setLinePreview([{ x: 0, y: 0 }], { x: 50, y: 0 });
      commander.setCirclePreview({ x: 50, y: 50 }, { x: 100, y: 50 });
      commander.clearPreviews();
      commander.render();

      const commands = mockRenderer.executeCommands.mock.calls[0][0];
      const previewCommands = commands.filter((c: any) => c.type === 'preview');
      expect(previewCommands).toHaveLength(0);
    });
  });

  describe('Debug Info', () => {
    it('should return command count', () => {
      const stroke: Stroke = {
        id: 'test-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [{
          id: 'seg-1',
          type: 'line',
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          color: '#000000'
        }]
      };

      stateManager.setStrokes([stroke]);
      stateManager.setCurrentTool('select');
      stateManager.setSelectMode('line');
      commander.render();

      const debugInfo = commander.getDebugInfo();
      expect(debugInfo.commandCount).toBeGreaterThanOrEqual(1);
      expect(debugInfo.isRendering).toBe(false);
    });
  });
});
