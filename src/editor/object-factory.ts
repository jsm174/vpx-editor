import { state, undoManager, getItem, setItem, deleteItem, hasItem } from './state.js';
import { GameItem, GameItemEntry, Point, DragPoint } from './state.js';
import { objectTypes, getObjectDefaults, hasObjectDragPoints } from './object-types.js';
import { generateUniqueFileName } from '../shared/gameitem-utils.js';

interface BackglassPropertyMap {
  [key: string]: string;
}

interface NamePrefixMap {
  [key: string]: string;
}

interface ObjectTypeConfig {
  createDragPoints?: (position: Point, defaults: GameItem) => DragPoint[];
  hasDragPoints?: boolean;
  defaults?: GameItem;
}

const BACKGLASS_PROPERTY: BackglassPropertyMap = {
  Light: 'is_backglass',
  Decal: 'backglass',
  Flasher: 'backglass',
  Timer: 'backglass',
  LightSequencer: 'backglass',
  PartGroup: 'backglass',
};

const NAME_PREFIX: NamePrefixMap = {
  HitTarget: 'Target',
};

export function generateUniqueName(baseName: string): string {
  let counter = 1;
  let name: string;
  do {
    const suffix = counter < 10 ? `00${counter}` : counter < 100 ? `0${counter}` : `${counter}`;
    name = `${baseName}${suffix}`;
    counter++;
  } while (hasItem(name) && counter < 1000);
  return name;
}

export function createObject(type: string, position: Point): GameItem | null {
  const defaults = getObjectDefaults(type);
  if (!defaults) {
    console.error(`Unknown object type: ${type}`);
    return null;
  }

  const namePrefix = NAME_PREFIX[type] || type;
  const name = generateUniqueName(namePrefix);
  const obj = { ...defaults, name } as unknown as GameItem;

  if (obj.center) {
    obj.center.x = position.x;
    obj.center.y = position.y;
  } else if (obj.pos) {
    obj.pos.x = position.x;
    obj.pos.y = position.y;
  } else if (obj.pos_x !== undefined && obj.pos_y !== undefined) {
    obj.pos_x = position.x;
    obj.pos_y = position.y;
  } else if (obj.position) {
    obj.position.x = position.x;
    obj.position.y = position.y;
  } else if (obj.ver1 && obj.ver2) {
    const width = obj.ver2.x - obj.ver1.x;
    const height = obj.ver2.y - obj.ver1.y;
    obj.ver1.x = position.x - width / 2;
    obj.ver1.y = position.y - height / 2;
    obj.ver2.x = position.x + width / 2;
    obj.ver2.y = position.y + height / 2;
  }

  const typeConfig = (objectTypes as unknown as Record<string, ObjectTypeConfig>)[type];
  if (typeConfig?.createDragPoints) {
    obj.drag_points = typeConfig.createDragPoints(position, defaults as unknown as GameItem);
  } else if (hasObjectDragPoints(type) && obj.drag_points) {
    for (const pt of obj.drag_points) {
      if (pt.x !== undefined) pt.x += position.x;
      if (pt.y !== undefined) pt.y += position.y;
    }
  }

  if (obj.drag_points) {
    for (const pt of obj.drag_points) {
      if (pt.is_locked === undefined) pt.is_locked = false;
      if (pt.editor_layer === undefined) pt.editor_layer = 0;
      if (pt.editor_layer_name === undefined) pt.editor_layer_name = '';
      if (pt.editor_layer_visibility === undefined) pt.editor_layer_visibility = true;
    }
  }

  obj._type = type;
  const existingFileNames = state.gameitems.map(gi => gi.file_name);
  obj._fileName = `gameitems/${generateUniqueFileName(type, name, existingFileNames)}`;
  obj._layer = 0;
  obj.is_locked = false;

  if (state.backglassView && BACKGLASS_PROPERTY[type]) {
    obj[BACKGLASS_PROPERTY[type]] = true;
  }

  return obj;
}

