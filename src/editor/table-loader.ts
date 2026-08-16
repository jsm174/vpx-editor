import {
  state,
  elements,
  GameItem,
  GameItemEntry,
  Material,
  ImageData,
  SoundData,
  RenderProbe,
  Collection,
} from './state.js';
import { VIEW_MODE_2D } from '../shared/constants.js';
import { render, fitToView } from './canvas-renderer.js';
import { is3DInitialized, clearScene, stopAnimation, get3DRenderer, resetCamera } from './canvas-renderer-3d.js';
import { clearPrimitiveMeshCache } from './parts/primitive.js';
import { updateItemsList, selectItem } from './items-panel.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { updateLayersList, updateCollectionsList } from './layers-panel.js';
import { getItem, setItem, setPartGroup, getPartGroup, clearFileNameMap, hasItem } from './state.js';
import { nameEquals } from '../shared/gameitem-utils.js';
import { generateUniqueName } from './object-factory.js';
import { upgradeBackglassPrimitives } from './backglass-upgrade.js';
import { appendConsoleLine } from './console-panel.js';

interface MimeTypes {
  [key: string]: string;
}

export async function loadTable(): Promise<void> {
  if (is3DInitialized()) {
    clearScene();
  }
  clearPrimitiveMeshCache();
  state.backdropImage = null;
  state.viewMode = VIEW_MODE_2D;
  state.showMaterials = true;
  state.backglassView = false;
  (document.getElementById('tool-3d') as HTMLElement).classList.remove('active');
  const toggleGrid = document.getElementById('toggle-grid');
  const toggleBackdrop = document.getElementById('toggle-backdrop');
  if (toggleGrid) toggleGrid.style.display = '';
  if (toggleBackdrop) toggleBackdrop.style.display = '';
  (document.getElementById('toggle-backglass') as HTMLElement).classList.remove('active');
  (document.getElementById('toggle-wireframe') as HTMLElement).style.display = 'none';
  (document.getElementById('toggle-materials') as HTMLElement).style.display = 'none';
  if (is3DInitialized()) {
    stopAnimation();
    get3DRenderer().domElement.style.display = 'none';
  }
  (elements.canvas as HTMLElement).style.display = 'block';

  const gamedataResult = await window.vpxEditor.readFile(`${state.extractedDir}/gamedata.json`);
  if (!gamedataResult.success) {
    console.error('Failed to load gamedata.json:', gamedataResult.error);
    return;
  }
  state.gamedata = JSON.parse(gamedataResult.content!);

  if (is3DInitialized()) {
    resetCamera();
  }

  const infoResult = await window.vpxEditor.readFile(`${state.extractedDir}/info.json`);
  if (infoResult.success) {
    state.info = JSON.parse(infoResult.content!);
  } else {
    state.info = {};
  }

  const gameitemsResult = await window.vpxEditor.readFile(`${state.extractedDir}/gameitems.json`);
  if (!gameitemsResult.success) {
    console.error('Failed to load gameitems.json:', gameitemsResult.error);
    return;
  }
  state.gameitems = JSON.parse(gameitemsResult.content!) as GameItemEntry[];

  const collectionsResult = await window.vpxEditor.readFile(`${state.extractedDir}/collections.json`);
  if (collectionsResult.success) {
    state.collections = JSON.parse(collectionsResult.content!) as Collection[];
  } else {
    state.collections = [];
  }

  const materialsResult = await window.vpxEditor.readFile(`${state.extractedDir}/materials.json`);
  if (materialsResult.success) {
    const materialsArray = JSON.parse(materialsResult.content!) as Material[];
    state.materials = {};
    for (const material of materialsArray) {
      state.materials[material.name] = material;
    }
    state.materialNames = Object.keys(state.materials).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    console.log(`Loaded ${state.materialNames.length} materials`);
  } else {
    state.materials = {};
    state.materialNames = [];
  }

  const imagesResult = await window.vpxEditor.readFile(`${state.extractedDir}/images.json`);
  if (imagesResult.success) {
    const imagesArray = JSON.parse(imagesResult.content!) as ImageData[];
    state.images = {};
    for (const image of imagesArray) {
      state.images[image.name] = image;
    }
    state.imageNames = Object.keys(state.images).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    console.log(`Loaded ${state.imageNames.length} images`);
  } else {
    state.images = {};
    state.imageNames = [];
  }

  const soundsResult = await window.vpxEditor.readFile(`${state.extractedDir}/sounds.json`);
  if (soundsResult.success) {
    state.sounds = JSON.parse(soundsResult.content!) as SoundData[];
    state.soundNames = state.sounds
      .map((s: SoundData) => s.name)
      .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    console.log(`Loaded ${state.soundNames.length} sounds`);
  } else {
    state.sounds = [];
    state.soundNames = [];
  }

  const renderProbesResult = await window.vpxEditor.readFile(`${state.extractedDir}/renderprobes.json`);
  if (renderProbesResult.success) {
    const renderProbesArray = JSON.parse(renderProbesResult.content!) as RenderProbe[];
    state.renderProbes = {};
    for (const probe of renderProbesArray) {
      state.renderProbes[probe.name] = probe;
    }
    state.renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    console.log(`Loaded ${state.renderProbeNames.length} render probes`);
  } else {
    state.renderProbes = {};
    state.renderProbeNames = [];
  }

  state.textureCache.clear();

  state.items = {};
  state.partGroups = {};
  clearFileNameMap();
  const loadedEntries: { item: GameItem; itemInfo: GameItemEntry; type: string }[] = [];
  for (const itemInfo of state.gameitems) {
    const itemPath = `${state.extractedDir}/gameitems/${itemInfo.file_name}`;
    const itemResult = await window.vpxEditor.readFile(itemPath);
    if (itemResult.success) {
      const itemData = JSON.parse(itemResult.content!) as Record<string, GameItem>;
      const type = Object.keys(itemData)[0];
      const item = itemData[type];
      item._type = type;
      item._fileName = `gameitems/${itemInfo.file_name}`;
      item._layer = itemInfo.editor_layer ?? 0;
      item._layerName = itemInfo.editor_layer_name || null;
      item.is_locked = itemInfo.is_locked ?? false;
      if (itemInfo.editor_layer_visibility !== undefined) {
        item.editor_layer_visibility = itemInfo.editor_layer_visibility;
      }
      if (type === 'Flipper' && 'return' in item && !('return_' in item)) {
        (item as Record<string, unknown>)['return_'] = (item as Record<string, unknown>)['return'];
        delete (item as Record<string, unknown>)['return'];
      }
      loadedEntries.push({ item, itemInfo, type });
    } else {
      console.warn(`Failed to load item: ${itemPath}`, itemResult.error);
    }
  }

  const orderedEntries = [...loadedEntries.filter(e => e.item.name), ...loadedEntries.filter(e => !e.item.name)];
  const groupRenames = new Map<string, string>();
  for (const { item, itemInfo, type } of orderedEntries) {
    let itemName = item.name as string | undefined;
    let renamed = false;
    if (!itemName) {
      if (type === 'Decal') {
        itemName = generateUniqueName('Decal');
        renamed = true;
      } else {
        itemName = itemInfo.file_name;
      }
    } else if (hasItem(itemName)) {
      const uniqueName = generateUniqueName(itemName);
      console.warn(`Duplicate part name '${itemName}' renamed to '${uniqueName}'`);
      if (type === 'PartGroup') {
        groupRenames.set(itemName, uniqueName);
      }
      itemName = uniqueName;
      renamed = true;
    }
    if (renamed) {
      item.name = itemName;
    }
    setItem(itemName, item, itemInfo.file_name);
    if (renamed) {
      await saveItemToFile(itemName);
    }

    if (type === 'PartGroup' && item.name) {
      setPartGroup(item.name, item);
    }
  }

  const orphanedGroupRenames = [...groupRenames].filter(([oldName]) => !getPartGroup(oldName));
  if (orphanedGroupRenames.length > 0) {
    for (const key of Object.keys(state.items)) {
      const item = getItem(key);
      const groupRef = item?.part_group_name;
      if (!item || !groupRef) continue;
      for (const [oldName, newName] of orphanedGroupRenames) {
        if (nameEquals(groupRef, oldName)) {
          item.part_group_name = newName;
          await saveItemToFile(key);
          break;
        }
      }
    }
  }
  console.log(`Loaded ${Object.keys(state.items).length} items`);
  console.log(`Loaded ${Object.keys(state.partGroups).length} part groups`);

  await upgradeBackglassPrimitives();
  warnOnMissingBackdropImages();

  if (state.gamedata && state.gamedata.image) {
    loadBackdropImage(state.gamedata.image as string);
  }

  selectItem(null, true);
  updateItemsList('', true);
  updateLayersList();
  updateCollectionsList();
  updatePropertiesPanel();
  fitToView();
  render();
}

