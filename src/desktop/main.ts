import { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'fs-extra';
import started from 'electron-squirrel-startup';
import versionInfo from '../shared/version.json';
import {
  upgradeOldMaterialsFormat,
  upgradePlayfieldMeshVisibility,
  upgradeLayersToPartGroups,
  upgradePartGroupIsLocked,
  upgradePartGroupOrdering,
  cleanupCollectionItems,
} from './table-upgrades.js';
import { WindowContext, WindowRegistry } from './window-context.js';
import type { ClipboardData } from '../types/data.js';
import type { PanelSettings, TransformData } from '../types/ipc.js';

import { Collection } from '../features/collection-manager/shared/operations.js';
import {
  DEFAULT_THEME,
  DEFAULT_GRID_SIZE,
  DEFAULT_TEXTURE_QUALITY,
  DEFAULT_UNIT_CONVERSION,
} from '../shared/constants.js';
import { reorderGameitems } from '../features/drawing-order/shared/component.js';
import {
  settings,
  loadSettings,
  saveSettings,
  DEFAULT_EDITOR_COLORS,
  getLastFolder,
  setLastFolder,
  getWindowBounds,
  trackWindowBounds,
  resetWindowBounds,
} from './settings-manager.js';
import { createWindowFactory } from './window-factory.js';
import * as vpxOps from './vpx-operations.js';
import { updateElectronApp } from 'update-electron-app';
import { createElectronMenu } from '../shared/menu-renderer-electron.js';
import { setupCollectionHandlers } from '../features/collection-manager/desktop/ipc-handlers.js';

updateElectronApp();

const windowRegistry = new WindowRegistry();

async function findItemFileByName(
  extractedDir: string,
  itemName: string
): Promise<{ fileName: string; itemData: Record<string, unknown> } | null> {
  const gameitemsPath = path.join(extractedDir, 'gameitems.json');
  const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
  const gameitems = JSON.parse(gameitemsContent) as { file_name: string }[];

  const nameLower = itemName.toLowerCase();
  for (const gi of gameitems) {
    if (!gi.file_name) continue;
    try {
      const itemPath = path.join(extractedDir, 'gameitems', gi.file_name);
      const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
      const itemData = JSON.parse(itemContent);
      const type = Object.keys(itemData)[0];
      const item = itemData[type];
      if (item.name && item.name.toLowerCase() === nameLower) {
        return { fileName: gi.file_name, itemData };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function getVpxOpsDeps() {
  return {
    windowRegistry,
    createEditorWindow: () => windowFactory.createEditorWindow(),
    showWorkFolderModal,
    createMenu,
    upgradeOldMaterialsFormat,
    upgradePlayfieldMeshVisibility,
    upgradeLayersToPartGroups,
    upgradePartGroupIsLocked,
    upgradePartGroupOrdering,
    cleanupCollectionItems,
    settings,
    saveSettings,
  };
}

let pendingFilePath: string | null = null;

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

function getActualTheme(themeSetting: string): string {
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

let clipboardState = { hasSelection: false, hasClipboard: false, isLocked: false };
let undoState = { canUndo: false, canRedo: false };
let sharedClipboardData: ClipboardData | null = null;
let activeThemeSetting: string | null = null;

function setViewSolid(enabled: boolean): void {
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

function setViewOutline(enabled: boolean): void {
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

ipcMain.on('restore-theme', (_event, themeSetting) => {
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

ipcMain.on('preview-theme', (_event, themeSetting) => {
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
  windowFactory?.getWindowStates().settingsWindow?.webContents.send('theme-changed', actualTheme);
  windowFactory?.getWindowStates().transformWindow?.webContents.send('theme-changed', actualTheme);
  windowFactory?.getWindowStates().aboutWindow?.webContents.send('theme-changed', actualTheme);
  windowFactory?.getWindowStates().tableInfoWindow?.webContents.send('theme-changed', actualTheme);
});

ipcMain.on('toggle-script-editor', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx) return;
  if (ctx.scriptEditorClosePending) return;
  if (ctx.scriptEditorWindow) {
    ctx.scriptEditorClosePending = true;
    ctx.scriptEditorWindow.webContents.send('check-can-close');
  } else {
    windowFactory.openScriptEditorWindow(ctx);
  }
});

ipcMain.on('can-close-response', (event, canClose) => {
  const ctx = windowRegistry.getByChildWindow(BrowserWindow.fromWebContents(event.sender));
  if (!ctx) return;
  if (canClose && ctx.scriptEditorWindow) {
    ctx.scriptEditorWindow.destroy();
  } else {
    ctx.scriptEditorClosePending = false;
  }
});

function createMenu() {
  const windowStates = windowFactory?.getWindowStates();
  if (!windowStates) return;

  createElectronMenu({
    windowRegistry,
    settings,
    clipboardState,
    undoState,
    windowStates: {
      ...windowStates,
      nativeDialogOpen,
    },
    actions: {
      createNewTable: (template, name) => vpxOps.createNewTable(template, name, getVpxOpsDeps()),
      openVPX: () => vpxOps.openVPX(getVpxOpsDeps()),
      extractVPX: (filePath, options) => vpxOps.extractVPX(filePath, options, getVpxOpsDeps()),
      saveVPX: () => vpxOps.saveVPX(getVpxOpsDeps()),
      saveVPXAs: () => vpxOps.saveVPXAs(getVpxOpsDeps()),
      saveSettings,
      createMenu,
      closeWindow,
      showSearchSelect,
      showDrawingOrder,
      setViewSolid,
      setViewOutline,
      toggleViewGrid,
      toggleViewBackdrop,
      toggleBackglassView,
      openScriptEditorWindow: () => {
        const ctx = windowRegistry.getFocused();
        if (ctx) windowFactory.openScriptEditorWindow(ctx);
      },
      playTable: () => vpxOps.playTable(getVpxOpsDeps()),
      openTableInfoWindow: () => windowFactory.openTableInfoWindow(),
      openSoundManagerWindow: () => windowFactory.openSoundManagerWindow(),
      openImageManagerWindow: () => windowFactory.openImageManagerWindow(),
      openMaterialManagerWindow: () => windowFactory.openMaterialManagerWindow(),
      openDimensionsManagerWindow: () => windowFactory.openDimensionsManagerWindow(),
      openCollectionManagerWindow: () => windowFactory.openCollectionManagerWindow(),
      openRenderProbeManagerWindow: () => windowFactory.openRenderProbeManagerWindow(),
      toggleTableLock,
      openSettingsWindow: () => windowFactory.openSettingsWindow(),
      showAboutDialog: () => windowFactory.showAboutDialog(),
    },
  });
}

let nativeDialogOpen = false;

async function showCloseConfirm(ctx: WindowContext) {
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

async function showWorkFolderModal(ctx: WindowContext, type: string, message: string) {
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

function closeWindow() {
  const ctx = windowRegistry.getFocused();
  if (!ctx) return;
  ctx.window.close();
}

ipcMain.on('toggle-table-lock', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) toggleTableLock(ctx);
});

async function toggleTableLock(passedCtx?: WindowContext) {
  const ctx = passedCtx || windowRegistry.getFocused();
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
  if (ctx.scriptEditorWindow && !ctx.scriptEditorWindow.isDestroyed()) {
    ctx.scriptEditorWindow.webContents.send('table-lock-changed', ctx.isTableLocked);
  }
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

ipcMain.handle('save-console-settings', (_event, consoleSettings: { height?: number; visible?: boolean }) => {
  if (consoleSettings.height !== undefined) {
    settings.consoleHeight = consoleSettings.height;
  }
  if (consoleSettings.visible !== undefined) {
    settings.consoleVisible = consoleSettings.visible;
  }
  saveSettings();
});

ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('read-binary-file', async (_event, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, data: buffer };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('write-file', async (event, filePath: string, content: string) => {
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('list-dir', async (_event, dirPath: string) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    return { success: true, files };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('get-theme', () => getActualTheme(settings.theme));
ipcMain.handle('get-version', () => getVersionString());

ipcMain.handle('set-clipboard-data', (_event, data: ClipboardData) => {
  sharedClipboardData = data;
  return true;
});

ipcMain.handle('get-clipboard-data', () => {
  return sharedClipboardData;
});

ipcMain.handle('has-clipboard-data', () => {
  return sharedClipboardData !== null;
});

ipcMain.on('update-undo-state', (_event, { canUndo, canRedo }) => {
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

ipcMain.on('update-clipboard-state', (_event, { hasSelection, hasClipboard, isLocked }) => {
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
ipcMain.handle(
  'save-view-settings',
  (_event, viewSettings: { solid?: boolean; outline?: boolean; grid?: boolean; backdrop?: boolean }) => {
    if (viewSettings.solid !== undefined) settings.viewSolid = viewSettings.solid;
    if (viewSettings.outline !== undefined) settings.viewOutline = viewSettings.outline;
    if (viewSettings.grid !== undefined) settings.viewGrid = viewSettings.grid;
    if (viewSettings.backdrop !== undefined) settings.viewBackdrop = viewSettings.backdrop;
    saveSettings();
  }
);
ipcMain.handle('get-panel-settings', () => settings.panels);
ipcMain.handle('save-panel-settings', (_event, panels: PanelSettings) => {
  settings.panels = panels as Record<string, unknown>;
  saveSettings();
});

ipcMain.handle('get-image-info', async (_event, imagePath: string) => {
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
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

ipcMain.handle('export-image', async (event, srcPath: string, suggestedName: string) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  if (!win) return { success: false, error: 'No window' };
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('export-blueprint', async (event, data: ArrayBuffer, suggestedName: string) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  if (!win) return { success: false, error: 'No window' };
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('export-blueprint-get-path', async (event, suggestedName: string) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  if (!win) return null;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: suggestedName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (result.canceled) {
    return null;
  }
  return result.filePath;
});

ipcMain.handle('save-blueprint-direct', async (_event, data: ArrayBuffer, filePath: string) => {
  try {
    const buffer = Buffer.from(data);
    await fs.promises.writeFile(filePath, buffer);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('delete-file', async (event, filePath: string) => {
  try {
    await fs.promises.unlink(filePath);
    const ctx = getContextForManagerEvent(event);
    if (ctx?.searchSelectWindow && (filePath.includes('/gameitems/') || filePath.endsWith('/gameitems.json'))) {
      updateSearchSelectWindow(ctx);
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('get-sound-info', async (_event, soundPath: string) => {
  try {
    const stats = await fs.promises.stat(soundPath);
    const fileSize = stats.size;
    const ext = path.extname(soundPath).toLowerCase();

    const info: {
      success: boolean;
      size: number;
      format: string;
      channels?: number;
      sampleRate?: number;
      bitsPerSample?: number;
      duration?: number;
    } = {
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('rename-file', async (_event, oldPath: string, newPath: string) => {
  try {
    await fs.move(oldPath, newPath);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle(
  'update-item-image',
  async (event, itemName: string, itemType: string, oldImage: string, newImage: string) => {
    const ctx = getContextForManagerEvent(event);
    if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

    try {
      const found = await findItemFileByName(ctx.extractedDir, itemName);
      if (!found) return { success: false, error: 'Item not found' };

      const { fileName, itemData } = found;
      const itemPath = path.join(ctx.extractedDir, 'gameitems', fileName);
      const type = Object.keys(itemData)[0];
      const item = itemData[type] as Record<string, unknown>;

      const imageProps: Record<string, string[]> = {
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
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
);

ipcMain.handle('confirm-dialog', async (event, message: string) => {
  const ctx = getContextForManagerEvent(event);
  const win = BrowserWindow.fromWebContents(event.sender) || ctx?.window;
  if (!win) return false;
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Cancel', 'OK'],
    defaultId: 1,
    message: message,
  });
  return result.response === 1;
});

ipcMain.on('select-item', (event, itemName: string) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx && itemName !== 'Table') {
    ctx.window.webContents.send('select-item', itemName);
  }
});

ipcMain.on('select-items', (event, itemNames: string[]) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx && itemNames && itemNames.length > 0) {
    ctx.window.webContents.send('select-items', itemNames);
  }
});

ipcMain.on('notify-selection-changed', (event, selectedItems: string[]) => {
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

ipcMain.on('refresh-image-manager', async event => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir || !ctx.imageManagerWindow || ctx.imageManagerWindow.isDestroyed()) return;

  try {
    const imagesPath = path.join(ctx.extractedDir, 'images.json');
    const imagesContent = await fs.promises.readFile(imagesPath, 'utf-8');
    const imagesArray = JSON.parse(imagesContent);
    const images: Record<string, unknown> = {};
    for (const img of imagesArray) {
      if (img.name) images[img.name] = img;
    }

    const items: Record<string, unknown> = {};
    const gameitemsPath = path.join(ctx.extractedDir, 'gameitems.json');
    const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent) as { file_name: string }[];
    for (const gi of gameitems) {
      if (!gi.file_name) continue;
      try {
        const itemPath = path.join(ctx.extractedDir, 'gameitems', gi.file_name);
        const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
        const itemData = JSON.parse(itemContent);
        const type = Object.keys(itemData)[0];
        const item = itemData[type];
        item._type = type;
        if (item.name) items[item.name] = item;
      } catch {
        continue;
      }
    }

    let gamedata = null;
    try {
      const gamedataPath = path.join(ctx.extractedDir, 'gamedata.json');
      const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
      gamedata = JSON.parse(gamedataContent);
    } catch {
      /* empty */
    }

    ctx.imageManagerWindow.webContents.send('refresh', { images, items, gamedata });
  } catch (err) {
    console.error('Failed to refresh image manager:', err);
  }
});

ipcMain.on('refresh-material-manager', async event => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir || !ctx.materialManagerWindow || ctx.materialManagerWindow.isDestroyed()) return;

  try {
    const materialsPath = path.join(ctx.extractedDir, 'materials.json');
    const materialsContent = await fs.promises.readFile(materialsPath, 'utf-8');
    const materialsArray = JSON.parse(materialsContent);
    const materials: Record<string, unknown> = {};
    for (const mat of materialsArray) {
      if (mat.name) materials[mat.name] = mat;
    }

    const items: Record<string, unknown> = {};
    const gameitemsPath = path.join(ctx.extractedDir, 'gameitems.json');
    const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent) as { file_name: string }[];
    for (const gi of gameitems) {
      if (!gi.file_name) continue;
      try {
        const itemPath = path.join(ctx.extractedDir, 'gameitems', gi.file_name);
        const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
        const itemData = JSON.parse(itemContent);
        const type = Object.keys(itemData)[0];
        const item = itemData[type];
        item._type = type;
        if (item.name) items[item.name] = item;
      } catch {
        continue;
      }
    }

    ctx.materialManagerWindow.webContents.send('refresh', { materials, items });
  } catch (err) {
    console.error('Failed to refresh material manager:', err);
  }
});

ipcMain.on('refresh-sound-manager', async event => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.extractedDir || !ctx.soundManagerWindow || ctx.soundManagerWindow.isDestroyed()) return;

  try {
    const soundsPath = path.join(ctx.extractedDir, 'sounds.json');
    const soundsContent = await fs.promises.readFile(soundsPath, 'utf-8');
    const sounds = JSON.parse(soundsContent);
    ctx.soundManagerWindow.webContents.send('refresh', { sounds });
  } catch (err) {
    console.error('Failed to refresh sound manager:', err);
  }
});

ipcMain.on('undo-begin', (event, description: string) => {
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

ipcMain.on('record-script-change', (event, before: string, after: string) => {
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
    } catch {
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

ipcMain.on('undo-mark-image-create', (event, imageName: string) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-image-create', imageName);
  }
});

ipcMain.on('undo-mark-image-delete', (event, imageName: string, imageData: unknown, filePath: string) => {
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

ipcMain.on('undo-mark-material-create', (event, materialName: string) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-material-create', materialName);
  }
});

ipcMain.on('undo-mark-material-delete', (event, materialName: string, materialData: unknown) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-material-delete', materialName, materialData);
  }
});

ipcMain.on('undo-mark-sounds', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-sounds');
  }
});

ipcMain.on('undo-mark-sound-create', (event, soundName: string) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-sound-create', soundName);
  }
});

ipcMain.on('undo-mark-sound-delete', (event, soundName: string, soundData: unknown, filePath: string) => {
  const ctx = getContextForManagerEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-sound-delete', soundName, soundData, filePath);
  }
});

ipcMain.on('undo-mark-renderprobes', event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-renderprobes');
  }
});

ipcMain.on('undo-mark-renderprobe-create', (event, probeName: string) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('undo-mark-renderprobe-create', probeName);
  }
});

ipcMain.on('undo-mark-renderprobe-delete', (event, probeName: string, probeData: unknown) => {
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

ipcMain.on('undo-mark-for-undo', (event, itemName: string) => {
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

ipcMain.handle('save-table-info', async (event, data: { info: unknown; screenshot?: string }) => {
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('save-collections', async (event, collections: unknown[]) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return;

  await fs.promises.writeFile(`${ctx.extractedDir}/collections.json`, JSON.stringify(collections, null, 2));
  ctx.window.webContents.send('collections-changed', { collections });
});

ipcMain.on(
  'save-table-info-window',
  async (_event, data: { info: unknown; screenshot?: string; originalScreenshot?: string }) => {
    const tableInfoCtx = windowFactory?.getTableInfoWindowContext();
    if (!tableInfoCtx?.extractedDir) return;

    try {
      await fs.promises.writeFile(`${tableInfoCtx.extractedDir}/info.json`, JSON.stringify(data.info, null, 2));

      tableInfoCtx.window.webContents.send('info-changed', data.info);

      if (data.screenshot !== data.originalScreenshot) {
        const gamedataPath = `${tableInfoCtx.extractedDir}/gamedata.json`;
        const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
        const gamedata = JSON.parse(gamedataContent);

        tableInfoCtx.window.webContents.send('undo-begin', 'Edit table info');
        tableInfoCtx.window.webContents.send('undo-mark-info');
        tableInfoCtx.window.webContents.send('undo-mark-gamedata');

        gamedata.screen_shot = data.screenshot;
        await fs.promises.writeFile(gamedataPath, JSON.stringify(gamedata, null, 2));
        tableInfoCtx.window.webContents.send('gamedata-changed', gamedata);

        tableInfoCtx.window.webContents.send('undo-end');
      } else {
        tableInfoCtx.window.webContents.send('undo-begin', 'Edit table info');
        tableInfoCtx.window.webContents.send('undo-mark-info');
        tableInfoCtx.window.webContents.send('undo-end');
      }

      tableInfoCtx.hasExternalChanges = true;
      tableInfoCtx.markDirty();
    } catch (err: unknown) {
      console.error('save-table-info-window error:', err);
    }
  }
);

ipcMain.on('cancel-table-info', () => {});

ipcMain.on('close-dimensions-manager', event => {
  const ctx = getContextForManagerEvent(event);
  if (ctx?.dimensionsManagerWindow) {
    ctx.dimensionsManagerWindow.close();
  }
});

ipcMain.on('open-collection-editor', async (event, collectionName: string) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx) return;
  windowFactory.openCollectionEditorWindow(ctx, collectionName);
});

ipcMain.on('collection-editor-cancel', () => {
  windowFactory.closeCollectionEditor();
});

ipcMain.on(
  'collection-editor-save',
  async (
    _event,
    data: {
      originalName: string;
      newName?: string;
      items: string[];
      fire_events: boolean;
      stop_single_events: boolean;
      group_elements: boolean;
    }
  ) => {
    const ctx = windowFactory.getCollectionEditorContext();
    if (!ctx?.extractedDir) return;

    ctx.window.webContents.send('undo-begin', `Edit collection ${data.originalName}`);
    ctx.window.webContents.send('undo-mark-collections');

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections: Collection[] = [];
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
          windowFactory.closeCollectionEditor();
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

    ctx.window.webContents.send('collections-changed', { collections });
    ctx.window.webContents.send('undo-end');

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
    }

    windowFactory.closeCollectionEditor();
  }
);

ipcMain.on(
  'open-material-editor',
  async (
    event,
    data: {
      material: Record<string, unknown>;
      mode: 'new' | 'clone';
      existingNames: string[];
      originalName: string;
    }
  ) => {
    const ctx = getContextForManagerEvent(event);
    if (!ctx) return;
    windowFactory.openMaterialEditorWindow(ctx, data.material, data.mode, data.existingNames, data.originalName);
  }
);

ipcMain.on('material-editor-cancel', () => {
  windowFactory.closeMaterialEditor();
});

ipcMain.on('material-editor-save', async (_event, result: Record<string, unknown>) => {
  const ctx = windowFactory.getMaterialEditorContext();
  if (!ctx) return;

  if (ctx.materialManagerWindow && !ctx.materialManagerWindow.isDestroyed()) {
    ctx.materialManagerWindow.webContents.send('material-editor-result', result);
  }

  windowFactory.closeMaterialEditor();
});

ipcMain.on('open-collection-prompt', async (event, mode: string, currentName?: string) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx) return;
  windowFactory.openCollectionPromptWindow(ctx, mode, currentName);
});

ipcMain.on('collection-prompt-cancel', () => {
  windowFactory.closeCollectionPrompt();
});

ipcMain.on('collection-prompt-submit', async (_event, name: string) => {
  const ctx = windowFactory.getCollectionPromptContext();
  const mode = windowFactory.getCollectionPromptMode();
  const currentName = windowFactory.getCollectionPromptCurrentName();
  if (!ctx?.extractedDir) return;

  if (mode === 'new') {
    ctx.window.webContents.send('undo-begin', `Create collection ${name}`);
    ctx.window.webContents.send('undo-mark-collections');

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections: Collection[] = [];
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

    ctx.window.webContents.send('collections-changed', { collections });
    ctx.window.webContents.send('undo-end');

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
    }
  } else if (mode === 'rename') {
    ctx.window.webContents.send('undo-begin', `Rename collection ${currentName}`);
    ctx.window.webContents.send('undo-mark-collections');

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections: Collection[] = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    const collection = collections.find(c => c.name === currentName);
    if (collection) {
      collection.name = name;
      await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
      ctx.hasExternalChanges = true;
      ctx.markDirty();
    }

    ctx.window.webContents.send('collections-changed', { collections });
    ctx.window.webContents.send('undo-end');

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
    }
  }

  windowFactory.closeCollectionPrompt();
});

ipcMain.on(
  'show-rename-dialog',
  async (event, data: { mode: string; currentName: string; existingNames?: string[]; elementType?: string }) => {
    const ctx = windowRegistry.getContextFromEvent(event);
    if (!ctx) return;
    const entityType = data.mode === 'element' && data.elementType ? data.elementType : data.mode;
    windowFactory.openRenamePromptWindow(ctx, entityType, data.currentName, data.existingNames);
  }
);

ipcMain.on('show-rename-prompt', (event, entityType: string, currentName: string, existingNames: string[]) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx) return;
  windowFactory.openRenamePromptWindow(ctx, entityType, currentName, existingNames);
});

ipcMain.on('rename-prompt-cancel', () => {
  windowFactory.closeRenamePrompt();
});

ipcMain.on('rename-prompt-submit', async (_event, newName: string) => {
  const renameData = windowFactory.getRenamePromptData();
  if (!renameData) return;

  const { ctx, entityType, currentName } = renameData;

  if (entityType === 'image' && ctx.imageManagerWindow && !ctx.imageManagerWindow.isDestroyed()) {
    ctx.imageManagerWindow.webContents.send('rename-result', { oldName: currentName, newName });
  } else if (entityType === 'sound' && ctx.soundManagerWindow && !ctx.soundManagerWindow.isDestroyed()) {
    ctx.soundManagerWindow.webContents.send('rename-result', { oldName: currentName, newName });
  } else if (entityType === 'material' && ctx.materialManagerWindow && !ctx.materialManagerWindow.isDestroyed()) {
    ctx.materialManagerWindow.webContents.send('rename-result', { oldName: currentName, newName });
  } else {
    ctx.window.webContents.send('rename-submitted', {
      mode: entityType,
      oldName: currentName,
      newName,
    });
  }

  windowFactory.closeRenamePrompt();
});

ipcMain.on('prompt-cancel', () => {
  if (windowFactory.isCollectionPromptOpen()) {
    windowFactory.closeCollectionPrompt();
  } else {
    windowFactory.closeRenamePrompt();
  }
});

ipcMain.on('prompt-submit', async (_event, name: string) => {
  if (windowFactory.isCollectionPromptOpen()) {
    const ctx = windowFactory.getCollectionPromptContext();
    const mode = windowFactory.getCollectionPromptMode();
    const currentName = windowFactory.getCollectionPromptCurrentName();
    if (!ctx?.extractedDir) return;

    if (mode === 'new') {
      ctx.window.webContents.send('undo-begin', `Create collection ${name}`);
      ctx.window.webContents.send('undo-mark-collections');

      const collectionsPath = `${ctx.extractedDir}/collections.json`;
      let collections: Collection[] = [];
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

      ctx.window.webContents.send('collections-changed', { collections });
      ctx.window.webContents.send('undo-end');

      if (ctx.collectionManagerWindow) {
        ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
      }
    } else if (mode === 'rename') {
      ctx.window.webContents.send('undo-begin', `Rename collection ${currentName}`);
      ctx.window.webContents.send('undo-mark-collections');

      const collectionsPath = `${ctx.extractedDir}/collections.json`;
      let collections: Collection[] = [];
      if (fs.existsSync(collectionsPath)) {
        const content = await fs.promises.readFile(collectionsPath, 'utf-8');
        collections = JSON.parse(content);
      }

      const collection = collections.find(c => c.name === currentName);
      if (collection) {
        collection.name = name;
        await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
        ctx.hasExternalChanges = true;
        ctx.markDirty();
      }

      ctx.window.webContents.send('collections-changed', { collections });
      ctx.window.webContents.send('undo-end');

      if (ctx.collectionManagerWindow) {
        ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
      }
    }

    windowFactory.closeCollectionPrompt();
  } else {
    const renameData = windowFactory.getRenamePromptData();
    if (!renameData) return;

    const { ctx, entityType, currentName } = renameData;

    if (entityType === 'image' && ctx.imageManagerWindow && !ctx.imageManagerWindow.isDestroyed()) {
      ctx.imageManagerWindow.webContents.send('rename-result', { oldName: currentName, newName: name });
    } else if (entityType === 'sound' && ctx.soundManagerWindow && !ctx.soundManagerWindow.isDestroyed()) {
      ctx.soundManagerWindow.webContents.send('rename-result', { oldName: currentName, newName: name });
    } else if (entityType === 'material' && ctx.materialManagerWindow && !ctx.materialManagerWindow.isDestroyed()) {
      ctx.materialManagerWindow.webContents.send('rename-result', { oldName: currentName, newName: name });
    } else if (
      entityType === 'renderprobe' &&
      ctx.renderProbeManagerWindow &&
      !ctx.renderProbeManagerWindow.isDestroyed()
    ) {
      ctx.renderProbeManagerWindow.webContents.send('rename-result', { oldName: currentName, newName: name });
    } else {
      ctx.window.webContents.send('rename-submitted', {
        mode: entityType,
        oldName: currentName,
        newName: name,
      });
    }

    windowFactory.closeRenamePrompt();
  }
});

ipcMain.on('drawing-order-data', (event, data: { mode: string; items: unknown[] }) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx) return;
  windowFactory.openDrawingOrderWindow(ctx, data.mode, data.items as never[]);
});

ipcMain.on('save-drawing-order', async (_event, data: { mode: string; items: { name: string }[] }) => {
  const ctx = windowFactory.getDrawingOrderWindowContext();
  if (!ctx?.extractedDir) return;

  try {
    const gameitemsPath = `${ctx.extractedDir}/gameitems.json`;
    const gameitemsContent = await fs.promises.readFile(gameitemsPath, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);

    const orderedNames = data.items.map(item => item.name);
    const newGameitems = reorderGameitems(gameitems, orderedNames);

    if (newGameitems) {
      ctx.window.webContents.send('undo-begin', 'Change drawing order');
      ctx.window.webContents.send('undo-mark-gameitems-list');
      await fs.promises.writeFile(gameitemsPath, JSON.stringify(newGameitems, null, 2));
      ctx.window.webContents.send('gameitems-changed', newGameitems);
      ctx.window.webContents.send('undo-end');

      ctx.hasExternalChanges = true;
      ctx.markDirty();
    }
  } catch (err: unknown) {
    console.error('Error saving drawing order:', err);
  }

  windowFactory?.getWindowStates().drawingOrderWindow?.close();
});

ipcMain.on('drawing-order-cancel', () => {
  windowFactory?.resolveDrawingOrder(null);
});

ipcMain.handle('open-external-url', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('send-mail', async (_event, email: string) => {
  try {
    await shell.openExternal(`mailto:${email}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle(
  'apply-dimensions',
  async (event, dimensions: { width: number; height: number; glassTop: number; glassBottom: number }) => {
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

      ctx.window.webContents.send('gamedata-changed', gamedata);
      ctx.hasExternalChanges = true;
      ctx.markDirty();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
);

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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('export-sound', async (event, srcPath: string, suggestedName: string) => {
  const ctx = getContextForManagerEvent(event);
  if (!ctx?.window) return null;
  const result = await dialog.showSaveDialog(ctx.window, {
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
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('import-mesh', async (event, primitiveFileName: string) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  ctx.meshImportPrimitiveFileName = primitiveFileName;

  const result = await windowFactory.openMeshImportWindow(ctx);
  if (!result) {
    return { success: false, error: 'Cancelled' };
  }

  return await performMeshImport(ctx, { filePath: result.meshData });
});

ipcMain.handle('browse-obj-file', async event => {
  const ctx = windowRegistry.getContextFromEvent(event);
  const parentWindow = ctx?.window ?? windowFactory?.getWindowStates().meshImportWindow ?? undefined;
  if (!parentWindow) return null;
  const result = await dialog.showOpenDialog(parentWindow, {
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
  return result.filePaths[0];
});

async function performMeshImport(
  ctx: WindowContext,
  options: {
    filePath: string;
    convertCoords?: boolean;
    centerMesh?: boolean;
    absolutePosition?: boolean;
    importMaterial?: boolean;
  }
) {
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
      } catch (mtlErr: unknown) {
        console.warn('Could not load material file:', (mtlErr as Error).message);
      }
    }

    await fs.promises.writeFile(primitivePath, JSON.stringify(primData, null, 2));

    ctx.window.webContents.send('mesh-imported', {
      primitiveFileName: ctx.meshImportPrimitiveFileName,
      options,
    });

    return { success: true, path: destPath };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

function parseMtlFile(content: string) {
  const lines = content.split('\n');
  let material = null;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'newmtl' && parts[1]) {
      material = {
        name: parts[1],
        type: 'Basic',
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

async function addMaterialToTable(extractedDir: string, material: { name: string }) {
  const materialsPath = path.join(extractedDir, 'materials.json');
  try {
    const content = await fs.promises.readFile(materialsPath, 'utf-8');
    const materials = JSON.parse(content);

    const existing = materials.find((m: { name: string }) => m.name === material.name);
    if (!existing) {
      materials.push(material);
      await fs.promises.writeFile(materialsPath, JSON.stringify(materials, null, 2));
    }
  } catch {
    const materials = [material];
    await fs.promises.writeFile(materialsPath, JSON.stringify(materials, null, 2));
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

function generateMtlContent(
  materialName: string,
  material: {
    base_color?: string;
    glossy_color?: string;
    roughness?: number;
    opacity?: number;
    opacity_active?: boolean;
  }
): string {
  const lines: string[] = [];
  lines.push(`newmtl ${materialName}`);

  const kd = hexToRgb(material.base_color || '#808080');
  lines.push(`Kd ${kd.r.toFixed(6)} ${kd.g.toFixed(6)} ${kd.b.toFixed(6)}`);

  const ks = hexToRgb(material.glossy_color || '#000000');
  lines.push(`Ks ${ks.r.toFixed(6)} ${ks.g.toFixed(6)} ${ks.b.toFixed(6)}`);

  const roughness = material.roughness ?? 0.5;
  const ns = (roughness - 0.5) * 2000.0;
  lines.push(`Ns ${Math.max(0, ns).toFixed(4)}`);

  if (material.opacity_active && material.opacity !== undefined && material.opacity < 1.0) {
    lines.push(`d ${material.opacity.toFixed(6)}`);
  }

  lines.push('illum 2');
  return lines.join('\n') + '\n';
}

async function findPrimitiveMaterial(
  extractedDir: string,
  primitiveFileName: string
): Promise<{ materialName: string; material: Record<string, unknown> } | null> {
  try {
    const jsonPath = path.join(extractedDir, primitiveFileName);
    const jsonContent = await fs.promises.readFile(jsonPath, 'utf-8');
    const itemData = JSON.parse(jsonContent);
    const prim = itemData.Primitive;
    const matName = prim?.material;
    if (!matName) return null;

    const materialsPath = path.join(extractedDir, 'materials.json');
    const materialsContent = await fs.promises.readFile(materialsPath, 'utf-8');
    const materials = JSON.parse(materialsContent) as { name: string }[];
    const found = materials.find(m => m.name === matName);
    if (!found) return null;

    return { materialName: matName, material: found as Record<string, unknown> };
  } catch {
    return null;
  }
}

ipcMain.handle('export-mesh', async (event, primitiveFileName: string, suggestedName?: string) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

  const srcFileName = primitiveFileName.replace('.json', '.obj');
  const srcPath = path.join(ctx.extractedDir, srcFileName);

  let hasObjFile = false;
  try {
    await fs.promises.access(srcPath);
    hasObjFile = true;
  } catch {
    // no obj file
  }

  let generatedOBJ: string | null = null;
  if (!hasObjFile) {
    try {
      const jsonPath = path.join(ctx.extractedDir, primitiveFileName);
      const jsonContent = await fs.promises.readFile(jsonPath, 'utf-8');
      const itemData = JSON.parse(jsonContent);
      const prim = itemData.Primitive;
      if (prim && !prim.use_3d_mesh) {
        const { builtinMeshToOBJ } = await import('../shared/builtin-primitive-mesh.js');
        generatedOBJ = builtinMeshToOBJ(prim.name || 'primitive', prim.sides ?? 4, !!prim.draw_textures_inside);
      }
    } catch {
      // fall through
    }
    if (!generatedOBJ) {
      return { success: false, error: 'No mesh file found for this primitive' };
    }
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
    const objFilePath = result.filePath;
    const mtlFileName = path.basename(objFilePath, '.obj') + '.mtl';
    const mtlFilePath = path.join(path.dirname(objFilePath), mtlFileName);

    const matInfo = await findPrimitiveMaterial(ctx.extractedDir, primitiveFileName);

    if (generatedOBJ) {
      const mtlRef = matInfo ? `mtllib ${mtlFileName}\nusemtl ${matInfo.materialName}\n` : '';
      const firstNewline = generatedOBJ.indexOf('\n');
      const objWithMtl = generatedOBJ.slice(0, firstNewline + 1) + mtlRef + generatedOBJ.slice(firstNewline + 1);
      await fs.promises.writeFile(objFilePath, objWithMtl, 'utf-8');
    } else {
      let objContent = await fs.promises.readFile(srcPath, 'utf-8');
      if (matInfo) {
        const mtlRef = `mtllib ${mtlFileName}\nusemtl ${matInfo.materialName}\n`;
        const firstNewline = objContent.indexOf('\n');
        if (firstNewline >= 0) {
          objContent = objContent.slice(0, firstNewline + 1) + mtlRef + objContent.slice(firstNewline + 1);
        }
      }
      await fs.promises.writeFile(objFilePath, objContent, 'utf-8');
    }

    if (matInfo) {
      const mtlContent = generateMtlContent(matInfo.materialName, matInfo.material);
      await fs.promises.writeFile(mtlFilePath, mtlContent, 'utf-8');
    }

    return { success: true, path: objFilePath };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle(
  'update-item-material',
  async (event, itemName: string, itemType: string, oldMaterial: string, newMaterial: string) => {
    const ctx = getContextForManagerEvent(event);
    if (!ctx?.extractedDir) return { success: false, error: 'No table open' };

    try {
      const found = await findItemFileByName(ctx.extractedDir, itemName);
      if (!found) return { success: false, error: 'Item not found' };

      const { fileName, itemData } = found;
      const itemPath = path.join(ctx.extractedDir, 'gameitems', fileName);
      const type = Object.keys(itemData)[0];
      const item = itemData[type] as Record<string, unknown>;

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

      const props = materialProps[itemType as keyof typeof materialProps] || [];
      for (const prop of props) {
        if (item[prop] === oldMaterial) {
          item[prop] = newMaterial;
        }
      }

      await fs.promises.writeFile(itemPath, JSON.stringify(itemData, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
);

ipcMain.on('script-changed', (event, script: string) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (ctx) {
    ctx.window.webContents.send('script-changed', script);
  }
});

async function getSearchSelectState(ctx: WindowContext | null) {
  if (!ctx?.extractedDir) return null;

  try {
    const gameitemsContent = await fs.promises.readFile(`${ctx.extractedDir}/gameitems.json`, 'utf-8');
    const gameitems = JSON.parse(gameitemsContent);
    const items: Record<string, unknown> = {};

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
        (items as Record<string, unknown>)[item.name] = item;
      } catch (e: unknown) {
        console.error(`Failed to read item ${gi.file_name}:`, (e as Error).message);
      }
    }

    let collections: Collection[] = [];
    try {
      const collectionsContent = await fs.promises.readFile(`${ctx.extractedDir}/collections.json`, 'utf-8');
      collections = JSON.parse(collectionsContent);
    } catch {
      console.log('No collections.json found');
    }

    return {
      extractedDir: ctx.extractedDir,
      items,
      collections,
      theme: getActualTheme(settings.theme),
      tableName: ctx.currentTablePath ? path.basename(ctx.currentTablePath, '.vpx') : 'Table',
    };
  } catch (err: unknown) {
    console.error('Failed to get search select state:', err);
    return null;
  }
}

async function showSearchSelect() {
  windowFactory.showSearchSelect();
}

const searchSelectUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>();
function updateSearchSelectWindow(ctx: WindowContext) {
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

let collectionEditorUpdateTimer: ReturnType<typeof setTimeout> | null = null;
function updateCollectionEditorWindow(ctx: WindowContext) {
  const collectionEditorWin = windowFactory?.getWindowStates().collectionEditorWindow;
  if (!collectionEditorWin || collectionEditorWin.isDestroyed()) return;
  if (collectionEditorUpdateTimer) {
    clearTimeout(collectionEditorUpdateTimer);
  }
  collectionEditorUpdateTimer = setTimeout(async () => {
    collectionEditorUpdateTimer = null;
    const win = windowFactory?.getWindowStates().collectionEditorWindow;
    if (!win || win.isDestroyed()) return;
    if (!ctx?.extractedDir) return;

    const gameitemsDir = `${ctx.extractedDir}/gameitems`;
    const allItems: string[] = [];
    if (fs.existsSync(gameitemsDir)) {
      const files = await fs.promises.readdir(gameitemsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const itemPath = path.join(gameitemsDir, file);
          const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
          const itemData = JSON.parse(itemContent);
          const itemType = Object.keys(itemData)[0];
          if (itemType !== 'Decal') {
            const item = itemData[itemType];
            allItems.push(item.name || file);
          }
        }
      }
    }
    allItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const collectionsPath = `${ctx.extractedDir}/collections.json`;
    let collections: Collection[] = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    win.webContents.send('update-items', {
      allItems,
      existingNames: collections.map(c => c.name),
    });
  }, 100);
}

function showDrawingOrder(mode: string) {
  const ctx = windowRegistry.getFocused();
  if (!ctx?.extractedDir) return;
  ctx.window.webContents.send('request-drawing-order-data', mode);
}

ipcMain.handle('save-script', async (event, content: string) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  if (!ctx?.extractedDir) return { success: false, error: 'No table open' };
  try {
    const scriptPath = `${ctx.extractedDir}/script.vbs`;
    let oldContent = '';
    try {
      oldContent = await fs.promises.readFile(scriptPath, 'utf-8');
    } catch {}

    await fs.promises.writeFile(scriptPath, content, 'utf-8');

    if (ctx.window && oldContent !== content) {
      ctx.window.webContents.send('record-script-change', oldContent, content);
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('script-editor-unsaved-changes-dialog', async event => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) return false;
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

const windowFactory = createWindowFactory({
  windowRegistry,
  settings,
  getActualTheme,
  createMenu,
  MAIN_WINDOW_VITE_DEV_SERVER_URL,
  MAIN_WINDOW_VITE_NAME,
  getWindowBounds,
  trackWindowBounds,
  WindowContext,
  versionInfo,
  showCloseConfirm,
  saveVPX: () => vpxOps.saveVPX(getVpxOpsDeps()),
  DEFAULT_UNIT_CONVERSION: String(DEFAULT_UNIT_CONVERSION),
});

function getContextForManagerEvent(event: { sender: Electron.WebContents }): WindowContext | null {
  const ctx = windowRegistry.getContextFromEvent(event as Electron.IpcMainEvent);
  if (ctx) return ctx;
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) return null;
  return windowRegistry.getByChildWindow(senderWindow);
}

setupCollectionHandlers({ getContextForManagerEvent });

ipcMain.on(
  'open-transform',
  (event, type: string, data: { centerX: number; centerY: number; mouseX: number; mouseY: number }) => {
    const ctx = windowRegistry.getContextFromEvent(event);
    if (ctx) {
      windowFactory.openTransformWindow(type, data, ctx);
    }
  }
);

ipcMain.on('apply-transform', (_event, transformData: TransformData) => {
  const transformCtx = windowFactory?.getTransformWindowContext();
  if (transformCtx) {
    transformCtx.window.webContents.send('apply-transform', transformData);
  }
});

ipcMain.on('undo-transform', _event => {
  const transformCtx = windowFactory?.getTransformWindowContext();
  if (transformCtx) {
    transformCtx.window.webContents.send('undo-transform');
  }
});

ipcMain.on('save-transform', (_event, transformData: TransformData) => {
  const transformCtx = windowFactory?.getTransformWindowContext();
  if (transformCtx) {
    transformCtx.window.webContents.send('save-transform', transformData);
  }
  windowFactory?.getWindowStates().transformWindow?.close();
});

ipcMain.on('cancel-transform', _event => {
  const transformCtx = windowFactory?.getTransformWindowContext();
  if (transformCtx) {
    transformCtx.window.webContents.send('cancel-transform');
  }
  windowFactory?.getWindowStates().transformWindow?.close();
});

ipcMain.handle('browse-executable', async (event, name: string) => {
  const ctx = windowRegistry.getContextFromEvent(event);
  const parentWindow = ctx?.window ?? windowFactory?.getWindowStates().settingsWindow ?? undefined;
  const result = await dialog.showOpenDialog(parentWindow as BrowserWindow, {
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

ipcMain.handle('check-file-exists', async (_event, filePath: string) => {
  if (!filePath) return { valid: true };
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return { valid: false, error: 'Invalid path' };
    }
    if (process.platform === 'win32') {
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.exe') {
        return { valid: false, error: 'File is not executable' };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid path' };
  }
});

ipcMain.handle(
  'save-settings',
  async (
    _event,
    newSettings: {
      theme?: string;
      gridSize?: number;
      textureQuality?: number;
      unitConversion?: string;
      vpinballPath?: string;
      useEmbeddedVpxtool?: boolean;
      vpxtoolPath?: string;
      alwaysDrawDragPoints?: boolean;
      drawLightCenters?: boolean;
      editorColors?: Record<string, string>;
    }
  ) => {
    const oldGridSize = settings.gridSize || DEFAULT_GRID_SIZE;
    const newGridSize = newSettings.gridSize || DEFAULT_GRID_SIZE;
    const oldTheme = settings.theme;
    const newTheme = newSettings.theme || DEFAULT_THEME;
    const oldTextureQuality = settings.textureQuality || DEFAULT_TEXTURE_QUALITY;
    const newTextureQuality = newSettings.textureQuality ?? DEFAULT_TEXTURE_QUALITY;
    const newUnitConversion = newSettings.unitConversion ?? DEFAULT_UNIT_CONVERSION;

    settings.gridSize = newGridSize;
    settings.textureQuality = newTextureQuality;
    settings.unitConversion = newUnitConversion;
    settings.vpinballPath = newSettings.vpinballPath ?? '';
    settings.alwaysDrawDragPoints = newSettings.alwaysDrawDragPoints || false;
    settings.drawLightCenters = newSettings.drawLightCenters || false;
    if (newSettings.editorColors) {
      settings.editorColors = { ...DEFAULT_EDITOR_COLORS, ...newSettings.editorColors };
    }

    if (oldTheme !== newTheme) {
      settings.theme = newTheme as 'system' | 'light' | 'dark';
      nativeTheme.themeSource = newTheme as 'system' | 'light' | 'dark';
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
        if (winCtx.collectionManagerWindow)
          winCtx.collectionManagerWindow.webContents.send('theme-changed', actualTheme);
        if (winCtx.dimensionsManagerWindow)
          winCtx.dimensionsManagerWindow.webContents.send('theme-changed', actualTheme);
      });
      windowFactory?.getWindowStates().settingsWindow?.webContents.send('theme-changed', actualTheme);
      windowFactory?.getWindowStates().transformWindow?.webContents.send('theme-changed', actualTheme);
      windowFactory?.getWindowStates().aboutWindow?.webContents.send('theme-changed', actualTheme);
      windowFactory?.getWindowStates().tableInfoWindow?.webContents.send('theme-changed', actualTheme);
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
        unitConversion: settings.unitConversion ?? DEFAULT_UNIT_CONVERSION,
      });
    });
    return { success: true };
  }
);

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
  const settingsWin = windowFactory?.getWindowStates().settingsWindow;
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.center();
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
  nativeTheme.themeSource = settings.theme as 'system' | 'light' | 'dark';

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
      windowFactory?.getWindowStates().settingsWindow?.webContents.send('theme-changed', actualTheme);
      windowFactory?.getWindowStates().transformWindow?.webContents.send('theme-changed', actualTheme);
      windowFactory?.getWindowStates().aboutWindow?.webContents.send('theme-changed', actualTheme);
      windowFactory?.getWindowStates().tableInfoWindow?.webContents.send('theme-changed', actualTheme);
    }
  });

  windowFactory.createEditorWindow();

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
      windowFactory.createEditorWindow();
    }
  });
});

ipcMain.on('mesh-import-result', (_event, result: unknown) => {
  windowFactory.resolveMeshImport(result as Parameters<typeof windowFactory.resolveMeshImport>[0]);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
