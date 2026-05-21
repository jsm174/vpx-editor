// Detects whether a target table is GLF-bootable and produces the minimal harness
// to make it so, modeled on the official vpx-example-glf table. The bootable contract
// (constant/hook/collection names) is taken verbatim from that project:
//   - ZCON constants: cGameName, BallSize(=50), BallMass(=1), tnob, lob, gBOT, table dims
//   - ZINI hooks:     <Table>_Init -> ConfigureGlfDevices() + Glf_Init(<Table>); <Table>_Exit -> Glf_Exit()
//   - ZKEY hooks:     <Table>_KeyDown -> Glf_KeyDown(keycode); <Table>_KeyUp -> Glf_KeyUp(keycode)
//   - Collections:    glf_lights, glf_switches, glf_slingshots, glf_spinners
import { findConstants, findSubs, splitLines, stripAllComments, type VbsSub } from '../../../../shared/vbs-analysis.js';

export const GLF_REQUIRED_COLLECTIONS = ['glf_lights', 'glf_switches', 'glf_slingshots', 'glf_spinners'] as const;
export const GLF_REQUIRED_CONSTANTS = ['cGameName', 'BallSize', 'BallMass', 'tnob', 'lob'] as const;

const HOOKS = [
  { key: 'initHook', suffix: 'Init', call: 'Glf_Init' },
  { key: 'exitHook', suffix: 'Exit', call: 'Glf_Exit' },
  { key: 'keyDownHook', suffix: 'KeyDown', call: 'Glf_KeyDown' },
  { key: 'keyUpHook', suffix: 'KeyUp', call: 'Glf_KeyUp' },
] as const;

export interface ScaffoldStatus {
  /** True only when the GLF framework, all four lifecycle hooks, constants, and collections are present. */
  bootable: boolean;
  /** The legacy embedded framework (old (new BallDevice) API) — CreateGlf* emission is incompatible. */
  oldFramework: boolean;
  /** The framework is pulled in by an Include(...) line and no CreateGlf* definition is in this script. */
  externalScript: boolean;
  present: {
    glfLoaded: boolean;
    initHook: boolean;
    exitHook: boolean;
    keyDownHook: boolean;
    keyUpHook: boolean;
    constants: boolean;
    collections: boolean;
    gameTimer: boolean;
  };
  missingConstants: string[];
  /** Human-readable list of what's missing, for the preview/validation report. */
  missing: string[];
  /** Non-blocking problems (constant values the framework can't work with, unsupported table element). */
  warnings: string[];
}

export interface ScaffoldInput {
  script: string;
  /** Collection names present in the target table (from collections.json). */
  collectionNames?: string[];
  /** Part names in the target table; when given, the Glf_GameTimer prerequisite is checked against them. */
  partNames?: string[];
  /** The VPX table element used in hook subs (default "Table1"). */
  tableElement?: string;
}

export const GLF_TABLE_ELEMENT = 'Table1';

