import {
  state,
  elements,
  undoManager,
  GameItem,
  PartGroup,
  GameItemEntry,
  getItem,
  getPartGroup,
  setItem,
  setPartGroup,
  deleteItem,
  deletePartGroup,
} from './state.js';
import { findItemsAtPoint } from './utils.js';
import { deleteObject } from './object-factory.js';
import { generateUniqueFileName, nameEquals, includesName } from '../shared/gameitem-utils.js';
import { saveItemToFile, updateGameitemsJson } from './table-loader.js';
import { updateItemsList } from './items-panel.js';
import { updateLayersList } from './layers-panel.js';
import { updatePropertiesPanel, showRenameModal } from './properties-panel.js';
import { render } from './canvas-renderer.js';
import { updateClipboardMenuState } from './clipboard.js';
import { renameItemInAllCollections, saveCollections } from './collections.js';

interface SelectedNode {
  itemName: string;
  nodeIndex?: number;
}

interface PartGroupSaveData {
  name?: string;
  is_locked?: boolean;
  [key: string]: unknown;
}

interface DrawingOrderItem extends GameItem {
  name: string;
  drawingIndex: number;
}

interface RenameResult {
  success: boolean;
  error?: string;
}

export function toggleItemLock(itemName: string): void {
  const item = getItem(itemName);
  if (!item) return;

  const itemsToToggle = includesName(state.selectedItems, itemName) ? state.selectedItems : [itemName];
  const newLockState = !item.is_locked;

  const label = itemsToToggle.length > 1 ? 'Items' : item._type || 'Item';
  undoManager.beginUndo(newLockState ? `${label} locked` : `${label} unlocked`);

  for (const name of itemsToToggle) {
    const targetItem = getItem(name);
    if (!targetItem) continue;

    undoManager.markForUndo(name);
    targetItem.is_locked = newLockState;

    if (targetItem.is_locked && (state.selectedNode as SelectedNode | null)?.itemName === name) {
      state.selectedNode = null;
    }

    updateGameitemsJson(name);
  }

  undoManager.endUndo();
  updateItemsList();
  updateLayersList();
  updatePropertiesPanel();
  updateClipboardMenuState();
  render();
}

export function renameItem(itemName: string): void {
  const item = getItem(itemName);
  if (!item || item.is_locked) return;
  showRenameModal(itemName, item._type);
}

export function syncIndexVisibility(item: GameItem): void {
  const baseFileName = item._fileName?.replace('gameitems/', '');
  const entry = state.gameitems.find((gi: GameItemEntry) => gi.file_name === baseFileName);
  if (!entry) return;
  if (item.editor_layer_visibility === false) entry.editor_layer_visibility = false;
  else delete entry.editor_layer_visibility;
}

export async function saveGameitemsIndex(): Promise<void> {
  await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
}

export function applyGroupVisibilityToItem(item: GameItem, groupName: string | null): void {
  if (!groupName) return;
  let show = false;
  let hide = false;
  for (const other of Object.values(state.items as Record<string, GameItem>)) {
    if (other === item || !isInGroup(other, groupName)) continue;
    if (other.editor_layer_visibility === false) hide = true;
    else show = true;
  }
  const visible = item.editor_layer_visibility !== false;
  if (visible && hide && !show) item.editor_layer_visibility = false;
  else if (!visible && show && !hide) item.editor_layer_visibility = undefined;
}

export async function assignItemToGroup(itemName: string, groupName: string | null): Promise<void> {
  const item = getItem(itemName);
  if (!item) return;

  undoManager.beginUndo('Group assignment changed');
  undoManager.markGameitemsListForUndo();
  undoManager.markForUndo(itemName);

  item.part_group_name = groupName;
  applyGroupVisibilityToItem(item, groupName);
  syncIndexVisibility(item);

  await saveItemToFile(itemName);
  await saveGameitemsIndex();

  undoManager.endUndo();
  updateLayersList();
  updateItemsList();
  render();
}

