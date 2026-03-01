import { describe, it, expect } from 'vitest';
import type { Point, Stroke } from '../types';
import {
  findNearestIntegerPoint,
  findNearestOriginPoint,
  findNearestPolylinePoint,
  findNearestStrokePoint,
  findNearestIntersectionPoint,
  findBestSnapPoint,
} from '../measurements';

describe('findNearestIntegerPoint', () => {
  it('should snap to integer when within threshold', () => {
    const point = { x: 50.5, y: 40.3 };
    const result = findNearestIntegerPoint(point, 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 51, y: 40 });
    expect(result!.type).toBe('integer');
  });

  it('should return null when outside threshold', () => {
    const point = { x: 50.5, y: 40.5 };
    const result = findNearestIntegerPoint(point, 0.3);
    expect(result).toBeNull();
  });

  it('should snap to negative integers', () => {
    const point = { x: -5.2, y: -3.8 };
    const result = findNearestIntegerPoint(point, 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: -5, y: -4 });
  });

  it('should handle zero threshold', () => {
    const point = { x: 50, y: 40 };
    const result = findNearestIntegerPoint(point, 0);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 50, y: 40 });
  });
});

describe('findNearestOriginPoint', () => {
  it('should snap to origin when within threshold', () => {
    const point = { x: 5.2, y: 8.1 };
    const result = findNearestOriginPoint(point, 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 0, y: 0 });
    expect(result!.type).toBe('origin');
  });

  it('should return null when outside threshold', () => {
    const point = { x: 15, y: 15 };
    const result = findNearestOriginPoint(point, 10);
    expect(result).toBeNull();
  });

  it('should handle point at origin', () => {
    const point = { x: 0, y: 0 };
    const result = findNearestOriginPoint(point, 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 0, y: 0 });
  });
});

describe('findNearestPolylinePoint', () => {
  it('should snap to polyline point when within threshold', () => {
    const point = { x: 100.3, y: 200.5 };
    const polylinePoints = [
      { x: 50, y: 100 },
      { x: 100, y: 200 },
      { x: 150, y: 300 },
    ];
    const result = findNearestPolylinePoint(point, polylinePoints, 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 100, y: 200 });
    expect(result!.type).toBe('polylinePoint');
  });

  it('should return null when outside threshold', () => {
    const point = { x: 100, y: 100 };
    const polylinePoints = [
      { x: 50, y: 50 },
      { x: 200, y: 200 },
    ];
    const result = findNearestPolylinePoint(point, polylinePoints, 10);
    expect(result).toBeNull();
  });

  it('should find nearest among multiple points', () => {
    const point = { x: 100, y: 100 };
    const polylinePoints = [
      { x: 50, y: 50 },
      { x: 100, y: 90 },
      { x: 100, y: 110 },
    ];
    const result = findNearestPolylinePoint(point, polylinePoints, 20);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 100, y: 90 });
    expect(result!.distance).toBe(10);
  });

  it('should handle empty polyline points', () => {
    const point = { x: 100, y: 100 };
    const result = findNearestPolylinePoint(point, [], 10);
    expect(result).toBeNull();
  });
});

describe('findNearestStrokePoint', () => {
  const createDigitalStroke = (id: string, points: Point[]): Stroke => ({
    id,
    points,
    smoothedPoints: points,
    color: '#000',
    thickness: 1,
    timestamp: Date.now(),
    strokeType: 'digital',
    digitalSegments: [
      {
        id: `${id}:0`,
        type: 'line',
        points,
        color: '#000',
      },
    ],
  });

  it('should snap to stroke start point when within threshold', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 50, y: 100 }, { x: 150, y: 200 }]);
    const point = { x: 52, y: 102 };
    const result = findNearestStrokePoint(point, [stroke], 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 50, y: 100 });
    expect(result!.type).toBe('strokePoint');
  });

  it('should snap to stroke end point when within threshold', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 50, y: 100 }, { x: 150, y: 200 }]);
    const point = { x: 148, y: 198 };
    const result = findNearestStrokePoint(point, [stroke], 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 150, y: 200 });
  });

  it('should return null when outside threshold', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 50, y: 100 }, { x: 150, y: 200 }]);
    const point = { x: 200, y: 300 };
    const result = findNearestStrokePoint(point, [stroke], 10);
    expect(result).toBeNull();
  });

  it('should find nearest among multiple strokes', () => {
    const stroke1 = createDigitalStroke('stroke1', [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
    const stroke2 = createDigitalStroke('stroke2', [{ x: 200, y: 200 }, { x: 250, y: 250 }]);
    const point = { x: 100, y: 90 };
    const result = findNearestStrokePoint(point, [stroke1, stroke2], 20);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 100, y: 100 });
  });

  it('should ignore artistic strokes', () => {
    const artisticStroke: Stroke = {
      id: 'artistic1',
      points: [{ x: 50, y: 100 }, { x: 150, y: 200 }],
      smoothedPoints: [{ x: 50, y: 100 }, { x: 150, y: 200 }],
      color: '#000',
      thickness: 1,
      timestamp: Date.now(),
      strokeType: 'artistic',
    };
    const point = { x: 52, y: 102 };
    const result = findNearestStrokePoint(point, [artisticStroke], 10);
    expect(result).toBeNull();
  });
});

