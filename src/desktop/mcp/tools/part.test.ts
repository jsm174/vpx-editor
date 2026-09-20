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
    exportGlb: async () => ({ success: false as const, error: 'nope' }),
    auditTable: async () => ({ success: false as const, error: 'nope' }),
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

describe('vpx_part transform', () => {
  const tool = buildPartTools()[0];

  it('builds a transform-part edit for several parts', async () => {
    let op: Record<string, unknown> | undefined;
    const ctx = fakeCtx();
    ctx.applyEdit = async edit => {
      op = edit as unknown as Record<string, unknown>;
      return { success: true, applied: false, preview: {} };
    };
    await tool.execute(
      {
        action: 'transform',
        names: ['Wall1', 'Wall2'],
        transform: 'rotate',
        angle: 90,
        center: { x: 10, y: 20 },
        preview: true,
      },
      ctx
    );
    expect(op?.kind).toBe('transform-part');
    expect(op?.payload).toEqual({
      partNames: ['Wall1', 'Wall2'],
      transform: 'rotate',
      angle: 90,
      center: { x: 10, y: 20 },
    });
  });

  it('rejects a rotate without an angle', async () => {
    const result = await tool.execute({ action: 'transform', name: 'Wall1', transform: 'rotate' }, fakeCtx());
    expect(result.isError).toBe(true);
  });
});
