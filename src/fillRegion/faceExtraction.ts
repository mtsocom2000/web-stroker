import type { Point } from '../types';
import type { Edge, Face, Vertex } from './types';
import { generateId } from './types';

interface WalkResult {
  points: Point[];
  edgeIds: string[];
}

const MIN_FACE_AREA = 500;
const MAX_FACE_STEPS = 2000;

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
  let cx = 0;
  let cy = 0;
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

function normalizeAnglePositive(angle: number): number {
  let result = angle % (Math.PI * 2);
  if (result < 0) result += Math.PI * 2;
  return result;
}

function getNextEdge(from: Vertex, at: Vertex): Edge | null {
  if (at.incidentEdges.length < 2) return null;

  const incomingAngle = Math.atan2(from.position.y - at.position.y, from.position.x - at.position.x);
  let bestEdge: Edge | null = null;
  let bestDelta = Infinity;

  for (const edge of at.incidentEdges) {
    const other = edge.v1.id === at.id ? edge.v2 : edge.v1;
    if (other.id === from.id) continue;

    const outAngle = Math.atan2(other.position.y - at.position.y, other.position.x - at.position.x);
    const delta = normalizeAnglePositive(outAngle - incomingAngle);

    if (delta < bestDelta) {
      bestDelta = delta;
      bestEdge = edge;
    }
  }

  return bestEdge;
}

function isVisited(edge: Edge, from: Vertex, to: Vertex): boolean {
  const isForward = edge.v1.id === from.id && edge.v2.id === to.id;
  return isForward ? edge.visitedLeft : edge.visitedRight;
}

function markVisited(edge: Edge, from: Vertex, to: Vertex): void {
  const isForward = edge.v1.id === from.id && edge.v2.id === to.id;
  if (isForward) {
    edge.visitedLeft = true;
  } else {
    edge.visitedRight = true;
  }
}

function normalizePolygon(points: Point[]): Point[] {
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    const dx = first.x - last.x;
    const dy = first.y - last.y;
    if (Math.hypot(dx, dy) < 1e-6) {
      return points.slice(0, -1);
    }
  }
  return points;
}

function walkFace(startEdge: Edge, startFrom: Vertex, startTo: Vertex): WalkResult | null {
  const points: Point[] = [];
  const edgeIds: string[] = [];
  const visitedTrail: Array<{ edge: Edge; from: Vertex; to: Vertex }> = [];

  let currentEdge: Edge = startEdge;
  let from: Vertex = startFrom;
  let to: Vertex = startTo;

  for (let step = 0; step < MAX_FACE_STEPS; step++) {
    if (isVisited(currentEdge, from, to)) {
      console.log('[face] walkFace: already visited, aborting', { step, pointsCollected: points.length });
      for (const entry of visitedTrail) {
        if (entry.edge.v1.id === entry.from.id && entry.edge.v2.id === entry.to.id) {
          entry.edge.visitedLeft = false;
        } else {
          entry.edge.visitedRight = false;
        }
      }
      return null;
    }

    markVisited(currentEdge, from, to);
    visitedTrail.push({ edge: currentEdge, from, to });
    if (points.length === 0) {
      points.push({ ...from.position });
    }
    points.push({ ...to.position });
    edgeIds.push(currentEdge.id);

    const nextEdge = getNextEdge(from, to);
    if (!nextEdge) {
      console.log('[face] walkFace: no next edge found', { 
        step, 
        pointsCollected: points.length,
        currentVertexIncidentEdges: to.incidentEdges.length 
      });
      return null;
    }

    const nextFrom = to;
    const nextTo = nextEdge.v1.id === to.id ? nextEdge.v2 : nextEdge.v1;

    if (nextEdge.id === startEdge.id && nextFrom.id === startFrom.id && nextTo.id === startTo.id) {
      console.log('[face] walkFace: completed cycle!', { 
        steps: step + 1, 
        points: points.length,
        edgeIds: edgeIds.length 
      });
      return { points, edgeIds };
    }

    currentEdge = nextEdge;
    from = nextFrom;
    to = nextTo;
  }

  console.log('[face] walkFace: max steps exceeded', { maxSteps: MAX_FACE_STEPS });
  for (const entry of visitedTrail) {
    if (entry.edge.v1.id === entry.from.id && entry.edge.v2.id === entry.to.id) {
      entry.edge.visitedLeft = false;
    } else {
      entry.edge.visitedRight = false;
    }
  }
  return null;
}

export function extractFaces(edges: Edge[]): Face[] {
  if (edges.length === 0) return [];

  const faces: Face[] = [];
  const rejectedFaces: { reason: string; area?: number; polygonLength?: number }[] = [];

  for (const edge of edges) {
    if (!edge.visitedLeft) {
      const face = walkFace(edge, edge.v1, edge.v2);
      if (face) {
        const polygon = normalizePolygon(face.points);
        if (polygon.length >= 3) {
          const area = Math.abs(computeSignedArea(polygon));
          if (area >= MIN_FACE_AREA) {
            faces.push({
              id: generateId(),
              vertices: polygon.map(p => ({ id: generateId(), position: p, incidentEdges: [] })),
              edgeIds: face.edgeIds,
              area,
              centroid: computeCentroid(polygon),
            });
          } else {
            rejectedFaces.push({ reason: 'area too small', area });
          }
        } else {
          rejectedFaces.push({ reason: 'polygon too few vertices', polygonLength: polygon.length });
        }
      } else {
        rejectedFaces.push({ reason: 'walkFace returned null (left)' });
      }
    }

    if (!edge.visitedRight) {
      const face = walkFace(edge, edge.v2, edge.v1);
      if (face) {
        const polygon = normalizePolygon(face.points);
        if (polygon.length >= 3) {
          const area = Math.abs(computeSignedArea(polygon));
          if (area >= MIN_FACE_AREA) {
            faces.push({
              id: generateId(),
              vertices: polygon.map(p => ({ id: generateId(), position: p, incidentEdges: [] })),
              edgeIds: face.edgeIds,
              area,
              centroid: computeCentroid(polygon),
            });
          } else {
            rejectedFaces.push({ reason: 'area too small', area });
          }
        } else {
          rejectedFaces.push({ reason: 'polygon too few vertices', polygonLength: polygon.length });
        }
      } else {
        rejectedFaces.push({ reason: 'walkFace returned null (right)' });
      }
    }
  }
  
  console.log('[face] extractFaces debug', {
    edgesCount: edges.length,
    facesFound: faces.length,
    rejectedCount: rejectedFaces.length,
    rejected: rejectedFaces,
    MIN_FACE_AREA,
  });

  if (faces.length === 0) return [];

  // Deduplicate faces with identical edge sets (same face walked in both directions)
  const uniqueFaces: Face[] = [];
  const seenEdgeSets = new Set<string>();
  
  for (const face of faces) {
    const edgeSetKey = face.edgeIds.slice().sort().join(',');
    if (!seenEdgeSets.has(edgeSetKey)) {
      seenEdgeSets.add(edgeSetKey);
      uniqueFaces.push(face);
    }
  }
  
  console.log('[face] after deduplication', {
    beforeDedup: faces.length,
    afterDedup: uniqueFaces.length,
  });

  if (uniqueFaces.length === 0) return [];

  // In a bounded drawing context, all detected faces are valid interior regions
  // We don't need to filter out an "outer face" because there isn't one
  // Just sort by area for consistent ordering
  uniqueFaces.sort((a, b) => a.area - b.area);
  
  console.log('[face] final result', {
    totalFaces: uniqueFaces.length,
    areas: uniqueFaces.map(f => f.area),
  });
  
  return uniqueFaces;
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
