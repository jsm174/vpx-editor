import { state, getItem } from './state.js';
import { undoManager } from './state.js';
import { DragPoint } from './state.js';
import { saveItemToFile } from './table-loader.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { render } from './canvas-renderer.js';
import { findClosestSegmentIndex } from './utils.js';

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

export function deleteNode(itemName: string, nodeIndex: number): void {
  const item = getItem(itemName);
  if (!item || !item.drag_points || item.drag_points.length <= 3) return;

  undoManager.beginUndo('Control point deleted');
  undoManager.markForUndo(itemName);

  item.drag_points.splice(nodeIndex, 1);
  state.selectedNode = null;

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

export function addPointToObject(itemName: string, worldX: number, worldY: number): void {
  const item = getItem(itemName);
  if (!item || !item.drag_points) return;

  undoManager.beginUndo('Control point added');
  undoManager.markForUndo(itemName);

  const insertIndex = findClosestSegmentIndex(item, worldX, worldY);

  const newPoint: NewDragPoint = {
    x: worldX,
    y: worldY,
    z: 0,
    smooth: false,
    is_slingshot: false,
    has_auto_texture: true,
    tex_coord: 0,
    is_locked: false,
    editor_layer: 0,
  };

  item.drag_points.splice(insertIndex, 0, newPoint as DragPoint);
  (state as { selectedNode: SelectedNode | null }).selectedNode = { itemName, nodeIndex: insertIndex };

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

  saveItemToFile(itemName);
  undoManager.endUndo();
  render();
}
