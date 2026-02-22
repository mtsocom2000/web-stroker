import type { Point } from '../types';
import type { Vertex, Edge, Stroke } from './types';
import { generateId } from './types';

const SNAP_TOLERANCE = 8;
const ARC_SEGMENTS = 36; // Number of segments to approximate a circle/arc
const BEZIER_SEGMENTS = 20; // Number of segments to approximate a bezier curve

interface RawEdge {
  v1: Point;
  v2: Point;
  strokeId: string;
}

interface SpatialHash {
  [key: string]: Vertex[];
}

function pointToKey(p: Point): string {
  const x = Math.floor(p.x / 20);
  const y = Math.floor(p.y / 20);
  return `${x},${y}`;
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function segmentIntersects(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;

  const cross = ax * by - ay * bx;
  if (Math.abs(cross) < 1e-10) return null;

  const t = ((b1.x - a1.x) * by - (b1.y - a1.y) * bx) / cross;
  const u = ((b1.x - a1.x) * ay - (b1.y - a1.y) * ax) / cross;

  if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) {
    return {
      x: a1.x + t * ax,
      y: a1.y + t * ay,
    };
  }

  return null;
}

function sampleArc(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number
): Point[] {
  const points: Point[] = [];
  const numSegments = Math.max(8, Math.ceil(ARC_SEGMENTS * Math.abs(endAngle - startAngle) / (Math.PI * 2)));
  
  for (let i = 0; i <= numSegments; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / numSegments);
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  
  return points;
}

function sampleBezier(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  const points: Point[] = [];
  
  for (let i = 0; i <= BEZIER_SEGMENTS; i++) {
    const t = i / BEZIER_SEGMENTS;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    points.push({
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    });
  }
  
  return points;
}

function getOrCreateVertex(
  position: Point,
  vertices: Vertex[],
  spatialHash: SpatialHash
): Vertex {
  const key = pointToKey(position);

  const cellVertices = spatialHash[key];
  if (cellVertices) {
    for (const v of cellVertices) {
      const dist = distance(v.position, position);
      if (dist < SNAP_TOLERANCE) {
        return v;
      }
    }
  }

  const [kx, ky] = key.split(',').map(Number);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const neighborKey = `${kx + dx},${ky + dy}`;
      const neighborVertices = spatialHash[neighborKey];
      if (neighborVertices) {
        for (const v of neighborVertices) {
          const dist = distance(v.position, position);
          if (dist < SNAP_TOLERANCE) {
            return v;
          }
        }
      }
    }
  }

  const newVertex: Vertex = {
    id: generateId(),
    position,
    incidentEdges: [],
  };

  vertices.push(newVertex);

  if (!spatialHash[key]) {
    spatialHash[key] = [];
  }
  spatialHash[key].push(newVertex);

  return newVertex;
}

export interface PlanarGraph {
  vertices: Vertex[];
  edges: Edge[];
}

