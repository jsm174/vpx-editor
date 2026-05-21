import { z } from 'zod';
import path from 'node:path';
import fs from 'fs-extra';
import { findItem } from '../../../shared/table-state.js';
import { errorResult, jsonResult, type Tool, type ToolContext } from '../types.js';
import {
  addPartSchema,
  modifyPartSchema,
  extractAddPartFields,
  extractModifyPartFields,
  PART_TYPES,
} from '../schemas/part-schemas.js';
import { confirmable, runEdit, NO_ACTIVE_TABLE } from './edit-util.js';

const xyzInput = z.object({ x: z.number(), y: z.number(), z: z.number().optional() });

// Permissive on purpose: a z.union of add+modify schemas is ambiguous (both accept `position`),
// so Zod resolves it to the add branch at the top level and STRIPS `partName` before execute runs.
// We document the common fields and `.passthrough()` everything, then validate against the
// correct schema inside execute where `action` disambiguates.
const partSpec = z
  .object({
    type: z.enum(PART_TYPES as unknown as [string, ...string[]]).describe('Part type.'),
    partName: z.string().optional().describe('REQUIRED for action="modify": name of the EXISTING part to change.'),
    name: z.string().optional().describe('For action="add": optional name (auto-generated if omitted).'),
    position: xyzInput
      .optional()
      .describe('For add: where to place {x,y,z?}. For modify: MOVES the part to this anchor (works for every type).'),
  })
  .passthrough();

const PART_HINTS: Record<string, string[]> = {
  Primitive: [
    '⚠️ TEXTURE QUADRANT RULE — read this BEFORE generating any image for an n-gon Primitive (use_3d_mesh: false, sides ≥ 5). ' +
      'vpinball samples ONLY the top-left quarter of the image: UV (0,0)→(0.5,0.5). Your disc art must live in that quadrant. ' +
      'For a 1024×1024 PNG: center at (256, 256), NOT (512, 512). Outer disc radius ~252. ' +
      'Label radius ~100. Spindle hole at (256, 256) radius ~6. Leave the other 75% of the PNG transparent. ' +
      "If your texture appears off-center, wraps around the side, or the design lands at the disc's edge — this rule is the cause. " +
      "Canonical reference: Tron Legacy's Disc.png.",
    "For a spinning flat disc, drive `RotAndTra(2)` from VBS — that's the world Z rotation (index 2 of the rot_and_tra array; vpin: src/vpx/gameitem/primitive.rs:49-65). RotZ and ObjRotZ also rotate visually but RotAndTra(2) is the canonical Tron-style pattern.",
    'For ball physics on a turntable, add an invisible Trigger covering the disc footprint (shape: "none", is_visible: false) and use core.vbs\'s cvpmTurntable class. See vpx_reference(action:"patterns", name:"spinning_disc") for the full recipe.',
  ],
  Timer: [
    'Timer needs BOTH `is_timer_enabled: true` AND a non-default `timer_interval` (milliseconds). With is_timer_enabled: false, the {Name}_Timer Sub never fires.',
    'The on-disk field is `timer_interval`, not `interval`.',
  ],
  Trigger: [
    "Triggers have BOTH `is_enabled` (whether collision events fire) and `is_timer_enabled` (whether {Name}_Timer fires). They're independent — you can have one without the other.",
    'For invisible physics-only triggers, set `shape: "none"` and `is_visible: false`. drag_points define the trigger\'s footprint; for a circular area around `position`, a square of 4 drag_points works fine.',
  ],
  Flasher: [
    'Flashers blend two images (image_a, image_b) using `filter_amount` (0-100) and `modulate_vs_add`. For a simple textured plane, set just image_a and leave image_b empty.',
    'Drive RotZ via VBS to spin the entire flasher. drag_points define the 2D shape — usually a 4-point rectangle.',
  ],
};

