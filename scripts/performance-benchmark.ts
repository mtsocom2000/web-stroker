/**
 * 性能基准测试脚本
 * 
 * 用法: npx tsx scripts/performance-benchmark.ts
 * 
 * 目的:
 * 1. 记录当前 2D Canvas 渲染的性能基线
 * 2. 为 Three.js 迁移后的性能对比提供数据
 * 3. 识别性能瓶颈
 */

import { analyzeShapeFeatures } from '../src/predict/shapeAnalysis';
import { classifyShapeImproved } from '../src/predict/improvedClassifier';
import { predictShape } from '../src/predict';

console.log('=== Web Stroker Performance Benchmark ===\n');

// 模拟不同数量的笔划
const strokeCounts = [10, 25, 50, 100, 200];

// 生成模拟笔划数据
function generateMockStroke(seed: number): { x: number; y: number }[] {
  const points = [];
  const pointCount = 50 + Math.floor(Math.random() * 100);
  
  for (let i = 0; i < pointCount; i++) {
    points.push({
      x: Math.sin(seed * 0.5 + i * 0.1) * 200 + 400,
      y: Math.cos(seed * 0.3 + i * 0.08) * 200 + 300,
    });
  }
  
  return points;
}

// 测试预测流水线性能
function benchmarkPrediction(strokeCount: number) {
  const strokes = [];
  for (let i = 0; i < strokeCount; i++) {
    strokes.push(generateMockStroke(i));
  }

  console.log(`\n--- Testing with ${strokeCount} strokes ---`);
  
  // 1. 测试特征分析性能
  const startAnalysis = performance.now();
  const features = strokes.map((points) => analyzeShapeFeatures(points));
  const endAnalysis = performance.now();
  const analysisTime = endAnalysis - startAnalysis;
  
  console.log(`Shape Analysis: ${analysisTime.toFixed(2)}ms (${(analysisTime / strokeCount).toFixed(2)}ms/stroke)`);
  
  // 2. 测试分类性能
  const startClassification = performance.now();
  const results = strokes.map((points, i) => 
    classifyShapeImproved(points, features[i])
  );
  const endClassification = performance.now();
  const classificationTime = endClassification - startClassification;
  
  console.log(`Classification: ${classificationTime.toFixed(2)}ms (${(classificationTime / strokeCount).toFixed(2)}ms/stroke)`);
  
  // 3. 测试 predictShape 完整流水线
  const startPredict = performance.now();
  const predictions = strokes.map((points) => predictShape(points));
  const endPredict = performance.now();
  const predictTime = endPredict - startPredict;
  
  console.log(`Full Predict Pipeline: ${predictTime.toFixed(2)}ms (${(predictTime / strokeCount).toFixed(2)}ms/stroke)`);
  
  // 4. 分类统计
  const typeCount: Record<string, number> = {};
  results.forEach((r) => {
    typeCount[r.type] = (typeCount[r.type] || 0) + 1;
  });
  
  console.log(`Classifications:`, typeCount);
  
  // 5. 总时间
  const totalTime = analysisTime + classificationTime + predictTime;
  console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
  
  return {
    strokeCount,
    analysisTime,
    classificationTime,
    predictTime,
    totalTime,
    avgPerStroke: totalTime / strokeCount,
  };
}

// 运行基准测试
const results: any[] = [];

for (const count of strokeCounts) {
  const result = benchmarkPrediction(count);
  results.push(result);
}

// 输出汇总
console.log('\n=== Performance Summary ===\n');
console.log('Strokes | Analysis (ms) | Classification (ms) | Predict (ms) | Total (ms) | Avg/stroke (ms)');
console.log('--------|---------------|---------------------|--------------|------------|------------------');

results.forEach((r) => {
  console.log(
    `${r.strokeCount.toString().padStart(7)} | ` +
    `${r.analysisTime.toFixed(2).padStart(13)} | ` +
    `${r.classificationTime.toFixed(2).padStart(19)} | ` +
    `${r.predictTime.toFixed(2).padStart(12)} | ` +
    `${r.totalTime.toFixed(2).padStart(10)} | ` +
    `${r.avgPerStroke.toFixed(2).padStart(16)}`
  );
});

// 性能预算建议
console.log('\n=== Performance Budget Recommendations ===\n');
console.log('Current System:');
console.log(`- 10 strokes:  < ${results[0].totalTime.toFixed(1)}ms (budget: 50ms)`);
console.log(`- 50 strokes:  < ${results[2].totalTime.toFixed(1)}ms (budget: 200ms)`);
console.log(`- 100 strokes: < ${results[3].totalTime.toFixed(1)}ms (budget: 400ms)`);

console.log('\nThree.js Target (expecting 3-5x improvement):');
console.log(`- 10 strokes:  < ${(results[0].totalTime * 0.3).toFixed(1)}ms`);
console.log(`- 50 strokes:  < ${(results[2].totalTime * 0.25).toFixed(1)}ms`);
console.log(`- 100 strokes: < ${(results[3].totalTime * 0.2).toFixed(1)}ms`);

console.log('\n=== Benchmark Complete ===');
