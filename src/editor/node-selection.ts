import type { SelectedNodeInfo, SelectedNodesInfo } from './state.js';
import { nameEquals } from '../shared/gameitem-utils.js';

export function selectedNodeIndices(primary: SelectedNodeInfo | null, group: SelectedNodesInfo | null): number[] {
  if (!primary) return [];
  if (group && nameEquals(group.itemName, primary.itemName) && group.indices.includes(primary.nodeIndex)) {
    return group.indices;
  }
  return [primary.nodeIndex];
}

export function toggleNodeSelection(indices: number[], clicked: number): { indices: number[]; primary: number | null } {
  if (indices.includes(clicked)) {
    const rest = indices.filter(i => i !== clicked);
    return { indices: rest, primary: rest.length > 0 ? rest[rest.length - 1] : null };
  }
  return { indices: [...indices, clicked], primary: clicked };
}

export interface RectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface NodeCandidate {
  name: string;
  points: { x: number; y: number }[];
}

export function pickNodesInRect(
  candidates: NodeCandidate[],
  rect: RectBounds,
  preferred: string | null
): SelectedNodesInfo | null {
  let best: SelectedNodesInfo | null = null;
  for (const { name, points } of candidates) {
    const indices: number[] = [];
    points.forEach((p, i) => {
      if (p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY) indices.push(i);
    });
    if (indices.length === 0) continue;
    if (preferred && nameEquals(name, preferred)) return { itemName: name, indices };
    if (!best || indices.length > best.indices.length) best = { itemName: name, indices };
  }
  return best;
}

export function mergeNodeIndices(existing: number[], added: number[]): number[] {
  return [...existing, ...added.filter(i => !existing.includes(i))];
}
