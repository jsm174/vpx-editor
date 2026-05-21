import fs from 'fs-extra';
import path from 'node:path';
import { errorResult, jsonResult, type ToolResult } from '../types.js';
import { grep, findSubs, findClasses, findConstants, splitLines } from '../../../shared/vbs-analysis.js';

export const SYSTEM_SCRIPTS_INTRO =
  'vpinball ships with shared VBS scripts (core.vbs, controller.vbs, …) that any table can load via ' +
  '`ExecuteGlobal GetTextFile("core.vbs")`. These are READ-ONLY system files — never modify them. ' +
  'Use their classes/helpers by `Set foo = New SomeClass` after loading.';

async function listVbsFiles(dir: string): Promise<{ name: string; path: string; sizeBytes: number }[]> {
  const out: { name: string; path: string; sizeBytes: number }[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await fs.promises.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        await walk(full);
      } else if (e.isFile() && /\.vbs$/i.test(e.name)) {
        try {
          const stat = await fs.promises.stat(full);
          out.push({ name: path.relative(dir, full), path: full, sizeBytes: stat.size });
        } catch {
          continue;
        }
      }
    }
  }
  await walk(dir);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function findScriptFile(systemPath: string, name: string): Promise<string | null> {
  const normalized = name.toLowerCase();
  const want = normalized.endsWith('.vbs') ? normalized : `${normalized}.vbs`;
  const files = await listVbsFiles(systemPath);
  for (const f of files) {
    if (path.basename(f.name).toLowerCase() === want) return f.path;
  }
  return null;
}

interface FileDigest {
  sizeBytes: number;
  mtimeMs: number;
  classes: { name: string; startLine: number; endLine: number; lineCount: number }[];
  subs: { name: string; startLine: number; endLine: number }[];
  functions: { name: string; startLine: number; endLine: number }[];
  constants: { name: string; value: string; line: number }[];
}

const digestCache = new Map<string, FileDigest>();

async function digestFile(filePath: string): Promise<FileDigest> {
  const stat = await fs.promises.stat(filePath);
  const cached = digestCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.sizeBytes === stat.size) {
    return cached;
  }
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const subs = findSubs(content);
  const classes = findClasses(content);
  const constants = findConstants(content);
  const digest: FileDigest = {
    sizeBytes: stat.size,
    mtimeMs: stat.mtimeMs,
    classes: classes.map(c => ({
      name: c.name,
      startLine: c.startLine,
      endLine: c.endLine,
      lineCount: c.endLine - c.startLine + 1,
    })),
    subs: subs.filter(s => s.kind === 'sub').map(s => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
    functions: subs
      .filter(s => s.kind === 'function')
      .map(s => ({ name: s.name, startLine: s.startLine, endLine: s.endLine })),
    constants,
  };
  digestCache.set(filePath, digest);
  return digest;
}

/**
 * Returns the set of top-level identifiers (Class/Const names) declared anywhere in the system
 * scripts. Used by the lint tool to detect redefinition collisions with what `core.vbs` (or any
 * other shipped script) actually declares — replaces the older hardcoded list that had false
 * positives for `tnob`/`BallSize`.
 */
export async function collectSystemScriptSymbols(systemScriptsPath: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const files = await listVbsFiles(systemScriptsPath);
    for (const f of files) {
      try {
        const digest = await digestFile(f.path);
        for (const c of digest.classes) out.add(c.name);
        for (const c of digest.constants) out.add(c.name);
      } catch {
        continue;
      }
    }
  } catch {
    // best effort
  }
  return out;
}

export async function systemList(dir: string): Promise<ToolResult> {
  const files = await listVbsFiles(dir);
  return jsonResult({
    path: dir,
    count: files.length,
    files: files.map(f => ({ name: f.name, sizeBytes: f.sizeBytes })),
  });
}

const FULL_FILE_LIMIT = 60_000;

export async function systemGet(
  dir: string,
  file: string | undefined,
  range?: { startLine?: number; endLine?: number }
): Promise<ToolResult> {
  if (!file) return errorResult('action="system_get" requires `file` (e.g. "core.vbs").');
  const found = await findScriptFile(dir, file);
  if (!found) return errorResult(`Script not found: ${file}. Call action="system_list" to see what's available.`);
  const content = await fs.promises.readFile(found, 'utf-8');
  const lines = splitLines(content);
  if (range?.startLine !== undefined || range?.endLine !== undefined) {
    const start = range.startLine ?? 1;
    const end = Math.min(range.endLine ?? lines.length, lines.length);
    if (start > end) return errorResult(`Invalid range: startLine ${start} > endLine ${end}.`);
    return jsonResult({
      name: file,
      startLine: start,
      endLine: end,
      totalLines: lines.length,
      content: lines.slice(start - 1, end).join('\n'),
    });
  }
  if (content.length > FULL_FILE_LIMIT) {
    return errorResult(
      `${file} is ${content.length} bytes (limit ${FULL_FILE_LIMIT} for a full read). ` +
        'Use startLine/endLine (action="system_summarize" with `file` lists every class/Sub with its line range) or action="system_search".'
    );
  }
  return jsonResult({ name: file, path: found, sizeBytes: content.length, totalLines: lines.length, content });
}

export async function systemSearch(
  dir: string,
  opts: { pattern?: string; isRegex?: boolean; contextLines?: number; limit?: number; file?: string }
): Promise<ToolResult> {
  if (!opts.pattern) return errorResult('action="system_search" requires `pattern`.');
  const files = await listVbsFiles(dir);
  const pattern = opts.isRegex ? new RegExp(opts.pattern, 'i') : opts.pattern;
  const limit = opts.limit ?? 80;
  const matches: { file: string; line: number; match: string; before: string[]; after: string[] }[] = [];
  const filterName = opts.file?.toLowerCase();
  for (const f of files) {
    if (filterName && path.basename(f.name).toLowerCase() !== filterName && f.name.toLowerCase() !== filterName)
      continue;
    try {
      const content = await fs.promises.readFile(f.path, 'utf-8');
      for (const m of grep(content, pattern, opts.contextLines ?? 2)) {
        matches.push({ file: f.name, ...m });
        if (matches.length >= limit) break;
      }
      if (matches.length >= limit) break;
    } catch {
      continue;
    }
  }
  return jsonResult({ pattern: opts.pattern, total: matches.length, matches, truncated: matches.length >= limit });
}

export async function systemSummarize(dir: string, file?: string): Promise<ToolResult> {
  const files = await listVbsFiles(dir);
  const wanted = file?.toLowerCase();
  const out: Record<string, FileDigest> = {};
  for (const f of files) {
    if (wanted && path.basename(f.name).toLowerCase() !== wanted && f.name.toLowerCase() !== wanted) continue;
    try {
      out[f.name] = await digestFile(f.path);
    } catch {
      continue;
    }
  }
  if (Object.keys(out).length === 0 && wanted) {
    return errorResult(`No system script matched "${file}". Available: ${files.map(f => f.name).join(', ')}`);
  }
  if (wanted) return jsonResult({ systemScriptsPath: dir, files: out });
  const overview = Object.fromEntries(
    Object.entries(out).map(([name, d]) => [
      name,
      {
        sizeBytes: d.sizeBytes,
        classes: d.classes.map(c => c.name),
        subs: d.subs.length,
        functions: d.functions.length,
        constants: d.constants.length,
      },
    ])
  );
  return jsonResult({
    systemScriptsPath: dir,
    files: overview,
    nextStep: 'Pass `file` (e.g. "core.vbs") for the full class/Sub/Function/constant index with line ranges.',
  });
}
