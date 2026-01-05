import { Menu, BrowserWindow, MenuItemConstructorOptions, BaseWindow, MenuItem, KeyboardEvent } from 'electron';
import type { WindowRegistry } from '../window-context.js';

interface Settings {
  recentFiles: string[];
  viewSolid: boolean;
  viewOutline: boolean;
  viewGrid: boolean;
  viewBackdrop: boolean;
}

interface ClipboardState {
  hasSelection: boolean;
  hasClipboard: boolean;
  isLocked: boolean;
}

interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
}

interface WindowStates {
  settingsWindow: BrowserWindow | null;
  transformWindow: BrowserWindow | null;
  aboutWindow: BrowserWindow | null;
  tableInfoWindow: BrowserWindow | null;
  promptWindow: BrowserWindow | null;
  infoWindow: BrowserWindow | null;
  confirmWindow: BrowserWindow | null;
  workFolderWindow: BrowserWindow | null;
  collectionPromptWindow?: BrowserWindow | null;
  collectionEditorWindow?: BrowserWindow | null;
  meshImportWindow: BrowserWindow | null;
  drawingOrderWindow: BrowserWindow | null;
  nativeDialogOpen?: boolean;
}

interface Actions {
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

interface MenuDeps {
  windowRegistry: WindowRegistry;
  settings: Settings;
  clipboardState: ClipboardState;
  undoState: UndoState;
  windowStates: WindowStates;
  actions: Actions;
}

export function insertItem(itemType: string, deps: MenuDeps): void {
  const { windowRegistry } = deps;
  const ctx = windowRegistry.getFocused();
  if (ctx) {
    ctx.window.webContents.send('insert-item', itemType);
  }
}

export function createMenu(deps: MenuDeps): void {
  const { windowRegistry, settings, clipboardState, undoState, windowStates, actions } = deps;

  const isMac = process.platform === 'darwin';
  const ctx = windowRegistry.getFocused();
  const hasWindow = !!ctx;
  const hasTable = ctx?.hasTable() ?? false;
  const isLocked = ctx?.isTableLocked ?? false;
  const inBackglass = ctx?.backglassViewEnabled ?? false;
  const in3D = ctx?.is3DMode ?? false;
  const settingsOpen = !!windowStates.settingsWindow;
  const transformOpen = !!windowStates.transformWindow;
  const aboutOpen = !!windowStates.aboutWindow;
  const tableInfoOpen = !!windowStates.tableInfoWindow;
  const promptOpen = !!windowStates.promptWindow;
  const infoOpen = !!windowStates.infoWindow;
  const confirmOpen = !!windowStates.confirmWindow;
  const workFolderOpen = !!windowStates.workFolderWindow;
  const collectionDialogOpen = !!windowStates.collectionPromptWindow || !!windowStates.collectionEditorWindow;
  const meshImportOpen = !!windowStates.meshImportWindow;
  const drawingOrderOpen = !!windowStates.drawingOrderWindow;
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
    windowStates.nativeDialogOpen;

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'VPX Editor',
            submenu: [
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
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
              click: () => actions.createNewTable('blankTable.vpx', 'New Table'),
            },
            {
              label: 'Completely Blank Table',
              click: () => actions.createNewTable('strippedTable.vpx', 'Blank Table'),
            },
            {
              label: 'Full Example Table',
              click: () => actions.createNewTable('exampleTable.vpx', 'Example Table'),
            },
            {
              label: 'Light Sequence Demo Table',
              click: () => actions.createNewTable('lightSeqTable.vpx', 'Light Sequence Demo'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Open VPX...',
          accelerator: 'CmdOrCtrl+O',
          enabled: !dialogOpen,
          click: () => actions.openVPX(),
        },
        {
          label: 'Open Recent',
          enabled: !dialogOpen,
          submenu:
            settings.recentFiles.length > 0
              ? [
                  ...settings.recentFiles.map((filePath, index) => ({
                    label: `${index + 1}. ${filePath}`,
                    click: () => actions.extractVPX(filePath, { forceExtract: true }),
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
                ]
              : [{ label: 'No Recent Files', enabled: false }],
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: hasTable && !dialogOpen,
          click: () => actions.saveVPX(),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: hasTable && !dialogOpen,
          click: () => actions.saveVPXAs(),
        },
        { type: 'separator' },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          enabled: hasWindow && !dialogOpen,
          click: () => actions.closeWindow(),
        },
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }]),
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
          click: (_menuItem: MenuItem, baseWindow: BaseWindow | undefined, _event: KeyboardEvent) => {
            const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
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
          click: (_menuItem: MenuItem, baseWindow: BaseWindow | undefined, _event: KeyboardEvent) => {
            const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
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
          id: 'copy',
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          enabled: clipboardState.hasSelection && !isLocked && !dialogOpen,
          click: (_menuItem: MenuItem, baseWindow: BaseWindow | undefined, _event: KeyboardEvent) => {
            const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
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
          click: (_menuItem: MenuItem, baseWindow: BaseWindow | undefined, _event: KeyboardEvent) => {
            const focusedWindow = baseWindow instanceof BrowserWindow ? baseWindow : undefined;
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
          click: () => actions.showSearchSelect(),
        },
        {
          id: 'drawing-order-hit',
          label: 'Drawing Order (Hit)',
          accelerator: 'CmdOrCtrl+Shift+D',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.showDrawingOrder('hit'),
        },
        {
          id: 'drawing-order-select',
          label: 'Drawing Order (Select)',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.showDrawingOrder('select'),
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
          click: () => actions.setViewSolid(true),
        },
        {
          label: 'Outline',
          type: 'checkbox',
          checked: settings.viewOutline,
          enabled: hasTable && !dialogOpen,
          click: () => actions.setViewOutline(true),
        },
        { type: 'separator' },
        {
          label: 'Grid',
          type: 'checkbox',
          checked: settings.viewGrid,
          enabled: hasTable && !dialogOpen,
          click: () => actions.toggleViewGrid(),
        },
        {
          label: 'Playfield Image/Backdrop',
          type: 'checkbox',
          checked: settings.viewBackdrop,
          enabled: hasTable && !dialogOpen,
          click: () => actions.toggleViewBackdrop(),
        },
        { type: 'separator' },
        {
          label: 'Script',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openScriptEditorWindow(),
        },
        {
          label: 'Backglass/POV',
          type: 'checkbox',
          checked: inBackglass,
          enabled: hasTable && !dialogOpen,
          accelerator: 'CmdOrCtrl+Space',
          click: () => actions.toggleBackglassView(),
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
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Wall', deps);
          },
        },
        {
          label: 'Gate',
          accelerator: 'CmdOrCtrl+G',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Gate', deps);
          },
        },
        {
          label: 'Ramp',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Ramp', deps);
          },
        },
        {
          label: 'Flasher',
          accelerator: 'CmdOrCtrl+H',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Flasher', deps);
          },
        },
        {
          label: 'Flipper',
          accelerator: 'CmdOrCtrl+F',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Flipper', deps);
          },
        },
        {
          label: 'Plunger',
          accelerator: 'CmdOrCtrl+P',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Plunger', deps);
          },
        },
        {
          label: 'Bumper',
          accelerator: 'CmdOrCtrl+B',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Bumper', deps);
          },
        },
        {
          label: 'Spinner',
          accelerator: 'CmdOrCtrl+I',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Spinner', deps);
          },
        },
        {
          label: 'Timer',
          accelerator: 'CmdOrCtrl+M',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Timer', deps);
          },
        },
        {
          label: 'Trigger',
          accelerator: 'CmdOrCtrl+T',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Trigger', deps);
          },
        },
        {
          label: 'Light',
          accelerator: 'CmdOrCtrl+L',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Light', deps);
          },
        },
        {
          label: 'Kicker',
          accelerator: 'CmdOrCtrl+K',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Kicker', deps);
          },
        },
        {
          label: 'Target',
          accelerator: 'CmdOrCtrl+A',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
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
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Decal', deps);
          },
        },
        {
          label: 'Textbox',
          accelerator: 'CmdOrCtrl+E',
          enabled: hasTable && inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Textbox', deps);
          },
        },
        {
          label: 'EM Reel',
          accelerator: 'CmdOrCtrl+Y',
          enabled: hasTable && inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Reel', deps);
          },
        },
        {
          label: 'Light Sequencer',
          accelerator: 'CmdOrCtrl+Q',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('LightSequencer', deps);
          },
        },
        {
          label: 'Primitive',
          accelerator: 'CmdOrCtrl+J',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Primitive', deps);
          },
        },
        {
          label: 'Rubber',
          accelerator: 'CmdOrCtrl+U',
          enabled: hasTable && !inBackglass && !isLocked && !dialogOpen,
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            windowRegistry.getByWindow(w) && insertItem('Rubber', deps);
          },
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
          click: () => actions.playTable(),
        },
        { type: 'separator' },
        {
          label: 'Table Info...',
          enabled: hasTable && !dialogOpen,
          click: () => actions.openTableInfoWindow(),
        },
        {
          label: 'Sound Manager...',
          accelerator: 'F2',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openSoundManagerWindow(),
        },
        {
          label: 'Image Manager...',
          accelerator: 'F3',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openImageManagerWindow(),
        },
        {
          label: 'Material Manager...',
          accelerator: 'F4',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openMaterialManagerWindow(),
        },
        {
          label: 'Dimensions Manager...',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openDimensionsManagerWindow(),
        },
        {
          label: 'Collection Manager...',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openCollectionManagerWindow(),
        },
        {
          label: 'Render Probe Manager...',
          enabled: hasTable && !isLocked && !dialogOpen,
          click: () => actions.openRenderProbeManagerWindow(),
        },
        { type: 'separator' },
        {
          label: isLocked ? 'Unlock Table' : 'Lock Table',
          enabled: hasTable && !dialogOpen,
          click: () => actions.toggleTableLock(),
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
          click: () => actions.openSettingsWindow(),
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
          click: (_m: MenuItem, bw: BaseWindow | undefined) => {
            const w = bw instanceof BrowserWindow ? bw : undefined;
            const editorCtx = windowRegistry.getByWindow(w);
            if (editorCtx) {
              editorCtx.window.webContents.send('toggle-console');
            }
          },
        },
        ...(windowRegistry.count() > 0
          ? [
              { type: 'separator' as const },
              ...windowRegistry.getAll().map(wctx => ({
                label: wctx.tableName ? `${wctx.tableName}.vpx` : 'Untitled',
                type: 'checkbox' as const,
                checked: wctx === ctx,
                click: () => wctx.window.focus(),
              })),
            ]
          : []),
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [{ label: 'About...', enabled: !dialogOpen, click: actions.showAboutDialog }],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
