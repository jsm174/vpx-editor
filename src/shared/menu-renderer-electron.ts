import { Menu, BrowserWindow, MenuItemConstructorOptions, BaseWindow, MenuItem, KeyboardEvent } from 'electron';
import { menuSchema, type MenuItemSchema } from './menu-schema';
import { evaluateMenuItem, filterMenuForPlatform, type EvaluationContext } from './menu-evaluator';
import type { MenuState } from './menu-state';

export interface ElectronMenuDeps {
  windowRegistry: {
    getFocused: () => WindowContext | null;
    getByWindow: (w: BrowserWindow | undefined) => WindowContext | null;
    getAll: () => WindowContext[];
    count: () => number;
  };
  settings: {
    recentFiles: string[];
    viewSolid: boolean;
    viewOutline: boolean;
    viewGrid: boolean;
    viewBackdrop: boolean;
  };
  clipboardState: {
    hasSelection: boolean;
    hasClipboard: boolean;
    isLocked: boolean;
  };
  undoState: {
    canUndo: boolean;
    canRedo: boolean;
  };
  windowStates: {
    settingsWindow: BrowserWindow | null;
    transformWindow: BrowserWindow | null;
    aboutWindow: BrowserWindow | null;
    tableInfoWindow: BrowserWindow | null;
    collectionPromptWindow?: BrowserWindow | null;
    collectionEditorWindow?: BrowserWindow | null;
    meshImportWindow: BrowserWindow | null;
    drawingOrderWindow: BrowserWindow | null;
    renamePromptWindow?: BrowserWindow | null;
    nativeDialogOpen?: boolean;
  };
  actions: ElectronMenuActions;
}

export interface ElectronMenuActions {
  createNewTable: (template: string, name: string) => void;
  openVPX: () => void;
  extractVPX: (filePath: string, options: { forceExtract: boolean }) => void;
  saveVPX: () => void;
  saveVPXAs: () => void;
  saveSettings: () => void;
  createMenu: () => void;
  closeWindow: () => void;
  showSearchSelect: () => void;
  showDrawingOrder: (mode: string) => void;
  setViewSolid: (enabled: boolean) => void;
  setViewOutline: (enabled: boolean) => void;
  toggleViewGrid: () => void;
  toggleViewBackdrop: () => void;
  toggleBackglassView: () => void;
  openScriptEditorWindow: () => void;
  playTable: () => void;
  openTableInfoWindow: () => void;
  openSoundManagerWindow: () => void;
  openImageManagerWindow: () => void;
  openMaterialManagerWindow: () => void;
  openDimensionsManagerWindow: () => void;
  openCollectionManagerWindow: () => void;
  openRenderProbeManagerWindow: () => void;
  toggleTableLock: () => void;
  openSettingsWindow: () => void;
  showAboutDialog: () => void;
}

interface WindowContext {
  window: BrowserWindow;
  tableName?: string | null;
  hasTable: () => boolean;
  isTableLocked?: boolean;
  backglassViewEnabled?: boolean;
  is3DMode?: boolean;
}

function getMenuState(deps: ElectronMenuDeps): MenuState {
  const { windowRegistry, settings, clipboardState, undoState, windowStates } = deps;
  const ctx = windowRegistry.getFocused();
  const hasTable = ctx?.hasTable() ?? false;
  const isLocked = ctx?.isTableLocked ?? false;
  const inBackglass = ctx?.backglassViewEnabled ?? false;
  const in3D = ctx?.is3DMode ?? false;

  const dialogOpen =
    !!windowStates.settingsWindow ||
    !!windowStates.transformWindow ||
    !!windowStates.aboutWindow ||
    !!windowStates.tableInfoWindow ||
    !!windowStates.collectionPromptWindow ||
    !!windowStates.collectionEditorWindow ||
    !!windowStates.meshImportWindow ||
    !!windowStates.drawingOrderWindow ||
    !!windowStates.renamePromptWindow ||
    !!windowStates.nativeDialogOpen;

  return {
    hasTable,
    hasSelection: clipboardState.hasSelection,
    hasClipboard: clipboardState.hasClipboard,
    isLocked,
    selectionLocked: clipboardState.isLocked,
    inBackglass,
    in3D,
    dialogOpen,
    canUndo: undoState.canUndo,
    canRedo: undoState.canRedo,
    viewSolid: settings.viewSolid,
    viewOutline: settings.viewOutline,
    viewGrid: settings.viewGrid,
    viewBackdrop: settings.viewBackdrop,
  };
}

