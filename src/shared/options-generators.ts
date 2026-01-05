import { state } from '../editor/state.js';

function buildOptions(names: string[], currentValue: string | null | undefined): string {
  let html = `<option value=""${!currentValue ? ' selected' : ''}></option>`;
  for (const name of names) {
    const selected = name === currentValue ? ' selected' : '';
    html += `<option value="${name}"${selected}>${name}</option>`;
  }
  return html;
}

export function materialOptions(currentValue: string | null | undefined): string {
  return buildOptions(state.materialNames, currentValue);
}

export function imageOptions(currentValue: string | null | undefined): string {
  return buildOptions(state.imageNames, currentValue);
}

function getItemNamesByType(...types: string[]): string[] {
  return Object.entries(state.items)
    .filter(([, item]) => types.includes(item._type))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function surfaceOptions(currentValue: string | null | undefined): string {
  return buildOptions(getItemNamesByType('Wall'), currentValue);
}

export function lightOptions(currentValue: string | null | undefined): string {
  return buildOptions(getItemNamesByType('Light'), currentValue);
}

export function layerOptions(currentLayer: number | null | undefined): string {
  const layers = new Map<number, string>();
  for (const gi of state.gameitems) {
    const num = gi.editor_layer ?? 0;
    const name = gi.editor_layer_name || `Layer ${num}`;
    if (!layers.has(num)) {
      layers.set(num, name);
    }
  }
  const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  let html = '';
  for (const [num, name] of sortedLayers) {
    const selected = num === currentLayer ? ' selected' : '';
    html += `<option value="${num}" data-layer-name="${name}"${selected}>${name}</option>`;
  }
  return html;
}

export function collectionOptions(currentValue: string | null | undefined): string {
  let html = `<option value=""${!currentValue ? ' selected' : ''}></option>`;
  if (state.collections) {
    for (const collection of state.collections) {
      const name = collection.name || '';
      const selected = name === currentValue ? ' selected' : '';
      html += `<option value="${name}"${selected}>${name}</option>`;
    }
  }
  return html;
}

export function soundOptions(currentValue: string | null | undefined): string {
  return buildOptions(state.soundNames, currentValue);
}

export function renderProbeOptions(currentValue: string | null | undefined): string {
  return buildOptions(state.renderProbeNames, currentValue);
}
