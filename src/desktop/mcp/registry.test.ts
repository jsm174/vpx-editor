import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolRegistry } from './registry.js';
import { buildAllTools } from './server.js';
import type { ToolContext } from './types.js';

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

const registry = new ToolRegistry();
registry.addAll(buildAllTools());
const names = new Set(registry.list().map(t => t.name));

describe('tool registry consistency', () => {
  it('every vpx_* tool referenced in tool text and source strings exists', () => {
    const referenced = new Map<string, Set<string>>();
    const note = (name: string, where: string): void => {
      if (!referenced.has(name)) referenced.set(name, new Set());
      referenced.get(name)!.add(where);
    };
    for (const tool of registry.list()) {
      for (const m of tool.description.matchAll(/\bvpx_[a-z_]+/g)) note(m[0], `description of ${tool.name}`);
      for (const m of JSON.stringify(tool.inputSchema.def ?? {}).matchAll(/\bvpx_[a-z_]+/g)) {
        note(m[0], `schema of ${tool.name}`);
      }
    }
    const root = path.join(process.cwd(), 'src/desktop/mcp');
    for (const file of listSourceFiles(root)) {
      const text = fs.readFileSync(file, 'utf-8');
      for (const m of text.matchAll(/\bvpx_[a-z_]+/g)) note(m[0], path.relative(root, file));
    }
    const missing = [...referenced].filter(([name]) => !names.has(name) && name !== 'vpx_editor');
    expect(missing.map(([name, where]) => `${name} (${[...where].join(', ')})`)).toEqual([]);
  });

  it('every tool registers on an McpServer without throwing', () => {
    const server = new McpServer({ name: 'test', version: '0' });
    expect(() => registry.bind(server, {} as ToolContext)).not.toThrow();
  });

  it('every tool has a description and annotations', () => {
    for (const tool of registry.list()) {
      expect(tool.description.length, tool.name).toBeGreaterThan(40);
      expect(tool.annotations, tool.name).toBeDefined();
    }
  });
});
