import type { GameData, TableInfo, TableLoadedData, Collection, ClipboardData } from './data.js';
import type { GameItemMeta } from './state.js';

export type IpcCallback<T = void> = (data: T) => void;

export interface ViewSettings {
  viewSolid?: boolean;
  viewOutline?: boolean;
  showBackdrop?: boolean;
  showGrid?: boolean;
  showMaterials?: boolean;
  alwaysDrawDragPoints?: boolean;
  drawLightCenters?: boolean;
  solid?: boolean;
  outline?: boolean;
  grid?: boolean;
  backdrop?: boolean;
}

export interface PanelSettings {
  toolboxWidth?: number;
  rightPanelWidth?: number;
  layersHeight?: number;
}

export interface EditorSettings {
  elementSelectColor?: string;
  elementSelectLockedColor?: string;
  elementFillColor?: string;
  tableBackgroundColor?: string;
  defaultMaterialColor?: string;
  unitConversion?: string;
  gridSize?: number;
  editorColors?: {
    defaultMaterial?: string;
    elementSelect?: string;
    elementSelectLocked?: string;
    elementFill?: string;
    tableBackground?: string;
  };
  alwaysDrawDragPoints?: boolean;
  drawLightCenters?: boolean;
  vpinballPath?: string;
  theme?: string;
  textureQuality?: number;
}

export interface TableInfoFormData {
  info: TableInfo;
  screenshot: string;
  originalScreenshot: string;
}

export type DrawingOrderMode = 'select' | 'hit';

export interface DrawingOrderItem {
  _type?: string;
  name: string;
  height_top?: number;
  height?: number;
  hit_accuracy?: number;
  position?: { x: number; y: number; z?: number };
  drawingIndex?: number;
  [key: string]: unknown;
}

export interface DrawingOrderSaveData {
  mode: 'select' | 'hit';
  items: DrawingOrderItem[];
}

export interface DrawingOrderInitData {
  mode?: 'select' | 'hit';
  items?: DrawingOrderItem[];
}

export interface TableInfoInitData {
  info?: TableInfo;
  gamedata?: { screen_shot?: string };
  images?: { name: string }[];
}

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface WriteResult {
  success: boolean;
  error?: string;
}

export interface RenameResult {
  success: boolean;
  error?: string;
}

export interface ConsoleSettings {
  visible?: boolean;
  height?: number;
}

export interface ConsoleOutputData {
  text: string;
  type: string;
}

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string;
  redoDescription?: string;
}

export interface ClipboardState {
  hasSelection: boolean;
  hasClipboard: boolean;
  isLocked: boolean;
}

export interface LoadingState {
  show: boolean;
  message?: string;
}

export interface AboutData {
  version: string;
  platform: 'Web' | 'Desktop';
  electronVersion?: string;
  nodeVersion?: string;
  chromeVersion?: string;
}

