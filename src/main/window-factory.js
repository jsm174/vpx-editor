import { app, BrowserWindow, dialog, Menu } from 'electron';
import path from 'node:path';
import fs from 'fs-extra';

let settingsWindow = null;
let transformWindow = null;
let transformWindowContext = null;
let aboutWindow = null;
let tableInfoWindow = null;
let tableInfoWindowContext = null;
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
let drawingOrderResolve = null;
let drawingOrderWindowContext = null;

export function createWindowFactory(deps) {
  const {
    windowRegistry,
    settings,
    getActualTheme,
    createMenu,
    MAIN_WINDOW_VITE_DEV_SERVER_URL,
    MAIN_WINDOW_VITE_NAME,
  } = deps;

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

  function getAboutIconPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'about-icon.png');
    }
    return path.join(process.cwd(), 'resources', 'about-icon.png');
  }

  function getVersionString() {
    const version = app.getVersion();
    const versionInfo = deps.versionInfo;
    if (versionInfo && versionInfo.sha === 'dev') {
      return `${version} (dev)`;
    }
    return `${version}-${versionInfo?.revision}-${versionInfo?.sha}`;
  }

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
        } catch (e) {}
      }

      return { extractedDir: ctx.extractedDir, gamedata, images, items, theme: getActualTheme(settings.theme) };
    } catch (e) {
      return null;
    }
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
            const name = file.replace('.json', '');
            items[name] = { _type: item._type };
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

  function createEditorWindow() {
    const id = `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const win = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        preload: path.join(__dirname, 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.webContents.windowId = id;

    const WindowContext = deps.WindowContext;
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
        const result = await deps.showCloseConfirm(ctx);
        if (result === 'cancel') {
          return;
        }
        if (result === 'save') {
          await deps.saveVPX();
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
      win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/src/editor/index.html`), {
        query: { theme: actualTheme },
      });
    }

    createMenu();
    return ctx;
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

  function openImageManagerWindow() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.imageManagerWindow) {
      ctx.imageManagerWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'image-manager.js')
      : path.join(process.cwd(), '.vite/build/image-manager.js');

    ctx.imageManagerWindow = new BrowserWindow({
      width: 950,
      height: 650,
      title: 'Image Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.imageManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/managers/image-manager.html');
      ctx.imageManagerWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.imageManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/managers/image-manager.html'),
        { query: themeQuery }
      );
    }

    ctx.imageManagerWindow.on('closed', () => {
      ctx.imageManagerWindow = null;
    });

    ctx.imageManagerWindow.webContents.on('did-finish-load', async () => {
      const state = await getTableState(ctx);
      if (state) {
        ctx.imageManagerWindow.webContents.send('init', state);
      }
    });
  }

  function openMaterialManagerWindow() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.materialManagerWindow) {
      ctx.materialManagerWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'material-manager.js')
      : path.join(process.cwd(), '.vite/build/material-manager.js');

    ctx.materialManagerWindow = new BrowserWindow({
      width: 900,
      height: 650,
      title: 'Material Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.materialManagerWindow);

    ctx.materialManagerWindow.on('closed', () => {
      ctx.materialManagerWindow = null;
    });

    ctx.materialManagerWindow.webContents.on('did-finish-load', async () => {
      const state = await getMaterialsState(ctx);
      if (state) {
        ctx.materialManagerWindow.webContents.send('init', state);
      }
    });

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/managers/material-manager.html');
      ctx.materialManagerWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.materialManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/managers/material-manager.html'),
        { query: themeQuery }
      );
    }
  }

  function openSoundManagerWindow() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.soundManagerWindow) {
      ctx.soundManagerWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'sound-manager.js')
      : path.join(process.cwd(), '.vite/build/sound-manager.js');

    ctx.soundManagerWindow = new BrowserWindow({
      width: 800,
      height: 550,
      title: 'Sound Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.soundManagerWindow);

    ctx.soundManagerWindow.on('closed', () => {
      ctx.soundManagerWindow = null;
    });

    ctx.soundManagerWindow.webContents.on('did-finish-load', async () => {
      const state = await getSoundsState(ctx);
      if (state) {
        ctx.soundManagerWindow.webContents.send('init', state);
      }
    });

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/managers/sound-manager.html');
      ctx.soundManagerWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.soundManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/managers/sound-manager.html'),
        { query: themeQuery }
      );
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
        { query: themeQuery }
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

  async function openDimensionsManagerWindow() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.dimensionsManagerWindow) {
      ctx.dimensionsManagerWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'dimensions-manager.js')
      : path.join(process.cwd(), '.vite/build/dimensions-manager.js');

    ctx.dimensionsManagerWindow = new BrowserWindow({
      width: 800,
      height: 520,
      title: 'Dimensions Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.dimensionsManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/managers/dimensions-manager-window.html');
      ctx.dimensionsManagerWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.dimensionsManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/managers/dimensions-manager-window.html'),
        { query: themeQuery }
      );
    }

    ctx.dimensionsManagerWindow.on('closed', () => {
      ctx.dimensionsManagerWindow = null;
    });

    ctx.dimensionsManagerWindow.webContents.on('did-finish-load', async () => {
      const state = await getDimensionsState(ctx);
      if (state) {
        ctx.dimensionsManagerWindow.webContents.send('init-dimensions', state);
      }
    });
  }

  function openCollectionManagerWindow() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    ctx.collectionManagerWindow = new BrowserWindow({
      width: 500,
      height: 400,
      title: 'Collection Manager',
      show: false,
      resizable: true,
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.collectionManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/managers/collection-manager-window.html');
      ctx.collectionManagerWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.collectionManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/managers/collection-manager-window.html'),
        { query: themeQuery }
      );
    }

    ctx.collectionManagerWindow.on('closed', () => {
      ctx.collectionManagerWindow = null;
    });

    ctx.collectionManagerWindow.webContents.on('did-finish-load', async () => {
      const data = await getCollectionManagerData(ctx);
      ctx.collectionManagerWindow.webContents.send('init-collection-manager', data);
      ctx.collectionManagerWindow.show();
      ctx.window.webContents.send('request-selection-resend');
    });
  }

  function openRenderProbeManagerWindow() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.renderProbeManagerWindow) {
      ctx.renderProbeManagerWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'render-probe-manager.js')
      : path.join(process.cwd(), '.vite/build/render-probe-manager.js');

    ctx.renderProbeManagerWindow = new BrowserWindow({
      width: 700,
      height: 600,
      title: 'Render Probe Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.renderProbeManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/managers/render-probe-manager.html');
      ctx.renderProbeManagerWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.renderProbeManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/managers/render-probe-manager.html'),
        { query: themeQuery }
      );
    }

    ctx.renderProbeManagerWindow.on('closed', () => {
      ctx.renderProbeManagerWindow = null;
    });

    ctx.renderProbeManagerWindow.webContents.on('did-finish-load', async () => {
      const state = await getRenderProbesState(ctx);
      if (state) {
        ctx.renderProbeManagerWindow.webContents.send('init', state);
      }
    });
  }

  function openScriptEditorWindow(ctx) {
    if (!ctx) ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.scriptEditorWindow || ctx.scriptEditorClosePending) {
      if (ctx.scriptEditorWindow) ctx.scriptEditorWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'script-editor.js')
      : path.join(process.cwd(), '.vite/build/script-editor.js');

    const scriptTitle = ctx.tableName ? `Script Editor - [${ctx.tableName}.vpx]` : 'Script Editor';
    ctx.scriptEditorWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      title: scriptTitle,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.scriptEditorWindow);

    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('script-editor-opened');
    }

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/script-editor/script-editor.html');
      ctx.scriptEditorWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.scriptEditorWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/script-editor/script-editor.html'),
        {
          query: themeQuery,
        }
      );
    }

    ctx.scriptEditorWindow.on('close', e => {
      if (ctx.scriptEditorClosePending) return;
      e.preventDefault();
      ctx.scriptEditorClosePending = true;
      ctx.scriptEditorWindow.webContents.send('check-can-close');
    });

    ctx.scriptEditorWindow.on('closed', () => {
      ctx.scriptEditorWindow = null;
      ctx.scriptEditorClosePending = false;
      if (ctx.window && !ctx.window.isDestroyed()) {
        ctx.window.webContents.send('script-editor-closed');
      }
    });

    ctx.scriptEditorWindow.webContents.on('did-finish-load', async () => {
      const scriptTitle = ctx.tableName ? `Script Editor - [${ctx.tableName}.vpx]` : 'Script Editor';
      ctx.scriptEditorWindow.setTitle(scriptTitle);
      const script = await getScriptContent(ctx);
      let gameitems = [];
      try {
        const gameitemsContent = await fs.promises.readFile(`${ctx.extractedDir}/gameitems.json`, 'utf-8');
        const gameitemsData = JSON.parse(gameitemsContent);
        gameitems = gameitemsData
          .map(gi => {
            const fileName = gi.file_name || '';
            const type = fileName.split('.')[0] || 'Unknown';
            const name = fileName.replace(/^\w+\./, '').replace(/\.json$/, '');
            return { name, type };
          })
          .filter(gi => gi.name);
      } catch (e) {}
      ctx.scriptEditorWindow.webContents.send('init', {
        script: script || '',
        extractedDir: ctx.extractedDir,
        theme: settings.theme,
        gameitems,
        tableName: ctx.tableName,
      });
    });
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
      settingsWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/settings/settings-window.html'),
        {
          query: themeQuery,
        }
      );
    }

    settingsWindow.on('closed', () => {
      windowRegistry.forEach(ctx => {
        ctx.window.webContents.send('set-input-disabled', false);
      });
      settingsWindow = null;
      createMenu();
    });

    settingsWindow.webContents.on('did-finish-load', () => {
      const DEFAULT_UNIT_CONVERSION = deps.DEFAULT_UNIT_CONVERSION;
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
        promptWindow.loadFile(path.join(process.cwd(), 'src/windows/dialogs/prompt-window.html'), {
          query: themeQuery,
        });
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
        confirmWindow.loadFile(
          path.join(__dirname, '../renderer/main_window/src/windows/dialogs/confirm-window.html'),
          {
            query: themeQuery,
          }
        );
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
    return new Promise(resolve => {
      if (drawingOrderWindow) {
        drawingOrderWindow.focus();
        return;
      }

      drawingOrderResolve = resolve;
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
        if (drawingOrderResolve) {
          drawingOrderResolve(null);
          drawingOrderResolve = null;
        }
        createMenu();
      });

      drawingOrderWindow.webContents.on('did-finish-load', () => {
        drawingOrderWindow.webContents.send('init-drawing-order', { mode, items });
        drawingOrderWindow.show();
      });
    });
  }

  async function showSearchSelect() {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      return;
    }

    if (ctx.searchSelectWindow) {
      ctx.searchSelectWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'search-select.js')
      : path.join(process.cwd(), '.vite/build/search-select.js');

    ctx.searchSelectWindow = new BrowserWindow({
      width: 1100,
      height: 600,
      title: 'Search/Select Element',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupDialogEditMenu(ctx.searchSelectWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const htmlPath = path.join(process.cwd(), 'src/windows/search-select/search-select.html');
      ctx.searchSelectWindow.loadFile(htmlPath, { query: themeQuery });
    } else {
      ctx.searchSelectWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/windows/search-select/search-select.html'),
        {
          query: themeQuery,
        }
      );
    }

    ctx.searchSelectWindow.on('closed', () => {
      ctx.searchSelectWindow = null;
    });

    ctx.searchSelectWindow.webContents.on('did-finish-load', async () => {
      const state = await getSearchSelectState(ctx);
      if (state) {
        ctx.searchSelectWindow.webContents.send('init', state);
      }
      ctx.window.webContents.send('request-selection-resend');
    });
  }

  return {
    createEditorWindow,
    showAboutDialog,
    openImageManagerWindow,
    openMaterialManagerWindow,
    openSoundManagerWindow,
    openTableInfoWindow,
    openDimensionsManagerWindow,
    openCollectionManagerWindow,
    openRenderProbeManagerWindow,
    openScriptEditorWindow,
    openSettingsWindow,
    openTransformWindow,
    openPromptWindow,
    openInfoWindow,
    openConfirmWindow,
    openWorkFolderWindow,
    openMeshImportWindow,
    openDrawingOrderWindow,
    showSearchSelect,
    setupDialogEditMenu,
    getWindowStates: () => ({
      settingsWindow,
      transformWindow,
      aboutWindow,
      tableInfoWindow,
      promptWindow,
      infoWindow,
      confirmWindow,
      workFolderWindow,
      meshImportWindow,
      drawingOrderWindow,
    }),
    getTransformWindowContext: () => transformWindowContext,
    getTableInfoWindowContext: () => tableInfoWindowContext,
    getMeshImportWindowContext: () => meshImportWindowContext,
    getDrawingOrderWindowContext: () => drawingOrderWindowContext,
    resolveMeshImport: result => {
      if (meshImportResolve) {
        meshImportResolve(result);
        meshImportResolve = null;
      }
      if (meshImportWindow) {
        meshImportWindow.close();
      }
    },
    resolveDrawingOrder: result => {
      if (drawingOrderResolve) {
        drawingOrderResolve(result);
        drawingOrderResolve = null;
      }
      if (drawingOrderWindow) {
        drawingOrderWindow.close();
      }
    },
  };
}
