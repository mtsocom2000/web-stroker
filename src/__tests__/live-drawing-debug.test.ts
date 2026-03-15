import { describe, it } from 'vitest';
import { analyzeShapeFeatures } from '../predict/shapeAnalysis';
import { classifyShapeImproved } from '../predict/improvedClassifier';
import { loadBaselineStroke, getBaselineFiles } from './test-utils/baseline';

/**
 * 调试用：分析特定形状的实际绘制情况
 */
describe('Live Drawing Debug', () => {
  const getFileName = (fileName: string): string => fileName.replace('.json', '');

  it('should analyze arc drawing', () => {
    const arcFile = getBaselineFiles('arc').find(f => f.startsWith('manual_'));
    if (!arcFile) {
      console.log('No manual arc file');
      return;
    }

    const baseline = loadBaselineStroke('arc', getFileName(arcFile));
    if (!baseline) {
      console.log('Failed to load arc');
      return;
    }

    console.log(`\n========== ARC ANALYSIS ==========`);
    console.log(`Points: ${baseline.points.length}`);
    
    const features = analyzeShapeFeatures(baseline.points);
    console.log(`Corners: ${features.corners.length}`, features.corners.map(c => c.index));
    console.log(`Avg curvature: ${features.avgCurvature.toFixed(4)}`);
    console.log(`Is closed: ${features.isClosed} (dist: ${features.closedDistance.toFixed(1)})`);
    console.log(`Path length: ${features.pathLength.toFixed(1)}`);
    console.log(`BBox: ${features.bbox.width.toFixed(0)}x${features.bbox.height.toFixed(0)}`);
    
    const result = classifyShapeImproved(baseline.points, features);
    console.log(`\nDetected: ${result.type} (${result.confidence.toFixed(2)})`);
    
    console.log('\nTop 5 Scores:');
    result.allScores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .forEach(s => {
        console.log(`  ${s.type}: ${s.score.toFixed(2)} (${s.confidence.toFixed(2)}) - ${s.reason}`);
      });
    console.log('==================================\n');
  });

  it('should analyze triangle vs circle confusion', () => {
    const triangleFile = getBaselineFiles('triangle').find(f => f.startsWith('manual_'));
    if (!triangleFile) return;

    const baseline = loadBaselineStroke('triangle', getFileName(triangleFile));
    if (!baseline) return;

    console.log(`\n========== TRIANGLE vs CIRCLE ==========`);
    
    const features = analyzeShapeFeatures(baseline.points);
    console.log(`Corners: ${features.corners.length}`);
    console.log(`Is closed: ${features.isClosed}`);
    console.log(`Avg curvature: ${features.avgCurvature.toFixed(4)}`);
    console.log(`Path length: ${features.pathLength.toFixed(1)}`);
    
    // 计算圆的周长比
    const estimatedRadius = (features.bbox.width + features.bbox.height) / 4;
    const expectedCircumference = 2 * Math.PI * estimatedRadius;
    const lengthRatio = features.pathLength / expectedCircumference;
    console.log(`Circle ratio: ${lengthRatio.toFixed(2)} (expected ~1.0 for circle)`);
    
    const result = classifyShapeImproved(baseline.points, features);
    console.log(`\nDetected: ${result.type} (${result.confidence.toFixed(2)})`);
    
    console.log('\nTriangle vs Circle scores:');
    const relevant = result.allScores.filter(s => ['triangle', 'circle', 'ellipse', 'polygon'].includes(s.type));
    relevant.forEach(s => {
      console.log(`  ${s.type}: ${s.score.toFixed(2)} - ${s.reason}`);
    });
    console.log('==================================\n');
  });

  it('should analyze rectangle vs triangle confusion', () => {
    const rectFile = getBaselineFiles('rectangle').find(f => f.startsWith('manual_'));
    if (!rectFile) return;

    const baseline = loadBaselineStroke('rectangle', getFileName(rectFile));
    if (!baseline) return;

    console.log(`\n========== RECTANGLE vs TRIANGLE ==========`);
    
    const features = analyzeShapeFeatures(baseline.points);
    console.log(`Corners: ${features.corners.length}`, features.corners.map(c => `idx:${c.index}`));
    console.log(`Is closed: ${features.isClosed}`);
    console.log(`BBox: ${features.bbox.width.toFixed(0)}x${features.bbox.height.toFixed(0)}`);
    
    const result = classifyShapeImproved(baseline.points, features);
    console.log(`\nDetected: ${result.type} (${result.confidence.toFixed(2)})`);
    
    console.log('\nRectangle/Triangle/Polygon scores:');
    const relevant = result.allScores.filter(s => ['rectangle', 'triangle', 'square', 'polygon'].includes(s.type));
    relevant.forEach(s => {
      console.log(`  ${s.type}: ${s.score.toFixed(2)} - ${s.reason}`);
    });
    console.log('==================================\n');
  });
});
