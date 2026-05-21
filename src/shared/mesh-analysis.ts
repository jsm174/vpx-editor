export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
  size: Vec3;
}

export interface MeshSummary {
  vertexCount: number;
  triangleCount: number;
  bbox: BoundingBox;
  centroid: Vec3;
  flatness: number;
  cylindricality: number;
  discLikeness: number;
}

export type PositionsLike = ArrayLike<number>;

export function boundingBox(positions: PositionsLike): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (positions.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 } };
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

export function centroid(positions: PositionsLike): Vec3 {
  let sx = 0,
    sy = 0,
    sz = 0;
  const n = positions.length / 3;
  if (n === 0) return { x: 0, y: 0, z: 0 };
  for (let i = 0; i < positions.length; i += 3) {
    sx += positions[i];
    sy += positions[i + 1];
    sz += positions[i + 2];
  }
  return { x: sx / n, y: sy / n, z: sz / n };
}

export function flatness(bbox: BoundingBox): number {
  const maxXY = Math.max(bbox.size.x, bbox.size.y);
  if (maxXY === 0) return 0;
  const ratio = bbox.size.z / maxXY;
  return Math.max(0, 1 - ratio / 0.3);
}

export function xyCircularity(positions: PositionsLike, c: Vec3): number {
  const n = positions.length / 3;
  if (n < 8) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - c.x;
    const dy = positions[i + 1] - c.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    sum += r;
    sumSq += r * r;
    count++;
  }
  const mean = sum / count;
  if (mean === 0) return 0;
  const variance = sumSq / count - mean * mean;
  const cv = Math.sqrt(Math.max(0, variance)) / mean;
  return Math.max(0, 1 - cv / 0.3);
}

export function cylindricality(positions: PositionsLike): number {
  const bbox = boundingBox(positions);
  const c = centroid(positions);
  const xyRatio = Math.min(bbox.size.x, bbox.size.y) / Math.max(bbox.size.x, bbox.size.y, 1e-9);
  const tallness = bbox.size.z / Math.max(bbox.size.x, bbox.size.y, 1e-9);
  const circ = xyCircularity(positions, c);
  const heightScore = Math.min(1, tallness / 0.5);
  return circ * xyRatio * heightScore;
}

export function discLikeness(positions: PositionsLike): number {
  const bbox = boundingBox(positions);
  const c = centroid(positions);
  const flat = flatness(bbox);
  const circ = xyCircularity(positions, c);
  const xyRatio = Math.min(bbox.size.x, bbox.size.y) / Math.max(bbox.size.x, bbox.size.y, 1e-9);
  return flat * circ * xyRatio;
}

export function summarize(positions: PositionsLike, indices?: ArrayLike<number>): MeshSummary {
  const bbox = boundingBox(positions);
  const c = centroid(positions);
  return {
    vertexCount: positions.length / 3,
    triangleCount: indices ? indices.length / 3 : positions.length / 9,
    bbox,
    centroid: c,
    flatness: flatness(bbox),
    cylindricality: cylindricality(positions),
    discLikeness: discLikeness(positions),
  };
}
