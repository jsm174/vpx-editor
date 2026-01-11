import type { MenuItemSchema } from './menu-schema';
import type { MenuState } from './menu-state';
import { getStateValue } from './menu-state';

export interface MenuItemState {
  enabled: boolean;
  checked: boolean;
  visible: boolean;
  label?: string;
}

export interface EvaluationContext {
  platform: 'electron' | 'web';
  isMac: boolean;
}

export function evaluateMenuItem(item: MenuItemSchema, state: MenuState, context: EvaluationContext): MenuItemState {
  let visible = true;
  if (item.macOnly && !context.isMac) visible = false;
  if (item.electronOnly && context.platform !== 'electron') visible = false;
  if (item.webOnly && context.platform !== 'web') visible = false;
  if (item.macOnly === false && context.isMac) visible = false;

  if (item.playfieldOnly && state.inBackglass) visible = false;
  if (item.backglassOnly && !state.inBackglass) visible = false;

  let enabled = true;

  if (item.requires) {
    for (const key of item.requires) {
      if (!getStateValue(state, key)) {
        enabled = false;
        break;
      }
    }
  }

  if (enabled && item.disabledWhen) {
    for (const key of item.disabledWhen) {
      if (getStateValue(state, key)) {
        enabled = false;
        break;
      }
    }
  }

  if (enabled && item.webDisabledWhen && context.platform === 'web') {
    for (const key of item.webDisabledWhen) {
      if (getStateValue(state, key)) {
        enabled = false;
        break;
      }
    }
  }

  let checked = false;
  if (item.checkedWhen) {
    checked = getStateValue(state, item.checkedWhen);
  }

  let label = item.label;
  if (item.id === 'lock' && state.selectionLocked) {
    label = 'Unlock';
  }
  if (item.id === 'lock-table' && state.isLocked) {
    label = 'Unlock Table';
  }

  return { enabled, checked, visible, label };
}

export function evaluateAllMenuItems(
  items: MenuItemSchema[],
  state: MenuState,
  context: EvaluationContext
): Map<string, MenuItemState> {
  const result = new Map<string, MenuItemState>();

  function processItems(menuItems: MenuItemSchema[]) {
    for (const item of menuItems) {
      if (item.id) {
        result.set(item.id, evaluateMenuItem(item, state, context));
      }
      if (item.submenu) {
        processItems(item.submenu);
      }
    }
  }

  processItems(items);
  return result;
}

export function filterMenuForPlatform(items: MenuItemSchema[], context: EvaluationContext): MenuItemSchema[] {
  return items
    .filter(item => {
      if (item.macOnly && !context.isMac) return false;
      if (item.electronOnly && context.platform !== 'electron') return false;
      if (item.webOnly && context.platform !== 'web') return false;
      if (item.macOnly === false && context.isMac) return false;
      return true;
    })
    .map(item => {
      if (item.submenu) {
        return {
          ...item,
          submenu: filterMenuForPlatform(item.submenu, context),
        };
      }
      return item;
    });
}

export function formatAccelerator(accelerator: string, isMac: boolean): string {
  if (!accelerator) return '';

  let formatted = accelerator
    .replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl')
    .replace('Cmd', '⌘')
    .replace('Ctrl', isMac ? '⌃' : 'Ctrl')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Delete', isMac ? '⌫' : 'Del');

  if (isMac) {
    formatted = formatted.replace(/\+/g, '');
  }

  return formatted;
}
