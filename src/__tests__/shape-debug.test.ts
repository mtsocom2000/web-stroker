import { describe, it } from 'vitest';
import { analyzeShapeFeatures } from '../predict/shapeAnalysis';
import { classifyShapeImproved } from '../predict/improvedClassifier';
import { loadBaselineStroke, getBaselineFiles } from './test-utils/baseline';

/**
 * 调试测试：分析形状识别的特征提取和评分
 */
describe('Shape Recognition Debug', () => {
  const getFileName = (fileName: string): string => fileName.replace('.json', '');

  it('should analyze manual shapes in detail', () => {
    const categories = ['angle', 'triangle', 'rectangle'];
    
    categories.forEach(category => {
      const manualFile = getBaselineFiles(category).find(f => f.startsWith('manual_'));
      if (!manualFile) {
        console.log(`No manual file in ${category}`);
        return;
      }

      const baseline = loadBaselineStroke(category, getFileName(manualFile));
      if (!baseline) {
        console.log(`Failed to load ${manualFile}`);
        return;
      }

      console.log(`\n========== ${category}/${manualFile} ==========`);
      
      // 分析特征
      const features = analyzeShapeFeatures(baseline.points);
      console.log('Features:');
      console.log(`  - Corners: ${features.corners.length}`, features.corners.map(c => c.index));
      
      // 打印角点坐标和距离
      console.log('\n  Corner coordinates and distances:');
      features.corners.forEach((corner, i) => {
        const point = baseline.points[corner.index];
        console.log(`    [${i}] index=${corner.index}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        if (i > 0) {
          const prevPoint = baseline.points[features.corners[i-1].index];
          const dist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
          console.log(`       distance from prev: ${dist.toFixed(1)}px`);
        }
      });
      
      console.log(`  - Avg curvature: ${features.avgCurvature.toFixed(4)}`);
      console.log(`  - Is closed: ${features.isClosed}`);
      console.log(`  - Closed distance: ${features.closedDistance.toFixed(1)}`);
      console.log(`  - Path length: ${features.pathLength.toFixed(1)}`);
      console.log(`  - BBox: ${features.bbox.width.toFixed(0)}x${features.bbox.height.toFixed(0)}`);
      console.log(`  - Curvatures count: ${features.curvatures.length}`);
      
      // 运行改进分类器
      const result = classifyShapeImproved(baseline.points, features);
      console.log('\nClassification Result:');
      console.log(`  - Type: ${result.type}`);
      console.log(`  - Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`  - Is closed: ${result.isClosed}`);
      console.log(`  - Generated points: ${result.points.length}`);
      
      // 显示所有评分
      console.log('\nAll Scores (sorted):');
      const sortedScores = result.allScores
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      sortedScores.forEach(s => {
        console.log(`  - ${s.type}: ${s.score.toFixed(2)} (${s.confidence.toFixed(2)}) - ${s.reason}`);
      });
      
      console.log('=========================================\n');
    });
  });

  it('should debug perfect vs manual comparison', () => {
    const comparisons = [
      { category: 'angle', perfect: 'perfect_l_shape' },
      { category: 'triangle', perfect: 'perfect_equilateral' },
      { category: 'rectangle', perfect: 'perfect_rectangle' },
    ];

    comparisons.forEach(({ category, perfect }) => {
      const manualFile = getBaselineFiles(category).find(f => f.startsWith('manual_'));
      if (!manualFile) return;

      const perfectBaseline = loadBaselineStroke(category, perfect);
      const manualBaseline = loadBaselineStroke(category, getFileName(manualFile));

      if (!perfectBaseline || !manualBaseline) return;

      console.log(`\n========== ${category}: Perfect vs Manual ==========`);
      
      [perfectBaseline, manualBaseline].forEach((baseline, idx) => {
        const label = idx === 0 ? 'PERFECT' : 'MANUAL';
        console.log(`\n--- ${label} ---`);
        
        const features = analyzeShapeFeatures(baseline.points);
        console.log(`Points: ${baseline.points.length}`);
        console.log(`Corners: ${features.corners.length}`);
        console.log(`Closed: ${features.isClosed} (dist: ${features.closedDistance.toFixed(1)})`);
        console.log(`Curvature: ${features.avgCurvature.toFixed(4)}`);
        
        const result = classifyShapeImproved(baseline.points, features);
        console.log(`Detected: ${result.type} (${result.confidence.toFixed(2)})`);
      });
      
      console.log('=========================================\n');
    });
  });
});
