import type { Point } from '../types';

/**
 * Normalize an angle to the range [-π, π)
 */
export function angleNormalize(angle: number): number {
  let normalized = angle;
  // Handle the case where angle equals π (should stay π, not wrap to -π)
  if (normalized > Math.PI) {
    normalized -= 2 * Math.PI;
  }
  if (normalized <= -Math.PI) {
    normalized += 2 * Math.PI;
  }
  return normalized;
}

/**
 * Compute the signed angle difference from angle `a` to angle `b`.
 * Result is in range (-π, π], positive means counter-clockwise.
 */
export function angleDiff(a: number, b: number): number {
  // Work with normalized angles first
  const normA = angleNormalize(a);
  const normB = angleNormalize(b);
  let diff = normB - normA;
  
  // Wrap to (-π, π] - use strict inequality on the lower bound to keep -π
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * Check if a test angle lies within the circular arc from startAngle to endAngle.
 * Takes into account the direction (which way the arc sweeps).
 * Assumes angles are normalized to [-π, π).
 * @param startAngle - Start of the arc
 * @param endAngle - End of the arc
 * @param testAngle - The angle to test
 * @param eps - Tolerance for boundary checks (default 1e-6)
 * @returns true if testAngle is within the arc sector
 */
export function angleContains(startAngle: number, endAngle: number, testAngle: number, eps: number = 1e-6): boolean {
  const start = angleNormalize(startAngle);
  const end = angleNormalize(endAngle);
  const test = angleNormalize(testAngle);

  // Compute the signed sweep from start to end
  const sweep = angleDiff(start, end);

  // If sweep is zero (or very close), angles are the same
  if (Math.abs(sweep) < eps) {
    return Math.abs(angleDiff(start, test)) < eps;
  }

  // Check if test is between start and end by computing diff from start to test
  const testFromStart = angleDiff(start, test);

  // If sweep is positive (counter-clockwise), check if testFromStart is between 0 and sweep
  if (sweep > 0) {
    return testFromStart >= -eps && testFromStart <= sweep + eps;
  } else {
    // Sweep is negative (clockwise), check if testFromStart is between sweep and 0
    return testFromStart >= sweep - eps && testFromStart <= eps;
  }
}

/**
 * Choose which intersection point on line1 to use for the arc endpoint,
 * based on which side of the arc center the mouse currently is.
 * 
 * @param intersection1 - First circle-line intersection point
 * param intersection2 - Second circle-line intersection point (optional)
 * @param arcCenter - Center of the arc (intersection of infinite lines)
 * @param arcEndpoint2 - Endpoint on line2 (the clicked/hovered point)
 * @param mousePos - Current mouse position
 * @returns The intersection point that should be used for the arc
 */
export function chooseIntersectionByMouseAngle(
  intersection1: Point,
  intersection2: Point | null,
  arcCenter: Point,
  arcEndpoint2: Point,
  mousePos: Point
): Point {
  // If only one intersection, use it
  if (!intersection2) {
    return intersection1;
  }

  // Compute angles in world space for consistency
  const angle1 = Math.atan2(intersection1.y - arcCenter.y, intersection1.x - arcCenter.x);
  const angle2 = Math.atan2(intersection2.y - arcCenter.y, intersection2.x - arcCenter.x);
  const angleEnd2 = Math.atan2(arcEndpoint2.y - arcCenter.y, arcEndpoint2.x - arcCenter.x);
  const angleMouse = Math.atan2(mousePos.y - arcCenter.y, mousePos.x - arcCenter.x);

  // Normalize all angles
  const a1 = angleNormalize(angle1);
  const a2 = angleNormalize(angle2);
  const aEnd2 = angleNormalize(angleEnd2);
  const aMouse = angleNormalize(angleMouse);

  // Check which sector (a1 -> aEnd2 or a2 -> aEnd2) contains the mouse angle
  const sector1Contains = angleContains(a1, aEnd2, aMouse);
  const sector2Contains = angleContains(a2, aEnd2, aMouse);

  if (sector1Contains && !sector2Contains) {
    return intersection1;
  } else if (sector2Contains && !sector1Contains) {
    return intersection2;
  }

  // Both or neither contain the mouse (edge case) -> use dot-product fallback
  // Choose the one that points in the general direction of the mouse
  const vec1 = { x: intersection1.x - arcCenter.x, y: intersection1.y - arcCenter.y };
  const vec2 = { x: intersection2.x - arcCenter.x, y: intersection2.y - arcCenter.y };
  const vecMouse = { x: mousePos.x - arcCenter.x, y: mousePos.y - arcCenter.y };

  const dot1 = vec1.x * vecMouse.x + vec1.y * vecMouse.y;
  const dot2 = vec2.x * vecMouse.x + vec2.y * vecMouse.y;

  return dot1 > dot2 ? intersection1 : intersection2;
}

/**
 * Compute the signed angle swept from startAngle to endAngle.
 * Result is in range (-2π, 2π], positive means counter-clockwise.
 */
export function computeArcSweep(startAngle: number, endAngle: number): number {
  return angleDiff(startAngle, endAngle);
}