describe('findNearestIntersectionPoint', () => {
  it('should snap to intersection point when within threshold', () => {
    const intersections = [
      { point: { x: 100, y: 100 }, segments: [{ strokeId: 's1', segmentIndex: 0 }] },
      { point: { x: 200, y: 200 }, segments: [{ strokeId: 's2', segmentIndex: 0 }] },
    ];
    const point = { x: 105, y: 102 };
    const result = findNearestIntersectionPoint(point, intersections, 10);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 100, y: 100 });
    expect(result!.type).toBe('intersection');
  });

  it('should return null when outside threshold', () => {
    const intersections = [
      { point: { x: 100, y: 100 }, segments: [{ strokeId: 's1', segmentIndex: 0 }] },
    ];
    const point = { x: 200, y: 200 };
    const result = findNearestIntersectionPoint(point, intersections, 10);
    expect(result).toBeNull();
  });

  it('should find nearest among multiple intersections', () => {
    const intersections = [
      { point: { x: 100, y: 100 }, segments: [{ strokeId: 's1', segmentIndex: 0 }] },
      { point: { x: 150, y: 150 }, segments: [{ strokeId: 's2', segmentIndex: 0 }] },
    ];
    const point = { x: 140, y: 145 };
    const result = findNearestIntersectionPoint(point, intersections, 20);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual({ x: 150, y: 150 });
  });

  it('should handle empty intersections', () => {
    const point = { x: 100, y: 100 };
    const result = findNearestIntersectionPoint(point, [], 10);
    expect(result).toBeNull();
  });
});

describe('findBestSnapPoint', () => {
  const createDigitalStroke = (id: string, points: Point[]): Stroke => ({
    id,
    points,
    smoothedPoints: points,
    color: '#000',
    thickness: 1,
    timestamp: Date.now(),
    strokeType: 'digital',
    digitalSegments: [
      {
        id: `${id}:0`,
        type: 'line',
        points,
        color: '#000',
      },
    ],
  });

  it('should prioritize intersection over stroke point', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
    const intersections = [
      { point: { x: 75, y: 75 }, segments: [{ strokeId: 's1', segmentIndex: 0 }] },
    ];
    const point = { x: 76, y: 76 };

    const result = findBestSnapPoint(point, {
      strokes: [stroke],
      intersections,
      threshold: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('intersection');
  });

  it('should prioritize polyline point over stroke point', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
    const polylinePoints = [{ x: 30, y: 30 }];
    const point = { x: 31, y: 31 };

    const result = findBestSnapPoint(point, {
      strokes: [stroke],
      intersections: [],
      polylinePoints,
      threshold: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('polylinePoint');
  });

  it('should prioritize stroke point over integer', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
    const point = { x: 51, y: 51 };

    const result = findBestSnapPoint(point, {
      strokes: [stroke],
      intersections: [],
      threshold: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('strokePoint');
  });

  it('should prioritize origin over integer', () => {
    const point = { x: 3, y: 4 };

    const result = findBestSnapPoint(point, {
      strokes: [],
      intersections: [],
      threshold: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('origin');
  });

  it('should snap to integer when nothing else is close', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 500, y: 500 }, { x: 600, y: 600 }]);
    const point = { x: 50.5, y: 40.3 };

    const result = findBestSnapPoint(point, {
      strokes: [stroke],
      intersections: [],
      threshold: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('integer');
    expect(result!.point).toEqual({ x: 51, y: 40 });
  });

  it('should return null when nothing is within threshold', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 500, y: 500 }, { x: 600, y: 600 }]);
    const point = { x: 50.5, y: 40.5 };

    const result = findBestSnapPoint(point, {
      strokes: [stroke],
      intersections: [],
      threshold: 0.3,
    });

    expect(result).toBeNull();
  });

  it('should handle all snap types in priority order', () => {
    const stroke = createDigitalStroke('stroke1', [{ x: 40, y: 40 }, { x: 50, y: 50 }]);
    const polylinePoints = [{ x: 22, y: 22 }];
    const point = { x: 23, y: 23 };

    const result = findBestSnapPoint(point, {
      strokes: [stroke],
      intersections: [],
      polylinePoints,
      threshold: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('polylinePoint');
  });
});
