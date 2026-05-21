import { describe, it, expect } from 'vitest';
import { deriveMpfConfig, parseGlfDeviceConfigs, parseTnob, serializeMpf } from './from-table.js';
import type { TableState } from '../../../../shared/table-state.js';

interface Part {
  type: string;
  name: string;
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
}

function state(items: Part[], collections: Record<string, string[]>, script: string): TableState {
  return {
    workDir: '/tmp/t',
    gamedata: { left: 0, top: 0, right: 1000, bottom: 2000 },
    info: {},
    items: items.map(i => ({
      type: i.type,
      name: i.name,
      fileName: `${i.type}.${i.name}.json`,
      data: {
        ...(i.type === 'Wall' ? {} : { center: { x: i.x ?? 100, y: i.y ?? 100 } }),
        name: i.name,
        ...(i.data ?? {}),
      },
    })),
    materials: [],
    images: [],
    sounds: [],
    collections: Object.entries(collections).map(([name, members]) => ({
      name,
      items: members,
      fire_events: false,
      stop_single_events: false,
      group_elements: false,
    })),
    script,
  } as unknown as TableState;
}

const STARTER_SCRIPT = [
  'Const cGameName = "Starter"',
  'Const tnob = 7',
  'Dim Drain : Set Drain = swTrough8',
  'Sub ConfigureGlfDevices()',
  '    With CreateGlfFlipper("left")',
  '        .Switch = "s_left_flipper"',
  '    End With',
  '    With CreateGlfBallDevice("plunger")',
  '        .BallSwitches = Array("sw01")',
  '        .EjectTimeout = 200',
  '        .MechanicalEject = True',
  '        .DefaultDevice = True',
  '    End With',
  'End Sub',
].join('\n');

const starter = state(
  [
    { type: 'Flipper', name: 'LeftFlipper' },
    { type: 'Flipper', name: 'RightFlipper' },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ type: 'Kicker', name: `swTrough${n}`, x: 800 + n * 10, y: 1850 })),
    { type: 'Trigger', name: 'sw01', x: 900, y: 1700 },
    { type: 'Trigger', name: 'LeftInlane' },
    { type: 'Trigger', name: 'RightInlane' },
    { type: 'Gate', name: 'Gate' },
    { type: 'Wall', name: 'LeftSlingShot' },
    { type: 'Wall', name: 'RightSlingShot' },
    { type: 'Plunger', name: 'Plunger' },
    ...[1, 2, 3, 4].map(n => ({ type: 'Light', name: `gi${n}`, data: { blink_pattern: '10' } })),
    { type: 'Light', name: 'Unregistered' },
  ],
  {
    Glf_Switches: ['sw01'],
    glf_lights: ['gi1', 'gi2', 'gi3', 'gi4'],
    glf_slingshots: ['LeftSlingShot', 'RightSlingShot'],
    glf_spinners: [],
  },
  STARTER_SCRIPT
);

describe('deriveMpfConfig on a starter-shaped table', () => {
  const cfg = deriveMpfConfig(starter);
  const names = cfg.switches.map(s => s.name);

  it('lists exactly what the framework registers: glf_switches + slingshots + s_trough1..tnob + jam + start', () => {
    expect(names).toEqual([
      'sw01',
      'LeftSlingShot',
      'RightSlingShot',
      's_trough1',
      's_trough2',
      's_trough3',
      's_trough4',
      's_trough5',
      's_trough6',
      's_trough7',
      's_trough_jam',
      's_start',
    ]);
    expect(names).not.toContain('Gate');
    expect(names).not.toContain('LeftInlane');
    expect(names).not.toContain('swTrough8');
  });

  it('positions trough switches from the swTrough<n> kickers and tags start', () => {
    const t1 = cfg.switches.find(s => s.name === 's_trough1')!;
    expect(t1.x).toBeCloseTo(0.81);
    expect(cfg.switches.find(s => s.name === 's_start')!.tags).toBe('start');
  });

  it('builds bd_trough from tnob and the plunger from the CreateGlfBallDevice block', () => {
    expect(cfg.ballDevices.map(b => b.name)).toEqual(['bd_trough', 'balldevice_plunger']);
    const trough = cfg.ballDevices[0];
    expect(trough.ball_switches).toEqual([...Array.from({ length: 7 }, (_, i) => `s_trough${i + 1}`), 's_trough_jam']);
    expect(trough.jam_switch).toBe('s_trough_jam');
    expect(trough.eject_targets).toEqual(['balldevice_plunger']);
    expect(cfg.ballDevices[1]).toMatchObject({ ball_switches: ['sw01'], mechanical_eject: true });
    expect(cfg.defaultSourceDevice).toBe('balldevice_plunger');
  });

  it('emits the trough coil and one eject coil per configured ball device', () => {
    expect(cfg.coils.map(c => c.name)).toEqual(['c_trough_eject', 'c_balldevice_plunger_eject']);
  });

  it('takes lights from glf_lights only', () => {
    expect(cfg.lights.map(l => l.name)).toEqual(['gi1', 'gi2', 'gi3', 'gi4']);
    expect(cfg.lights[0].tags).toBeUndefined();
  });

  it('serializes MPF-valid YAML with the trough switches start-active', () => {
    const files = serializeMpf(cfg);
    expect(files['ball_devices.yaml']).not.toContain('default_device');
    expect(files['config.yaml']).toContain('default_source_device: balldevice_plunger');
    expect(files['config.yaml']).toContain('  - s_trough1');
    expect(files['config.yaml']).toContain('  - s_trough7');
    expect(files['config.yaml']).not.toContain('s_trough_jam\n');
  });
});

