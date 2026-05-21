import { describe, it, expect } from 'vitest';
import {
  detectGlfScaffold,
  mergeGlfScaffold,
  injectGlfFramework,
  structuralPrerequisites,
  GLF_REQUIRED_COLLECTIONS,
} from './scaffold.js';

const FRAMEWORK_STUB = [
  "'VPX Game Logic Framework",
  'Public Sub Glf_Init(ByRef table)',
  'End Sub',
  'Function CreateGlfBallDevice(name)',
  'End Function',
].join('\n');

describe('detectGlfScaffold', () => {
  it('reports an empty table as not bootable, listing what is missing', () => {
    const status = detectGlfScaffold({ script: '', collectionNames: [] });
    expect(status.bootable).toBe(false);
    expect(status.missing.some(m => /Glf_Init/.test(m))).toBe(true);
    expect(status.missing.some(m => /collections/.test(m))).toBe(true);
    expect(status.missing.some(m => /constants/.test(m))).toBe(true);
  });
});

describe('detectGlfScaffold framework detection', () => {
  it('does not self-satisfy from Glf_Init call sites — only definitions count', () => {
    const callsOnly = ['Sub Table1_Init', '    Glf_Init(Table1)', 'End Sub'].join('\n');
    const status = detectGlfScaffold({ script: callsOnly, collectionNames: [] });
    expect(status.present.glfLoaded).toBe(false);
    expect(status.present.initHook).toBe(true);
  });

  it('flags the legacy framework (Glf_Init definition without CreateGlf*) as oldFramework, not loaded', () => {
    const oldFw = ['Public Sub Glf_Init()', 'End Sub', 'Sub Table1_Init', '    Glf_Init()', 'End Sub'].join('\n');
    const status = detectGlfScaffold({ script: oldFw, collectionNames: [] });
    expect(status.oldFramework).toBe(true);
    expect(status.present.glfLoaded).toBe(false);
    expect(status.bootable).toBe(false);
    expect(status.missing.some(m => /legacy/i.test(m))).toBe(true);
  });

  it('does not flag the modern framework as oldFramework', () => {
    const status = detectGlfScaffold({ script: FRAMEWORK_STUB, collectionNames: [] });
    expect(status.oldFramework).toBe(false);
  });

  it('detects the embedded framework by its definitions', () => {
    const status = detectGlfScaffold({ script: FRAMEWORK_STUB, collectionNames: [] });
    expect(status.present.glfLoaded).toBe(true);
    expect(status.present.initHook).toBe(false);
  });

  it('lists individually missing constants', () => {
    const status = detectGlfScaffold({ script: 'Const cGameName = "X"\nConst tnob = 5', collectionNames: [] });
    expect(status.missingConstants).toEqual(['BallSize', 'BallMass', 'lob']);
  });
});

