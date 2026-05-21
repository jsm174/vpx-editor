import { z } from 'zod';
import { findSubs, grep, lintCommonPitfalls, splitLines } from '../../../shared/vbs-analysis.js';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { confirmable, runEdit, NO_ACTIVE_TABLE } from './edit-util.js';

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
  // search
  pattern: z.string().optional().describe('For action="search": substring or regex to search for.'),
  isRegex: z.boolean().default(false).optional().describe('For action="search": treat pattern as regex.'),
  contextLines: z.number().int().min(0).max(20).default(2).optional().describe('For action="search": context lines.'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('For action="search": max matches.'),
  // edit
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
      if (input.subName) {
        const wanted = input.subName.toLowerCase();
        const sub = findSubs(state.script).find(s => s.name.toLowerCase() === wanted);
        if (!sub) {
          return errorResult(`No Sub/Function named "${input.subName}". Use action="search" to locate it.`);
        }
        return jsonResult({
          subName: sub.name,
          kind: sub.kind,
          startLine: sub.startLine,
          endLine: sub.endLine,
          content: `${sub.header}\n${sub.body}`,
        });
      }
      const lines = splitLines(state.script);
      if (input.startLine !== undefined || input.endLine !== undefined) {
        const start = input.startLine ?? 1;
        const end = Math.min(input.endLine ?? lines.length, lines.length);
        if (start > end) return errorResult(`Invalid range: startLine ${start} > endLine ${end}.`);
        return jsonResult({
          startLine: start,
          endLine: end,
          totalLines: lines.length,
          content: lines.slice(start - 1, end).join('\n'),
        });
      }
      if (state.script.length > FULL_SCRIPT_LIMIT) {
        return errorResult(
          `Script is ${state.script.length} bytes (limit ${FULL_SCRIPT_LIMIT} for a full read). ` +
            'Narrow it with `subName`, `startLine`/`endLine`, or action="search".'
        );
      }
      return jsonResult({ script: state.script, sizeBytes: state.script.length, totalLines: lines.length });
    }

    if (input.action === 'search') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      if (!input.pattern) return errorResult('action="search" requires `pattern`.');
      const pattern = input.isRegex ? new RegExp(input.pattern, 'i') : input.pattern;
      try {
        const matches = grep(state.script, pattern, input.contextLines ?? 2);
        const limit = input.limit ?? 100;
        return jsonResult({
          total: matches.length,
          matches: matches.slice(0, limit),
          truncated: matches.length > limit,
        });
      } catch (err) {
        return errorResult(`Search failed: ${(err as Error).message}`);
      }
    }

    if (input.action === 'lint') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      let coreSymbols = new Set<string>();
      if (ctx.config.systemScriptsPath) {
        try {
          const { collectSystemScriptSymbols } = await import('./system-scripts.js');
          coreSymbols = await collectSystemScriptSymbols(ctx.config.systemScriptsPath);
        } catch {
          // best effort; lint still runs without the redef rule
        }
      }
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
