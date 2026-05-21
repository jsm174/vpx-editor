// Places emitted GLF pieces into a script correctly: the `With CreateGlf...` device
// config must go INSIDE ConfigureGlfDevices(), while callback Subs go at top level.
// Pure (operates on script text) so it's unit-testable; the tool does one edit-script
// replace with the result.
import { findSubs, splitLines } from '../../../../shared/vbs-analysis.js';

export interface AssembleOptions {
  /** Scaffold block to append first (creates an empty ConfigureGlfDevices if the table lacks one). */
  scaffoldBlock?: string | null;
  /** The `With CreateGlf...End With` block to nest inside ConfigureGlfDevices(). */
  deviceConfig: string;
  /** Top-level callback Sub(s). */
  callbacks: string;
  /** Name of the device-configuration sub (default ConfigureGlfDevices). */
  configureSubName?: string;
}

function trimTrailing(s: string): string {
  return s.replace(/\s*$/, '');
}

export function assembleGlfScript(current: string, opts: AssembleOptions): string {
  const subName = opts.configureSubName ?? 'ConfigureGlfDevices';
  let script = current ?? '';
  if (opts.scaffoldBlock) {
    script = `${trimTrailing(script)}\n\n${opts.scaffoldBlock}`;
  }

  const indented = opts.deviceConfig
    .split('\n')
    .map(l => (l.length ? `    ${l}` : l))
    .join('\n');

  const target = findSubs(script).find(s => s.name.toLowerCase() === subName.toLowerCase());
  if (target) {
    // Insert before the sub's closing line (endLine is 1-based, the End Sub line).
    const lines = splitLines(script);
    const before = lines.slice(0, target.endLine - 1);
    const after = lines.slice(target.endLine - 1);
    script = [...before, indented, ...after].join('\n');
  } else {
    script = `${trimTrailing(script)}\n\nSub ${subName}()\n${indented}\nEnd Sub`;
  }

  if (opts.callbacks.trim()) {
    script = `${trimTrailing(script)}\n\n${opts.callbacks}\n`;
  }
  return script;
}
