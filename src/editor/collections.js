import { state } from './state.js';
import { withUndo } from '../shared/undo-helpers.js';
import { updateCollectionsList } from './layers-panel.js';

export async function saveCollections(selectCollection = null) {
  const content = JSON.stringify(state.collections, null, 2);
  await window.vpxEditor.writeFile(`${state.extractedDir}/collections.json`, content);
  window.vpxEditor.notifyCollectionsChanged(state.collections, selectCollection);
}

export function getCollectionsForItem(itemName) {
  return state.collections.filter(c => c.items.includes(itemName));
}

export function getCollectionNameForItem(itemName) {
  for (const collection of state.collections) {
    if (collection.items.includes(itemName)) {
      return collection.name;
    }
  }
  return null;
}

export function getGroupedCollectionForItem(itemName) {
  return state.collections.find(c => c.group_elements && c.items.includes(itemName));
}

export function isItemInCollection(itemName, collectionName) {
  const collection = state.collections.find(c => c.name === collectionName);
  return collection ? collection.items.includes(itemName) : false;
}

export async function addItemToCollection(itemName, collectionName, skipUndo = false) {
  const collection = state.collections.find(c => c.name === collectionName);
  if (!collection) return false;
  if (collection.items.includes(itemName)) return false;

  return withUndo(
    `Add ${itemName} to ${collectionName}`,
    async () => {
      collection.items.push(itemName);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { skipUndo, markCollections: true }
  );
}

export async function removeItemFromCollection(itemName, collectionName, skipUndo = false) {
  const collection = state.collections.find(c => c.name === collectionName);
  if (!collection) return false;

  const index = collection.items.indexOf(itemName);
  if (index === -1) return false;

  return withUndo(
    `Remove ${itemName} from ${collectionName}`,
    async () => {
      collection.items.splice(index, 1);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { skipUndo, markCollections: true }
  );
}

export async function toggleItemInCollection(itemName, collectionName) {
  if (isItemInCollection(itemName, collectionName)) {
    return removeItemFromCollection(itemName, collectionName);
  } else {
    return addItemToCollection(itemName, collectionName);
  }
}

function generateUniqueName(baseName) {
  const existingNames = state.collections.map(c => c.name);
  if (!existingNames.includes(baseName)) return baseName;

  let counter = 1;
  while (existingNames.includes(`${baseName}${counter}`)) {
    counter++;
  }
  return `${baseName}${counter}`;
}

export async function createCollection(name = 'Collection', items = [], selectAfterCreate = false) {
  const uniqueName = generateUniqueName(name);
  const newCollection = {
    name: uniqueName,
    items: [...items],
    fire_events: false,
    stop_single_events: false,
    group_elements: true,
  };

  return withUndo(
    `Create collection ${name}`,
    async () => {
      state.collections.push(newCollection);
      await saveCollections(selectAfterCreate ? uniqueName : null);
      updateCollectionsList();
      return newCollection;
    },
    { markCollections: true }
  );
}

export async function createCollectionFromSelection(selectedItems) {
  const scriptableItems = selectedItems.filter(name => {
    const item = state.items[name];
    return item && item._type !== 'Decal';
  });

  if (scriptableItems.length === 0) {
    return null;
  }

  return createCollection('Collection', scriptableItems, true);
}

export async function deleteCollection(collectionName) {
  const index = state.collections.findIndex(c => c.name === collectionName);
  if (index === -1) return false;

  return withUndo(
    `Delete collection ${collectionName}`,
    async () => {
      state.collections.splice(index, 1);

      if (state.selectedCollection === collectionName) {
        state.selectedCollection = null;
      }

      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function renameCollection(oldName, newName) {
  if (oldName === newName) return true;

  const collection = state.collections.find(c => c.name === oldName);
  if (!collection) return false;

  const existingNames = state.collections.map(c => c.name);
  if (existingNames.includes(newName)) return false;

  return withUndo(
    `Rename collection ${oldName} to ${newName}`,
    async () => {
      collection.name = newName;

      if (state.selectedCollection === oldName) {
        state.selectedCollection = newName;
      }

      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function reorderCollection(collectionName, fromIndex, toIndex) {
  const collection = state.collections.find(c => c.name === collectionName);
  if (!collection) return false;
  if (fromIndex < 0 || fromIndex >= collection.items.length) return false;
  if (toIndex < 0 || toIndex >= collection.items.length) return false;

  return withUndo(
    `Reorder items in ${collectionName}`,
    async () => {
      const [item] = collection.items.splice(fromIndex, 1);
      collection.items.splice(toIndex, 0, item);
      await saveCollections();
      return true;
    },
    { markCollections: true }
  );
}

export async function moveCollectionUp(collectionName) {
  const index = state.collections.findIndex(c => c.name === collectionName);
  if (index <= 0) return false;

  return withUndo(
    `Move collection ${collectionName} up`,
    async () => {
      const [collection] = state.collections.splice(index, 1);
      state.collections.splice(index - 1, 0, collection);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function moveCollectionDown(collectionName) {
  const index = state.collections.findIndex(c => c.name === collectionName);
  if (index === -1 || index >= state.collections.length - 1) return false;

  return withUndo(
    `Move collection ${collectionName} down`,
    async () => {
      const [collection] = state.collections.splice(index, 1);
      state.collections.splice(index + 1, 0, collection);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function updateCollectionProperties(collectionName, properties) {
  const collection = state.collections.find(c => c.name === collectionName);
  if (!collection) return false;

  return withUndo(
    `Update collection ${collectionName} properties`,
    async () => {
      if (properties.fire_events !== undefined) {
        collection.fire_events = properties.fire_events;
      }
      if (properties.stop_single_events !== undefined) {
        collection.stop_single_events = properties.stop_single_events;
      }
      if (properties.group_elements !== undefined) {
        collection.group_elements = properties.group_elements;
      }
      await saveCollections();
      return true;
    },
    { markCollections: true }
  );
}

export async function setCollectionItems(collectionName, items) {
  const collection = state.collections.find(c => c.name === collectionName);
  if (!collection) return false;

  return withUndo(
    `Update collection ${collectionName} items`,
    async () => {
      collection.items = [...items];
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export function removeItemFromAllCollections(itemName) {
  let modified = false;
  for (const collection of state.collections) {
    const index = collection.items.indexOf(itemName);
    if (index !== -1) {
      collection.items.splice(index, 1);
      modified = true;
    }
  }
  return modified;
}

export function renameItemInAllCollections(oldName, newName) {
  let modified = false;
  for (const collection of state.collections) {
    const index = collection.items.indexOf(oldName);
    if (index !== -1) {
      collection.items[index] = newName;
      modified = true;
    }
  }
  return modified;
}
