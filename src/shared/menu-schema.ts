export type MenuStateKey =
  | 'hasTable'
  | 'hasSelection'
  | 'hasClipboard'
  | 'isLocked'
  | 'selectionLocked'
  | 'inBackglass'
  | 'in3D'
  | 'dialogOpen'
  | 'canUndo'
  | 'canRedo'
  | 'viewSolid'
  | 'viewOutline'
  | 'viewGrid'
  | 'viewBackdrop';

export interface MenuItemSchema {
  id: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox';
  accelerator?: string;
  action?: string;
  actionArg?: string;
  submenu?: MenuItemSchema[];
  role?: string;
  requires?: MenuStateKey[];
  disabledWhen?: MenuStateKey[];
  webDisabledWhen?: MenuStateKey[];
  checkedWhen?: MenuStateKey;
  playfieldOnly?: boolean;
  backglassOnly?: boolean;
  macOnly?: boolean;
  electronOnly?: boolean;
  webOnly?: boolean;
}

export const menuSchema: MenuItemSchema[] = [
  {
    id: 'app-menu',
    label: 'VPX Editor',
    type: 'submenu',
    macOnly: true,
    electronOnly: true,
    submenu: [
      { id: 'services', role: 'services' },
      { id: 'sep-1', type: 'separator' },
      { id: 'hide', role: 'hide' },
      { id: 'hide-others', role: 'hideOthers' },
      { id: 'unhide', role: 'unhide' },
      { id: 'sep-2', type: 'separator' },
      { id: 'quit-mac', role: 'quit' },
    ],
  },
  {
    id: 'file-menu',
    label: 'File',
    type: 'submenu',
    submenu: [
      {
        id: 'new-menu',
        label: 'New',
        type: 'submenu',
        disabledWhen: ['dialogOpen'],
        webDisabledWhen: ['hasTable'],
        submenu: [
          {
            id: 'new-table',
            label: 'New Table',
            accelerator: 'CmdOrCtrl+N',
            action: 'new-table',
            actionArg: 'blankTable.vpx',
          },
          {
            id: 'new-blank',
            label: 'Completely Blank Table',
            action: 'new-table',
            actionArg: 'strippedTable.vpx',
          },
          {
            id: 'new-example',
            label: 'Full Example Table',
            action: 'new-table',
            actionArg: 'exampleTable.vpx',
          },
          {
            id: 'new-lightseq',
            label: 'Light Sequence Demo Table',
            action: 'new-table',
            actionArg: 'lightSeqTable.vpx',
          },
        ],
      },
      { id: 'file-sep-1', type: 'separator' },
      {
        id: 'open',
        label: 'Open VPX...',
        accelerator: 'CmdOrCtrl+O',
        action: 'open',
        disabledWhen: ['dialogOpen'],
        webDisabledWhen: ['hasTable'],
      },
      {
        id: 'recent-menu',
        label: 'Open Recent',
        type: 'submenu',
        disabledWhen: ['dialogOpen'],
        electronOnly: true,
        submenu: [],
      },
      { id: 'file-sep-2', type: 'separator' },
      {
        id: 'save',
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        action: 'save',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      {
        id: 'save-as',
        label: 'Save As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        action: 'save-as',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'file-sep-3', type: 'separator' },
      {
        id: 'export-blueprint',
        label: 'Export Blueprint...',
        action: 'export-blueprint',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'file-sep-4', type: 'separator' },
      {
        id: 'close',
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        action: 'close',
        disabledWhen: ['dialogOpen'],
      },
      { id: 'file-sep-quit', type: 'separator', electronOnly: true, macOnly: false },
      { id: 'quit', role: 'quit', electronOnly: true, macOnly: false },
    ],
  },
  {
    id: 'edit-menu',
    label: 'Edit',
    type: 'submenu',
    submenu: [
      {
        id: 'undo',
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        action: 'undo',
        requires: ['canUndo'],
        disabledWhen: ['dialogOpen'],
      },
      {
        id: 'redo',
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Y',
        action: 'redo',
        requires: ['canRedo'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'edit-sep-1', type: 'separator' },
      {
        id: 'lock',
        label: 'Lock',
        accelerator: 'CmdOrCtrl+Shift+L',
        action: 'toggle-lock',
        requires: ['hasSelection'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'cut',
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        action: 'cut',
        requires: ['hasSelection'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'copy',
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        action: 'copy',
        requires: ['hasSelection'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'paste',
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        action: 'paste',
        requires: ['hasClipboard'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'paste-at',
        label: 'Paste At',
        accelerator: 'CmdOrCtrl+Shift+V',
        action: 'paste-at',
        requires: ['hasClipboard'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'delete',
        label: 'Delete',
        accelerator: 'Delete',
        action: 'delete',
        requires: ['hasSelection'],
        disabledWhen: ['isLocked', 'selectionLocked', 'dialogOpen'],
      },
      { id: 'edit-sep-2', type: 'separator' },
      {
        id: 'select-element',
        label: 'Select Element',
        accelerator: 'CmdOrCtrl+Shift+E',
        action: 'select-element',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      {
        id: 'drawing-order-hit',
        label: 'Drawing Order (Hit)',
        accelerator: 'CmdOrCtrl+Shift+D',
        action: 'drawing-order',
        actionArg: 'hit',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'drawing-order-select',
        label: 'Drawing Order (Select)',
        action: 'drawing-order',
        actionArg: 'select',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
    ],
  },
  {
    id: 'view-menu',
    label: 'View',
    type: 'submenu',
    submenu: [
      {
        id: 'view-solid',
        label: 'Solid',
        type: 'checkbox',
        action: 'set-view-solid',
        checkedWhen: 'viewSolid',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      {
        id: 'view-outline',
        label: 'Outline',
        type: 'checkbox',
        action: 'set-view-outline',
        checkedWhen: 'viewOutline',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'view-sep-1', type: 'separator' },
      {
        id: 'view-grid',
        label: 'Grid',
        type: 'checkbox',
        action: 'toggle-grid',
        checkedWhen: 'viewGrid',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      {
        id: 'view-backdrop',
        label: 'Playfield Image/Backdrop',
        type: 'checkbox',
        action: 'toggle-backdrop',
        checkedWhen: 'viewBackdrop',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'view-sep-2', type: 'separator' },
      {
        id: 'script-editor',
        label: 'Script',
        accelerator: 'F7',
        action: 'open-script-editor',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'backglass-pov',
        label: 'Backglass/POV',
        type: 'checkbox',
        accelerator: 'CmdOrCtrl+Space',
        action: 'toggle-backglass',
        checkedWhen: 'inBackglass',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'view-sep-3', type: 'separator', electronOnly: true },
      {
        id: 'developer-menu',
        label: 'Developer',
        type: 'submenu',
        electronOnly: true,
        submenu: [
          { id: 'devtools', label: 'Developer Tools', role: 'toggleDevTools' },
          { id: 'reload', label: 'Reload', role: 'reload' },
        ],
      },
    ],
  },
  {
    id: 'insert-menu',
    label: 'Insert',
    type: 'submenu',
    submenu: [
      {
        id: 'insert-wall',
        label: 'Wall',
        action: 'insert-item',
        actionArg: 'Wall',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-gate',
        label: 'Gate',
        accelerator: 'CmdOrCtrl+G',
        action: 'insert-item',
        actionArg: 'Gate',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-ramp',
        label: 'Ramp',
        action: 'insert-item',
        actionArg: 'Ramp',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-flasher',
        label: 'Flasher',
        accelerator: 'CmdOrCtrl+H',
        action: 'insert-item',
        actionArg: 'Flasher',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'insert-flipper',
        label: 'Flipper',
        accelerator: 'CmdOrCtrl+F',
        action: 'insert-item',
        actionArg: 'Flipper',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-plunger',
        label: 'Plunger',
        accelerator: 'CmdOrCtrl+P',
        action: 'insert-item',
        actionArg: 'Plunger',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-bumper',
        label: 'Bumper',
        accelerator: 'CmdOrCtrl+B',
        action: 'insert-item',
        actionArg: 'Bumper',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-spinner',
        label: 'Spinner',
        accelerator: 'CmdOrCtrl+I',
        action: 'insert-item',
        actionArg: 'Spinner',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-timer',
        label: 'Timer',
        accelerator: 'CmdOrCtrl+M',
        action: 'insert-item',
        actionArg: 'Timer',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'insert-trigger',
        label: 'Trigger',
        accelerator: 'CmdOrCtrl+T',
        action: 'insert-item',
        actionArg: 'Trigger',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-light',
        label: 'Light',
        accelerator: 'CmdOrCtrl+L',
        action: 'insert-item',
        actionArg: 'Light',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'insert-kicker',
        label: 'Kicker',
        accelerator: 'CmdOrCtrl+K',
        action: 'insert-item',
        actionArg: 'Kicker',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-target',
        label: 'Target',
        action: 'insert-item',
        actionArg: 'Target',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-decal',
        label: 'Decal',
        accelerator: 'CmdOrCtrl+D',
        action: 'insert-item',
        actionArg: 'Decal',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'insert-textbox',
        label: 'Textbox',
        accelerator: 'CmdOrCtrl+E',
        action: 'insert-item',
        actionArg: 'Textbox',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        backglassOnly: true,
      },
      {
        id: 'insert-reel',
        label: 'EM Reel',
        action: 'insert-item',
        actionArg: 'Reel',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        backglassOnly: true,
      },
      {
        id: 'insert-lightseq',
        label: 'Light Sequencer',
        accelerator: 'CmdOrCtrl+Q',
        action: 'insert-item',
        actionArg: 'LightSequencer',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'insert-primitive',
        label: 'Primitive',
        accelerator: 'CmdOrCtrl+J',
        action: 'insert-item',
        actionArg: 'Primitive',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
      {
        id: 'insert-rubber',
        label: 'Rubber',
        accelerator: 'CmdOrCtrl+U',
        action: 'insert-item',
        actionArg: 'Rubber',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
        playfieldOnly: true,
      },
    ],
  },
  {
    id: 'table-menu',
    label: 'Table',
    type: 'submenu',
    submenu: [
      {
        id: 'play',
        label: 'Play',
        accelerator: 'F5',
        action: 'play',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'table-sep-1', type: 'separator' },
      {
        id: 'table-info',
        label: 'Table Info...',
        action: 'open-table-info',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      {
        id: 'sound-manager',
        label: 'Sound Manager...',
        accelerator: 'F2',
        action: 'open-sound-manager',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'image-manager',
        label: 'Image Manager...',
        accelerator: 'F3',
        action: 'open-image-manager',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'material-manager',
        label: 'Material Manager...',
        accelerator: 'F4',
        action: 'open-material-manager',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'dimensions-manager',
        label: 'Dimensions Manager...',
        action: 'open-dimensions-manager',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'collection-manager',
        label: 'Collection Manager...',
        action: 'open-collection-manager',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      {
        id: 'render-probe-manager',
        label: 'Render Probe Manager...',
        action: 'open-render-probe-manager',
        requires: ['hasTable'],
        disabledWhen: ['isLocked', 'dialogOpen'],
      },
      { id: 'table-sep-2', type: 'separator' },
      {
        id: 'lock-table',
        label: 'Lock Table',
        action: 'toggle-table-lock',
        requires: ['hasTable'],
        disabledWhen: ['dialogOpen'],
      },
      { id: 'table-sep-3', type: 'separator' },
      {
        id: 'magnify',
        label: 'Magnify',
        accelerator: 'Z',
        action: 'toggle-magnify',
        requires: ['hasTable'],
        disabledWhen: ['in3D', 'dialogOpen'],
      },
    ],
  },
  {
    id: 'preferences-menu',
    label: 'Preferences',
    type: 'submenu',
    submenu: [
      {
        id: 'settings',
        label: 'Editor / UI Options...',
        action: 'open-settings',
        disabledWhen: ['dialogOpen'],
      },
    ],
  },
  {
    id: 'window-menu',
    label: 'Window',
    type: 'submenu',
    submenu: [
      { id: 'minimize', role: 'minimize', electronOnly: true },
      { id: 'zoom', role: 'zoom', electronOnly: true },
      { id: 'window-sep-1', type: 'separator', electronOnly: true },
      {
        id: 'console',
        label: 'Console',
        accelerator: 'CmdOrCtrl+`',
        action: 'toggle-console',
      },
      { id: 'window-sep-2', type: 'separator', macOnly: true, electronOnly: true },
      { id: 'front', role: 'front', macOnly: true, electronOnly: true },
    ],
  },
  {
    id: 'help-menu',
    label: 'Help',
    type: 'submenu',
    submenu: [
      {
        id: 'about',
        label: 'About...',
        action: 'open-about',
        disabledWhen: ['dialogOpen'],
      },
    ],
  },
];

export function getMenuItemById(id: string, items: MenuItemSchema[] = menuSchema): MenuItemSchema | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.submenu) {
      const found = getMenuItemById(id, item.submenu);
      if (found) return found;
    }
  }
  return undefined;
}

export function getAllMenuItems(items: MenuItemSchema[] = menuSchema): MenuItemSchema[] {
  const result: MenuItemSchema[] = [];
  for (const item of items) {
    result.push(item);
    if (item.submenu) {
      result.push(...getAllMenuItems(item.submenu));
    }
  }
  return result;
}