async function saveNewObjectInternal(obj: GameItem): Promise<boolean> {
  const vpxEditor = window.vpxEditor;
  const type = obj._type;
  const saveData: Record<string, Record<string, unknown>> = { [type]: {} };

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    saveData[type][key] = value;
  }

  const filePath = `${state.extractedDir}/${obj._fileName}`;
  const result = await vpxEditor.writeFile(filePath, JSON.stringify(saveData, null, 2));

  if (!result.success) {
    console.error(`Failed to save object: ${result.error}`);
    return false;
  }

  const gameitemsPath = `${state.extractedDir}/gameitems.json`;
  const gameitemsResult = await vpxEditor.readFile(gameitemsPath);

  const baseFileName = obj._fileName!.replace('gameitems/', '');
  if (gameitemsResult.success) {
    try {
      const gameitems: GameItemEntry[] = JSON.parse(gameitemsResult.content!);
      gameitems.push({
        file_name: baseFileName,
        is_locked: false,
        editor_layer: obj._layer || 0,
      });
      await vpxEditor.writeFile(gameitemsPath, JSON.stringify(gameitems, null, 2));
      state.gameitems = gameitems;
    } catch (parseError) {
      console.error('Failed to parse gameitems.json:', parseError);
      console.error('Using in-memory gameitems instead');
      state.gameitems.push({
        file_name: baseFileName,
        is_locked: false,
        editor_layer: obj._layer || 0,
      });
      await vpxEditor.writeFile(gameitemsPath, JSON.stringify(state.gameitems, null, 2));
    }
  }

  setItem(obj.name as string, obj, baseFileName);
  return true;
}

export async function saveNewObject(obj: GameItem, skipUndo: boolean = false): Promise<boolean> {
  if (skipUndo) {
    undoManager.markForCreate(obj.name as string);
    return saveNewObjectInternal(obj);
  }
  undoManager.beginUndo(`Create ${obj._type}`);
  undoManager.markForCreate(obj.name as string);
  const success = await saveNewObjectInternal(obj);
  if (!success) {
    undoManager.cancelUndo();
    return false;
  }
  undoManager.endUndo();
  return true;
}

async function deleteObjectInternal(name: string): Promise<boolean> {
  const vpxEditor = window.vpxEditor;
  const item = getItem(name);
  if (!item || !item._fileName) return false;

  const filePath = `${state.extractedDir}/${item._fileName}`;
  const baseFileName = item._fileName.replace('gameitems/', '');
  const gameitemsPath = `${state.extractedDir}/gameitems.json`;

  await vpxEditor.deleteFile(filePath);

  const gameitemsResult = await vpxEditor.readFile(gameitemsPath);

  if (gameitemsResult.success) {
    try {
      const gameitems: GameItemEntry[] = JSON.parse(gameitemsResult.content!);
      const index = gameitems.findIndex((i: GameItemEntry) => i.file_name === baseFileName);
      if (index >= 0) {
        gameitems.splice(index, 1);
        await vpxEditor.writeFile(gameitemsPath, JSON.stringify(gameitems, null, 2));
        state.gameitems = gameitems;
      }
    } catch (parseError) {
      console.error('Failed to parse gameitems.json:', parseError);
      const index = state.gameitems.findIndex((i: GameItemEntry) => i.file_name === baseFileName);
      if (index >= 0) {
        state.gameitems.splice(index, 1);
        await vpxEditor.writeFile(gameitemsPath, JSON.stringify(state.gameitems, null, 2));
      }
    }
  }

  deleteItem(name);
  return true;
}

export async function deleteObject(name: string, skipUndo: boolean = false): Promise<boolean> {
  const item = getItem(name);
  if (!item) return false;

  if (skipUndo) {
    undoManager.markForDelete(name);
    return deleteObjectInternal(name);
  }

  undoManager.beginUndo(`Delete ${name}`);
  undoManager.markForDelete(name);
  const success = await deleteObjectInternal(name);
  undoManager.endUndo();
  return success;
}
