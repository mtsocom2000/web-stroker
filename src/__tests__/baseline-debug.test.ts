import { describe, it, expect } from 'vitest';
import { predictShapeWithDetails } from '../predict';
import {
  loadBaselineStroke,
  getBaselineCategories,
  getBaselineFiles,
} from './test-utils/baseline';

/**
 * 调试测试：分析为什么测试通过但实际程序不识别
 */

describe('Shape Recognition Debug Analysis', () => {
  const getFileName = (fileName: string): string => fileName.replace('.json', '');

  describe('Compare baseline data characteristics', () => {
    const categories = getBaselineCategories();

    categories.forEach(category => {
      const files = getBaselineFiles(category).filter(f => f.startsWith('manual_'));

      files.forEach(file => {
        it(`should analyze ${category}/${file} characteristics`, () => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          expect(baseline).not.toBeNull();

          const points = baseline!.points;

          // 分析点数
          console.log(`\n=== ${file} ===`);
          console.log(`Total points: ${points.length}`);

          // 分析包围盒
          const xs = points.map(p => p.x);
          const ys = points.map(p => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const width = maxX - minX;
          const height = maxY - minY;
          console.log(`Bounding box: ${width.toFixed(1)} x ${height.toFixed(1)}`);

          // 分析路径长度
          let pathLength = 0;
          for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i-1].x;
            const dy = points[i].y - points[i-1].y;
            pathLength += Math.sqrt(dx*dx + dy*dy);
          }
          console.log(`Path length: ${pathLength.toFixed(1)}`);

          // 分析首尾距离（封闭性）
          const startEndDist = Math.sqrt(
            Math.pow(points[0].x - points[points.length-1].x, 2) +
            Math.pow(points[0].y - points[points.length-1].y, 2)
          );
          console.log(`Start-end distance: ${startEndDist.toFixed(1)} (${(startEndDist/pathLength*100).toFixed(1)}% of path)`);

          // 运行预测并分析
          const result = predictShapeWithDetails(points);
          if (result) {
            console.log(`Detected: ${result.shapeType} (confidence: ${result.confidence.toFixed(2)})`);
            console.log(`Is closed: ${result.isClosed}`);
            console.log(`Predicted points: ${result.points.length}`);
          } else {
            console.log(`No shape detected (returned null)`);
          }
          console.log('===================');

          expect(result).not.toBeNull();
        });
      });
    });
  });

  describe('Test with different confidence thresholds', () => {
    it('should test manual circle with varying thresholds', () => {
      const baseline = loadBaselineStroke('circle', 'manual_circle');
      if (!baseline) {
        console.log('No manual_circle baseline found, skipping');
        return;
      }

      console.log('\n=== Testing manual_circle with different thresholds ===');

      const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      thresholds.forEach(threshold => {
        const result = predictShapeWithDetails(baseline.points, {
          minConfidence: threshold,
          fallbackToOriginal: false
        });

        if (result && result.confidence >= threshold) {
          console.log(`Threshold ${threshold}: ${result.shapeType} (actual confidence: ${result.confidence.toFixed(2)})`);
        } else if (result) {
          console.log(`Threshold ${threshold}: FAILED (confidence ${result.confidence.toFixed(2)} < ${threshold})`);
        } else {
          console.log(`Threshold ${threshold}: NULL`);
        }
      });
    });

    it('should test manual triangle with varying thresholds', () => {
      const baseline = loadBaselineStroke('triangle', 'manual_triangle');
      if (!baseline) {
        console.log('No manual_triangle baseline found, skipping');
        return;
      }

      console.log('\n=== Testing manual_triangle with different thresholds ===');

      const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      thresholds.forEach(threshold => {
        const result = predictShapeWithDetails(baseline.points, {
          minConfidence: threshold,
          fallbackToOriginal: false
        });

        if (result && result.confidence >= threshold) {
          console.log(`Threshold ${threshold}: ${result.shapeType} (actual confidence: ${result.confidence.toFixed(2)})`);
        } else if (result) {
          console.log(`Threshold ${threshold}: FAILED (confidence ${result.confidence.toFixed(2)} < ${threshold})`);
        } else {
          console.log(`Threshold ${threshold}: NULL`);
        }
      });
    });
  });

  describe('Analyze why shapes might fail in real usage', () => {
    it('should compare perfect vs manual data', () => {
      const categories = ['circle', 'triangle', 'rectangle'];

      categories.forEach(category => {
        const perfectFile = getBaselineFiles(category).find(f => f.startsWith('perfect_'));
        const manualFile = getBaselineFiles(category).find(f => f.startsWith('manual_'));

        if (!perfectFile || !manualFile) {
          console.log(`Skipping ${category} - missing perfect or manual file`);
          return;
        }

        const perfect = loadBaselineStroke(category, getFileName(perfectFile));
        const manual = loadBaselineStroke(category, getFileName(manualFile));

        if (!perfect || !manual) return;

        console.log(`\n=== ${category.toUpperCase()}: Perfect vs Manual ===`);

        // Compare point counts
        console.log(`Points: perfect=${perfect.points.length}, manual=${manual.points.length}`);

        // Compare detection
        const perfectResult = predictShapeWithDetails(perfect.points);
        const manualResult = predictShapeWithDetails(manual.points);

        console.log(`Perfect: ${perfectResult?.shapeType} (${perfectResult?.confidence.toFixed(2)})`);
        console.log(`Manual: ${manualResult?.shapeType} (${manualResult?.confidence.toFixed(2)})`);
        console.log('=====================================');
      });
    });
  });

  describe('Test enhanced vs legacy classifier', () => {
    it('should compare classifiers on manual data', () => {
      const categories = getBaselineCategories();

      categories.forEach(category => {
        const manualFiles = getBaselineFiles(category).filter(f => f.startsWith('manual_'));

        manualFiles.forEach(file => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          if (!baseline) return;

          console.log(`\n=== ${file} ===`);

          // Enhanced classifier (default)
          const enhanced = predictShapeWithDetails(baseline.points, {
            useEnhancedClassifier: true,
            minConfidence: 0.1  // Low threshold to see actual scores
          });

          // Legacy classifier
          const legacy = predictShapeWithDetails(baseline.points, {
            useEnhancedClassifier: false,
            minConfidence: 0.1
          });

          console.log(`Enhanced: ${enhanced?.shapeType} (${enhanced?.confidence.toFixed(2)})`);
          console.log(`Legacy: ${legacy?.shapeType} (${legacy?.confidence.toFixed(2)})`);
        });
      });
    });
  });
});
