import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { confirmable, runEdit, NO_ACTIVE_TABLE } from './edit-util.js';

const materialInput = z.object({
  action: z
    .enum(['list', 'add', 'modify'])
    .describe(
      '"list": all materials with their physical/visual properties. ' +
        '"add": create a new material (use `material`, must include "name"). ' +
        '"modify": patch an existing one (use `name` + `patch`).'
    ),
  material: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('For action="add": the full material object (must include "name").'),
  name: z.string().optional().describe('For action="modify": name of the existing material.'),
  patch: z.record(z.string(), z.unknown()).optional().describe('For action="modify": fields to update.'),
  ...confirmable,
});

const material: Tool<typeof materialInput> = {
  name: 'vpx_material',
  annotations: { destructiveHint: true },
  description:
    'Read or edit materials in the active table. Dispatch by `action`: ' +
    '"list" (all materials), "add" (full material object in `material`, must include "name"), ' +
    '"modify" (pass `name` + `patch` with fields to update).',
  inputSchema: materialInput,
  async execute(input, ctx) {
    if (input.action === 'list') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      return jsonResult({ count: state.materials.length, materials: state.materials });
    }

    if (input.action === 'add') {
      if (!input.material)
        return errorResult('action="add" requires `material` field with the full material object (including name).');
      return runEdit(ctx, {
        kind: 'add-material',
        payload: { material: input.material },
        description: `Add material "${(input.material as Record<string, unknown>).name ?? 'unnamed'}"`,
        preview: !input.confirm,
      });
    }

    if (!input.name) return errorResult('action="modify" requires `name` field.');
    if (!input.patch) return errorResult('action="modify" requires `patch` field with fields to update.');
    return runEdit(ctx, {
      kind: 'modify-material',
      payload: { name: input.name, patch: input.patch },
      description: `Modify material "${input.name}"`,
      preview: !input.confirm,
    });
  },
};

export function buildMaterialTools(): Tool[] {
  return [material];
}
