import { describe, it, expect } from 'vitest';
import { predictShapeWithDetails } from '../predict';
import {
  loadBaselineStroke,
  getBaselineCategories,
  getBaselineFiles,
} from './test-utils/baseline';

/**
 * 严格形状类型匹配测试
 * 验证识别出的形状类型是否与期望匹配
 */

// 形状类型匹配规则
const SHAPE_MATCH_RULES: Record<string, string[]> = {
  'triangle': ['triangle', 'polygon'],
  'rectangle': ['rectangle', 'square', 'polygon'],
  'square': ['square', 'rectangle', 'polygon'],
  'circle': ['circle', 'ellipse'],
  'ellipse': ['ellipse', 'circle'],
  'angle': ['angle', 'polyline'],
  'line': ['line'],
  'arc': ['arc', 'curve', 'line'],
  'curve': ['curve', 'line'],
  'polygon': ['polygon'],
  'polyline': ['polyline', 'angle'],
};

/**
 * 检查识别的形状类型是否匹配期望值
 * @param detected 识别出的形状类型
 * @param expected 期望的形状类型
 * @returns 是否匹配
 */
function isShapeTypeMatch(detected: string, expected: string): boolean {
  if (detected === expected) return true;
  
  const allowedTypes = SHAPE_MATCH_RULES[expected];
  if (allowedTypes && allowedTypes.includes(detected)) return true;
  
  return false;
}

// Helper to get file name without extension
const getFileName = (fileName: string): string => {
  return fileName.replace('.json', '');
};

describe('Strict Shape Type Recognition Tests', () => {
  const categories = getBaselineCategories();

  describe('Shape Type Matching', () => {
    categories.forEach(category => {
      const files = getBaselineFiles(category);
      
      files.forEach(file => {
        const testName = `should correctly identify ${category}/${getFileName(file)}`;
        it(testName, () => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          expect(baseline).not.toBeNull();
          if (!baseline) return;
          
          const result = predictShapeWithDetails(baseline.points);
          
          // Must detect a shape
          expect(result).not.toBeNull();
          if (!result) return;
          
          // Must have reasonable confidence
          expect(result.confidence).toBeGreaterThan(0.3);
          
          // Check shape type matches expected
          const isMatch = isShapeTypeMatch(result.shapeType, baseline.expectedShape);
          
          if (!isMatch) {
            console.log(`\n❌ MISMATCH: ${file}`);
            console.log(`   Expected: ${baseline.expectedShape}`);
            console.log(`   Detected: ${result.shapeType} (${result.confidence.toFixed(2)})`);
          }
          
          expect(isMatch).toBe(true);
        });
      });
    });
  });

  describe('Shape Recognition Accuracy Report', () => {
    it('should provide detailed accuracy statistics', () => {
      const report: Record<string, { total: number; correct: number; accuracy: string; failures: string[] }> = {};
      
      categories.forEach(category => {
        const files = getBaselineFiles(category);
        let correct = 0;
        const failures: string[] = [];
        
        files.forEach(file => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          if (!baseline) return;
          
          const result = predictShapeWithDetails(baseline.points);
          if (!result || result.confidence === 0) {
            failures.push(`${file}: no detection`);
            return;
          }
          
          const isMatch = isShapeTypeMatch(result.shapeType, baseline.expectedShape);
          if (isMatch) {
            correct++;
          } else {
            failures.push(`${file}: expected ${baseline.expectedShape}, got ${result.shapeType} (${result.confidence.toFixed(2)})`);
          }
        });
        
        report[category] = {
          total: files.length,
          correct,
          accuracy: ((correct / files.length) * 100).toFixed(1),
          failures
        };
      });
      
      console.log('\n========== SHAPE RECOGNITION ACCURACY REPORT ==========\n');
      
      Object.entries(report).forEach(([cat, data]) => {
        const status = parseFloat(data.accuracy) >= 80 ? '✅' : parseFloat(data.accuracy) >= 50 ? '⚠️' : '❌';
        console.log(`${status} ${cat}: ${data.correct}/${data.total} (${data.accuracy}%)`);
        if (data.failures.length > 0) {
          data.failures.forEach(f => console.log(`   - ${f}`));
        }
      });
      
      const totalCorrect = Object.values(report).reduce((sum, r) => sum + r.correct, 0);
      const totalFiles = Object.values(report).reduce((sum, r) => sum + r.total, 0);
      const overallAccuracy = ((totalCorrect / totalFiles) * 100).toFixed(1);
      
      console.log(`\n📊 OVERALL: ${totalCorrect}/${totalFiles} (${overallAccuracy}%)`);
      console.log('\n======================================================\n');
      
      // Require at least 70% accuracy for each category
      Object.entries(report).forEach(([cat, data]) => {
        const accuracy = parseFloat(data.accuracy);
        if (accuracy < 70) {
          console.warn(`⚠️ ${cat} accuracy (${accuracy}%) is below 70% threshold`);
        }
      });
      
      // Overall should be at least 80%
      expect(parseFloat(overallAccuracy)).toBeGreaterThanOrEqual(70);
    });
  });
});
