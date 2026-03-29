import { describe, it, expect, beforeEach } from 'vitest';
import { SelectDragController } from '../controllers/SelectDragController';
import type { Point, Stroke } from '../types';

describe('SelectDragController', () => {
  let controller: SelectDragController;
  let strokes: Stroke[];

  beforeEach(() => {
    // Create test strokes
    strokes = [
      {
        id: 'stroke-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [
          {
            id: 'seg-1',
            type: 'line',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
            color: '#000000'
          }
        ]
      },
      {
        id: 'stroke-2',
        strokeType: 'digital',
        points: [{ x: 100, y: 0 }, { x: 100, y: 100 }],
        smoothedPoints: [{ x: 100, y: 0 }, { x: 100, y: 100 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [
          {
            id: 'seg-2',
            type: 'line',
            points: [{ x: 100, y: 0 }, { x: 100, y: 100 }],
            color: '#000000'
          }
        ]
      }
    ];

    controller = new SelectDragController(
      { selectMode: 'point', zoom: 1, threshold: 10 },
      strokes
    );
  });

  describe('Element Finding', () => {
    it('should find endpoint at given point', () => {
      // Click near the shared endpoint (100, 0)
      const element = controller.findElementAtPoint({ x: 100, y: 0 });

      expect(element).not.toBeNull();
      expect(element?.type).toBe('endpoint');
      expect(element?.strokeId).toBe('stroke-1'); // First stroke with matching endpoint
    });

    it('should find line segment', () => {
      controller = new SelectDragController(
        { selectMode: 'line', zoom: 1, threshold: 10 },
        strokes
      );

      // Click on the line
      const element = controller.findElementAtPoint({ x: 50, y: 0 });

      expect(element).not.toBeNull();
      expect(element?.type).toBe('segment');
    });

    it('should return null when no element found', () => {
      const element = controller.findElementAtPoint({ x: 1000, y: 1000 });
      expect(element).toBeNull();
    });
  });

  describe('Drag Operations', () => {
    it('should start drag', () => {
      const element = controller.findElementAtPoint({ x: 100, y: 0 });
      expect(element).not.toBeNull();

      controller.startDrag(element!, { x: 100, y: 0 });

      expect(controller.isDragging()).toBe(true);
      expect(controller.getSelectedElement()).toEqual(element);
    });

    it('should update drag offset', () => {
      const element = controller.findElementAtPoint({ x: 100, y: 0 });
      controller.startDrag(element!, { x: 100, y: 0 });

      controller.updateDrag({ x: 110, y: 20 });

      const offset = controller.getDragOffset();
      expect(offset.x).toBe(10);
      expect(offset.y).toBe(20);
    });

    it('should find affected strokes for shared endpoint', () => {
      const element = controller.findElementAtPoint({ x: 100, y: 0 });
      controller.startDrag(element!, { x: 100, y: 0 });

      // Both strokes share the endpoint at (100, 0)
      const state = controller.getState();
      expect(state.affectedStrokes.size).toBe(2);
      expect(state.affectedStrokes.has('stroke-1')).toBe(true);
      expect(state.affectedStrokes.has('stroke-2')).toBe(true);
    });

    it('should generate preview strokes during drag', () => {
      const element = controller.findElementAtPoint({ x: 100, y: 0 });
      controller.startDrag(element!, { x: 100, y: 0 });
      controller.updateDrag({ x: 110, y: 20 });

      const previewStrokes = controller.getPreviewStrokes();

      expect(previewStrokes).toHaveLength(2);
      
      // Check that the shared endpoint is moved in both strokes
      const stroke1 = previewStrokes.find(s => s.id === 'stroke-1');
      const stroke2 = previewStrokes.find(s => s.id === 'stroke-2');

      expect(stroke1).toBeDefined();
      expect(stroke2).toBeDefined();

      // The shared endpoint should be at (110, 20) in both strokes
      expect(stroke1!.digitalSegments![0].points[1]).toEqual({ x: 110, y: 20 });
      expect(stroke2!.digitalSegments![0].points[0]).toEqual({ x: 110, y: 20 });
    });

    it('should apply drag on end', () => {
      const element = controller.findElementAtPoint({ x: 100, y: 0 });
      controller.startDrag(element!, { x: 100, y: 0 });
      controller.updateDrag({ x: 110, y: 20 });

      const updatedStrokes = controller.endDrag();

      expect(updatedStrokes).not.toBeNull();
      expect(updatedStrokes!.size).toBe(2);

      // Verify the updated strokes
      const stroke1 = updatedStrokes!.get('stroke-1');
      expect(stroke1!.digitalSegments![0].points[1]).toEqual({ x: 110, y: 20 });
    });

    it('should cancel drag without applying changes', () => {
      const element = controller.findElementAtPoint({ x: 100, y: 0 });
      controller.startDrag(element!, { x: 100, y: 0 });
      controller.updateDrag({ x: 110, y: 20 });

      controller.cancelDrag();

      expect(controller.isDragging()).toBe(false);
      expect(controller.getPreviewStrokes()).toHaveLength(0);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance from point to segment', () => {
      const point: Point = { x: 50, y: 10 };

      // Distance from (50, 10) to line y=0 should be 10
      const element = controller.findElementAtPoint(point);
      expect(element).toBeNull(); // Too far from endpoint

      // But should find the segment when in line mode
      controller = new SelectDragController(
        { selectMode: 'line', zoom: 1, threshold: 15 },
        strokes
      );
      const segmentElement = controller.findElementAtPoint(point);
      expect(segmentElement).not.toBeNull();
      expect(segmentElement?.type).toBe('segment');
    });
  });

  describe('Points Equality', () => {
    it('should consider nearby points as equal', () => {
      // This is tested indirectly through the shared endpoint logic
      const element = controller.findElementAtPoint({ x: 100.001, y: 0.001 });
      expect(element).not.toBeNull();
      expect(element?.type).toBe('endpoint');
    });
  });
});

describe('SelectDragController - Segment Drag', () => {
  let controller: SelectDragController;
  let strokes: Stroke[];

  beforeEach(() => {
    strokes = [
      {
        id: 'stroke-1',
        strokeType: 'digital',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        smoothedPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [
          {
            id: 'seg-1',
            type: 'line',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
            color: '#000000'
          }
        ]
      }
    ];

    controller = new SelectDragController(
      { selectMode: 'line', zoom: 1, threshold: 10 },
      strokes
    );
  });

  it('should drag entire segment', () => {
    const element = controller.findElementAtPoint({ x: 50, y: 0 });
    expect(element?.type).toBe('segment');

    controller.startDrag(element!, { x: 50, y: 0 });
    controller.updateDrag({ x: 60, y: 10 });

    const previewStrokes = controller.getPreviewStrokes();
    expect(previewStrokes).toHaveLength(1);

    // Both endpoints should be moved
    const segment = previewStrokes[0].digitalSegments![0];
    expect(segment.points[0]).toEqual({ x: 10, y: 10 });
    expect(segment.points[1]).toEqual({ x: 110, y: 10 });
  });
});

describe('SelectDragController - Arc Drag', () => {
  let controller: SelectDragController;
  let strokes: Stroke[];

  beforeEach(() => {
    strokes = [
      {
        id: 'stroke-1',
        strokeType: 'digital',
        points: [],
        smoothedPoints: [],
        color: '#000000',
        thickness: 2,
        timestamp: Date.now(),
        digitalSegments: [
          {
            id: 'seg-1',
            type: 'arc',
            points: [],
            color: '#000000',
            arcData: {
              center: { x: 50, y: 50 },
              radius: 50,
              startAngle: 0,
              endAngle: Math.PI
            }
          }
        ]
      }
    ];

    controller = new SelectDragController(
      { selectMode: 'arc', zoom: 1, threshold: 10 },
      strokes
    );
  });

  it('should drag arc by moving center', () => {
    // Click on the arc (at angle 0, point is at (100, 50))
    const element = controller.findElementAtPoint({ x: 100, y: 50 });
    expect(element?.type).toBe('arc');

    controller.startDrag(element!, { x: 100, y: 50 });
    controller.updateDrag({ x: 110, y: 60 });

    const previewStrokes = controller.getPreviewStrokes();
    expect(previewStrokes).toHaveLength(1);

    // Center should be moved
    const arcData = previewStrokes[0].digitalSegments![0].arcData;
    expect(arcData!.center).toEqual({ x: 60, y: 60 });
    // Radius should remain the same
    expect(arcData!.radius).toBe(50);
  });
});
