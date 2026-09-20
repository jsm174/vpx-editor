import { z } from 'zod';
import type { AuditFinding } from '@francisdb/vpin-wasm';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';

const SEVERITIES = ['error', 'warning', 'suggestion', 'info'] as const;
type Severity = (typeof SEVERITIES)[number];
const DEFAULT_LIMIT = 100;

const auditInput = z.object({
  minSeverity: z
    .enum(SEVERITIES)
    .optional()
    .describe(
      'Only return findings at this severity or worse (error > warning > suggestion > info). Default: everything.'
    ),
  code: z.string().optional().describe('Only return findings with this kebab-case code, e.g. "missing-image".'),
  item: z.string().optional().describe('Only return findings about this part (case insensitive).'),
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe(`Max findings to return (default ${DEFAULT_LIMIT}).`),
});

function rank(severity: Severity): number {
  return SEVERITIES.indexOf(severity);
}

const audit: Tool<typeof auditInput> = {
  name: 'vpx_audit',
  title: 'Audit the table',
  annotations: { readOnlyHint: true, destructiveHint: false },
  description:
    'CHECK the active table for problems the way Visual Pinball and vpin do: references to images, materials, surfaces, ' +
    'sounds or collection items that do not exist, duplicate or reserved names, unused assets and fonts, timers without ' +
    'handlers, deprecated properties, script parse errors and other script pitfalls, physics and rendering gotchas. ' +
    'Each finding has a severity, a kebab-case code, a message, and where it applies: `item` names the part (fix it with ' +
    'vpx_part action:"modify") and `line`/`column` point into the script (fix it with vpx_script). Run it after a batch ' +
    "of edits and before vpx_save or vpx_test; a clean run returns an empty list. Also refreshes the editor's audit panel.",
  inputSchema: auditInput,
  async execute(input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);
    const result = await ctx.auditTable();
    if (!result.success) return errorResult(result.error);

    const counts: Record<Severity, number> = { error: 0, warning: 0, suggestion: 0, info: 0 };
    for (const f of result.findings) counts[f.severity]++;

    let findings: AuditFinding[] = result.findings;
    if (input.minSeverity) {
      const max = rank(input.minSeverity);
      findings = findings.filter(f => rank(f.severity) <= max);
    }
    if (input.code) findings = findings.filter(f => f.code === input.code);
    if (input.item) {
      const wanted = input.item.toLowerCase();
      findings = findings.filter(f => f.item?.toLowerCase() === wanted);
    }
    findings = [...findings].sort((a, b) => rank(a.severity) - rank(b.severity) || a.code.localeCompare(b.code));

    const limit = input.limit ?? DEFAULT_LIMIT;
    return jsonResult({
      counts,
      total: result.findings.length,
      returned: Math.min(findings.length, limit),
      truncated: findings.length > limit,
      findings: findings.slice(0, limit),
      verdict:
        counts.error > 0
          ? `${counts.error} error(s) need fixing before the table plays correctly.`
          : counts.warning > 0
            ? `No errors; ${counts.warning} warning(s) worth reviewing.`
            : 'Clean: no errors or warnings.',
    });
  },
};

export function buildAuditTools(): Tool[] {
  return [audit];
}
