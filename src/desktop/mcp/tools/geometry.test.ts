import { describe, it, expect } from 'vitest';
import { buildGeometryTools } from './geometry.js';
import type { ToolContext } from '../types.js';

function bbox(min: [number, number, number], max: [number, number, number]) {
  return {
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
  };
}

function ctxWithParts(parts: unknown[]): ToolContext {
  return {
    queryGeometry: async () => ({
      success: true,
      table: { left: 0, top: 0, right: 952, bottom: 2162 },
      parts,
    }),
  } as unknown as ToolContext;
}

describe('vpx_geometry overlaps', () => {
  const tool = buildGeometryTools().find(t => t.name === 'vpx_geometry')!;

  it('reports intersecting bboxes with per-axis overlap', async () => {
    const result = await tool.execute(
      { action: 'overlaps' },
      ctxWithParts([
        { name: 'Wall1', type: 'Wall', bbox: bbox([0, 0, 0], [100, 100, 50]) },
        { name: 'Bumper1', type: 'Bumper', bbox: bbox([50, 50, 0], [150, 150, 60]) },
        { name: 'Far', type: 'Wall', bbox: bbox([500, 500, 0], [600, 600, 50]) },
      ])
    );
    const out = result.structuredContent as { overlaps: { parts: string[]; overlap: { x: number } }[] };
    expect(out.overlaps).toHaveLength(1);
    expect(out.overlaps[0].parts).toEqual(['Wall1', 'Bumper1']);
    expect(out.overlaps[0].overlap.x).toBe(50);
  });

  it('ignores touching and sub-threshold contact', async () => {
    const result = await tool.execute(
      { action: 'overlaps' },
      ctxWithParts([
        { name: 'A', type: 'Wall', bbox: bbox([0, 0, 0], [100, 100, 50]) },
        { name: 'B', type: 'Wall', bbox: bbox([100, 0, 0], [200, 100, 50]) },
      ])
    );
    const out = result.structuredContent as { overlaps: unknown[] };
    expect(out.overlaps).toHaveLength(0);
  });

  it('summary passes parts and units through', async () => {
    const result = await tool.execute(
      { action: 'summary' },
      ctxWithParts([{ name: 'Wall1', type: 'Wall', bbox: bbox([0, 0, 0], [100, 100, 50]) }])
    );
    const out = result.structuredContent as { parts: unknown[]; units: string };
    expect(out.parts).toHaveLength(1);
    expect(out.units).toContain('VPX units');
  });

  it('errors cleanly when no table is active', async () => {
    const ctx = { queryGeometry: async () => ({ success: false, error: 'No active table' }) } as unknown as ToolContext;
    const result = await tool.execute({ action: 'summary' }, ctx);
    expect(result.isError).toBe(true);
  });
});
