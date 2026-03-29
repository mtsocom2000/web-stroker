import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingStateManager } from '../managers/DrawingStateManager';
import type { Point, Stroke, SelectableElement } from '../types';

describe('DrawingStateManager', () => {
  let manager: DrawingStateManager;

  beforeEach(() => {
    manager = new DrawingStateManager();
  });

  describe('Tool State', () => {
    it('should set current tool', () => {
      manager.setCurrentTool('line');
      expect(manager.getCurrentTool()).toBe('line');
    });

    it('should set select mode', () => {
      manager.setSelectMode('point');
      expect(manager.getSelectMode()).toBe('point');
    });

    it('should clear all state', () => {
      manager.setCurrentTool('circle');
      manager.setSelectMode('arc');
      manager.updatePreviewState({
        line: { points: [{ x: 0, y: 0 }], previewEnd: { x: 50, y: 0 } }
      });
      manager.setSelectedElements([{
        type: 'segment',
        strokeId: 'stroke-1',
        segmentIndex: 0,
      }]);
      manager.clear();
      
      // clear() resets preview, selection, and drag state
      expect(manager.getPreviewState().line).toBeUndefined();
      expect(manager.getSelectionState().selectedElements).toHaveLength(0);
      expect(manager.getDragState().isDragging).toBe(false);
    });
  });

  describe('Stroke Management', () => {
    it('should set strokes', () => {
      const strokes: Stroke[] = [{
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
      }];

      manager.setStrokes(strokes);
      const commands = manager.getRenderCommands();
      const strokeCommands = commands.filter(c => c.type === 'stroke');
      expect(strokeCommands).toHaveLength(1);
    });
  });

  describe('Preview State', () => {
    it('should set line preview', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      manager.updatePreviewState({
        line: { points, previewEnd: { x: 150, y: 0 } }
      });

      const preview = manager.getPreviewState();
      expect(preview.line).toBeDefined();
      expect(preview.line?.points).toHaveLength(2);
    });

    it('should set circle preview', () => {
      manager.updatePreviewState({
        circle: { center: { x: 50, y: 50 }, radiusPoint: { x: 100, y: 50 } }
      });

      const preview = manager.getPreviewState();
      expect(preview.circle).toBeDefined();
      expect(preview.circle?.center).toEqual({ x: 50, y: 50 });
    });

    it('should clear preview', () => {
      manager.updatePreviewState({
        line: { points: [{ x: 0, y: 0 }], previewEnd: null }
      });
      manager.clearPreviewState();

      const preview = manager.getPreviewState();
      expect(preview.line).toBeUndefined();
    });
  });

  describe('Selection', () => {
    it('should set selected elements', () => {
      const elements: SelectableElement[] = [{
        type: 'endpoint',
        strokeId: 'stroke-1',
        segmentIndex: 0,
      }];

      manager.setSelectedElements(elements);
      expect(manager.getSelectionState().selectedElements).toHaveLength(1);
    });

    it('should set hovered element', () => {
      const element: SelectableElement = {
        type: 'segment',
        strokeId: 'stroke-1',
        segmentIndex: 0,
      };

      manager.setHoveredElement(element);
      expect(manager.getSelectionState().hoveredElement?.type).toBe('segment');
    });

    it('should clear selection', () => {
      manager.setSelectedElements([{
        type: 'endpoint',
        strokeId: 'stroke-1',
        segmentIndex: 0,
      }]);
      manager.setSelectedElements([]);
      expect(manager.getSelectionState().selectedElements).toHaveLength(0);
    });
  });

  describe('Render Commands Generation', () => {
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

      manager.setStrokes([stroke]);
      const commands = manager.getRenderCommands();

      expect(commands.length).toBeGreaterThanOrEqual(1);
      const strokeCmd = commands.find(c => c.type === 'stroke');
      expect(strokeCmd).toBeDefined();
      expect(strokeCmd?.geometry.type).toBe('line');
    });

    it('should generate preview commands', () => {
      manager.updatePreviewState({
        line: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], previewEnd: { x: 150, y: 0 } }
      });
      const commands = manager.getRenderCommands();

      const previewCommands = commands.filter(c => c.type === 'preview');
      expect(previewCommands).toHaveLength(1);
      expect(previewCommands[0].style.lineStyle).toBe('dashed');
    });

    it('should generate highlight commands for selection in select mode', () => {
      manager.setCurrentTool('select');
      manager.setSelectMode('line'); // Need line mode to select segments

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

      manager.setStrokes([stroke]);
      manager.setSelectedElements([{
        type: 'segment',
        strokeId: 'test-1',
        segmentIndex: 0,
      }]);

      const commands = manager.getRenderCommands();
      const highlightCommands = commands.filter(c => c.type === 'highlight');

      expect(highlightCommands.length).toBeGreaterThanOrEqual(1);
      expect(highlightCommands[0].style.color).toBe('#2196f3'); // SELECT_COLOR
    });

    it('should sort commands by zIndex', () => {
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

      manager.setStrokes([stroke]);
      manager.updatePreviewState({
        line: { points: [{ x: 0, y: 0 }], previewEnd: { x: 50, y: 0 } }
      });

      const commands = manager.getRenderCommands();

      // Verify zIndex ordering
      for (let i = 1; i < commands.length; i++) {
        expect(commands[i].zIndex).toBeGreaterThanOrEqual(commands[i - 1].zIndex);
      }
    });
  });

  describe('Select Mode Filtering', () => {
    it('should filter highlights based on select mode', () => {
      manager.setCurrentTool('select');
      manager.setSelectMode('line');

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

      manager.setStrokes([stroke]);

      // In line mode, segment selection should work
      manager.setSelectedElements([{
        type: 'segment',
        strokeId: 'test-1',
        segmentIndex: 0,
      }]);

      const commands = manager.getRenderCommands();
      const highlightCommands = commands.filter(c => c.type === 'highlight');

      // Should have highlight for segment in line mode
      expect(highlightCommands.length).toBeGreaterThanOrEqual(1);
    });

    it('should not highlight segments in point mode', () => {
      manager.setCurrentTool('select');
      manager.setSelectMode('point');

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

      manager.setStrokes([stroke]);

      // In point mode, segment selection should NOT highlight
      manager.setSelectedElements([{
        type: 'segment',
        strokeId: 'test-1',
        segmentIndex: 0,
      }]);

      const commands = manager.getRenderCommands();
      const highlightCommands = commands.filter(c => c.type === 'highlight' && c.strokeId === 'test-1');

      // Should NOT have highlight for segment in point mode
      expect(highlightCommands).toHaveLength(0);
    });
  });

  describe('Store Sync', () => {
    it('should sync from store state', () => {
      const mockStore = {
        strokes: [{
          id: 'test-1',
          strokeType: 'digital' as const,
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          color: '#000000',
          thickness: 2,
          timestamp: Date.now(),
        }],
        selectedStrokeIds: [],
        selectMode: 'line' as const,
        selectedElements: [],
        hoveredDigitalStrokeId: null,
        toolCategory: 'digital' as const,
        digitalMode: 'select' as const,
        digitalTool: 'line',
        activeTool: 'select',
      };

      manager.syncFromStore(mockStore);
      expect(manager.getSelectMode()).toBe('line');
      expect(manager.getCurrentTool()).toBe('select');
    });
  });
});