const EXAMPLE_SCRIPT = [
  'Sub ConfigureGlfDevices()',
  '    With CreateGlfBallDevice("plunger")',
  '        .BallSwitches = Array("s_Plunger1")',
  '        .MechanicalEject = True',
  '        .DefaultDevice = True',
  '    End With',
  '    With CreateGlfBallDevice("kicker1")',
  '        .BallSwitches = Array("s_Kicker1")',
  '        .EjectTimeout = 2000',
  '        .MechanicalEject = True',
  '    End With',
  '    \'With CreateGlfBallDevice("commented")',
  '    \'    .BallSwitches = Array("s_Nope")',
  "    'End With",
  '    With CreateGlfDroptarget("drop1")',
  '        .Switch = "s_DT1"',
  '        .UseRothDroptarget = True',
  '    End With',
  '    With CreateGlfStanduptarget("target1")',
  '        .Switch = "s_ST1"',
  '    End With',
  'End Sub',
].join('\n');

const example = state(
  [
    ...[1, 2, 3, 4, 5].map(n => ({ type: 'Kicker', name: `swTrough${n}` })),
    { type: 'Kicker', name: 'Drain' },
    { type: 'Trigger', name: 's_Plunger1' },
    { type: 'Kicker', name: 's_Kicker1' },
    { type: 'Trigger', name: 's_LeftInlane' },
    { type: 'Wall', name: 's_DT1' },
    { type: 'HitTarget', name: 's_ST1' },
    { type: 'Spinner', name: 's_spinner' },
    { type: 'Wall', name: 's_LeftSlingshot' },
    { type: 'Light', name: 'l_shot1', data: { blink_pattern: 'GI' } },
    { type: 'Light', name: 'l_unused' },
  ],
  {
    glf_switches: ['s_Plunger1', 's_Kicker1', 's_LeftInlane'],
    glf_slingshots: ['s_LeftSlingshot'],
    glf_spinners: ['s_spinner'],
    glf_lights: ['l_shot1'],
  },
  EXAMPLE_SCRIPT
);

describe('deriveMpfConfig on an example-shaped table', () => {
  const cfg = deriveMpfConfig(example);

  it('orders switches like the framework: glf_switches, standups, drops, spinners, slingshots, trough, jam, start', () => {
    expect(cfg.switches.map(s => s.name)).toEqual([
      's_Plunger1',
      's_Kicker1',
      's_LeftInlane',
      's_ST1',
      's_DT1',
      's_spinner',
      's_LeftSlingshot',
      's_trough1',
      's_trough2',
      's_trough3',
      's_trough4',
      's_trough5',
      's_trough_jam',
      's_start',
    ]);
  });

  it('includes a Wall-based drop target and gives it no position', () => {
    const dt = cfg.switches.find(s => s.name === 's_DT1')!;
    expect(dt.x).toBeUndefined();
  });

  it('never makes the Drain kicker a ball device and ignores commented-out configs', () => {
    expect(cfg.ballDevices.map(b => b.name)).toEqual(['bd_trough', 'balldevice_plunger', 'balldevice_kicker1']);
  });

  it('falls back to the swTrough<n> kickers when tnob is not in this script', () => {
    expect(cfg.ballDevices[0].ball_switches).toHaveLength(6);
    expect(cfg.notes.some(n => /No Const tnob/.test(n))).toBe(true);
  });

  it('takes light tags from the blink pattern the framework exports as tags', () => {
    expect(cfg.lights).toHaveLength(1);
    expect(cfg.lights[0].tags).toBe('GI');
  });
});

describe('guards', () => {
  it('skips a ball device wired onto trough/drain kickers', () => {
    const s = state(
      [
        { type: 'Kicker', name: 'swTrough1' },
        { type: 'Kicker', name: 'Drain' },
      ],
      { glf_switches: [], glf_slingshots: [], glf_spinners: [], glf_lights: [] },
      ['Const tnob = 1', 'With CreateGlfBallDevice("drain")', '    .BallSwitches = Array("Drain")', 'End With'].join(
        '\n'
      )
    );
    const cfg = deriveMpfConfig(s);
    expect(cfg.ballDevices.map(b => b.name)).toEqual(['bd_trough']);
    expect(cfg.ballDevices[0].eject_targets).toBeUndefined();
    expect(cfg.defaultSourceDevice).toBe('bd_trough');
    expect(cfg.notes.some(n => /already owns/.test(n))).toBe(true);
  });

  it('notes a ball-device switch missing from glf_switches or from the parts', () => {
    const s = state(
      [{ type: 'Kicker', name: 'swTrough1' }],
      { glf_switches: [], glf_slingshots: [], glf_spinners: [], glf_lights: [] },
      ['Const tnob = 1', 'With CreateGlfBallDevice("scoop")', '    .BallSwitches = Array("s_scoop")', 'End With'].join(
        '\n'
      )
    );
    const cfg = deriveMpfConfig(s);
    expect(cfg.notes.some(n => /no part has that name/.test(n))).toBe(true);
    expect(cfg.notes.some(n => /not in glf_switches/.test(n))).toBe(true);
  });
});

describe('script parsing', () => {
  it('reads tnob from a Const and ignores a commented one', () => {
    expect(parseTnob("'Const tnob = 9\nConst tnob = 3 ' balls")).toBe(3);
    expect(parseTnob('')).toBeNull();
  });

  it('parses device blocks', () => {
    const d = parseGlfDeviceConfigs(EXAMPLE_SCRIPT);
    expect(d.map(x => `${x.kind}:${x.name}`)).toEqual([
      'BallDevice:plunger',
      'BallDevice:kicker1',
      'Droptarget:drop1',
      'Standuptarget:target1',
    ]);
    expect(d[0]).toMatchObject({ ballSwitches: ['s_Plunger1'], mechanicalEject: true, defaultDevice: true });
    expect(d[2].switch).toBe('s_DT1');
  });
});
