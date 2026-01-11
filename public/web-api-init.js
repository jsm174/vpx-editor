// This file must be loaded synchronously before any ES modules
// to ensure window.vpxEditorAPI is available when the renderer loads

(function() {
  console.log('[web-api-init] Setting up window.vpxEditorAPI');

  class EventEmitter {
    constructor() {
      this.listeners = new Map();
    }

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      const set = this.listeners.get(event);
      if (set) set.delete(callback);
    }

    emit(event, ...args) {
      const set = this.listeners.get(event);
      if (set) set.forEach(cb => cb(...args));
    }
  }

  const events = new EventEmitter();
  window.__vpxEvents = events;

  const noop = () => {};
  const noopAsync = async () => ({});

  const vpxEditorAPI = {
    onTableLoaded: (cb) => events.on('table-loaded', cb),
    onTableClosed: (cb) => events.on('table-closed', cb),
    onSelectItem: (cb) => events.on('select-item', cb),
    onSelectItems: (cb) => events.on('select-items', cb),
    onSelectionChanged: (cb) => events.on('selection-changed', cb),
    onUndo: (cb) => events.on('undo', cb),
    onRedo: (cb) => events.on('redo', cb),
    onCut: (cb) => events.on('cut', cb),
    onCopy: (cb) => events.on('copy', cb),
    onPaste: (cb) => events.on('paste', cb),
    onDelete: (cb) => events.on('delete-selected', cb),
    onSelectAll: (cb) => events.on('select-all', cb),
    onZoomIn: (cb) => events.on('zoom-in', cb),
    onZoomOut: (cb) => events.on('zoom-out', cb),
    onZoomReset: (cb) => events.on('zoom-reset', cb),
    onToggleGrid: (cb) => events.on('toggle-grid', cb),
    onToggleBackdrop: (cb) => events.on('toggle-backdrop', cb),
    onToggleBackglassView: (cb) => events.on('toggle-backglass-view', cb),
    onViewSettingsChanged: (cb) => events.on('view-settings-changed', cb),
    onEditorSettingsChanged: (cb) => events.on('editor-settings-changed', cb),
    onImagesChanged: (cb) => events.on('images-changed', cb),
    onMaterialsChanged: (cb) => events.on('materials-changed', cb),
    onSoundsChanged: (cb) => events.on('sounds-changed', cb),
    onCollectionsChanged: (cb) => events.on('collections-changed', cb),
    onGamedataChanged: (cb) => events.on('gamedata-changed', cb),
    onInfoChanged: (cb) => events.on('info-changed', cb),
    onConsoleOpen: (cb) => events.on('console-open', cb),
    onConsoleOutput: (cb) => events.on('console-output', cb),
    onToggleConsole: (cb) => events.on('toggle-console', cb),
    onLoading: (cb) => events.on('loading', cb),
    onStatus: (cb) => events.on('status', cb),
    onApplyTransform: (cb) => events.on('apply-transform', cb),
    onToggleScriptEditor: (cb) => events.on('toggle-script-editor', cb),
    onSetTheme: (cb) => events.on('set-theme', cb),
    onPlayStarted: (cb) => events.on('play-started', cb),
    onPlayStopped: (cb) => events.on('play-stopped', cb),
    onExtractedDirChanged: (cb) => events.on('extracted-dir-changed', cb),
    onMarkSavePoint: (cb) => events.on('mark-save-point', cb),
    onSetInputDisabled: (cb) => events.on('set-input-disabled', cb),
    onShowInfoModal: (cb) => events.on('show-info-modal', cb),
    onTableLockChanged: (cb) => events.on('table-lock-changed', cb),
    onThemeChanged: (cb) => events.on('theme-changed', cb),

    readFile: async (_path) => ({ success: false, error: 'Not initialized' }),
    readBinaryFile: async (_path) => ({ success: false, error: 'Not initialized' }),
    writeFile: async (_path, _content) => ({ success: false, error: 'Not initialized' }),
    writeBinaryFile: async (_path, _content) => ({ success: false, error: 'Not initialized' }),
    listDir: async (_path) => ({ success: false, error: 'Not initialized', files: [] }),
    deleteFile: async (_path) => ({ success: false, error: 'Not initialized' }),
    renameFile: async (_oldPath, _newPath) => ({ success: false, error: 'Not initialized' }),
    checkFileExists: async (_path) => ({ exists: false }),

    getExtractedDir: async () => '/vpx-work',
    getTableName: async () => 'table',

    getTheme: async () => 'dark',
    previewTheme: (_theme) => {},
    restoreTheme: async () => {},
    saveTheme: async (_theme) => {},

    getViewSettings: async () => ({ solid: true, outline: false, grid: true, backdrop: true }),
    getGridSize: async () => 50,
    getTextureQuality: async () => 'medium',
    getEditorSettings: async () => ({ unitConversion: 0 }),
    saveSettings: async (_settings) => {},
    getPanelSettings: async () => ({}),
    savePanelSettings: async (_settings) => {},
    getConsoleSettings: async () => ({ pinned: false }),
    saveConsoleSettings: async (_settings) => {},

    undoBegin: noop,
    undoEnd: noop,
    markDirty: noop,
    markClean: noop,

    notifySelectionChanged: (_items) => {},
    notifyCollectionsChanged: (_collections, _deletedNames) => {},

    showInfo: async (_options) => {},

    getImageInfo: async (_path) => ({ success: false, error: 'Not initialized' }),
    importImage: async () => ({ success: false, error: 'Not implemented in web version' }),
    exportImage: async () => ({ success: false, error: 'Not implemented in web version' }),

    playTable: async () => {},
    stopPlay: async () => {},

    getVersion: async () => ({ version: '0.7.0-web' }),

    isWeb: () => true,
    isElectron: () => false,

    getGamedata: async () => null,
    saveGamedata: async (_gamedata) => {},
    getInfo: async () => null,
    saveInfo: async (_info) => {},
    getImages: async () => [],
    getMaterials: async () => ({}),
    saveMaterials: async (_materials) => {},
    getSounds: async () => [],
    getCollections: async () => [],
    saveCollections: async (_collections) => {},
    getGameitemsIndex: async () => [],
  };

  window.vpxEditorAPI = vpxEditorAPI;
  window.vpxEditor = vpxEditorAPI;

  console.log('[web-api-init] API ready, window.vpxEditor =', !!window.vpxEditor);
})();
