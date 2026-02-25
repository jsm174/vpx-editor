import type { VpxEditorAPI } from '../types/ipc.js';
import type { ClipboardData } from '../types/data.js';
import { markDirty, markClean } from './state.js';

declare const __APP_VERSION__: string;

const events = window.__vpxEvents;

let clipboardStore: ClipboardData | null = null;

const noop = () => {};

export const vpxEditorAPI = {
  onTableLoaded: (cb: Function) => events.on('table-loaded', cb),
  onTableClosed: (cb: Function) => events.on('table-closed', cb),
  onSelectItem: (cb: Function) => events.on('select-item', cb),
  onSelectItems: (cb: Function) => events.on('select-items', cb),
  onSelectionChanged: (cb: Function) => events.on('selection-changed', cb),
  onUndo: (cb: Function) => events.on('undo', cb),
  onRedo: (cb: Function) => events.on('redo', cb),
  onCut: (cb: Function) => events.on('cut', cb),
  onCopy: (cb: Function) => events.on('copy', cb),
  onPaste: (cb: Function) => events.on('paste', cb),
  onPasteAtOriginal: (cb: Function) => events.on('paste-at-original', cb),
  onDelete: (cb: Function) => events.on('delete-selected', cb),
  onToggleLock: (cb: Function) => events.on('toggle-lock', cb),
  onGameitemsChanged: (cb: Function) => events.on('gameitems-changed', cb),
  onRequestDrawingOrderData: (cb: Function) => events.on('request-drawing-order-data', cb),
  sendDrawingOrderData: (data: { mode: string; items: unknown[] }) => events.emit('drawing-order-data', data),
  onZoomIn: (cb: Function) => events.on('zoom-in', cb),
  onZoomOut: (cb: Function) => events.on('zoom-out', cb),
  onZoomReset: (cb: Function) => events.on('zoom-reset', cb),
  onToggleGrid: (cb: Function) => events.on('toggle-grid', cb),
  onToggleBackdrop: (cb: Function) => events.on('toggle-backdrop', cb),
  onToggleBackglassView: (cb: Function) => events.on('toggle-backglass-view', cb),
  onInsertItem: (cb: Function) => events.on('insert-item', cb),
  onViewSettingsChanged: (cb: Function) => events.on('view-settings-changed', cb),
  onEditorSettingsChanged: (cb: Function) => events.on('editor-settings-changed', cb),
  onImagesChanged: (cb: Function) => events.on('images-changed', cb),
  onMaterialsChanged: (cb: Function) => events.on('materials-changed', cb),
  onSoundsChanged: (cb: Function) => events.on('sounds-changed', cb),
  onCollectionsChanged: (cb: Function) => events.on('collections-changed', cb),
  onGamedataChanged: (cb: Function) => events.on('gamedata-changed', cb),
  onInfoChanged: (cb: Function) => events.on('info-changed', cb),
  onConsoleOpen: (cb: Function) => events.on('console-open', cb),
  onConsoleOutput: (cb: Function) => events.on('console-output', cb),
  onToggleConsole: (cb: Function) => events.on('toggle-console', cb),
  onLoading: (cb: Function) => events.on('loading', cb),
  onStatus: (cb: Function) => events.on('status', cb),
  onApplyTransform: (cb: Function) => events.on('apply-transform', cb),
  onUndoTransform: (cb: Function) => events.on('undo-transform', cb),
  onSaveTransform: (cb: Function) => events.on('save-transform', cb),
  onCancelTransform: (cb: Function) => events.on('cancel-transform', cb),
  onMeshImported: (cb: Function) => events.on('mesh-imported', cb),
  onScriptEditorOpened: (cb: Function) => events.on('script-editor-opened', cb),
  onScriptEditorClosed: (cb: Function) => events.on('script-editor-closed', cb),
  onToggleScriptEditor: (cb: Function) => events.on('toggle-script-editor', cb),
  onToggleMagnify: (cb: Function) => events.on('toggle-magnify', cb),
  onSetTheme: (cb: Function) => events.on('set-theme', cb),
  onPlayStarted: (cb: Function) => events.on('play-started', cb),
  onPlayStopped: (cb: Function) => events.on('play-stopped', cb),
  onExtractedDirChanged: (cb: Function) => events.on('extracted-dir-changed', cb),
  onMarkSavePoint: (cb: Function) => events.on('mark-save-point', cb),
  onSetInputDisabled: (cb: Function) => events.on('set-input-disabled', cb),
  onShowInfoModal: (cb: Function) => events.on('show-info-modal', cb),
  onTableLockChanged: (cb: Function) => events.on('table-lock-changed', cb),
  onThemeChanged: (cb: Function) => events.on('theme-changed', cb),
  onRenameSubmitted: (cb: Function) => events.on('rename-submitted', cb),
  onRequestSelectionResend: (cb: Function) => events.on('request-selection-resend', cb),

  readFile: async (_path: string) => ({ success: false, error: 'Not initialized' }),
  readBinaryFile: async (_path: string) => ({ success: false, error: 'Not initialized' }),
  writeFile: async (_path: string, _content: string) => ({ success: false, error: 'Not initialized' }),
  writeBinaryFile: async (_path: string, _content: Uint8Array) => ({ success: false, error: 'Not initialized' }),
  listDir: async (_path: string) => ({ success: false, error: 'Not initialized', files: [] }),
  deleteFile: async (_path: string) => ({ success: false, error: 'Not initialized' }),
  renameFile: async (_oldPath: string, _newPath: string) => ({ success: false, error: 'Not initialized' }),
  checkFileExists: async (_path: string) => ({ valid: false, error: 'Not supported in web' }),

  getExtractedDir: async () => '/vpx-work',
  getTableName: async () => 'table',

  getTheme: async () => 'dark',
  previewTheme: (_theme: string) => {},
  restoreTheme: async () => {},
  saveTheme: async (_theme: string) => {},

  getViewSettings: async () => ({ solid: true, outline: false, grid: true, backdrop: true }),
  saveViewSettings: async (_settings: Record<string, unknown>) => {},
  getGridSize: async () => 50,
  getTextureQuality: async () => 2048,
  getEditorSettings: async () => ({ unitConversion: 'vpu' }),
  saveSettings: async (_settings: Record<string, unknown>) => {},
  getPanelSettings: async () => ({}),
  savePanelSettings: async (_settings: Record<string, unknown>) => {},
  getConsoleSettings: async () => ({ pinned: false }),
  saveConsoleSettings: async (_settings: Record<string, unknown>) => {},

  undoBegin: noop,
  undoEnd: noop,
  markDirty,
  markClean,

  notifySelectionChanged: (_items: string[]) => {},
  notifyCollectionsChanged: (_collections: unknown[], _deletedNames: string[] | null) => {},

  getImageInfo: async (_path: string) => ({ success: false, error: 'Not initialized' }),
  importImage: async () => ({ success: false, error: 'Not implemented in web version' }),
  exportImage: async () => ({ success: false, error: 'Not implemented in web version' }),

  playTable: async () => {},
  stopPlay: async () => {},

  getVersion: async () => __APP_VERSION__,

  isWeb: () => true,
  isElectron: () => false,

  hasClipboardData: async () => clipboardStore !== null && clipboardStore.items.length > 0,
  getClipboardData: async () => clipboardStore,
  setClipboardData: async (data: ClipboardData) => {
    clipboardStore = data;
  },
  updateClipboardState: (state: { hasSelection: boolean; hasClipboard: boolean; isLocked: boolean }) => {
    events.emit('clipboard-changed', state.hasClipboard);
  },
  updateUndoState: () => {},
  notify3DModeChanged: () => {},
  notifyBackglassViewChanged: (enabled: boolean) => events.emit('backglass-view-changed', enabled),
  toggleScriptEditor: () => events.emit('toggle-script-editor'),

  openTransform: (type: string, options: { centerX: number; centerY: number; mouseX?: number; mouseY?: number }) =>
    events.emit('show-transform', type, options),

  importMesh: (primitiveFileName: string) => events.emit('show-mesh-import', primitiveFileName),
  exportMesh: (primitiveFileName: string, suggestedName?: string) =>
    events.emit('export-mesh', primitiveFileName, suggestedName),

  getGamedata: async () => null,
  saveGamedata: async (_gamedata: Record<string, unknown>) => {},
  getInfo: async () => null,
  saveInfo: async (_info: Record<string, unknown>) => {},
  getImages: async () => [],
  getMaterials: async () => ({}),
  saveMaterials: async (_materials: Record<string, unknown>) => {},
  getSounds: async () => [],
  getCollections: async () => [],
  saveCollections: async (_collections: unknown[]) => {},
  getGameitemsIndex: async () => [],
  showRenameDialog: () => {},
  toggleTableLock: () => {},

  refreshImageManager: noop,
  openImageManager: (imageName?: string) => events.emit('show-image-manager', imageName),
  refreshMaterialManager: noop,
  openMaterialManager: (materialName?: string) => events.emit('show-material-manager', materialName),
  openCollectionManager: (collectionName?: string) => events.emit('show-collection-manager', collectionName),
  refreshSoundManager: noop,
} as unknown as VpxEditorAPI;

declare global {
  interface Window {
    vpxEditorAPI: VpxEditorAPI;
  }
}

console.log('VPX Editor API stub: setting up window.vpxEditorAPI');
window.vpxEditorAPI = vpxEditorAPI;
window.vpxEditor = vpxEditorAPI;
console.log('VPX Editor API stub initialized');
