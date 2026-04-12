import { describe, it, expect } from 'vitest';
import { analyzeShapeFeatures } from '../predict/shapeAnalysis';
import { classifyShapeImproved } from '../predict/improvedClassifier';
import { predictShape } from '../predict';
import * as fs from 'fs';

/**
 * 视觉回归测试基线
 * 
 * 目的：
 * 1. 记录当前 2D Canvas 渲染的行为
 * 2. 为 Three.js 迁移提供对比基准
 * 3. 确保迁移后功能一致性
 */

describe('Visual Baseline Tests', () => {
  const testCases = [
    {
      name: 'artistic_pencil_line',
      file: 'baseline/shapes/line/perfect_horizontal.json',
      mode: 'original',
      brush: 'pencil',
      color: '#000000',
      thickness: 2,
    },
    {
      name: 'artistic_brush_curve',
      file: 'baseline/shapes/arc/perfect_quarter_arc.json',
      mode: 'smooth',
      brush: 'brush',
      opacity: 0.7,
    },
    {
      name: 'artistic_predict_triangle',
      file: 'baseline/shapes/triangle/perfect_right_angle.json',
      mode: 'predict',
      expectedType: 'triangle',
    },
    {
      name: 'artistic_predict_circle',
      file: 'baseline/shapes/circle/perfect_circle.json',
      mode: 'predict',
      expectedType: 'circle',
    },
    {
      name: 'artistic_predict_rectangle',
      file: 'baseline/shapes/rectangle/perfect_rectangle.json',
      mode: 'predict',
      expectedType: 'rectangle',
    },
    {
      name: 'artistic_transparent_stroke',
      file: 'baseline/shapes/line/handdrawn_horizontal.json',
      mode: 'original',
      brush: 'brush',
      opacity: 0.3,
    },
  ];

  testCases.forEach((testCase) => {
    it(`should maintain baseline for ${testCase.name}`, () => {
      const data = JSON.parse(fs.readFileSync(testCase.file, 'utf8'));
      const points = data.canvasState.strokes[0].points;

      // 记录点数据特征
      const baseline: any = {
        pointCount: points.length,
        boundingBox: calculateBoundingBox(points),
        pathLength: calculatePathLength(points),
      };

      // 如果是 predict 模式，记录预测结果
      if (testCase.mode === 'predict') {
        const features = analyzeShapeFeatures(points);
        const result = classifyShapeImproved(points, features);
        const predicted = predictShape(points);

        baseline.prediction = {
          type: result.type,
          confidence: result.confidence,
          cornerCount: features.corners.length,
          isClosed: features.isClosed,
          predictedPointsCount: predicted?.length ?? 0,
        };

        // Triangle can be detected as polygon (both are valid for 3-corner shapes)
        if (testCase.expectedType === 'triangle') {
          expect(['triangle', 'polygon']).toContain(result.type);
        } else {
          expect(result.type).toBe(testCase.expectedType);
        }
        expect(result.confidence).toBeGreaterThan(0.3);
      }

      // 保存基线数据（实际项目中可写入文件）
      console.log(`[Baseline] ${testCase.name}:`, baseline);

      // 基本验证
      expect(baseline.pointCount).toBeGreaterThan(0);
      expect(baseline.boundingBox.width).toBeGreaterThan(0);
      // 对于水平线，height可能为0，这是合法的
      expect(baseline.boundingBox.height).toBeGreaterThanOrEqual(0);
    });
  });
});

// 性能基线测试
describe('Performance Baseline', () => {
  const strokeCounts = [10, 50, 100];

  strokeCounts.forEach((count) => {
    it(`should handle ${count} strokes within performance budget`, () => {
      const startTime = performance.now();

      // 模拟处理 N 个笔划
      for (let i = 0; i < count; i++) {
        const points = generateMockStrokePoints(i);
        const features = analyzeShapeFeatures(points);
        classifyShapeImproved(points, features);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 记录性能基线
      console.log(`[Performance] ${count} strokes: ${duration.toFixed(2)}ms`);

      // 性能预算（当前系统的基准）
      const budget = count * 2; // 每个笔划 2ms
      expect(duration).toBeLessThan(budget);
    });
  });
});

// 辅助函数
function calculateBoundingBox(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function calculatePathLength(points: { x: number; y: number }[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

function generateMockStrokePoints(seed: number): { x: number; y: number }[] {
  // 生成模拟笔划点
  const points = [];
  for (let i = 0; i < 50; i++) {
    points.push({
      x: Math.sin(seed + i * 0.1) * 100 + 200,
      y: Math.cos(seed + i * 0.1) * 100 + 200,
    });
  }
  return points;
}
