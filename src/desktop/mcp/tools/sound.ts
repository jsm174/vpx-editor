import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { confirmable, runEdit, NO_ACTIVE_TABLE } from './edit-util.js';

const soundSource = z.union([
  z.object({ path: z.string().describe('Absolute path to WAV/MP3/OGG/FLAC file') }),
  z.object({ base64: z.string(), mimeType: z.string().default('audio/wav').optional() }),
]);

const soundPatch = z.object({
  fade: z.number().int().optional(),
  volume: z.number().int().optional(),
  balance: z.number().int().optional(),
  output_target: z.enum(['table', 'backglass']).optional(),
});

const soundInput = z.object({
  action: z
    .enum(['list', 'add', 'modify', 'delete'])
    .describe(
      '"list": sounds in the table. "add": import a new sound (use `source`). ' +
        '"modify": replace bytes (`source`) and/or update properties (`patch`). "delete": remove it.'
    ),
  name: z
    .string()
    .optional()
    .describe(
      'Sound name. Required for add/modify/delete; for "list" omit (filter via nameRegex). ' +
        'This is the name the script references via PlaySound "name".'
    ),
  nameRegex: z.string().optional().describe('For action="list": filter sound names (case-insensitive regex).'),
  source: soundSource
    .optional()
    .describe('Required for add, optional for modify. One of: {path}, {base64, mimeType?}.'),
  patch: soundPatch
    .optional()
    .describe('For action="modify": properties to update (fade, volume, balance, output_target).'),
  ...confirmable,
});

const sound: Tool<typeof soundInput> = {
  name: 'vpx_sound',
  annotations: { destructiveHint: true },
  description:
    'Read or edit sounds in the active table. Dispatch by `action`: ' +
    '"list" (sounds, optional nameRegex filter), "add" (import a new sound from `source`), ' +
    '"modify" (replace bytes via `source` and/or update fade/volume/balance/output_target via `patch`), "delete". ' +
    'Scripts play sounds by name: PlaySound "name".',
  inputSchema: soundInput,
  async execute(input, ctx) {
    if (input.action === 'list') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      let sounds = state.sounds;
      if (input.nameRegex) {
        try {
          const re = new RegExp(input.nameRegex, 'i');
          sounds = sounds.filter(s => re.test(s.name));
        } catch (e) {
          return errorResult(`Invalid nameRegex: ${(e as Error).message}`);
        }
      }
      return jsonResult({
        total: state.sounds.length,
        matched: sounds.length,
        sounds: sounds.map(s => ({
          name: s.name,
          path: s.path,
          outputTarget: s.output_target,
          volume: s.volume,
          balance: s.balance,
          fade: s.fade,
        })),
      });
    }

    if (!input.name) return errorResult(`action="${input.action}" requires \`name\`.`);

    if (input.action === 'add') {
      if (!input.source) return errorResult('action="add" requires `source` ({path} or {base64}).');
      return runEdit(ctx, {
        kind: 'add-sound',
        payload: { name: input.name, source: input.source },
        description: `Add sound "${input.name}"`,
        preview: !input.confirm,
      });
    }

    if (input.action === 'modify') {
      if (!input.source && !input.patch) {
        return errorResult('action="modify" requires `source` (replace bytes) and/or `patch` (update properties).');
      }
      return runEdit(ctx, {
        kind: 'modify-sound',
        payload: { name: input.name, source: input.source, patch: input.patch },
        description: `Modify sound "${input.name}"`,
        preview: !input.confirm,
      });
    }

    return runEdit(ctx, {
      kind: 'delete-sound',
      payload: { name: input.name },
      description: `Delete sound "${input.name}"`,
      preview: !input.confirm,
    });
  },
};

export function buildSoundTools(): Tool[] {
  return [sound];
}
