import { state, Collection, getItem } from './state.js';
import { withUndo } from '../shared/undo-helpers.js';
import { updateCollectionsList } from './layers-panel.js';
import { nameEquals, includesName, findIndexByName, findByName } from '../shared/gameitem-utils.js';
import '../types/ipc.js';

interface CollectionProperties {
  fire_events?: boolean;
  stop_single_events?: boolean;
  group_elements?: boolean;
}

export async function saveCollections(selectCollection: string | null = null): Promise<void> {
  const content = JSON.stringify(state.collections, null, 2);
  await window.vpxEditor.writeFile(`${state.extractedDir}/collections.json`, content);
  window.vpxEditor.notifyCollectionsChanged(state.collections, selectCollection);
}

export function getCollectionsForItem(itemName: string): Collection[] {
  return state.collections.filter(c => c.items && includesName(c.items, itemName));
}

export function getCollectionNameForItem(itemName: string): string | null {
  for (const collection of state.collections) {
    if (collection.items && includesName(collection.items, itemName)) {
      return collection.name;
    }
  }
  return null;
}

export function getGroupedCollectionForItem(itemName: string): Collection | undefined {
  return state.collections.find(c => c.group_elements && c.items && includesName(c.items, itemName));
}

export function isItemInCollection(itemName: string, collectionName: string): boolean {
  const collection = findByName(state.collections, collectionName);
  return collection ? (collection.items ? includesName(collection.items, itemName) : false) : false;
}

