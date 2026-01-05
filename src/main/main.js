import { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import versionInfo from '../shared/version.json';
import {
  upgradeOldMaterialsFormat,
  upgradePlayfieldMeshVisibility,
  upgradeLayersToPartGroups,
  upgradePartGroupIsLocked,
  cleanupCollectionItems,
} from './table-upgrades.js';
import { WindowContext, WindowRegistry } from './window-context.js';
import {
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_TABLE_BACKGROUND_COLOR,
  DEFAULT_THEME,
  DEFAULT_GRID_SIZE,
  DEFAULT_TEXTURE_QUALITY,
  DEFAULT_UNIT_CONVERSION,
  DEFAULT_VPINBALL_PATH_MACOS,
} from '../shared/constants.js';
import { getItemNameFromFileName } from '../shared/gameitem-utils.js';
import {
  settings,
  loadSettings,
  saveSettings,
  getSettingsPath,
  DEFAULT_EDITOR_COLORS,
  getLastFolder,
  setLastFolder,
  getWindowBounds,
  trackWindowBounds,
  resetWindowBounds,
} from './settings/settings-manager.js';
import { createMenu as createMenuImpl, insertItem as insertItemImpl } from './menu/menu-setup.js';
import { createWindowFactory } from './window-factory.js';
import * as vpxOps from './vpx/vpx-operations.js';
import { updateElectronApp } from 'update-electron-app';

updateElectronApp();

const windowRegistry = new WindowRegistry();

function getVpxOpsDeps() {
  return {
    windowRegistry,
    createEditorWindow,
    showWorkFolderModal,
    createMenu,
    upgradeOldMaterialsFormat,
    upgradePlayfieldMeshVisibility,
    upgradeLayersToPartGroups,
    upgradePartGroupIsLocked,
    cleanupCollectionItems,
    settings,
    saveSettings,
  };
}

let pendingFilePath = null;

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (filePath.toLowerCase().endsWith('.vpx')) {
    if (app.isReady()) {
      const existingCtx = windowRegistry.findByTablePath(filePath);
      if (existingCtx) {
        existingCtx.window.focus();
      } else {
        vpxOps.extractVPX(filePath, {}, getVpxOpsDeps());
      }
    } else {
      pendingFilePath = filePath;
    }
  }
});

function getActualTheme(themeSetting) {
  if (themeSetting === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return themeSetting;
}

if (started) {
  app.quit();
}

function getVersionString() {
  const version = app.getVersion();
  if (versionInfo.sha === 'dev') {
    return `${version} (dev)`;
  }
  return `${version}-${versionInfo.revision}-${versionInfo.sha}`;
}

function setupDialogEditMenu(browserWindow) {
  if (process.platform === 'darwin') {
    const editMenu = Menu.buildFromTemplate([
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]);
    browserWindow.setMenu(editMenu);
  } else {
    browserWindow.setMenu(null);
  }

  browserWindow.webContents.on('context-menu', (event, params) => {
    if (params.isEditable) {
      const contextMenu = Menu.buildFromTemplate([
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ]);
      contextMenu.popup({ window: browserWindow });
    }
  });
}

function showAboutDialog() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  aboutWindow = new BrowserWindow({
    width: 300,
    height: 220,
    title: 'About VPX Editor',
    show: false,
    resizable: false,
    minimizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  windowRegistry.forEach(ctx => {
    ctx.window.webContents.send('set-input-disabled', true);
  });

  createMenu();

  aboutWindow.setMenu(null);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/dialogs/about-window.html');
    aboutWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    aboutWindow.loadFile(path.join(__dirname, '../renderer/main_window/src/windows/dialogs/about-window.html'), {
      query: themeQuery,
    });
  }

  aboutWindow.on('closed', () => {
    windowRegistry.forEach(ctx => {
      ctx.window.webContents.send('set-input-disabled', false);
    });
    aboutWindow = null;
    createMenu();
  });

  aboutWindow.webContents.on('did-finish-load', () => {
    aboutWindow.webContents.send('init-about', {
      version: getVersionString(),
      iconPath: `file://${getAboutIconPath()}`,
    });
    aboutWindow.show();
  });
}

function getAboutIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'about-icon.png');
  }
  return path.join(process.cwd(), 'resources', 'about-icon.png');
}

let clipboardState = { hasSelection: false, hasClipboard: false, isLocked: false };
let undoState = { canUndo: false, canRedo: false };
let sharedClipboardData = null;
let activeThemeSetting = null;

function setTheme(theme) {
  if (settings.theme === theme) return;
  settings.theme = theme;
  saveSettings();
  nativeTheme.themeSource = theme;

  const actualTheme = getActualTheme(theme);
  windowRegistry.forEach(ctx => {
    ctx.window.webContents.send('set-theme', actualTheme);
    if (ctx.scriptEditorWindow) ctx.scriptEditorWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.imageManagerWindow) ctx.imageManagerWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.searchSelectWindow) ctx.searchSelectWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.materialManagerWindow) ctx.materialManagerWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.soundManagerWindow) ctx.soundManagerWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.renderProbeManagerWindow) ctx.renderProbeManagerWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.collectionManagerWindow) ctx.collectionManagerWindow.webContents.send('theme-changed', actualTheme);
    if (ctx.dimensionsManagerWindow) ctx.dimensionsManagerWindow.webContents.send('theme-changed', actualTheme);
  });
  createMenu();
}

function setViewSolid(enabled) {
  settings.viewSolid = enabled;
  if (enabled) settings.viewOutline = false;
  saveSettings();
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('view-settings-changed', {
      solid: settings.viewSolid,
      outline: settings.viewOutline,
      grid: settings.viewGrid,
      backdrop: settings.viewBackdrop,
    });
  }
  createMenu();
}

function setViewOutline(enabled) {
  settings.viewOutline = enabled;
  if (enabled) settings.viewSolid = false;
  saveSettings();
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('view-settings-changed', {
      solid: settings.viewSolid,
      outline: settings.viewOutline,
      grid: settings.viewGrid,
      backdrop: settings.viewBackdrop,
    });
  }
  createMenu();
}

function toggleViewGrid() {
  settings.viewGrid = !settings.viewGrid;
  saveSettings();
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('view-settings-changed', {
      solid: settings.viewSolid,
      outline: settings.viewOutline,
      grid: settings.viewGrid,
      backdrop: settings.viewBackdrop,
    });
  }
  createMenu();
}

function toggleViewBackdrop() {
  settings.viewBackdrop = !settings.viewBackdrop;
  saveSettings();
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('view-settings-changed', {
      solid: settings.viewSolid,
      outline: settings.viewOutline,
      grid: settings.viewGrid,
      backdrop: settings.viewBackdrop,
    });
  }
  createMenu();
}

function toggleBackglassView() {
  const ctx = windowRegistry.getFocused();
  if (!ctx) return;
  ctx.backglassViewEnabled = !ctx.backglassViewEnabled;
  ctx.window.webContents.send('toggle-backglass-view', ctx.backglassViewEnabled);
  createMenu();
}

ipcMain.on('backglass-view-changed', (event, enabled) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.backglassViewEnabled = enabled;
    createMenu();
  }
});

ipcMain.on('3d-mode-changed', (event, enabled) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.is3DMode = enabled;
    createMenu();
  }
});

ipcMain.on('restore-theme', (event, themeSetting) => {
  if (!themeSetting) return;
  activeThemeSetting = null;
  nativeTheme.themeSource = themeSetting;
  const actualTheme = getActualTheme(themeSetting);
  windowRegistry.forEach(winCtx => {
    winCtx.window.webContents.send('set-theme', actualTheme);
    if (winCtx.scriptEditorWindow) winCtx.scriptEditorWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.imageManagerWindow) winCtx.imageManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.materialManagerWindow) winCtx.materialManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.soundManagerWindow) winCtx.soundManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.searchSelectWindow) winCtx.searchSelectWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.renderProbeManagerWindow) winCtx.renderProbeManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.collectionManagerWindow) winCtx.collectionManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.dimensionsManagerWindow) winCtx.dimensionsManagerWindow.webContents.send('theme-changed', actualTheme);
  });
});

ipcMain.on('preview-theme', (event, themeSetting) => {
  if (!themeSetting) return;
  activeThemeSetting = themeSetting;
  nativeTheme.themeSource = themeSetting;
  const actualTheme = getActualTheme(themeSetting);
  windowRegistry.forEach(winCtx => {
    winCtx.window.webContents.send('set-theme', actualTheme);
    if (winCtx.scriptEditorWindow) winCtx.scriptEditorWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.imageManagerWindow) winCtx.imageManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.materialManagerWindow) winCtx.materialManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.soundManagerWindow) winCtx.soundManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.searchSelectWindow) winCtx.searchSelectWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.renderProbeManagerWindow) winCtx.renderProbeManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.collectionManagerWindow) winCtx.collectionManagerWindow.webContents.send('theme-changed', actualTheme);
    if (winCtx.dimensionsManagerWindow) winCtx.dimensionsManagerWindow.webContents.send('theme-changed', actualTheme);
  });
  if (settingsWindow) settingsWindow.webContents.send('theme-changed', actualTheme);
  if (transformWindow) transformWindow.webContents.send('theme-changed', actualTheme);
  if (aboutWindow) aboutWindow.webContents.send('theme-changed', actualTheme);
  if (tableInfoWindow) tableInfoWindow.webContents.send('theme-changed', actualTheme);
});

ipcMain.on('toggle-script-editor', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx) return;
  if (ctx.scriptEditorClosePending) return;
  if (ctx.scriptEditorWindow) {
    ctx.scriptEditorClosePending = true;
    ctx.scriptEditorWindow.webContents.send('check-can-close');
  } else {
    openScriptEditorWindow(ctx);
  }
});

ipcMain.on('can-close-response', (event, canClose) => {
  const ctx = windowRegistry.getByChildWindow(event.sender.getOwnerBrowserWindow?.());
  if (!ctx) return;
  if (canClose && ctx.scriptEditorWindow) {
    ctx.scriptEditorWindow.destroy();
  } else {
    ctx.scriptEditorClosePending = false;
  }
});

function insertItem(itemType) {
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('insert-item', itemType);
  }
}

