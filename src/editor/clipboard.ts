import { state, GameItem, getItem } from './state.js';
import { generateUniqueName, saveNewObject, deleteObject } from './object-factory.js';
import { getItemCenter, setItemPosition } from '../shared/position-utils.js';
import { withUndo } from '../shared/undo-helpers.js';
import { generateUniqueFileName } from '../shared/gameitem-utils.js';
import type { ClipboardItem } from '../types/data.js';
import '../types/ipc.js';

export async function copyItem(itemName: string): Promise<boolean> {
  const itemNames = state.selectedItems.length > 0 ? state.selectedItems : [itemName];
  const items: ClipboardItem[] = [];

  for (const name of itemNames) {
    const item = getItem(name);
    if (!item) continue;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_') && key !== 'is_locked') {
        data[key] = structuredClone(value);
      }
    }

    let meshData: string | null = null;
    if (item._type === 'Primitive' && item._fileName) {
      try {
        const meshPath = `${state.extractedDir}/${item._fileName.replace('.json', '.obj')}`;
        const result = await window.vpxEditor.readFile(meshPath);
        meshData = result.success ? result.content || null : null;
      } catch {
        meshData = null;
      }
    }

    items.push({
      type: item._type,
      data: data,
      originalCenter: getItemCenter(item) || { x: 0, y: 0 },
      meshData: meshData,
    });
  }

  if (items.length === 0) return false;

  await window.vpxEditor.setClipboardData({ items });
  return true;
}

export async function cutItem(itemName: string): Promise<boolean> {
  const itemNames = state.selectedItems.length > 0 ? [...state.selectedItems] : [itemName];
  if (!(await copyItem(itemName))) return false;

  const count = itemNames.length;
  const cutLabel = count > 1 ? `${count} items cut` : `${getItem(itemNames[0])?._type || 'Item'} cut`;
  return withUndo(cutLabel, async (): Promise<boolean> => {
    for (const name of itemNames) {
      await deleteObject(name, true);
    }
    return true;
  });
}

export async function pasteItem(atOriginalLocation: boolean = false): Promise<string[] | null> {
  const clipboardData = await window.vpxEditor.getClipboardData();
  if (!clipboardData) return null;

  if (clipboardData.items && clipboardData.items.length > 0) {
    let groupCenterX = 0,
      groupCenterY = 0;

    for (const item of clipboardData.items) {
      groupCenterX += item.originalCenter.x;
      groupCenterY += item.originalCenter.y;
    }
    groupCenterX /= clipboardData.items.length;
    groupCenterY /= clipboardData.items.length;

    const count = clipboardData.items.length;
    const pasteLabel = count > 1 ? `${count} items pasted` : `${clipboardData.items[0].type || 'Item'} pasted`;
    return withUndo(pasteLabel, async (): Promise<string[] | null> => {
      const newNames: string[] = [];

      for (const itemData of clipboardData.items) {
        const { type, data, originalCenter, meshData } = itemData;
        const newName = generateUniqueName(type);

        const newItem = structuredClone(data) as GameItem;
        newItem.name = newName;

        if (!atOriginalLocation) {
          const offsetX = originalCenter.x - groupCenterX;
          const offsetY = originalCenter.y - groupCenterY;
          const targetX = state.lastMousePosition.x + offsetX;
          const targetY = state.lastMousePosition.y + offsetY;
          setItemPosition(newItem, targetX, targetY, originalCenter, type);
        }

        newItem._type = type;
        const existingFileNames = state.gameitems.map(gi => gi.file_name);
        const uniqueFileName = generateUniqueFileName(type, newName, existingFileNames);
        newItem._fileName = `gameitems/${uniqueFileName}`;
        newItem._layer = 0;
        newItem.is_locked = false;

        const success = await saveNewObject(newItem, true);
        if (success) {
          if (type === 'Primitive' && meshData) {
            const meshPath = `${state.extractedDir}/gameitems/${uniqueFileName.replace('.json', '.obj')}`;
            await window.vpxEditor.writeFile(meshPath, meshData);
          }
          newNames.push(newName);
        }
      }

      return newNames.length > 0 ? newNames : null;
    });
  }

  return null;
}

export async function hasClipboard(): Promise<boolean> {
  return await window.vpxEditor.hasClipboardData();
}

export async function clearClipboard(): Promise<void> {
  await window.vpxEditor.setClipboardData({ items: [] });
}

export async function updateClipboardMenuState(): Promise<void> {
  const hasSelection = state.selectedItems.length > 0;
  const clipboardHasData = await hasClipboard();

  let allLocked = true;
  for (const name of state.selectedItems) {
    const item = getItem(name);
    if (item && !item.is_locked) {
      allLocked = false;
      break;
    }
  }
  const isLocked = hasSelection && allLocked;

  window.vpxEditor.updateClipboardState({
    hasSelection,
    hasClipboard: clipboardHasData,
    isLocked,
  });
}
