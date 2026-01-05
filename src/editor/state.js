import {
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_TABLE_BACKGROUND_COLOR,
  DEFAULT_UNIT_CONVERSION,
  DEFAULT_ZOOM,
  VIEW_MODE_2D,
  VIEW_MODE_3D,
} from '../shared/constants.js';

export const state = {
  extractedDir: null,
  tableName: null,
  gamedata: null,
  info: null,
  gameitems: [],
  items: {},
  partGroups: {},
  collections: [],
  materials: {},
  images: {},
  sounds: [],
  renderProbes: {},
  materialNames: [],
  imageNames: [],
  soundNames: [],
  renderProbeNames: [],
  textureCache: new Map(),
  selectedItems: [],
  primarySelectedItem: null,
  selectedPartGroup: null,
  selectedCollection: null,
  zoom: DEFAULT_ZOOM,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  tool: 'select',
  hiddenLayers: new Set(),
  hiddenItems: new Set(),
  activePanel: 'items',
  showGrid: true,
  gridSize: 50,
  showBackdrop: true,
  viewSolid: true,
  viewOutline: false,
  backdropImage: null,
  viewMode: VIEW_MODE_2D,
  showMaterials: false,
  creationMode: null,
  selectedNode: null,
  draggingNode: false,
  draggingObject: false,
  objectDragStart: { x: 0, y: 0 },
  nodeHoverIndex: null,
  scriptEditorOpen: false,
  scriptModified: false,
  renderCallback: null,
  clipboard: null,
  lastMousePosition: { x: 0, y: 0 },
  editorColors: {
    defaultMaterial: DEFAULT_MATERIAL_COLOR,
    elementSelect: DEFAULT_ELEMENT_SELECT_COLOR,
    elementSelectLocked: DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
    elementFill: DEFAULT_ELEMENT_FILL_COLOR,
    tableBackground: DEFAULT_TABLE_BACKGROUND_COLOR,
  },
  alwaysDrawDragPoints: false,
  drawLightCenters: false,
  unitConversion: DEFAULT_UNIT_CONVERSION,
  backglassView: false,
  backglassViewMode: 'desktop',
  ctrlZoomHandled: false,
  previewViewMode: 'editor',
  isTableLocked: false,
};

export const dragRect = {
  active: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
};

export const collapsedGroups = new Set();

export const elements = {
  canvas: null,
  ctx: null,
  container: null,
  layersList: null,
  propertiesContent: null,
  propertiesTitle: null,
  statusBar: null,
  zoomLevelEl: null,
  statusMouse: null,
  statusOrigin: null,
  statusBlank: null,
  statusAction: null,
  statusElement: null,
  statusInfo: null,
};

export function initElements() {
  elements.canvas = document.getElementById('playfield-canvas');
  elements.ctx = elements.canvas.getContext('2d');
  elements.container = document.getElementById('canvas-container');
  elements.layersList = document.getElementById('layers-list');
  elements.propertiesContent = document.getElementById('properties-content');
  elements.propertiesTitle = document.getElementById('properties-title');
  elements.statusBar = document.getElementById('status-bar');
  elements.zoomLevelEl = document.getElementById('zoom-level');
  elements.statusMouse = document.getElementById('status-mouse');
  elements.statusOrigin = document.getElementById('status-origin');
  elements.statusBlank = document.getElementById('status-blank');
  elements.statusAction = document.getElementById('status-action');
  elements.statusElement = document.getElementById('status-element');
  elements.statusInfo = document.getElementById('status-info');
}

const ALWAYS_BACKGLASS = ['TextBox', 'Reel'];
const CAN_BE_BACKGLASS = ['Decal', 'Flasher', 'Light', 'LightSequencer', 'PartGroup', 'Timer'];

export function isBackglassItem(item) {
  if (ALWAYS_BACKGLASS.includes(item._type)) return true;
  if (CAN_BE_BACKGLASS.includes(item._type)) {
    return item.is_backglass === true || item.backglass === true;
  }
  return false;
}

export function isItemVisible(item, name) {
  const inPreviewMode = state.viewMode === VIEW_MODE_3D && state.previewViewMode !== 'editor';

  if (!inPreviewMode) {
    if (item.editor_layer_visibility === false) return false;
    const layer = item._layer ?? 0;
    if (state.hiddenLayers.has(layer)) return false;
  }

  if (isBackglassItem(item) !== state.backglassView) {
    return false;
  }

  if (state.viewMode !== VIEW_MODE_3D && item.part_group_name) {
    let groupName = item.part_group_name;
    while (groupName) {
      const partGroup = state.partGroups[groupName];
      if (!partGroup) break;

      const spaceRef = partGroup.space_reference;
      if (spaceRef && spaceRef !== 'playfield' && spaceRef !== 'inherit') {
        return false;
      }

      groupName = partGroup.part_group_name;
    }
  }

  return true;
}

export function isItemSelected(name) {
  return state.selectedItems.includes(name);
}

export function getSelectedItems() {
  return state.selectedItems;
}

export function getPrimarySelectedItem() {
  return state.primarySelectedItem;
}

export function clearSelection() {
  state.selectedItems = [];
  state.primarySelectedItem = null;
}

export function setSelection(items, primaryItem = null) {
  state.selectedItems = Array.isArray(items) ? items : [items];
  state.primarySelectedItem = primaryItem || state.selectedItems[0] || null;
}

export { undoManager } from './undo/index.js';
