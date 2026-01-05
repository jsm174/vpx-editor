import { state, elements, setSelection, clearSelection, GameItem } from './state.js';
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
import { getPrimitiveMeshInfo } from './parts/primitive.js';
import { registerCallback, invokeCallback } from '../shared/callbacks.js';
import type { Point } from '../types/game-objects.js';

interface MeshInfo {
  numVertices: number;
  numPolygons: number;
}

interface GroupedCollection {
  items: string[];
}

function getItemStatusInfo(item: GameItem): string {
  if (!item) return '';
  const type = item._type;
  const suffix = getUnitSuffix();

  if (type === 'Gate') {
    const length = convertToUnit((item.length as number) ?? 0);
    const height = convertToUnit((item.height as number) ?? 0);
    return `Length: ${length.toFixed(3)} | Height: ${height.toFixed(3)}${suffix}`;
  }
  if (type === 'Spinner') {
    const length = convertToUnit((item.length as number) ?? 0);
    const height = convertToUnit((item.height as number) ?? 0);
    return `Length: ${length.toFixed(3)} | Height: ${height.toFixed(3)}${suffix}`;
  }
  if (type === 'Flipper') {
    const length = convertToUnit((item.base_radius as number) ?? 0);
    const height = convertToUnit((item.height as number) ?? 0);
    return `Length: ${length.toFixed(3)} | Height: ${height.toFixed(3)}${suffix}`;
  }
  if (type === 'Rubber') {
    const height = convertToUnit((item.height as number) ?? 0);
    const thickness = convertToUnit((item.thickness as number) ?? 0);
    return `Height: ${height.toFixed(3)} | Thickness: ${thickness.toFixed(3)}${suffix}`;
  }
  if (type === 'Wall') {
    const topHeight = convertToUnit((item.height_top as number) ?? 0);
    const bottomHeight = convertToUnit((item.height_bottom as number) ?? 0);
    return `TopHeight: ${topHeight.toFixed(3)} | BottomHeight: ${bottomHeight.toFixed(3)}${suffix}`;
  }
  if (type === 'Kicker') {
    const radius = convertToUnit((item.radius as number) ?? 0);
    return `Radius: ${radius.toFixed(3)}${suffix}`;
  }
  if (type === 'Primitive') {
    const meshInfo = getPrimitiveMeshInfo(
      item as unknown as Parameters<typeof getPrimitiveMeshInfo>[0]
    ) as MeshInfo | null;
    if (meshInfo) {
      return `Vertices: ${meshInfo.numVertices} | Polygons: ${meshInfo.numPolygons}`;
    }
  }
  return '';
}

export function updateItemStatusInfo(item: GameItem): void {
  if (!item) return;
  if (state.primarySelectedItem === item.name && elements.statusInfo) {
    elements.statusInfo.textContent = getItemStatusInfo(item);
  }
}

export function updateSelectionStatus(): void {
  const item = state.items[state.primarySelectedItem!];
  const pos = item ? (getItemCenter(item) as Point | null) : null;

  if (elements.statusElement) {
    if (state.selectedItems.length > 1) {
      elements.statusElement.textContent = `${state.selectedItems.length} items`;
    } else if (state.primarySelectedItem && item) {
      const layer = item.part_group_name || (item as GameItem & { _layerName?: string })._layerName || '';
      elements.statusElement.textContent = layer ? `${layer}/${state.primarySelectedItem}` : state.primarySelectedItem;
    } else {
      elements.statusElement.textContent = ((state.gamedata as Record<string, unknown>)?.name as string) || '';
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

export function updateItemsList(_searchFilter: string = '', _collapseAll: boolean = false): void {}

export function panToItem(name: string): void {
  const item = state.items[name];
  if (!item) return;

  const groupedCollection = getGroupedCollectionForItem(name) as GroupedCollection | null;
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

  const center = getItemCenter(item) as Point | null;
  if (!center) return;

  const minZoom = 0.3;
  const maxZoom = 1.5;
  let targetZoom = Math.max(minZoom, Math.min(maxZoom, state.zoom));

  if (state.zoom < minZoom) {
    targetZoom = 0.5;
  }

  state.zoom = targetZoom;
  updateZoomDisplay();

  const screenCenterX = elements.canvas!.width / 2;
  const screenCenterY = elements.canvas!.height / 2;

  state.panX = screenCenterX - center.x * state.zoom;
  state.panY = screenCenterY - center.y * state.zoom;

  selectItem(name, true);
  render();
}

export function selectItem(name: string | null, skipFocus: boolean = false, resetTab: boolean = false): void {
  state.selectedNode = null;
  state.selectedPartGroup = null;

  if (!name) {
    clearSelection();
  } else {
    const groupedCollection = getGroupedCollectionForItem(name) as GroupedCollection | null;
    if (groupedCollection) {
      setSelection(groupedCollection.items, name);
    } else {
      setSelection([name], name);
    }
  }

  const item = state.items[state.primarySelectedItem!];
  const pos = item ? (getItemCenter(item) as Point | null) : null;

  updateSelectionStatus();

  if (state.tool === 'pan') {
    state.tool = 'select';
    document.getElementById('tool-select')?.classList.add('active');
    document.getElementById('tool-pan')?.classList.remove('active');
    elements.canvas!.style.cursor = 'default';
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