export async function addItemToCollection(
  itemName: string,
  collectionName: string,
  skipUndo: boolean = false
): Promise<boolean> {
  const collection = findByName(state.collections, collectionName);
  if (!collection) return false;
  if (!collection.items) collection.items = [];
  if (includesName(collection.items, itemName)) return false;

  return withUndo(
    `${getItem(itemName)?._type || 'Item'} added to ${collectionName}`,
    async (): Promise<boolean> => {
      collection.items!.push(itemName);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { skipUndo, markCollections: true }
  );
}

export async function removeItemFromCollection(
  itemName: string,
  collectionName: string,
  skipUndo: boolean = false
): Promise<boolean> {
  const collection = findByName(state.collections, collectionName);
  if (!collection || !collection.items) return false;

  const index = findIndexByName(collection.items, itemName);
  if (index === -1) return false;

  return withUndo(
    `${getItem(itemName)?._type || 'Item'} removed from ${collectionName}`,
    async (): Promise<boolean> => {
      collection.items!.splice(index, 1);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { skipUndo, markCollections: true }
  );
}

export async function toggleItemInCollection(itemName: string, collectionName: string): Promise<boolean> {
  if (isItemInCollection(itemName, collectionName)) {
    return removeItemFromCollection(itemName, collectionName);
  } else {
    return addItemToCollection(itemName, collectionName);
  }
}

function generateUniqueName(baseName: string): string {
  const existingNames = state.collections.map(c => c.name);
  if (!includesName(existingNames, baseName)) return baseName;

  let counter = 1;
  while (includesName(existingNames, `${baseName}${counter}`)) {
    counter++;
  }
  return `${baseName}${counter}`;
}

export async function createCollection(
  name: string = 'Collection',
  items: string[] = [],
  selectAfterCreate: boolean = false
): Promise<Collection | null> {
  const uniqueName = generateUniqueName(name);
  const newCollection: Collection = {
    name: uniqueName,
    items: [...items],
    fire_events: false,
    stop_single_events: false,
    group_elements: true,
  };

  return withUndo(
    `Collection ${name} created`,
    async (): Promise<Collection> => {
      state.collections.push(newCollection);
      await saveCollections(selectAfterCreate ? uniqueName : null);
      updateCollectionsList();
      return newCollection;
    },
    { markCollections: true }
  );
}

export async function createCollectionFromSelection(selectedItems: string[]): Promise<Collection | null> {
  const scriptableItems = selectedItems.filter(name => {
    const item = state.items[name.toLowerCase()];
    return item && item._type !== 'Decal';
  });

  if (scriptableItems.length === 0) {
    return null;
  }

  return createCollection('Collection', scriptableItems, true);
}

export async function deleteCollection(collectionName: string): Promise<boolean> {
  const index = state.collections.findIndex(c => nameEquals(c.name, collectionName));
  if (index === -1) return false;

  return withUndo(
    `Collection ${collectionName} deleted`,
    async (): Promise<boolean> => {
      state.collections.splice(index, 1);

      if (state.selectedCollection && nameEquals(state.selectedCollection, collectionName)) {
        state.selectedCollection = null;
      }

      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function deleteCollectionWithConfirm(collectionName: string): Promise<boolean> {
  const confirmed = confirm(`Delete collection "${collectionName}"?`);
  if (!confirmed) return false;
  return deleteCollection(collectionName);
}

export async function renameCollection(oldName: string, newName: string): Promise<boolean> {
  if (nameEquals(oldName, newName)) return true;

  const collection = findByName(state.collections, oldName);
  if (!collection) return false;

  const existingNames = state.collections.map(c => c.name);
  if (includesName(existingNames, newName)) return false;

  return withUndo(
    'Collection renamed',
    async (): Promise<boolean> => {
      collection.name = newName;

      if (state.selectedCollection && nameEquals(state.selectedCollection, oldName)) {
        state.selectedCollection = newName;
      }

      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function reorderCollection(collectionName: string, fromIndex: number, toIndex: number): Promise<boolean> {
  const collection = findByName(state.collections, collectionName);
  if (!collection || !collection.items) return false;
  if (fromIndex < 0 || fromIndex >= collection.items.length) return false;
  if (toIndex < 0 || toIndex >= collection.items.length) return false;

  return withUndo(
    `Items reordered in ${collectionName}`,
    async (): Promise<boolean> => {
      const [item] = collection.items!.splice(fromIndex, 1);
      collection.items!.splice(toIndex, 0, item);
      await saveCollections();
      return true;
    },
    { markCollections: true }
  );
}

export async function moveCollectionUp(collectionName: string): Promise<boolean> {
  const index = state.collections.findIndex(c => nameEquals(c.name, collectionName));
  if (index <= 0) return false;

  return withUndo(
    `Collection ${collectionName} moved up`,
    async (): Promise<boolean> => {
      const [collection] = state.collections.splice(index, 1);
      state.collections.splice(index - 1, 0, collection);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function moveCollectionDown(collectionName: string): Promise<boolean> {
  const index = state.collections.findIndex(c => nameEquals(c.name, collectionName));
  if (index === -1 || index >= state.collections.length - 1) return false;

  return withUndo(
    `Collection ${collectionName} moved down`,
    async (): Promise<boolean> => {
      const [collection] = state.collections.splice(index, 1);
      state.collections.splice(index + 1, 0, collection);
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export async function updateCollectionProperties(
  collectionName: string,
  properties: CollectionProperties
): Promise<boolean> {
  const collection = findByName(state.collections, collectionName);
  if (!collection) return false;

  return withUndo(
    `Collection ${collectionName} properties updated`,
    async (): Promise<boolean> => {
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

export async function setCollectionItems(collectionName: string, items: string[]): Promise<boolean> {
  const collection = findByName(state.collections, collectionName);
  if (!collection) return false;

  return withUndo(
    `Collection ${collectionName} items updated`,
    async (): Promise<boolean> => {
      collection.items = [...items];
      await saveCollections();
      updateCollectionsList();
      return true;
    },
    { markCollections: true }
  );
}

export function removeItemFromAllCollections(itemName: string): boolean {
  let modified = false;
  for (const collection of state.collections) {
    if (!collection.items) continue;
    const index = findIndexByName(collection.items, itemName);
    if (index !== -1) {
      collection.items.splice(index, 1);
      modified = true;
    }
  }
  return modified;
}

export function renameItemInAllCollections(oldName: string, newName: string): boolean {
  let modified = false;
  for (const collection of state.collections) {
    if (!collection.items) continue;
    const index = findIndexByName(collection.items, oldName);
    if (index !== -1) {
      collection.items[index] = newName;
      modified = true;
    }
  }
  return modified;
}