function createEditorWindow() {
  const id = `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const bounds = getWindowBounds('mainWindow', { width: 1400, height: 900 });
  const win = new BrowserWindow({
    ...bounds,
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  trackWindowBounds(win, 'mainWindow');
  win.webContents.windowId = id;

  const ctx = new WindowContext(id, win);
  windowRegistry.add(ctx);
  windowRegistry.setFocused(ctx);

  win.on('focus', () => {
    windowRegistry.setFocused(ctx);
    createMenu();
  });

  win.on('close', async e => {
    if (ctx.isTableDirty && !ctx.closeConfirmed) {
      e.preventDefault();
      const result = await showCloseConfirm(ctx);
      if (result === 'cancel') {
        return;
      }
      if (result === 'save') {
        await vpxOps.saveVPX(getVpxOpsDeps());
      }
      ctx.closeConfirmed = true;
      win.close();
    }
  });

  win.on('closed', () => {
    ctx.closeChildWindows();
    windowRegistry.remove(id);
    createMenu();
  });

  const actualTheme = getActualTheme(settings.theme);
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    url.searchParams.set('theme', actualTheme);
    win.loadURL(url.toString());
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      query: { theme: actualTheme },
    });
  }

  createMenu();
  return ctx;
}

const createWindow = () => {
  createEditorWindow();
};

function createMenu() {
  const isMac = process.platform === 'darwin';
  const ctx = windowRegistry.getFocused();
  const hasWindow = !!ctx;
  const hasTable = ctx?.hasTable() ?? false;
  const isLocked = ctx?.isTableLocked ?? false;
  const inBackglass = ctx?.backglassViewEnabled ?? false;
  const in3D = ctx?.is3DMode ?? false;
  const settingsOpen = !!settingsWindow;
  const transformOpen = !!transformWindow;
  const aboutOpen = !!aboutWindow;
  const tableInfoOpen = !!tableInfoWindow;
  const promptOpen = !!promptWindow;
  const infoOpen = !!infoWindow;
  const confirmOpen = !!confirmWindow;
  const workFolderOpen = !!workFolderWindow;
  const collectionDialogOpen = !!collectionPromptWindow;
  const meshImportOpen = !!meshImportWindow;
  const drawingOrderOpen = !!drawingOrderWindow;
  const dialogOpen =
    settingsOpen ||
    transformOpen ||
    aboutOpen ||
    tableInfoOpen ||
    promptOpen ||
    infoOpen ||
    confirmOpen ||
    workFolderOpen ||
    collectionDialogOpen ||
    meshImportOpen ||
    drawingOrderOpen ||
    nativeDialogOpen;

  const template = [
    ...(isMac
      ? [
          {
            label: 'VPX Editor',
            submenu: [
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          enabled: !dialogOpen,
          submenu: [
            {
              label: 'New Table',
              accelerator: 'CmdOrCtrl+N',
              click: () => vpxOps.createNewTable('blankTable.vpx', 'New Table', getVpxOpsDeps()),
            },
            {
              label: 'Completely Blank Table',
              click: () => vpxOps.createNewTable('strippedTable.vpx', 'Blank Table', getVpxOpsDeps()),
            },
            {
              label: 'Full Example Table',
              click: () => vpxOps.createNewTable('exampleTable.vpx', 'Example Table', getVpxOpsDeps()),
            },
            {
              label: 'Light Sequence Demo Table',
              click: () => vpxOps.createNewTable('lightSeqTable.vpx', 'Light Sequence Demo', getVpxOpsDeps()),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Open VPX...',
          accelerator: 'CmdOrCtrl+O',
          enabled: !dialogOpen,
          click: () => vpxOps.openVPX(getVpxOpsDeps()),
        },
        {
          label: 'Open Recent',
          enabled: !dialogOpen,
          submenu:
            settings.recentFiles.length > 0
              ? [
                  ...settings.recentFiles.map((filePath, index) => ({
                    label: `${index + 1}. ${filePath}`,
                    click: () => vpxOps.extractVPX(filePath, { forceExtract: true }, getVpxOpsDeps()),
                  })),
                  { type: 'separator' },
                  {
                    label: 'Clear Recents',
                    click: () => {
                      settings.recentFiles = [];
                      saveSettings();
                      createMenu();
                    },
                  },
                ]
              : [{ label: 'No Recent Files', enabled: false }],
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: hasTable && !dialogOpen,
          click: () => vpxOps.saveVPX(getVpxOpsDeps()),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: hasTable && !dialogOpen,
          click: () => vpxOps.saveVPXAs(getVpxOpsDeps()),
        },
        { type: 'separator' },
        {
          label: 'Export Blueprint...',
          enabled: hasTable && !dialogOpen,
          click: async () => {
            const result = await showBlueprintDialog(ctx, inBackglass);
            if (result) {
              ctx?.window.webContents.send('export-blueprint', result);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          enabled: hasWindow && !dialogOpen,
          click: () => closeWindow(),
        },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          id: 'undo',
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          enabled: undoState.canUndo && !dialogOpen,
          click: (menuItem, focusedWindow) => {
            const editorCtx = windowRegistry.getByWindow(focusedWindow);
            if (editorCtx) {
              editorCtx.window.webContents.send('undo');
            } else if (focusedWindow) {
              focusedWindow.webContents.undo();
            }
          },
        },
        {
          id: 'redo',
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          enabled: undoState.canRedo && !dialogOpen,
          click: (menuItem, focusedWindow) => {
            const editorCtx = windowRegistry.getByWindow(focusedWindow);
            if (editorCtx) {
              editorCtx.window.webContents.send('redo');
            } else if (focusedWindow) {
              focusedWindow.webContents.redo();
            }
          },
        },
        { type: 'separator' },
        {
          id: 'lock',
          label: clipboardState.isLocked ? 'Unlock' : 'Lock',
          accelerator: 'CmdOrCtrl+Shift+L',
          enabled: clipboardState.hasSelection && !isLocked && !dialogOpen,
          click: () => {
            ctx?.window.webContents.send('toggle-lock');
          },
        },
        {
          id: 'cut',
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          enabled: clipboardState.hasSelection && !isLocked && !dialogOpen,
          click: (menuItem, focusedWindow) => {
            const editorCtx = windowRegistry.getByWindow(focusedWindow);
            if (editorCtx) {
              editorCtx.window.webContents.send('cut');
            } else if (focusedWindow) {
              focusedWindow.webContents.cut();
            }
          },
        },
        {
          id: 'copy',
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          enabled: clipboardState.hasSelection && !isLocked && !dialogOpen,
          click: (menuItem, focusedWindow) => {
            const editorCtx = windowRegistry.getByWindow(focusedWindow);
            if (editorCtx) {
              editorCtx.window.webContents.send('copy');
            } else if (focusedWindow) {
              focusedWindow.webContents.copy();
            }
          },
        },
        {
          id: 'paste',
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          enabled: clipboardState.hasClipboard && !isLocked && !dialogOpen,
          click: (menuItem, focusedWindow) => {
            const editorCtx = windowRegistry.getByWindow(focusedWindow);
            if (editorCtx) {
              editorCtx.window.webContents.send('paste');
            } else if (focusedWindow) {
              focusedWindow.webContents.paste();
            }
          },
        },
        {
          id: 'paste-at',
          label: 'Paste At',
          accelerator: 'CmdOrCtrl+Shift+V',
          enabled: clipboardState.hasClipboard && !isLocked && !dialogOpen,
          click: () => {
            ctx?.window.webContents.send('paste-at-original');
          },
        },
        {
          id: 'delete',
          label: 'Delete',
          accelerator: 'Delete',
          enabled: clipboardState.hasSelection && !clipboardState.isLocked && !isLocked && !dialogOpen,
          click: () => {
            ctx?.window.webContents.send('delete-selected');
          },
        },
        { type: 'separator' },
        {
          id: 'search-select',
          label: 'Select Element',
          accelerator: 'CmdOrCtrl+Shift+E',
          enabled: hasTable && !dialogOpen,
          click: () => showSearchSelect(),
        },
        {
          id: 'drawing-order-hit',
          label: 'Drawing Order (Hit)',
          accelerator: 'CmdOrCtrl+Shift+D',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => showDrawingOrder('hit'),
        },
        {
          id: 'drawing-order-select',
          label: 'Drawing Order (Select)',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => showDrawingOrder('select'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Solid',
          type: 'checkbox',
          checked: settings.viewSolid,
          enabled: hasTable && !dialogOpen,
          click: () => setViewSolid(true),
        },
        {
          label: 'Outline',
          type: 'checkbox',
          checked: settings.viewOutline,
          enabled: hasTable && !dialogOpen,
          click: () => setViewOutline(true),
        },
        { type: 'separator' },
        {
          label: 'Grid',
          type: 'checkbox',
          checked: settings.viewGrid,
          enabled: hasTable && !dialogOpen,
          click: () => toggleViewGrid(),
        },
        {
          label: 'Playfield Image/Backdrop',
          type: 'checkbox',
          checked: settings.viewBackdrop,
          enabled: hasTable && !dialogOpen,
          click: () => toggleViewBackdrop(),
        },
        { type: 'separator' },
        {
          label: 'Script',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openScriptEditorWindow(),
        },
        {
          label: 'Backglass/POV',
          type: 'checkbox',
          checked: inBackglass,
          enabled: hasTable && !dialogOpen,
          accelerator: 'CmdOrCtrl+Space',
          click: () => toggleBackglassView(),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Insert',
      submenu: [
        {
          label: 'Wall',
          accelerator: 'CmdOrCtrl+W',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Wall'),
        },
        {
          label: 'Gate',
          accelerator: 'CmdOrCtrl+G',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Gate'),
        },
        {
          label: 'Ramp',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Ramp'),
        },
        {
          label: 'Flasher',
          accelerator: 'CmdOrCtrl+H',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Flasher'),
        },
        {
          label: 'Flipper',
          accelerator: 'CmdOrCtrl+F',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Flipper'),
        },
        {
          label: 'Plunger',
          accelerator: 'CmdOrCtrl+P',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Plunger'),
        },
        {
          label: 'Bumper',
          accelerator: 'CmdOrCtrl+B',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Bumper'),
        },
        {
          label: 'Spinner',
          accelerator: 'CmdOrCtrl+I',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Spinner'),
        },
        {
          label: 'Timer',
          accelerator: 'CmdOrCtrl+M',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Timer'),
        },
        {
          label: 'Trigger',
          accelerator: 'CmdOrCtrl+T',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Trigger'),
        },
        {
          label: 'Light',
          accelerator: 'CmdOrCtrl+L',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Light'),
        },
        {
          label: 'Kicker',
          accelerator: 'CmdOrCtrl+K',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Kicker'),
        },
        {
          label: 'Target',
          accelerator: 'CmdOrCtrl+A',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => {
            const editorCtx = windowRegistry.getByWindow(w);
            if (editorCtx) {
              editorCtx.window.webContents.selectAll();
              editorCtx.window.webContents.send('select-all');
            } else if (w) {
              w.webContents.selectAll();
            }
          },
        },
        {
          label: 'Decal',
          accelerator: 'CmdOrCtrl+D',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Decal'),
        },
        {
          label: 'Textbox',
          accelerator: 'CmdOrCtrl+E',
          enabled: hasTable && inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Textbox'),
        },
        {
          label: 'EM Reel',
          accelerator: 'CmdOrCtrl+Y',
          enabled: hasTable && inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Reel'),
        },
        {
          label: 'Light Sequencer',
          accelerator: 'CmdOrCtrl+Q',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('LightSequencer'),
        },
        {
          label: 'Primitive',
          accelerator: 'CmdOrCtrl+J',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Primitive'),
        },
        {
          label: 'Rubber',
          accelerator: 'CmdOrCtrl+U',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (m, w) => windowRegistry.getByWindow(w) && insertItem('Rubber'),
        },
      ],
    },
    {
      label: 'Table',
      submenu: [
        {
          label: 'Play',
          accelerator: 'F5',
          enabled: hasTable && !dialogOpen,
          click: () => vpxOps.playTable(getVpxOpsDeps()),
        },
        { type: 'separator' },
        {
          label: 'Table Info...',
          enabled: hasTable && !dialogOpen,
          click: () => openTableInfoWindow(),
        },
        {
          label: 'Sound Manager...',
          accelerator: 'F2',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openSoundManagerWindow(),
        },
        {
          label: 'Image Manager...',
          accelerator: 'F3',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openImageManagerWindow(),
        },
        {
          label: 'Material Manager...',
          accelerator: 'F4',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openMaterialManagerWindow(),
        },
        {
          label: 'Dimensions Manager...',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openDimensionsManagerWindow(),
        },
        {
          label: 'Collection Manager...',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openCollectionManagerWindow(),
        },
        {
          label: 'Render Probe Manager...',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => openRenderProbeManagerWindow(),
        },
        { type: 'separator' },
        {
          label: isLocked ? 'Unlock Table' : 'Lock Table',
          enabled: hasTable && !dialogOpen,
          click: () => toggleTableLock(),
        },
        { type: 'separator' },
        {
          label: 'Magnify',
          accelerator: 'Z',
          enabled: hasTable && !in3D && !dialogOpen,
          click: () => ctx?.window.webContents.send('toggle-magnify'),
        },
      ],
    },
    {
      label: 'Preferences',
      submenu: [
        {
          label: 'Editor / UI Options...',
          enabled: !dialogOpen,
          click: () => openSettingsWindow(),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: 'Console',
          accelerator: 'CmdOrCtrl+`',
          click: (m, w) => {
            const editorCtx = windowRegistry.getByWindow(w);
            if (editorCtx) {
              editorCtx.window.webContents.send('toggle-console');
            }
          },
        },
        ...(windowRegistry.count() > 0
          ? [
              { type: 'separator' },
              ...windowRegistry.getAll().map(wctx => ({
                label: wctx.tableName ? `${wctx.tableName}.vpx` : 'Untitled',
                type: 'checkbox',
                checked: wctx === ctx,
                click: () => wctx.window.focus(),
              })),
            ]
          : []),
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [{ label: 'About...', enabled: !dialogOpen, click: showAboutDialog }],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function markTableDirty() {
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.markDirty();
  }
}

function markTableClean() {
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.markClean();
    ctx.window.webContents.send('mark-save-point');
  }
}

let nativeDialogOpen = false;

async function showCloseConfirm(ctx) {
  nativeDialogOpen = true;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });
  createMenu();

  const result = await dialog.showMessageBox(ctx.window, {
    type: 'warning',
    message: 'Do you want to save the changes you made?',
    detail: "Your changes will be lost if you don't save them.",
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });

  nativeDialogOpen = false;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', false);
  });
  createMenu();

  const actions = ['save', 'discard', 'cancel'];
  return actions[result.response];
}

async function showWorkFolderModal(ctx, type, message) {
  nativeDialogOpen = true;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });
  createMenu();

  let result;
  if (type === 'resume') {
    result = await dialog.showMessageBox(ctx.window, {
      type: 'question',
      message: 'Previous Session Found',
      detail: message,
      buttons: ['Resume', 'Re-extract', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });
  } else {
    result = await dialog.showMessageBox(ctx.window, {
      type: 'warning',
      message: 'External Changes Detected',
      detail: message,
      buttons: ['Re-extract', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });
  }

  nativeDialogOpen = false;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', false);
  });
  createMenu();

  if (type === 'resume') {
    const actions = ['resume', 'extract', 'cancel'];
    return actions[result.response];
  } else {
    return result.response === 0 ? 'extract' : 'cancel';
  }
}

