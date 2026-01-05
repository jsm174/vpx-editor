import { state } from './state.js';
import { BLUEPRINT_BACKGROUND_COLOR, BLUEPRINT_MAX_DIMENSION } from '../shared/constants.js';
import { getItemNameFromFileName } from '../shared/gameitem-utils.js';

import {
  bumperRenderBlueprint,
  flipperRenderBlueprint,
  kickerRenderBlueprint,
  spinnerRenderBlueprint,
  plungerRenderBlueprint,
  triggerRenderBlueprint,
  lightRenderBlueprint,
  wallRenderBlueprint,
  rubberRenderBlueprint,
  rampRenderBlueprint,
  ballRenderBlueprint,
  decalRenderBlueprint,
  textBoxRenderBlueprint,
  reelRenderBlueprint,
  gateRenderBlueprint,
  hitTargetRenderBlueprint,
  primitiveRenderBlueprint,
  flasherRenderBlueprint,
  timerRenderBlueprint,
  lightSequencerRenderBlueprint,
  partGroupRenderBlueprint,
} from './objects/index.js';

const BACKGLASS_WIDTH = 1000;
const BACKGLASS_HEIGHT = 750;

function calculateDimensions(tableWidth, tableHeight) {
  let bmwidth, bmheight;

  if (tableHeight > tableWidth) {
    bmheight = BLUEPRINT_MAX_DIMENSION;
    bmwidth = Math.round((tableWidth / tableHeight) * bmheight);
  } else {
    bmwidth = BLUEPRINT_MAX_DIMENSION;
    bmheight = Math.round((tableHeight / tableWidth) * bmwidth);
  }

  return { width: bmwidth, height: bmheight };
}

function renderBlueprintItem(ctx, item, scale, solid) {
  const type = item._type;

  switch (type) {
    case 'Bumper':
      bumperRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Flipper':
      flipperRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Kicker':
      kickerRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Spinner':
      spinnerRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Plunger':
      plungerRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Trigger':
      triggerRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Light':
      lightRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Wall':
      wallRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Rubber':
      rubberRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Ramp':
      rampRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Ball':
      ballRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Decal':
      decalRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'TextBox':
      textBoxRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Reel':
      reelRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Gate':
      gateRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'HitTarget':
      hitTargetRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Primitive':
      primitiveRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Flasher':
      flasherRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'Timer':
      timerRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'LightSeq':
      lightSequencerRenderBlueprint(ctx, item, scale, solid);
      break;
    case 'PartGroup':
      partGroupRenderBlueprint(ctx, item, scale, solid);
      break;
    default:
      break;
  }
}

export async function exportBlueprint(solid, isBackglass) {
  const gd = state.gamedata;
  if (!gd) {
    console.error('No table data available');
    return null;
  }

  let tableWidth, tableHeight;
  if (isBackglass) {
    tableWidth = BACKGLASS_WIDTH;
    tableHeight = BACKGLASS_HEIGHT;
  } else {
    tableWidth = gd.right - gd.left;
    tableHeight = gd.bottom - gd.top;
  }

  const { width: bmwidth, height: bmheight } = calculateDimensions(tableWidth, tableHeight);
  const scale = bmwidth / tableWidth;

  const canvas = document.createElement('canvas');
  canvas.width = bmwidth;
  canvas.height = bmheight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BLUEPRINT_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, bmwidth, bmheight);

  for (const gi of state.gameitems) {
    if (!gi.file_name) continue;

    const name = getItemNameFromFileName(gi.file_name);
    const item = state.items[name];
    if (!item) continue;

    const type = item._type || 'Unknown';

    if (item.editor_layer_visibility === false) continue;

    const alwaysBackglass = type === 'TextBox' || type === 'Reel';
    const itemBackglass = alwaysBackglass || item.is_backglass || item.backglass || false;
    if (itemBackglass !== isBackglass) continue;

    try {
      renderBlueprintItem(ctx, item, scale, solid);
    } catch (e) {
      console.warn(`Blueprint render error for ${name} (${type}):`, e.message);
    }
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve(blob);
    }, 'image/png');
  });
}

export async function exportBlueprintAndDownload(solid, isBackglass) {
  const tableName = state.tableName || 'blueprint';
  const suffix = isBackglass ? '_backglass' : '';
  const filename = `${tableName}${suffix}.png`;

  const blob = await exportBlueprint(solid, isBackglass);
  if (!blob) return;

  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  if (window.vpxEditor && window.vpxEditor.exportBlueprint) {
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
