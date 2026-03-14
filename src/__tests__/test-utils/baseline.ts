/**
 * Baseline Test Data Utilities
 * 
 * This module provides utilities for loading and using baseline test data
 * for shape recognition testing.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { Stroke, Point } from '../../types';
import type { DrawingData } from '../../types';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const BASELINE_DIR = resolve(__dirname, '../../../baseline');

export interface BaselineStrokeData {
  /** Stroke ID from baseline file */
  id: string;
  /** Original raw points from the drawing */
  points: Point[];
  /** Smoothed/processed points */
  smoothedPoints: Point[];
  /** Expected shape type */
  expectedShape: string;
  /** File name of the baseline data */
  fileName: string;
  /** Full path to the baseline file */
  filePath: string;
}

export interface BaselineTestCase {
  /** Test case name */
  name: string;
  /** Drawing data */
  drawingData: DrawingData;
  /** Strokes in this test case */
  strokes: BaselineStrokeData[];
}

/**
 * Load a single baseline stroke file
 * @param category - Shape category (e.g., 'line', 'circle', 'triangle')
 * @param fileName - File name without extension (e.g., 'horizontal_line_001')
 * @returns BaselineStrokeData or null if not found
 */
export function loadBaselineStroke(
  category: string,
  fileName: string
): BaselineStrokeData | null {
  const filePath = join(BASELINE_DIR, 'shapes', category, `${fileName}.json`);
  
  if (!existsSync(filePath)) {
    console.warn(`Baseline file not found: ${filePath}`);
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as DrawingData & { expectedShape?: string; description?: string };
    
    if (!data.canvasState?.strokes?.length) {
      console.warn(`No strokes found in baseline file: ${filePath}`);
      return null;
    }

    const stroke = data.canvasState.strokes[0];
    return {
      id: stroke.id,
      points: stroke.points,
      smoothedPoints: stroke.smoothedPoints || stroke.points,
      expectedShape: data.expectedShape || category,
      fileName,
      filePath,
    };
  } catch (error) {
    console.error(`Failed to load baseline file ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all baseline strokes from a category
 * @param category - Shape category (e.g., 'line', 'circle', 'triangle')
 * @returns Array of BaselineStrokeData
 */
export function loadBaselineCategory(category: string): BaselineStrokeData[] {
  const categoryDir = join(BASELINE_DIR, 'shapes', category);
  
  if (!existsSync(categoryDir)) {
    console.warn(`Baseline category not found: ${categoryDir}`);
    return [];
  }

  const files = readdirSync(categoryDir)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => f.replace('.json', ''));

  return files
    .map(fileName => loadBaselineStroke(category, fileName))
    .filter((s): s is BaselineStrokeData => s !== null);
}

/**
 * Get all available baseline categories
 * @returns Array of category names
 */
export function getBaselineCategories(): string[] {
  const shapesDir = join(BASELINE_DIR, 'shapes');
  
  if (!existsSync(shapesDir)) {
    return [];
  }

  return readdirSync(shapesDir, { withFileTypes: true })
    .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
    .map((d: { name: string }) => d.name);
}

/**
 * Load a complete drawing file (multiple strokes)
 * @param filePath - Path to the drawing file (relative to baseline dir or absolute)
 * @returns BaselineTestCase or null if not found
 */
export function loadBaselineDrawing(filePath: string): BaselineTestCase | null {
  const fullPath = filePath.startsWith('/') || filePath.includes(':\\')
    ? filePath
    : join(BASELINE_DIR, filePath);

  if (!existsSync(fullPath)) {
    console.warn(`Drawing file not found: ${fullPath}`);
    return null;
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content) as DrawingData & { expectedShape?: string; description?: string };
    
    const strokes: BaselineStrokeData[] = data.canvasState.strokes.map(stroke => ({
      id: stroke.id,
      points: stroke.points,
      smoothedPoints: stroke.smoothedPoints || stroke.points,
      expectedShape: data.expectedShape || 'unknown',
      fileName: fullPath.split(/[\\/]/).pop() || 'unknown',
      filePath: fullPath,
    }));

    return {
      name: fullPath.split(/[\\/]/).pop()?.replace('.json', '') || 'unknown',
      drawingData: data,
      strokes,
    };
  } catch (error) {
    console.error(`Failed to load drawing file ${fullPath}:`, error);
    return null;
  }
}

/**
 * Get all baseline files in a category
 * @param category - Shape category
 * @returns Array of file names (without extension)
 */
export function getBaselineFiles(category: string): string[] {
  const categoryDir = join(BASELINE_DIR, 'shapes', category);
  
  if (!existsSync(categoryDir)) {
    return [];
  }

  return readdirSync(categoryDir)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => f.replace('.json', ''));
}

/**
 * Create a simple stroke object for testing from raw points
 * @param points - Array of points
 * @param id - Optional stroke ID
 * @returns Stroke object
 */
export function createTestStroke(points: Point[], id?: string): Stroke {
  return {
    id: id || `test_stroke_${Date.now()}`,
    points,
    smoothedPoints: points,
    color: '#000000',
    thickness: 2,
    timestamp: Date.now(),
    strokeType: 'artistic',
  };
}

/**
 * Generate a perfect straight line for comparison/testing
 * @param start - Start point
 * @param end - End point
 * @param numPoints - Number of points to generate
 * @returns Array of points
 */
export function generatePerfectLine(
  start: Point,
  end: Point,
  numPoints: number = 20
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      timestamp: 1000 + i * 16,
    });
  }
  return points;
}

/**
 * Generate a perfect circle for comparison/testing
 * @param center - Center point
 * @param radius - Circle radius
 * @param numPoints - Number of points to generate
 * @returns Array of points
 */
export function generatePerfectCircle(
  center: Point,
  radius: number,
  numPoints: number = 40
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      timestamp: 1000 + i * 16,
    });
  }
  return points;
}

/**
 * Generate a perfect arc for comparison/testing
 * @param center - Center point
 * @param radius - Arc radius
 * @param startAngle - Start angle in radians
 * @param endAngle - End angle in radians
 * @param numPoints - Number of points to generate
 * @returns Array of points
 */
export function generatePerfectArc(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  numPoints: number = 20
): Point[] {
  const points: Point[] = [];
  let coverage = endAngle - startAngle;
  if (coverage < 0) coverage += 2 * Math.PI;
  
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const angle = startAngle + t * coverage;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      timestamp: 1000 + i * 16,
    });
  }
  return points;
}

/**
 * Generate a perfect triangle for comparison/testing
 * @param p1 - First vertex
 * @param p2 - Second vertex
 * @param p3 - Third vertex
 * @param numPointsPerSide - Number of points per side
 * @returns Array of points
 */
export function generatePerfectTriangle(
  p1: Point,
  p2: Point,
  p3: Point,
  numPointsPerSide: number = 15
): Point[] {
  const points: Point[] = [];
  
  // Side 1: p1 -> p2
  for (let i = 0; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      timestamp: 1000 + i * 16,
    });
  }
  
  // Side 2: p2 -> p3
  for (let i = 1; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p2.x + (p3.x - p2.x) * t,
      y: p2.y + (p3.y - p2.y) * t,
      timestamp: 1000 + (numPointsPerSide + i) * 16,
    });
  }
  
  // Side 3: p3 -> p1
  for (let i = 1; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p3.x + (p1.x - p3.x) * t,
      y: p3.y + (p1.y - p3.y) * t,
      timestamp: 1000 + (2 * numPointsPerSide + i) * 16,
    });
  }
  
  return points;
}

/**
 * Generate a perfect rectangle for comparison/testing
 * @param topLeft - Top-left corner
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param numPointsPerSide - Number of points per side
 * @returns Array of points
 */
export function generatePerfectRectangle(
  topLeft: Point,
  width: number,
  height: number,
  numPointsPerSide: number = 15
): Point[] {
  const p1 = topLeft;
  const p2 = { x: topLeft.x + width, y: topLeft.y };
  const p3 = { x: topLeft.x + width, y: topLeft.y + height };
  const p4 = { x: topLeft.x, y: topLeft.y + height };
  
  const points: Point[] = [];
  
  // Side 1: p1 -> p2
  for (let i = 0; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      timestamp: 1000 + i * 16,
    });
  }
  
  // Side 2: p2 -> p3
  for (let i = 1; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p2.x + (p3.x - p2.x) * t,
      y: p2.y + (p3.y - p2.y) * t,
      timestamp: 1000 + (numPointsPerSide + i) * 16,
    });
  }
  
  // Side 3: p3 -> p4
  for (let i = 1; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p3.x + (p4.x - p3.x) * t,
      y: p3.y + (p4.y - p3.y) * t,
      timestamp: 1000 + (2 * numPointsPerSide + i) * 16,
    });
  }
  
  // Side 4: p4 -> p1
  for (let i = 1; i < numPointsPerSide; i++) {
    const t = i / (numPointsPerSide - 1);
    points.push({
      x: p4.x + (p1.x - p4.x) * t,
      y: p4.y + (p1.y - p4.y) * t,
      timestamp: 1000 + (3 * numPointsPerSide + i) * 16,
    });
  }
  
  return points;
}