async function showBlueprintDialog(ctx, inBackglass) {
  nativeDialogOpen = true;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });
  createMenu();

  const result = await dialog.showMessageBox(ctx.window, {
    type: 'question',
    message: 'Export Blueprint',
    detail: 'Do you want a solid blueprint (filled shapes) or outline only?',
    buttons: ['Solid', 'Outline', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });

  nativeDialogOpen = false;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', false);
  });
  createMenu();

  if (result.response === 2) {
    return null;
  }

  return { solid: result.response === 0, isBackglass: inBackglass };
}

async function showInfoModal(ctx, title, message) {
  nativeDialogOpen = true;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });
  createMenu();

  await dialog.showMessageBox(ctx.window, {
    type: 'info',
    message: title,
    detail: message,
    buttons: ['OK'],
    defaultId: 0,
  });

  nativeDialogOpen = false;
  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', false);
  });
  createMenu();
}

function closeWindow() {
  const ctx = windowRegistry.getFocused();
  if (!ctx) return;
  ctx.window.close();
}

ipcMain.on('toggle-table-lock', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) toggleTableLock(ctx);
});

async function toggleTableLock() {
  const ctx = windowRegistry.getFocused();
  if (!ctx || !ctx.extractedDir) return;

  const action = ctx.isTableLocked ? 'Unlock' : 'Lock';
  const message = ctx.isTableLocked ? 'This table is locked to avoid modification.' : 'Lock this table?';
  const detail = ctx.isTableLocked
    ? 'You do not need to unlock it to adjust settings like the camera or rendering options.\n\nAre you sure you want to unlock the table?'
    : 'This will lock the table to prevent unexpected modifications.';

  const result = await dialog.showMessageBox(ctx.window, {
    type: 'warning',
    buttons: [action, 'Cancel'],
    defaultId: 1,
    title: `Table ${action}ing`,
    message,
    detail,
  });
  if (result.response !== 0) return;

  const gamedataPath = path.join(ctx.extractedDir, 'gamedata.json');
  const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
  const gamedata = JSON.parse(gamedataContent);
  gamedata.locked = (gamedata.locked || 0) + 1;
  ctx.isTableLocked = (gamedata.locked & 1) !== 0;
  await fs.promises.writeFile(gamedataPath, JSON.stringify(gamedata, null, 2));

  ctx.window.webContents.send('table-lock-changed', ctx.isTableLocked);
  createMenu();
}

ipcMain.handle('play-table', async () => {
  await vpxOps.playTable(getVpxOpsDeps());
});

ipcMain.handle('stop-play', () => {
  vpxOps.stopPlay();
});

ipcMain.handle('get-console-settings', () => {
  return {
    height: settings.consoleHeight,
    visible: settings.consoleVisible,
  };
});

ipcMain.handle('save-console-settings', (event, consoleSettings) => {
  if (consoleSettings.height !== undefined) {
    settings.consoleHeight = consoleSettings.height;
  }
  if (consoleSettings.visible !== undefined) {
    settings.consoleVisible = consoleSettings.visible;
  }
  saveSettings();
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-binary-file', async (event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, data: buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    const ctx = windowRegistry.getContextFromEvent(event);
    if (filePath.includes('/gameitems/') || filePath.endsWith('/gameitems.json')) {
      if (ctx?.searchSelectWindow) {
        updateSearchSelectWindow(ctx);
      }
      if (ctx) {
        updateCollectionEditorWindow(ctx);
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-dir', async (event, dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    return { success: true, files };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-theme', () => getActualTheme(settings.theme));
ipcMain.handle('get-version', () => getVersionString());

ipcMain.handle('set-clipboard-data', (event, data) => {
  sharedClipboardData = data;
  return true;
});

ipcMain.handle('get-clipboard-data', () => {
  return sharedClipboardData;
});

ipcMain.handle('has-clipboard-data', () => {
  return sharedClipboardData !== null;
});

ipcMain.on('update-undo-state', (event, { canUndo, canRedo }) => {
  undoState = { canUndo, canRedo };

  const menu = Menu.getApplicationMenu();
  if (menu) {
    const undoItem = menu.getMenuItemById('undo');
    const redoItem = menu.getMenuItemById('redo');
    if (undoItem) {
      undoItem.enabled = canUndo;
    }
    if (redoItem) {
      redoItem.enabled = canRedo;
    }
  }
});

ipcMain.on('update-clipboard-state', (event, { hasSelection, hasClipboard, isLocked }) => {
  const needsMenuRebuild = clipboardState.isLocked !== isLocked;
  clipboardState = { hasSelection, hasClipboard, isLocked };

  if (needsMenuRebuild) {
    createMenu();
  } else {
    const menu = Menu.getApplicationMenu();
    if (menu) {
      const lockItem = menu.getMenuItemById('lock');
      const copyItem = menu.getMenuItemById('copy');
      const pasteItem = menu.getMenuItemById('paste');
      const pasteAtItem = menu.getMenuItemById('paste-at');
      const deleteItem = menu.getMenuItemById('delete');

      if (lockItem) {
        lockItem.enabled = hasSelection;
      }
      if (copyItem) {
        copyItem.enabled = hasSelection;
      }
      if (pasteItem) {
        pasteItem.enabled = hasClipboard;
      }
      if (pasteAtItem) {
        pasteAtItem.enabled = hasClipboard;
      }
      if (deleteItem) {
        deleteItem.enabled = hasSelection && !isLocked;
      }
    }
  }
});

ipcMain.handle('get-view-settings', () => ({
  solid: settings.viewSolid,
  outline: settings.viewOutline,
  grid: settings.viewGrid,
  backdrop: settings.viewBackdrop,
}));
ipcMain.handle('get-panel-settings', () => settings.panels);
ipcMain.handle('save-panel-settings', (event, panels) => {
  settings.panels = panels;
  saveSettings();
});

ipcMain.handle('get-image-info', async (event, imagePath) => {
  try {
    const stats = await fs.promises.stat(imagePath);
    const buffer = await fs.promises.readFile(imagePath);

    let width = 0,
      height = 0;
    const ext = path.extname(imagePath).toLowerCase();

    if (ext === '.png') {
      if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      let i = 2;
      while (i < buffer.length - 9) {
        if (buffer[i] !== 0xff) break;
        const marker = buffer[i + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          height = buffer.readUInt16BE(i + 5);
          width = buffer.readUInt16BE(i + 7);
          break;
        }
        const len = buffer.readUInt16BE(i + 2);
        i += 2 + len;
      }
    } else if (ext === '.webp') {
      if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF') {
        const format = buffer.toString('ascii', 12, 16);
        if (format === 'VP8 ') {
          if (buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
            width = buffer.readUInt16LE(26) & 0x3fff;
            height = buffer.readUInt16LE(28) & 0x3fff;
          }
        } else if (format === 'VP8L') {
          const bits = buffer.readUInt32LE(21);
          width = (bits & 0x3fff) + 1;
          height = ((bits >> 14) & 0x3fff) + 1;
        } else if (format === 'VP8X') {
          width = buffer.readUIntLE(24, 3) + 1;
          height = buffer.readUIntLE(27, 3) + 1;
        }
      }
    } else if (ext === '.bmp') {
      if (buffer.length >= 26) {
        width = buffer.readUInt32LE(18);
        height = Math.abs(buffer.readInt32LE(22));
      }
    }

    return { success: true, width, height, size: stats.size };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-image', async event => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) {
    return { success: false, error: 'No table open' };
  }

  const win = BrowserWindow.fromWebContents(event.sender) || ctx.window;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }

  const srcPath = result.filePaths[0];
  const ext = path.extname(srcPath).toLowerCase();
  let baseName = path.basename(srcPath, ext);

  const imagesDir = path.join(ctx.extractedDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    await fs.promises.mkdir(imagesDir, { recursive: true });
  }

  let destName = baseName;
  let counter = 1;
  while (fs.existsSync(path.join(imagesDir, destName + ext))) {
    destName = `${baseName}_${counter}`;
    counter++;
  }

  const destPath = path.join(imagesDir, destName + ext);
  await fs.promises.copyFile(srcPath, destPath);

  return {
    success: true,
    name: destName,
    originalPath: srcPath,
    ext: ext,
  };
});

ipcMain.handle('export-image', async (event, srcPath, suggestedName) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: suggestedName,
    filters: [{ name: 'Image', extensions: [path.extname(srcPath).slice(1)] }],
  });

  if (result.canceled) {
    return { success: false };
  }

  try {
    await fs.promises.copyFile(srcPath, result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-blueprint', async (event, data, suggestedName) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: suggestedName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (result.canceled) {
    return { success: false };
  }

  try {
    const buffer = Buffer.from(data);
    await fs.promises.writeFile(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-blueprint-get-path', async (event, suggestedName) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: suggestedName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (result.canceled) {
    return null;
  }
  return result.filePath;
});

ipcMain.handle('save-blueprint-direct', async (event, data, filePath) => {
  try {
    const buffer = Buffer.from(data);
    await fs.promises.writeFile(filePath, buffer);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    await fs.promises.unlink(filePath);
    const ctx = getContextForManagerEvent(event);
    if (ctx?.searchSelectWindow && (filePath.includes('/gameitems/') || filePath.endsWith('/gameitems.json'))) {
      updateSearchSelectWindow(ctx);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-sound-info', async (event, soundPath) => {
  try {
    const stats = await fs.promises.stat(soundPath);
    const fileSize = stats.size;
    const ext = path.extname(soundPath).toLowerCase();

    let info = {
      success: true,
      size: fileSize,
      format: ext.slice(1).toUpperCase(),
    };

    if (ext === '.wav') {
      const fd = await fs.promises.open(soundPath, 'r');
      const header = Buffer.alloc(44);
      await fd.read(header, 0, 44, 0);
      await fd.close();

      if (header.toString('utf8', 0, 4) === 'RIFF' && header.toString('utf8', 8, 12) === 'WAVE') {
        const channels = header.readUInt16LE(22);
        const sampleRate = header.readUInt32LE(24);
        const byteRate = header.readUInt32LE(28);
        const bitsPerSample = header.readUInt16LE(34);
        const dataSize = fileSize - 44;
        const duration = byteRate > 0 ? dataSize / byteRate : 0;

        info.channels = channels;
        info.sampleRate = sampleRate;
        info.bitsPerSample = bitsPerSample;
        info.duration = duration;
      }
    } else if (ext === '.ogg') {
      info.format = 'OGG';
    } else if (ext === '.mp3') {
      info.format = 'MP3';
    } else if (ext === '.flac') {
      info.format = 'FLAC';
    }

    return info;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
  try {
    await fs.move(oldPath, newPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-item-image', async (event, itemName, itemType, oldImage, newImage) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  try {
    const gameitemsPath = path.join(ctx.extractedDir, 'gameitems.json');
    const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);

    const itemInfo = gameitems.find(i => i.file_name && getItemNameFromFileName(i.file_name) === itemName);
    if (!itemInfo) return { success: false, error: 'Item not found' };

    const itemPath = path.join(ctx.extractedDir, 'gameitems', itemInfo.file_name);
    const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
    const itemData = JSON.parse(itemContent);

    const type = Object.keys(itemData)[0];
    const item = itemData[type];

    const imageProps = {
      Wall: ['image', 'side_image'],
      Surface: ['image', 'side_image'],
      Flipper: ['image'],
      Bumper: ['base_image', 'cap_image', 'ring_image', 'skirt_image'],
      Ramp: ['image'],
      Spinner: ['image'],
      Gate: ['image'],
      Plunger: ['image'],
      Kicker: ['image'],
      Trigger: ['image'],
      Light: ['image', 'image_off'],
      HitTarget: ['image'],
      Rubber: ['image'],
      Flasher: ['image_a', 'image_b'],
      Primitive: ['image', 'normal_map'],
      Decal: ['image'],
      Reel: ['image'],
    };

    const props = imageProps[itemType] || [];
    for (const prop of props) {
      if (item[prop] === oldImage) {
        item[prop] = newImage;
      }
    }

    await fs.promises.writeFile(itemPath, JSON.stringify(itemData, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('confirm-dialog', async (event, message) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Cancel', 'OK'],
    defaultId: 1,
    message: message,
  });
  return result.response === 1;
});

ipcMain.on('select-item', (event, itemName) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx && itemName !== 'Table') {
    ctx.window.webContents.send('select-item', itemName);
  }
});

ipcMain.on('select-items', (event, itemNames) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx && itemNames && itemNames.length > 0) {
    ctx.window.webContents.send('select-items', itemNames);
  }
});

ipcMain.on('notify-selection-changed', (event, selectedItems) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx?.searchSelectWindow && !ctx.searchSelectWindow.isDestroyed()) {
    ctx.searchSelectWindow.webContents.send('selection-changed', selectedItems);
  }
  if (ctx?.collectionManagerWindow && !ctx.collectionManagerWindow.isDestroyed()) {
    ctx.collectionManagerWindow.webContents.send('selection-changed', selectedItems);
  }
});

