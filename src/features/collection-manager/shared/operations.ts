import type { FileContext } from '../../../shared/file-context';
import type { Collection } from '../../../types/data';
import { nameEquals, includesName, findIndexByName } from '../../../shared/gameitem-utils';
export type { Collection };

export interface CollectionUpdate {
  originalName: string;
  newName?: string;
  items: string[];
  fire_events: boolean;
  stop_single_events: boolean;
  group_elements: boolean;
}

async function readCollections(ctx: FileContext): Promise<Collection[]> {
  const path = `${ctx.extractedDir}/collections.json`;
  if (await ctx.exists(path)) {
    const content = await ctx.readFile(path);
    return JSON.parse(content);
  }
  return [];
}

async function writeCollections(ctx: FileContext, collections: Collection[]): Promise<void> {
  const path = `${ctx.extractedDir}/collections.json`;
  await ctx.writeFile(path, JSON.stringify(collections, null, 2));
}

export async function createCollection(ctx: FileContext, name: string): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  collections.push({
    name,
    items: [],
    fire_events: false,
    stop_single_events: false,
    group_elements: true,
  });

  await writeCollections(ctx, collections);
  return collections;
}

export async function deleteCollection(ctx: FileContext, name: string): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const index = collections.findIndex(c => nameEquals(c.name, name));
  if (index !== -1) {
    collections.splice(index, 1);
    await writeCollections(ctx, collections);
  }

  return collections;
}

export async function renameCollection(ctx: FileContext, oldName: string, newName: string): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const collection = collections.find(c => nameEquals(c.name, oldName));
  if (collection) {
    collection.name = newName;
    await writeCollections(ctx, collections);
  }

  return collections;
}

export async function moveCollectionUp(ctx: FileContext, name: string): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const index = collections.findIndex(c => nameEquals(c.name, name));
  if (index > 0) {
    const [collection] = collections.splice(index, 1);
    collections.splice(index - 1, 0, collection);
    await writeCollections(ctx, collections);
  }

  return collections;
}

export async function moveCollectionDown(ctx: FileContext, name: string): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const index = collections.findIndex(c => nameEquals(c.name, name));
  if (index !== -1 && index < collections.length - 1) {
    const [collection] = collections.splice(index, 1);
    collections.splice(index + 1, 0, collection);
    await writeCollections(ctx, collections);
  }

  return collections;
}

export async function reorderCollections(ctx: FileContext, names: string[]): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const collectionMap = new Map(collections.map(c => [c.name.toLowerCase(), c]));
  const reordered = names.map(name => collectionMap.get(name.toLowerCase())).filter((c): c is Collection => !!c);

  await writeCollections(ctx, reordered);
  return reordered;
}

export async function updateCollection(ctx: FileContext, update: CollectionUpdate): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const collection = collections.find(c => nameEquals(c.name, update.originalName));
  if (collection) {
    if (update.newName && !nameEquals(update.newName, update.originalName)) {
      collection.name = update.newName;
    }
    collection.items = update.items;
    collection.fire_events = update.fire_events;
    collection.stop_single_events = update.stop_single_events;
    collection.group_elements = update.group_elements;
    await writeCollections(ctx, collections);
  }

  return collections;
}

export async function addItemsToCollection(
  ctx: FileContext,
  collectionName: string,
  items: string[]
): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const collection = collections.find(c => nameEquals(c.name, collectionName));
  if (collection) {
    if (!collection.items) collection.items = [];
    for (const item of items) {
      if (!includesName(collection.items, item)) {
        collection.items.push(item);
      }
    }
    await writeCollections(ctx, collections);
  }

  return collections;
}

export async function removeItemFromCollection(
  ctx: FileContext,
  collectionName: string,
  itemName: string
): Promise<Collection[]> {
  const collections = await readCollections(ctx);

  const collection = collections.find(c => nameEquals(c.name, collectionName));
  if (collection?.items) {
    const index = findIndexByName(collection.items, itemName);
    if (index !== -1) {
      collection.items.splice(index, 1);
      await writeCollections(ctx, collections);
    }
  }

  return collections;
}

export async function getCollections(ctx: FileContext): Promise<Collection[]> {
  return readCollections(ctx);
}

export function collectionExists(collections: Collection[], name: string): boolean {
  return collections.some(c => nameEquals(c.name, name));
}

export function getCollectionByName(collections: Collection[], name: string): Collection | undefined {
  return collections.find(c => nameEquals(c.name, name));
}