describe('mergeGlfScaffold', () => {
  const existing = [
    'Const cGameName = "Test"',
    'Const BallSize = 50',
    'Const BallMass = 1',
    'Const tnob = 5',
    'Sub Table1_Init()',
    '    LoadSomething',
    'End Sub',
    'Sub Table1_KeyDown(ByVal keycode)',
    '    If keycode = PlungerKey Then Plunger.Pullback',
    'End Sub',
  ].join('\n');

  const merged = mergeGlfScaffold(existing, { tableElement: 'Table1', gameName: 'Test' });

  it('inserts Glf calls into existing hooks instead of redefining them', () => {
    expect(merged.script.match(/Sub Table1_Init/gi)).toHaveLength(1);
    expect(merged.script.match(/Sub Table1_KeyDown/gi)).toHaveLength(1);
    expect(merged.script).toContain('Glf_Init(Table1)');
    expect(merged.script).toContain('Glf_KeyDown(keycode)');
    expect(merged.script).toContain('LoadSomething');
    expect(merged.script).toContain('Plunger.Pullback');
  });

  it('emits only the missing constants', () => {
    expect(merged.script.match(/Const tnob/gi)).toHaveLength(1);
    expect(merged.script.match(/Const cGameName/gi)).toHaveLength(1);
    expect(merged.script).toContain('Const lob = 0');
  });

  it('adds the hooks the script lacks', () => {
    expect(merged.script).toContain('Sub Table1_Exit');
    expect(merged.script).toContain('Glf_Exit()');
    expect(merged.script).toContain('Sub Table1_KeyUp(ByVal keycode)');
  });

  it('adds ConfigureGlfDevices and calls it from the init hook', () => {
    expect(merged.script).toContain('Sub ConfigureGlfDevices()');
    expect(merged.script).toContain('ConfigureGlfDevices()');
  });

  it('handles one-line hook subs', () => {
    const oneLiner = 'Sub Table1_KeyDown(ByVal kc) : Beep : End Sub';
    const out = mergeGlfScaffold(oneLiner, { tableElement: 'Table1', gameName: 'X' });
    expect(out.script).toContain('Beep : Glf_KeyDown(kc) : End Sub');
  });

  it('the merged result detects as fully hooked', () => {
    const status = detectGlfScaffold({
      script: `${FRAMEWORK_STUB}\n${merged.script}`,
      collectionNames: [...GLF_REQUIRED_COLLECTIONS],
    });
    expect(status.bootable).toBe(true);
  });

  it('is idempotent — merging an already-merged script changes nothing', () => {
    const again = mergeGlfScaffold(merged.script, { tableElement: 'Table1', gameName: 'Test' });
    expect(again.changes).toEqual([]);
    expect(again.script).toBe(merged.script);
  });
});

describe('injectGlfFramework', () => {
  it('prepends the framework to a plain script', () => {
    const out = injectGlfFramework('Sub Table1_Init\nEnd Sub', FRAMEWORK_STUB);
    expect(out.indexOf('Glf_Init(ByRef table)')).toBeLessThan(out.indexOf('Sub Table1_Init\n'));
  });

  it('keeps Option Explicit as the first statement', () => {
    const out = injectGlfFramework('Option Explicit\nSub Table1_Init\nEnd Sub', FRAMEWORK_STUB);
    expect(out.split('\n')[0]).toBe('Option Explicit');
    expect(out).toContain('CreateGlfBallDevice');
  });
});

describe('structuralPrerequisites', () => {
  it('flags missing collections and the game timer', () => {
    const status = detectGlfScaffold({ script: '', collectionNames: [], partNames: [] });
    const prereqs = structuralPrerequisites(status);
    expect(prereqs.some(p => /glf_lights/.test(p))).toBe(true);
    expect(prereqs.some(p => /Glf_GameTimer/.test(p))).toBe(true);
  });

  it('accepts a Glf_GameTimer part', () => {
    const status = detectGlfScaffold({ script: '', collectionNames: [], partNames: ['Glf_GameTimer'] });
    expect(status.present.gameTimer).toBe(true);
    expect(structuralPrerequisites(status).some(p => /Glf_GameTimer/.test(p))).toBe(false);
  });

  it('accepts a forwarding *_Timer Sub instead of the part', () => {
    const script = 'Sub Glf_EventTimer_Timer : Glf_GameTimer_Timer : End Sub';
    const status = detectGlfScaffold({ script, collectionNames: [], partNames: ['Glf_EventTimer'] });
    expect(status.present.gameTimer).toBe(true);
  });

  it('does not judge the timer when part names are unknown', () => {
    const status = detectGlfScaffold({ script: '', collectionNames: [] });
    expect(status.present.gameTimer).toBe(true);
  });
});

