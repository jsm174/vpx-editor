import type { GameObject, PartGroup, Point, GameItemMeta } from './game-objects.js';
export type { GameItemMeta };
import type {
  GameData,
  TableInfo,
  Material,
  ImageInfo,
  Sound,
  RenderProbe,
  Collection,
  ClipboardData,
} from './data.js';

export type ViewMode = 'VIEW_MODE_2D' | 'VIEW_MODE_3D';
export type Tool = 'select' | 'pan' | 'zoom' | 'create';
export type ActivePanel = 'items' | 'layers' | 'collections';
export type BackglassViewMode = 'desktop' | 'fullscreen';
export type PreviewViewMode = 'editor' | 'cabinet' | 'desktop';

export interface EditorColors {
  defaultMaterial: string;
  elementSelect: string;
  elementSelectLocked: string;
  elementStroke?: string;
  elementFill: string;
  tableBackground: string;
}

export interface EditorState {
  extractedDir: string | null;
  tableName: string | null;
  gamedata: GameData | null;
  info: TableInfo | null;
  gameitems: GameItemMeta[];
  items: Record<string, GameObject>;
  partGroups: Record<string, PartGroup>;
  collections: Collection[];
  materials: Record<string, Material>;
  images: Record<string, ImageInfo>;
  sounds: Sound[];
  renderProbes: Record<string, RenderProbe>;
  materialNames: string[];
  imageNames: string[];
  soundNames: string[];
  renderProbeNames: string[];
  textureCache: Map<string, HTMLImageElement>;
  selectedItems: string[];
  primarySelectedItem: string | null;
  selectedPartGroup: string | null;
  selectedCollection: string | null;
  zoom: number;
  panX: number;
  panY: number;
  isDragging: boolean;
  dragStart: Point;
  tool: Tool;
  hiddenLayers: Set<number>;
  hiddenItems: Set<string>;
  activePanel: ActivePanel;
  showGrid: boolean;
  gridSize: number;
  showBackdrop: boolean;
  viewSolid: boolean;
  viewOutline: boolean;
  backdropImage: HTMLImageElement | null;
  viewMode: ViewMode;
  showMaterials: boolean;
  creationMode: string | null;
  selectedNode: number | null;
  draggingNode: boolean;
  draggingObject: boolean;
  objectDragStart: Point;
  nodeHoverIndex: number | null;
  scriptEditorOpen: boolean;
  scriptModified: boolean;
  renderCallback: (() => void) | null;
  clipboard: ClipboardData | null;
  lastMousePosition: Point;
  editorColors: EditorColors;
  alwaysDrawDragPoints: boolean;
  drawLightCenters: boolean;
  unitConversion: number;
  backglassView: boolean;
  backglassViewMode: BackglassViewMode;
  ctrlZoomHandled: boolean;
  previewViewMode: PreviewViewMode;
  isTableLocked: boolean;
}

export interface DragRect {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface Elements {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  container: HTMLElement | null;
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
