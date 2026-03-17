import { describe, it, expect } from 'vitest';
import { 
  worldToScreen, 
  screenToWorld, 
  worldDistanceToScreen, 
  screenDistanceToWorld,
  type ViewState 
} from '../utils/coordinates';

describe('Coordinate Utilities', () => {
  const defaultView: ViewState = { zoom: 1, panX: 0, panY: 0 };
  const canvasWidth = 800;
  const canvasHeight = 600;

  describe('worldToScreen', () => {
    it('should convert world origin to screen center', () => {
      const screen = worldToScreen({ x: 0, y: 0 }, defaultView, canvasWidth, canvasHeight);
      expect(screen.x).toBe(400); // 800 / 2
      expect(screen.y).toBe(300); // 600 / 2
    });

    it('should handle zoom correctly', () => {
      const zoomedView: ViewState = { zoom: 2, panX: 0, panY: 0 };
      const screen = worldToScreen({ x: 100, y: 100 }, zoomedView, canvasWidth, canvasHeight);
      expect(screen.x).toBe(600); // 400 + 100 * 2
      expect(screen.y).toBe(100); // 300 - 100 * 2 (Y is inverted)
    });

    it('should handle pan correctly', () => {
      const pannedView: ViewState = { zoom: 1, panX: 50, panY: -30 };
      const screen = worldToScreen({ x: 0, y: 0 }, pannedView, canvasWidth, canvasHeight);
      // x = (0 - 50) * 1 + 400 = 350
      expect(screen.x).toBe(350);
      // y = 300 - (0 - (-30)) * 1 = 300 - 30 = 270
      expect(screen.y).toBe(270);
    });

    it('should handle combined zoom and pan', () => {
      const complexView: ViewState = { zoom: 2, panX: 50, panY: -30 };
      const screen = worldToScreen({ x: 100, y: 100 }, complexView, canvasWidth, canvasHeight);
      // x = (100 - 50) * 2 + 400 = 100 * 2 + 400 = 600
      expect(screen.x).toBe(500);
      // y = 300 - (100 - (-30)) * 2 = 300 - 130 * 2 = 300 - 260 = 40
      expect(screen.y).toBe(40);
    });
  });

  describe('screenToWorld', () => {
    it('should convert screen center to world origin', () => {
      const world = screenToWorld(400, 300, defaultView, canvasWidth, canvasHeight);
      expect(world.x).toBeCloseTo(0, 5);
      expect(world.y).toBeCloseTo(0, 5);
    });

    it('should be inverse of worldToScreen', () => {
      const originalPoint = { x: 150, y: -75 };
      const screen = worldToScreen(originalPoint, defaultView, canvasWidth, canvasHeight);
      const backToWorld = screenToWorld(screen.x, screen.y, defaultView, canvasWidth, canvasHeight);
      
      expect(backToWorld.x).toBeCloseTo(originalPoint.x, 5);
      expect(backToWorld.y).toBeCloseTo(originalPoint.y, 5);
    });

    it('should handle zoom correctly', () => {
      const zoomedView: ViewState = { zoom: 2, panX: 0, panY: 0 };
      // Screen point (600, 100) with zoom=2
      // x = (600 - 400) / 2 + 0 = 100
      // y = (300 - 100) / 2 + 0 = 100
      const world = screenToWorld(600, 100, zoomedView, canvasWidth, canvasHeight);
      expect(world.x).toBe(100);
      expect(world.y).toBe(100);
    });

    it('should handle pan correctly', () => {
      const pannedView: ViewState = { zoom: 1, panX: 50, panY: -30 };
      // Screen center (400, 300) with panX=50, panY=-30
      // x = (400 - 400) / 1 + 50 = 50
      // y = (300 - 300) / 1 + (-30) = -30
      const world = screenToWorld(400, 300, pannedView, canvasWidth, canvasHeight);
      expect(world.x).toBe(50);
      expect(world.y).toBe(-30);
    });
  });

  describe('Distance conversion', () => {
    it('should convert world distance to screen pixels', () => {
      expect(worldDistanceToScreen(100, 1)).toBe(100);
      expect(worldDistanceToScreen(100, 2)).toBe(200);
      expect(worldDistanceToScreen(100, 0.5)).toBe(50);
    });

    it('should convert screen pixels to world distance', () => {
      expect(screenDistanceToWorld(100, 1)).toBe(100);
      expect(screenDistanceToWorld(200, 2)).toBe(100);
      expect(screenDistanceToWorld(50, 0.5)).toBe(100);
    });

    it('should be inverse operations', () => {
      const original = 150;
      const zoom = 1.5;
      const screen = worldDistanceToScreen(original, zoom);
      const backToWorld = screenDistanceToWorld(screen, zoom);
      expect(backToWorld).toBe(original);
    });
  });

  describe('Coordinate consistency between renderers', () => {
    it('worldToScreen and screenToWorld should be inverses', () => {
      const testCases = [
        { point: { x: 0, y: 0 }, view: { zoom: 1, panX: 0, panY: 0 } },
        { point: { x: 100, y: 50 }, view: { zoom: 2, panX: 10, panY: -20 } },
        { point: { x: -75, y: 200 }, view: { zoom: 0.5, panX: -30, panY: 40 } },
        { point: { x: 500, y: -300 }, view: { zoom: 1.5, panX: 100, panY: -50 } },
      ];

      testCases.forEach(({ point, view }) => {
        const screen = worldToScreen(point, view, canvasWidth, canvasHeight);
        const backToWorld = screenToWorld(screen.x, screen.y, view, canvasWidth, canvasHeight);
        
        expect(backToWorld.x).toBeCloseTo(point.x, 5);
        expect(backToWorld.y).toBeCloseTo(point.y, 5);
      });
    });

    it('should handle edge cases', () => {
      // Very large coordinates
      const largePoint = { x: 10000, y: -10000 };
      const screen = worldToScreen(largePoint, defaultView, canvasWidth, canvasHeight);
      const backToWorld = screenToWorld(screen.x, screen.y, defaultView, canvasWidth, canvasHeight);
      expect(backToWorld.x).toBeCloseTo(largePoint.x, 0);
      expect(backToWorld.y).toBeCloseTo(largePoint.y, 0);

      // Very small zoom
      const tinyZoomView: ViewState = { zoom: 0.01, panX: 0, panY: 0 };
      const screen2 = worldToScreen({ x: 1000, y: 1000 }, tinyZoomView, canvasWidth, canvasHeight);
      const backToWorld2 = screenToWorld(screen2.x, screen2.y, tinyZoomView, canvasWidth, canvasHeight);
      expect(backToWorld2.x).toBeCloseTo(1000, 0);
      expect(backToWorld2.y).toBeCloseTo(1000, 0);

      // Very large zoom
      const hugeZoomView: ViewState = { zoom: 100, panX: 0, panY: 0 };
      const smallPoint = { x: 1, y: 1 };
      const screen3 = worldToScreen(smallPoint, hugeZoomView, canvasWidth, canvasHeight);
      const backToWorld3 = screenToWorld(screen3.x, screen3.y, hugeZoomView, canvasWidth, canvasHeight);
      expect(backToWorld3.x).toBeCloseTo(smallPoint.x, 5);
      expect(backToWorld3.y).toBeCloseTo(smallPoint.y, 5);
    });
  });
});
