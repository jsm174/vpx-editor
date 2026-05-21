import { describe, it, expect } from 'vitest';
import {
  validateReferences,
  validateHelpers,
  validateScaffold,
  validateNoRedefinitions,
  validateFlipperSwitch,
  combineFindings,
} from './validate.js';

describe('validateReferences', () => {
  it('passes when every ref resolves to a placed part', () => {
    expect(validateReferences({ switchRefs: ['s_scoop'], coilRefs: [] }, ['s_scoop', 'Other'])).toEqual([]);
  });
  it('errors on an unresolved switch reference (the core accuracy guarantee)', () => {
    const f = validateReferences({ switchRefs: ['s_scoop'], coilRefs: [] }, ['SomethingElse']);
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('unresolved-reference');
    expect(f[0].severity).toBe('error');
  });
  it('is case-insensitive on names', () => {
    expect(validateReferences({ switchRefs: ['s_Scoop'], coilRefs: [] }, ['s_scoop'])).toEqual([]);
  });
});

describe('validateHelpers', () => {
  it('warns when a feel-layer helper is absent', () => {
    const f = validateHelpers(['SoundSaucerKick'], 'Sub Foo()\nEnd Sub');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('warning');
  });
  it('passes when the helper exists', () => {
    expect(validateHelpers(['SoundSaucerKick'], 'Sub SoundSaucerKick(a,b)\nEnd Sub')).toEqual([]);
  });
});

describe('validateScaffold', () => {
  it('warns per missing piece when not bootable', () => {
    const f = validateScaffold({
      bootable: false,
      oldFramework: false,
      externalScript: false,
      present: {
        glfLoaded: false,
        initHook: false,
        exitHook: false,
        keyDownHook: false,
        keyUpHook: false,
        constants: false,
        collections: false,
        gameTimer: true,
      },
      missingConstants: [],
      missing: ['Glf_Init hook', 'collections (glf_lights)'],
      warnings: ['Const BallSize = 25 — expects 50'],
    });
    expect(f).toHaveLength(3);
    expect(f.every(x => x.severity === 'warning')).toBe(true);
    expect(f.some(x => x.code === 'scaffold-warning' && /BallSize/.test(x.message))).toBe(true);
  });
});

describe('validateNoRedefinitions', () => {
  const table = ['Const tnob = 5', 'Dim gBOT', 'Sub Table1_Init', 'End Sub', 'Sub UpdateTrough', 'End Sub'].join('\n');

  it('errors when the injected block redefines an existing Sub or Const', () => {
    const injected = ['Sub Table1_Init', '    Glf_Init(Table1)', 'End Sub', 'Const tnob = 3'].join('\n');
    const f = validateNoRedefinitions(table, injected);
    expect(f.filter(x => x.severity === 'error').length).toBe(2);
    expect(f.every(x => x.code === 'name-redefined')).toBe(true);
  });

  it('only warns on duplicate Dims', () => {
    const f = validateNoRedefinitions(table, 'Dim gBOT');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('warning');
  });

  it('ignores Const/Dim inside sub bodies (locals cannot collide globally)', () => {
    const injected = ['Sub NewThing', '    Dim gBOT', '    Const tnob = 1', 'End Sub'].join('\n');
    expect(validateNoRedefinitions(table, injected)).toEqual([]);
  });

  it('passes non-colliding code', () => {
    expect(validateNoRedefinitions(table, 'Sub ScoopEjectCallback(ball)\nEnd Sub')).toEqual([]);
  });

  it('ignores class members (locally scoped) but flags class-name collisions', () => {
    const framework = ['Class BallSaver', '    Sub Drain(balls)', '    End Sub', 'End Class'].join('\n');
    expect(validateNoRedefinitions(framework, 'Dim Drain : Set Drain = swTrough8')).toEqual([]);
    const f = validateNoRedefinitions(framework, 'Class BallSaver\nEnd Class');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
  });
});

describe('validateFlipperSwitch', () => {
  it('accepts the switches the keyboard dispatch fires', () => {
    expect(validateFlipperSwitch('s_left_flipper')).toEqual([]);
    expect(validateFlipperSwitch('S_Right_Flipper')).toEqual([]);
    expect(validateFlipperSwitch('s_left_staged_flipper_key')).toEqual([]);
    expect(validateFlipperSwitch('s_right_staged_flipper_key')).toEqual([]);
  });
  it('warns on any other switch name', () => {
    const f = validateFlipperSwitch('s_upper_flipper');
    expect(f).toHaveLength(1);
    expect(f[0].code).toBe('flipper-switch-unbound');
    expect(f[0].severity).toBe('warning');
  });
});

describe('combineFindings', () => {
  it('refuses when any finding is an error', () => {
    const report = combineFindings(
      validateReferences({ switchRefs: ['Missing'], coilRefs: [] }, []),
      validateHelpers(['X'], '')
    );
    expect(report.refuse).toBe(true);
    expect(report.findings.length).toBe(2);
  });
  it('does not refuse on warnings alone', () => {
    const report = combineFindings(validateHelpers(['X'], ''));
    expect(report.refuse).toBe(false);
  });
});