export async function drawItemInFront(itemName: string): Promise<void> {
  const item = getItem(itemName);
  if (!item || !item._fileName) return;

  undoManager.beginUndo('Draw order changed');
  undoManager.markGameitemsListForUndo();

  const baseFileName = item._fileName.replace('gameitems/', '');
  const idx = state.gameitems.findIndex((gi: GameItemEntry) => gi.file_name === baseFileName);
  if (idx >= 0) {
    const [entry] = state.gameitems.splice(idx, 1);
    state.gameitems.push(entry);

    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  }

  undoManager.endUndo();
  render();
}

export async function drawItemInBack(itemName: string): Promise<void> {
  const item = getItem(itemName);
  if (!item || !item._fileName) return;

  undoManager.beginUndo('Draw order changed');
  undoManager.markGameitemsListForUndo();

  const baseFileName = item._fileName.replace('gameitems/', '');
  const idx = state.gameitems.findIndex((gi: GameItemEntry) => gi.file_name === baseFileName);
  if (idx >= 0) {
    const [entry] = state.gameitems.splice(idx, 1);
    state.gameitems.unshift(entry);

    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  }

  undoManager.endUndo();
  render();
}

function getDrawingOrderIndex(name: string): number {
  const item = getItem(name);
  if (!item || !item._fileName) return Infinity;
  const baseFileName = item._fileName.replace('gameitems/', '');
  const idx = state.gameitems.findIndex((gi: GameItemEntry) => gi.file_name === baseFileName);
  return idx >= 0 ? idx : Infinity;
}

export function getDrawingOrderItems(mode: 'select' | 'hit'): DrawingOrderItem[] {
  let names: string[];
  if (mode === 'select') {
    names = state.selectedItems;
  } else if (mode === 'hit') {
    names = findItemsAtPoint(state.items, state.lastMousePosition.x, state.lastMousePosition.y);
  } else {
    return [];
  }

  return names
    .map((name: string) => {
      const item = getItem(name);
      if (item) return { ...item, name, drawingIndex: getDrawingOrderIndex(name) } as DrawingOrderItem;
      return null;
    })
    .filter((item): item is DrawingOrderItem => item !== null)
    .sort((a, b) => b.drawingIndex - a.drawingIndex);
}

export function showRenamePartGroupModal(groupName: string): void {
  const group = getPartGroup(groupName);
  if (!group) return;

  const existingNames = Object.keys(state.items);

  window.vpxEditor.showRenameDialog({
    mode: 'partgroup',
    currentName: groupName,
    existingNames,
    elementType: 'PartGroup',
  });
}