ipcMain.on('images-changed', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('images-changed');
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }
});

ipcMain.on('materials-changed', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('materials-changed');
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }
});

ipcMain.on('undo-begin', (event, description) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-begin', description);
  }
});

ipcMain.on('undo-end', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-end');
  }
});

ipcMain.on('mark-dirty', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.markDirty();
  }
});

ipcMain.on('mark-clean', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx && !ctx.hasExternalChanges) {
    ctx.isTableDirty = false;
    ctx.updateWindowTitle();
  }
});

ipcMain.on('record-script-change', (event, before, after) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('record-script-change', before, after);
  }
});

ipcMain.on('script-undone', async event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx?.scriptEditorWindow && ctx?.extractedDir) {
    try {
      const content = await fs.promises.readFile(`${ctx.extractedDir}/script.vbs`, 'utf-8');
      ctx.scriptEditorWindow.webContents.send('script-undone', content);
    } catch (e) {
      ctx.scriptEditorWindow.webContents.send('script-undone', '');
    }
  }
});

ipcMain.on('undo-cancel', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-cancel');
  }
});

ipcMain.on('undo-mark-images', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-images');
  }
});

ipcMain.on('undo-mark-image-create', (event, imageName) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-image-create', imageName);
  }
});

ipcMain.on('undo-mark-image-delete', (event, imageName, imageData, filePath) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-image-delete', imageName, imageData, filePath);
  }
});

ipcMain.on('undo-mark-materials', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-materials');
  }
});

ipcMain.on('undo-mark-material-create', (event, materialName) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-material-create', materialName);
  }
});

ipcMain.on('undo-mark-material-delete', (event, materialName, materialData) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-material-delete', materialName, materialData);
  }
});

ipcMain.on('undo-mark-renderprobes', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-renderprobes');
  }
});

ipcMain.on('undo-mark-renderprobe-create', (event, probeName) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-renderprobe-create', probeName);
  }
});

ipcMain.on('undo-mark-renderprobe-delete', (event, probeName, probeData) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-renderprobe-delete', probeName, probeData);
  }
});

ipcMain.on('renderprobes-changed', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('renderprobes-changed');
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }
});

ipcMain.on('undo-mark-for-undo', (event, itemName) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-for-undo', itemName);
  }
});

ipcMain.on('undo-mark-gamedata', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-gamedata');
  }
});

ipcMain.on('undo-mark-info', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-info');
  }
});

ipcMain.on('undo-mark-gameitems-list', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-gameitems-list');
  }
});

ipcMain.on('sounds-changed', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('sounds-changed');
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }
});

ipcMain.handle('save-table-info', async (event, data) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  try {
    await fs.promises.writeFile(`${ctx.extractedDir}/info.json`, JSON.stringify(data.info, null, 2));

    ctx.window.webContents.send('info-changed', data.info);

    if (data.screenshot !== undefined) {
      const gamedataPath = `${ctx.extractedDir}/gamedata.json`;
      const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
      const gamedata = JSON.parse(gamedataContent);
      gamedata.screen_shot = data.screenshot;
      await fs.promises.writeFile(gamedataPath, JSON.stringify(gamedata, null, 2));
      ctx.window.webContents.send('gamedata-changed', gamedata);
    }

    ctx.hasExternalChanges = true;
    ctx.markDirty();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('save-table-info-window', async (event, data) => {
  if (!tableInfoWindowContext?.extractedDir) return;

  try {
    await fs.promises.writeFile(`${tableInfoWindowContext.extractedDir}/info.json`, JSON.stringify(data.info, null, 2));

    tableInfoWindowContext.window.webContents.send('info-changed', data.info);

    if (data.screenshot !== data.originalScreenshot) {
      const gamedataPath = `${tableInfoWindowContext.extractedDir}/gamedata.json`;
      const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
      const gamedata = JSON.parse(gamedataContent);

      tableInfoWindowContext.window.webContents.send('undo-begin', 'Edit table info');
      tableInfoWindowContext.window.webContents.send('undo-mark-info');
      tableInfoWindowContext.window.webContents.send('undo-mark-gamedata');

      gamedata.screen_shot = data.screenshot;
      await fs.promises.writeFile(gamedataPath, JSON.stringify(gamedata, null, 2));
      tableInfoWindowContext.window.webContents.send('gamedata-changed', gamedata);

      tableInfoWindowContext.window.webContents.send('undo-end');
    } else {
      tableInfoWindowContext.window.webContents.send('undo-begin', 'Edit table info');
      tableInfoWindowContext.window.webContents.send('undo-mark-info');
      tableInfoWindowContext.window.webContents.send('undo-end');
    }

    tableInfoWindowContext.hasExternalChanges = true;
    tableInfoWindowContext.markDirty();
  } catch (err) {
    console.error('save-table-info-window error:', err);
  }
});

ipcMain.on('cancel-table-info', () => {});

ipcMain.on('close-dimensions-manager', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx?.dimensionsManagerWindow) {
    ctx.dimensionsManagerWindow.close();
  }
});

ipcMain.on('collection-create', async (event, name) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', `Create collection ${name}`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  collections.push({
    name,
    items: [],
    fire_events: false,
    stop_single_events: false,
    group_elements: true,
  });

  await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
  ctx.hasExternalChanges = true;
  ctx.markDirty();

  ctx.window.webContents.send('undo-end');

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }
});

ipcMain.on('collection-create-from-selection', async event => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;
  ctx.window.webContents.send('collection-create-from-selection-request');
});

ipcMain.on('collection-delete', async (event, name) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  const result = await dialog.showMessageBox(ctx.collectionManagerWindow || ctx.window, {
    type: 'question',
    message: 'Delete Collection',
    detail: `Are you sure you want to delete the collection "${name}"?`,
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
  });

  if (result.response !== 1) return;

  ctx.window.webContents.send('undo-begin', `Delete collection ${name}`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const index = collections.findIndex(c => c.name === name);
  if (index !== -1) {
    collections.splice(index, 1);
    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ctx.window.webContents.send('undo-end');

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }
});

ipcMain.on('collection-rename', async (event, oldName, newName) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', `Rename collection ${oldName}`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const collection = collections.find(c => c.name === oldName);
  if (collection) {
    collection.name = newName;
    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ctx.window.webContents.send('undo-end');

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }
});

ipcMain.on('collection-move-up', async (event, name) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', `Move collection ${name} up`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const index = collections.findIndex(c => c.name === name);
  if (index > 0) {
    const [collection] = collections.splice(index, 1);
    collections.splice(index - 1, 0, collection);
    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ctx.window.webContents.send('undo-end');

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }
});

ipcMain.on('collection-move-down', async (event, name) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', `Move collection ${name} down`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const index = collections.findIndex(c => c.name === name);
  if (index !== -1 && index < collections.length - 1) {
    const [collection] = collections.splice(index, 1);
    collections.splice(index + 1, 0, collection);
    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ctx.window.webContents.send('undo-end');

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }
});

ipcMain.on('collection-reorder', async (event, names) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', 'Reorder collections');
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const collectionMap = new Map(collections.map(c => [c.name, c]));
  const reordered = names.map(name => collectionMap.get(name)).filter(Boolean);

  await fs.promises.writeFile(collectionsPath, JSON.stringify(reordered, null, 2));
  ctx.hasExternalChanges = true;
  ctx.markDirty();

  ctx.window.webContents.send('undo-end');
  ctx.window.webContents.send('collections-reordered', { collections: reordered });
});

ipcMain.on('collection-save-editor', async (event, data) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', `Edit collection ${data.originalName}`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const collection = collections.find(c => c.name === data.originalName);
  if (collection) {
    if (data.newName && data.newName !== data.originalName) {
      collection.name = data.newName;
    }
    collection.items = data.items;
    collection.fire_events = data.fire_events;
    collection.stop_single_events = data.stop_single_events;
    collection.group_elements = data.group_elements;

    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ctx.window.webContents.send('undo-end');

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }
});

ipcMain.on('notify-collections-changed', (event, collections, selectCollection) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx?.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections, selectCollection });
  }
});

ipcMain.on('open-collection-editor', async (event, collectionName) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;
  if (collectionEditorWindow) {
    collectionEditorWindow.focus();
    return;
  }
  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const collection = collections.find(c => c.name === collectionName);
  if (!collection) return;

  const gameitemsDir = `${ctx.extractedDir}/gameitems`;
  const allItems = [];
  if (fs.existsSync(gameitemsDir)) {
    const files = await fs.promises.readdir(gameitemsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const itemPath = path.join(gameitemsDir, file);
        const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
        const item = JSON.parse(itemContent);
        const itemType = Object.keys(item)[0];
        if (itemType !== 'Decal') {
          allItems.push(getItemNameFromFileName(file));
        }
      }
    }
  }
  allItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const includedItems = [...collection.items];
  const availableItems = allItems.filter(name => !includedItems.includes(name));

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  collectionEditorWindow = new BrowserWindow({
    width: 650,
    height: 500,
    title: 'Edit Collection',
    show: false,
    minimizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  collectionEditorContext = ctx;

  if (ctx.collectionManagerWindow && !ctx.collectionManagerWindow.isDestroyed()) {
    ctx.collectionManagerWindow.webContents.send('set-editor-open', true);
  }

  createMenu();
  setupDialogEditMenu(collectionEditorWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/dialogs/collection-editor-window.html');
    collectionEditorWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    collectionEditorWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/src/windows/dialogs/collection-editor-window.html'),
      { query: themeQuery }
    );
  }

  collectionEditorWindow.on('closed', () => {
    if (
      collectionEditorContext?.collectionManagerWindow &&
      !collectionEditorContext.collectionManagerWindow.isDestroyed()
    ) {
      collectionEditorContext.collectionManagerWindow.webContents.send('set-editor-open', false);
    }
    collectionEditorWindow = null;
    collectionEditorContext = null;
    createMenu();
  });

  collectionEditorWindow.webContents.on('did-finish-load', () => {
    collectionEditorWindow.webContents.send('init-collection-editor', {
      collectionName: collection.name,
      includedItems,
      availableItems,
      existingNames: collections.map(c => c.name),
      fireEvents: collection.fire_events ?? false,
      stopSingle: collection.stop_single_events ?? false,
      groupElements: collection.group_elements ?? false,
    });
    collectionEditorWindow.show();
  });
});

ipcMain.on('collection-editor-cancel', () => {
  if (collectionEditorWindow) {
    collectionEditorWindow.close();
  }
});

ipcMain.on('collection-editor-save', async (event, data) => {
  const ctx = collectionEditorContext;
  if (!ctx?.extractedDir) return;

  ctx.window.webContents.send('undo-begin', `Edit collection ${data.originalName}`);
  ctx.window.webContents.send('undo-mark-collections');

  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const collection = collections.find(c => c.name === data.originalName);
  if (collection) {
    if (data.newName && data.newName !== data.originalName) {
      const nameExists = collections.some(c => c.name === data.newName);
      if (nameExists) {
        ctx.window.webContents.send('undo-cancel');
        collectionEditorWindow?.close();
        return;
      }
      collection.name = data.newName;
    }
    collection.items = data.items;
    collection.fire_events = data.fire_events;
    collection.stop_single_events = data.stop_single_events;
    collection.group_elements = data.group_elements;

    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ctx.window.webContents.send('undo-end');
  ctx.window.webContents.send('collections-updated', collections);

  if (ctx.collectionManagerWindow) {
    ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
  }

  if (collectionEditorWindow) {
    collectionEditorWindow.close();
  }
});

ipcMain.on('open-collection-prompt', async (event, mode, currentName) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return;
  if (collectionPromptWindow) {
    collectionPromptWindow.focus();
    return;
  }

  collectionPromptContext = ctx;
  collectionPromptMode = mode;
  collectionPromptCurrentName = currentName || '';
  const collectionsPath = `${ctx.extractedDir}/collections.json`;
  let collections = [];
  if (fs.existsSync(collectionsPath)) {
    const content = await fs.promises.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content);
  }

  const existingNames = collections.map(c => c.name);

  let defaultValue = '';
  let title = 'New Collection';
  if (mode === 'new') {
    const baseName = 'Collection';
    let suggestedName = baseName;
    let counter = 1;
    while (existingNames.includes(suggestedName)) {
      suggestedName = `${baseName}_${counter++}`;
    }
    defaultValue = suggestedName;
    title = 'New Collection';
  } else if (mode === 'rename') {
    defaultValue = currentName;
    title = 'Rename Collection';
  }

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  collectionPromptWindow = new BrowserWindow({
    width: 380,
    height: 160,
    title: title,
    show: false,
    minimizable: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (
    collectionPromptContext?.collectionManagerWindow &&
    !collectionPromptContext.collectionManagerWindow.isDestroyed()
  ) {
    collectionPromptContext.collectionManagerWindow.webContents.send('set-editor-open', true);
  }

  createMenu();
  setupDialogEditMenu(collectionPromptWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/dialogs/collection-prompt-window.html');
    collectionPromptWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    collectionPromptWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/src/windows/dialogs/collection-prompt-window.html'),
      { query: themeQuery }
    );
  }

  collectionPromptWindow.on('closed', () => {
    const editorStillOpen = collectionEditorWindow && !collectionEditorWindow.isDestroyed();
    if (
      collectionPromptContext?.collectionManagerWindow &&
      !collectionPromptContext.collectionManagerWindow.isDestroyed() &&
      !editorStillOpen
    ) {
      collectionPromptContext.collectionManagerWindow.webContents.send('set-editor-open', false);
    }
    collectionPromptWindow = null;
    collectionPromptContext = null;
    collectionPromptMode = null;
    collectionPromptCurrentName = null;
    createMenu();
  });

  collectionPromptWindow.webContents.on('did-finish-load', () => {
    collectionPromptWindow.webContents.send('init-collection-prompt', {
      mode,
      currentName: currentName || '',
      defaultValue,
      existingNames,
    });
    collectionPromptWindow.show();
  });
});

