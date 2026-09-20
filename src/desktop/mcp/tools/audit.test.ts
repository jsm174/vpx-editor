import { describe, it, expect } from 'vitest';
import { buildAuditTools } from './audit.js';
import type { ToolContext, ToolResult } from '../types.js';

const FINDINGS = [
  { severity: 'info' as const, code: 'unused-materials', message: '3 materials are unused' },
  {
    severity: 'error' as const,
    code: 'missing-image',
    message: 'Wall1: image references missing image "x"',
    item: 'Wall1',
  },
  { severity: 'warning' as const, code: 'timer-without-handler', message: 'timer of "T1" fires', item: 'T1' },
  {
    severity: 'suggestion' as const,
    code: 'rnd-without-randomize',
    message: 'Rnd without Randomize',
    line: 12,
    column: 3,
  },
];

function fakeCtx(): ToolContext {
  return {
    getActiveTable: async () => ({
      workDir: '/tmp/fake',
      vpxPath: null,
      tableName: 'Fake',
      windowId: 'w1',
      isLocked: false,
    }),
    auditTable: async () => ({ success: true as const, findings: FINDINGS }),
  } as unknown as ToolContext;
}

function structured(result: ToolResult): Record<string, unknown> {
  return (result.structuredContent ??
    JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')) as Record<string, unknown>;
}

describe('vpx_audit', () => {
  const tool = buildAuditTools()[0];

  it('counts every severity and sorts errors first', async () => {
    const out = structured(await tool.execute({}, fakeCtx()));
    expect(out.counts).toEqual({ error: 1, warning: 1, suggestion: 1, info: 1 });
    const findings = out.findings as { severity: string }[];
    expect(findings.map(f => f.severity)).toEqual(['error', 'warning', 'suggestion', 'info']);
    expect(out.verdict).toContain('1 error');
  });

  it('filters by minimum severity, code and item', async () => {
    const bySeverity = structured(await tool.execute({ minSeverity: 'warning' }, fakeCtx()));
    expect((bySeverity.findings as unknown[]).length).toBe(2);
    const byCode = structured(await tool.execute({ code: 'missing-image' }, fakeCtx()));
    expect((byCode.findings as { code: string }[])[0].code).toBe('missing-image');
    const byItem = structured(await tool.execute({ item: 't1' }, fakeCtx()));
    expect((byItem.findings as { item?: string }[])[0].item).toBe('T1');
  });

  it('reports a clean table', async () => {
    const ctx = { ...fakeCtx(), auditTable: async () => ({ success: true as const, findings: [] }) } as ToolContext;
    const out = structured(await tool.execute({}, ctx));
    expect(out.total).toBe(0);
    expect(out.verdict).toContain('Clean');
  });
});
