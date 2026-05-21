import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';

const saveInput = z.object({
  path: z
    .string()
    .optional()
    .describe(
      'Absolute path to save to: either a folder (the table is written there as <TableName>.vpx) or a full .vpx path. ' +
        'Pass the folder you are working in so the table lands next to your other files and no dialog is needed. ' +
        'Omit to save to the current location, or to open the native Save dialog if the table has never been saved.'
    ),
});

const save: Tool<typeof saveInput> = {
  name: 'vpx_save',
  title: 'Save the table',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  description:
    'Save the active table to a .vpx file. With `path`, the table is written there directly (no dialog) and the editor ' +
    'keeps using that location for later saves. Without `path`, the editor saves to its current file, or, if the table has ' +
    "never been saved, opens the native Save dialog on the USER's screen and waits — expect a cancelled result if they dismiss it. " +
    'Prefer passing the folder you are working in. Freshly created tables live in a temporary folder and are LOST if the ' +
    'editor closes unsaved, so save early.',
  inputSchema: saveInput,
  async execute(input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);

    const result = await ctx.saveTable(input.path);
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