const partInput = z.object({
  action: z
    .enum(['add', 'modify', 'delete', 'template', 'export'])
    .describe(
      '"add" creates a new part, "modify" patches/moves an existing one, "delete" removes one, ' +
        '"template" returns a valid JSON skeleton + gotchas for a type (call BEFORE add), ' +
        '"export" writes a part\'s raw JSON to disk.'
    ),
  part: partSpec
    .optional()
    .describe(
      'For add/modify. For add: include `type` + `position`. For modify: include `type` + `partName` (+ any fields to change, including `position` to MOVE it). ' +
        'Type-specific fields are validated on submit — call action="template" to see them all.'
    ),
  type: z.string().optional().describe('For action="template": VPX item type, e.g. "Primitive", "Bumper", "Ramp".'),
  name: z.string().optional().describe('For action="delete"/"export": name of the part.'),
  outputPath: z.string().optional().describe('For action="export": absolute path to write the JSON file to.'),
  preview: z
    .boolean()
    .optional()
    .describe('For add/modify: return the resolved payload without applying it (add/modify apply by default).'),
  ...confirmable,
});

function formatIssues(err: z.ZodError): string {
  return err.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

// The per-type schemas only declare a curated subset of each part's fields (the rest are meant to
// go through `more`). Agents naturally set fields at the top level, so any field not in the branch
// would be silently stripped. Since the renderer assigns arbitrary keys, we fold those extras back
// in — guaranteeing every field the caller provided actually reaches the part. Returns the folded
// keys so callers can verify them against a real part sample (a typo'd key would otherwise persist
// harmlessly in the work folder, do nothing in-game, and be dropped on the next extract).
function foldExtraFields(source: Record<string, unknown>, target: Record<string, unknown>, skip: string[]): string[] {
  const folded: string[] = [];
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith('_') || skip.includes(k)) continue;
    if (!(k in target)) {
      target[k] = v;
      folded.push(k);
    }
  }
  return folded;
}

const BUNDLED_SAMPLE_TABLES = [
  'exampleTable.vpx',
  'glfTutorialPlunger.vpx',
  'glfExampleTable.vpx',
  'lightSeqTable.vpx',
];

async function findSampleForType(
  ctx: ToolContext,
  wantedType: string
): Promise<{ source: string; data: Record<string, unknown> } | null> {
  const state = await ctx.loadActiveState();
  const active = state?.items.find(i => i.type === wantedType);
  if (active) return { source: `active:${active.name}`, data: active.data };
  if (ctx.config.templatesPath) {
    for (const file of BUNDLED_SAMPLE_TABLES) {
      const bundled = await ctx.loadTable(path.join(ctx.config.templatesPath, file));
      const sample = bundled?.items.find(i => i.type === wantedType);
      if (sample) return { source: `bundled:${file}:${sample.name}`, data: sample.data };
    }
  }
  return null;
}

async function unknownFieldWarnings(ctx: ToolContext, type: string, candidateKeys: string[]): Promise<string[]> {
  if (candidateKeys.length === 0) return [];
  const sample = await findSampleForType(ctx, type);
  if (!sample) return [];
  const unrecognized = candidateKeys.filter(k => !(k in sample.data));
  if (unrecognized.length === 0) return [];
  return [
    `Fields not present on any existing ${type} (${sample.source}) — they will be stored but vpinball ignores unknown fields, so they likely do nothing: ${unrecognized.join(', ')}. ` +
      `Check the exact snake_case names with vpx_part(action:"template", type:"${type}").`,
  ];
}