export interface VpxEditorAPI {
  onTableLoaded: (callback: IpcCallback<TableLoadedData>) => void;
  onTableClosed: (callback: IpcCallback) => void;
  onExtractedDirChanged: (callback: IpcCallback<string>) => void;
  onLoading: (callback: IpcCallback<LoadingState>) => void;
  onStatus: (callback: IpcCallback<string>) => void;
  onZoomIn: (callback: IpcCallback) => void;
  onZoomOut: (callback: IpcCallback) => void;
  onSetTheme: (callback: IpcCallback<string>) => void;
  onSelectItem: (callback: IpcCallback<string>) => void;
  onSelectItems: (callback: IpcCallback<string[]>) => void;
  notifySelectionChanged: (selectedItems: string[]) => void;
  notifyCollectionsChanged: (collections: Collection[], selectCollection: string | null) => void;
  onSelectionChanged: (callback: IpcCallback<string[]>) => void;
  onRequestSelectionResend: (callback: IpcCallback) => void;
  onCollectionCreateFromSelectionRequest: (callback: IpcCallback) => void;
  onImagesChanged: (callback: IpcCallback) => void;
  onMaterialsChanged: (callback: IpcCallback) => void;
  refreshImageManager: () => void;
  refreshMaterialManager: () => void;
  openMaterialManager: (materialName?: string) => void;
  refreshSoundManager: () => void;
  onSoundsChanged: (callback: IpcCallback) => void;
  onInfoChanged: (callback: IpcCallback<TableInfo>) => void;
  onGamedataChanged: (callback: IpcCallback<GameData>) => void;
  onGameitemsChanged: (callback: IpcCallback<GameItemMeta[]>) => void;
  onScriptChanged: (callback: IpcCallback) => void;
  onViewSettingsChanged: (callback: IpcCallback<ViewSettings>) => void;
  onToggleBackglassView: (callback: IpcCallback<boolean>) => void;
  onTableLockChanged: (callback: IpcCallback<boolean>) => void;
  toggleTableLock: () => void;
  onShowCloseConfirm: (callback: IpcCallback) => void;
  closeConfirmResult: (result: boolean) => void;
  onInsertItem: (callback: IpcCallback<string>) => void;
  onShowInfoModal: (callback: IpcCallback<{ title: string; message: string }>) => void;
  infoModalResult: () => void;
  onMeshImported: (
    callback: IpcCallback<{ fileName: string; meshData: string; options?: { importMaterial?: boolean } }>
  ) => void;
  onUndo: (callback: IpcCallback) => void;
  onRedo: (callback: IpcCallback) => void;
  onCut: (callback: IpcCallback) => void;
  onCopy: (callback: IpcCallback) => void;
  onPaste: (callback: IpcCallback) => void;
  onPasteAtOriginal: (callback: IpcCallback) => void;
  onToggleLock: (callback: IpcCallback) => void;
  onDeleteSelected: (callback: IpcCallback) => void;
  onSelectAll: (callback: IpcCallback) => void;
  onUndoBegin: (callback: IpcCallback<string>) => void;
  onUndoEnd: (callback: IpcCallback) => void;
  onUndoCancel: (callback: IpcCallback) => void;
  onUndoMarkImages: (callback: IpcCallback) => void;
  onUndoMarkImageCreate: (callback: IpcCallback<string>) => void;
  onUndoMarkImageDelete: (callback: (imageName: string, imageData: unknown, filePath: string) => void) => void;
  onUndoMarkMaterials: (callback: IpcCallback) => void;
  onUndoMarkMaterialCreate: (callback: IpcCallback<string>) => void;
  onUndoMarkMaterialDelete: (callback: (materialName: string, materialData: unknown) => void) => void;
  onUndoMarkSounds: (callback: IpcCallback) => void;
  onUndoMarkSoundCreate: (callback: IpcCallback<string>) => void;
  onUndoMarkSoundDelete: (callback: (soundName: string, soundData: unknown, filePath: string) => void) => void;
  onUndoMarkRenderProbes: (callback: IpcCallback) => void;
  onUndoMarkRenderProbeCreate: (callback: IpcCallback<string>) => void;
  onUndoMarkRenderProbeDelete: (callback: (probeName: string, probeData: unknown) => void) => void;
  onRenderProbesChanged: (callback: IpcCallback) => void;
  onUndoMarkForUndo: (callback: IpcCallback<string>) => void;
  onUndoMarkGamedata: (callback: IpcCallback) => void;
  onUndoMarkInfo: (callback: IpcCallback) => void;
  onUndoMarkGameitemsList: (callback: IpcCallback) => void;
  onUndoMarkCollections: (callback: IpcCallback) => void;

