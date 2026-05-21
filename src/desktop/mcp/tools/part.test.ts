import { describe, it, expect } from 'vitest';
import { buildPartTools } from './part.js';
import type { ToolContext, ToolResult } from '../types.js';

const FLIPPER_SAMPLE = {
  name: 'LeftFlipper',
  center: { x: 278, y: 1803 },
  start_angle: 121,
  end_angle: 70,
  material: 'Flipper',
};

function fakeCtx(): ToolContext {
  return {
    getActiveTable: async () => ({
      workDir: '/tmp/fake',
      vpxPath: null,
      tableName: 'Fake',
      windowId: 'w1',
      isLocked: false,
    }),
    loadActiveState: async () =>
      ({
        items: [{ type: 'Flipper', name: 'LeftFlipper', data: FLIPPER_SAMPLE }],
      }) as unknown as Awaited<ReturnType<ToolContext['loadActiveState']>>,
    listWindows: async () => [],
    attachWindow: async () => ({ ok: false, error: 'nope' }),
    loadTable: async () => null,
    createTable: async () => ({ ok: false as const, error: 'nope' }),
    applyEdit: async () => ({ success: true, applied: false, preview: {} }),
    log: () => {},
    importPrimitiveMesh: async () => ({ ok: false as const, error: 'unused' }),
    exportPrimitiveMesh: async () => ({ ok: false as const, error: 'unused' }),
    saveTable: async () => ({ saved: false, path: null }),
    captureView: async () => ({ ok: false }),
    queryGeometry: async () => ({ success: false, error: 'nope' }),
    exportObj: async () => ({ success: false, error: 'nope' }),
    playTest: async () => ({
      ok: false,
      ranSeconds: 0,
      exitCode: null,
      timedOut: false,
      earlyExit: false,
      errorLines: [],
      logTail: '',
    }),
    vpx: {
      extract: async () => ({}),
      objToMesh: async () => ({
        positions: new Float32Array(),
        texCoords: new Float32Array(),
        normals: new Float32Array(),
        indices: new Uint32Array(),
      }),
    },
    config: { mcpPort: 0, systemScriptsPath: null, glfPath: null, templatesPath: null },
  };
}

function structured(result: ToolResult): Record<string, unknown> {
  return (result.structuredContent ??
    JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')) as Record<string, unknown>;
}

describe('vpx_part unknown field warnings', () => {
  const tool = buildPartTools()[0];

  it('warns when a modify passes a key no existing part of that type has', async () => {
    const result = await tool.execute(
      { action: 'modify', part: { type: 'Flipper', partName: 'LeftFlipper', rotZ: 45 } },
      fakeCtx()
    );
    const out = structured(result);
    const warnings = out.warnings as string[];
    expect(warnings).toBeDefined();
    expect(warnings[0]).toContain('rotZ');
    expect(warnings[0]).toContain('template');
  });

  it('does not warn for keys present on the sample part', async () => {
    const result = await tool.execute(
      { action: 'modify', part: { type: 'Flipper', partName: 'LeftFlipper', start_angle: 100 } },
      fakeCtx()
    );
    const out = structured(result);
    expect(out.warnings).toBeUndefined();
  });

  it('warns for unknown keys passed through more', async () => {
    const result = await tool.execute(
      { action: 'modify', part: { type: 'Flipper', partName: 'LeftFlipper', more: { strengthh: 2200 } } },
      fakeCtx()
    );
    const out = structured(result);
    const warnings = out.warnings as string[];
    expect(warnings).toBeDefined();
    expect(warnings[0]).toContain('strengthh');
  });
});
