import type { MenuStateKey } from './menu-schema';

export interface MenuState {
  hasTable: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  isLocked: boolean;
  selectionLocked: boolean;
  inBackglass: boolean;
  in3D: boolean;
  dialogOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  viewSolid: boolean;
  viewOutline: boolean;
  viewGrid: boolean;
  viewBackdrop: boolean;
}

export function createDefaultMenuState(): MenuState {
  return {
    hasTable: false,
    hasSelection: false,
    hasClipboard: false,
    isLocked: false,
    selectionLocked: false,
    inBackglass: false,
    in3D: false,
    dialogOpen: false,
    canUndo: false,
    canRedo: false,
    viewSolid: true,
    viewOutline: false,
    viewGrid: true,
    viewBackdrop: true,
  };
}

export function getStateValue(state: MenuState, key: MenuStateKey): boolean {
  return state[key];
}
