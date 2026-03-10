// Global test setup file
import { vi } from 'vitest';

// Mock browser APIs for Node.js test environment
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = vi.fn((callback: FrameRequestCallback): number => {
    // Execute callback synchronously in tests
    callback((globalThis as any).performance.now());
    return 0;
  });
  
  (globalThis as any).cancelAnimationFrame = vi.fn();
}

if (typeof globalThis.performance === 'undefined') {
  (globalThis as any).performance = {
    now: () => Date.now(),
  };
}

// Mock DOM APIs if needed
if (typeof globalThis.HTMLElement === 'undefined') {
  class MockHTMLElement {
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    appendChild = vi.fn();
    removeChild = vi.fn();
    getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    });
  }
  
  (globalThis as any).HTMLElement = MockHTMLElement;
  (globalThis as any).HTMLDivElement = MockHTMLElement;
  (globalThis as any).HTMLCanvasElement = MockHTMLElement;
}

// Create a mock document object
if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElement: vi.fn(() => {
      const element = new (globalThis as any).HTMLElement();
      return element;
    }),
    createElementNS: vi.fn().mockImplementation(() => ({
      setAttribute: vi.fn(),
    })),
  };
}

// Add test utilities
(globalThis as any).testUtils = {
  createPoint: (x: number, y: number) => ({ x, y }),
  createDigitalSegment: (type: 'line' | 'arc' | 'bezier', points: { x: number, y: number }[]) => ({
    id: `segment-${Math.random().toString(36).substr(2, 9)}`,
    type,
    points,
    color: '#000000',
  }),
  createStroke: (strokeType: 'artistic' | 'digital', points?: { x: number, y: number }[]) => ({
    id: `stroke-${Math.random().toString(36).substr(2, 9)}`,
    points: points || [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    smoothedPoints: points || [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    color: '#000000',
    thickness: 2,
    timestamp: Date.now(),
    strokeType,
  }),
};

// Mock Three.js for tests that import it
vi.mock('three', () => ({
  Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z })),
  Vector2: vi.fn().mockImplementation((x = 0, y = 0) => ({ x, y })),
  Object3D: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    dispose: vi.fn(),
  })),
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    dispose: vi.fn(),
  })),
  OrthographicCamera: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    updateProjectionMatrix: vi.fn(),
    dispose: vi.fn(),
  })),
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: (globalThis as any).document.createElement('canvas'),
  })),
  DirectionalLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    dispose: vi.fn(),
  })),
  AmbientLight: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
  GridHelper: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
  AxesHelper: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
  TubeGeometry: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
  MeshBasicMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
  Mesh: vi.fn().mockImplementation(() => ({
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() },
    dispose: vi.fn(),
  })),
  Color: vi.fn().mockImplementation((color) => ({ 
    getHexString: vi.fn().mockReturnValue(color || '000000')
  })),
  BufferGeometry: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}));