export function buildPlanarGraph(strokes: Stroke[]): PlanarGraph {
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const spatialHash: SpatialHash = {};

  if (strokes.length === 0) {
    return { vertices, edges };
  }

  const rawEdges: RawEdge[] = [];

  // Only process stroke.points for non-digital strokes
  // Digital strokes should use digitalSegments which have the correct up-to-date positions
  for (const stroke of strokes) {
    if (stroke.digitalSegments) continue; // Skip digital strokes - they use digitalSegments
    
    const points = stroke.displayPoints || stroke.points;
    if (points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      rawEdges.push({
        v1: points[i],
        v2: points[i + 1],
        strokeId: stroke.id,
      });
    }
  }

  // Process digital segments (arcs and beziers from digital strokes)
  for (const stroke of strokes) {
    if (!stroke.digitalSegments) continue;
    
    for (const segment of stroke.digitalSegments) {
      if (segment.type === 'arc' && segment.arcData) {
        // Sample the arc to create line segments
        const { center, radius, startAngle, endAngle } = segment.arcData;
        const arcPoints = sampleArc(center, radius, startAngle, endAngle);
        
        for (let i = 0; i < arcPoints.length - 1; i++) {
          rawEdges.push({
            v1: arcPoints[i],
            v2: arcPoints[i + 1],
            strokeId: stroke.id,
          });
        }
        
        // If arc is closed (full circle), add edge from last to first point
        if (stroke.isClosed && arcPoints.length > 1) {
          rawEdges.push({
            v1: arcPoints[arcPoints.length - 1],
            v2: arcPoints[0],
            strokeId: stroke.id,
          });
        }
      } else if (segment.type === 'bezier' && segment.points.length >= 4) {
        // Sample the bezier curve to create line segments
        const bezierPoints = sampleBezier(
          segment.points[0],
          segment.points[1],
          segment.points[2],
          segment.points[3]
        );
        
        for (let i = 0; i < bezierPoints.length - 1; i++) {
          rawEdges.push({
            v1: bezierPoints[i],
            v2: bezierPoints[i + 1],
            strokeId: stroke.id,
          });
        }
        
        // If bezier is closed, add edge from last to first point
        if (stroke.isClosed && bezierPoints.length > 1) {
          rawEdges.push({
            v1: bezierPoints[bezierPoints.length - 1],
            v2: bezierPoints[0],
            strokeId: stroke.id,
          });
        }
      } else if (segment.type === 'line' && segment.points.length >= 2) {
        // Handle digital line segments
        rawEdges.push({
          v1: segment.points[0],
          v2: segment.points[1],
          strokeId: stroke.id,
        });
        
        // If line is closed, add closing edge
        if (stroke.isClosed) {
          rawEdges.push({
            v1: segment.points[1],
            v2: segment.points[0],
            strokeId: stroke.id,
          });
        }
      }
    }
  }

  if (rawEdges.length === 0) {
    return { vertices, edges };
  }

  const intersections: Map<number, Point[]> = new Map();

  for (let i = 0; i < rawEdges.length; i++) {
    for (let j = i + 1; j < rawEdges.length; j++) {
      const e1 = rawEdges[i];
      const e2 = rawEdges[j];

      const intersection = segmentIntersects(e1.v1, e1.v2, e2.v1, e2.v2);
      if (intersection) {
        if (!intersections.has(i)) {
          intersections.set(i, []);
        }
        intersections.get(i)!.push(intersection);

        if (!intersections.has(j)) {
          intersections.set(j, []);
        }
        intersections.get(j)!.push(intersection);
      }
    }
  }

  const processedEdges: RawEdge[] = [];

  for (let i = 0; i < rawEdges.length; i++) {
    const raw = rawEdges[i];
    const inters = intersections.get(i) || [];

    if (inters.length === 0) {
      processedEdges.push(raw);
      continue;
    }

    const sorted = [...inters].sort((a, b) => distance(raw.v1, a) - distance(raw.v1, b));
    const allPoints = [raw.v1, ...sorted, raw.v2];

    for (let j = 0; j < allPoints.length - 1; j++) {
      processedEdges.push({
        v1: allPoints[j],
        v2: allPoints[j + 1],
        strokeId: raw.strokeId,
      });
    }
  }

  for (const seg of processedEdges) {
    const v1 = getOrCreateVertex(seg.v1, vertices, spatialHash);
    const v2 = getOrCreateVertex(seg.v2, vertices, spatialHash);

    if (v1.id === v2.id) continue;

    const edge: Edge = {
      id: generateId(),
      v1,
      v2,
      strokeId: seg.strokeId,
      visitedLeft: false,
      visitedRight: false,
    };

    edges.push(edge);
    v1.incidentEdges.push(edge);
    v2.incidentEdges.push(edge);
  }

  for (const vertex of vertices) {
    if (vertex.incidentEdges.length < 2) continue;

    vertex.incidentEdges.sort((a, b) => {
      const aPos = a.v1.id === vertex.id ? a.v2.position : a.v1.position;
      const bPos = b.v1.id === vertex.id ? b.v2.position : b.v1.position;

      const angleA = Math.atan2(aPos.y - vertex.position.y, aPos.x - vertex.position.x);
      const angleB = Math.atan2(bPos.y - vertex.position.y, bPos.x - vertex.position.x);

      return angleA - angleB;
    });
  }

  return { vertices, edges };
}

export function getOtherVertex(edge: Edge, vertex: Vertex): Vertex {
  return edge.v1.id === vertex.id ? edge.v2 : edge.v1;
}

export function isEdgeGoingOut(edge: Edge, vertex: Vertex): boolean {
  return edge.v1.id === vertex.id;
}
