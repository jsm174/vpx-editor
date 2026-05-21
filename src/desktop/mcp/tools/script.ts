import { z } from 'zod';
import { lintCommonPitfalls } from '../../../shared/vbs-analysis.js';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { confirmable, runEdit, NO_ACTIVE_TABLE, readScriptSelection, searchScript } from './edit-util.js';
import { collectSystemScriptSymbols } from './system-scripts.js';

const FULL_SCRIPT_LIMIT = 100_000;

const scriptInput = z.object({
  action: z
    .enum(['get', 'search', 'lint', 'edit', 'replace_string', 'replace_sub', 'replace_range'])
    .describe(
      '"get": VBS source — one Sub (`subName`), a line range (`startLine`+`endLine`), or the whole script if under 100KB. ' +
        '"search": grep with context (use `pattern`). ' +
        '"lint": flag common pitfalls (redefining core.vbs symbols, event Subs inside a Class, missing Set, …). ' +
        '"edit": replace/append/prepend the whole script (use `mode` + `content`). ' +
        '"replace_string": swap one exact substring (`oldString` → `newString`). ' +
        '"replace_sub": rewrite a whole Sub/Function by name (`subName` + `newBody`). ' +
        '"replace_range": replace/delete a line range (`startLine`, `endLine`, optional `content`).'
    ),
  pattern: z.string().optional().describe('For action="search": substring or regex to search for.'),
  isRegex: z.boolean().default(false).optional().describe('For action="search": treat pattern as regex.'),
  contextLines: z.number().int().min(0).max(20).default(2).optional().describe('For action="search": context lines.'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('For action="search": max matches.'),
  mode: z
    .enum(['replace', 'append', 'prepend'])
    .optional()
    .describe('For action="edit": how to apply `content`. Default "replace".'),
  content: z
    .string()
    .optional()
    .describe(
      'For action="edit": the new VBS content. ' +
        'For action="replace_range": the replacement text (omit or pass empty to DELETE the range entirely).'
    ),
  oldString: z
    .string()
    .optional()
    .describe(
      'For action="replace_string": exact substring to find. MUST appear exactly once — add surrounding context to disambiguate if needed. May contain newlines.'
    ),
  newString: z.string().optional().describe('For action="replace_string": replacement text (can be empty to delete).'),
  subName: z
    .string()
    .optional()
    .describe('For action="replace_sub"/"get": name of the Sub or Function (case-insensitive).'),
  newBody: z
    .string()
    .optional()
    .describe('For action="replace_sub": full block including "Sub Name(...)" / "End Sub" lines.'),
  startLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For action="replace_range"/"get": 1-based start line (inclusive).'),
  endLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For action="replace_range"/"get": 1-based end line (inclusive). Must be >= startLine.'),
  ...confirmable,
});

const script: Tool<typeof scriptInput> = {
  name: 'vpx_script',
  annotations: { destructiveHint: true },
  description:
    'Read or edit the active table\'s VBS script. Read actions: "get" (a Sub, a line range, or the full source when small), "search" (grep with context), ' +
    '"lint" (common pitfalls). Write actions: "edit" (whole-script replace/append/prepend), "replace_string" (one exact substring), ' +
    '"replace_sub" (rewrite a Sub/Function by name), "replace_range" (replace/delete a line range). ' +
    'Prefer the narrower write actions over "edit" for small targeted changes. ' +
    'BEFORE writing new logic from scratch, call vpx_reference(action:"system_summarize") and check core.vbs for an existing helper ' +
    '(cvpmTurntable, cvpmDictionary, cvpmBallStack, vpmTimer.PulseSw, …) before re-implementing it inline.',
  inputSchema: scriptInput,
  async execute(input, ctx) {
    if (input.action === 'get') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      const read = readScriptSelection(state.script, input, {
        fullLimit: FULL_SCRIPT_LIMIT,
        label: 'Script',
        narrowHint: 'Narrow it with `subName`, `startLine`/`endLine`, or action="search".',
        missingSubHint: 'Use action="search" to locate it.',
      });
      return 'error' in read ? errorResult(read.error) : jsonResult(read.fields);
    }

    if (input.action === 'search') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      if (!input.pattern) return errorResult('action="search" requires `pattern`.');
      const found = searchScript(state.script, { ...input, pattern: input.pattern });
      return 'error' in found ? errorResult(found.error) : jsonResult(found.fields);
    }

    if (input.action === 'lint') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      const coreSymbols = ctx.config.systemScriptsPath
        ? await collectSystemScriptSymbols(ctx.config.systemScriptsPath)
        : new Set<string>();
      const findings = lintCommonPitfalls(state.script, coreSymbols);
      return jsonResult({
        total: findings.length,
        errors: findings.filter(f => f.severity === 'error').length,
        warnings: findings.filter(f => f.severity === 'warning').length,
        systemSymbolsConsidered: coreSymbols.size,
        findings,
      });
    }

    if (input.action === 'edit') {
      if (input.content === undefined) return errorResult('action="edit" requires `content`.');
      const mode = input.mode ?? 'replace';
      return runEdit(ctx, {
        kind: 'edit-script',
        payload: { mode, content: input.content },
        description: `Script edit (${mode}, ${input.content.length} chars)`,
        preview: !input.confirm,
      });
    }

    if (input.action === 'replace_string') {
      if (input.oldString === undefined) return errorResult('action="replace_string" requires `oldString`.');
      if (input.newString === undefined)
        return errorResult('action="replace_string" requires `newString` (pass empty string to delete).');
      return runEdit(ctx, {
        kind: 'replace-script-string',
        payload: { oldString: input.oldString, newString: input.newString },
        description: `Replace ${input.oldString.length} chars → ${input.newString.length} chars in script`,
        preview: !input.confirm,
      });
    }

    if (input.action === 'replace_sub') {
      if (!input.subName) return errorResult('action="replace_sub" requires `subName`.');
      if (input.newBody === undefined)
        return errorResult('action="replace_sub" requires `newBody` (full Sub/Function block).');
      return runEdit(ctx, {
        kind: 'replace-sub',
        payload: { subName: input.subName, newBody: input.newBody },
        description: `Replace ${input.subName} (${input.newBody.length} chars)`,
        preview: !input.confirm,
      });
    }

    if (input.startLine === undefined || input.endLine === undefined) {
      return errorResult('action="replace_range" requires `startLine` and `endLine`.');
    }
    const content = input.content ?? '';
    return runEdit(ctx, {
      kind: 'replace-script-range',
      payload: { startLine: input.startLine, endLine: input.endLine, content },
      description: `${content ? 'Replace' : 'Delete'} script lines ${input.startLine}-${input.endLine}`,
      preview: !input.confirm,
    });
  },
};

export function buildScriptTools(): Tool[] {
  return [script];
}
