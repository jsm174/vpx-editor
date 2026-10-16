import { state, getItem, isItemVisible, setSelection } from './state.js';
import { undoManager } from './state.js';
import { DragPoint } from './state.js';
import { mergeNodeIndices, pickNodesInRect, selectedNodeIndices, toggleNodeSelection } from './node-selection.js';
import { getDragPointCoords, setDragPointCoords } from '../types/game-objects.js';
import { saveItemToFile } from './table-loader.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { render } from './canvas-renderer.js';
import { findClosestSegmentIndex, findItemsAtPoint } from './utils.js';
import { VIEW_MODE_3D } from '../shared/constants.js';
import { includesName, nameEquals } from '../shared/gameitem-utils.js';
import { invokeCallback } from '../shared/callbacks.js';

interface SelectedNode {
  itemName: string;
  nodeIndex: number;
}

interface NewDragPoint {
  x: number;
  y: number;
  z: number;
  smooth: boolean;
  is_slingshot: boolean;
  has_auto_texture: boolean;
  tex_coord: number;
  is_locked: boolean;
  editor_layer: number;
}

export const EDITABLE_DRAG_POINT_TYPES: string[] = ['Wall', 'Ramp', 'Rubber', 'Light', 'Trigger', 'Flasher'];

export function toggleNodeSmooth(itemName: string, nodeIndex: number): void {
  const item = getItem(itemName);
  if (!item || !item.drag_points) return;

  undoManager.beginUndo('Smooth toggled');
  undoManager.markForUndo(itemName);

  const pt = item.drag_points[nodeIndex];
  pt.smooth = !pt.smooth;

  saveItemToFile(itemName);
  undoManager.endUndo();
  updatePropertiesPanel();
  render();
}

export function getSelectedNodeIndices(): number[] {
  return selectedNodeIndices(state.selectedNode, state.selectedNodes);
}

export function toggleNodeInSelection(itemName: string, nodeIndex: number): void {
  const sameItem = !!state.selectedNode && nameEquals(state.selectedNode.itemName, itemName);
  const current = sameItem ? getSelectedNodeIndices() : [];
  const { indices, primary } = toggleNodeSelection(current, nodeIndex);
  state.selectedNode = primary === null ? null : { itemName, nodeIndex: primary };
  state.selectedNodes = indices.length > 1 ? { itemName, indices } : null;
  updatePropertiesPanel();
  render();
}

export function moveSelectedNodes(itemName: string, primaryIndex: number, worldX: number, worldY: number): void {
  const item = getItem(itemName);
  if (!item || !item.drag_points || !item.drag_points[primaryIndex]) return;

  const origin = getDragPointCoords(item.drag_points[primaryIndex]);
  const dx = worldX - origin.x;
  const dy = worldY - origin.y;
  const indices = getSelectedNodeIndices();
  for (const index of indices.includes(primaryIndex) ? indices : [primaryIndex]) {
    const pt = item.drag_points[index];
    if (!pt) continue;
    const { x, y } = getDragPointCoords(pt);
    setDragPointCoords(pt, x + dx, y + dy);
  }
}

export function deleteSelectedNodes(): void {
  const primary = state.selectedNode;
  if (!primary) return;
  const indices = getSelectedNodeIndices();
  if (indices.length <= 1) {
    deleteNode(primary.itemName, primary.nodeIndex);
    return;
  }

  const item = getItem(primary.itemName);
  if (!item || item.is_locked || !item.drag_points) return;
  if (item.drag_points.length - indices.length < getMinDragPoints(item._type)) return;

  undoManager.beginUndo('Control points deleted');
  undoManager.markForUndo(primary.itemName);

  for (const index of [...indices].sort((a, b) => b - a)) {
    item.drag_points.splice(index, 1);
  }
  state.selectedNode = null;
  state.selectedNodes = null;

  saveItemToFile(primary.itemName);
  undoManager.endUndo();
  updatePropertiesPanel();
  render();
}

export interface NodeSelection {
  itemName: string;
  indices: number[];
}