export async function renamePartGroup(oldName: string, newName: string): Promise<void> {
  const group = getPartGroup(oldName);
  if (!group) return;

  undoManager.beginUndo('Group renamed');

  const oldFileName = group._fileName as string;
  const oldBaseFileName = oldFileName.replace('gameitems/', '');
  const existingFileNames = state.gameitems.map(gi => gi.file_name).filter(f => f !== oldBaseFileName);
  const newBaseFileName = generateUniqueFileName('PartGroup', newName, existingFileNames);
  const newFileName = `gameitems/${newBaseFileName}`;

  undoManager.markForRename(oldName, newName, oldFileName, newFileName);

  const oldPath = `${state.extractedDir}/${oldFileName}`;
  const newPath = `${state.extractedDir}/${newFileName}`;
  const renameResult: RenameResult = await window.vpxEditor.renameFile(oldPath, newPath);
  if (!renameResult.success) {
    undoManager.cancelUndo();
    elements.statusBar!.textContent = `Rename failed: ${renameResult.error}`;
    return;
  }

  group.name = newName;
  group._fileName = newFileName;

  const partGroupData: PartGroupSaveData = { ...group };
  delete (partGroupData as Record<string, unknown>)._type;
  delete (partGroupData as Record<string, unknown>)._fileName;
  delete (partGroupData as Record<string, unknown>)._layer;
  partGroupData.is_locked = partGroupData.is_locked ?? false;
  const saveData = { PartGroup: partGroupData };

  await window.vpxEditor.writeFile(newPath, JSON.stringify(saveData, null, 2));

  deletePartGroup(oldName);
  deleteItem(oldName);
  setPartGroup(newName, group as import('./state.js').PartGroup);
  setItem(newName, group as import('./state.js').GameItem, newBaseFileName);

  for (const [itemName, item] of Object.entries(state.items) as [string, GameItem][]) {
    if (item.part_group_name && nameEquals(item.part_group_name, oldName)) {
      item.part_group_name = newName;
      await saveItemToFile(itemName);
    }
  }

  const giIndex = state.gameitems.findIndex((gi: GameItemEntry) => gi.file_name === oldBaseFileName);
  if (giIndex >= 0) {
    state.gameitems[giIndex].file_name = newBaseFileName;
    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  }

  undoManager.markCollectionsForUndo();
  if (renameItemInAllCollections(oldName, newName)) {
    await saveCollections();
  }

  undoManager.endUndo();

  state.selectedPartGroup = newName;
  updateLayersList();
  updatePropertiesPanel();
  requestAnimationFrame(() => {
    const groupHeader = document.querySelector(`.layer-header[data-group-name="${newName}"]`);
    if (groupHeader) {
      groupHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

function isInGroup(item: GameItem, groupName: string): boolean {
  return (
    ((item.part_group_name != null && nameEquals(item.part_group_name, groupName)) ||
      (item._layerName != null && nameEquals(item._layerName, groupName))) &&
    item._type !== 'PartGroup'
  );
}

function getChildGroupNames(groupName: string): string[] {
  return Object.values(state.partGroups as Record<string, PartGroup>)
    .filter(g => g.part_group_name != null && nameEquals(g.part_group_name, groupName))
    .map(g => g.name as string)
    .filter(Boolean);
}

function countItemsInGroup(groupName: string): number {
  let count = 0;

  for (const childName of getChildGroupNames(groupName)) {
    count += countItemsInGroup(childName);
  }

  count += Object.values(state.items as Record<string, GameItem>).filter(item => isInGroup(item, groupName)).length;

  return count;
}

export async function showDeletePartGroupModal(groupName: string): Promise<void> {
  const group = getPartGroup(groupName);
  if (!group) return;

  const itemCount = countItemsInGroup(groupName);
  if (itemCount > 0) {
    const confirmed = confirm(
      `Group "${groupName}" contains ${itemCount} item${itemCount === 1 ? '' : 's'}. Delete group and its items?`
    );
    if (!confirmed) return;
  }

  undoManager.beginUndo('Group deleted');
  await deleteGroupAndContents(groupName);
  await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  undoManager.endUndo();

  state.selectedPartGroup = null;
  state.selectedItems = state.selectedItems.filter(name => getItem(name));
  if (state.primarySelectedItem && !getItem(state.primarySelectedItem)) {
    state.primarySelectedItem = null;
  }
  updateLayersList();
  updateItemsList();
  updatePropertiesPanel();
  render();
}

export async function deleteGroupAndContents(groupName: string): Promise<void> {
  const group = getPartGroup(groupName);
  if (!group) return;

  for (const childName of getChildGroupNames(groupName)) {
    await deleteGroupAndContents(childName);
  }

  const itemsInGroup = Object.keys(state.items as Record<string, GameItem>).filter(name => {
    const item = getItem(name);
    return item && isInGroup(item, groupName);
  });

  for (const itemName of itemsInGroup) {
    await deleteObject(itemName, true);
  }

  await undoManager.markForDelete(groupName);
  const fileName = group._fileName;
  if (fileName) {
    await window.vpxEditor.deleteFile(`${state.extractedDir}/${fileName}`);
    const baseFileName = fileName.split('/').pop();
    state.gameitems = state.gameitems.filter((gi: GameItemEntry) => gi.file_name !== baseFileName);
    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  }
  deletePartGroup(groupName);
  deleteItem(groupName);
}
