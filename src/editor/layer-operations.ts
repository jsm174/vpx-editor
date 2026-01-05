import { state, elements, undoManager, GameItem, PartGroup, GameItemEntry } from './state.js';
import { findItemsAtPoint, getItemNameFromFileName } from './utils.js';
import { getFileNameFromItemName } from '../shared/gameitem-utils.js';
import { saveItemToFile, updateGameitemsJson } from './table-loader.js';
import { updateItemsList } from './items-panel.js';
import { updateLayersList, getSelectedPartGroup } from './layers-panel.js';
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

interface PromptOptions {
  title: string;
  placeholder: string;
  defaultValue: string;
  currentValue: string;
  existingNames: string[];
  maxLength: number;
  emptyError: string;
  existsError: string;
}

interface RenameResult {
  success: boolean;
  error?: string;
}

export function toggleItemLock(itemName: string): void {
  const item = state.items[itemName] as GameItem | undefined;
  if (!item) return;

  const itemsToToggle = state.selectedItems.includes(itemName) ? state.selectedItems : [itemName];
  const newLockState = !item.is_locked;
  const action = newLockState ? 'Lock' : 'Unlock';

  undoManager.beginUndo(`${action}`);

  for (const name of itemsToToggle) {
    const targetItem = state.items[name] as GameItem | undefined;
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
  const item = state.items[itemName] as GameItem | undefined;
  if (!item || item.is_locked) return;
  showRenameModal(itemName);
}

export async function assignItemToGroup(itemName: string, groupName: string | null): Promise<void> {
  const item = state.items[itemName] as GameItem | undefined;
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

export async function assignItemToSelectedLayer(itemName: string): Promise<void> {
  const selectedGroup = getSelectedPartGroup();
  if (!selectedGroup || selectedGroup === '_root') {
    elements.statusBar!.textContent = 'No layer selected';
    return;
  }
  await assignItemToGroup(itemName, selectedGroup);
}

export async function drawItemInFront(itemName: string): Promise<void> {
  const item = state.items[itemName] as GameItem | undefined;
  if (!item) return;

  undoManager.beginUndo('Draw In Front');
  undoManager.markGameitemsListForUndo();

  const idx = state.gameitems.findIndex((gi: GameItemEntry) => getItemNameFromFileName(gi.file_name) === itemName);
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
  const item = state.items[itemName] as GameItem | undefined;
  if (!item) return;

  undoManager.beginUndo('Draw In Back');
  undoManager.markGameitemsListForUndo();

  const idx = state.gameitems.findIndex((gi: GameItemEntry) => getItemNameFromFileName(gi.file_name) === itemName);
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
  const idx = state.gameitems.findIndex((gi: GameItemEntry) => getItemNameFromFileName(gi.file_name) === name);
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
      const item = state.items[name] as GameItem | undefined;
      if (item) return { name, drawingIndex: getDrawingOrderIndex(name), ...item } as DrawingOrderItem;
      return null;
    })
    .filter((item): item is DrawingOrderItem => item !== null)
    .sort((a, b) => b.drawingIndex - a.drawingIndex);
}

export async function showRenamePartGroupModal(groupName: string): Promise<void> {
  const group = state.partGroups[groupName] as PartGroup | undefined;
  if (!group) return;

  const existingNames = Object.keys(state.items);

  const result: string | null = await window.vpxEditor.showPrompt({
    title: 'Rename Object',
    placeholder: 'Enter new name',
    defaultValue: groupName,
    currentValue: groupName,
    existingNames,
    maxLength: 32,
    emptyError: 'Name cannot be empty',
    existsError: 'Name already exists',
  } as PromptOptions);

  if (result && result !== groupName) {
    await renamePartGroup(groupName, result);
  }
}

export async function renamePartGroup(oldName: string, newName: string): Promise<void> {
  const group = state.partGroups[oldName] as PartGroup | undefined;
  if (!group) return;

  undoManager.beginUndo(`Rename group ${oldName}`);

  const oldFileName = group._fileName as string;
  const newFileName = `gameitems/${getFileNameFromItemName('PartGroup', newName)}`;

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

  delete state.partGroups[oldName];
  delete state.items[oldName];
  state.partGroups[newName] = group as import('./state.js').PartGroup;
  state.items[newName] = group as import('./state.js').GameItem;

  for (const [itemName, item] of Object.entries(state.items) as [string, GameItem][]) {
    if (item.part_group_name === oldName) {
      item.part_group_name = newName;
      await saveItemToFile(itemName);
    }
  }

  const giIndex = state.gameitems.findIndex((gi: GameItemEntry) => getItemNameFromFileName(gi.file_name) === oldName);
  if (giIndex >= 0) {
    state.gameitems[giIndex].file_name = getFileNameFromItemName('PartGroup', newName);
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

export async function showDeletePartGroupModal(groupName: string): Promise<void> {
  const group = state.partGroups[groupName] as PartGroup | undefined;
  if (!group) return;

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
  const group = state.partGroups[groupName] as PartGroup | undefined;
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
  }
  delete state.partGroups[groupName];
  delete state.items[groupName];
  const baseFileName = fileName ? fileName.split('/').pop() : getFileNameFromItemName('PartGroup', groupName);
  state.gameitems = state.gameitems.filter((gi: GameItemEntry) => gi.file_name !== baseFileName);
}
