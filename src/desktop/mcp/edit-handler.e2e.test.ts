import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyEditDirect } from './edit-handler.js';
import type { EditOperation } from './types.js';

const ROOT_PREFIX = '/vpx/';

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function tinyWav(): string {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + 8, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(8, 40);
  return Buffer.concat([header, Buffer.alloc(8, 128)]).toString('base64');
}

let vpin: typeof import('@francisdb/vpin-wasm');
let workDir: string;

const vpx = {
  extract: async (buffer: Uint8Array) => vpin.extract(buffer) as Record<string, Uint8Array>,
  objToMesh: async () => {
    throw new Error('unused');
  },
};

async function collectFiles(dir: string, base = dir): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(out, await collectFiles(full, base));
    else out[ROOT_PREFIX + path.relative(base, full).replaceAll('\\', '/')] = await fs.promises.readFile(full);
  }
  return out;
}

async function apply(op: EditOperation) {
  return applyEditDirect({ workDir, vpx }, op);
}

beforeAll(async () => {
  vpin = await import('@francisdb/vpin-wasm');
  const wasmPath = path.join(process.cwd(), 'node_modules/@francisdb/vpin-wasm/vpin_bg.wasm');
  await vpin.default({ module_or_path: fs.readFileSync(wasmPath) });
  workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vpx-mcp-e2e-'));
  const buffer = fs.readFileSync(path.join(process.cwd(), 'public/templates/strippedTable.vpx'));
  const files = vpin.extract(new Uint8Array(buffer)) as Record<string, Uint8Array>;
  for (const [filePath, data] of Object.entries(files)) {
    const relative = filePath.startsWith(ROOT_PREFIX) ? filePath.slice(ROOT_PREFIX.length) : filePath;
    const full = path.join(workDir, relative);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, data);
  }
});

afterAll(async () => {
  await fs.promises.rm(workDir, { recursive: true, force: true });
});

describe('MCP direct edits round-trip through vpin assemble', () => {
  it('partial material, image, sound and script edits still assemble', async () => {
    const material = await apply({
      kind: 'add-material',
      payload: { material: { name: 'McpPartial', base_color: '#ff0000' } },
      description: 'add material',
    });
    expect(material.success).toBe(true);

    const badMaterial = await apply({
      kind: 'add-material',
      payload: { material: { name: 'McpBad', shininess: 3 } },
      description: 'add material',
    });
    expect(badMaterial.success).toBe(false);
    expect(badMaterial.error).toMatch(/Unknown material field/);

    const image = await apply({
      kind: 'add-image',
      payload: { name: 'Mcp Dot', source: { base64: TINY_PNG, mimeType: 'image/png' } },
      description: 'add image',
    });
    expect(image.success).toBe(true);

    const sound = await apply({
      kind: 'add-sound',
      payload: { name: 'McpBeep', source: { base64: tinyWav(), mimeType: 'audio/wav' } },
      description: 'add sound',
    });
    expect(sound.success).toBe(true);

    const script = await apply({
      kind: 'edit-script',
      payload: { mode: 'append', content: 'Sub McpPing_Hit()\r\n  PlaySound "McpBeep"\r\nEnd Sub' },
      description: 'append script',
    });
    expect(script.success).toBe(true);

    const bytes = vpin.assemble(await collectFiles(workDir));
    expect(bytes.length).toBeGreaterThan(1000);

    const reread = vpin.extract(bytes) as Record<string, Uint8Array>;
    const materials = JSON.parse(Buffer.from(reread['/vpx/materials.json']).toString('utf-8')) as {
      name: string;
    }[];
    expect(materials.some(m => m.name === 'McpPartial')).toBe(true);
    const images = JSON.parse(Buffer.from(reread['/vpx/images.json']).toString('utf-8')) as {
      name: string;
    }[];
    expect(images.some(i => i.name === 'Mcp Dot')).toBe(true);
    const sounds = JSON.parse(Buffer.from(reread['/vpx/sounds.json']).toString('utf-8')) as { name: string }[];
    expect(sounds.some(s => s.name === 'McpBeep')).toBe(true);
    expect(Buffer.from(reread['/vpx/script.vbs']).toString('utf-8')).toContain('McpPing_Hit');
  });
});
