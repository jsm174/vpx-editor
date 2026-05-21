import { z } from 'zod';
import type { Tool } from '../types.js';
import { runEdit } from './edit-util.js';

const historyInput = z.object({
  action: z
    .enum(['undo', 'redo'])
    .describe('"undo" reverts the most recent edit; "redo" reapplies a previously undone edit.'),
});

const history: Tool<typeof historyInput> = {
  name: 'vpx_history',
  annotations: { destructiveHint: true },
  description:
    'Undo or redo the most recent edit in the editor, sharing one history with the user: part edits, script edits, ' +
    'material/image/sound changes. Library clone-bundle imports are NOT undoable.',
  inputSchema: historyInput,
  async execute(input, ctx) {
    return runEdit(ctx, { kind: input.action, payload: {}, description: input.action === 'undo' ? 'Undo' : 'Redo' });
  },
};

export function buildHistoryTools(): Tool[] {
  return [history];
}
