import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildAllTools } from '../server.js';

const ROOT = path.join(process.cwd(), 'src', 'desktop', 'mcp');
const DOCS = path.join(process.cwd(), 'docs', 'mcp');

function listFiles(dir: string, filter: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, filter));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

function actionsOf(schema: unknown): string[] | null {
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  let field: unknown = shape?.action;
  while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
    field = field.unwrap();
  }
  return field instanceof z.ZodEnum ? [...(field.options as string[])] : null;
}

const REF = /\bvpx_([a-z_]+)(?:\s*\(?\s*action:\s*"([a-z_]+)")?/g;

describe('every vpx_* tool/action mentioned in agent-facing text exists', () => {
  const tools = new Map(buildAllTools().map(t => [t.name, actionsOf(t.inputSchema)]));
  const files = [
    ...listFiles(path.join(ROOT, 'data'), f => f.endsWith('.ts')),
    ...listFiles(path.join(ROOT, 'library'), f => f.endsWith('.ts') && !f.endsWith('.test.ts')),
    ...listFiles(path.join(ROOT, 'tools'), f => f.endsWith('.ts') && !f.endsWith('.test.ts')),
    ...listFiles(DOCS, f => f.endsWith('.md')),
  ];

  it('scans something and resolves action enums', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(tools.size).toBeGreaterThan(10);
    expect(tools.get('vpx_mpf')).toEqual(['generate', 'status', 'get']);
  });

  for (const file of files) {
    it(path.relative(process.cwd(), file), () => {
      const text = fs.readFileSync(file, 'utf-8');
      const problems: string[] = [];
      for (const m of text.matchAll(REF)) {
        const tool = `vpx_${m[1]}`;
        if (!tools.has(tool)) {
          problems.push(`${tool} does not exist`);
          continue;
        }
        const action = m[2];
        const actions = tools.get(tool);
        if (action && actions && !actions.includes(action)) problems.push(`${tool} has no action "${action}"`);
      }
      expect(problems).toEqual([]);
    });
  }
});