ipcMain.on('collection-prompt-cancel', () => {
  if (collectionPromptWindow) {
    collectionPromptWindow.close();
  }
});

ipcMain.on('collection-prompt-submit', async (event, name) => {
  const ctx = collectionPromptContext;
  if (!ctx?.extractedDir) return;

  if (collectionPromptMode === 'new') {
    ctx.window.webContents.send('undo-begin', `Create collection ${name}`);
    ctx.window.webContents.send('undo-mark-collections');

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    collections.push({
      name,
      items: [],
      fire_events: false,
      stop_single_events: false,
      group_elements: true,
    });

    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    ctx.hasExternalChanges = true;
    ctx.markDirty();

    ctx.window.webContents.send('undo-end');
    ctx.window.webContents.send('collections-updated', collections);

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
    }
  } else if (collectionPromptMode === 'rename') {
    ctx.window.webContents.send('undo-begin', `Rename collection ${collectionPromptCurrentName}`);
    ctx.window.webContents.send('undo-mark-collections');

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    const collection = collections.find(c => c.name === collectionPromptCurrentName);
    if (collection) {
      collection.name = name;
      await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
      ctx.hasExternalChanges = true;
      ctx.markDirty();
    }

    ctx.window.webContents.send('undo-end');
    ctx.window.webContents.send('collections-updated', collections);

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
    }
  }

  if (collectionPromptWindow) {
    collectionPromptWindow.close();
  }
});

ipcMain.on('show-rename-dialog', async (event, data) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return;
  if (renamePromptWindow) {
    renamePromptWindow.focus();
    return;
  }

  renamePromptData = {
    ctx,
    mode: data.mode,
    currentName: data.currentName,
    existingNames: data.existingNames || [],
  };

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  const title = data.mode === 'table' ? 'Rename Table' : 'Rename';
  renamePromptWindow = new BrowserWindow({
    width: 380,
    height: 160,
    title: title,
    show: false,
    minimizable: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });
  createMenu();
  setupDialogEditMenu(renamePromptWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/dialogs/rename-prompt-window.html');
    renamePromptWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    renamePromptWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/src/windows/dialogs/rename-prompt-window.html'),
      { query: themeQuery }
    );
  }

  renamePromptWindow.on('closed', () => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', false);
    });
    renamePromptWindow = null;
    renamePromptData = null;
    createMenu();
  });

  renamePromptWindow.webContents.on('did-finish-load', () => {
    renamePromptWindow.webContents.send('init-rename-prompt', {
      mode: data.mode,
      currentName: data.currentName,
      defaultValue: data.currentName,
      existingNames: data.existingNames || [],
    });
    renamePromptWindow.show();
  });
});

ipcMain.on('rename-prompt-cancel', () => {
  if (renamePromptWindow) {
    renamePromptWindow.close();
  }
});

ipcMain.on('rename-prompt-submit', async (event, newName) => {
  if (!renamePromptData) return;

  const { ctx, mode, currentName } = renamePromptData;

  ctx.window.webContents.send('rename-submitted', {
    mode,
    oldName: currentName,
    newName,
  });

  if (renamePromptWindow) {
    renamePromptWindow.close();
  }
});

ipcMain.on('drawing-order-data', (event, data) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx) return;
  openDrawingOrderWindow(ctx, data.mode, data.items);
});

ipcMain.on('save-drawing-order', async (event, data) => {
  const ctx = drawingOrderWindowContext;
  if (!ctx?.extractedDir) return;

  try {
    const gameitemsPath = `${ctx.extractedDir}/gameitems.json`;
    const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);

    const itemNameToIndex = {};
    for (let i = 0; i < gameitems.length; i++) {
      itemNameToIndex[getItemNameFromFileName(gameitems[i].file_name)] = i;
    }

    const indicesToMove = data.order.map(name => itemNameToIndex[name]).filter(i => i !== undefined);
    if (indicesToMove.length >= 2) {
      const minIndex = Math.min(...indicesToMove);
      const movedItems = indicesToMove.map(i => gameitems[i]);
      const newGameitems = gameitems.filter((_, i) => !indicesToMove.includes(i));

      for (let i = 0; i < movedItems.length; i++) {
        newGameitems.splice(minIndex + i, 0, movedItems[movedItems.length - 1 - i]);
      }

      ctx.window.webContents.send('undo-begin', 'Change drawing order');
      ctx.window.webContents.send('undo-mark-gameitems-list');
      await fs.promises.writeFile(gameitemsPath, JSON.stringify(newGameitems, null, 2));
      ctx.window.webContents.send('gameitems-changed', newGameitems);
      ctx.window.webContents.send('undo-end');

      ctx.hasExternalChanges = true;
      ctx.markDirty();
    }
  } catch (err) {
    console.error('Error saving drawing order:', err);
  }

  if (drawingOrderWindow) {
    drawingOrderWindow.close();
  }
});

