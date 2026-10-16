import type { SelectedNodeInfo, SelectedNodesInfo } from './state.js';
import { nameEquals } from '../shared/gameitem-utils.js';

/**
 * The control points selected on the primary item. `group` only counts while it names the same item and still
 * contains the primary node, so code that assigns `selectedNode` directly cannot leave a stale group behind.
 */
export function selectedNodeIndices(primary: SelectedNodeInfo | null, group: SelectedNodesInfo | null): number[] {
  if (!primary) return [];
  if (group && nameEquals(group.itemName, primary.itemName) && group.indices.includes(primary.nodeIndex)) {
    return group.indices;
  }
  return [primary.nodeIndex];
}

/** Shift+click: adds the clicked node (making it primary), or removes it if it was already selected. */
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

/**
 * Window selection of control points. A selection holds the points of one item, so when the rectangle covers
 * points of several items, the preferred item wins if it has any, otherwise the one with the most points inside.
 */
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
    if (name === preferred) return { itemName: name, indices };
    if (!best || indices.length > best.indices.length) best = { itemName: name, indices };
  }
  return best;
}

/** Window select with Shift: keeps the points already selected and appends the newly picked ones. */
export function mergeNodeIndices(existing: number[], added: number[]): number[] {
  return [...existing, ...added.filter(i => !existing.includes(i))];
}
