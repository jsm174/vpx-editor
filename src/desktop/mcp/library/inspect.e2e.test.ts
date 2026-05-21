import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { summarizeDonorTable } from './inspect.js';
import { loadTableFromVpx } from './load-table.js';

describe('donor inspect against the real GLF starter', () => {
  it('extracts and summarizes glfTutorialPlunger.vpx via vpin-wasm', async () => {
    const mod = await import('@francisdb/vpin-wasm');
    const wasmPath = path.join(process.cwd(), 'node_modules/@francisdb/vpin-wasm/vpin_bg.wasm');
    await mod.default({ module_or_path: fs.readFileSync(wasmPath) });
    const vpx = {
      extract: async (buffer: Uint8Array) => mod.extract(buffer) as Record<string, Uint8Array>,
      objToMesh: async () => {
        throw new Error('unused');
      },
    };
    const tablePath = path.join(process.cwd(), 'public/templates/glfTutorialPlunger.vpx');
    const state = await loadTableFromVpx(tablePath, vpx);
    const summary = summarizeDonorTable(state, tablePath);
    expect(summary.partCounts.Flipper).toBeGreaterThanOrEqual(2);
    expect(Object.values(summary.partsByType).flatMap(g => g.names)).toContain('swTrough1');
    expect(summary.script.subs.length).toBeGreaterThan(0);
  }, 30_000);
});