ipcMain.on('drawing-order-cancel', () => {
  if (drawingOrderWindow) {
    drawingOrderWindow.close();
  }
});

ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('send-mail', async (event, email) => {
  try {
    await shell.openExternal(`mailto:${email}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('apply-dimensions', async (event, dimensions) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  try {
    const gamedataPath = `${ctx.extractedDir}/gamedata.json`;
    const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
    const gamedata = JSON.parse(gamedataContent);

    if (dimensions.width > 0) gamedata.right = dimensions.width;
    if (dimensions.height > 0) gamedata.bottom = dimensions.height;
    if (dimensions.glassTop > 0) gamedata.glass_top_height = dimensions.glassTop;
    if (dimensions.glassBottom > 0) gamedata.glass_bottom_height = dimensions.glassBottom;

    await fs.promises.writeFile(gamedataPath, JSON.stringify(gamedata, null, 2));

    ctx.hasExternalChanges = true;
    ctx.markDirty();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-sound', async event => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  const result = await dialog.showOpenDialog(ctx.window, {
    title: 'Import Sound',
    filters: [
      { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'flac'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return null;

  const srcPath = result.filePaths[0];
  const fileName = path.basename(srcPath);
  const name = path.parse(fileName).name;
  const destPath = path.join(ctx.extractedDir, 'sounds', fileName);

  try {
    await fs.promises.copyFile(srcPath, destPath);
    return { success: true, name, originalPath: srcPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-sound', async (event, srcPath, suggestedName) => {
  const ctx = getContextForManagerEvent(event);
  const result = await dialog.showSaveDialog(ctx?.window, {
    title: 'Export Sound',
    defaultPath: suggestedName,
    filters: [
      { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'flac'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return null;

  try {
    await fs.promises.copyFile(srcPath, result.filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-mesh', async (event, primitiveFileName) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  ctx.meshImportPrimitiveFileName = primitiveFileName;

  const options = await openMeshImportWindow(ctx);
  if (!options) {
    return { success: false, error: 'Cancelled' };
  }

  return await performMeshImport(ctx, options);
});

ipcMain.handle('browse-obj-file', async event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  const result = await dialog.showOpenDialog(ctx?.window, {
    title: 'Select OBJ File',
    filters: [
      { name: 'Wavefront OBJ', extensions: ['obj'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
    defaultPath: getLastFolder('Obj'),
  });

  if (result.canceled || !result.filePaths.length) return null;
  setLastFolder('Obj', path.dirname(result.filePaths[0]));
  return { filePath: result.filePaths[0] };
});

async function performMeshImport(ctx, options) {
  if (!ctx?.extractedDir || !ctx?.meshImportPrimitiveFileName) {
    return { success: false, error: 'No table or primitive selected' };
  }

  const destFileName = ctx.meshImportPrimitiveFileName.replace('.json', '.obj');
  const destPath = path.join(ctx.extractedDir, destFileName);
  const primitivePath = path.join(ctx.extractedDir, ctx.meshImportPrimitiveFileName);

  try {
    const objContent = await fs.promises.readFile(options.filePath, 'utf-8');
    const lines = objContent.split('\n');

    const vertices = [];
    const normals = [];
    const texCoords = [];
    const faces = [];
    const otherLines = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'v' && parts.length >= 4) {
        let x = parseFloat(parts[1]) || 0;
        let y = parseFloat(parts[2]) || 0;
        let z = parseFloat(parts[3]) || 0;
        if (options.convertCoords) {
          z = -z;
        }
        vertices.push({ x, y, z });
      } else if (parts[0] === 'vn' && parts.length >= 4) {
        let nx = parseFloat(parts[1]) || 0;
        let ny = parseFloat(parts[2]) || 0;
        let nz = parseFloat(parts[3]) || 0;
        if (options.convertCoords) {
          nz = -nz;
        }
        normals.push({ x: nx, y: ny, z: nz });
      } else if (parts[0] === 'vt' && parts.length >= 3) {
        const u = parseFloat(parts[1]) || 0;
        const v = parseFloat(parts[2]) || 0;
        texCoords.push({ u, v });
      } else if (parts[0] === 'f') {
        faces.push(line.trim());
      } else {
        otherLines.push(line);
      }
    }

    let midPoint = { x: 0, y: 0, z: 0 };
    if (vertices.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      for (const v of vertices) {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
        minZ = Math.min(minZ, v.z);
        maxZ = Math.max(maxZ, v.z);
      }
      midPoint = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      };
    }

    if (options.centerMesh || options.absolutePosition) {
      for (const v of vertices) {
        v.x -= midPoint.x;
        v.y -= midPoint.y;
        v.z -= midPoint.z;
      }
    }

    const needsTexCoords = texCoords.length === 0 && vertices.length > 0;
    if (needsTexCoords) {
      for (let i = 0; i < vertices.length; i++) {
        texCoords.push({ u: 0, v: 0 });
      }
    }

    let outputLines = [];
    outputLines.push('# Imported by VPX Editor');
    outputLines.push('o mesh');
    for (const v of vertices) {
      outputLines.push(`v ${v.x} ${v.y} ${v.z}`);
    }
    for (const vt of texCoords) {
      outputLines.push(`vt ${vt.u} ${vt.v}`);
    }
    for (const vn of normals) {
      outputLines.push(`vn ${vn.x} ${vn.y} ${vn.z}`);
    }
    for (const f of faces) {
      const parts = f.split(/\s+/);
      if (parts[0] !== 'f' || parts.length < 4) {
        outputLines.push(f);
        continue;
      }

      const faceVerts = parts.slice(1).map(vert => {
        const indices = vert.split('/');
        const vi = indices[0];
        let vti = indices[1] || '';
        const vni = indices[2] !== undefined ? indices[2] : indices[1] || '';
        if (needsTexCoords && vti === '') {
          vti = vi;
        }
        return `${vi}/${vti}/${vni}`;
      });

      if (options.convertCoords) {
        faceVerts.reverse();
      }
      outputLines.push(`f ${faceVerts.join(' ')}`);
    }

    await fs.promises.writeFile(destPath, outputLines.join('\n'));

    const primContent = await fs.promises.readFile(primitivePath, 'utf-8');
    const primData = JSON.parse(primContent);
    const primType = Object.keys(primData)[0];
    const prim = primData[primType];

    prim.use_3d_mesh = true;

    if (options.absolutePosition) {
      prim.position = { x: midPoint.x, y: midPoint.y, z: midPoint.z };
      prim.size = { x: 1, y: 1, z: 1 };
    }

    if (options.importMaterial) {
      const mtlPath = options.filePath.replace(/\.obj$/i, '.mtl');
      try {
        const mtlContent = await fs.promises.readFile(mtlPath, 'utf-8');
        const material = parseMtlFile(mtlContent);
        if (material) {
          await addMaterialToTable(ctx.extractedDir, material);
          prim.material = material.name;
        }
      } catch (mtlErr) {
        console.warn('Could not load material file:', mtlErr.message);
      }
    }

    await fs.promises.writeFile(primitivePath, JSON.stringify(primData, null, 2));

    ctx.window.webContents.send('mesh-imported', {
      primitiveFileName: ctx.meshImportPrimitiveFileName,
      options,
    });

    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function parseMtlFile(content) {
  const lines = content.split('\n');
  let material = null;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'newmtl' && parts[1]) {
      material = {
        name: parts[1],
        type_: 'Basic',
        base_color: '#808080',
        glossy_color: '#000000',
        clearcoat_color: '#000000',
        wrap_lighting: 0.5,
        roughness: 0.5,
        glossy_image_lerp: 1.0,
        thickness: 0.05,
        edge: 1.0,
        edge_alpha: 1.0,
        opacity: 1.0,
        opacity_active: true,
        refraction_tint: '#ffffff',
        elasticity: 0.3,
        elasticity_falloff: 0.0,
        friction: 0.3,
        scatter_angle: 0.0,
      };
    } else if (material) {
      if (parts[0] === 'Kd' && parts.length >= 4) {
        const r = Math.round((parseFloat(parts[1]) || 0) * 255);
        const g = Math.round((parseFloat(parts[2]) || 0) * 255);
        const b = Math.round((parseFloat(parts[3]) || 0) * 255);
        material.base_color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } else if (parts[0] === 'Ks' && parts.length >= 4) {
        const r = Math.round((parseFloat(parts[1]) || 0) * 255);
        const g = Math.round((parseFloat(parts[2]) || 0) * 255);
        const b = Math.round((parseFloat(parts[3]) || 0) * 255);
        material.glossy_color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } else if (parts[0] === 'Ns') {
        const ns = parseFloat(parts[1]) || 0;
        material.roughness = Math.max(0, Math.min(1, 0.5 + ns / 2000.0));
      } else if (parts[0] === 'd') {
        material.opacity = parseFloat(parts[1]) || 1.0;
      }
    }
  }

  return material;
}

async function addMaterialToTable(extractedDir, material) {
  const materialsPath = path.join(extractedDir, 'materials.json');
  try {
    const content = await fs.promises.readFile(materialsPath, 'utf-8');
    const materials = JSON.parse(content);

    const existing = materials.find(m => m.name === material.name);
    if (!existing) {
      materials.push(material);
      await fs.promises.writeFile(materialsPath, JSON.stringify(materials, null, 2));
    }
  } catch (err) {
    const materials = [material];
    await fs.promises.writeFile(materialsPath, JSON.stringify(materials, null, 2));
  }
}

ipcMain.handle('export-mesh', async (event, primitiveFileName, suggestedName) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  const srcFileName = primitiveFileName.replace('.json', '.obj');
  const srcPath = path.join(ctx.extractedDir, srcFileName);

  try {
    await fs.promises.access(srcPath);
  } catch {
    return { success: false, error: 'No mesh file found for this primitive' };
  }

  const defaultPath = path.join(getLastFolder('Obj'), suggestedName || srcFileName);
  const result = await dialog.showSaveDialog(ctx.window, {
    title: 'Export Mesh',
    defaultPath,
    filters: [
      { name: 'Wavefront OBJ', extensions: ['obj'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return { success: false };

  setLastFolder('Obj', path.dirname(result.filePath));
  try {
    await fs.promises.copyFile(srcPath, result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-item-material', async (event, itemName, itemType, oldMaterial, newMaterial) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  try {
    const gameitemsPath = path.join(ctx.extractedDir, 'gameitems.json');
    const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);

    const itemInfo = gameitems.find(i => i.file_name && getItemNameFromFileName(i.file_name) === itemName);
    if (!itemInfo) return { success: false, error: 'Item not found' };

    const itemPath = path.join(ctx.extractedDir, 'gameitems', itemInfo.file_name);
    const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
    const itemData = JSON.parse(itemContent);

    const type = Object.keys(itemData)[0];
    const item = itemData[type];

    const materialProps = {
      Wall: ['top_material', 'side_material', 'slingshot_material', 'physics_material'],
      Surface: ['top_material', 'side_material', 'slingshot_material', 'physics_material'],
      Flipper: ['material', 'rubber_material'],
      Bumper: ['cap_material', 'base_material', 'socket_material', 'ring_material'],
      Ramp: ['material', 'physics_material'],
      Spinner: ['material'],
      Gate: ['material'],
      Plunger: ['material'],
      Kicker: ['material'],
      Trigger: ['material'],
      Light: ['material'],
      HitTarget: ['material', 'physics_material'],
      Rubber: ['material', 'physics_material'],
      Primitive: ['material', 'physics_material'],
      Decal: ['material'],
    };

    const props = materialProps[itemType] || [];
    for (const prop of props) {
      if (item[prop] === oldMaterial) {
        item[prop] = newMaterial;
      }
    }

    await fs.promises.writeFile(itemPath, JSON.stringify(itemData, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('script-changed', (event, script) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('script-changed', script);
  }
});

async function getTableState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}/gamedata.json`, 'utf-8');
    const gamedata = JSON.parse(gamedataContent);

    const imagesContent = await fs.promises.readFile(`${ctx.extractedDir}/images.json`, 'utf-8');
    const imagesArray = JSON.parse(imagesContent);
    const images = {};
    for (const img of imagesArray) {
      images[img.name] = img;
    }

    const gameitemsContent = await fs.promises.readFile(`${ctx.extractedDir}/gameitems.json`, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);

    const items = {};
    for (const itemInfo of gameitems) {
      const itemPath = `${ctx.extractedDir}/gameitems/${itemInfo.file_name}`;
      try {
        const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
        const itemData = JSON.parse(itemContent);
        const type = Object.keys(itemData)[0];
        const item = itemData[type];
        item._type = type;
        items[item.name || itemInfo.file_name] = item;
      } catch (e) {
        // Skip failed items
      }
    }

    return { extractedDir: ctx.extractedDir, gamedata, images, items, theme: getActualTheme(settings.theme) };
  } catch (e) {
    return null;
  }
}

function openImageManagerWindow() {
  windowFactory.openImageManagerWindow();
}

async function getSearchSelectState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const gameitemsContent = await fs.promises.readFile(`${ctx.extractedDir}/gameitems.json`, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);
    const items = {};

    for (const gi of gameitems) {
      const itemPath = `${ctx.extractedDir}/gameitems/${gi.file_name}`;
      try {
        const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
        const itemData = JSON.parse(itemContent);
        const type = Object.keys(itemData)[0];
        const item = itemData[type];
        item._type = type;
        item._fileName = `gameitems/${gi.file_name}`;
        item._layer = gi.editor_layer || 0;
        item._layerName = gi.editor_layer_name || '';
        items[item.name] = item;
      } catch (e) {
        console.error(`Failed to read item ${gi.file_name}:`, e.message);
      }
    }

    let collections = [];
    try {
      const collectionsContent = await fs.promises.readFile(`${ctx.extractedDir}/collections.json`, 'utf-8');
      collections = JSON.parse(collectionsContent);
    } catch (e) {
      console.log('No collections.json found');
    }

    return {
      extractedDir: ctx.extractedDir,
      items,
      collections,
      theme: getActualTheme(settings.theme),
      tableName: ctx.currentTablePath ? path.basename(ctx.currentTablePath, '.vpx') : 'Table',
    };
  } catch (err) {
    console.error('Failed to get search select state:', err);
    return null;
  }
}

async function showSearchSelect() {
  windowFactory.showSearchSelect();
}

const searchSelectUpdateTimers = new Map();
function updateSearchSelectWindow(ctx) {
  if (!ctx?.searchSelectWindow) return;
  if (searchSelectUpdateTimers.has(ctx.id)) {
    clearTimeout(searchSelectUpdateTimers.get(ctx.id));
  }
  searchSelectUpdateTimers.set(
    ctx.id,
    setTimeout(async () => {
      searchSelectUpdateTimers.delete(ctx.id);
      if (!ctx.searchSelectWindow || ctx.searchSelectWindow.isDestroyed()) return;
      const state = await getSearchSelectState(ctx);
      if (state) {
        ctx.searchSelectWindow.webContents.send('update', state);
      }
    }, 100)
  );
}

let collectionEditorUpdateTimer = null;
function updateCollectionEditorWindow(ctx) {
  if (!collectionEditorWindow || collectionEditorWindow.isDestroyed()) return;
  if (collectionEditorUpdateTimer) {
    clearTimeout(collectionEditorUpdateTimer);
  }
  collectionEditorUpdateTimer = setTimeout(async () => {
    collectionEditorUpdateTimer = null;
    if (!collectionEditorWindow || collectionEditorWindow.isDestroyed()) return;
    if (!ctx?.extractedDir) return;

    const gameitemsDir = `${ctx.extractedDir}/gameitems`;
    const allItems = [];
    if (fs.existsSync(gameitemsDir)) {
      const files = await fs.promises.readdir(gameitemsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const itemPath = path.join(gameitemsDir, file);
          const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
          const item = JSON.parse(itemContent);
          const itemType = Object.keys(item)[0];
          if (itemType !== 'Decal') {
            allItems.push(getItemNameFromFileName(file));
          }
        }
      }
    }
    allItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    collectionEditorWindow.webContents.send('update-items', {
      allItems,
      existingNames: collections.map(c => c.name),
    });
  }, 100);
}

function showDrawingOrder(mode) {
  const ctx = windowRegistry.getFocused();
  if (!ctx?.extractedDir) return;
  ctx.window.webContents.send('request-drawing-order-data', mode);
}

async function getMaterialsState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const materialsContent = await fs.promises.readFile(`${ctx.extractedDir}/materials.json`, 'utf-8');
    const materialsArray = JSON.parse(materialsContent);
    const materials = {};
    for (const mat of materialsArray) {
      materials[mat.name] = mat;
    }

    const gameitemsContent = await fs.promises.readFile(`${ctx.extractedDir}/gameitems.json`, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);

    const items = {};
    for (const itemInfo of gameitems) {
      const itemPath = `${ctx.extractedDir}/gameitems/${itemInfo.file_name}`;
      try {
        const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
        const itemData = JSON.parse(itemContent);
        const type = Object.keys(itemData)[0];
        const item = itemData[type];
        item._type = type;
        items[item.name || itemInfo.file_name] = item;
      } catch (e) {}
    }

    return { extractedDir: ctx.extractedDir, materials, items, theme: getActualTheme(settings.theme) };
  } catch (e) {
    console.error('getMaterialsState error:', e);
    return null;
  }
}

function openMaterialManagerWindow() {
  windowFactory.openMaterialManagerWindow();
}

async function getSoundsState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const soundsContent = await fs.promises.readFile(`${ctx.extractedDir}/sounds.json`, 'utf-8');
    const sounds = JSON.parse(soundsContent);
    return { extractedDir: ctx.extractedDir, sounds, theme: getActualTheme(settings.theme) };
  } catch (e) {
    console.error('getSoundsState error:', e);
    return null;
  }
}

function openSoundManagerWindow() {
  windowFactory.openSoundManagerWindow();
}