function warnOnMissingBackdropImages(): void {
  const gamedata = state.gamedata as Record<string, unknown> | null;
  if (!gamedata) return;
  const imageNames = new Set(Object.keys(state.images || {}).map(name => name.toLowerCase()));
  const backdropSets: [string, string][] = [
    ['Desktop', 'backglass_image_full_desktop'],
    ['Cabinet', 'backglass_image_full_fullscreen'],
    ['Full Single Screen', 'backglass_image_full_single_screen'],
  ];
  for (const [setName, prop] of backdropSets) {
    const imageName = gamedata[prop] as string | undefined;
    if (imageName && imageName.toLowerCase() !== '<none>' && !imageNames.has(imageName.toLowerCase())) {
      appendConsoleLine(
        `Warning: ${setName} backdrop image '${imageName}' is not present in the table (renders black)`,
        'warn'
      );
    }
  }
}

export async function loadBackdropImage(imageName: string): Promise<void> {
  const extensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
  const mimeTypes: MimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };

  for (const ext of extensions) {
    const imagePath = `${state.extractedDir}/images/${imageName}${ext}`;
    try {
      const result = await window.vpxEditor.readBinaryFile(imagePath);
      if (result.success && result.data) {
        const data = result.data;
        const uint8Array =
          data instanceof Uint8Array
            ? data
            : Array.isArray(data)
              ? new Uint8Array(data)
              : new Uint8Array(Object.values(data));
        const blob = new Blob([uint8Array as BlobPart], { type: mimeTypes[ext] });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = (): void => {
          state.backdropImage = img;
          render();
        };
        img.onerror = (): void => {
          console.warn(`Failed to decode image: ${imagePath}`);
        };
        img.src = url;
        return;
      }
    } catch {
      continue;
    }
  }
  console.warn(`Backdrop image not found: ${imageName}`);
}

export async function saveItemToFile(itemName: string): Promise<boolean> {
  const item = getItem(itemName);
  if (!item || !item._fileName) return false;

  const type = item._type;
  const saveData: Record<string, Record<string, unknown>> = { [type]: {} };

  for (const [key, value] of Object.entries(item)) {
    if (key.startsWith('_') || key === 'is_locked') continue;
    saveData[type][key] = value;
  }

  const result = await window.vpxEditor.writeFile(
    `${state.extractedDir}/${item._fileName}`,
    JSON.stringify(saveData, null, 2)
  );

  if (!result.success) {
    (elements.statusBar as HTMLElement).textContent = `Failed to save ${itemName}`;
  }
  return result.success;
}

export async function updateGameitemsJson(itemName: string): Promise<void> {
  const item = getItem(itemName);
  if (!item) return;

  const gameitemEntry = state.gameitems.find(
    (gi: GameItemEntry) => gi.file_name === item._fileName!.replace('gameitems/', '')
  );
  if (gameitemEntry) {
    gameitemEntry.is_locked = item.is_locked;
    gameitemEntry.editor_layer = item._layer;
    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  }
}
