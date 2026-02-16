import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  VpxEditorAPI,
  ViewSettings,
  PanelSettings,
  EditorSettings,
  ConsoleSettings,
  ConsoleOutputData,
  UndoState,
  ClipboardState,
  LoadingState,
  AboutData,
  TransformData,
  DrawingOrderInitData,
  DrawingOrderSaveData,
  DrawingOrderItem,
  TableInfoInitData,
  TableInfoFormData,
} from '../types/ipc.js';
import type { GameData, TableInfo, Collection, ClipboardData, TableLoadedData } from '../types/data.js';
import type { GameItemMeta } from '../types/state.js';

const vpxEditorAPI: VpxEditorAPI = {
  onTableLoaded: (callback: (data: TableLoadedData) => void): void => {
    ipcRenderer.on('table-loaded', (_event: IpcRendererEvent, data: TableLoadedData) => callback(data));
  },
  onTableClosed: (callback: () => void): void => {
    ipcRenderer.on('table-closed', () => callback());
  },
  onExtractedDirChanged: (callback: (dir: string) => void): void => {
    ipcRenderer.on('extracted-dir-changed', (_event: IpcRendererEvent, dir: string) => callback(dir));
  },
  onLoading: (callback: (data: LoadingState) => void): void => {
    ipcRenderer.on('loading', (_event: IpcRendererEvent, data: LoadingState) => callback(data));
  },
  onStatus: (callback: (message: string) => void): void => {
    ipcRenderer.on('status', (_event: IpcRendererEvent, message: string) => callback(message));
  },
  onZoomIn: (callback: () => void): void => {
    ipcRenderer.on('zoom-in', () => callback());
  },
  onZoomOut: (callback: () => void): void => {
    ipcRenderer.on('zoom-out', () => callback());
  },
  onSetTheme: (callback: (theme: string) => void): void => {
    ipcRenderer.on('set-theme', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  onSelectItem: (callback: (itemName: string) => void): void => {
    ipcRenderer.on('select-item', (_event: IpcRendererEvent, itemName: string) => callback(itemName));
  },
  onSelectItems: (callback: (itemNames: string[]) => void): void => {
    ipcRenderer.on('select-items', (_event: IpcRendererEvent, itemNames: string[]) => callback(itemNames));
  },
  notifySelectionChanged: (selectedItems: string[]): void => {
    ipcRenderer.send('notify-selection-changed', selectedItems);
  },
  notifyCollectionsChanged: (collections: Collection[], selectCollection: string | null): void => {
    ipcRenderer.send('notify-collections-changed', collections, selectCollection);
  },
  onSelectionChanged: (callback: (selectedItems: string[]) => void): void => {
    ipcRenderer.on('selection-changed', (_event: IpcRendererEvent, selectedItems: string[]) => callback(selectedItems));
  },
  onRequestSelectionResend: (callback: () => void): void => {
    ipcRenderer.on('request-selection-resend', () => callback());
  },
  onCollectionCreateFromSelectionRequest: (callback: () => void): void => {
    ipcRenderer.on('collection-create-from-selection-request', () => callback());
  },
  onImagesChanged: (callback: () => void): void => {
    ipcRenderer.on('images-changed', () => callback());
  },
  onMaterialsChanged: (callback: () => void): void => {
    ipcRenderer.on('materials-changed', () => callback());
  },
  refreshImageManager: (): void => {
    ipcRenderer.send('refresh-image-manager');
  },
  openImageManager: (imageName?: string): void => {
    ipcRenderer.send('open-image-manager-with-selection', imageName);
  },
  refreshMaterialManager: (): void => {
    ipcRenderer.send('refresh-material-manager');
  },
  openMaterialManager: (materialName?: string): void => {
    ipcRenderer.send('open-material-manager-with-selection', materialName);
  },
  refreshSoundManager: (): void => {
    ipcRenderer.send('refresh-sound-manager');
  },
  onSoundsChanged: (callback: () => void): void => {
    ipcRenderer.on('sounds-changed', () => callback());
  },
  onInfoChanged: (callback: (info: TableInfo) => void): void => {
    ipcRenderer.on('info-changed', (_event: IpcRendererEvent, info: TableInfo) => callback(info));
  },
  onGamedataChanged: (callback: (gamedata: GameData) => void): void => {
    ipcRenderer.on('gamedata-changed', (_event: IpcRendererEvent, gamedata: GameData) => callback(gamedata));
  },
  onGameitemsChanged: (callback: (gameitems: GameItemMeta[]) => void): void => {
    ipcRenderer.on('gameitems-changed', (_event: IpcRendererEvent, gameitems: GameItemMeta[]) => callback(gameitems));
  },
  onScriptChanged: (callback: () => void): void => {
    ipcRenderer.on('script-changed', () => callback());
  },
  onViewSettingsChanged: (callback: (settings: ViewSettings) => void): void => {
    ipcRenderer.on('view-settings-changed', (_event: IpcRendererEvent, settings: ViewSettings) => callback(settings));
  },
  onToggleBackglassView: (callback: (enabled: boolean) => void): void => {
    ipcRenderer.on('toggle-backglass-view', (_event: IpcRendererEvent, enabled: boolean) => callback(enabled));
  },
  onTableLockChanged: (callback: (isLocked: boolean) => void): void => {
    ipcRenderer.on('table-lock-changed', (_event: IpcRendererEvent, isLocked: boolean) => callback(isLocked));
  },
  toggleTableLock: (): void => {
    ipcRenderer.send('toggle-table-lock');
  },
  onShowCloseConfirm: (callback: () => void): void => {
    ipcRenderer.on('show-close-confirm', () => callback());
  },
  closeConfirmResult: (result: boolean): void => {
    ipcRenderer.send('close-confirm-result', result);
  },
  onInsertItem: (callback: (itemType: string) => void): void => {
    ipcRenderer.on('insert-item', (_event: IpcRendererEvent, itemType: string) => callback(itemType));
  },
  onShowInfoModal: (callback: (data: { title: string; message: string }) => void): void => {
    ipcRenderer.on('show-info-modal', (_event: IpcRendererEvent, data: { title: string; message: string }) =>
      callback(data)
    );
  },
  infoModalResult: (): void => {
    ipcRenderer.send('info-modal-result');
  },
  onMeshImported: (
    callback: (data: { fileName: string; meshData: string; options?: { importMaterial?: boolean } }) => void
  ): void => {
    ipcRenderer.on(
      'mesh-imported',
      (
        _event: IpcRendererEvent,
        data: { fileName: string; meshData: string; options?: { importMaterial?: boolean } }
      ) => callback(data)
    );
  },
  onUndo: (callback: () => void): void => {
    ipcRenderer.on('undo', () => callback());
  },
  onRedo: (callback: () => void): void => {
    ipcRenderer.on('redo', () => callback());
  },
  onCut: (callback: () => void): void => {
    ipcRenderer.on('cut', () => callback());
  },
  onCopy: (callback: () => void): void => {
    ipcRenderer.on('copy', () => callback());
  },
  onPaste: (callback: () => void): void => {
    ipcRenderer.on('paste', () => callback());
  },
  onPasteAtOriginal: (callback: () => void): void => {
    ipcRenderer.on('paste-at-original', () => callback());
  },
  onToggleLock: (callback: () => void): void => {
    ipcRenderer.on('toggle-lock', () => callback());
  },
  onDeleteSelected: (callback: () => void): void => {
    ipcRenderer.on('delete-selected', () => callback());
  },
  onSelectAll: (callback: () => void): void => {
    ipcRenderer.on('select-all', () => callback());
  },
  onUndoBegin: (callback: (description: string) => void): void => {
    ipcRenderer.on('undo-begin', (_event: IpcRendererEvent, description: string) => callback(description));
  },
  onUndoEnd: (callback: () => void): void => {
    ipcRenderer.on('undo-end', () => callback());
  },
  onUndoCancel: (callback: () => void): void => {
    ipcRenderer.on('undo-cancel', () => callback());
  },
  onUndoMarkImages: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-images', () => callback());
  },
  onUndoMarkImageCreate: (callback: (imageName: string) => void): void => {
    ipcRenderer.on('undo-mark-image-create', (_event: IpcRendererEvent, imageName: string) => callback(imageName));
  },
  onUndoMarkImageDelete: (callback: (imageName: string, imageData: unknown, filePath: string) => void): void => {
    ipcRenderer.on(
      'undo-mark-image-delete',
      (_event: IpcRendererEvent, imageName: string, imageData: unknown, filePath: string) =>
        callback(imageName, imageData, filePath)
    );
  },
  onUndoMarkMaterials: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-materials', () => callback());
  },
  onUndoMarkMaterialCreate: (callback: (materialName: string) => void): void => {
    ipcRenderer.on('undo-mark-material-create', (_event: IpcRendererEvent, materialName: string) =>
      callback(materialName)
    );
  },
  onUndoMarkMaterialDelete: (callback: (materialName: string, materialData: unknown) => void): void => {
    ipcRenderer.on(
      'undo-mark-material-delete',
      (_event: IpcRendererEvent, materialName: string, materialData: unknown) => callback(materialName, materialData)
    );
  },
  onUndoMarkSounds: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-sounds', () => callback());
  },
  onUndoMarkSoundCreate: (callback: (soundName: string) => void): void => {
    ipcRenderer.on('undo-mark-sound-create', (_event: IpcRendererEvent, soundName: string) => callback(soundName));
  },
  onUndoMarkSoundDelete: (callback: (soundName: string, soundData: unknown, filePath: string) => void): void => {
    ipcRenderer.on(
      'undo-mark-sound-delete',
      (_event: IpcRendererEvent, soundName: string, soundData: unknown, filePath: string) =>
        callback(soundName, soundData, filePath)
    );
  },
  onUndoMarkRenderProbes: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-renderprobes', () => callback());
  },
  onUndoMarkRenderProbeCreate: (callback: (probeName: string) => void): void => {
    ipcRenderer.on('undo-mark-renderprobe-create', (_event: IpcRendererEvent, probeName: string) =>
      callback(probeName)
    );
  },
  onUndoMarkRenderProbeDelete: (callback: (probeName: string, probeData: unknown) => void): void => {
    ipcRenderer.on('undo-mark-renderprobe-delete', (_event: IpcRendererEvent, probeName: string, probeData: unknown) =>
      callback(probeName, probeData)
    );
  },
  onRenderProbesChanged: (callback: () => void): void => {
    ipcRenderer.on('renderprobes-changed', () => callback());
  },
  onUndoMarkForUndo: (callback: (itemName: string) => void): void => {
    ipcRenderer.on('undo-mark-for-undo', (_event: IpcRendererEvent, itemName: string) => callback(itemName));
  },
  onUndoMarkGamedata: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-gamedata', () => callback());
  },
  onUndoMarkInfo: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-info', () => callback());
  },
  onUndoMarkGameitemsList: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-gameitems-list', () => callback());
  },
  onUndoMarkCollections: (callback: () => void): void => {
    ipcRenderer.on('undo-mark-collections', () => callback());
  },
  getTheme: (): Promise<string> => ipcRenderer.invoke('get-theme'),
  getViewSettings: (): Promise<ViewSettings> => ipcRenderer.invoke('get-view-settings'),
  saveViewSettings: (settings: Partial<ViewSettings>): Promise<void> =>
    ipcRenderer.invoke('save-view-settings', settings),
  getPanelSettings: (): Promise<PanelSettings> => ipcRenderer.invoke('get-panel-settings'),
  savePanelSettings: (settings: PanelSettings): Promise<void> => ipcRenderer.invoke('save-panel-settings', settings),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readBinaryFile: (filePath: string) => ipcRenderer.invoke('read-binary-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  listDir: (dirPath: string): Promise<string[]> => ipcRenderer.invoke('list-dir', dirPath),
  getImageInfo: (imagePath: string) => ipcRenderer.invoke('get-image-info', imagePath),
  importImage: () => ipcRenderer.invoke('import-image'),
  exportImage: (srcPath: string, suggestedName: string) => ipcRenderer.invoke('export-image', srcPath, suggestedName),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  importMesh: (primitiveFileName: string): Promise<void> => ipcRenderer.invoke('import-mesh', primitiveFileName),
  browseObjFile: (): Promise<string | null> => ipcRenderer.invoke('browse-obj-file'),
  meshImportResult: (result: { meshData: string } | null): void => {
    ipcRenderer.send('mesh-import-result', result);
  },
  onShowAbout: (callback: (data: AboutData) => void): void => {
    ipcRenderer.on('show-about', (_event: IpcRendererEvent, data: AboutData) => callback(data));
  },
  onInitSettings: (callback: (data: EditorSettings) => void): void => {
    ipcRenderer.on('init-settings', (_event: IpcRendererEvent, data: EditorSettings) => callback(data));
  },
  onThemeChanged: (callback: (theme: string) => void): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  previewTheme: (theme: string): void => {
    ipcRenderer.send('preview-theme', theme);
  },
  restoreTheme: (theme?: string): void => {
    ipcRenderer.send('restore-theme', theme);
  },
  onShowCollectionManager: (callback: () => void): void => {
    ipcRenderer.on('show-collection-manager', () => callback());
  },
  onShowTableInfo: (callback: (data: TableInfo) => void): void => {
    ipcRenderer.on('show-table-info', (_event: IpcRendererEvent, data: TableInfo) => callback(data));
  },
  saveTableInfo: (data: TableInfo): Promise<void> => ipcRenderer.invoke('save-table-info', data),
  onInitDrawingOrder: (callback: (data: DrawingOrderInitData) => void): void => {
    ipcRenderer.on('init-drawing-order', (_event: IpcRendererEvent, data: DrawingOrderInitData) => callback(data));
  },
  saveDrawingOrder: (data: DrawingOrderSaveData): void => {
    ipcRenderer.send('save-drawing-order', data);
  },
  drawingOrderCancel: (): void => {
    ipcRenderer.send('drawing-order-cancel');
  },
  onRequestDrawingOrderData: (callback: (mode: string) => void): void => {
    ipcRenderer.on('request-drawing-order-data', (_event: IpcRendererEvent, mode: string) => callback(mode));
  },
  sendDrawingOrderData: (data: { mode?: string; items: DrawingOrderItem[] }): void => {
    ipcRenderer.send('drawing-order-data', data);
  },
  undoBegin: (description: string): void => {
    ipcRenderer.send('undo-begin', description);
  },
  undoEnd: (): void => {
    ipcRenderer.send('undo-end');
  },
  markDirty: (): void => {
    ipcRenderer.send('mark-dirty');
  },
  markClean: (): void => {
    ipcRenderer.send('mark-clean');
  },
  onMarkSavePoint: (callback: () => void): void => {
    ipcRenderer.on('mark-save-point', () => callback());
  },
  recordScriptChange: (before: string, after: string): void => {
    ipcRenderer.send('record-script-change', before, after);
  },
  onRecordScriptChange: (callback: (before: string, after: string) => void): void => {
    ipcRenderer.on('record-script-change', (_event: IpcRendererEvent, before: string, after: string) =>
      callback(before, after)
    );
  },
  notifyScriptUndone: (): void => {
    ipcRenderer.send('script-undone');
  },
  undoMarkInfo: (): void => {
    ipcRenderer.send('undo-mark-info');
  },
  undoMarkGamedata: (): void => {
    ipcRenderer.send('undo-mark-gamedata');
  },
  undoMarkGameitemsList: (): void => {
    ipcRenderer.send('undo-mark-gameitems-list');
  },
  browseExecutable: (name: string): Promise<string | null> => ipcRenderer.invoke('browse-executable', name),
  checkFileExists: (filePath: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('check-file-exists', filePath),
  saveSettings: (settings: EditorSettings): Promise<void> => ipcRenderer.invoke('save-settings', settings),
  resetWindowBounds: (): void => {
    ipcRenderer.send('reset-window-bounds');
  },
  onGridSizeChanged: (callback: (gridSize: number) => void): void => {
    ipcRenderer.on('grid-size-changed', (_event: IpcRendererEvent, gridSize: number) => callback(gridSize));
  },
  getGridSize: (): Promise<number> => ipcRenderer.invoke('get-grid-size'),
  onTextureQualityChanged: (callback: (quality: string) => void): void => {
    ipcRenderer.on('texture-quality-changed', (_event: IpcRendererEvent, quality: string) => callback(quality));
  },
  getTextureQuality: (): Promise<number> => ipcRenderer.invoke('get-texture-quality'),
  notifyBackglassViewChanged: (enabled: boolean): void => {
    ipcRenderer.send('backglass-view-changed', enabled);
  },
  getEditorSettings: (): Promise<EditorSettings> => ipcRenderer.invoke('get-editor-settings'),
  onEditorSettingsChanged: (callback: (settings: EditorSettings) => void): void => {
    ipcRenderer.on('editor-settings-changed', (_event: IpcRendererEvent, settings: EditorSettings) =>
      callback(settings)
    );
  },
  exportMesh: (primitiveFileName: string, suggestedName: string) =>
    ipcRenderer.invoke('export-mesh', primitiveFileName, suggestedName),
  playTable: (): Promise<void> => ipcRenderer.invoke('play-table'),
  onPlayStarted: (callback: () => void): void => {
    ipcRenderer.on('play-started', () => callback());
  },
  onPlayStopped: (callback: () => void): void => {
    ipcRenderer.on('play-stopped', () => callback());
  },
  onConsoleOpen: (callback: () => void): void => {
    ipcRenderer.on('console-open', () => callback());
  },
  onConsoleOutput: (callback: (data: ConsoleOutputData) => void): void => {
    ipcRenderer.on('console-output', (_event: IpcRendererEvent, data: ConsoleOutputData) => callback(data));
  },
  onToggleConsole: (callback: () => void): void => {
    ipcRenderer.on('toggle-console', () => callback());
  },
  stopPlay: (): Promise<void> => ipcRenderer.invoke('stop-play'),
  getConsoleSettings: (): Promise<ConsoleSettings> => ipcRenderer.invoke('get-console-settings'),
  saveConsoleSettings: (settings: ConsoleSettings): Promise<void> =>
    ipcRenderer.invoke('save-console-settings', settings),
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version'),
  isWeb: (): boolean => false,
  isElectron: (): boolean => true,
  getExtractedDir: (): Promise<string> => ipcRenderer.invoke('get-extracted-dir'),
  getTableName: (): Promise<string> => ipcRenderer.invoke('get-table-name'),
  saveTheme: (theme: string): Promise<void> => ipcRenderer.invoke('save-theme', theme),
  writeBinaryFile: (filePath: string, content: Uint8Array): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('write-binary-file', filePath, content),
  getGamedata: (): Promise<GameData | null> => ipcRenderer.invoke('get-gamedata'),
  saveGamedata: (gamedata: GameData): Promise<void> => ipcRenderer.invoke('save-gamedata', gamedata),
  getInfo: (): Promise<TableInfo | null> => ipcRenderer.invoke('get-info'),
  saveInfo: (info: TableInfo): Promise<void> => ipcRenderer.invoke('save-info', info),
  getImages: (): Promise<{ name: string; path?: string }[]> => ipcRenderer.invoke('get-images'),
  getMaterials: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('get-materials'),
  saveMaterials: (materials: Record<string, unknown>): Promise<void> => ipcRenderer.invoke('save-materials', materials),
  getSounds: (): Promise<{ name: string; path?: string }[]> => ipcRenderer.invoke('get-sounds'),
  getCollections: (): Promise<Collection[]> => ipcRenderer.invoke('get-collections'),
  saveCollections: (collections: Collection[]): Promise<void> => ipcRenderer.invoke('save-collections', collections),
  getGameitemsIndex: (): Promise<{ file_name: string }[]> => ipcRenderer.invoke('get-gameitems-index'),
  updateUndoState: (state: UndoState): void => {
    ipcRenderer.send('update-undo-state', state);
  },
  updateClipboardState: (state: ClipboardState): void => {
    ipcRenderer.send('update-clipboard-state', state);
  },
  onToggleMagnify: (callback: () => void): void => {
    ipcRenderer.on('toggle-magnify', () => callback());
  },
  notify3DModeChanged: (enabled: boolean): void => {
    ipcRenderer.send('3d-mode-changed', enabled);
  },
  toggleScriptEditor: (): void => {
    ipcRenderer.send('toggle-script-editor');
  },
  onScriptEditorOpened: (callback: () => void): void => {
    ipcRenderer.on('script-editor-opened', () => callback());
  },
  onScriptEditorClosed: (callback: () => void): void => {
    ipcRenderer.on('script-editor-closed', () => callback());
  },
  setClipboardData: (data: ClipboardData): Promise<void> => ipcRenderer.invoke('set-clipboard-data', data),
  getClipboardData: (): Promise<ClipboardData | null> => ipcRenderer.invoke('get-clipboard-data'),
  hasClipboardData: (): Promise<boolean> => ipcRenderer.invoke('has-clipboard-data'),

  collectionCreate: (name: string, items: string[]): void => {
    ipcRenderer.send('collection-create', name, items);
  },
  collectionDelete: (name: string): void => {
    ipcRenderer.send('collection-delete', name);
  },
  collectionRename: (oldName: string, newName: string): void => {
    ipcRenderer.send('collection-rename', oldName, newName);
  },
  collectionAddItems: (name: string, items: string[]): void => {
    ipcRenderer.send('collection-add-items', name, items);
  },
  collectionRemoveItems: (name: string, items: string[]): void => {
    ipcRenderer.send('collection-remove-items', name, items);
  },
  collectionReorder: (names: string[]): void => {
    ipcRenderer.send('collection-reorder', names);
  },

  openTransform: (
    type: string,
    options: { centerX: number; centerY: number; mouseX?: number; mouseY?: number }
  ): void => {
    ipcRenderer.send('open-transform', type, options);
  },
  onInitTransform: (callback: (data: { items: string[]; type?: string }) => void): void => {
    ipcRenderer.on('init-transform', (_event: IpcRendererEvent, data: { items: string[]; type?: string }) =>
      callback(data)
    );
  },
  applyTransform: (data: TransformData): void => {
    ipcRenderer.send('apply-transform', data);
  },
  saveTransform: (data: TransformData): void => {
    ipcRenderer.send('save-transform', data);
  },
  cancelTransform: (): void => {
    ipcRenderer.send('cancel-transform');
  },
  undoTransform: (): void => {
    ipcRenderer.send('undo-transform');
  },

  onInitCollectionManager: (callback: (data: { collections: Collection[] }) => void): void => {
    ipcRenderer.on('init-collection-manager', (_event: IpcRendererEvent, data: { collections: Collection[] }) =>
      callback(data)
    );
  },
  onCollectionsChanged: (callback: (collections: Collection[], selectCollection?: string) => void): void => {
    ipcRenderer.on(
      'collections-changed',
      (_event: IpcRendererEvent, data: { collections: Collection[]; selectCollection?: string }) =>
        callback(data.collections, data.selectCollection)
    );
  },
  onSetDisabled: (callback: (disabled: boolean) => void): void => {
    ipcRenderer.on('set-disabled', (_event: IpcRendererEvent, disabled: boolean) => callback(disabled));
  },
  onSetEditorOpen: (callback: (isOpen: boolean) => void): void => {
    ipcRenderer.on('set-editor-open', (_event: IpcRendererEvent, isOpen: boolean) => callback(isOpen));
  },
  openCollectionEditor: (name: string): void => {
    ipcRenderer.send('open-collection-editor', name);
  },
  openCollectionPrompt: (mode: string, name: string | null): void => {
    ipcRenderer.send('open-collection-prompt', mode, name);
  },
  openMaterialEditor: (
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ): void => {
    ipcRenderer.send('open-material-editor', { material, mode, existingNames, originalName });
  },
  onMaterialEditorResult: (callback: (result: Record<string, unknown> | null) => void): void => {
    ipcRenderer.on('material-editor-result', (_event: IpcRendererEvent, result) => callback(result));
  },
  collectionCreateFromSelection: (): void => {
    ipcRenderer.send('collection-create-from-selection');
  },
  collectionMoveUp: (name: string): void => {
    ipcRenderer.send('collection-move-up', name);
  },
  collectionMoveDown: (name: string): void => {
    ipcRenderer.send('collection-move-down', name);
  },

  onInitTableInfo: (callback: (data: TableInfoInitData) => void): void => {
    ipcRenderer.on('init-table-info', (_event: IpcRendererEvent, data: TableInfoInitData) => callback(data));
  },
  saveTableInfoWindow: (data: TableInfoFormData): void => {
    ipcRenderer.send('save-table-info-window', data);
  },
  cancelTableInfo: (): void => {
    ipcRenderer.send('cancel-table-info');
  },

  onInitAbout: (callback: (data: AboutData) => void): void => {
    ipcRenderer.on('init-about', (_event: IpcRendererEvent, data: AboutData) => callback(data));
  },
  onInitPrompt: (
    callback: (data: {
      title: string;
      message?: string;
      placeholder?: string;
      defaultValue?: string;
      currentValue?: string;
      existingNames?: string[];
      maxLength?: number;
      emptyError?: string;
      existsError?: string;
    }) => void
  ): void => {
    ipcRenderer.on('init-prompt', (_event: IpcRendererEvent, data) => callback(data));
  },
  promptResult: (result: string | null): void => {
    ipcRenderer.send('prompt-result', result);
  },
  onInitInfo: (callback: (data: { title: string; message: string }) => void): void => {
    ipcRenderer.on('init-info', (_event: IpcRendererEvent, data: { title: string; message: string }) => callback(data));
  },
  onInitCollectionEditor: (
    callback: (data: {
      collectionName: string;
      includedItems: string[];
      availableItems: string[];
      existingNames: string[];
      fireEvents: boolean;
      stopSingle: boolean;
      groupElements: boolean;
    }) => void
  ): void => {
    ipcRenderer.on('init-collection-editor', (_event: IpcRendererEvent, data) => callback(data));
  },
  collectionEditorSave: (data: {
    originalName: string;
    newName?: string;
    items: string[];
    fire_events: boolean;
    stop_single_events: boolean;
    group_elements: boolean;
  }): void => {
    ipcRenderer.send('collection-editor-save', data);
  },
  collectionEditorCancel: (): void => {
    ipcRenderer.send('collection-editor-cancel');
  },

  onInitMaterialEditor: (
    callback: (data: {
      material: Record<string, unknown>;
      mode: 'new' | 'clone';
      existingNames: string[];
      originalName: string;
    }) => void
  ): void => {
    ipcRenderer.on('init-material-editor', (_event: IpcRendererEvent, data) => callback(data));
  },
  materialEditorSave: (data: Record<string, unknown>): void => {
    ipcRenderer.send('material-editor-save', data);
  },
  materialEditorCancel: (): void => {
    ipcRenderer.send('material-editor-cancel');
  },

  showRenameDialog: (data: {
    mode: 'table' | 'element' | 'partgroup';
    currentName: string;
    existingNames: string[];
    elementType?: string;
  }): void => {
    ipcRenderer.send('show-rename-dialog', data);
  },

  exportBlueprint: (data: number[], filename: string): Promise<boolean> =>
    ipcRenderer.invoke('export-blueprint', data, filename),
  onExportBlueprint: (callback: (data: { solid: boolean; isBackglass: boolean }) => void): void => {
    ipcRenderer.on('export-blueprint', (_event: IpcRendererEvent, data: { solid: boolean; isBackglass: boolean }) =>
      callback(data)
    );
  },
  onApplyTransform: (callback: (data: TransformData) => void): void => {
    ipcRenderer.on('apply-transform', (_event: IpcRendererEvent, data: TransformData) => callback(data));
  },
  onUndoTransform: (callback: () => void): void => {
    ipcRenderer.on('undo-transform', () => callback());
  },
  onSaveTransform: (callback: (data: { type: string }) => void): void => {
    ipcRenderer.on('save-transform', (_event: IpcRendererEvent, data: { type: string }) => callback(data));
  },
  onCancelTransform: (callback: () => void): void => {
    ipcRenderer.on('cancel-transform', () => callback());
  },
  onSetInputDisabled: (callback: (disabled: boolean) => void): void => {
    ipcRenderer.on('set-input-disabled', (_event: IpcRendererEvent, disabled: boolean) => callback(disabled));
  },
  onRenameSubmitted: (callback: (data: { mode: string; oldName: string; newName: string }) => void): void => {
    ipcRenderer.on(
      'rename-submitted',
      (_event: IpcRendererEvent, data: { mode: string; oldName: string; newName: string }) => callback(data)
    );
  },
};

contextBridge.exposeInMainWorld('vpxEditor', vpxEditorAPI);
