import { app, BrowserWindow, dialog, Menu, ContextMenuParams, Event, MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import fs from 'fs-extra';
import type { WindowContext, WindowRegistry } from './window-context.js';
import { setWebContentsWindowId } from './window-context.js';
import type { Settings, WindowBounds } from './settings-manager.js';
import type { GameItemBase as GameItem } from '../types/game-objects.js';
import type { GameData } from '../types/data.js';
import { parseTableSizesCSV, type PredefinedTable } from '../features/dimensions-manager/shared/table-sizes.js';

interface VersionInfo {
  sha: string;
  revision?: string;
}

interface WindowFactoryDeps {
  windowRegistry: WindowRegistry;
  settings: Settings;
  getActualTheme: (theme: string) => string;
  createMenu: () => void;
  MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  MAIN_WINDOW_VITE_NAME: string;
  getWindowBounds: (name: string, defaults: WindowBounds) => WindowBounds;
  trackWindowBounds: (win: BrowserWindow, name: string) => void;
  versionInfo?: VersionInfo;
  WindowContext: typeof WindowContext;
  showCloseConfirm: (ctx: WindowContext) => Promise<string>;
  saveVPX: () => Promise<void>;
  DEFAULT_UNIT_CONVERSION: string;
}

interface ImageData {
  name: string;
}

interface TableState {
  extractedDir: string;
  gamedata: GameData;
  images: Record<string, ImageData>;
  items: Record<string, GameItem>;
  theme: string;
}

interface MaterialsState {
  extractedDir: string;
  materials: Record<string, unknown>;
  items: Record<string, GameItem>;
  gamedata: Record<string, unknown> | null;
  theme: string;
}

interface SoundsState {
  extractedDir: string;
  sounds: unknown[];
  theme: string;
}

interface TableInfoState {
  extractedDir: string;
  info: Record<string, unknown>;
  gamedata: GameData;
  images: unknown[];
  theme: string;
}

interface DimensionsState {
  gamedata: GameData;
  theme: string;
  tables: PredefinedTable[];
}

interface Collection {
  name: string;
  items: string[];
}

interface CollectionManagerData {
  collections: Collection[];
  items: Record<string, { _type: string }>;
  selectedItems: string[];
}

interface RenderProbe {
  name: string;
}

interface RenderProbesState {
  extractedDir: string;
  probes: Record<string, RenderProbe>;
  theme: string;
}

interface SearchSelectState {
  extractedDir: string;
  items: Record<string, GameItem>;
  collections: Collection[];
  theme: string;
  tableName: string;
}

interface TransformData {
  centerX: number;
  centerY: number;
  mouseX: number;
  mouseY: number;
}

interface DrawingOrderItem {
  name: string;
  type: string;
}

interface MeshImportResult {
  meshData: string;
}

interface CollectionEditorInitData {
  collectionName: string;
  includedItems: string[];
  availableItems: string[];
  existingNames: string[];
  fireEvents: boolean;
  stopSingle: boolean;
  groupElements: boolean;
}

interface WindowStates {
  settingsWindow: BrowserWindow | null;
  transformWindow: BrowserWindow | null;
  aboutWindow: BrowserWindow | null;
  tableInfoWindow: BrowserWindow | null;
  meshImportWindow: BrowserWindow | null;
  drawingOrderWindow: BrowserWindow | null;
  collectionEditorWindow: BrowserWindow | null;
  collectionPromptWindow: BrowserWindow | null;
  renamePromptWindow: BrowserWindow | null;
}

export interface WindowFactory {
  createEditorWindow(): WindowContext;
  showAboutDialog(): void;
  openImageManagerWindow(selectImage?: string): void;
  openMaterialManagerWindow(selectMaterial?: string): void;
  openSoundManagerWindow(): void;
  openTableInfoWindow(): Promise<void>;
  openDimensionsManagerWindow(): Promise<void>;
  openCollectionManagerWindow(selectCollection?: string): void;
  openRenderProbeManagerWindow(): void;
  openScriptEditorWindow(ctx?: WindowContext | null): void;
  openSettingsWindow(): void;
  openTransformWindow(type: string, data: TransformData, ctx: WindowContext): void;
  openMeshImportWindow(ctx: WindowContext): Promise<MeshImportResult | null>;
  openDrawingOrderWindow(ctx: WindowContext, mode: string, items: DrawingOrderItem[]): Promise<string[] | null>;
  showSearchSelect(): Promise<void>;
  setupDialogEditMenu(browserWindow: BrowserWindow): void;
  getWindowStates(): WindowStates;
  getTransformWindowContext(): WindowContext | null;
  getTableInfoWindowContext(): WindowContext | null;
  getMeshImportWindowContext(): WindowContext | null;
  getDrawingOrderWindowContext(): WindowContext | null;
  resolveMeshImport(result: MeshImportResult | null): void;
  resolveDrawingOrder(result: string[] | null): void;
  openCollectionEditorWindow(ctx: WindowContext, collectionName: string): Promise<void>;
  openCollectionPromptWindow(ctx: WindowContext, mode: string, currentName?: string): Promise<void>;
  openRenamePromptWindow(
    ctx: WindowContext,
    entityType: string,
    currentName: string,
    existingNames?: string[]
  ): Promise<void>;
  getCollectionEditorContext(): WindowContext | null;
  getCollectionPromptContext(): WindowContext | null;
  getCollectionPromptMode(): string | null;
  getCollectionPromptCurrentName(): string | null;
  getRenamePromptData(): {
    ctx: WindowContext;
    entityType: string;
    currentName: string;
    existingNames: string[];
  } | null;
  closeCollectionEditor(): void;
  closeCollectionPrompt(): void;
  closeRenamePrompt(): void;
  isCollectionEditorOpen(): boolean;
  isCollectionPromptOpen(): boolean;
  openMaterialEditorWindow(
    ctx: WindowContext,
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ): Promise<void>;
  closeMaterialEditor(): void;
  getMaterialEditorContext(): WindowContext | null;
}

let settingsWindow: BrowserWindow | null = null;
let transformWindow: BrowserWindow | null = null;
let transformWindowContext: WindowContext | null = null;
let aboutWindow: BrowserWindow | null = null;
let tableInfoWindow: BrowserWindow | null = null;
let tableInfoWindowContext: WindowContext | null = null;
let meshImportWindow: BrowserWindow | null = null;
let meshImportResolve: ((value: MeshImportResult | null) => void) | null = null;
let meshImportWindowContext: WindowContext | null = null;
let drawingOrderWindow: BrowserWindow | null = null;
let drawingOrderResolve: ((value: string[] | null) => void) | null = null;
let drawingOrderWindowContext: WindowContext | null = null;
let collectionEditorWindow: BrowserWindow | null = null;
let collectionEditorContext: WindowContext | null = null;
let collectionPromptWindow: BrowserWindow | null = null;
let collectionPromptContext: WindowContext | null = null;
let collectionPromptMode: string | null = null;
let collectionPromptCurrentName: string | null = null;
let renamePromptWindow: BrowserWindow | null = null;
let renamePromptData: { ctx: WindowContext; entityType: string; currentName: string; existingNames: string[] } | null =
  null;
let materialEditorWindow: BrowserWindow | null = null;
let materialEditorContext: WindowContext | null = null;

export function createWindowFactory(deps: WindowFactoryDeps): WindowFactory {
  const {
    windowRegistry,
    settings,
    getActualTheme,
    createMenu,
    MAIN_WINDOW_VITE_DEV_SERVER_URL,
    MAIN_WINDOW_VITE_NAME,
    getWindowBounds,
    trackWindowBounds,
  } = deps;

  function setupDialogEditMenu(browserWindow: BrowserWindow): void {
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
      ] as MenuItemConstructorOptions[]);
      browserWindow.setMenu(editMenu);
    } else {
      browserWindow.setMenu(null);
    }

    browserWindow.webContents.on('context-menu', (_event: Event, params: ContextMenuParams) => {
      if (params.isEditable) {
        const contextMenu = Menu.buildFromTemplate([
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ] as MenuItemConstructorOptions[]);
        contextMenu.popup({ window: browserWindow });
      }
    });
  }

  function getVersionString(): string {
    const version = app.getVersion();
    const versionInfo = deps.versionInfo;
    if (versionInfo && versionInfo.sha === 'dev') {
      return `${version} (dev)`;
    }
    return `${version}-${versionInfo?.revision}-${versionInfo?.sha}`;
  }

  async function getTableState(ctx: WindowContext | null): Promise<TableState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}gamedata.json`, 'utf-8');
      const gamedata = JSON.parse(gamedataContent);

      const imagesContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}images.json`, 'utf-8');
      const imagesArray: ImageData[] = JSON.parse(imagesContent);
      const images: Record<string, ImageData> = {};
      for (const img of imagesArray) {
        images[img.name] = img;
      }

      const gameitemsContent = await fs.promises.readFile(path.join(ctx.extractedDir, 'gameitems.json'), 'utf-8');
      const gameitems: { file_name: string }[] = JSON.parse(gameitemsContent);

      const items: Record<string, GameItem> = {};
      for (const itemInfo of gameitems) {
        const itemPath = path.join(ctx.extractedDir, 'gameitems', itemInfo.file_name);
        try {
          const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
          const itemData = JSON.parse(itemContent);
          const type = Object.keys(itemData)[0];
          const item = itemData[type];
          item._type = type;
          items[item.name || itemInfo.file_name] = item;
        } catch {}
      }

      return { extractedDir: ctx.extractedDir, gamedata, images, items, theme: getActualTheme(settings.theme) };
    } catch {
      return null;
    }
  }

  async function getSearchSelectState(ctx: WindowContext | null): Promise<SearchSelectState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const gameitemsContent = await fs.promises.readFile(path.join(ctx.extractedDir, 'gameitems.json'), 'utf-8');
      const gameitems: { file_name: string; editor_layer?: number; editor_layer_name?: string }[] =
        JSON.parse(gameitemsContent);
      const items: Record<string, GameItem> = {};

      for (const gi of gameitems) {
        const itemPath = path.join(ctx.extractedDir, 'gameitems', gi.file_name);
        try {
          const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
          const itemData = JSON.parse(itemContent);
          const type = Object.keys(itemData)[0];
          const item = itemData[type];
          item._type = type;
          item._fileName = `gameitems/${gi.file_name}`;
          item._layer = gi.editor_layer || 0;
          item._layerName = gi.editor_layer_name || '';
          items[item.name || gi.file_name] = item;
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          console.error(`Failed to read item ${gi.file_name}:`, message);
        }
      }

      let collections: Collection[] = [];
      try {
        const collectionsContent = await fs.promises.readFile(path.join(ctx.extractedDir, 'collections.json'), 'utf-8');
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
    } catch {
      return null;
    }
  }

  async function getMaterialsState(ctx: WindowContext | null): Promise<MaterialsState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const materialsContent = await fs.promises.readFile(path.join(ctx.extractedDir, 'materials.json'), 'utf-8');
      const materialsArray: { name: string }[] = JSON.parse(materialsContent);
      const materials: Record<string, unknown> = {};
      for (const mat of materialsArray) {
        materials[mat.name] = mat;
      }

      const gameitemsContent = await fs.promises.readFile(path.join(ctx.extractedDir, 'gameitems.json'), 'utf-8');
      const gameitems: { file_name: string }[] = JSON.parse(gameitemsContent);

      const items: Record<string, GameItem> = {};
      for (const itemInfo of gameitems) {
        const itemPath = path.join(ctx.extractedDir, 'gameitems', itemInfo.file_name);
        try {
          const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
          const itemData = JSON.parse(itemContent);
          const type = Object.keys(itemData)[0];
          const item = itemData[type];
          item._type = type;
          items[item.name || itemInfo.file_name] = item;
        } catch {}
      }

      let gamedata: Record<string, unknown> | null = null;
      try {
        const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}gamedata.json`, 'utf-8');
        gamedata = JSON.parse(gamedataContent);
      } catch {}

      return { extractedDir: ctx.extractedDir, materials, items, gamedata, theme: getActualTheme(settings.theme) };
    } catch (e: unknown) {
      console.error('getMaterialsState error:', e);
      return null;
    }
  }

  async function getSoundsState(ctx: WindowContext | null): Promise<SoundsState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const soundsContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}sounds.json`, 'utf-8');
      const sounds = JSON.parse(soundsContent);
      return { extractedDir: ctx.extractedDir, sounds, theme: getActualTheme(settings.theme) };
    } catch (e: unknown) {
      console.error('getSoundsState error:', e);
      return null;
    }
  }

  async function getTableInfoState(ctx: WindowContext | null): Promise<TableInfoState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const infoContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}info.json`, 'utf-8');
      const info = JSON.parse(infoContent);

      const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}gamedata.json`, 'utf-8');
      const gamedata = JSON.parse(gamedataContent);

      const imagesContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}images.json`, 'utf-8');
      const images = JSON.parse(imagesContent);

      return { extractedDir: ctx.extractedDir, info, gamedata, images, theme: settings.theme };
    } catch (e: unknown) {
      console.error('getTableInfoState error:', e);
      return null;
    }
  }

  async function getDimensionsState(ctx: WindowContext | null): Promise<DimensionsState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const gamedataContent = await fs.promises.readFile(`${ctx.extractedDir}${path.sep}gamedata.json`, 'utf-8');
      const gamedata = JSON.parse(gamedataContent);

      const csvPath = app.isPackaged
        ? path.join(process.resourcesPath, 'assets', 'TableSizes.csv')
        : path.join(process.cwd(), 'public', 'assets', 'TableSizes.csv');
      const csvContent = await fs.promises.readFile(csvPath, 'utf-8');
      const tables = parseTableSizesCSV(csvContent);

      return { gamedata, theme: getActualTheme(settings.theme), tables };
    } catch (e: unknown) {
      console.error('getDimensionsState error:', e);
      return null;
    }
  }

  async function getCollectionManagerData(ctx: WindowContext | null): Promise<CollectionManagerData> {
    if (!ctx?.extractedDir) return { collections: [], items: {}, selectedItems: [] };

    try {
      const collectionsPath = path.join(ctx.extractedDir, 'collections.json');
      let collections: Collection[] = [];
      if (fs.existsSync(collectionsPath)) {
        const content = await fs.promises.readFile(collectionsPath, 'utf-8');
        collections = JSON.parse(content);
      }

      const gameitemsDir = `${ctx.extractedDir}${path.sep}gameitems`;
      const items: Record<string, { _type: string }> = {};
      if (fs.existsSync(gameitemsDir)) {
        const files = await fs.promises.readdir(gameitemsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const itemPath = path.join(gameitemsDir, file);
            const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
            const itemData = JSON.parse(itemContent);
            const itemType = Object.keys(itemData)[0];
            const item = itemData[itemType];
            items[item.name || file] = { _type: itemType };
          }
        }
      }

      return { collections, items, selectedItems: [] };
    } catch {
      return { collections: [], items: {}, selectedItems: [] };
    }
  }

  async function getRenderProbesState(ctx: WindowContext | null): Promise<RenderProbesState | null> {
    if (!ctx?.extractedDir) return null;

    try {
      const probesPath = `${ctx.extractedDir}${path.sep}renderprobes.json`;
      let probes: RenderProbe[] = [];

      if (fs.existsSync(probesPath)) {
        const content = await fs.promises.readFile(probesPath, 'utf-8');
        probes = JSON.parse(content);
      }

      const probesMap: Record<string, RenderProbe> = {};
      for (const probe of probes) {
        probesMap[probe.name] = probe;
      }

      return { extractedDir: ctx.extractedDir, probes: probesMap, theme: getActualTheme(settings.theme) };
    } catch (e: unknown) {
      console.error('getRenderProbesState error:', e);
      return null;
    }
  }

  async function getScriptContent(ctx: WindowContext | null): Promise<string | null> {
    if (!ctx?.extractedDir) return null;
    try {
      const scriptPath = `${ctx.extractedDir}${path.sep}script.vbs`;
      const content = await fs.promises.readFile(scriptPath, 'utf-8');
      return content;
    } catch {
      return '';
    }
  }

  function createEditorWindow(): WindowContext {
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
    setWebContentsWindowId(win.webContents, id);

    const WindowContextClass = deps.WindowContext;
    const ctx = new WindowContextClass(id, win);
    windowRegistry.add(ctx);
    windowRegistry.setFocused(ctx);

    win.on('focus', () => {
      windowRegistry.setFocused(ctx);
      createMenu();
    });

    win.on('close', async (e: Event) => {
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
      win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
        query: { theme: actualTheme },
      });
    }

    createMenu();
    return ctx;
  }

  function showAboutDialog(): void {
    if (aboutWindow) {
      aboutWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    aboutWindow = new BrowserWindow({
      width: 300,
      height: 340,
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
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/about/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      aboutWindow.loadURL(url.toString());
    } else {
      aboutWindow.loadFile(path.join(__dirname, '../renderer/main_window/src/features/about/desktop/window.html'), {
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
      aboutWindow!.webContents.send('init-about', {
        version: getVersionString(),
        platform: 'Desktop',
      });
      aboutWindow!.show();
    });
  }

  function openImageManagerWindow(selectImage?: string): void {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.imageManagerWindow) {
      ctx.imageManagerWindow.focus();
      if (selectImage) {
        ctx.imageManagerWindow.webContents.send('select-image', selectImage);
      }
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'image-manager.js')
      : path.join(process.cwd(), '.vite/build/image-manager.js');

    const bounds = getWindowBounds('imageManager', { width: 950, height: 650 });
    ctx.imageManagerWindow = new BrowserWindow({
      ...bounds,
      title: 'Image Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.imageManagerWindow, 'imageManager');
    setupDialogEditMenu(ctx.imageManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/image-manager/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.imageManagerWindow.loadURL(url.toString());
    } else {
      ctx.imageManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/image-manager/desktop/window.html'),
        { query: themeQuery }
      );
    }

    ctx.imageManagerWindow.on('closed', () => {
      ctx.imageManagerWindow = null;
    });

    ctx.imageManagerWindow.webContents.on('did-finish-load', async () => {
      const title = ctx.tableName ? `Image Manager - [${ctx.tableName}.vpx]` : 'Image Manager';
      ctx.imageManagerWindow!.setTitle(title);
      const state = await getTableState(ctx);
      if (state) {
        ctx.imageManagerWindow!.webContents.send('init', { ...state, selectImage });
      }
    });
  }

  function openMaterialManagerWindow(selectMaterial?: string): void {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.materialManagerWindow) {
      ctx.materialManagerWindow.focus();
      if (selectMaterial) {
        ctx.materialManagerWindow.webContents.send('select-material', selectMaterial);
      }
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'material-manager.js')
      : path.join(process.cwd(), '.vite/build/material-manager.js');

    const bounds = getWindowBounds('materialManager', { width: 900, height: 650 });
    ctx.materialManagerWindow = new BrowserWindow({
      ...bounds,
      title: 'Material Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.materialManagerWindow, 'materialManager');
    setupDialogEditMenu(ctx.materialManagerWindow);

    ctx.materialManagerWindow.on('closed', () => {
      ctx.materialManagerWindow = null;
    });

    ctx.materialManagerWindow.webContents.on('did-finish-load', async () => {
      const title = ctx.tableName ? `Material Manager - [${ctx.tableName}.vpx]` : 'Material Manager';
      ctx.materialManagerWindow!.setTitle(title);
      const state = await getMaterialsState(ctx);
      if (state) {
        ctx.materialManagerWindow!.webContents.send('init', { ...state, selectMaterial });
      }
    });

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/material-manager/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.materialManagerWindow.loadURL(url.toString());
    } else {
      ctx.materialManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/material-manager/desktop/window.html'),
        { query: themeQuery }
      );
    }
  }

  function openSoundManagerWindow(): void {
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

    const bounds = getWindowBounds('soundManager', { width: 800, height: 550 });
    ctx.soundManagerWindow = new BrowserWindow({
      ...bounds,
      title: 'Sound Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.soundManagerWindow, 'soundManager');
    setupDialogEditMenu(ctx.soundManagerWindow);

    ctx.soundManagerWindow.on('closed', () => {
      ctx.soundManagerWindow = null;
    });

    ctx.soundManagerWindow.webContents.on('did-finish-load', async () => {
      const title = ctx.tableName ? `Sound Manager - [${ctx.tableName}.vpx]` : 'Sound Manager';
      ctx.soundManagerWindow!.setTitle(title);
      const state = await getSoundsState(ctx);
      if (state) {
        ctx.soundManagerWindow!.webContents.send('init', state);
      }
    });

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/sound-manager/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.soundManagerWindow.loadURL(url.toString());
    } else {
      ctx.soundManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/sound-manager/desktop/window.html'),
        { query: themeQuery }
      );
    }
  }

  async function openTableInfoWindow(): Promise<void> {
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
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/table-info/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      tableInfoWindow.loadURL(url.toString());
    } else {
      tableInfoWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/table-info/desktop/window.html'),
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
      tableInfoWindow!.webContents.send('init-table-info', {
        info: state.info,
        gamedata: state.gamedata,
        images: state.images,
      });
      tableInfoWindow!.show();
    });
  }

  async function openDimensionsManagerWindow(): Promise<void> {
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

    const bounds = getWindowBounds('dimensionsManager', { width: 800, height: 520 });
    ctx.dimensionsManagerWindow = new BrowserWindow({
      ...bounds,
      title: 'Dimensions Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.dimensionsManagerWindow, 'dimensionsManager');
    setupDialogEditMenu(ctx.dimensionsManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/dimensions-manager/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.dimensionsManagerWindow.loadURL(url.toString());
    } else {
      ctx.dimensionsManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/dimensions-manager/desktop/window.html'),
        { query: themeQuery }
      );
    }

    ctx.dimensionsManagerWindow.on('closed', () => {
      ctx.dimensionsManagerWindow = null;
    });

    ctx.dimensionsManagerWindow.webContents.on('did-finish-load', async () => {
      const title = ctx.tableName ? `Dimensions Manager - [${ctx.tableName}.vpx]` : 'Dimensions Manager';
      ctx.dimensionsManagerWindow!.setTitle(title);
      const state = await getDimensionsState(ctx);
      if (state) {
        ctx.dimensionsManagerWindow!.webContents.send('init-dimensions', state);
      }
    });
  }

  function openCollectionManagerWindow(selectCollection?: string): void {
    const ctx = windowRegistry.getFocused();
    if (!ctx?.extractedDir) {
      dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
      return;
    }

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.focus();
      if (selectCollection) {
        ctx.collectionManagerWindow.webContents.send('select-collection', selectCollection);
      }
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    const bounds = getWindowBounds('collectionManager', { width: 500, height: 400 });
    ctx.collectionManagerWindow = new BrowserWindow({
      ...bounds,
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
    trackWindowBounds(ctx.collectionManagerWindow, 'collectionManager');
    setupDialogEditMenu(ctx.collectionManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/collection-manager/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.collectionManagerWindow.loadURL(url.toString());
    } else {
      ctx.collectionManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/collection-manager/desktop/window.html'),
        { query: themeQuery }
      );
    }

    ctx.collectionManagerWindow.on('close', (e: Event) => {
      if (collectionEditorWindow && !collectionEditorWindow.isDestroyed()) {
        e.preventDefault();
        collectionEditorWindow.focus();
        return;
      }
      if (collectionPromptWindow && !collectionPromptWindow.isDestroyed()) {
        e.preventDefault();
        collectionPromptWindow.focus();
        return;
      }
    });

    ctx.collectionManagerWindow.on('closed', () => {
      ctx.collectionManagerWindow = null;
    });

    ctx.collectionManagerWindow.webContents.on('did-finish-load', async () => {
      const title = ctx.tableName ? `Collection Manager - [${ctx.tableName}.vpx]` : 'Collection Manager';
      ctx.collectionManagerWindow!.setTitle(title);
      const data = await getCollectionManagerData(ctx);
      ctx.collectionManagerWindow!.webContents.send('init-collection-manager', { ...data, selectCollection });
      ctx.collectionManagerWindow!.show();
      ctx.window.webContents.send('request-selection-resend');
    });
  }

  function openRenderProbeManagerWindow(): void {
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

    const bounds = getWindowBounds('renderProbeManager', { width: 700, height: 600 });
    ctx.renderProbeManagerWindow = new BrowserWindow({
      ...bounds,
      title: 'Render Probe Manager',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.renderProbeManagerWindow, 'renderProbeManager');
    setupDialogEditMenu(ctx.renderProbeManagerWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/render-probe-manager/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.renderProbeManagerWindow.loadURL(url.toString());
    } else {
      ctx.renderProbeManagerWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/render-probe-manager/desktop/window.html'),
        { query: themeQuery }
      );
    }

    ctx.renderProbeManagerWindow.on('closed', () => {
      ctx.renderProbeManagerWindow = null;
    });

    ctx.renderProbeManagerWindow.webContents.on('did-finish-load', async () => {
      const title = ctx.tableName ? `Render Probe Manager - [${ctx.tableName}.vpx]` : 'Render Probe Manager';
      ctx.renderProbeManagerWindow!.setTitle(title);
      const state = await getRenderProbesState(ctx);
      if (state) {
        ctx.renderProbeManagerWindow!.webContents.send('init', state);
      }
    });
  }

  function openScriptEditorWindow(ctx?: WindowContext | null): void {
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

    const bounds = getWindowBounds('scriptEditor', { width: 1000, height: 700 });
    ctx.scriptEditorWindow = new BrowserWindow({
      ...bounds,
      title: 'Script Editor',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.scriptEditorWindow, 'scriptEditor');
    setupDialogEditMenu(ctx.scriptEditorWindow);

    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('script-editor-opened');
    }

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/script-editor/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.scriptEditorWindow.loadURL(url.toString());
    } else {
      ctx.scriptEditorWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/script-editor/desktop/window.html'),
        {
          query: themeQuery,
        }
      );
    }

    const localCtx = ctx;
    ctx.scriptEditorWindow.on('close', (e: Event) => {
      if (localCtx.scriptEditorClosePending) return;
      e.preventDefault();
      localCtx.scriptEditorClosePending = true;
      localCtx.scriptEditorWindow!.webContents.send('check-can-close');
    });

    ctx.scriptEditorWindow.on('closed', () => {
      localCtx.scriptEditorWindow = null;
      localCtx.scriptEditorClosePending = false;
      if (localCtx.window && !localCtx.window.isDestroyed()) {
        localCtx.window.webContents.send('script-editor-closed');
      }
    });

    ctx.scriptEditorWindow.webContents.on('did-finish-load', async () => {
      const scriptTitle = localCtx.tableName ? `Script Editor - [${localCtx.tableName}.vpx]` : 'Script Editor';
      localCtx.scriptEditorWindow!.setTitle(scriptTitle);
      const script = await getScriptContent(localCtx);
      let gameitems: { name: string; type: string }[] = [];
      try {
        const gameitemsContent = await fs.promises.readFile(
          path.join(localCtx.extractedDir!, 'gameitems.json'),
          'utf-8'
        );
        const gameitemsData: { file_name: string }[] = JSON.parse(gameitemsContent);
        for (const gi of gameitemsData) {
          if (!gi.file_name) continue;
          try {
            const itemPath = path.join(localCtx.extractedDir!, 'gameitems', gi.file_name);
            const itemContent = await fs.promises.readFile(itemPath, 'utf-8');
            const itemData = JSON.parse(itemContent);
            const type = Object.keys(itemData)[0];
            const item = itemData[type];
            if (item.name) {
              gameitems.push({ name: item.name, type });
            }
          } catch {}
        }
      } catch {}
      try {
        const gamedataContent = await fs.promises.readFile(`${localCtx.extractedDir}${path.sep}gamedata.json`, 'utf-8');
        const gamedata = JSON.parse(gamedataContent);
        if (gamedata.name) {
          gameitems.push({ name: gamedata.name, type: 'Table' });
        }
      } catch {}
      localCtx.scriptEditorWindow!.webContents.send('init', {
        script: script || '',
        extractedDir: localCtx.extractedDir,
        theme: getActualTheme(settings.theme),
        gameitems,
        tableName: localCtx.tableName,
        isLocked: localCtx.isTableLocked,
        cursorPosition: localCtx.scriptEditorCursorPosition,
      });
    });
  }

  function openSettingsWindow(): void {
    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    settingsWindow = new BrowserWindow({
      width: 520,
      height: 690,
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
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/settings/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      settingsWindow.loadURL(url.toString());
    } else {
      settingsWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/settings/desktop/window.html'),
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
      settingsWindow!.webContents.send('init-settings', {
        theme: settings.theme,
        gridSize: settings.gridSize,
        textureQuality: settings.textureQuality,
        unitConversion: settings.unitConversion ?? DEFAULT_UNIT_CONVERSION,
        vpinballPath: settings.vpinballPath,
        editorColors: settings.editorColors,
        alwaysDrawDragPoints: settings.alwaysDrawDragPoints,
        drawLightCenters: settings.drawLightCenters,
      });
      settingsWindow!.show();
    });
  }

  function openTransformWindow(type: string, data: TransformData, ctx: WindowContext): void {
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
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/transform/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      transformWindow.loadURL(url.toString());
    } else {
      transformWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/transform/desktop/window.html'),
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
      transformWindow!.webContents.send('init-transform', {
        type,
        centerX: data.centerX,
        centerY: data.centerY,
        mouseX: data.mouseX,
        mouseY: data.mouseY,
      });
      transformWindow!.show();
    });
  }

  function openMeshImportWindow(ctx: WindowContext): Promise<MeshImportResult | null> {
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
        const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        url.pathname = '/src/features/mesh-import/desktop/window.html';
        url.searchParams.set('theme', themeQuery.theme);
        meshImportWindow.loadURL(url.toString());
      } else {
        meshImportWindow.loadFile(
          path.join(__dirname, '../renderer/main_window/src/features/mesh-import/desktop/window.html'),
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
        meshImportWindow!.show();
      });
    });
  }

  function openDrawingOrderWindow(
    ctx: WindowContext,
    mode: string,
    items: DrawingOrderItem[]
  ): Promise<string[] | null> {
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
        const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        url.pathname = '/src/features/drawing-order/desktop/window.html';
        url.searchParams.set('theme', themeQuery.theme);
        drawingOrderWindow.loadURL(url.toString());
      } else {
        drawingOrderWindow.loadFile(
          path.join(__dirname, '../renderer/main_window/src/features/drawing-order/desktop/window.html'),
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
        drawingOrderWindow!.webContents.send('init-drawing-order', { mode, items });
        drawingOrderWindow!.show();
      });
    });
  }

  async function showSearchSelect(): Promise<void> {
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

    const bounds = getWindowBounds('searchSelect', { width: 1100, height: 600 });
    ctx.searchSelectWindow = new BrowserWindow({
      ...bounds,
      title: 'Search/Select Element',
      minimizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trackWindowBounds(ctx.searchSelectWindow, 'searchSelect');
    setupDialogEditMenu(ctx.searchSelectWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/search-select/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      ctx.searchSelectWindow.loadURL(url.toString());
    } else {
      ctx.searchSelectWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/search-select/desktop/window.html'),
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
        ctx.searchSelectWindow!.webContents.send('init', state);
      }
      ctx.window.webContents.send('request-selection-resend');
    });
  }

  async function openCollectionEditorWindow(ctx: WindowContext, collectionName: string): Promise<void> {
    if (!ctx.extractedDir) return;
    if (collectionEditorWindow) {
      collectionEditorWindow.focus();
      return;
    }

    const collectionsPath = path.join(ctx.extractedDir, 'collections.json');
    let collections: Collection[] = [];
    if (fs.existsSync(collectionsPath)) {
      const content = await fs.promises.readFile(collectionsPath, 'utf-8');
      collections = JSON.parse(content);
    }

    const collection = collections.find(c => c.name === collectionName);
    if (!collection) return;

    const gameitemsDir = `${ctx.extractedDir}${path.sep}gameitems`;
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

    const includedItems = [...(collection.items || [])];
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
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/collection-manager/desktop/editor-window.html';
      url.searchParams.set('theme', themeQuery.theme);
      collectionEditorWindow.loadURL(url.toString());
    } else {
      collectionEditorWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/collection-manager/desktop/editor-window.html'),
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

    const initData: CollectionEditorInitData = {
      collectionName: collection.name,
      includedItems,
      availableItems,
      existingNames: collections.map(c => c.name),
      fireEvents: (collection as { fire_events?: boolean }).fire_events ?? false,
      stopSingle: (collection as { stop_single_events?: boolean }).stop_single_events ?? false,
      groupElements: (collection as { group_elements?: boolean }).group_elements ?? false,
    };

    collectionEditorWindow.webContents.on('did-finish-load', () => {
      collectionEditorWindow!.webContents.send('init-collection-editor', initData);
      collectionEditorWindow!.show();
    });
  }

  async function openMaterialEditorWindow(
    ctx: WindowContext,
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ): Promise<void> {
    if (materialEditorWindow) {
      materialEditorWindow.focus();
      return;
    }

    materialEditorContext = ctx;

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'index.js')
      : path.join(process.cwd(), '.vite/build/index.js');

    materialEditorWindow = new BrowserWindow({
      width: 400,
      height: 380,
      title: mode === 'new' ? 'New Material' : 'Clone Material',
      show: false,
      minimizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/material-manager/desktop/editor-window.html';
      url.searchParams.set('theme', themeQuery.theme);
      materialEditorWindow.loadURL(url.toString());
    } else {
      materialEditorWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/material-manager/desktop/editor-window.html'),
        { query: themeQuery }
      );
    }

    materialEditorWindow.on('closed', () => {
      materialEditorWindow = null;
      materialEditorContext = null;
      createMenu();
    });

    materialEditorWindow.webContents.on('did-finish-load', () => {
      materialEditorWindow!.webContents.send('init-material-editor', {
        material,
        mode,
        existingNames,
        originalName,
      });
      materialEditorWindow!.show();
    });
  }

  async function openCollectionPromptWindow(ctx: WindowContext, mode: string, currentName?: string): Promise<void> {
    if (!ctx.extractedDir) return;
    if (collectionPromptWindow) {
      collectionPromptWindow.focus();
      return;
    }

    collectionPromptContext = ctx;
    collectionPromptMode = mode;
    collectionPromptCurrentName = currentName || '';

    const collectionsPath = path.join(ctx.extractedDir, 'collections.json');
    let collections: Collection[] = [];
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
      defaultValue = currentName!;
      title = 'Rename Collection';
    }

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'prompt.js')
      : path.join(process.cwd(), '.vite/build/prompt.js');

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
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/prompt/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      collectionPromptWindow.loadURL(url.toString());
    } else {
      collectionPromptWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/prompt/desktop/window.html'),
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
      collectionPromptWindow!.webContents.send('init-prompt', {
        mode,
        entityType: 'collection',
        currentName: currentName || '',
        defaultValue,
        existingNames,
      });
      collectionPromptWindow!.show();
    });
  }

  async function openRenamePromptWindow(
    ctx: WindowContext,
    entityType: string,
    currentName: string,
    existingNames?: string[]
  ): Promise<void> {
    if (!ctx.extractedDir) return;
    if (renamePromptWindow) {
      renamePromptWindow.focus();
      return;
    }

    renamePromptData = {
      ctx,
      entityType,
      currentName,
      existingNames: existingNames || [],
    };

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'prompt.js')
      : path.join(process.cwd(), '.vite/build/prompt.js');

    const titleMap: Record<string, string> = {
      table: 'Rename Table',
      image: 'Rename Image',
      sound: 'Rename Sound',
      material: 'Rename Material',
      collection: 'Rename Collection',
      renderprobe: 'Rename Render Probe',
    };
    const title = titleMap[entityType] || `Rename ${entityType}`;
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

    if (entityType === 'image' && ctx.imageManagerWindow && !ctx.imageManagerWindow.isDestroyed()) {
      ctx.imageManagerWindow.webContents.send('set-disabled', true);
    } else if (entityType === 'sound' && ctx.soundManagerWindow && !ctx.soundManagerWindow.isDestroyed()) {
      ctx.soundManagerWindow.webContents.send('set-disabled', true);
    } else if (entityType === 'material' && ctx.materialManagerWindow && !ctx.materialManagerWindow.isDestroyed()) {
      ctx.materialManagerWindow.webContents.send('set-disabled', true);
    } else if (
      entityType === 'renderprobe' &&
      ctx.renderProbeManagerWindow &&
      !ctx.renderProbeManagerWindow.isDestroyed()
    ) {
      ctx.renderProbeManagerWindow.webContents.send('set-disabled', true);
    } else {
      windowRegistry.forEach(c => {
        c.window.webContents.send('set-input-disabled', true);
      });
    }
    createMenu();
    setupDialogEditMenu(renamePromptWindow);

    const themeQuery = { theme: getActualTheme(settings.theme) };
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      url.pathname = '/src/features/prompt/desktop/window.html';
      url.searchParams.set('theme', themeQuery.theme);
      renamePromptWindow.loadURL(url.toString());
    } else {
      renamePromptWindow.loadFile(
        path.join(__dirname, '../renderer/main_window/src/features/prompt/desktop/window.html'),
        { query: themeQuery }
      );
    }

    renamePromptWindow.on('closed', () => {
      if (renamePromptData) {
        const { ctx: promptCtx, entityType: type } = renamePromptData;
        if (type === 'image' && promptCtx.imageManagerWindow && !promptCtx.imageManagerWindow.isDestroyed()) {
          promptCtx.imageManagerWindow.webContents.send('set-disabled', false);
        } else if (type === 'sound' && promptCtx.soundManagerWindow && !promptCtx.soundManagerWindow.isDestroyed()) {
          promptCtx.soundManagerWindow.webContents.send('set-disabled', false);
        } else if (
          type === 'material' &&
          promptCtx.materialManagerWindow &&
          !promptCtx.materialManagerWindow.isDestroyed()
        ) {
          promptCtx.materialManagerWindow.webContents.send('set-disabled', false);
        } else if (
          type === 'renderprobe' &&
          promptCtx.renderProbeManagerWindow &&
          !promptCtx.renderProbeManagerWindow.isDestroyed()
        ) {
          promptCtx.renderProbeManagerWindow.webContents.send('set-disabled', false);
        } else {
          windowRegistry.forEach(c => {
            c.window.webContents.send('set-input-disabled', false);
          });
        }
      }
      renamePromptWindow = null;
      renamePromptData = null;
      createMenu();
    });

    renamePromptWindow.webContents.on('did-finish-load', () => {
      renamePromptWindow!.webContents.send('init-prompt', {
        mode: 'rename',
        entityType,
        currentName,
        defaultValue: currentName,
        existingNames: existingNames || [],
        maxLength: entityType === 'table' || entityType === 'element' ? 32 : 0,
      });
      renamePromptWindow!.show();
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
    openMeshImportWindow,
    openDrawingOrderWindow,
    showSearchSelect,
    setupDialogEditMenu,
    getWindowStates: (): WindowStates => ({
      settingsWindow,
      transformWindow,
      aboutWindow,
      tableInfoWindow,
      meshImportWindow,
      drawingOrderWindow,
      collectionEditorWindow,
      collectionPromptWindow,
      renamePromptWindow,
    }),
    getTransformWindowContext: (): WindowContext | null => transformWindowContext,
    getTableInfoWindowContext: (): WindowContext | null => tableInfoWindowContext,
    getMeshImportWindowContext: (): WindowContext | null => meshImportWindowContext,
    getDrawingOrderWindowContext: (): WindowContext | null => drawingOrderWindowContext,
    resolveMeshImport: (result: MeshImportResult | null): void => {
      if (meshImportResolve) {
        meshImportResolve(result);
        meshImportResolve = null;
      }
      if (meshImportWindow) {
        meshImportWindow.close();
      }
    },
    resolveDrawingOrder: (result: string[] | null): void => {
      if (drawingOrderResolve) {
        drawingOrderResolve(result);
        drawingOrderResolve = null;
      }
      if (drawingOrderWindow) {
        drawingOrderWindow.close();
      }
    },
    openCollectionEditorWindow,
    openCollectionPromptWindow,
    openRenamePromptWindow,
    getCollectionEditorContext: (): WindowContext | null => collectionEditorContext,
    getCollectionPromptContext: (): WindowContext | null => collectionPromptContext,
    getCollectionPromptMode: (): string | null => collectionPromptMode,
    getCollectionPromptCurrentName: (): string | null => collectionPromptCurrentName,
    getRenamePromptData: () => renamePromptData,
    closeCollectionEditor: (): void => {
      if (collectionEditorWindow) {
        collectionEditorWindow.close();
      }
    },
    closeCollectionPrompt: (): void => {
      if (collectionPromptWindow) {
        collectionPromptWindow.close();
      }
    },
    closeRenamePrompt: (): void => {
      if (renamePromptWindow) {
        renamePromptWindow.close();
      }
    },
    isCollectionEditorOpen: (): boolean => !!(collectionEditorWindow && !collectionEditorWindow.isDestroyed()),
    isCollectionPromptOpen: (): boolean => !!(collectionPromptWindow && !collectionPromptWindow.isDestroyed()),
    openMaterialEditorWindow,
    closeMaterialEditor: (): void => {
      if (materialEditorWindow) {
        materialEditorWindow.close();
      }
    },
    getMaterialEditorContext: (): WindowContext | null => materialEditorContext,
  };
}
