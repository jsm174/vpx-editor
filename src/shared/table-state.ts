import fs from 'fs-extra';
import path from 'node:path';
import type { GameData, TableInfo, Material, ImageInfo, Sound, Collection } from '../types/data.js';

export interface GameItemRef {
  file_name: string;
  is_locked?: boolean;
  editor_layer?: number;
  editor_layer_name?: string;
  editor_layer_visibility?: boolean;
}

export interface GameItem {
  type: string;
  name: string;
  fileName: string;
  data: Record<string, unknown>;
  ref: GameItemRef;
}

export interface TableState {
  workDir: string;
  gamedata: GameData;
  info: TableInfo;
  items: GameItem[];
  materials: Material[];
  images: ImageInfo[];
  sounds: Sound[];
  collections: Collection[];
  script: string;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function readText(filePath: string, fallback = ''): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

export async function loadFromWorkFolder(workDir: string): Promise<TableState> {
  const gamedata = await readJson<GameData>(path.join(workDir, 'gamedata.json'), {});
  const info = await readJson<TableInfo>(path.join(workDir, 'info.json'), {});
  const refs = await readJson<GameItemRef[]>(path.join(workDir, 'gameitems.json'), []);
  const materials = await readJson<Material[]>(path.join(workDir, 'materials.json'), []);
  const images = await readJson<ImageInfo[]>(path.join(workDir, 'images.json'), []);
  const sounds = await readJson<Sound[]>(path.join(workDir, 'sounds.json'), []);
  const collections = await readJson<Collection[]>(path.join(workDir, 'collections.json'), []);
  const script = await readText(path.join(workDir, 'script.vbs'));

  const items: GameItem[] = [];
  for (const ref of refs) {
    if (!ref.file_name) continue;
    try {
      const raw = await fs.promises.readFile(path.join(workDir, 'gameitems', ref.file_name), 'utf-8');
      const wrapper = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      const type = Object.keys(wrapper)[0];
      if (!type) continue;
      const data = wrapper[type];
      const name = (data?.name as string) || ref.file_name.replace(/^\w+\./, '').replace(/\.json$/, '');
      items.push({ type, name, fileName: ref.file_name, data, ref });
    } catch {
      continue;
    }
  }

  return { workDir, gamedata, info, items, materials, images, sounds, collections, script };
}

export function getPlayfieldBounds(state: TableState): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const { left = 0, top = 0, right = 0, bottom = 0 } = state.gamedata;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function findItem(state: TableState, name: string): GameItem | undefined {
  const lower = name.toLowerCase();
  return state.items.find(i => i.name.toLowerCase() === lower);
}

export function itemsByType(state: TableState, type: string): GameItem[] {
  return state.items.filter(i => i.type === type);
}

export function summarizeCounts(state: TableState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of state.items) {
    counts[item.type] = (counts[item.type] || 0) + 1;
  }
  return counts;
}
