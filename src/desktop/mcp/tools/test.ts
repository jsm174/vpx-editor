import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';

const testInput = z.object({
  seconds: z
    .number()
    .int()
    .min(5)
    .max(60)
    .default(12)
    .optional()
    .describe('How long to let the table run before stopping it (default 12).'),
});

const test: Tool<typeof testInput> = {
  name: 'vpx_test',
  title: 'Boot-test the table',
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  description:
    'TEST that the active table actually boots: assembles it to a temporary .vpx, launches VPinballX with it for a few ' +
    "seconds (a game window will appear briefly on the user's screen), then stops it and reports any script/compile/runtime " +
    'errors found in the log. Run this after wiring GLF logic or editing the script — a clean vpx_glf "status" does not ' +
    'guarantee the script compiles. Requires the VPinballX path to be configured in the editor preferences. ' +
    'The table on disk is not modified.',
  inputSchema: testInput,
  async execute(input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);

    const result = await ctx.playTest({ seconds: input.seconds ?? 12 });
    if (result.error) {
      return errorResult(result.error);
    }

    const verdict = result.ok
      ? result.earlyExit
        ? `SUSPICIOUS — exited cleanly after only ${result.ranSeconds}s with no errors logged; do not treat this as a confirmed boot.`
        : `BOOT OK — ran ${result.ranSeconds}s with no script errors detected.`
      : result.errorLines.length > 0
        ? `SCRIPT ERRORS detected (${result.errorLines.length} matching lines).`
        : `VPinballX exited early with code ${result.exitCode} — likely a crash or load failure.`;

    return jsonResult({
      verdict,
      ok: result.ok,
      ranSeconds: result.ranSeconds,
      timedOut: result.timedOut,
      earlyExit: result.earlyExit,
      exitCode: result.exitCode,
      errorLines: result.errorLines,
      note: result.note,
      logTail: result.ok && !result.earlyExit ? undefined : result.logTail,
    });
  },
};

export function buildTestTools(): Tool[] {
  return [test as unknown as Tool];
}
