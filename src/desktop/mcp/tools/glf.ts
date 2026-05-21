import fs from 'fs-extra';
import path from 'node:path';
import { errorResult, jsonResult, type ToolResult } from '../types.js';
import { grep } from '../../../shared/vbs-analysis.js';

export const GLF_INTRO =
  'GLF (VPX Game Logic Framework, based on MPF) is a bundled, config-driven framework for building ORIGINAL / homebrew ' +
  'tables: modes, shots, ball devices, multiball, players, tilt, high scores. Unlike core.vbs (drives an emulated ROM) ' +
  'or the VPW physics classes (feel), GLF supplies the GAME LOGIC. A table embeds the framework (vpx-glf.vbs) in its ' +
  'script and provides Glf_Init / Glf_Exit / Glf_KeyDown / Glf_KeyUp hooks plus CreateGlf* config calls. Prefer GLF when authoring a new ' +
  'machine from scratch — start from its component docs.';

const FRAMEWORK_FILE = 'vpx-glf.vbs';

function docsDir(glfDir: string): string {
  return path.join(glfDir, 'docs');
}

async function listDocFiles(glfDir: string): Promise<{ topic: string; file: string; sizeBytes: number }[]> {
  const dir = docsDir(glfDir);
  const out: { topic: string; file: string; sizeBytes: number }[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.promises.readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!/\.md$/i.test(name)) continue;
    try {
      const stat = await fs.promises.stat(path.join(dir, name));
      if (stat.size === 0) continue;
      out.push({ topic: name.replace(/\.md$/i, ''), file: name, sizeBytes: stat.size });
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => a.topic.localeCompare(b.topic));
}

export async function glfList(glfDir: string): Promise<ToolResult> {
  const docs = await listDocFiles(glfDir);
  let frameworkBytes: number | null = null;
  try {
    frameworkBytes = (await fs.promises.stat(path.join(glfDir, FRAMEWORK_FILE))).size;
  } catch {
    frameworkBytes = null;
  }
  if (docs.length === 0 && frameworkBytes === null) {
    return errorResult(`No GLF content found at ${glfDir}. The bundled framework may be missing.`);
  }
  return jsonResult({
    glfDir,
    framework: frameworkBytes === null ? null : { file: FRAMEWORK_FILE, sizeBytes: frameworkBytes },
    docCount: docs.length,
    topics: docs.map(d => d.topic),
    usage: 'Fetch a topic with action="glf_doc", name:"<topic>" (e.g. "drop-target"). Grep with action="glf_search".',
  });
}

export async function glfDoc(glfDir: string, name: string | undefined): Promise<ToolResult> {
  if (!name) return errorResult('action="glf_doc" requires `name` (a topic, e.g. "multiball"). See action="glf_list".');
  const wanted = name.replace(/\.md$/i, '').toLowerCase();
  const docs = await listDocFiles(glfDir);
  const match = docs.find(d => d.topic.toLowerCase() === wanted);
  if (!match) {
    return errorResult(`No GLF doc "${name}". Available topics: ${docs.map(d => d.topic).join(', ')}`);
  }
  const content = await fs.promises.readFile(path.join(docsDir(glfDir), match.file), 'utf-8');
  return jsonResult({ topic: match.topic, sizeBytes: content.length, content });
}

export async function glfSearch(
  glfDir: string,
  opts: { pattern?: string; isRegex?: boolean; contextLines?: number; limit?: number }
): Promise<ToolResult> {
  if (!opts.pattern) return errorResult('action="glf_search" requires `pattern`.');
  const pattern = opts.isRegex ? new RegExp(opts.pattern, 'i') : opts.pattern;
  const limit = opts.limit ?? 80;
  const matches: { source: string; line: number; match: string; before: string[]; after: string[] }[] = [];

  // Search the component docs first (teaching material), then the compiled framework source.
  const docs = await listDocFiles(glfDir);
  const targets: { source: string; path: string }[] = docs.map(d => ({
    source: `docs/${d.file}`,
    path: path.join(docsDir(glfDir), d.file),
  }));
  targets.push({ source: FRAMEWORK_FILE, path: path.join(glfDir, FRAMEWORK_FILE) });

  for (const t of targets) {
    let content: string;
    try {
      content = await fs.promises.readFile(t.path, 'utf-8');
    } catch {
      continue;
    }
    for (const m of grep(content, pattern, opts.contextLines ?? 2)) {
      matches.push({ source: t.source, ...m });
      if (matches.length >= limit) break;
    }
    if (matches.length >= limit) break;
  }
  return jsonResult({ pattern: opts.pattern, total: matches.length, matches, truncated: matches.length >= limit });
}
