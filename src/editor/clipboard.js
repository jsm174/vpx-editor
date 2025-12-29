import { state } from './state.js';
import { generateUniqueName, saveNewObject, deleteObject } from './object-factory.js';
import { getItemCenter, setItemPosition } from '../shared/position-utils.js';
import { withUndo } from '../shared/undo-helpers.js';

export async function copyItem(itemName) {
  const itemNames = state.selectedItems.length > 0 ? state.selectedItems : [itemName];
  const items = [];

  for (const name of itemNames) {
    const item = state.items[name];
    if (!item) continue;

    const data = {};
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_') && key !== 'is_locked') {
        data[key] = structuredClone(value);
      }
    }

    let meshData = null;
    if (item._type === 'Primitive') {
      const meshPath = `${state.extractedDir}/gameitems/Primitive.${name}.obj`;
      const meshResult = await window.vpxEditor.readFile(meshPath);
      if (meshResult.success) {
        meshData = meshResult.content;
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

export async function cutItem(itemName) {
  const itemNames = state.selectedItems.length > 0 ? [...state.selectedItems] : [itemName];
  if (!(await copyItem(itemName))) return false;

  const count = itemNames.length;
  return withUndo(count > 1 ? `Cut ${count} items` : `Cut ${itemNames[0]}`, async () => {
    for (const name of itemNames) {
      await deleteObject(name, true);
    }
    return true;
  });
}

export async function pasteItem(atOriginalLocation = false) {
  const clipboardData = await window.vpxEditor.getClipboardData();
  if (!clipboardData) return null;

  if (clipboardData.items) {
    let groupCenterX = 0,
      groupCenterY = 0;

    for (const item of clipboardData.items) {
      groupCenterX += item.originalCenter.x;
      groupCenterY += item.originalCenter.y;
    }
    groupCenterX /= clipboardData.items.length;
    groupCenterY /= clipboardData.items.length;

    const count = clipboardData.items.length;
    return withUndo(count > 1 ? `Paste ${count} items` : 'Paste', async () => {
      const newNames = [];

      for (const itemData of clipboardData.items) {
        const { type, data, originalCenter, meshData } = itemData;
        const newName = generateUniqueName(type);

        const newItem = structuredClone(data);
        newItem.name = newName;

        if (!atOriginalLocation) {
          const offsetX = originalCenter.x - groupCenterX;
          const offsetY = originalCenter.y - groupCenterY;
          const targetX = state.lastMousePosition.x + offsetX;
          const targetY = state.lastMousePosition.y + offsetY;
          setItemPosition(newItem, targetX, targetY, originalCenter, type);
        }

        newItem._type = type;
        newItem._fileName = `gameitems/${type}.${newName}.json`;
        newItem._layer = 0;
        newItem.is_locked = false;

        const success = await saveNewObject(newItem, true);
        if (success) {
          if (type === 'Primitive' && meshData) {
            const meshPath = `${state.extractedDir}/gameitems/Primitive.${newName}.obj`;
            await window.vpxEditor.writeFile(meshPath, meshData);
          }
          newNames.push(newName);
        }
      }

      return newNames.length > 0 ? newNames : null;
    });
  }

  const { type, data, originalCenter, meshData } = clipboardData;
  const newName = generateUniqueName(type);

  const newItem = structuredClone(data);
  newItem.name = newName;

  if (!atOriginalLocation) {
    setItemPosition(newItem, state.lastMousePosition.x, state.lastMousePosition.y, originalCenter, type);
  }

  newItem._type = type;
  newItem._fileName = `gameitems/${type}.${newName}.json`;
  newItem._layer = 0;
  newItem.is_locked = false;

  const success = await saveNewObject(newItem);
  if (success) {
    if (type === 'Primitive' && meshData) {
      const meshPath = `${state.extractedDir}/gameitems/Primitive.${newName}.obj`;
      await window.vpxEditor.writeFile(meshPath, meshData);
    }
    return [newName];
  }
  return null;
}

export async function hasClipboard() {
  return await window.vpxEditor.hasClipboardData();
}

export async function clearClipboard() {
  await window.vpxEditor.setClipboardData(null);
}

export async function updateClipboardMenuState() {
  const hasSelection = state.selectedItems.length > 0;
  const clipboardHasData = await hasClipboard();

  let allLocked = true;
  for (const name of state.selectedItems) {
    const item = state.items[name];
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
