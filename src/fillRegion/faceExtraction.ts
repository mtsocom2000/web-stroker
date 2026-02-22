import type { Point } from '../types';
import type { Edge, Face, Vertex } from './types';
import { generateId } from './types';

interface CycleWithEdges {
  vertices: Point[];
  edgeIds: string[];
}

function computeSignedArea(vertices: Point[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function computeCentroid(vertices: Point[]): Point {
  let cx = 0, cy = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    cx += (vertices[i].x + vertices[j].x) * cross;
    cy += (vertices[i].y + vertices[j].y) * cross;
  }
  const area = computeSignedArea(vertices);
  if (Math.abs(area) < 1e-10) return vertices[0] || { x: 0, y: 0 };
  const factor = 1 / (6 * area);
  return { x: cx * factor, y: cy * factor };
}

function findCycles(edges: Edge[]): CycleWithEdges[] {
  const cycles: CycleWithEdges[] = [];
  
  const edgeSet = new Set(edges.map(e => e.id));
  
  function dfs(
    current: Vertex,
    start: Vertex,
    visited: Set<string>,
    path: { vertex: Vertex; edgeId: string }[],
    prevVertexId: string | null
  ): void {
    if (path.length > 50) return;
    
    visited.add(current.id);
    
    if (current.id === start.id && path.length >= 3) {
      const cyclePoints: Point[] = path.map(p => ({ ...p.vertex.position }));
      cyclePoints.push({ ...start.position });
      const cycleEdgeIds = path.map(p => p.edgeId);
      cycles.push({ vertices: cyclePoints, edgeIds: cycleEdgeIds });
      visited.delete(current.id);
      return;
    }
    
    for (const edge of current.incidentEdges) {
      if (!edgeSet.has(edge.id)) continue;
      
      const edgeAlreadyInPath = path.some(p => p.edgeId === edge.id);
      if (edgeAlreadyInPath) continue;
      
      const next = edge.v1.id === current.id ? edge.v2 : edge.v1;
      
      if (next.id === start.id && path.length >= 2) {
        const cyclePoints: Point[] = path.map(p => ({ ...p.vertex.position }));
        cyclePoints.push({ ...next.position });
        const cycleEdgeIds = [...path.map(p => p.edgeId), edge.id];
        cycles.push({ vertices: cyclePoints, edgeIds: cycleEdgeIds });
        continue;
      }
      
      if (next.id !== prevVertexId && !visited.has(next.id)) {
        dfs(next, start, visited, [...path, { vertex: next, edgeId: edge.id }], current.id);
      }
    }
    
    visited.delete(current.id);
  }
  
  for (const edge of edges) {
    for (const vertex of [edge.v1, edge.v2]) {
      if (vertex.incidentEdges.length >= 2) {
        const visited = new Set<string>();
        dfs(vertex, vertex, visited, [{ vertex, edgeId: edge.id }], null);
      }
    }
  }

  return cycles;
}

function simplifyCycle(points: Point[]): Point[] {
  if (points.length <= 4) return points;
  
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    if (Math.abs(dx1 * dy2 - dy1 * dx2) > 1 || 
        Math.abs(dx1 * dx2 + dy1 * dy2) < 0.9) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  
  return result;
}

function removeDuplicateCycles(cycles: CycleWithEdges[]): CycleWithEdges[] {
  if (cycles.length === 0) return [];
  
  const MIN_FACE_AREA = 500;
  const unique: CycleWithEdges[] = [];
  
  const validCycles = cycles
    .map(c => ({
      ...c,
      vertices: simplifyCycle(c.vertices),
      area: Math.abs(computeSignedArea(c.vertices))
    }))
    .filter(c => {
      return c.area > MIN_FACE_AREA;
    });
   
  validCycles.sort((a, b) => b.area - a.area);
  
  for (const cycle of validCycles) {
    let isDuplicate = false;
    for (const existing of unique) {
      if (Math.abs(computeSignedArea(cycle.vertices) - computeSignedArea(existing.vertices)) < 100) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      unique.push({ vertices: cycle.vertices, edgeIds: cycle.edgeIds });
    }
  }
  
  return unique;
}

function ensureCCW(points: Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  if (area < 0) {
    return [...points].reverse();
  }
  return points;
}

export function extractFaces(edges: Edge[]): Face[] {
  if (edges.length === 0) return [];
  
  const cycles = findCycles(edges);
  const uniqueCycles = removeDuplicateCycles(cycles);
  
  return uniqueCycles.map(cycle => {
    const ccwVertices = ensureCCW(cycle.vertices);
    const verts = ccwVertices.map(p => ({
      id: generateId(),
      position: p,
      incidentEdges: []
    }));
    return {
      id: generateId(),
      vertices: verts,
      edgeIds: cycle.edgeIds,
      area: Math.abs(computeSignedArea(ccwVertices)),
      centroid: computeCentroid(ccwVertices)
    };
  });
}

export function computeBounds(polygon: Point[]): { min: Point; max: Point } {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}
