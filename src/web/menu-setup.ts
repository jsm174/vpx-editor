import { createWebMenuRenderer, type WebMenuRenderer } from '../shared/menu-renderer-web';
import { createDefaultMenuState, type MenuState } from '../shared/menu-state';
import { createMenuActionHandler, type MenuActionContext } from './menu-actions';
import { isTableLoaded } from './vpx-file-operations';
import { state, getEvents } from './state';

let menuRenderer: WebMenuRenderer | null = null;
let currentMenuState: MenuState = createDefaultMenuState();
let isBackglassMode = false;

export function getIsBackglassMode(): boolean {
  return isBackglassMode;
}

export function setIsBackglassMode(value: boolean): void {
  isBackglassMode = value;
}

export function setupMenu(context: MenuActionContext): void {
  const menuDropdown = document.getElementById('menu-dropdown');
  const hamburgerBtn = document.getElementById('hamburger-btn');

  if (!menuDropdown || !hamburgerBtn) return;

  const events = getEvents();
  const actionHandler = createMenuActionHandler(context);

  menuRenderer = createWebMenuRenderer({
    onAction: actionHandler,
  });

  currentMenuState = {
    ...createDefaultMenuState(),
    hasTable: isTableLoaded(),
    isLocked: state.globalIsTableLocked,
  };

  menuRenderer.updateState(currentMenuState);
  menuRenderer.render(menuDropdown);

  hamburgerBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (menuDropdown.classList.contains('show')) {
      menuDropdown.classList.remove('show');
    } else {
      menuDropdown.classList.add('show');
    }
  });

  document.addEventListener('click', e => {
    if (!menuDropdown.contains(e.target as Node) && e.target !== hamburgerBtn) {
      menuDropdown.classList.remove('show');
    }
  });

  events.on('table-loaded', () => {
    updateMenuState({ hasTable: true });
  });

  events.on('table-closed', () => {
    updateMenuState({ hasTable: false, hasSelection: false, hasClipboard: false });
  });

  events.on('table-lock-changed', (locked: boolean) => {
    updateMenuState({ isLocked: locked });
  });

  events.on('selection-changed', (items: string[]) => {
    updateMenuState({ hasSelection: items && items.length > 0 });
  });

  events.on('clipboard-changed', (hasData: boolean) => {
    updateMenuState({ hasClipboard: hasData });
  });

  events.on('undo-state-changed', (data: { canUndo: boolean; canRedo: boolean }) => {
    updateMenuState({ canUndo: data.canUndo, canRedo: data.canRedo });
  });

  events.on('backglass-view-changed', (enabled: boolean) => {
    isBackglassMode = enabled;
    updateMenuState({ inBackglass: enabled });
  });

  events.on(
    'view-settings-changed',
    (settings: { solid?: boolean; outline?: boolean; grid?: boolean; backdrop?: boolean }) => {
      const updates: Partial<MenuState> = {};
      if (settings.solid !== undefined) updates.viewSolid = settings.solid;
      if (settings.outline !== undefined) updates.viewOutline = settings.outline;
      if (settings.grid !== undefined) updates.viewGrid = settings.grid;
      if (settings.backdrop !== undefined) updates.viewBackdrop = settings.backdrop;
      updateMenuState(updates);
    }
  );
}

export function updateMenuState(updates: Partial<MenuState>): void {
  currentMenuState = { ...currentMenuState, ...updates };
  if (menuRenderer) {
    menuRenderer.updateState(currentMenuState);
  }
}

export function getMenuState(): MenuState {
  return currentMenuState;
}
