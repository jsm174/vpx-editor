import type { BrowserWindow } from 'electron';
import {
  createElectronMenu,
  insertItem as schemaInsertItem,
  type ElectronMenuDeps,
  type ElectronMenuActions,
} from '../shared/menu-renderer-electron';
import type { WindowRegistry } from './window-context.js';

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
  collectionPromptWindow?: BrowserWindow | null;
  collectionEditorWindow?: BrowserWindow | null;
  meshImportWindow: BrowserWindow | null;
  drawingOrderWindow: BrowserWindow | null;
  nativeDialogOpen?: boolean;
}

interface MenuDeps {
  windowRegistry: WindowRegistry;
  settings: Settings;
  clipboardState: ClipboardState;
  undoState: UndoState;
  windowStates: WindowStates;
  actions: ElectronMenuActions;
}

export function insertItem(itemType: string, deps: MenuDeps): void {
  schemaInsertItem(itemType, deps as ElectronMenuDeps);
}

export function createMenu(deps: MenuDeps): void {
  createElectronMenu(deps as ElectronMenuDeps);
}
