import { state, elements, isItemSelected, setSelection, clearSelection } from './state.js';
import { VIEW_MODE_3D } from '../shared/constants.js';
import {
  getItemCenter,
  centerViewOnPoint,
  zoomToFitItems,
  updateZoomDisplay,
  convertToUnit,
  getUnitSuffix,
} from './utils.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { render } from './canvas-renderer.js';
import { getGroupedCollectionForItem } from './collections.js';
import { getPrimitiveMeshInfo } from './objects/primitive.js';
import { registerCallback, invokeCallback } from '../shared/callbacks.js';

function getItemStatusInfo(item) {
  if (!item) return '';
  const type = item._type;
  const suffix = getUnitSuffix();

  if (type === 'Gate') {
    const length = convertToUnit(item.length ?? 0);
    const height = convertToUnit(item.height ?? 0);
    return `Length: ${length.toFixed(3)} | Height: ${height.toFixed(3)}${suffix}`;
  }
  if (type === 'Spinner') {
    const length = convertToUnit(item.length ?? 0);
    const height = convertToUnit(item.height ?? 0);
    return `Length: ${length.toFixed(3)} | Height: ${height.toFixed(3)}${suffix}`;
  }
  if (type === 'Flipper') {
    const length = convertToUnit(item.base_radius ?? 0);
    const height = convertToUnit(item.height ?? 0);
    return `Length: ${length.toFixed(3)} | Height: ${height.toFixed(3)}${suffix}`;
  }
  if (type === 'Rubber') {
    const height = convertToUnit(item.height ?? 0);
    const thickness = convertToUnit(item.thickness ?? 0);
    return `Height: ${height.toFixed(3)} | Thickness: ${thickness.toFixed(3)}${suffix}`;
  }
  if (type === 'Wall' || type === 'Surface') {
    const topHeight = convertToUnit(item.height_top ?? 0);
    const bottomHeight = convertToUnit(item.height_bottom ?? 0);
    return `TopHeight: ${topHeight.toFixed(3)} | BottomHeight: ${bottomHeight.toFixed(3)}${suffix}`;
  }
  if (type === 'Kicker') {
    const radius = convertToUnit(item.radius ?? 0);
    return `Radius: ${radius.toFixed(3)}${suffix}`;
  }
  if (type === 'Primitive') {
    const meshInfo = getPrimitiveMeshInfo(item);
    if (meshInfo) {
      return `Vertices: ${meshInfo.numVertices} | Polygons: ${meshInfo.numPolygons}`;
    }
  }
  return '';
}

export function updateItemStatusInfo(item) {
  if (!item) return;
  if (state.primarySelectedItem === item.name && elements.statusInfo) {
    elements.statusInfo.textContent = getItemStatusInfo(item);
  }
}

export function updateSelectionStatus() {
  const item = state.items[state.primarySelectedItem];
  const pos = item ? getItemCenter(item) : null;

  if (elements.statusElement) {
    if (state.selectedItems.length > 1) {
      elements.statusElement.textContent = `${state.selectedItems.length} items`;
    } else if (state.primarySelectedItem && item) {
      const layer = item.part_group_name || item._layerName || '';
      elements.statusElement.textContent = layer ? `${layer}/${state.primarySelectedItem}` : state.primarySelectedItem;
    } else {
      elements.statusElement.textContent = state.gamedata?.name || '';
    }
  }

  if (elements.statusOrigin && state.gamedata) {
    if (pos) {
      elements.statusOrigin.textContent = `${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}`;
    } else {
      elements.statusOrigin.textContent = '';
    }
  }

  if (elements.statusInfo) {
    elements.statusInfo.textContent = item ? getItemStatusInfo(item) : '';
  }
}

registerCallback('focusItemIn3D');
registerCallback('focusBoundsIn3D');
registerCallback('selectionChangeCallback');
registerCallback('itemContextMenuCallbacks');

export function updateItemsList(searchFilter = '', collapseAll = false) {}

export function panToItem(name) {
  const item = state.items[name];
  if (!item) return;

  const groupedCollection = getGroupedCollectionForItem(name);
  if (groupedCollection) {
    state.selectedNode = null;
    state.selectedPartGroup = null;
    setSelection(groupedCollection.items, name);
    zoomToFitItems(groupedCollection.items);
    updatePropertiesPanel();
    render();
    invokeCallback('selectionChangeCallback');
    return;
  }

  const center = getItemCenter(item);
  if (!center) return;

  const minZoom = 0.3;
  const maxZoom = 1.5;
  let targetZoom = Math.max(minZoom, Math.min(maxZoom, state.zoom));

  if (state.zoom < minZoom) {
    targetZoom = 0.5;
  }

  state.zoom = targetZoom;
  updateZoomDisplay();

  const screenCenterX = elements.canvas.width / 2;
  const screenCenterY = elements.canvas.height / 2;

  state.panX = screenCenterX - center.x * state.zoom;
  state.panY = screenCenterY - center.y * state.zoom;

  selectItem(name, true);
  render();
}

export function selectItem(name, skipFocus = false, resetTab = false) {
  state.selectedNode = null;
  state.selectedPartGroup = null;

  if (!name) {
    clearSelection();
  } else {
    const groupedCollection = getGroupedCollectionForItem(name);
    if (groupedCollection) {
      setSelection(groupedCollection.items, name);
    } else {
      setSelection([name], name);
    }
  }

  const item = state.items[state.primarySelectedItem];
  const pos = item ? getItemCenter(item) : null;

  updateSelectionStatus();

  if (state.tool === 'pan') {
    state.tool = 'select';
    document.getElementById('tool-select')?.classList.add('active');
    document.getElementById('tool-pan')?.classList.remove('active');
    elements.canvas.style.cursor = 'default';
  }

  if (!skipFocus && state.primarySelectedItem) {
    if (state.viewMode === VIEW_MODE_3D) {
      if (state.selectedItems.length > 1) {
        invokeCallback('focusBoundsIn3D', state.selectedItems);
      } else if (pos) {
        invokeCallback('focusItemIn3D', pos.x, pos.y, item);
      }
    } else if (state.selectedItems.length > 1) {
      zoomToFitItems(state.selectedItems);
    } else if (pos) {
      centerViewOnPoint(pos.x, pos.y);
    }
  }

  updatePropertiesPanel(resetTab);
  render();
  invokeCallback('selectionChangeCallback');
}