const part: Tool<typeof partInput> = {
  name: 'vpx_part',
  annotations: { destructiveHint: true },
  description:
    'Create, change, inspect-by-template, or export parts in the active table. Dispatch by `action`: ' +
    '"add" (pass `part` with `type` + `position`), "modify" (pass `part` with `type` + `partName` plus fields to change — ' +
    'set a new `position` to MOVE it, no delete/re-add needed), "delete" (pass `name`), ' +
    '"template" (pass `type` — ALWAYS call before "add" to learn the snake_case JSON shape + type gotchas), ' +
    '"export" (pass `name` + `outputPath`). ' +
    'add/modify apply immediately (pass preview:true to inspect first); delete is a preview until confirm:true. ' +
    "Writes route through the editor's native create/modify/delete flow so undo, canvas, and panels all update. " +
    'Use vpx_history to undo/redo.',
  inputSchema: partInput,
  async execute(input, ctx) {
    if (input.action === 'template') {
      const wantedType = input.type;
      if (!wantedType) return errorResult('action="template" requires `type`.');
      const hints = PART_HINTS[wantedType] ?? [];
      const sample = await findSampleForType(ctx, wantedType);
      if (sample) {
        return jsonResult({ source: sample.source, type: wantedType, template: sample.data, hints });
      }
      if (hints.length > 0) {
        return jsonResult({ source: 'hints', type: wantedType, template: {}, hints });
      }
      return errorResult(
        `No example of "${wantedType}" found in the active table or the bundled templates. ` +
          'Open a table that already has this part type, or use vpx_reference(action:"item_types") for its API.'
      );
    }

    if (input.action === 'export') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      if (!input.name) return errorResult('action="export" requires `name`.');
      if (!input.outputPath) return errorResult('action="export" requires `outputPath`.');
      const item = findItem(state, input.name);
      if (!item) return errorResult(`Part not found: ${input.name}`);
      if (!path.isAbsolute(input.outputPath)) return errorResult('outputPath must be absolute');
      await fs.promises.mkdir(path.dirname(input.outputPath), { recursive: true });
      await fs.promises.writeFile(input.outputPath, JSON.stringify({ [item.type]: item.data }, null, 2), 'utf-8');
      return jsonResult({ success: true, writtenTo: input.outputPath, type: item.type, name: item.name });
    }

    if (input.action === 'add') {
      if (!input.part) return errorResult('action="add" requires `part` ({ type, position, … }).');
      const parsed = addPartSchema.safeParse(input.part);
      if (!parsed.success) {
        const t = typeof input.part.type === 'string' ? input.part.type : 'Primitive';
        return errorResult(
          'action="add" needs `part.type` and `part.position`. ' +
            `Example: part: { type: "${t}", position: { x: 400, y: 1100, z: 0.5 } }. ` +
            `Issues: ${formatIssues(parsed.error)}`
        );
      }
      const { type, position, name, overrides } = extractAddPartFields(parsed.data);
      foldExtraFields(input.part, overrides, ['type', 'position', 'name', 'partName', 'more']);
      const warnings = await unknownFieldWarnings(ctx, type, Object.keys(overrides));
      const data: Record<string, unknown> = { ...overrides, position };
      if (name) data.name = name;
      return runEdit(
        ctx,
        {
          kind: 'add-part',
          payload: { type, data },
          description: `Add ${type}${name ? ` "${name}"` : ''}`,
          preview: !!input.preview,
        },
        warnings
      );
    }

    if (input.action === 'modify') {
      if (!input.part) return errorResult('action="modify" requires `part` ({ type, partName, … }).');
      const partObj = { ...(input.part as Record<string, unknown>) };
      // Agents sometimes pass `name` (the add-style field) to identify the target. Accept it as partName.
      if (!partObj.partName && typeof partObj.name === 'string') {
        partObj.partName = partObj.name;
        delete partObj.name;
      }
      const parsed = modifyPartSchema.safeParse(partObj);
      if (!parsed.success) {
        const t = typeof partObj.type === 'string' ? partObj.type : 'Primitive';
        return errorResult(
          'action="modify" needs `part.partName` (the name of the EXISTING part to change — not `name`) and `part.type`. ' +
            `Example: part: { type: "${t}", partName: "Disc1", position: { x: 326, y: 1100 } }. ` +
            `Got: ${JSON.stringify(input.part).slice(0, 200)}. ` +
            `Issues: ${formatIssues(parsed.error)}`
        );
      }
      const { type, partName, overrides } = extractModifyPartFields(parsed.data);
      if ('name' in overrides || (typeof partObj.name === 'string' && partObj.name !== partName)) {
        return errorResult('Renaming via modify is not supported — `name` cannot change. Delete and re-add instead.');
      }
      foldExtraFields(partObj, overrides, ['type', 'partName', 'name', 'more']);
      const warnings = await unknownFieldWarnings(
        ctx,
        type,
        Object.keys(overrides).filter(k => k !== 'position')
      );
      return runEdit(
        ctx,
        {
          kind: 'modify-part',
          payload: { name: partName, patch: overrides, type },
          description: `Modify ${type} "${partName}" (${Object.keys(overrides).length} fields)`,
          preview: !!input.preview,
        },
        warnings
      );
    }

    if (!input.name) return errorResult('action="delete" requires `name`.');
    return runEdit(ctx, {
      kind: 'delete-part',
      payload: { name: input.name },
      description: `Delete part "${input.name}"`,
      preview: !input.confirm,
    });
  },
};

export function buildPartTools(): Tool[] {
  return [part];
}