describe('hook matching is exact', () => {
  const blankStarter = [
    'Option Explicit',
    '\'Const cGameName = ""',
    'Const BallSize = 25',
    'Sub Plunger_Init',
    '    Plunger.PullBack',
    'End Sub',
    'Sub Table1_KeyDown(ByVal keycode)',
    'End Sub',
  ].join('\n');

  it('does not treat Plunger_Init as the table init hook', () => {
    const merged = mergeGlfScaffold(blankStarter, { tableElement: 'Table1', gameName: 'Blank' });
    expect(merged.script).not.toContain('Glf_Init(Plunger)');
    expect(merged.script).toContain('Glf_Init(Table1)');
    expect(merged.script.match(/Sub Table1_Init/gi)).toHaveLength(1);
    expect(merged.script.match(/Sub Plunger_Init/gi)).toHaveLength(1);
    expect(merged.script).toContain('Glf_KeyDown(keycode)');
  });

  it('ignores a Sub whose name only ends in _Init when detecting', () => {
    const script = ['Sub Plunger_Init', '    Glf_Init(Plunger)', 'End Sub'].join('\n');
    const status = detectGlfScaffold({ script, collectionNames: [] });
    expect(status.present.initHook).toBe(false);
  });

  it('honours a non-default table element but warns that the framework hardcodes Table1', () => {
    const script = ['Sub MyTable_Init', '    Glf_Init(MyTable)', 'End Sub'].join('\n');
    const status = detectGlfScaffold({ script, collectionNames: [], tableElement: 'MyTable' });
    expect(status.present.initHook).toBe(true);
    expect(status.warnings.some(w => /Table1/.test(w))).toBe(true);
  });
});

describe('comment-aware detection', () => {
  const blankStarter = [
    'Option Explicit',
    '\'Const cGameName = ""',
    "Const BallSize = 25  'Ball radius",
    'Const BallMass = 1',
    'Sub Table1_Init',
    "    'Glf_Init(Table1)",
    'End Sub',
  ].join('\n');

  it('treats a commented-out Const as missing and emits it', () => {
    const status = detectGlfScaffold({ script: blankStarter, collectionNames: [] });
    expect(status.missingConstants).toContain('cGameName');
    expect(status.present.initHook).toBe(false);
    const merged = mergeGlfScaffold(blankStarter, { tableElement: 'Table1', gameName: 'Blank' });
    expect(merged.script).toContain('Const cGameName = "Blank"');
    expect(merged.script.match(/^Const BallSize/gm)).toHaveLength(1);
  });

  it('warns when BallSize or BallMass are not the values the framework expects', () => {
    const status = detectGlfScaffold({ script: blankStarter, collectionNames: [] });
    expect(status.warnings.some(w => /BallSize = 25/.test(w))).toBe(true);
    expect(status.warnings.some(w => /^Const BallMass/.test(w))).toBe(false);
    const ok = detectGlfScaffold({ script: 'Const BallSize = 50\nConst BallMass = 1', collectionNames: [] });
    expect(ok.warnings).toEqual([]);
  });
});

describe('Include-based projects', () => {
  const exampleStub = [
    'Include("scripts\\dest\\vpx\\tablescript.vbs")',
    '',
    'Sub Include (strFile)',
    "\t'Create objects for opening text file",
    '\tSet objFSO = CreateObject("Scripting.FileSystemObject")',
    '\tSet objTextFile = objFSO.OpenTextFile(strFile, 1)',
    '',
    "\t'Execute content of file.",
    '\tExecuteGlobal objTextFile.ReadAll',
    '',
    "\t'CLose file",
    '\tobjTextFile.Close',
    '',
    "\t'Clean up",
    '\tSet objFSO = Nothing',
    '\tSet objTextFile = Nothing',
    'End Sub',
  ].join('\n');

  it('flags the official vpx-example-glf script.vbs stub as an external tablescript', () => {
    const status = detectGlfScaffold({ script: exampleStub, collectionNames: [...GLF_REQUIRED_COLLECTIONS] });
    expect(status.present.glfLoaded).toBe(true);
    expect(status.externalScript).toBe(true);
    expect(status.present.initHook).toBe(false);
  });

  it('does not flag an embedded framework as external', () => {
    const status = detectGlfScaffold({ script: FRAMEWORK_STUB, collectionNames: [] });
    expect(status.externalScript).toBe(false);
  });
});
