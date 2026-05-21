import { z } from 'zod';
import { VPX_ITEM_API } from '../../../features/script-editor/shared/vbs-api.js';
import { ItemTypeEnum } from '../../../types/game-objects.js';
import { VBS_PATTERNS, PATTERN_NAMES } from '../data/vbs-patterns.js';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { SYSTEM_SCRIPTS_INTRO, systemList, systemGet, systemSearch, systemSummarize } from './system-scripts.js';
import { GLF_INTRO, glfList, glfDoc, glfSearch } from './glf.js';

const referenceInput = z.object({
  action: z
    .enum([
      'item_types',
      'api',
      'patterns',
      'system_list',
      'system_get',
      'system_search',
      'system_summarize',
      'glf_list',
      'glf_doc',
      'glf_search',
    ])
    .describe(
      '"item_types": every VPX item type with its full VBS API surface (properties + methods). ' +
        '"api": grep the per-item-type VBS API by substring (use `query`). ' +
        '"patterns": fetch a curated cookbook recipe by `name` (e.g. "spinning_disc"), or omit `name` to list them. ' +
        '"system_list": enumerate the bundled vpinball .vbs files (core.vbs, controller.vbs, …). ' +
        '"system_get": text of one bundled script (use `file`, plus `startLine`/`endLine` for large files). ' +
        '"system_search": grep across the bundled scripts (use `pattern`). ' +
        '"system_summarize": overview of every bundled script (class names + counts); pass `file` for the full Sub/Function/constant index with line ranges. ' +
        '"glf_list": list GLF component docs/topics. "glf_doc": one GLF doc (use `name`, e.g. "drop-target"). ' +
        '"glf_search": grep GLF docs + framework (use `pattern`).'
    ),
  query: z.string().optional().describe('For action="api": substring to match against type/property/method names.'),
  name: z
    .string()
    .optional()
    .describe(`For action="patterns": specific pattern to fetch. Omit to list. Available: ${PATTERN_NAMES.join(', ')}`),
  file: z
    .string()
    .optional()
    .describe('For system_get (required, e.g. "core.vbs"); for system_search/system_summarize (optional filter).'),
  pattern: z.string().optional().describe('For action="system_search": substring or regex to find.'),
  startLine: z.number().int().positive().optional().describe('For action="system_get": 1-based start line.'),
  endLine: z.number().int().positive().optional().describe('For action="system_get": 1-based end line (inclusive).'),
  isRegex: z.boolean().default(false).optional().describe('For action="system_search": treat pattern as regex.'),
  contextLines: z
    .number()
    .int()
    .min(0)
    .max(20)
    .default(2)
    .optional()
    .describe('For action="system_search": lines of context around each match.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .default(80)
    .optional()
    .describe('For action="system_search": max matches to return.'),
});

const reference: Tool<typeof referenceInput> = {
  name: 'vpx_reference',
  annotations: { readOnlyHint: true },
  description:
    'Read-only VBS ecosystem reference (knowledge, not table state). Dispatch by `action`. ' +
    'Item API: "item_types" (every item type + runtime VBS properties/methods), "api" (grep that surface by `query`). ' +
    'Cookbook: "patterns" (recipe with snippet + gotchas — fetch by `name`, or omit to list). ' +
    'Bundled vpinball scripts: "system_list", "system_get" (`file`), "system_search" (`pattern`), "system_summarize". ' +
    'GLF (homebrew game-logic framework): "glf_list", "glf_doc" (`name`), "glf_search" (`pattern`). ' +
    SYSTEM_SCRIPTS_INTRO +
    ' ' +
    GLF_INTRO +
    ' BEFORE writing VBS by hand, prefer reusing what the ecosystem already provides: check "patterns" for a known recipe, ' +
    'then "system_summarize"/"system_search" (core.vbs) — or, for an ORIGINAL machine, "glf_list"/"glf_doc" — ' +
    'for an existing class/helper to use instead of re-implementing it. ' +
    'These are VBS scripting names (PascalCase X, Y, BaseRadius) for driving parts at runtime — to CREATE parts use vpx_part ' +
    '(its templates use the on-disk snake_case JSON shape). vpinball scripts and GLF are bundled with the editor.',
  inputSchema: referenceInput,
  async execute(input, ctx) {
    if (input.action === 'item_types') {
      const enumNames: Record<string, number> = {};
      for (const k of Object.keys(ItemTypeEnum)) {
        const v = (ItemTypeEnum as unknown as Record<string, number | string>)[k];
        if (typeof v === 'number') enumNames[k] = v;
      }
      const types = Object.entries(VPX_ITEM_API).map(([name, api]) => ({
        type: name,
        properties: api.properties,
        readOnlyProperties: api.readOnlyProperties ?? [],
        methods: api.methods ?? [],
      }));
      return jsonResult({ enumNames, types });
    }

    if (input.action === 'api') {
      const q = input.query?.toLowerCase();
      if (!q) return errorResult('action="api" requires `query` substring.');
      const out: {
        type: string;
        matches: { kind: 'property' | 'method' | 'type'; name: string; signature?: string }[];
      }[] = [];
      for (const [type, api] of Object.entries(VPX_ITEM_API)) {
        const matches: { kind: 'property' | 'method' | 'type'; name: string; signature?: string }[] = [];
        if (type.toLowerCase().includes(q)) {
          matches.push({ kind: 'type', name: type });
        }
        for (const p of api.properties) {
          if (p.toLowerCase().includes(q)) matches.push({ kind: 'property', name: p });
        }
        for (const p of api.readOnlyProperties ?? []) {
          if (p.toLowerCase().includes(q)) matches.push({ kind: 'property', name: `${p} (read-only)` });
        }
        for (const m of api.methods ?? []) {
          if (m.name.toLowerCase().includes(q)) matches.push({ kind: 'method', name: m.name, signature: m.signature });
        }
        if (matches.length > 0) out.push({ type, matches });
      }
      return jsonResult({ query: input.query, results: out });
    }

    if (input.action === 'patterns') {
      if (!input.name) {
        return jsonResult({
          curated: PATTERN_NAMES.map(n => ({ name: n, title: VBS_PATTERNS[n].title })),
          usage:
            'Fetch any by name, e.g. action="patterns", name:"spinning_disc". Recipes carry a GLF flavor where one applies.',
        });
      }
      const curated = VBS_PATTERNS[input.name];
      if (curated) return jsonResult(curated);
      return errorResult(`Unknown pattern "${input.name}". Curated: ${PATTERN_NAMES.join(', ')}.`);
    }

    // GLF actions (bundled framework + docs)
    if (input.action === 'glf_list' || input.action === 'glf_doc' || input.action === 'glf_search') {
      const glfDir = ctx.config.glfPath;
      if (!glfDir) return errorResult('GLF is not available (bundled resources missing).');
      try {
        if (input.action === 'glf_list') return await glfList(glfDir);
        if (input.action === 'glf_doc') return await glfDoc(glfDir, input.name);
        return await glfSearch(glfDir, {
          pattern: input.pattern,
          isRegex: input.isRegex,
          contextLines: input.contextLines,
          limit: input.limit,
        });
      } catch (err) {
        return errorResult(`${input.action} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // system_* actions (bundled vpinball scripts)
    const dir = ctx.config.systemScriptsPath;
    if (!dir) return errorResult('vpinball scripts are not available (bundled resources missing).');
    try {
      if (input.action === 'system_list') return await systemList(dir);
      if (input.action === 'system_get')
        return await systemGet(dir, input.file, { startLine: input.startLine, endLine: input.endLine });
      if (input.action === 'system_search')
        return await systemSearch(dir, {
          pattern: input.pattern,
          isRegex: input.isRegex,
          contextLines: input.contextLines,
          limit: input.limit,
          file: input.file,
        });
      return await systemSummarize(dir, input.file);
    } catch (err) {
      return errorResult(`${input.action} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

export function buildReferenceTools(): Tool[] {
  return [reference];
}
