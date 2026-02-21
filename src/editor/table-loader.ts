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
import { getItem, setItem, setPartGroup, clearFileNameMap } from './state.js';

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
      const itemName = item.name || itemInfo.file_name;
      setItem(itemName, item, itemInfo.file_name);

      if (type === 'PartGroup' && item.name) {
        setPartGroup(item.name, item);
      }
    } else {
      console.warn(`Failed to load item: ${itemPath}`, itemResult.error);
    }
  }
  console.log(`Loaded ${Object.keys(state.items).length} items`);
  console.log(`Loaded ${Object.keys(state.partGroups).length} part groups`);

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