function createActionHandler(
  action: string,
  actionArg: string | undefined,
  deps: ElectronMenuDeps
): ((menuItem: MenuItem, baseWindow: BaseWindow | undefined, event: KeyboardEvent) => void) | undefined {
  const { windowRegistry, actions, settings } = deps;

  const templateNameMap: Record<string, [string, string]> = {
    'blankTable.vpx': ['blankTable.vpx', 'New Table'],
    'strippedTable.vpx': ['strippedTable.vpx', 'Blank Table'],
    'exampleTable.vpx': ['exampleTable.vpx', 'Example Table'],
    'lightSeqTable.vpx': ['lightSeqTable.vpx', 'Light Sequence Demo'],
  };

  switch (action) {
    case 'new-table':
      return () => {
        const [template, name] = templateNameMap[actionArg || 'blankTable.vpx'] || ['blankTable.vpx', 'New Table'];
        actions.createNewTable(template, name);
      };

    case 'open':
      return () => actions.openVPX();

    case 'save':
      return () => actions.saveVPX();

    case 'save-as':
      return () => actions.saveVPXAs();

    case 'close':
      return () => actions.closeWindow();

    case 'clear-recents':
      return () => {
        settings.recentFiles = [];
        actions.saveSettings();
        actions.createMenu();
      };

    case 'undo':
      return (_menuItem, baseWindow) => {
        const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
        const editorCtx = windowRegistry.getByWindow(focusedWindow);
        if (editorCtx) {
          editorCtx.window.webContents.send('undo');
        } else if (focusedWindow) {
          focusedWindow.webContents.undo();
        }
      };

    case 'redo':
      return (_menuItem, baseWindow) => {
        const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
        const editorCtx = windowRegistry.getByWindow(focusedWindow);
        if (editorCtx) {
          editorCtx.window.webContents.send('redo');
        } else if (focusedWindow) {
          focusedWindow.webContents.redo();
        }
      };

    case 'toggle-lock':
      return () => {
        const ctx = windowRegistry.getFocused();
        ctx?.window.webContents.send('toggle-lock');
      };

    case 'copy':
      return (_menuItem, baseWindow) => {
        const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
        const editorCtx = windowRegistry.getByWindow(focusedWindow);
        if (editorCtx) {
          editorCtx.window.webContents.send('copy');
        } else if (focusedWindow) {
          focusedWindow.webContents.copy();
        }
      };

    case 'paste':
      return (_menuItem, baseWindow) => {
        const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
        const editorCtx = windowRegistry.getByWindow(focusedWindow);
        if (editorCtx) {
          editorCtx.window.webContents.send('paste');
        } else if (focusedWindow) {
          focusedWindow.webContents.paste();
        }
      };

    case 'paste-at':
      return () => {
        const ctx = windowRegistry.getFocused();
        ctx?.window.webContents.send('paste-at-original');
      };

    case 'delete':
      return () => {
        const ctx = windowRegistry.getFocused();
        ctx?.window.webContents.send('delete-selected');
      };

    case 'select-element':
      return () => actions.showSearchSelect();

    case 'drawing-order':
      return () => actions.showDrawingOrder(actionArg || 'hit');

    case 'set-view-solid':
      return () => actions.setViewSolid(true);

    case 'set-view-outline':
      return () => actions.setViewOutline(true);

    case 'toggle-grid':
      return () => actions.toggleViewGrid();

    case 'toggle-backdrop':
      return () => actions.toggleViewBackdrop();

    case 'open-script-editor':
      return () => actions.openScriptEditorWindow();

    case 'toggle-backglass':
      return () => actions.toggleBackglassView();

    case 'insert-item':
      return (_menuItem, baseWindow) => {
        const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
        const editorCtx = windowRegistry.getByWindow(focusedWindow);
        if (editorCtx && actionArg) {
          editorCtx.window.webContents.send('insert-item', actionArg);
        }
      };

    case 'play':
      return () => actions.playTable();

    case 'open-table-info':
      return () => actions.openTableInfoWindow();

    case 'open-sound-manager':
      return () => actions.openSoundManagerWindow();

    case 'open-image-manager':
      return () => actions.openImageManagerWindow();

    case 'open-material-manager':
      return () => actions.openMaterialManagerWindow();

    case 'open-dimensions-manager':
      return () => actions.openDimensionsManagerWindow();

    case 'open-collection-manager':
      return () => actions.openCollectionManagerWindow();

    case 'open-render-probe-manager':
      return () => actions.openRenderProbeManagerWindow();

    case 'toggle-table-lock':
      return () => actions.toggleTableLock();

    case 'toggle-magnify':
      return () => {
        const ctx = windowRegistry.getFocused();
        ctx?.window.webContents.send('toggle-magnify');
      };

    case 'open-settings':
      return () => actions.openSettingsWindow();

    case 'open-about':
      return () => actions.showAboutDialog();

    case 'toggle-console':
      return (_menuItem, baseWindow) => {
        const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
        const editorCtx = windowRegistry.getByWindow(focusedWindow);
        if (editorCtx) {
          editorCtx.window.webContents.send('toggle-console');
        }
      };

    default:
      return undefined;
  }
}

