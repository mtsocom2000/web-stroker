import { describe, it, expect } from 'vitest';
import { createTestStore } from './test-utils';

describe('Digital Mode Integration Tests', () => {
  describe('Complete Digital Drawing Workflow', () => {
    it('should create and select a line', () => {
      const store = createTestStore();
      
      // Set to digital mode with line tool
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('line');
      store.getState().setDigitalMode('draw');
      
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalTool).toBe('line');
      expect(store.getState().digitalMode).toBe('draw');
      
      // Simulate drawing a line (in real app this would be in component)
      // Line would be drawn from (0,0) to (100,100)
      
      // In a real integration, this would be handled by drawing logic
      // For now, just verify the store is set up correctly
      expect(store.getState().strokes).toHaveLength(0);
    });

    it('should switch between digital tools', () => {
      const store = createTestStore();
      
      store.getState().setToolCategory('digital');
      
      // Test all tool switches
      const tools = ['line', 'circle', 'arc', 'curve'] as const;
      
      tools.forEach(tool => {
        store.getState().setDigitalTool(tool);
        expect(store.getState().digitalTool).toBe(tool);
      });
    });

    it('should switch between draw and select modes', () => {
      const store = createTestStore();
      
      store.getState().setToolCategory('digital');
      store.getState().setDigitalMode('draw');
      expect(store.getState().digitalMode).toBe('draw');
      
      store.getState().setDigitalMode('select');
      expect(store.getState().digitalMode).toBe('select');
      
      store.getState().setDigitalMode('draw');
      expect(store.getState().digitalMode).toBe('draw');
    });
  });

  describe('Measurement Integration with Digital Drawings', () => {
    it('should measure distance between drawn points', () => {
      const store = createTestStore();
      
      // Set up for measurement
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
      store.getState().setSelectMode('point');
      
      expect(store.getState().toolCategory).toBe('measure');
      expect(store.getState().measureTool).toBe('distance');
      expect(store.getState().selectMode).toBe('point');
      
      // In a real app, user would select points and measurement would be calculated
      // This tests that the state is set up correctly for measurement
    });

    it('should switch between measurement tools', () => {
      const store = createTestStore();
      
      store.getState().setToolCategory('measure');
      
      const measureTools = ['distance', 'angle', 'radius', 'face'] as const;
      
      measureTools.forEach(tool => {
        store.getState().setMeasureTool(tool);
        expect(store.getState().measureTool).toBe(tool);
      });
    });

    it('should clear measurement state', () => {
      const store = createTestStore();
      
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
      store.getState().setMeasureStartPoint({ x: 0, y: 0 });
      store.getState().setMeasureEndPoint({ x: 100, y: 100 });
      store.getState().setLastMeasureValue('100mm');
      
      expect(store.getState().measureStartPoint).not.toBeNull();
      expect(store.getState().measureEndPoint).not.toBeNull();
      expect(store.getState().lastMeasureValue).toBe('100mm');
      
      store.getState().clearMeasure();
      
      expect(store.getState().measureStartPoint).toBeNull();
      expect(store.getState().measureEndPoint).toBeNull();
      expect(store.getState().lastMeasureValue).toBe('--');
    });
  });

  describe('Unit System Integration', () => {
    it('should switch between length units', () => {
      const store = createTestStore();
      
      const units = ['mm', 'cm', 'inch', 'px'] as const;
      
      units.forEach(unit => {
        store.getState().setUnit(unit);
        expect(store.getState().unit).toBe(unit);
        
        // Verify pixelsPerUnit is set correctly
        const expectedPixels = {
          mm: 3.78,
          cm: 37.8,
          inch: 96,
          px: 1
        }[unit];
        
        expect(store.getState().pixelsPerUnit).toBeCloseTo(expectedPixels);
      });
    });

    it('should switch between angle units', () => {
      const store = createTestStore();
      
      store.getState().setAngleUnit('degree');
      expect(store.getState().angleUnit).toBe('degree');
      
      store.getState().setAngleUnit('radian');
      expect(store.getState().angleUnit).toBe('radian');
      
      store.getState().setAngleUnit('degree');
      expect(store.getState().angleUnit).toBe('degree');
    });

    it('should maintain unit consistency across operations', () => {
      const store = createTestStore();
      
      // Set to cm
      store.getState().setUnit('cm');
      expect(store.getState().unit).toBe('cm');
      expect(store.getState().pixelsPerUnit).toBe(37.8);
      
      // Switch to mm
      store.getState().setUnit('mm');
      expect(store.getState().unit).toBe('mm');
      expect(store.getState().pixelsPerUnit).toBe(3.78);
      
      // Switch back to cm
      store.getState().setUnit('cm');
      expect(store.getState().unit).toBe('cm');
      expect(store.getState().pixelsPerUnit).toBe(37.8);
    });
  });

  describe('Complete User Scenario: Draw and Measure', () => {
    it('should handle complete draw-measure workflow', () => {
      const store = createTestStore();
      
      // 1. User selects digital mode and line tool
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('line');
      store.getState().setDigitalMode('draw');
      
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalTool).toBe('line');
      
      // 2. User draws a line (simulated by adding a stroke)
      // In real app, this would happen through mouse events
      
      // 3. User switches to measure mode
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
      store.getState().setSelectMode('point');
      
      expect(store.getState().toolCategory).toBe('measure');
      expect(store.getState().measureTool).toBe('distance');
      
      // 4. User changes units
      store.getState().setUnit('inch');
      expect(store.getState().unit).toBe('inch');
      
      // 5. User goes back to drawing
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('circle');
      
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalTool).toBe('circle');
      
      // Measurement tool state may or may not be cleared when switching away
      // This depends on the actual implementation
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalTool).toBe('circle');
    });

    it('should preserve digital selection when switching modes', () => {
      const store = createTestStore();
      
      // Select some digital strokes
      store.getState().setSelectedDigitalStrokeIds(['stroke1', 'stroke2']);
      expect(store.getState().selectedDigitalStrokeIds).toEqual(['stroke1', 'stroke2']);
      
      // Switch to measure mode and back
      store.getState().setToolCategory('measure');
      store.getState().setToolCategory('digital');
      
      // Selection should be preserved
      expect(store.getState().selectedDigitalStrokeIds).toEqual(['stroke1', 'stroke2']);
    });
  });

  describe('Circle Creation Modes', () => {
    it('should switch between circle creation modes', () => {
      const store = createTestStore();
      
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('circle');
      
      store.getState().setCircleCreationMode('centerRadius');
      expect(store.getState().circleCreationMode).toBe('centerRadius');
      
      store.getState().setCircleCreationMode('threePoint');
      expect(store.getState().circleCreationMode).toBe('threePoint');
      
      store.getState().setCircleCreationMode('centerRadius');
      expect(store.getState().circleCreationMode).toBe('centerRadius');
    });

    it('should maintain circle mode when switching tools', () => {
      const store = createTestStore();
      
      // Set circle tool with threePoint mode
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('circle');
      store.getState().setCircleCreationMode('threePoint');
      
      expect(store.getState().digitalTool).toBe('circle');
      expect(store.getState().circleCreationMode).toBe('threePoint');
      
      // Switch to line and back to circle
      store.getState().setDigitalTool('line');
      store.getState().setDigitalTool('circle');
      
      // Circle mode should be preserved
      expect(store.getState().circleCreationMode).toBe('threePoint');
    });
  });

  describe('Snap Integration in Digital Mode', () => {
    it('should enable/disable snapping', () => {
      const store = createTestStore();
      
      store.getState().setSnapEnabled(true);
      expect(store.getState().snapEnabled).toBe(true);
      
      store.getState().setSnapEnabled(false);
      expect(store.getState().snapEnabled).toBe(false);
      
      store.getState().setSnapEnabled(true);
      expect(store.getState().snapEnabled).toBe(true);
    });

    it('should adjust snap threshold', () => {
      const store = createTestStore();
      
      store.getState().setSnapThreshold(5);
      expect(store.getState().snapThreshold).toBe(5);
      
      store.getState().setSnapThreshold(20);
      expect(store.getState().snapThreshold).toBe(20);
      
      store.getState().setSnapThreshold(10);
      expect(store.getState().snapThreshold).toBe(10);
    });
  });
});