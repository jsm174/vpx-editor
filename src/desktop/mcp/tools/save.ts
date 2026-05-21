import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';

const saveInput = z.object({});

const save: Tool<typeof saveInput> = {
  name: 'vpx_save',
  title: 'Save the table',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  description:
    "Save the active table to its .vpx file via the editor's normal save flow. If the table has never been saved " +
    "(e.g. it was just created with vpx_new), the native Save dialog opens on the USER's screen and this call waits — " +
    'tell the user to pick a location before calling, and expect a cancelled result if they dismiss it. ' +
    'Freshly created tables live in a temporary folder and are LOST if the editor closes unsaved, so offer to save ' +
    'after meaningful build steps.',
  inputSchema: saveInput,
  async execute(_input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);

    const result = await ctx.saveTable();
    if (!result.saved) {
      return errorResult(result.error ?? 'Save failed');
    }
    return jsonResult({
      saved: true,
      path: result.path,
      nextStep: 'The table is on disk. The user can play it by opening the .vpx in VPinballX, or keep building.',
    });
  },
};

export function buildSaveTools(): Tool[] {
  return [save as unknown as Tool];
}
