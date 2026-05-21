import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { errorResult, jsonResult, type ActiveTableHandle, type EditOperation, type ToolContext } from '../types.js';

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
