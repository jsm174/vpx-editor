import { state, GameItem, getItemByFileName } from './state.js';
import { BLUEPRINT_BACKGROUND_COLOR, BLUEPRINT_MAX_DIMENSION } from '../shared/constants.js';
import { getEditable } from './parts/index.js';
import type { GameData } from '../types/data.js';

interface Dimensions {
  width: number;
  height: number;
}

const BACKGLASS_WIDTH = 1000;
const BACKGLASS_HEIGHT = 750;

function calculateDimensions(tableWidth: number, tableHeight: number): Dimensions {
  let bmwidth: number;
  let bmheight: number;

  if (tableHeight > tableWidth) {
    bmheight = BLUEPRINT_MAX_DIMENSION;
    bmwidth = Math.round((tableWidth / tableHeight) * bmheight);
  } else {
    bmwidth = BLUEPRINT_MAX_DIMENSION;
    bmheight = Math.round((tableHeight / tableWidth) * bmwidth);
  }

  return { width: bmwidth, height: bmheight };
}

function renderBlueprintItem(ctx: CanvasRenderingContext2D, item: GameItem, scale: number, solid: boolean): void {
  const renderer = getEditable(item._type || '');
  renderer?.renderBlueprint(ctx, item, scale, solid);
}

export async function exportBlueprint(solid: boolean, isBackglass: boolean): Promise<Blob | null> {
  const gd = state.gamedata as GameData | null;
  if (!gd) {
    console.error('No table data available');
    return null;
  }

  let tableWidth: number;
  let tableHeight: number;
  if (isBackglass) {
    tableWidth = BACKGLASS_WIDTH;
    tableHeight = BACKGLASS_HEIGHT;
  } else {
    tableWidth = (gd.right ?? 0) - (gd.left ?? 0);
    tableHeight = (gd.bottom ?? 0) - (gd.top ?? 0);
  }

  const { width: bmwidth, height: bmheight } = calculateDimensions(tableWidth, tableHeight);
  const scale = bmwidth / tableWidth;

  const canvas = document.createElement('canvas');
  canvas.width = bmwidth;
  canvas.height = bmheight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BLUEPRINT_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, bmwidth, bmheight);

  for (const gi of state.gameitems) {
    if (!gi.file_name) continue;

    const item = getItemByFileName(gi.file_name);
    if (!item) continue;

    const type = item._type || 'Unknown';

    if (item.editor_layer_visibility === false) continue;

    const alwaysBackglass = type === 'TextBox' || type === 'Reel';
    const itemBackglass = alwaysBackglass || item.is_backglass || item.backglass || false;
    if (itemBackglass !== isBackglass) continue;

    try {
      renderBlueprintItem(ctx, item, scale, solid);
    } catch (e: unknown) {
      console.warn(`Blueprint render error for ${name} (${type}):`, (e as Error).message);
    }
  }

  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(blob => {
      resolve(blob);
    }, 'image/png');
  });
}

export async function exportBlueprintAndDownload(solid: boolean, isBackglass: boolean): Promise<void> {
  const tableName = state.tableName || 'blueprint';
  const suffix = isBackglass ? '_backglass' : '';
  const filename = `${tableName}${suffix}.png`;

  const blob = await exportBlueprint(solid, isBackglass);
  if (!blob) return;

  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  if (window.vpxEditor?.exportBlueprint) {
    await window.vpxEditor.exportBlueprint(Array.from(uint8Array), filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
