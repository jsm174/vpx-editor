import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { errorResult, jsonResult, type ActiveTableHandle, type EditOperation, type ToolContext } from '../types.js';
import { findSubs, grep, splitLines } from '../../../shared/vbs-analysis.js';

/** Shared empty-state message — always points a new user/model to the way forward. */
export const NO_ACTIVE_TABLE =
  'No table is open. You do NOT need one to start: create a playable table with ' +
  'vpx_new(action:"create", start:"glf", name:"MyMachine"), or open a .vpx in the editor. New here? Call vpx_guide.';

export const confirmable = {
  confirm: z
    .boolean()
    .default(false)
    .optional()
    .describe('Set true to actually apply the edit. Without it, returns a preview.'),
};

export async function runEdit(ctx: ToolContext, op: EditOperation, warnings?: string[]) {
  const handle = await ctx.getActiveTable();
  if (!handle) return errorResult(NO_ACTIVE_TABLE);
  const result = await ctx.applyEdit(op);
  if (!result.success) return errorResult(result.error ?? 'Edit failed');
  return jsonResult({
    applied: result.applied,
    description: result.description ?? op.description,
    preview: result.preview ?? null,
    ...(result.note ? { note: result.note } : {}),
    ...(warnings && warnings.length > 0 ? { warnings } : {}),
    nextStep: op.preview ? 'Call again with confirm:true to apply.' : 'Applied.',
  });
}

export function isInsideWorkDir(workDir: string, target: string): boolean {
  const relative = path.relative(path.resolve(workDir), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveOutputDir(handle: ActiveTableHandle, outputDir: string | undefined): string | { error: string } {
  if (outputDir) {
    if (!path.isAbsolute(outputDir)) return { error: 'outputDir must be absolute' };
    if (isInsideWorkDir(handle.workDir, outputDir))
      return { error: 'outputDir must be outside the table work folder; everything in it is packed into the .vpx' };
    return outputDir;
  }
  const name = handle.tableName ?? 'table';
  return handle.vpxPath
    ? path.join(path.dirname(handle.vpxPath), `${name}_export`)
    : path.join(os.tmpdir(), 'vpx-mcp-export', name);
}

export interface ScriptSelection {
  subName?: string;
  startLine?: number;
  endLine?: number;
}

export interface ScriptReadLimits {
  fullLimit: number;
  label: string;
  narrowHint: string;
  missingSubHint: string;
}

export function readScriptSelection(
  script: string,
  sel: ScriptSelection,
  limits: ScriptReadLimits
): { error: string } | { fields: Record<string, unknown> } {
  if (sel.subName) {
    const wanted = sel.subName.toLowerCase();
    const sub = findSubs(script).find(s => s.name.toLowerCase() === wanted);
    if (!sub) return { error: `No Sub/Function named "${sel.subName}". ${limits.missingSubHint}` };
    return {
      fields: {
        subName: sub.name,
        kind: sub.kind,
        startLine: sub.startLine,
        endLine: sub.endLine,
        content: `${sub.header}\n${sub.body}`,
      },
    };
  }
  const lines = splitLines(script);
  if (sel.startLine !== undefined || sel.endLine !== undefined) {
    const start = sel.startLine ?? 1;
    const end = Math.min(sel.endLine ?? lines.length, lines.length);
    if (start > end) return { error: `Invalid range: startLine ${start} > endLine ${end}.` };
    return {
      fields: {
        startLine: start,
        endLine: end,
        totalLines: lines.length,
        content: lines.slice(start - 1, end).join('\n'),
      },
    };
  }
  if (script.length > limits.fullLimit) {
    return {
      error: `${limits.label} is ${script.length} bytes (limit ${limits.fullLimit} for a full read). ${limits.narrowHint}`,
    };
  }
  return { fields: { sizeBytes: script.length, totalLines: lines.length, content: script } };
}

export function searchScript(
  script: string,
  opts: { pattern: string; isRegex?: boolean; contextLines?: number; limit?: number }
): { error: string } | { fields: Record<string, unknown> } {
  const limit = opts.limit ?? 100;
  try {
    const pattern = opts.isRegex ? new RegExp(opts.pattern, 'i') : opts.pattern;
    const matches = grep(script, pattern, opts.contextLines ?? 2);
    return { fields: { total: matches.length, matches: matches.slice(0, limit), truncated: matches.length > limit } };
  } catch (err) {
    return { error: `Search failed: ${(err as Error).message}` };
  }
}

export function filterByNameRegex<T extends { name: string }>(
  items: T[],
  nameRegex: string | undefined
): { error: string } | { items: T[] } {
  if (!nameRegex) return { items };
  try {
    const re = new RegExp(nameRegex, 'i');
    return { items: items.filter(i => re.test(i.name)) };
  } catch {
    return { error: `Invalid nameRegex: ${nameRegex}` };
  }
}
