// Validation gate for placing a generated mechanism. Pure functions over plain
// inputs (the tool computes bounds / loads state and passes them in) so they are
// fully unit-testable. Policy: an 'error' finding refuses the apply; 'warning'/'info'
// are surfaced in the preview for the human to judge.
import { findSubs, lintCommonPitfalls, splitLines } from '../../../shared/vbs-analysis.js';
import type { ScaffoldStatus } from './glf/scaffold.js';

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
}

export interface ValidationReport {
  findings: Finding[];
  /** True when any finding is an error — the caller must not apply. */
  refuse: boolean;
}

export function validateReferences(
  refs: { switchRefs: string[]; coilRefs: string[] },
  placedPartNames: string[]
): Finding[] {
  const placed = new Set(placedPartNames.map(n => n.toLowerCase()));
  const findings: Finding[] = [];
  for (const ref of [...refs.switchRefs, ...refs.coilRefs]) {
    if (!placed.has(ref.toLowerCase())) {
      findings.push({
        severity: 'error',
        code: 'unresolved-reference',
        message: `GLF config references "${ref}" but no placed part has that name.`,
      });
    }
  }
  return findings;
}

/** Feel-layer helpers the callback calls should exist; missing ones warn (degrade to portable). */
export function validateHelpers(helperRefs: string[], script: string): Finding[] {
  const findings: Finding[] = [];
  for (const helper of helperRefs) {
    if (!new RegExp(`\\b${escapeRegex(helper)}\\b`).test(script)) {
      findings.push({
        severity: 'warning',
        code: 'missing-helper',
        message: `Feel-layer helper "${helper}" not found in the table — the callback will fail unless it's added (or emit without feelLayer).`,
      });
    }
  }
  return findings;
}

/** Structural scaffold gaps (collections, timer) warn — they can't be created from script alone. */
export function validateScaffold(status: ScaffoldStatus): Finding[] {
  const missing = status.bootable
    ? []
    : status.missing.map(m => ({
        severity: 'warning' as const,
        code: 'scaffold-missing',
        message: `GLF scaffold incomplete: ${m}.`,
      }));
  const warnings = status.warnings.map(w => ({
    severity: 'warning' as const,
    code: 'scaffold-warning',
    message: `GLF scaffold: ${w}.`,
  }));
  return [...missing, ...warnings];
}

export type DefinitionKind = 'sub' | 'function' | 'const' | 'dim';

/**
 * Script-scope definitions: every top-level Sub/Function and Class name, plus
 * Const/Dim lines outside sub/class bodies. Members inside Sub or Class bodies are
 * locally scoped in VBScript and can't collide globally, so they're excluded.
 */
export function collectGlobalDefinitions(script: string): Map<string, DefinitionKind> {
  const out = new Map<string, DefinitionKind>();
  const lines = splitLines(script);

  const inClass = new Set<number>();
  const classRe = /^\s*Class\s+([A-Za-z_][A-Za-z0-9_]*)/i;
  const endClassRe = /^\s*End\s+Class\b/i;
  let classStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (classStart < 0) {
      const m = classRe.exec(lines[i]);
      if (m) {
        out.set(m[1].toLowerCase(), 'sub');
        classStart = i + 1;
      }
    } else if (endClassRe.test(lines[i])) {
      for (let l = classStart; l <= i + 1; l++) inClass.add(l);
      classStart = -1;
    }
  }

  const excluded = new Set<number>(inClass);
  for (const s of findSubs(script)) {
    if (inClass.has(s.startLine)) continue;
    out.set(s.name.toLowerCase(), s.kind);
    for (let l = s.startLine; l <= s.endLine; l++) excluded.add(l);
  }

  const declRe = /^\s*(Const|Dim)\s+([A-Za-z_][A-Za-z0-9_]*)/i;
  for (let i = 0; i < lines.length; i++) {
    if (excluded.has(i + 1)) continue;
    const m = declRe.exec(lines[i]);
    if (m && !out.has(m[2].toLowerCase())) {
      out.set(m[2].toLowerCase(), m[1].toLowerCase() as DefinitionKind);
    }
  }
  return out;
}

/**
 * VBScript refuses to load a script where a Sub/Function/Const name is defined twice
 * ("Name redefined"). Colliding Dims warn (harmless duplication is rare but possible
 * via Class fields the line-based scan can't see).
 */
export function validateNoRedefinitions(existingScript: string, injectedBlock: string): Finding[] {
  const existing = collectGlobalDefinitions(existingScript);
  const injected = collectGlobalDefinitions(injectedBlock);
  const findings: Finding[] = [];
  for (const [name, kind] of injected) {
    const prior = existing.get(name);
    if (!prior) continue;
    const fatal = kind !== 'dim' || prior !== 'dim';
    findings.push({
      severity: fatal ? 'error' : 'warning',
      code: 'name-redefined',
      message: `"${name}" is already defined in the table script (${prior}) and again in the injected code (${kind}) — VBScript would fail with "Name redefined".`,
    });
  }
  return findings;
}

const FLIPPER_KEYBOARD_SWITCHES = new Set([
  's_left_flipper',
  's_right_flipper',
  's_left_staged_flipper_key',
  's_right_staged_flipper_key',
]);

/** The GLF keyboard dispatch only fires the s_*_flipper / s_*_staged_flipper_key switches — any other flipper switch never triggers from keys. */
export function validateFlipperSwitch(switchName: string): Finding[] {
  if (FLIPPER_KEYBOARD_SWITCHES.has(switchName.toLowerCase())) return [];
  return [
    {
      severity: 'warning',
      code: 'flipper-switch-unbound',
      message: `Flipper switch "${switchName}" is not s_left_flipper/s_right_flipper (or s_left_staged_flipper_key/s_right_staged_flipper_key) — the GLF keyboard dispatch never fires it, so this flipper won't respond to the flipper keys (wire it to an autofire or custom event instead).`,
    },
  ];
}

/** Run the common VBS pitfall linter over the merged script. */
export function lintMergedScript(script: string, coreSymbols?: Set<string>): Finding[] {
  return lintCommonPitfalls(script, coreSymbols).map(f => ({
    severity: f.severity,
    code: `lint:${f.code}`,
    message: `Line ${f.line}: ${f.message}`,
  }));
}

export function combineFindings(...groups: Finding[][]): ValidationReport {
  const findings = groups.flat();
  return { findings, refuse: findings.some(f => f.severity === 'error') };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
