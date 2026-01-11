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

interface ItemSaveData {
  name?: string;
  part_group_name?: string | null;
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
  const action = newLockState ? 'Lock' : 'Unlock';

  undoManager.beginUndo(`${action}`);

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

export async function assignItemToGroup(itemName: string, groupName: string | null): Promise<void> {
  const item = getItem(itemName);
  if (!item) return;

  undoManager.beginUndo('Assign to Group');
  undoManager.markForUndo(itemName);

  item.part_group_name = groupName;

  await saveItemToFile(itemName);

  undoManager.endUndo();
  updateLayersList();
  updateItemsList();
  render();
  elements.statusBar!.textContent = groupName
    ? `Assigned "${itemName}" to group "${groupName}"`
    : `Removed "${itemName}" from group`;
}

export async function drawItemInFront(itemName: string): Promise<void> {
  const item = getItem(itemName);
  if (!item || !item._fileName) return;

  undoManager.beginUndo('Draw In Front');
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
  elements.statusBar!.textContent = `Moved "${itemName}" to front`;
}

export async function drawItemInBack(itemName: string): Promise<void> {
  const item = getItem(itemName);
  if (!item || !item._fileName) return;

  undoManager.beginUndo('Draw In Back');
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
  elements.statusBar!.textContent = `Moved "${itemName}" to back`;
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

  undoManager.beginUndo(`Rename group ${oldName}`);

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

  if (renameItemInAllCollections(oldName, newName)) {
    undoManager.markCollectionsForUndo();
    await saveCollections();
  }

  undoManager.endUndo();

  state.selectedPartGroup = newName;
  updateLayersList();
  updatePropertiesPanel();
  elements.statusBar!.textContent = `Renamed group "${oldName}" to "${newName}"`;

  requestAnimationFrame(() => {
    const groupHeader = document.querySelector(`.layer-header[data-group-name="${newName}"]`);
    if (groupHeader) {
      groupHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

function countItemsInGroup(groupName: string): number {
  let count = 0;

  const childGroups = Object.entries(state.partGroups as Record<string, PartGroup>)
    .filter(([_, g]) => g.part_group_name === groupName)
    .map(([name]) => name);

  for (const childName of childGroups) {
    count += countItemsInGroup(childName);
  }

  count += Object.values(state.items as Record<string, GameItem>).filter(
    item => (item.part_group_name === groupName || item._layerName === groupName) && item._type !== 'PartGroup'
  ).length;

  return count;
}

export async function showDeletePartGroupModal(groupName: string): Promise<void> {
  const group = getPartGroup(groupName);
  if (!group) return;

  const itemCount = countItemsInGroup(groupName);
  if (itemCount > 0) {
    const confirmed = confirm(
      `Group "${groupName}" contains ${itemCount} item${itemCount === 1 ? '' : 's'}. Delete group and move items to root?`
    );
    if (!confirmed) return;
  }

  undoManager.beginUndo('Delete group');
  await deleteGroupAndMoveItems(groupName, null);
  await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  undoManager.endUndo();

  state.selectedPartGroup = null;
  updateLayersList();
  updatePropertiesPanel();
  render();
  elements.statusBar!.textContent = `Deleted group "${groupName}"`;
}

export async function deleteGroupAndMoveItems(groupName: string, targetGroup: string | null): Promise<void> {
  const group = getPartGroup(groupName);
  if (!group) return;

  const childGroups = Object.entries(state.partGroups as Record<string, PartGroup>)
    .filter(([_, g]) => g.part_group_name === groupName)
    .map(([name]) => name);

  for (const childName of childGroups) {
    await deleteGroupAndMoveItems(childName, targetGroup);
  }

  const itemsInGroup = Object.entries(state.items as Record<string, GameItem>).filter(
    ([_, item]) => (item.part_group_name === groupName || item._layerName === groupName) && item._type !== 'PartGroup'
  );

  for (const [itemName, item] of itemsInGroup) {
    undoManager.markForUndo(itemName);
    item.part_group_name = targetGroup;
    item._layerName = targetGroup || null;
    const fileName = item._fileName;
    if (fileName) {
      const itemSaveData: ItemSaveData = { ...item };
      delete (itemSaveData as Record<string, unknown>)._type;
      delete (itemSaveData as Record<string, unknown>)._fileName;
      delete (itemSaveData as Record<string, unknown>)._layer;
      if (!targetGroup) {
        delete itemSaveData.part_group_name;
      }
      const wrapper: Record<string, ItemSaveData> = {};
      wrapper[item._type!] = itemSaveData;
      await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(wrapper, null, 2));
      const baseFileName = fileName.split('/').pop();
      const giEntry = state.gameitems.find((gi: GameItemEntry) => gi.file_name === baseFileName);
      if (giEntry) {
        giEntry.editor_layer_name = targetGroup || '';
      }
    }
  }

  undoManager.markForDelete(groupName);
  const fileName = group._fileName;
  if (fileName) {
    await window.vpxEditor.deleteFile(`${state.extractedDir}/${fileName}`);
    const baseFileName = fileName.split('/').pop();
    state.gameitems = state.gameitems.filter((gi: GameItemEntry) => gi.file_name !== baseFileName);
  }
  deletePartGroup(groupName);
  deleteItem(groupName);
}
