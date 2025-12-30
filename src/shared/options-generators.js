import { state } from '../editor/state.js';

function buildOptions(names, currentValue) {
  let html = `<option value=""${!currentValue ? ' selected' : ''}></option>`;
  for (const name of names) {
    const selected = name === currentValue ? ' selected' : '';
    html += `<option value="${name}"${selected}>${name}</option>`;
  }
  return html;
}

export function materialOptions(currentValue) {
  return buildOptions(state.materialNames, currentValue);
}

export function imageOptions(currentValue) {
  return buildOptions(state.imageNames, currentValue);
}

function getItemNamesByType(...types) {
  return Object.entries(state.items)
    .filter(([_, item]) => types.includes(item._type))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function surfaceOptions(currentValue) {
  return buildOptions(getItemNamesByType('Wall', 'Surface'), currentValue);
}

export function lightOptions(currentValue) {
  return buildOptions(getItemNamesByType('Light'), currentValue);
}

export function layerOptions(currentLayer) {
  const layers = new Map();
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

export function collectionOptions(currentValue) {
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

export function soundOptions(currentValue) {
  return buildOptions(state.soundNames, currentValue);
}

export function renderProbeOptions(currentValue) {
  return buildOptions(state.renderProbeNames, currentValue);
}