// The framework is "loaded" only when its MODERN definitions are in scope — either
// embedded (Function CreateGlf*) or pulled in by an Include line. Call sites like
// Glf_Init(Table1) do not count, so injecting hooks can't self-satisfy this. The old
// embedded framework also defines Sub Glf_Init but no CreateGlf* — that must NOT
// count as loaded (its API is incompatible with what we emit).
const MODERN_DEFS = /\bFunction\s+CreateGlf[A-Za-z]+\s*\(/i;
const GLF_INIT_DEF = /\b(?:Public\s+)?Sub\s+Glf_Init\s*\(/i;

const INCLUDE_LINE = /Include\s*\(\s*"[^"]*(vpx-glf\.vbs|tablescript\.vbs)/i;
const GAME_TIMER_PART = 'glf_gametimer';

function frameworkLoaded(code: string): boolean {
  return MODERN_DEFS.test(code) || INCLUDE_LINE.test(code);
}

function oldFrameworkPresent(code: string): boolean {
  return GLF_INIT_DEF.test(code) && !MODERN_DEFS.test(code);
}

function hookSub(subs: VbsSub[], suffix: string, tableElement: string): VbsSub | undefined {
  const exactName = `${tableElement}_${suffix}`.toLowerCase();
  return subs.find(s => s.kind === 'sub' && s.name.toLowerCase() === exactName);
}

function hookPresent(subs: VbsSub[], suffix: string, call: string, tableElement: string): boolean {
  const sub = hookSub(subs, suffix, tableElement);
  return !!sub && new RegExp(`\\b${call}\\b`, 'i').test(stripAllComments(sub.body));
}

function missingConstantNames(script: string): string[] {
  const defined = new Set(findConstants(script).map(c => c.name.toLowerCase()));
  return GLF_REQUIRED_CONSTANTS.filter(c => !defined.has(c.toLowerCase()));
}

export function constantValueWarnings(script: string): string[] {
  const out: string[] = [];
  for (const c of findConstants(script)) {
    const name = c.name.toLowerCase();
    if (name === 'ballsize' && Number(c.value) !== 50) {
      out.push(
        `Const BallSize = ${c.value} — the framework creates balls with CreateSizedballWithMass(BallSize/2, BallMass) and expects 50`
      );
    }
    if (name === 'ballmass' && Number(c.value) !== 1) {
      out.push(`Const BallMass = ${c.value} — the framework expects 1`);
    }
  }
  return out;
}

export function gameTimerSubPresent(script: string): boolean {
  return findSubs(script).some(
    s => s.kind === 'sub' && /_Timer$/i.test(s.name) && /\bGlf_GameTimer_Timer\b/i.test(stripAllComments(s.body))
  );
}

export function detectGlfScaffold(input: ScaffoldInput): ScaffoldStatus {
  const s = input.script;
  const code = stripAllComments(s);
  const subs = findSubs(s);
  const tableElement = input.tableElement ?? GLF_TABLE_ELEMENT;
  const collections = new Set((input.collectionNames ?? []).map(c => c.toLowerCase()));

  const glfLoaded = frameworkLoaded(code);
  const oldFramework = oldFrameworkPresent(code);
  const externalScript = INCLUDE_LINE.test(code) && !MODERN_DEFS.test(code);
  const initHook = hookPresent(subs, 'Init', 'Glf_Init', tableElement);
  const exitHook = hookPresent(subs, 'Exit', 'Glf_Exit', tableElement);
  const keyDownHook = hookPresent(subs, 'KeyDown', 'Glf_KeyDown', tableElement);
  const keyUpHook = hookPresent(subs, 'KeyUp', 'Glf_KeyUp', tableElement);
  const missingConstants = missingConstantNames(s);
  const constants = missingConstants.length === 0;
  const collectionsOk = GLF_REQUIRED_COLLECTIONS.every(c => collections.has(c.toLowerCase()));
  const timerPart = input.partNames?.some(n => n.toLowerCase() === GAME_TIMER_PART) ?? false;
  const gameTimer = input.partNames === undefined || timerPart || gameTimerSubPresent(s);

  const missing: string[] = [];
  if (oldFramework) missing.push('legacy GLF framework embedded — incompatible with the CreateGlf* API');
  if (!glfLoaded) missing.push('GLF framework not loaded (embed vpx-glf.vbs)');
  if (!initHook) missing.push(`Glf_Init hook (in ${tableElement}_Init)`);
  if (!exitHook) missing.push(`Glf_Exit hook (in ${tableElement}_Exit)`);
  if (!keyDownHook) missing.push(`Glf_KeyDown hook (in ${tableElement}_KeyDown)`);
  if (!keyUpHook) missing.push(`Glf_KeyUp hook (in ${tableElement}_KeyUp)`);
  if (!constants) missing.push(`constants (${missingConstants.join(', ')})`);
  if (!collectionsOk) {
    const lacking = GLF_REQUIRED_COLLECTIONS.filter(c => !collections.has(c.toLowerCase()));
    missing.push(`collections (${lacking.join(', ')})`);
  }
  if (!gameTimer) missing.push('Glf_GameTimer timer part (or a *_Timer Sub calling Glf_GameTimer_Timer)');

  const warnings = constantValueWarnings(s);
  if (tableElement.toLowerCase() !== GLF_TABLE_ELEMENT.toLowerCase()) {
    warnings.push(
      `table element "${tableElement}" — the framework hardcodes Table1 (Table1.Option in Glf_Options, Table1.Filename), so hooks on another element will not boot`
    );
  }

  return {
    bootable: missing.length === 0,
    oldFramework,
    externalScript,
    present: {
      glfLoaded,
      initHook,
      exitHook,
      keyDownHook,
      keyUpHook,
      constants,
      collections: collectionsOk,
      gameTimer,
    },
    missingConstants,
    missing,
    warnings,
  };
}

export interface ScaffoldBuildOptions {
  /** The VPX table element name used in hook subs, e.g. "Table1". */
  tableElement: string;
  /** Unique alphanumeric game name (cGameName). */
  gameName: string;
  /** Total number of balls the table holds (tnob). */
  tnob?: number;
  /** Locked balls (lob). */
  lob?: number;
  /** Line that loads the GLF framework, e.g. Include("...vpx-glf.vbs"). Omitted if already loaded. */
  glfLoadLine?: string;
}

export function buildConstantsBlock(opts: ScaffoldBuildOptions, missingConstants?: string[]): string[] {
  const wanted = new Set((missingConstants ?? [...GLF_REQUIRED_CONSTANTS]).map(c => c.toLowerCase()));
  const lines: string[] = [];
  if (wanted.has('cgamename')) lines.push(`Const cGameName = "${opts.gameName}"`);
  if (wanted.has('ballsize')) lines.push('Const BallSize = 50');
  if (wanted.has('ballmass')) lines.push('Const BallMass = 1');
  if (wanted.has('tnob')) lines.push(`Const tnob = ${opts.tnob ?? 1}`);
  if (wanted.has('lob')) lines.push(`Const lob = ${opts.lob ?? 0}`);
  return lines;
}

function buildDimsBlock(tableElement: string, script?: string): string[] {
  const code = script ? stripAllComments(script) : '';
  const declared = (name: string) => new RegExp(`\\b(Dim|Const)\\s+${name}\\b`, 'i').test(code);
  const lines: string[] = [];
  if (!declared('tablewidth')) lines.push(`Dim tablewidth : tablewidth = ${tableElement}.width`);
  if (!declared('tableheight')) lines.push(`Dim tableheight : tableheight = ${tableElement}.height`);
  if (!declared('gBOT')) lines.push('Dim gBOT');
  return lines;
}

function buildHookSub(tableElement: string, suffix: string): string[] {
  const t = tableElement;
  switch (suffix) {
    case 'Init':
      return [`Sub ${t}_Init`, '    ConfigureGlfDevices()', `    Glf_Init(${t})`, 'End Sub'];
    case 'Exit':
      return [`Sub ${t}_Exit`, '    Glf_Exit()', 'End Sub'];
    case 'KeyDown':
      return [`Sub ${t}_KeyDown(ByVal keycode)`, '    Glf_KeyDown(keycode)', 'End Sub'];
    case 'KeyUp':
      return [`Sub ${t}_KeyUp(ByVal keycode)`, '    Glf_KeyUp(keycode)', 'End Sub'];
    default:
      return [];
  }
}

export function buildConfigureSub(): string[] {
  return ['Sub ConfigureGlfDevices()', 'End Sub'];
}

export interface MergeScaffoldResult {
  script: string;
  /** Human-readable list of what was added or modified, for the preview. */
  changes: string[];
}

function hookParamName(header: string, fallback: string): string {
  const m = /\(\s*(?:ByVal\s+|ByRef\s+)?([A-Za-z_][A-Za-z0-9_]*)/i.exec(header);
  return m ? m[1] : fallback;
}

function insertIntoSub(lines: string[], sub: VbsSub, callLines: string[]): void {
  if (sub.startLine === sub.endLine) {
    const idx = sub.startLine - 1;
    lines[idx] = lines[idx].replace(/\bEnd\s+Sub\s*$/i, `${callLines.map(c => c.trim()).join(' : ')} : End Sub`);
  } else {
    lines.splice(sub.endLine - 1, 0, ...callLines.map(c => `    ${c.trim()}`));
  }
}

/**
 * Bring a script up to the GLF bootable contract without redefining anything it already
 * has: Glf_* calls are inserted INTO existing <Table>_Init/Exit/KeyDown/KeyUp subs, only
 * the individual missing constants are appended, and ConfigureGlfDevices is created (and
 * invoked from the init hook) only if absent.
 */
export function mergeGlfScaffold(script: string, opts: ScaffoldBuildOptions): MergeScaffoldResult {
  const changes: string[] = [];
  let lines = splitLines(script);

  for (const hook of [...HOOKS].reverse()) {
    const subs = findSubs(lines.join('\n'));
    const sub = hookSub(subs, hook.suffix, opts.tableElement);
    if (sub && new RegExp(`\\b${hook.call}\\b`, 'i').test(stripAllComments(sub.body))) continue;
    if (sub) {
      const calls: string[] = [];
      if (hook.suffix === 'Init') {
        if (!/\bConfigureGlfDevices\b/i.test(stripAllComments(sub.body))) calls.push('ConfigureGlfDevices()');
        calls.push(`Glf_Init(${opts.tableElement})`);
      } else if (hook.suffix === 'Exit') {
        calls.push('Glf_Exit()');
      } else {
        calls.push(`${hook.call}(${hookParamName(sub.header, 'keycode')})`);
      }
      insertIntoSub(lines, sub, calls);
      changes.push(`Inserted ${hook.call} into existing Sub ${sub.name}`);
    } else {
      lines.push('', ...buildHookSub(opts.tableElement, hook.suffix));
      changes.push(`Added Sub ${opts.tableElement}_${hook.suffix}`);
    }
  }

  let current = lines.join('\n');
  const missingConstants = missingConstantNames(current);
  const constLines = [...buildConstantsBlock(opts, missingConstants), ...buildDimsBlock(opts.tableElement, current)];
  if (constLines.length) {
    lines = splitLines(current);
    lines.push('', "' --- GLF constants ---", ...constLines);
    current = lines.join('\n');
    changes.push(`Added constants: ${constLines.map(l => l.split(/[\s:]+/)[1]).join(', ')}`);
  }

  const subs = findSubs(current);
  if (!subs.some(s => s.name.toLowerCase() === 'configureglfdevices')) {
    current = `${current}\n\n${buildConfigureSub().join('\n')}`;
    changes.push('Added empty Sub ConfigureGlfDevices');
  }

  return { script: current, changes };
}

/**
 * Embed the GLF framework text into a script. Option Explicit must stay the first
 * statement, so the framework is inserted right after it when present.
 */
export function injectGlfFramework(script: string, frameworkText: string): string {
  const lines = splitLines(script);
  const optIdx = lines.findIndex(l => /^\s*Option\s+Explicit\b/i.test(l));
  if (optIdx >= 0) {
    lines.splice(optIdx + 1, 0, '', frameworkText, '');
    return lines.join('\n');
  }
  return `${frameworkText}\n\n${script}`;
}

/** Table-structure prerequisites the script scaffold can't create on its own. */
export function structuralPrerequisites(status: ScaffoldStatus): string[] {
  const out: string[] = [];
  if (!status.present.collections) {
    out.push(`Create collections: ${GLF_REQUIRED_COLLECTIONS.join(', ')}`);
  }
  if (!status.present.gameTimer) {
    out.push(
      'Add a Timer part named Glf_GameTimer (Enabled, interval -1) to drive the GLF event loop, or forward an existing timer with Sub <Timer>_Timer : Glf_GameTimer_Timer : End Sub'
    );
  }
  return out;
}
