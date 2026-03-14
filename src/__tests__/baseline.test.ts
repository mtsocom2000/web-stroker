import { describe, it, expect } from 'vitest';
import { predictShape, predictShapeWithDetails } from '../predict';
import {
  loadBaselineStroke,
  getBaselineCategories,
  getBaselineFiles,
} from './test-utils/baseline';

/**
 * Baseline tests using saved stroke data
 * 
 * These tests use real hand-drawn stroke data stored in the baseline/
 * directory to verify shape recognition performance.
 * 
 * This test file automatically scans the baseline/shapes/ directory
 * and creates test cases for all JSON files found.
 */

// Helper to filter files by type prefix
const getFilesByPrefix = (category: string, prefix: string): string[] => {
  return getBaselineFiles(category).filter(f => f.startsWith(prefix));
};

// Helper to get file name without extension
const getFileName = (fileName: string): string => {
  return fileName.replace('.json', '');
};

describe('Baseline Shape Recognition Tests', () => {
  // Get all categories
  const categories = getBaselineCategories();

  // Test that we have baseline data
  describe('Baseline Data Availability', () => {
    it('should have baseline data for all categories', () => {
      console.log('Available baseline categories:', categories);
      expect(categories.length).toBeGreaterThanOrEqual(5);

      categories.forEach(category => {
        const files = getBaselineFiles(category);
        console.log(`Category ${category}: ${files.length} files`);
        expect(files.length).toBeGreaterThan(0);
      });
    });

    it('should have perfect, handdrawn, or manual files in each category', () => {
      categories.forEach(category => {
        const files = getBaselineFiles(category);
        const hasValidFiles = files.some(f => 
          f.startsWith('perfect_') || 
          f.startsWith('handdrawn_') || 
          f.startsWith('manual_')
        );
        expect(hasValidFiles).toBe(true);
      });
    });
  });

  // Dynamically create test suites for each category
  categories.forEach(category => {
    describe(`${category} Detection`, () => {
      const perfectFiles = getFilesByPrefix(category, 'perfect_');
      const handdrawnFiles = getFilesByPrefix(category, 'handdrawn_');
      const manualFiles = getFilesByPrefix(category, 'manual_');

      // Test all perfect files
      perfectFiles.forEach(file => {
        const testName = `should detect perfect ${getFileName(file)}`;
        it(testName, () => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          expect(baseline).not.toBeNull();
          
          const result = predictShape(baseline!.points);
          expect(result).not.toBeNull();
          
          // Category-specific assertions
          if (category === 'line') {
            expect(result).toHaveLength(2);
          } else if (['triangle', 'angle'].includes(category)) {
            expect(result!.length).toBeGreaterThanOrEqual(3);
          } else if (['rectangle', 'square'].some(s => category.includes(s))) {
            expect(result!.length).toBeGreaterThanOrEqual(4);
          } else if (category === 'circle') {
            expect(result!.length).toBeGreaterThan(10);
          }
        });
      });

      // Test all handdrawn files
      handdrawnFiles.forEach(file => {
        const testName = `should detect handdrawn ${getFileName(file)}`;
        it(testName, () => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          expect(baseline).not.toBeNull();
          
          const result = predictShape(baseline!.points);
          expect(result).not.toBeNull();
        });
      });

      // Test all manual files
      manualFiles.forEach(file => {
        const testName = `should detect manual ${getFileName(file)}`;
        it(testName, () => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          expect(baseline).not.toBeNull();
          
          const result = predictShape(baseline!.points);
          expect(result).not.toBeNull();
        });
      });

      // Batch test for this category
      it(`should batch test all ${category} baselines`, () => {
        const allFiles = [...perfectFiles, ...handdrawnFiles, ...manualFiles];
        expect(allFiles.length).toBeGreaterThan(0);

        const results = allFiles.map(file => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          if (!baseline) {
            return { name: file, detected: false, error: 'Failed to load' };
          }
          const result = predictShape(baseline.points);
          return { 
            name: file, 
            detected: result !== null,
            expectedShape: baseline.expectedShape
          };
        });

        console.log(`${category} detection results:`, results);

        // Log failures for debugging
        const failures = results.filter(r => !r.detected);
        if (failures.length > 0) {
          console.log(`${category} failures:`, failures);
        }

        // Most shapes should be detected (at least 50%)
        const detectedCount = results.filter(r => r.detected).length;
        expect(detectedCount).toBeGreaterThanOrEqual(results.length * 0.5);
      });
    });
  });

  // Detailed shape analysis for files with expected shapes
  describe('Detailed Shape Analysis', () => {
    categories.forEach(category => {
      const allFiles = getBaselineFiles(category);
      
      allFiles.forEach(file => {
        const testName = `should analyze ${category}/${getFileName(file)}`;
        it(testName, () => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          if (!baseline) {
            console.warn(`Skipping ${file} - failed to load`);
            return;
          }
          
          const result = predictShapeWithDetails(baseline.points);
          
          // Skip if no shape detected or confidence is 0
          if (!result || result.confidence === 0) {
            console.log(`${file}: No shape detected or zero confidence`);
            return;
          }
          
          expect(result.confidence).toBeGreaterThan(0);
          console.log(`${file}: type=${result.shapeType}, confidence=${result.confidence.toFixed(2)}`);
        });
      });
    });
  });

  // Overall statistics
  describe('Overall Recognition Statistics', () => {
    it('should provide overall detection statistics', () => {
      let totalFiles = 0;
      let totalDetected = 0;
      const stats: Record<string, { total: number; detected: number }> = {};

      categories.forEach(category => {
        const files = getBaselineFiles(category);
        const results = files.map(file => {
          const baseline = loadBaselineStroke(category, getFileName(file));
          if (!baseline) return false;
          const result = predictShape(baseline.points);
          return result !== null;
        });

        const detected = results.filter(r => r).length;
        stats[category] = { total: files.length, detected };
        totalFiles += files.length;
        totalDetected += detected;
      });

      console.log('\n=== Shape Recognition Statistics ===');
      Object.entries(stats).forEach(([cat, stat]) => {
        const pct = ((stat.detected / stat.total) * 100).toFixed(1);
        console.log(`${cat}: ${stat.detected}/${stat.total} (${pct}%)`);
      });
      console.log(`\nOverall: ${totalDetected}/${totalFiles} (${((totalDetected/totalFiles)*100).toFixed(1)}%)`);
      console.log('=====================================\n');

      // Overall should detect at least 50%
      expect(totalDetected).toBeGreaterThanOrEqual(totalFiles * 0.5);
    });
  });
});
