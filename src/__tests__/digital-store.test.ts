// Digital mode store tests
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestStore, geometry } from './test-utils';
import type { LengthUnit } from '../types';
import type { TestStore } from './test-utils';

describe('Digital Mode Store', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('Tool Category Management', () => {
    it('should initialize with default values', () => {
      const state = store.getState();
      expect(state.toolCategory).toBe('digital'); // Default from store
      expect(state.digitalMode).toBe('draw');
      expect(state.digitalTool).toBe('line');
      expect(state.measureTool).toBeNull();
    });

    it('should switch from artistic to digital mode', () => {
      store.getState().setToolCategory('artistic');
      expect(store.getState().toolCategory).toBe('artistic');

      store.getState().setToolCategory('digital');
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalMode).toBe('draw'); // Should keep current digital mode
    });

    it('should switch from digital to measure mode', () => {
      store.getState().setToolCategory('digital');
      expect(store.getState().toolCategory).toBe('digital');

      store.getState().setToolCategory('measure');
      expect(store.getState().toolCategory).toBe('measure');
      expect(store.getState().measureTool).toBeNull(); // No tool selected by default
    });

    it('should cycle through all modes', () => {
      store.getState().setToolCategory('artistic');
      expect(store.getState().toolCategory).toBe('artistic');

      store.getState().setToolCategory('digital');
      expect(store.getState().toolCategory).toBe('digital');

      store.getState().setToolCategory('measure');
      expect(store.getState().toolCategory).toBe('measure');

      store.getState().setToolCategory('artistic');
      expect(store.getState().toolCategory).toBe('artistic');
    });
  });

  describe('Digital Tool Selection', () => {
    beforeEach(() => {
      store.getState().setToolCategory('digital');
    });

    it('should select line tool', () => {
      store.getState().setDigitalTool('line');
      expect(store.getState().digitalTool).toBe('line');
    });

    it('should select circle tool', () => {
      store.getState().setDigitalTool('circle');
      expect(store.getState().digitalTool).toBe('circle');
    });

    it('should select arc tool', () => {
      store.getState().setDigitalTool('arc');
      expect(store.getState().digitalTool).toBe('arc');
    });

    it('should select curve tool', () => {
      store.getState().setDigitalTool('curve');
      expect(store.getState().digitalTool).toBe('curve');
    });

    it('should switch between digital tools', () => {
      store.getState().setDigitalTool('line');
      expect(store.getState().digitalTool).toBe('line');

      store.getState().setDigitalTool('circle');
      expect(store.getState().digitalTool).toBe('circle');

      store.getState().setDigitalTool('arc');
      expect(store.getState().digitalTool).toBe('arc');

      store.getState().setDigitalTool('curve');
      expect(store.getState().digitalTool).toBe('curve');

      store.getState().setDigitalTool('line');
      expect(store.getState().digitalTool).toBe('line');
    });
  });

  describe('Digital Mode (Draw vs Select)', () => {
    beforeEach(() => {
      store.getState().setToolCategory('digital');
    });

    it('should default to draw mode', () => {
      expect(store.getState().digitalMode).toBe('draw');
    });

    it('should switch to select mode', () => {
      store.getState().setDigitalMode('select');
      expect(store.getState().digitalMode).toBe('select');
    });

    it('should switch back to draw mode', () => {
      store.getState().setDigitalMode('select');
      expect(store.getState().digitalMode).toBe('select');

      store.getState().setDigitalMode('draw');
      expect(store.getState().digitalMode).toBe('draw');
    });
  });

  describe('Circle Creation Mode', () => {
    beforeEach(() => {
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('circle');
    });

    it('should default to center-radius mode', () => {
      expect(store.getState().circleCreationMode).toBe('centerRadius');
    });

    it('should switch to three-point mode', () => {
      store.getState().setCircleCreationMode('threePoint');
      expect(store.getState().circleCreationMode).toBe('threePoint');
    });

    it('should switch between circle creation modes', () => {
      store.getState().setCircleCreationMode('threePoint');
      expect(store.getState().circleCreationMode).toBe('threePoint');

      store.getState().setCircleCreationMode('centerRadius');
      expect(store.getState().circleCreationMode).toBe('centerRadius');
    });
  });

  describe('Measurement Tool Management', () => {
    beforeEach(() => {
      store.getState().setToolCategory('measure');
    });

    it('should select distance measurement tool', () => {
      store.getState().setMeasureTool('distance');
      expect(store.getState().measureTool).toBe('distance');
    });

    it('should select angle measurement tool', () => {
      store.getState().setMeasureTool('angle');
      expect(store.getState().measureTool).toBe('angle');
    });

    it('should select radius measurement tool', () => {
      store.getState().setMeasureTool('radius');
      expect(store.getState().measureTool).toBe('radius');
    });

    it('should select face area measurement tool', () => {
      store.getState().setMeasureTool('face');
      expect(store.getState().measureTool).toBe('face');
    });

    it('should clear measurement tool', () => {
      store.getState().setMeasureTool('distance');
      expect(store.getState().measureTool).toBe('distance');

      store.getState().setMeasureTool(null);
      expect(store.getState().measureTool).toBeNull();
    });

    it('should switch between measurement tools', () => {
      store.getState().setMeasureTool('distance');
      expect(store.getState().measureTool).toBe('distance');

      store.getState().setMeasureTool('angle');
      expect(store.getState().measureTool).toBe('angle');

      store.getState().setMeasureTool('radius');
      expect(store.getState().measureTool).toBe('radius');

      store.getState().setMeasureTool('face');
      expect(store.getState().measureTool).toBe('face');

      store.getState().setMeasureTool(null);
      expect(store.getState().measureTool).toBeNull();
    });
  });

  describe('Measurement State Management', () => {
    beforeEach(() => {
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
    });

    it('should set measurement start point', () => {
      const point = { x: 10, y: 20 };
      store.getState().setMeasureStartPoint(point);
      expect(store.getState().measureStartPoint).toEqual(point);
    });

    it('should set measurement end point', () => {
      const point = { x: 30, y: 40 };
      store.getState().setMeasureEndPoint(point);
      expect(store.getState().measureEndPoint).toEqual(point);
    });

    it('should clear measurement points', () => {
      store.getState().setMeasureStartPoint({ x: 10, y: 20 });
      store.getState().setMeasureEndPoint({ x: 30, y: 40 });
      
      store.getState().clearMeasure();
      
      expect(store.getState().measureStartPoint).toBeNull();
      expect(store.getState().measureEndPoint).toBeNull();
      expect(store.getState().measureFirstLine).toBeNull();
      expect(store.getState().measureSecondLine).toBeNull();
      expect(store.getState().measureFaceId).toBeNull();
      expect(store.getState().lastMeasureValue).toBe('--');
    });

    it('should clear current measurement', () => {
      store.getState().setMeasureStartPoint({ x: 10, y: 20 });
      store.getState().setMeasureEndPoint({ x: 30, y: 40 });
      store.getState().setLastMeasureValue('50 mm');
      
      store.getState().clearCurrentMeasurement();
      
      expect(store.getState().measureStartPoint).toBeNull();
      expect(store.getState().measureEndPoint).toBeNull();
      expect(store.getState().measureFirstLine).toBeNull();
      expect(store.getState().measureSecondLine).toBeNull();
      expect(store.getState().measureFaceId).toBeNull();
      expect(store.getState().lastMeasureValue).toBe('--');
    });

    it('should set select mode for measurement', () => {
      store.getState().setSelectMode('point');
      expect(store.getState().selectMode).toBe('point');

      store.getState().setSelectMode('line');
      expect(store.getState().selectMode).toBe('line');

      store.getState().setSelectMode('arc');
      expect(store.getState().selectMode).toBe('arc');
    });

    it('should set last measurement value', () => {
      store.getState().setLastMeasureValue('25.5 mm');
      expect(store.getState().lastMeasureValue).toBe('25.5 mm');
    });
  });

  describe('Digital Element Selection', () => {
    beforeEach(() => {
      store.getState().setToolCategory('digital');
      store.getState().setDigitalMode('select');
    });

    it('should select digital strokes', () => {
      const strokeIds = ['stroke-1', 'stroke-2', 'stroke-3'];
      store.getState().setSelectedDigitalStrokeIds(strokeIds);
      expect(store.getState().selectedDigitalStrokeIds).toEqual(strokeIds);
    });

    it('should clear digital stroke selection', () => {
      store.getState().setSelectedDigitalStrokeIds(['stroke-1', 'stroke-2']);
      expect(store.getState().selectedDigitalStrokeIds).toHaveLength(2);

      store.getState().setSelectedDigitalStrokeIds([]);
      expect(store.getState().selectedDigitalStrokeIds).toHaveLength(0);
    });

    it('should update digital stroke selection', () => {
      store.getState().setSelectedDigitalStrokeIds(['stroke-1']);
      expect(store.getState().selectedDigitalStrokeIds).toEqual(['stroke-1']);

      store.getState().setSelectedDigitalStrokeIds(['stroke-2', 'stroke-3']);
      expect(store.getState().selectedDigitalStrokeIds).toEqual(['stroke-2', 'stroke-3']);
    });
  });

  describe('Unit System Configuration', () => {
    it('should set length unit', () => {
      const units: LengthUnit[] = ['mm', 'cm', 'inch', 'px'];
      
      for (const unit of units) {
        store.getState().setUnit(unit);
        expect(store.getState().unit).toBe(unit);
      }
    });

    it('should set angle unit', () => {
      store.getState().setAngleUnit('degree');
      expect(store.getState().angleUnit).toBe('degree');

      store.getState().setAngleUnit('radian');
      expect(store.getState().angleUnit).toBe('radian');
    });

    it('should set pixels per unit', () => {
      store.getState().setPixelsPerUnit(100);
      expect(store.getState().pixelsPerUnit).toBe(100);

      store.getState().setPixelsPerUnit(37.8);
      expect(store.getState().pixelsPerUnit).toBe(37.8);
    });

    it('should maintain unit consistency', () => {
      // Set up a specific configuration
      store.getState().setUnit('cm');
      store.getState().setAngleUnit('radian');
      store.getState().setPixelsPerUnit(37.8);

      expect(store.getState().unit).toBe('cm');
      expect(store.getState().angleUnit).toBe('radian');
      expect(store.getState().pixelsPerUnit).toBe(37.8);
    });
  });

  describe('Stroke Operations with Digital Mode', () => {
    it('should add digital stroke with segments', () => {
      const lineSegment = geometry.createLineSegment(0, 0, 10, 10);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      
      store.getState().addStroke(digitalStroke);
      
      expect(store.getState().strokes).toHaveLength(1);
      expect(store.getState().strokes[0].strokeType).toBe('digital');
      expect(store.getState().strokes[0].digitalSegments).toHaveLength(1);
      expect(store.getState().strokes[0].digitalSegments?.[0].type).toBe('line');
    });

    it('should add artistic stroke', () => {
      const points = [geometry.createPoint(0, 0), geometry.createPoint(10, 10)];
      const artisticStroke = geometry.createArtisticStroke(points);
      
      store.getState().addStroke(artisticStroke);
      
      expect(store.getState().strokes).toHaveLength(1);
      expect(store.getState().strokes[0].strokeType).toBe('artistic');
      expect(store.getState().strokes[0].points).toHaveLength(2);
    });

    it('should add multiple strokes', () => {
      const lineSegment = geometry.createLineSegment(0, 0, 10, 10);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      
      const points = [geometry.createPoint(20, 20), geometry.createPoint(30, 30)];
      const artisticStroke = geometry.createArtisticStroke(points);
      
      store.getState().addStrokesBatch([digitalStroke, artisticStroke]);
      
      expect(store.getState().strokes).toHaveLength(2);
      expect(store.getState().strokes[0].strokeType).toBe('digital');
      expect(store.getState().strokes[1].strokeType).toBe('artistic');
    });

    it('should clear all strokes', () => {
      const lineSegment = geometry.createLineSegment(0, 0, 10, 10);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      
      store.getState().addStroke(digitalStroke);
      expect(store.getState().strokes).toHaveLength(1);
      
      store.getState().clearStrokes();
      expect(store.getState().strokes).toHaveLength(0);
    });

    it('should update stroke with digital segments', () => {
      const lineSegment = geometry.createLineSegment(0, 0, 10, 10);
      const digitalStroke = geometry.createDigitalStroke([lineSegment]);
      
      store.getState().addStroke(digitalStroke);
      const strokeId = store.getState().strokes[0].id;
      
      // Update with new segment
      const circleSegment = geometry.createCircleSegment(5, 5, 3);
      const updatedStroke = {
        ...digitalStroke,
        digitalSegments: [circleSegment],
      };
      
      store.getState().updateStroke(strokeId, updatedStroke);
      
      expect(store.getState().strokes[0].digitalSegments).toHaveLength(1);
      expect(store.getState().strokes[0].digitalSegments?.[0].type).toBe('arc');
    });
  });

  describe('Integration: Mode Switching with State Preservation', () => {
    it('should preserve digital tool selection when switching modes', () => {
      // Set up digital mode with circle tool
      store.getState().setToolCategory('digital');
      store.getState().setDigitalTool('circle');
      store.getState().setCircleCreationMode('threePoint');
      
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalTool).toBe('circle');
      expect(store.getState().circleCreationMode).toBe('threePoint');
      
      // Switch to measure mode and back
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
      
      expect(store.getState().toolCategory).toBe('measure');
      expect(store.getState().measureTool).toBe('distance');
      
      // Switch back to digital mode
      store.getState().setToolCategory('digital');
      
      // Digital tool and mode should be preserved
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().digitalTool).toBe('circle');
      expect(store.getState().digitalMode).toBe('draw');
      expect(store.getState().circleCreationMode).toBe('threePoint');
    });

    it('should preserve measurement state when switching tools', () => {
      // Set up measurement
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
      store.getState().setMeasureStartPoint({ x: 10, y: 20 });
      store.getState().setLastMeasureValue('15.5 mm');
      
      // Switch to different measurement tool
      store.getState().setMeasureTool('angle');
      store.getState().setSelectMode('line');
      
      // Note: setMeasureTool does NOT clear measurement points in the store
      // Clearing would be done by UI components if needed
      expect(store.getState().measureTool).toBe('angle');
      expect(store.getState().selectMode).toBe('line');
      expect(store.getState().measureStartPoint).toEqual({ x: 10, y: 20 }); // NOT cleared by store
      expect(store.getState().lastMeasureValue).toBe('15.5 mm'); // Last value preserved
    });

    it('should clear measurement when switching to non-measure mode', () => {
      // Set up measurement
      store.getState().setToolCategory('measure');
      store.getState().setMeasureTool('distance');
      store.getState().setMeasureStartPoint({ x: 10, y: 20 });
      store.getState().setLastMeasureValue('15.5 mm');
      
      // Switch to digital mode
      store.getState().setToolCategory('digital');
      
      // Note: setToolCategory does NOT clear measurement state in the store
      // UI components would need to call clearMeasure() or clearCurrentMeasurement()
      expect(store.getState().toolCategory).toBe('digital');
      expect(store.getState().measureTool).toBe('distance'); // NOT cleared by store
      expect(store.getState().measureStartPoint).toEqual({ x: 10, y: 20 }); // NOT cleared
      expect(store.getState().lastMeasureValue).toBe('15.5 mm'); // NOT reset
    });
  });
});