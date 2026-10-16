import { getAllMenuItems } from './menu-schema.js';
import { formatAccelerator } from './menu-evaluator.js';

const INSERT_ARG_TO_ELEMENT_TYPE: Record<string, string> = {
  Target: 'HitTarget',
  Textbox: 'TextBox',
};

export function insertShortcuts(isMac: boolean): Record<string, string> {
  const shortcuts: Record<string, string> = {};
  for (const item of getAllMenuItems()) {
    if (item.action !== 'insert-item' || !item.actionArg || !item.accelerator) continue;
    const type = INSERT_ARG_TO_ELEMENT_TYPE[item.actionArg] ?? item.actionArg;
    shortcuts[type] = formatAccelerator(item.accelerator, isMac);
  }
  return shortcuts;
}
