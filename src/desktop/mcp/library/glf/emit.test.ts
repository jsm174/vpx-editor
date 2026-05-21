import { describe, it, expect } from 'vitest';
import { emitBallDevice, ejectCallbackName } from './emit.js';

describe('ejectCallbackName', () => {
  it('PascalCases and suffixes', () => {
    expect(ejectCallbackName('scoop')).toBe('ScoopEjectCallback');
    expect(ejectCallbackName('left scoop')).toBe('LeftScoopEjectCallback');
  });
});

describe('emitBallDevice', () => {
  const out = emitBallDevice({
    name: 'scoop',
    ballSwitches: ['s_scoop'],
    ejectTimeout: 2000,
    kickAngle: 14.8,
    kickForce: 70,
  });

  it('uses the documented GLF API', () => {
    expect(out.config).toContain('With CreateGlfBallDevice("scoop")');
    expect(out.config).toContain('.BallSwitches = Array("s_scoop")');
    expect(out.config).toContain('.EjectCallback = "ScoopEjectCallback"');
  });

  it('uses the correct EjectTimeout property (not the doc typo)', () => {
    expect(out.config).toContain('.EjectTimeout = 2000');
    expect(out.config).not.toContain('EjectTimemout');
  });

  it('emits an eject callback that kicks the ball', () => {
    expect(out.config).toContain('Sub ScoopEjectCallback(ball)');
    expect(out.config).toContain('s_scoop.BallCntOver > 0');
    expect(out.config).toContain('s_scoop.Kick 14.8, 70');
    expect(out.config).not.toContain('KickBall');
  });

  it('omits the eject callback for mechanical-eject devices', () => {
    const plunger = emitBallDevice({
      name: 'plunger',
      ballSwitches: ['sw01'],
      mechanicalEject: true,
      defaultDevice: true,
    });
    expect(plunger.config).toContain('.MechanicalEject = True');
    expect(plunger.config).not.toContain('EjectCallback');
    expect(plunger.definedSubs).toEqual([]);
    expect(plunger.callbacks).toBe('');
  });

  it('reports the switch refs and defined subs for validation', () => {
    expect(out.switchRefs).toEqual(['s_scoop']);
    expect(out.definedSubs).toEqual(['ScoopEjectCallback']);
  });

  it('stays portable by default (no feel-layer helper deps)', () => {
    expect(out.helperRefs).toEqual([]);
    expect(out.config).not.toContain('SoundSaucerKick');
  });

  it('falls back to a derived switch name when none given', () => {
    const o = emitBallDevice({ name: 'vuk', ballSwitches: [] });
    expect(o.switchRefs).toEqual(['s_vuk']);
    expect(o.config).toContain('.BallSwitches = Array("s_vuk")');
  });

  describe('feel-layer flavor (matches the GLF example table idiom)', () => {
    const rich = emitBallDevice({
      name: 'kicker1',
      ballSwitches: ['s_Kicker1'],
      ejectTimeout: 2000,
      feelLayer: true,
    });

    it('emits sound + tolerance + failed-kick branch', () => {
      expect(rich.config).toContain('SoundSaucerKick 1, s_Kicker1');
      expect(rich.config).toContain('SoundSaucerKick 0, s_Kicker1');
      expect(rich.config).toContain('KickerAngleTol*2*(rnd-0.5)');
    });

    it('declares the shared feel-layer helpers the example table uses', () => {
      expect(rich.helperRefs).toContain('SoundSaucerKick');
      expect(rich.helperRefs).toContain('KickerAngleTol');
      expect(rich.helperRefs).toContain('KickerStrengthTol');
    });
  });

  describe('plunger-style options (matches the example table plunger device)', () => {
    const plunger = emitBallDevice({
      name: 'plunger',
      ballSwitches: ['sw01'],
      ejectTimeout: 200,
      mechanicalEject: true,
      defaultDevice: true,
    });

    it('emits MechanicalEject and DefaultDevice', () => {
      expect(plunger.config).toContain('.MechanicalEject = True');
      expect(plunger.config).toContain('.DefaultDevice = True');
    });

    it('omits them by default', () => {
      expect(out.config).not.toContain('MechanicalEject');
      expect(out.config).not.toContain('DefaultDevice');
    });

    it('emits EjectAllEvents when given', () => {
      const lock = emitBallDevice({ name: 'lock', ballSwitches: ['s_lock1'], ejectAllEvents: ['multiball_start'] });
      expect(lock.config).toContain('.EjectAllEvents = Array("multiball_start")');
    });
  });
});
