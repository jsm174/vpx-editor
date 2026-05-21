import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildGlfStarterScript, glfStarterCollections, prepareGlfStarterWorkDir, GLF_STARTER_TNOB } from './starter.js';
import { detectGlfScaffold, GLF_REQUIRED_COLLECTIONS } from './scaffold.js';
import { validateNoRedefinitions } from '../validate.js';

const FRAMEWORK_STUB = [
  "'VPX Game Logic Framework",
  'Public Sub Glf_Init(ByRef table)',
  'End Sub',
  'Public Sub Glf_GameTimer_Timer()',
  'End Sub',
  'Sub swTrough1_Hit',
  'End Sub',
  'Sub Drain_Hit',
  'End Sub',
  'Sub Drain_UnHit',
  'End Sub',
  'Function CreateGlfBallDevice(name)',
  'End Function',
  'Function CreateGlfFlipper(name)',
  'End Function',
].join('\n');

describe('buildGlfStarterScript', () => {
  const script = buildGlfStarterScript({ frameworkText: FRAMEWORK_STUB, gameName: 'MyTable' });

  it('embeds the framework before the game code', () => {
    expect(script.indexOf('CreateGlfBallDevice(name)')).toBeLessThan(script.indexOf('Const cGameName'));
  });

  it('detects as fully bootable with the required collections', () => {
    const status = detectGlfScaffold({ script, collectionNames: [...GLF_REQUIRED_COLLECTIONS] });
    expect(status.bootable).toBe(true);
    expect(status.present.glfLoaded).toBe(true);
  });

  it('satisfies the framework trough convention (tnob within the swTrough1..7 chain, Drain aliased)', () => {
    expect(GLF_STARTER_TNOB).toBeLessThanOrEqual(7);
    expect(script).toContain(`Const tnob = ${GLF_STARTER_TNOB}`);
    expect(script).toContain('Set Drain = swTrough8');
    expect(script).toContain('Sub swTrough8_Hit : Drain_Hit : End Sub');
    expect(script).toContain('Sub swTrough8_UnHit : Drain_UnHit : End Sub');
  });

  it('bridges the template timer to the framework event loop at interval -1', () => {
    expect(script).toContain('Sub Glf_EventTimer_Timer : Glf_GameTimer_Timer : End Sub');
    expect(script).toContain('Glf_EventTimer.Interval = -1');
  });

  it('wires both flippers to the switches the keyboard dispatch fires', () => {
    expect(script).toContain('With CreateGlfFlipper("left")');
    expect(script).toContain('.Switch = "s_left_flipper"');
    expect(script).toContain('.Switch = "s_right_flipper"');
    expect(script).toContain('LeftFlipper.RotateToEnd');
    expect(script).toContain('RightFlipper.RotateToEnd');
  });

  it('wires the plunger as a mechanical-eject default device on sw01, with plunger keys', () => {
    expect(script).toContain('With CreateGlfBallDevice("plunger")');
    expect(script).toContain('.BallSwitches = Array("sw01")');
    expect(script).toContain('.MechanicalEject = True');
    expect(script).toContain('.DefaultDevice = True');
    expect(script).toContain('If keycode = PlungerKey Then Plunger.Pullback');
    expect(script).toContain('If keycode = PlungerKey Then Plunger.Fire');
  });

  it('defines nothing the framework already defines', () => {
    const gameCode = script.slice(script.indexOf('Const cGameName'));
    const collisions = validateNoRedefinitions(FRAMEWORK_STUB, gameCode).filter(f => f.severity === 'error');
    expect(collisions).toEqual([]);
  });
});

describe('buildGlfStarterScript against the real bundled framework', () => {
  it('collides with nothing the shipped vpx-glf.vbs defines', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const real = fs.readFileSync(path.join(process.cwd(), 'resources', 'glf', 'vpx-glf.vbs'), 'utf-8');
    const script = buildGlfStarterScript({ frameworkText: real, gameName: 'MyTable' });
    const gameCode = script.slice(script.indexOf('Const cGameName'));
    const collisions = validateNoRedefinitions(real, gameCode).filter(f => f.severity === 'error');
    expect(collisions).toEqual([]);
    const status = detectGlfScaffold({ script, collectionNames: [...GLF_REQUIRED_COLLECTIONS] });
    expect(status.bootable).toBe(true);
  });
});

describe('glfStarterCollections', () => {
  it('adds the missing glf_* collections and keeps existing ones', () => {
    const existing = [
      { name: 'GI', items: ['gi1'], fire_events: false, stop_single_events: false, group_elements: true },
      { name: 'Glf_Switches', items: ['sw01'], fire_events: false, stop_single_events: false, group_elements: false },
    ];
    const out = glfStarterCollections(existing);
    const names = out.map(c => c.name.toLowerCase());
    for (const required of GLF_REQUIRED_COLLECTIONS) expect(names).toContain(required);
    expect(out.filter(c => c.name.toLowerCase() === 'glf_switches')).toHaveLength(1);
    expect(out.find(c => c.name === 'Glf_Switches')?.items).toEqual(['sw01']);
    expect(out.find(c => c.name === 'glf_lights')?.items).toEqual(['gi1', 'gi2', 'gi3', 'gi4']);
    expect(out.find(c => c.name === 'glf_slingshots')?.items).toEqual(['LeftSlingShot', 'RightSlingShot']);
  });
});

describe('slingshots', () => {
  it('leaves the <wall>_Slingshot handlers to the framework (glf_slingshots members get them generated)', () => {
    const script = buildGlfStarterScript({ frameworkText: FRAMEWORK_STUB, gameName: 'MyTable' });
    expect(script).not.toMatch(/Sub\s+(Left|Right)SlingShot_Slingshot/i);
  });
});

describe('prepareGlfStarterWorkDir', () => {
  it('writes script.vbs and collections.json into the work folder', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glf-starter-'));
    const frameworkFile = path.join(workDir, 'fw.vbs');
    fs.writeFileSync(frameworkFile, FRAMEWORK_STUB);
    fs.writeFileSync(
      path.join(workDir, 'collections.json'),
      JSON.stringify([
        { name: 'GI', items: ['gi1'], fire_events: false, stop_single_events: false, group_elements: true },
      ])
    );
    try {
      await prepareGlfStarterWorkDir(workDir, { frameworkFile, gameName: 'My Table!' });
      const script = fs.readFileSync(path.join(workDir, 'script.vbs'), 'utf-8');
      expect(script).toContain('Const cGameName = "MyTable"');
      expect(script).toContain('CreateGlfBallDevice(name)');
      const collections = JSON.parse(fs.readFileSync(path.join(workDir, 'collections.json'), 'utf-8')) as {
        name: string;
        items: string[];
      }[];
      expect(collections.map(c => c.name)).toContain('GI');
      for (const required of GLF_REQUIRED_COLLECTIONS) expect(collections.map(c => c.name)).toContain(required);
      expect(collections.find(c => c.name === 'glf_slingshots')?.items).toEqual(['LeftSlingShot', 'RightSlingShot']);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('defaults the game name to the work folder basename', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'glf-starter-'));
    const workDir = path.join(parent, 'Homebrew');
    fs.mkdirSync(workDir);
    const frameworkFile = path.join(parent, 'fw.vbs');
    fs.writeFileSync(frameworkFile, FRAMEWORK_STUB);
    try {
      await prepareGlfStarterWorkDir(workDir, { frameworkFile });
      expect(fs.readFileSync(path.join(workDir, 'script.vbs'), 'utf-8')).toContain('Const cGameName = "Homebrew"');
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
});
