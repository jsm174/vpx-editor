import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadFromWorkFolder, type TableState } from '../../../../shared/table-state.js';
import { applyEditDirect } from '../../edit-handler.js';
import { prepareGlfStarterWorkDir } from './starter.js';
import { emitBallDevice, emitFlipper } from './emit.js';
import { assembleGlfScript } from './assemble.js';
import { detectGlfScaffold } from './scaffold.js';
import { stripAllComments } from '../../../../shared/vbs-analysis.js';
import {
  combineFindings,
  lintMergedScript,
  validateFlipperSwitch,
  validateHelpers,
  validateNoRedefinitions,
  validateReferences,
} from '../validate.js';

const ROOT_PREFIX = '/vpx/';
const FRAMEWORK_FILE = path.join(process.cwd(), 'resources', 'glf', 'vpx-glf.vbs');

let workDir: string;
let frameworkText: string;
let state: TableState;
let script: string;

function partNames(s: TableState): string[] {
  return s.items.map(i => i.name).filter((n): n is string => !!n);
}

function addDevice(current: string, s: TableState, emitted: ReturnType<typeof emitBallDevice>, virtualSwitch = false) {
  const names = partNames(s);
  const assembled = assembleGlfScript(current, {
    scaffoldBlock: null,
    deviceConfig: emitted.deviceConfig,
    callbacks: emitted.callbacks,
  });
  const report = combineFindings(
    virtualSwitch
      ? validateFlipperSwitch(emitted.switchRefs[0])
      : validateReferences({ switchRefs: emitted.switchRefs, coilRefs: emitted.coilRefs }, names),
    validateNoRedefinitions(current, emitted.callbacks),
    validateHelpers(emitted.helperRefs, assembled),
    lintMergedScript(emitted.config)
  );
  return { assembled, report };
}

beforeAll(async () => {
  const vpin = await import('@francisdb/vpin-wasm');
  await vpin.default({
    module_or_path: fs.readFileSync(path.join(process.cwd(), 'node_modules/@francisdb/vpin-wasm/vpin_bg.wasm')),
  });
  workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'glf-starter-build-'));
  const files = vpin.extract(
    new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'public/templates/glfTutorialPlunger.vpx')))
  );
  for (const [filePath, data] of Object.entries(files as Record<string, Uint8Array>)) {
    const relative = filePath.startsWith(ROOT_PREFIX) ? filePath.slice(ROOT_PREFIX.length) : filePath;
    const full = path.join(workDir, relative);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, data);
  }
  frameworkText = fs.readFileSync(FRAMEWORK_FILE, 'utf-8');
  await prepareGlfStarterWorkDir(workDir, { frameworkFile: FRAMEWORK_FILE, gameName: 'Homebrew' });
  const scoop = await applyEditDirect(
    { workDir },
    {
      kind: 'add-part',
      payload: { type: 'Kicker', data: { name: 's_scoop', center: { x: 400, y: 600 }, radius: 25 } },
      description: 'scoop kicker',
    }
  );
  expect(scoop.applied).toBe(true);
  state = await loadFromWorkFolder(workDir);
  script = state.script;
}, 60_000);

afterAll(async () => {
  await fs.promises.rm(workDir, { recursive: true, force: true });
});

describe('GLF starter + add_device end to end', () => {
  it('starter is bootable against the real framework and table structure', () => {
    const status = detectGlfScaffold({
      script,
      collectionNames: state.collections.map(c => c.name),
      partNames: partNames(state),
    });
    expect(status.bootable).toBe(true);
    expect(status.warnings).toEqual([]);
    expect(status.present.gameTimer).toBe(true);
  });

  it('wires an upper flipper and a scoop through the add_device pipeline with clean validation', () => {
    const flipper = emitFlipper({
      name: 'upper_left',
      flipperPart: 'LeftFlipper',
      switchName: 's_left_staged_flipper_key',
    });
    const step1 = addDevice(script, state, flipper, true);
    expect(step1.report.findings).toEqual([]);

    const scoop = emitBallDevice({ name: 'scoop', ballSwitches: ['s_scoop'], ejectTimeout: 2000 });
    const step2 = addDevice(step1.assembled, state, scoop);
    expect(step2.report.findings).toEqual([]);
    script = step2.assembled;

    expect(script).toContain('With CreateGlfFlipper("upper_left")');
    expect(script).toContain('With CreateGlfBallDevice("scoop")');
    expect(script).toContain('With CreateGlfBallDevice("plunger")');
    expect(script.match(/Sub ConfigureGlfDevices/gi)).toHaveLength(1);
  });

  it('the merged script redefines nothing the framework defines and lints clean', () => {
    const gameCode = script.slice(script.indexOf('Const cGameName'));
    expect(validateNoRedefinitions(frameworkText, gameCode)).toEqual([]);
    expect(lintMergedScript(gameCode).filter(f => f.severity === 'error')).toEqual([]);
    const status = detectGlfScaffold({
      script,
      collectionNames: state.collections.map(c => c.name),
      partNames: partNames(state),
    });
    expect(status.bootable).toBe(true);
  });

  it('every part the game code references exists in the extracted glfTutorialPlunger.vpx', () => {
    const gameCode = stripAllComments(script.slice(script.indexOf('Const cGameName')));
    const referenced = new Set<string>();
    for (const m of gameCode.matchAll(
      /\b([A-Za-z_][A-Za-z0-9_]*)\.(RotateToEnd|RotateToStart|Kick|BallCntOver|Pullback|Fire|Interval|width|height)\b/gi
    )) {
      referenced.add(m[1]);
    }
    for (const m of gameCode.matchAll(/\bSet\s+Drain\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/gi)) referenced.add(m[1]);
    for (const m of gameCode.matchAll(/^\s*Sub\s+([A-Za-z_][A-Za-z0-9_]*)_(Hit|UnHit|Timer)\b/gim))
      referenced.add(m[1]);
    for (const m of gameCode.matchAll(/\.(?:BallSwitches\s*=\s*Array\s*\(([^)]*)\))/gi)) {
      for (const sw of m[1].matchAll(/"([^"]+)"/g)) referenced.add(sw[1]);
    }
    referenced.delete('Table1');
    expect(referenced.size).toBeGreaterThan(5);
    const names = new Set(partNames(state).map(n => n.toLowerCase()));
    const missing = [...referenced].filter(n => !names.has(n.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('every glf_* collection member is a real part', () => {
    const names = new Set(partNames(state).map(n => n.toLowerCase()));
    for (const c of state.collections.filter(c => /^glf_/i.test(c.name))) {
      const missing = (c.items ?? []).filter(m => !names.has(m.toLowerCase()));
      expect(missing, c.name).toEqual([]);
    }
  });
});