async function getTableInfoState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const infoContent = await fs.promises.readFile(`${ctx.extractedDir}/info.json`, 'utf-8');
    const info = JSON.parse(infoContent);

    const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}/gamedata.json`, 'utf-8');
    const gamedata = JSON.parse(gamedataContent);

    const imagesContent = await fs.promises.readFile(`${ctx.extractedDir}/images.json`, 'utf-8');
    const images = JSON.parse(imagesContent);

    return { extractedDir: ctx.extractedDir, info, gamedata, images, theme: settings.theme };
  } catch (e) {
    console.error('getTableInfoState error:', e);
    return null;
  }
}

async function openTableInfoWindow() {
  if (tableInfoWindow) {
    tableInfoWindow.focus();
    return;
  }

  const ctx = windowRegistry.getFocused();
  if (!ctx?.extractedDir) {
    dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
    return;
  }

  const state = await getTableInfoState(ctx);
  if (!state) return;

  tableInfoWindowContext = ctx;

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  const tblInfoTitle = ctx.tableName ? `Table Info - [${ctx.tableName}.vpx]` : 'Table Info';
  tableInfoWindow = new BrowserWindow({
    width: 500,
    height: 650,
    title: tblInfoTitle,
    show: false,
    resizable: true,
    minimizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });

  createMenu();

  setupDialogEditMenu(tableInfoWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/settings/table-info-window.html');
    tableInfoWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    tableInfoWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/src/windows/settings/table-info-window.html'),
      {
        query: themeQuery,
      }
    );
  }

  tableInfoWindow.on('closed', () => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', false);
    });
    tableInfoWindow = null;
    tableInfoWindowContext = null;
    createMenu();
  });

  tableInfoWindow.webContents.on('did-finish-load', () => {
    tableInfoWindow.webContents.send('init-table-info', {
      info: state.info,
      gamedata: state.gamedata,
      images: state.images,
    });
    tableInfoWindow.show();
  });
}

function openMeshImportWindow(ctx) {
  return new Promise(resolve => {
    if (meshImportWindow) {
      meshImportWindow.focus();
      return;
    }

    meshImportResolve = resolve;
    meshImportWindowContext = ctx;

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    meshImportWindow = new BrowserWindow({
      width: 520,
      height: 300,
      title: 'Wavefront OBJ Importer',
      show: false,
      resizable: false,
      minimizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', true);
    });

    createMenu();

    setupDialogEditMenu(meshImportWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      meshImportWindow.loadFile(path.join(process.cwd(), 'src/windows/dialogs/mesh-import-window.html'), {
        query: themeQuery,
      });
    } else {
      meshImportWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/dialogs/mesh-import-window.html'),
        { query: themeQuery }
      );
    }

    meshImportWindow.on('closed', () => {
      windowRegistry.forEach(c => {
        c.window.webContents.send('set-input-disabled', false);
      });
      meshImportWindow = null;
      meshImportWindowContext = null;
      if (meshImportResolve) {
        meshImportResolve(null);
        meshImportResolve = null;
      }
      createMenu();
    });

    meshImportWindow.webContents.on('did-finish-load', () => {
      meshImportWindow.show();
    });
  });
}

function openDrawingOrderWindow(ctx, mode, items) {
  if (drawingOrderWindow) {
    drawingOrderWindow.focus();
    return;
  }

  drawingOrderWindowContext = ctx;

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  drawingOrderWindow = new BrowserWindow({
    width: 500,
    height: 550,
    title: mode === 'hit' ? 'Drawing Order (Hit)' : 'Drawing Order (Select)',
    show: false,
    resizable: true,
    minimizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });

  createMenu();

  setupDialogEditMenu(drawingOrderWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    drawingOrderWindow.loadFile(path.join(process.cwd(), 'src/windows/settings/drawing-order-window.html'), {
      query: themeQuery,
    });
  } else {
    drawingOrderWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/src/windows/settings/drawing-order-window.html'),
      { query: themeQuery }
    );
  }

  drawingOrderWindow.on('closed', () => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', false);
    });
    drawingOrderWindow = null;
    drawingOrderWindowContext = null;
    createMenu();
  });

  drawingOrderWindow.webContents.on('did-finish-load', () => {
    drawingOrderWindow.webContents.send('init-drawing-order', { mode, items });
    drawingOrderWindow.show();
  });
}

async function getDimensionsState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}/gamedata.json`, 'utf-8');
    const gamedata = JSON.parse(gamedataContent);
    return { gamedata, theme: getActualTheme(settings.theme) };
  } catch (e) {
    console.error('getDimensionsState error:', e);
    return null;
  }
}

async function openDimensionsManagerWindow() {
  windowFactory.openDimensionsManagerWindow();
}

function openCollectionManagerWindow() {
  windowFactory.openCollectionManagerWindow();
}

async function getCollectionManagerData(ctx) {
  if (!ctx?.extractedDir) return { collections: [], items: {}, selectedItems: [] };

  try {
    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    const gameitemsDir = `${ctx.extractedDir}/gameitems`;
    const items = {};
    if (fs.existsSync(gameitemsDir)) {
      const files = await fs.promises.readdir(gameitemsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const itemPath = path.join(gameitemsDir, file);
          const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
          const item = JSON.parse(itemContent);
          const itemType = Object.keys(item)[0];
          items[getItemNameFromFileName(file)] = { _type: itemType };
        }
      }
    }

    return { collections, items, selectedItems: [] };
  } catch (err) {
    console.error('Error loading collection manager data:', err);
    return { collections: [], items: {}, selectedItems: [] };
  }
}

async function getRenderProbesState(ctx) {
  if (!ctx?.extractedDir) return null;

  try {
    const probesPath = `${ctx.extractedDir}/renderprobes.json`;
    let probes = [];

    if (fs.existsSync(probesPath)) {
      const content = await fs.promises.readFile(probesPath, 'utf-8');
      probes = JSON.parse(content);
    }

    const probesMap = {};
    for (const probe of probes) {
      probesMap[probe.name] = probe;
    }

    return { extractedDir: ctx.extractedDir, probes: probesMap, theme: getActualTheme(settings.theme) };
  } catch (e) {
    console.error('getRenderProbesState error:', e);
    return null;
  }
}

function openRenderProbeManagerWindow() {
  windowFactory.openRenderProbeManagerWindow();
}

async function getScriptContent(ctx) {
  if (!ctx?.extractedDir) return null;
  try {
    const scriptPath = `${ctx.extractedDir}/script.vbs`;
    const content = await fs.promises.readFile(scriptPath, 'utf-8');
    return content;
  } catch (e) {
    return '';
  }
}

function openScriptEditorWindow(ctx) {
  windowFactory.openScriptEditorWindow(ctx);
}

ipcMain.handle('save-script', async (event, content) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };
  try {
    const scriptPath = `${ctx.extractedDir}/script.vbs`;
    let oldContent = '';
    try {
      oldContent = await fs.promises.readFile(scriptPath, 'utf-8');
    } catch (e) {}

    await fs.promises.writeFile(scriptPath, content, 'utf-8');

    if (ctx.window && oldContent !== content) {
      ctx.window.webContents.send('record-script-change', oldContent, content);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('script-editor-unsaved-changes-dialog', async event => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(senderWindow, {
    type: 'warning',
    buttons: ['Discard', 'Cancel'],
    defaultId: 1,
    title: 'Unsaved Changes',
    message: 'You have unsaved changes.',
    detail: 'Do you want to discard them?',
  });
  return result.response === 0;
});

let settingsWindow = null;
let transformWindow = null;
let transformWindowContext = null;
let aboutWindow = null;
let tableInfoWindow = null;
let tableInfoWindowContext = null;
let collectionEditorWindow = null;
let collectionEditorContext = null;
let collectionPromptWindow = null;
let collectionPromptContext = null;
let collectionPromptMode = null;
let collectionPromptCurrentName = null;
let renamePromptWindow = null;
let renamePromptData = null;
let promptWindow = null;
let promptResolve = null;
let infoWindow = null;
let infoResolve = null;
let confirmWindow = null;
let confirmResolve = null;
let workFolderWindow = null;
let workFolderResolve = null;
let meshImportWindow = null;
let meshImportResolve = null;
let meshImportWindowContext = null;
let drawingOrderWindow = null;
let drawingOrderWindowContext = null;

const windowFactory = createWindowFactory({
  windowRegistry,
  settings,
  getActualTheme,
  createMenu,
  MAIN_WINDOW_VITE_DEV_SERVER_URL,
  MAIN_WINDOW_VITE_NAME,
  isCollectionEditorOpen: () => collectionEditorWindow && !collectionEditorWindow.isDestroyed(),
  focusCollectionEditor: () => collectionEditorWindow?.focus(),
  isCollectionPromptOpen: () => collectionPromptWindow && !collectionPromptWindow.isDestroyed(),
  focusCollectionPrompt: () => collectionPromptWindow?.focus(),
  getWindowBounds,
  trackWindowBounds,
  WindowContext,
  versionInfo,
  showCloseConfirm,
  saveVPX: () => vpxOps.saveVPX(getVpxOpsDeps()),
  DEFAULT_UNIT_CONVERSION,
});

function getContextForManagerEvent(event) {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) return ctx;
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) return null;
  return windowRegistry.getByChildWindow(senderWindow);
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 620,
    title: 'Settings',
    show: false,
    resizable: false,
    minimizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  windowRegistry.forEach(ctx => {
    ctx.window.webContents.send('set-input-disabled', true);
  });

  createMenu();

  setupDialogEditMenu(settingsWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/settings/settings-window.html');
    settingsWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/main_window/src/windows/settings/settings-window.html'), {
      query: themeQuery,
    });
  }

  settingsWindow.on('closed', () => {
    windowRegistry.forEach(ctx => {
      ctx.window.webContents.send('set-input-disabled', false);
    });
    settingsWindow = null;
    createMenu();
  });

  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('init-settings', {
      theme: settings.theme,
      gridSize: settings.gridSize,
      textureQuality: settings.textureQuality,
      unitConversion: settings.unitConversion ?? DEFAULT_UNIT_CONVERSION,
      vpinballPath: settings.vpinballPath,
      useEmbeddedVpxtool: settings.useEmbeddedVpxtool,
      vpxtoolPath: settings.vpxtoolPath,
      editorColors: settings.editorColors,
      alwaysDrawDragPoints: settings.alwaysDrawDragPoints,
      drawLightCenters: settings.drawLightCenters,
    });
    settingsWindow.show();
  });
}

function openTransformWindow(type, data, ctx) {
  if (transformWindow) {
    transformWindow.focus();
    return;
  }

  transformWindowContext = ctx;

  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'index.js')
    : path.join(process.cwd(), '.vite/build/index.js');

  const windowHeight = type === 'translate' ? 180 : type === 'rotate' ? 250 : 320;

  transformWindow = new BrowserWindow({
    width: 360,
    height: windowHeight,
    title: type.charAt(0).toUpperCase() + type.slice(1),
    show: false,
    resizable: false,
    minimizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  windowRegistry.forEach(c => {
    c.window.webContents.send('set-input-disabled', true);
  });

  createMenu();

  setupDialogEditMenu(transformWindow);

  const themeQuery = { theme: getActualTheme(settings.theme) };
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const htmlPath = path.join(process.cwd(), 'src/windows/settings/transform-window.html');
    transformWindow.loadFile(htmlPath, { query: themeQuery });
  } else {
    transformWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/src/windows/settings/transform-window.html'),
      {
        query: themeQuery,
      }
    );
  }

  transformWindow.on('closed', () => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', false);
    });
    transformWindow = null;
    transformWindowContext = null;
    createMenu();
  });

  transformWindow.webContents.on('did-finish-load', () => {
    transformWindow.webContents.send('init-transform', {
      type,
      centerX: data.centerX,
      centerY: data.centerY,
      mouseX: data.mouseX,
      mouseY: data.mouseY,
    });
    transformWindow.show();
  });
}

ipcMain.on('open-transform', (event, type, data) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    openTransformWindow(type, data, ctx);
  }
});

ipcMain.on('apply-transform', (event, transformData) => {
  if (transformWindowContext) {
    transformWindowContext.window.webContents.send('apply-transform', transformData);
  }
});

ipcMain.on('undo-transform', event => {
  if (transformWindowContext) {
    transformWindowContext.window.webContents.send('undo-transform');
  }
});

ipcMain.on('save-transform', (event, transformData) => {
  if (transformWindowContext) {
    transformWindowContext.window.webContents.send('save-transform', transformData);
  }
  if (transformWindow) {
    transformWindow.close();
  }
});

ipcMain.on('cancel-transform', event => {
  if (transformWindowContext) {
    transformWindowContext.window.webContents.send('cancel-transform');
  }
  if (transformWindow) {
    transformWindow.close();
  }
});