function createRecentFilesSubmenu(deps: ElectronMenuDeps, dialogOpen: boolean): MenuItemConstructorOptions[] {
  const { settings, actions } = deps;

  if (settings.recentFiles.length === 0) {
    return [{ label: 'No Recent Files', enabled: false }];
  }

  return [
    ...settings.recentFiles.map((filePath, index) => ({
      label: `${index + 1}. ${filePath}`,
      click: () => actions.extractVPX(filePath, { forceExtract: true }),
      enabled: !dialogOpen,
    })),
    { type: 'separator' as const },
    {
      label: 'Clear Recents',
      click: () => {
        settings.recentFiles = [];
        actions.saveSettings();
        actions.createMenu();
      },
    },
  ];
}

function createWindowSubmenu(deps: ElectronMenuDeps, isMac: boolean): MenuItemConstructorOptions[] {
  const { windowRegistry } = deps;
  const ctx = windowRegistry.getFocused();
  const items: MenuItemConstructorOptions[] = [
    { role: 'minimize' },
    { role: 'zoom' },
    { type: 'separator' },
    {
      label: 'Console',
      accelerator: 'CmdOrCtrl+`',
      click: (_m: MenuItem, bw: BaseWindow | undefined) => {
        const w = bw instanceof BrowserWindow ? bw : undefined;
        const editorCtx = windowRegistry.getByWindow(w);
        if (editorCtx) {
          editorCtx.window.webContents.send('toggle-console');
        }
      },
    },
  ];

  if (windowRegistry.count() > 0) {
    items.push({ type: 'separator' });
    windowRegistry.getAll().forEach(wctx => {
      items.push({
        label: wctx.tableName ? `${wctx.tableName}.vpx` : 'Untitled',
        type: 'checkbox',
        checked: wctx === ctx,
        click: () => wctx.window.focus(),
      });
    });
  }

  if (isMac) {
    items.push({ type: 'separator' }, { role: 'front' });
  }

  return items;
}

function convertSchemaItem(
  item: MenuItemSchema,
  state: MenuState,
  context: EvaluationContext,
  deps: ElectronMenuDeps
): MenuItemConstructorOptions | null {
  if (item.role) {
    const result: MenuItemConstructorOptions = { role: item.role as MenuItemConstructorOptions['role'] };
    if (item.label) result.label = item.label;
    return result;
  }

  if (item.type === 'separator') {
    return { type: 'separator' };
  }

  const itemState = evaluateMenuItem(item, state, context);
  if (!itemState.visible) return null;

  const result: MenuItemConstructorOptions = {};

  if (item.id) result.id = item.id;
  result.label = itemState.label || item.label;

  if (item.type === 'checkbox') {
    result.type = 'checkbox';
    result.checked = itemState.checked;
  }

  if (item.accelerator) {
    result.accelerator = item.accelerator;
  }

  result.enabled = itemState.enabled;

  if (item.action) {
    const handler = createActionHandler(item.action, item.actionArg, deps);
    if (handler) {
      result.click = handler;
    }
  }

  if (item.id === 'recent-menu') {
    result.submenu = createRecentFilesSubmenu(deps, state.dialogOpen);
  } else if (item.submenu && item.submenu.length > 0) {
    const submenuItems: MenuItemConstructorOptions[] = [];
    for (const subItem of item.submenu) {
      const converted = convertSchemaItem(subItem, state, context, deps);
      if (converted) {
        submenuItems.push(converted);
      }
    }
    result.submenu = submenuItems;
  }

  return result;
}

export function createElectronMenu(deps: ElectronMenuDeps): void {
  const isMac = process.platform === 'darwin';
  const context: EvaluationContext = { platform: 'electron', isMac };
  const filteredSchema = filterMenuForPlatform(menuSchema, context);
  const state = getMenuState(deps);

  const template: MenuItemConstructorOptions[] = [];

  for (const item of filteredSchema) {
    if (item.id === 'window-menu') {
      template.push({
        label: item.label || 'Window',
        submenu: createWindowSubmenu(deps, isMac),
      });
    } else {
      const converted = convertSchemaItem(item, state, context, deps);
      if (converted) {
        template.push(converted);
      }
    }
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

export function insertItem(itemType: string, deps: ElectronMenuDeps): void {
  const ctx = deps.windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('insert-item', itemType);
  }
}
