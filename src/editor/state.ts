import * as THREE from 'three';
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
import type { Point, DragPoint } from '../types/game-objects.js';

export type { Point, DragPoint };

export interface GameItem {
  _type: string;
  _fileName?: string;
  _layer?: number;
  name?: string;
  is_locked?: boolean;
  is_backglass?: boolean;
  backglass?: boolean;
  editor_layer_visibility?: boolean;
  part_group_name?: string | null;
  center?: Point;
  vCenter?: Point;
  pos?: Point;
  position?: Point;
  pos_x?: number;
  pos_y?: number;
  ver1?: Point;
  ver2?: Point;
  drag_points?: DragPoint[];
  radius?: number;
  falloff_radius?: number;
  size?: Point;
  [key: string]: unknown;
}

export interface PartGroup extends GameItem {
  space_reference?: string;
}

export interface GameItemEntry {
  file_name: string;
  is_locked?: boolean;
  editor_layer?: number;
  editor_layer_name?: string | null;
  editor_layer_visibility?: boolean;
}

export interface Material {
  name: string;
  [key: string]: unknown;
}

export interface ImageData {
  name: string;
  path?: string;
  [key: string]: unknown;
}

export interface SoundData {
  name: string;
  [key: string]: unknown;
}

export interface RenderProbe {
  name: string;
  [key: string]: unknown;
}

export interface Collection {
  name: string;
  items?: string[];
  [key: string]: unknown;
}

export interface SelectedNodeInfo {
  itemName: string;
  nodeIndex: number;
}

export interface EditorColors {
  defaultMaterial: string;
  elementSelect: string;
  elementSelectLocked: string;
  elementFill: string;
  tableBackground: string;
}

export interface EditorState {
  extractedDir: string | null;
  tableName: string | null;
  gamedata: Record<string, unknown> | null;
  info: Record<string, unknown> | null;
  gameitems: GameItemEntry[];
  items: Record<string, GameItem>;
  partGroups: Record<string, PartGroup>;
  collections: Collection[];
  materials: Record<string, Material>;
  images: Record<string, ImageData>;
  sounds: SoundData[];
  renderProbes: Record<string, RenderProbe>;
  materialNames: string[];
  imageNames: string[];
  soundNames: string[];
  renderProbeNames: string[];
  textureCache: Map<string, THREE.Texture>;
  selectedItems: string[];
  primarySelectedItem: string | null;
  selectedPartGroup: string | null;
  selectedCollection: string | null;
  zoom: number;
  panX: number;
  panY: number;
  isDragging: boolean;
  dragStart: Point;
  tool: string;
  hiddenLayers: Set<number>;
  hiddenItems: Set<string>;
  activePanel: string;
  showGrid: boolean;
  gridSize: number;
  showBackdrop: boolean;
  viewSolid: boolean;
  viewOutline: boolean;
  backdropImage: HTMLImageElement | null;
  viewMode: string;
  showMaterials: boolean;
  creationMode: string | null;
  selectedNode: SelectedNodeInfo | null;
  draggingNode: boolean;
  draggingObject: boolean;
  objectDragStart: Point;
  nodeHoverIndex: number | null;
  nodeMoved: boolean;
  objectMoved: boolean;
  scriptEditorOpen: boolean;
  scriptModified: boolean;
  renderCallback: (() => void) | null;
  clipboard: GameItem[] | null;
  lastMousePosition: Point;
  editorColors: EditorColors;
  alwaysDrawDragPoints: boolean;
  drawLightCenters: boolean;
  unitConversion: string;
  backglassView: boolean;
  backglassViewMode: string;
  ctrlZoomHandled: boolean;
  previewViewMode: string;
  isTableLocked: boolean;
}

export interface DragRect {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface EditorElements {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  container: HTMLElement | null;
  itemsList: HTMLElement | null;
  layersList: HTMLElement | null;
  propertiesContent: HTMLElement | null;
  propertiesTitle: HTMLElement | null;
  statusBar: HTMLElement | null;
  zoomLevelEl: HTMLElement | null;
  statusMouse: HTMLElement | null;
  statusOrigin: HTMLElement | null;
  statusBlank: HTMLElement | null;
  statusAction: HTMLElement | null;
  statusElement: HTMLElement | null;
  statusInfo: HTMLElement | null;
}

export const state: EditorState = {
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
  nodeMoved: false,
  objectMoved: false,
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

export const dragRect: DragRect = {
  active: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
};

export const collapsedGroups: Set<string> = new Set();

export const elements: EditorElements = {
  canvas: null,
  ctx: null,
  container: null,
  itemsList: null,
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

export function initElements(): void {
  elements.canvas = document.getElementById('playfield-canvas') as HTMLCanvasElement;
  elements.ctx = elements.canvas.getContext('2d');
  elements.container = document.getElementById('canvas-container');
  elements.itemsList = document.getElementById('items-list');
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

export function getCtx(): CanvasRenderingContext2D | null {
  return elements.ctx;
}

export function getStatusBar(): HTMLElement | null {
  return elements.statusBar;
}

const ALWAYS_BACKGLASS: string[] = ['TextBox', 'Reel'];
const CAN_BE_BACKGLASS: string[] = ['Decal', 'Flasher', 'Light', 'LightSequencer', 'PartGroup', 'Timer'];

export function isBackglassItem(item: GameItem): boolean {
  if (ALWAYS_BACKGLASS.includes(item._type)) return true;
  if (CAN_BE_BACKGLASS.includes(item._type)) {
    return item.is_backglass === true || item.backglass === true;
  }
  return false;
}

export function isItemVisible(item: GameItem, _name: string): boolean {
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
    let groupName: string | undefined = item.part_group_name;
    while (groupName) {
      const partGroup: PartGroup | undefined = state.partGroups[groupName];
      if (!partGroup) break;

      const spaceRef = partGroup.space_reference;
      if (spaceRef && spaceRef !== 'playfield' && spaceRef !== 'inherit') {
        return false;
      }

      groupName = partGroup.part_group_name ?? undefined;
    }
  }

  return true;
}

export function isItemSelected(name: string): boolean {
  return state.selectedItems.includes(name);
}

export function getSelectedItems(): string[] {
  return state.selectedItems;
}

export function getPrimarySelectedItem(): string | null {
  return state.primarySelectedItem;
}

export function clearSelection(): void {
  state.selectedItems = [];
  state.primarySelectedItem = null;
}

export function setSelection(items: string | string[], primaryItem: string | null = null): void {
  state.selectedItems = Array.isArray(items) ? items : [items];
  state.primarySelectedItem = primaryItem || state.selectedItems[0] || null;
}

export { undoManager } from './undo/index.js';
