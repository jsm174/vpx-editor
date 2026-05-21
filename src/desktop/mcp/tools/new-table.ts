import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';

// Starting points map to bundled templates in public/templates (extraResource).
// "glf" is the plunger tutorial from vpx-glf: a real, minimal, already-playable GLF
// table (2 flippers, an 8-kicker trough, and a plunger) — the homebrew starting point.
// The template's embedded script predates the modern CreateGlf* API, so createNewTable
// regenerates script + collections against the bundled framework (library/glf/starter).
const STARTERS: Record<string, { template: string; title: string; description: string }> = {
  glf: {
    template: 'glfTutorialPlunger.vpx',
    title: 'GLF Tutorial Plunger',
    description:
      'Minimal playable GLF table — two flippers, a ball trough, and a plunger, already wired into the GLF event loop. The starting point for a homebrew machine.',
  },
  blank: {
    template: 'strippedTable.vpx',
    title: 'Blank Table',
    description:
      'A bare table with an apron and playfield and no game logic. Use vpx_glf(action:"scaffold") to add GLF.',
  },
};

const newTableInput = z.object({
  action: z
    .enum(['starters', 'create'])
    .describe('"starters": list the available starting points. "create": make a new table (use `start` + `name`).'),
  start: z
    .enum(['glf', 'blank'])
    .optional()
    .describe('For create: which starting point. Default "glf" (a playable GLF table).'),
  name: z.string().optional().describe('For create: the new table name (default "MyTable").'),
});

const newTable: Tool<typeof newTableInput> = {
  name: 'vpx_new',
  annotations: { openWorldHint: false },
  description:
    'Create a NEW table from a starting point — needs no table open (it opens one). ' +
    '"starters" lists the options; "create" opens a new editor window with the chosen starter. ' +
    'Use start:"glf" for a minimal, already-playable GLF table (flippers + ball trough + plunger) to build a homebrew machine on, ' +
    'or start:"blank" for a bare table. After creating, use vpx_glf to add devices and vpx_mpf to generate hardware config.',
  inputSchema: newTableInput,
  async execute(input, ctx) {
    if (input.action === 'starters') {
      return jsonResult({
        starters: Object.entries(STARTERS).map(([start, s]) => ({ start, title: s.title, description: s.description })),
        usage: 'Create one with action:"create", start:"glf"|"blank", name:"MyTable".',
      });
    }

    const start = input.start ?? 'glf';
    const starter = STARTERS[start];
    if (!starter) return errorResult(`Unknown start "${start}". Use "glf" or "blank".`);
    const name = (input.name ?? 'MyTable').trim() || 'MyTable';

    const result = await ctx.createTable(starter.template, name);
    if (!result.ok) return errorResult(`Could not create table: ${result.error}`);

    return jsonResult({
      created: true,
      start,
      title: starter.title,
      tableName: result.tableName,
      workDir: result.workDir,
      unsaved:
        'The table lives in a TEMPORARY folder and is lost if the editor closes before saving — ' +
        'offer vpx_save (opens a Save dialog for the user) once there is something worth keeping.',
      nextStep:
        start === 'glf'
          ? 'A playable GLF table is open (flippers, ball trough, plunger — wired to the bundled modern framework via CreateGlf*). ' +
            'Add devices with vpx_glf(action:"add_device"), generate MPF hardware config with vpx_mpf(action:"generate"), or inspect it with vpx_table.'
          : 'A blank table is open. Wire it for GLF with vpx_glf(action:"scaffold"), or add parts with vpx_part.',
    });
  },
};

export function buildNewTableTools(): Tool[] {
  return [newTable];
}
