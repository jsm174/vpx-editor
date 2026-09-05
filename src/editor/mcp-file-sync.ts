import type { FileChange } from '../shared/file-changes.js';
import { state, getItem, type Material, type ImageData, type SoundData, type Collection } from './state.js';
import { loadTable } from './table-loader.js';
import { clearPrimitiveMeshCache } from './parts/primitive.js';
import { invalidateAllItems } from './canvas-renderer-3d.js';
import { updateCollectionsList } from './layers-panel.js';

/** Refresh exactly the domains touched by a committed transaction, preserving the current view. */
export async function syncEditedFiles(changes: FileChange[]): Promise<void> {
  const paths = new Set(changes.map(c => c.path));
  const imagesChanged = paths.has('images.json') || [...paths].some(p => p.startsWith('images/'));
  const soundsChanged = paths.has('sounds.json') || [...paths].some(p => p.startsWith('sounds/'));
  async function json(file: string, fallback: unknown): Promise<unknown> {
    const result = await window.vpxEditor.readFile(`${state.extractedDir}/${file}`);
    if (!result.success) {
      if (changes.some(c => c.path === file && (c.before === null || c.after === null))) return fallback;
      throw new Error(result.error ?? `Cannot reload ${file}`);
    }
    return JSON.parse(result.content!);
  }
  if (paths.has('gameitems.json')) {
    await loadTable();
  } else {
    if (paths.has('materials.json')) {
      const materials = (await json('materials.json', [])) as Material[];
      state.materials = Object.fromEntries(materials.map(m => [m.name, m]));
      state.materialNames = materials.map(m => m.name).sort();
    }
    if (paths.has('images.json')) {
      const images = (await json('images.json', [])) as ImageData[];
      state.images = Object.fromEntries(images.map(i => [i.name, i]));
      state.imageNames = images.map(i => i.name).sort();
    }
    if (paths.has('sounds.json')) {
      state.sounds = (await json('sounds.json', [])) as SoundData[];
      state.soundNames = state.sounds.map(s => s.name).sort();
    }
    if (paths.has('collections.json')) {
      state.collections = (await json('collections.json', [])) as Collection[];
      updateCollectionsList();
    }
    for (const file of paths) {
      if (!file.startsWith('gameitems/') || !file.endsWith('.json')) continue;
      const wrapper = (await json(file, {})) as Record<string, Record<string, unknown>>;
      const data = Object.values(wrapper)[0];
      if (!data) throw new Error(`Cannot reload ${file}`);
      const item = getItem(data.name as string);
      if (!item) throw new Error(`Part no longer exists: ${data.name}`);
      for (const key of Object.keys(item)) if (!key.startsWith('_')) delete item[key];
      Object.assign(item, data);
    }
  }
  if ([...paths].some(p => p.startsWith('images/'))) {
    for (const texture of state.textureCache.values()) texture.dispose();
    state.textureCache.clear();
  }
  if ([...paths].some(p => p.startsWith('gameitems/'))) clearPrimitiveMeshCache();
  if (paths.has('script.vbs')) window.vpxEditor.notifyScriptUndone();
  if (imagesChanged) window.vpxEditor.refreshImageManager();
  if (paths.has('materials.json')) window.vpxEditor.refreshMaterialManager();
  if (soundsChanged) window.vpxEditor.refreshSoundManager();
  invalidateAllItems();
}

export async function restoreEditedFiles(changes: FileChange[], direction: 'before' | 'after'): Promise<void> {
  const workDir = state.extractedDir;
  if (!workDir) throw new Error('No active table');
  const result = await window.vpxEditor.restoreMcpFiles(workDir, changes, direction);
  if (!result.success) throw new Error(result.error ?? 'Could not restore edit');
  try {
    await syncEditedFiles(changes);
  } catch (error) {
    const rollback = await window.vpxEditor.restoreMcpFiles(
      workDir,
      changes,
      direction === 'before' ? 'after' : 'before'
    );
    if (!rollback.success) throw new Error(`${String(error)}; rollback failed: ${rollback.error}`);
    await syncEditedFiles(changes);
    throw error;
  }
}