  getTheme: () => Promise<string>;
  getViewSettings: () => Promise<ViewSettings>;
  saveViewSettings: (settings: Partial<ViewSettings>) => Promise<void>;
  getPanelSettings: () => Promise<PanelSettings>;
  savePanelSettings: (settings: PanelSettings) => Promise<void>;
  readFile: (filePath: string) => Promise<FileResult>;
  readBinaryFile: (
    filePath: string
  ) => Promise<{ success: boolean; data?: Buffer | Uint8Array | number[]; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<WriteResult>;
  listDir: (dirPath: string) => Promise<string[]>;
  getImageInfo: (imagePath: string) => Promise<{ width: number; height: number }>;
  importImage: () => Promise<{ name: string; path: string } | null>;
  exportImage: (srcPath: string, suggestedName: string) => Promise<string | null>;
  deleteFile: (filePath: string) => Promise<WriteResult>;
  renameFile: (oldPath: string, newPath: string) => Promise<RenameResult>;
  importMesh: (primitiveFileName: string) => Promise<void>;
  browseObjFile: () => Promise<string | null>;
  meshImportResult: (result: { meshData: string } | null) => void;
  onShowAbout: (callback: IpcCallback<AboutData>) => void;
  onInitSettings: (callback: IpcCallback<EditorSettings>) => void;
  onThemeChanged: (callback: IpcCallback<string>) => void;
  previewTheme: (theme: string) => void;
  restoreTheme: (theme?: string) => void;
  onShowCollectionManager: (callback: IpcCallback) => void;
  onShowTableInfo: (callback: IpcCallback<TableInfo>) => void;
  saveTableInfo: (data: TableInfo) => Promise<void>;
  onInitDrawingOrder: (callback: IpcCallback<DrawingOrderInitData>) => void;
  saveDrawingOrder: (data: DrawingOrderSaveData) => void;
  drawingOrderCancel: () => void;
  onRequestDrawingOrderData: (callback: IpcCallback<string>) => void;
  sendDrawingOrderData: (data: { mode?: string; items: DrawingOrderItem[] }) => void;
  undoBegin: (description: string) => void;
  undoEnd: () => void;
  markDirty: () => void;
  markClean: () => void;
  onMarkSavePoint: (callback: IpcCallback) => void;
  recordScriptChange: (before: string, after: string) => void;
  onRecordScriptChange: (callback: (before: string, after: string) => void) => void;
  notifyScriptUndone: () => void;
  undoMarkInfo: () => void;
  undoMarkGamedata: () => void;
  undoMarkGameitemsList: () => void;
  browseExecutable: (name: string) => Promise<string | null>;
  checkFileExists: (filePath: string) => Promise<{ valid: boolean; error?: string }>;
  saveSettings: (settings: EditorSettings) => Promise<void>;
  resetWindowBounds: () => void;
  onGridSizeChanged: (callback: IpcCallback<number>) => void;
  getGridSize: () => Promise<number>;
  onTextureQualityChanged: (callback: IpcCallback<string>) => void;
  getTextureQuality: () => Promise<number>;
  notifyBackglassViewChanged: (enabled: boolean) => void;
  getEditorSettings: () => Promise<EditorSettings>;
  onEditorSettingsChanged: (callback: IpcCallback<EditorSettings>) => void;
  exportMesh: (primitiveFileName: string, suggestedName: string) => Promise<string | null>;
  playTable: () => Promise<void>;
  onPlayStarted: (callback: IpcCallback) => void;
  onPlayStopped: (callback: IpcCallback) => void;
  onConsoleOpen: (callback: IpcCallback) => void;
  onConsoleOutput: (callback: IpcCallback<ConsoleOutputData>) => void;
  onToggleConsole: (callback: IpcCallback) => void;
  stopPlay: () => Promise<void>;
  getConsoleSettings: () => Promise<ConsoleSettings>;
  saveConsoleSettings: (settings: ConsoleSettings) => Promise<void>;
  getVersion: () => Promise<string>;
  isWeb: () => boolean;
  isElectron: () => boolean;
  getExtractedDir: () => Promise<string>;
  getTableName: () => Promise<string>;
  saveTheme: (theme: string) => Promise<void>;
  writeBinaryFile: (filePath: string, content: Uint8Array) => Promise<WriteResult>;
  getGamedata: () => Promise<GameData | null>;
  saveGamedata: (gamedata: GameData) => Promise<void>;
  getInfo: () => Promise<TableInfo | null>;
  saveInfo: (info: TableInfo) => Promise<void>;
  getImages: () => Promise<{ name: string; path?: string }[]>;
  getMaterials: () => Promise<Record<string, unknown>>;
  saveMaterials: (materials: Record<string, unknown>) => Promise<void>;
  getSounds: () => Promise<{ name: string; path?: string }[]>;
  getCollections: () => Promise<Collection[]>;
  saveCollections: (collections: Collection[]) => Promise<void>;
  getGameitemsIndex: () => Promise<{ file_name: string }[]>;
  updateUndoState: (state: UndoState) => void;
  updateClipboardState: (state: ClipboardState) => void;
  onToggleMagnify: (callback: IpcCallback) => void;
  notify3DModeChanged: (enabled: boolean) => void;
  toggleScriptEditor: () => void;
  onScriptEditorOpened: (callback: IpcCallback) => void;
  onScriptEditorClosed: (callback: IpcCallback) => void;
  setClipboardData: (data: ClipboardData) => Promise<void>;
  getClipboardData: () => Promise<ClipboardData | null>;
  hasClipboardData: () => Promise<boolean>;

  collectionCreate: (name: string, items: string[]) => void;
  collectionDelete: (name: string) => void;
  collectionRename: (oldName: string, newName: string) => void;
  collectionAddItems: (name: string, items: string[]) => void;
  collectionRemoveItems: (name: string, items: string[]) => void;
  collectionReorder: (names: string[]) => void;

  openTransform: (
    type: string,
    options: { centerX: number; centerY: number; mouseX?: number; mouseY?: number }
  ) => void;
  onInitTransform: (callback: IpcCallback<{ items: string[]; type?: string }>) => void;
  applyTransform: (data: TransformData) => void;
  saveTransform: (data: TransformData) => void;
  cancelTransform: () => void;
  undoTransform: () => void;

  onInitCollectionManager: (callback: IpcCallback<{ collections: Collection[] }>) => void;
  onCollectionsChanged: (callback: IpcCallback<Collection[]>) => void;
  onSetDisabled: (callback: IpcCallback<boolean>) => void;
  onSetEditorOpen: (callback: IpcCallback<boolean>) => void;
  openCollectionEditor: (name: string) => void;
  openCollectionPrompt: (mode: string, name: string | null) => void;
  openMaterialEditor?: (
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ) => void;
  onMaterialEditorResult?: (callback: (result: Record<string, unknown> | null) => void) => void;
  collectionCreateFromSelection: () => void;
  collectionMoveUp: (name: string) => void;
  collectionMoveDown: (name: string) => void;

  onInitTableInfo: (callback: IpcCallback<TableInfoInitData>) => void;
  saveTableInfoWindow: (data: TableInfoFormData) => void;
  cancelTableInfo: () => void;

  onInitAbout: (callback: IpcCallback<AboutData>) => void;
  onInitPrompt: (
    callback: IpcCallback<{
      title: string;
      message?: string;
      placeholder?: string;
      defaultValue?: string;
      currentValue?: string;
      existingNames?: string[];
      maxLength?: number;
      emptyError?: string;
      existsError?: string;
    }>
  ) => void;
  promptResult: (result: string | null) => void;
  onInitInfo: (callback: IpcCallback<{ title: string; message: string }>) => void;

  onInitCollectionEditor: (
    callback: IpcCallback<{
      collectionName: string;
      includedItems: string[];
      availableItems: string[];
      existingNames: string[];
      fireEvents: boolean;
      stopSingle: boolean;
      groupElements: boolean;
    }>
  ) => void;
  collectionEditorSave: (data: {
    originalName: string;
    newName?: string;
    items: string[];
    fire_events: boolean;
    stop_single_events: boolean;
    group_elements: boolean;
  }) => void;
  collectionEditorCancel: () => void;

  onInitMaterialEditor?: (
    callback: IpcCallback<{
      material: Record<string, unknown>;
      mode: 'new' | 'clone';
      existingNames: string[];
      originalName: string;
    }>
  ) => void;
  materialEditorSave?: (data: Record<string, unknown>) => void;
  materialEditorCancel?: () => void;

  showRenameDialog: (data: {
    mode: 'table' | 'element' | 'partgroup';
    currentName: string;
    existingNames: string[];
    elementType?: string;
  }) => void;

  exportBlueprint?: (data: number[], filename: string) => Promise<boolean>;
  onExportBlueprint?: (callback: IpcCallback<{ solid: boolean; isBackglass: boolean }>) => void;
  onApplyTransform?: (callback: IpcCallback<TransformData>) => void;
  onUndoTransform?: (callback: IpcCallback) => void;
  onSaveTransform?: (callback: IpcCallback<{ type: string }>) => void;
  onCancelTransform?: (callback: IpcCallback) => void;
  onSetInputDisabled?: (callback: IpcCallback<boolean>) => void;
  onRenameSubmitted?: (callback: IpcCallback<{ mode: string; oldName: string; newName: string }>) => void;
}

export interface TransformData {
  type: 'rotate' | 'scale' | 'translate';
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
  useOrigin?: boolean;
  centerX?: number;
  centerY?: number;
}

declare global {
  interface Window {
    vpxEditor: VpxEditorAPI;
  }
}