export interface NodeBoxRect {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

export function snapshotNodeSelection(): NodeSelection | null {
  if (!state.selectedNode) return null;
  return { itemName: state.selectedNode.itemName, indices: getSelectedNodeIndices() };
}

export function restoreNodeSelection(selection: NodeSelection): void {
  const { itemName, indices } = selection;
  state.selectedNode = { itemName, nodeIndex: indices[indices.length - 1] };
  state.selectedNodes = indices.length > 1 ? { itemName, indices } : null;
}

export function nodeBoxCandidateItems(): string[] | null {
  return state.alwaysDrawDragPoints ? null : [...state.selectedItems];
}

export function selectNodesInRect(
  rect: NodeBoxRect,
  candidateItems: string[] | null,
  base: NodeSelection | null,
  additive = false
): boolean {
  const names = candidateItems ?? Object.entries(state.items).map(([key, item]) => item.name || key);
  const candidates = names.flatMap(name => {
    const item = getItem(name);
    if (!item || !item.drag_points || item.drag_points.length === 0 || !isItemVisible(item, name)) return [];
    return [{ name, points: item.drag_points.map(getDragPointCoords) }];
  });
  const picked = pickNodesInRect(
    candidates,
    {
      minX: Math.min(rect.startX, rect.endX),
      maxX: Math.max(rect.startX, rect.endX),
      minY: Math.min(rect.startY, rect.endY),
      maxY: Math.max(rect.startY, rect.endY),
    },
    state.primarySelectedItem
  );
  if (!picked) return false;

  const sameItem = base && nameEquals(base.itemName, picked.itemName) ? base : null;
  const indices = sameItem ? mergeNodeIndices(sameItem.indices, picked.indices) : picked.indices;
  let items = [picked.itemName];
  if (additive) {
    items = includesName(state.selectedItems, picked.itemName)
      ? state.selectedItems
      : [...state.selectedItems, picked.itemName];
  }
  setSelection(items, picked.itemName);
  restoreNodeSelection({ itemName: picked.itemName, indices });
  return true;
}

export function getMinDragPoints(type: string): number {
  return type === 'Flasher' || type === 'Ramp' || type === 'Rubber' ? 2 : 3;
}

export function deleteNode(itemName: string, nodeIndex: number): void {
  const item = getItem(itemName);
  if (!item || item.is_locked || !item.drag_points || item.drag_points.length <= getMinDragPoints(item._type)) return;

  undoManager.beginUndo('Control point deleted');
  undoManager.markForUndo(itemName);

  item.drag_points.splice(nodeIndex, 1);
  state.selectedNode = null;
  state.selectedNodes = null;

  saveItemToFile(itemName);
  undoManager.endUndo();
  render();
}

export function toggleNodeSlingshot(itemName: string, nodeIndex: number): void {
  const item = getItem(itemName);
  if (!item || !item.drag_points) return;

  const pt = item.drag_points[nodeIndex];
  if (pt.smooth) return;

  undoManager.beginUndo('Slingshot toggled');
  undoManager.markForUndo(itemName);

  pt.is_slingshot = !pt.is_slingshot;
  if (pt.is_slingshot) {
    const nextIndex = (nodeIndex + 1) % item.drag_points.length;
    item.drag_points[nextIndex].smooth = false;
  }

  saveItemToFile(itemName);
  undoManager.endUndo();
  render();
}

export function addNode(itemName: string, worldX: number, worldY: number, smooth: boolean = false): void {
  const item = getItem(itemName);
  if (!item || !item.drag_points) return;

  undoManager.beginUndo('Control point added');
  undoManager.markForUndo(itemName);

  const insertIndex = findClosestSegmentIndex(item, worldX, worldY);

  const newPoint: NewDragPoint = {
    x: worldX,
    y: worldY,
    z: 0,
    smooth: smooth,
    is_slingshot: false,
    has_auto_texture: true,
    tex_coord: 0,
    is_locked: false,
    editor_layer: 0,
  };

  item.drag_points.splice(insertIndex, 0, newPoint as DragPoint);
  (state as { selectedNode: SelectedNode | null }).selectedNode = { itemName, nodeIndex: insertIndex };
  state.selectedNodes = null;

  saveItemToFile(itemName);
  undoManager.endUndo();
  render();
}

function canAddPointTo(name: string): boolean {
  const item = getItem(name);
  return !!item && !item.is_locked && !!item.drag_points && EDITABLE_DRAG_POINT_TYPES.includes(item._type);
}

export function pickPointTarget(hits: string[], selected: string | null): string | null {
  const editableSelected = selected && canAddPointTo(selected) ? selected : null;
  const editableHits = hits.filter(canAddPointTo);
  return editableHits.find(name => name === editableSelected) ?? editableHits[0] ?? editableSelected;
}

export function addPointAtCursor(smooth: boolean): void {
  if (state.viewMode === VIEW_MODE_3D || !state.lastMousePosition || state.isTableLocked) return;
  const { x, y } = state.lastMousePosition;
  const target = pickPointTarget(findItemsAtPoint(state.items, x, y), state.primarySelectedItem);
  if (!target) return;
  const selectionChanged = !state.primarySelectedItem || !nameEquals(state.primarySelectedItem, target);
  if (selectionChanged) setSelection([target], target);
  addNode(target, x, y, smooth);
  updatePropertiesPanel();
  if (selectionChanged) invokeCallback('selectionChangeCallback');
}