ipcMain.handle('browse-executable', async (event, name) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  const result = await dialog.showOpenDialog(ctx?.window, {
    title: `Select ${name} Executable`,
    properties: ['openFile'],
    filters:
      process.platform === 'darwin'
        ? [{ name: 'Applications', extensions: ['app', '*'] }]
        : [{ name: 'Executables', extensions: ['exe', '*'] }],
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  if (!filePath) return true;
  return await vpxOps.fileExists(filePath);
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  const oldGridSize = settings.gridSize || DEFAULT_GRID_SIZE;
  const newGridSize = newSettings.gridSize || DEFAULT_GRID_SIZE;
  const oldTheme = settings.theme;
  const newTheme = newSettings.theme || DEFAULT_THEME;
  const oldTextureQuality = settings.textureQuality || DEFAULT_TEXTURE_QUALITY;
  const newTextureQuality = newSettings.textureQuality ?? DEFAULT_TEXTURE_QUALITY;
  const oldUnitConversion = settings.unitConversion ?? DEFAULT_UNIT_CONVERSION;
  const newUnitConversion = newSettings.unitConversion ?? DEFAULT_UNIT_CONVERSION;

  settings.gridSize = newGridSize;
  settings.textureQuality = newTextureQuality;
  settings.unitConversion = newUnitConversion;
  settings.vpinballPath = newSettings.vpinballPath;
  settings.useEmbeddedVpxtool = newSettings.useEmbeddedVpxtool;
  settings.vpxtoolPath = newSettings.vpxtoolPath;
  settings.alwaysDrawDragPoints = newSettings.alwaysDrawDragPoints || false;
  settings.drawLightCenters = newSettings.drawLightCenters || false;
  if (newSettings.editorColors) {
    settings.editorColors = { ...DEFAULT_EDITOR_COLORS, ...newSettings.editorColors };
  }

  if (oldTheme !== newTheme) {
    settings.theme = newTheme;
    nativeTheme.themeSource = newTheme;
    const actualTheme = getActualTheme(newTheme);
    windowRegistry.forEach(winCtx => {
      winCtx.window.webContents.send('set-theme', actualTheme);
      if (winCtx.scriptEditorWindow) winCtx.scriptEditorWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.imageManagerWindow) winCtx.imageManagerWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.materialManagerWindow) winCtx.materialManagerWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.soundManagerWindow) winCtx.soundManagerWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.searchSelectWindow) winCtx.searchSelectWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.renderProbeManagerWindow)
        winCtx.renderProbeManagerWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.collectionManagerWindow) winCtx.collectionManagerWindow.webContents.send('theme-changed', actualTheme);
      if (winCtx.dimensionsManagerWindow) winCtx.dimensionsManagerWindow.webContents.send('theme-changed', actualTheme);
    });
    if (settingsWindow) settingsWindow.webContents.send('theme-changed', actualTheme);
    if (transformWindow) transformWindow.webContents.send('theme-changed', actualTheme);
    if (aboutWindow) aboutWindow.webContents.send('theme-changed', actualTheme);
    if (tableInfoWindow) tableInfoWindow.webContents.send('theme-changed', actualTheme);
  }

  saveSettings();

  windowRegistry.forEach(wctx => {
    if (oldGridSize !== newGridSize) {
      wctx.window.webContents.send('grid-size-changed', newGridSize);
    }
    if (oldTextureQuality !== newTextureQuality) {
      wctx.window.webContents.send('texture-quality-changed', newTextureQuality);
    }
    wctx.window.webContents.send('editor-settings-changed', {
      editorColors: settings.editorColors,
      alwaysDrawDragPoints: settings.alwaysDrawDragPoints,
      drawLightCenters: settings.drawLightCenters,
      unitConversion: settings.unitConversion,
    });
  });
  return { success: true };
});

ipcMain.on('reset-window-bounds', () => {
  resetWindowBounds();
  windowRegistry.forEach(ctx => {
    if (ctx.window && !ctx.window.isDestroyed()) ctx.window.center();
    if (ctx.scriptEditorWindow && !ctx.scriptEditorWindow.isDestroyed()) ctx.scriptEditorWindow.center();
    if (ctx.imageManagerWindow && !ctx.imageManagerWindow.isDestroyed()) ctx.imageManagerWindow.center();
    if (ctx.materialManagerWindow && !ctx.materialManagerWindow.isDestroyed()) ctx.materialManagerWindow.center();
    if (ctx.soundManagerWindow && !ctx.soundManagerWindow.isDestroyed()) ctx.soundManagerWindow.center();
    if (ctx.collectionManagerWindow && !ctx.collectionManagerWindow.isDestroyed()) ctx.collectionManagerWindow.center();
    if (ctx.dimensionsManagerWindow && !ctx.dimensionsManagerWindow.isDestroyed()) ctx.dimensionsManagerWindow.center();
    if (ctx.renderProbeManagerWindow && !ctx.renderProbeManagerWindow.isDestroyed())
      ctx.renderProbeManagerWindow.center();
    if (ctx.searchSelectWindow && !ctx.searchSelectWindow.isDestroyed()) ctx.searchSelectWindow.center();
  });
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.center();
});

ipcMain.handle('get-grid-size', () => {
  return settings.gridSize;
});

ipcMain.handle('get-texture-quality', () => {
  return settings.textureQuality;
});

ipcMain.handle('get-editor-settings', () => {
  return {
    editorColors: settings.editorColors,
    alwaysDrawDragPoints: settings.alwaysDrawDragPoints,
    drawLightCenters: settings.drawLightCenters,
    unitConversion: settings.unitConversion ?? DEFAULT_UNIT_CONVERSION,
  };
});

app.whenReady().then(() => {
  loadSettings();
  nativeTheme.themeSource = settings.theme;

  nativeTheme.on('updated', () => {
    const currentThemeSetting = activeThemeSetting || settings.theme;
    if (currentThemeSetting === 'system') {
      const actualTheme = getActualTheme('system');
      windowRegistry.forEach(winCtx => {
        winCtx.window.webContents.send('set-theme', actualTheme);
        if (winCtx.scriptEditorWindow) winCtx.scriptEditorWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.imageManagerWindow) winCtx.imageManagerWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.materialManagerWindow) winCtx.materialManagerWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.soundManagerWindow) winCtx.soundManagerWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.searchSelectWindow) winCtx.searchSelectWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.renderProbeManagerWindow)
          winCtx.renderProbeManagerWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.collectionManagerWindow)
          winCtx.collectionManagerWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.dimensionsManagerWindow)
          winCtx.dimensionsManagerWindow.webContents.send('theme-changed', actualTheme);
      });
      if (settingsWindow) settingsWindow.webContents.send('theme-changed', actualTheme);
      if (transformWindow) transformWindow.webContents.send('theme-changed', actualTheme);
      if (aboutWindow) aboutWindow.webContents.send('theme-changed', actualTheme);
      if (tableInfoWindow) tableInfoWindow.webContents.send('theme-changed', actualTheme);
    }
  });

  createWindow();

  if (pendingFilePath) {
    vpxOps.extractVPX(pendingFilePath, {}, getVpxOpsDeps());
    pendingFilePath = null;
  } else {
    const args = process.argv.slice(app.isPackaged ? 1 : 2);
    const vpxArg = args.find(arg => arg.toLowerCase().endsWith('.vpx'));
    if (vpxArg) {
      vpxOps.extractVPX(vpxArg, {}, getVpxOpsDeps());
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function openPromptWindow(config) {
  return new Promise(resolve => {
    if (promptWindow) {
      promptWindow.focus();
      return;
    }

    promptResolve = resolve;

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    promptWindow = new BrowserWindow({
      width: 380,
      height: 160,
      title: config.title || 'Prompt',
      show: false,
      resizable: false,
      minimizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(promptWindow);

    windowRegistry.forEach(ctx => {
      ctx.window.webContents.send('set-input-disabled', true);
    });
    createMenu();

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      promptWindow.loadFile(path.join(process.cwd(), 'src/windows/dialogs/prompt-window.html'), { query: themeQuery });
    } else {
      promptWindow.loadFile(path.join(__dirname, '../renderer/main_window/src/windows/dialogs/prompt-window.html'), {
        query: themeQuery,
      });
    }

    promptWindow.on('closed', () => {
      windowRegistry.forEach(ctx => {
        ctx.window.webContents.send('set-input-disabled', false);
      });
      promptWindow = null;
      if (promptResolve) {
        promptResolve(null);
        promptResolve = null;
      }
      createMenu();
    });

    promptWindow.webContents.on('did-finish-load', () => {
      promptWindow.webContents.send('init-prompt', config);
      promptWindow.show();
    });
  });
}

ipcMain.on('prompt-result', (event, result) => {
  if (promptResolve) {
    promptResolve(result);
    promptResolve = null;
  }
  if (promptWindow) {
    promptWindow.close();
  }
});

ipcMain.on('mesh-import-result', (event, result) => {
  if (meshImportResolve) {
    meshImportResolve(result);
    meshImportResolve = null;
  }
  if (meshImportWindow) {
    meshImportWindow.close();
  }
});

ipcMain.handle('show-prompt', async (event, config) => {
  return await openPromptWindow(config);
});

function openInfoWindow(config) {
  return new Promise(resolve => {
    if (infoWindow) {
      infoWindow.focus();
      return;
    }

    infoResolve = resolve;

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    infoWindow = new BrowserWindow({
      width: 400,
      height: 200,
      title: config.title || 'Information',
      show: false,
      resizable: false,
      minimizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(infoWindow);

    windowRegistry.forEach(ctx => {
      ctx.window.webContents.send('set-input-disabled', true);
    });
    createMenu();

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      infoWindow.loadFile(path.join(process.cwd(), 'src/windows/dialogs/info-window.html'), { query: themeQuery });
    } else {
      infoWindow.loadFile(path.join(__dirname, '../renderer/main_window/src/windows/dialogs/info-window.html'), {
        query: themeQuery,
      });
    }

    infoWindow.on('closed', () => {
      windowRegistry.forEach(ctx => {
        ctx.window.webContents.send('set-input-disabled', false);
      });
      infoWindow = null;
      if (infoResolve) {
        infoResolve();
        infoResolve = null;
      }
      createMenu();
    });

    infoWindow.webContents.on('did-finish-load', () => {
      infoWindow.webContents.send('init-info', config);
      infoWindow.show();
    });
  });
}

ipcMain.on('info-result', () => {
  if (infoResolve) {
    infoResolve();
    infoResolve = null;
  }
  if (infoWindow) {
    infoWindow.close();
  }
});

ipcMain.handle('show-info', async (event, config) => {
  return await openInfoWindow(config);
});

function openConfirmWindow(config) {
  return new Promise(resolve => {
    if (confirmWindow) {
      confirmWindow.focus();
      return;
    }

    confirmResolve = resolve;

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    const hasOptions = config.options && config.options.length > 0;
    const height = hasOptions ? 220 : 180;

    confirmWindow = new BrowserWindow({
      width: 420,
      height: height,
      title: config.title || 'Confirm',
      show: false,
      resizable: false,
      minimizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(confirmWindow);

    windowRegistry.forEach(ctx => {
      ctx.window.webContents.send('set-input-disabled', true);
    });
    createMenu();

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      confirmWindow.loadFile(path.join(process.cwd(), 'src/windows/dialogs/confirm-window.html'), {
        query: themeQuery,
      });
    } else {
      confirmWindow.loadFile(path.join(__dirname, '../renderer/main_window/src/windows/dialogs/confirm-window.html'), {
        query: themeQuery,
      });
    }

    confirmWindow.on('closed', () => {
      windowRegistry.forEach(ctx => {
        ctx.window.webContents.send('set-input-disabled', false);
      });
      confirmWindow = null;
      if (confirmResolve) {
        confirmResolve({ action: config.cancelAction || 'cancel' });
        confirmResolve = null;
      }
      createMenu();
    });

    confirmWindow.webContents.on('did-finish-load', () => {
      confirmWindow.webContents.send('init-confirm', config);
      confirmWindow.show();
    });
  });
}

ipcMain.on('confirm-result', (event, result) => {
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
  if (confirmWindow) {
    confirmWindow.close();
  }
});

ipcMain.handle('show-confirm', async (event, config) => {
  return await openConfirmWindow(config);
});

function openWorkFolderWindow(config) {
  return new Promise(resolve => {
    if (workFolderWindow) {
      workFolderWindow.focus();
      return;
    }

    workFolderResolve = resolve;

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    workFolderWindow = new BrowserWindow({
      width: 400,
      height: 160,
      title: config.type === 'resume' ? 'Previous Session Found' : 'External Changes Detected',
      show: false,
      resizable: false,
      minimizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(workFolderWindow);

    windowRegistry.forEach(ctx => {
      ctx.window.webContents.send('set-input-disabled', true);
    });
    createMenu();

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      workFolderWindow.loadFile(path.join(process.cwd(), 'src/windows/dialogs/work-folder-window.html'), {
        query: themeQuery,
      });
    } else {
      workFolderWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/dialogs/work-folder-window.html'),
        { query: themeQuery }
      );
    }

    workFolderWindow.on('closed', () => {
      windowRegistry.forEach(ctx => {
        ctx.window.webContents.send('set-input-disabled', false);
      });
      workFolderWindow = null;
      if (workFolderResolve) {
        workFolderResolve(config.type === 'resume' ? 'extract' : 'cancel');
        workFolderResolve = null;
      }
      createMenu();
    });

    workFolderWindow.webContents.on('did-finish-load', () => {
      workFolderWindow.webContents.send('init-work-folder', config);
      workFolderWindow.show();
    });
  });
}

ipcMain.on('work-folder-result', (event, result) => {
  if (workFolderResolve) {
    workFolderResolve(result);
    workFolderResolve = null;
  }
  if (workFolderWindow) {
    workFolderWindow.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
