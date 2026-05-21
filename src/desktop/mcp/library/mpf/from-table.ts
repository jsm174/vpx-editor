// Derives a Mission Pinball Framework (MPF) machine config from a VPX/GLF table the
// way the framework's own exporter does (vpx-glf.vbs GLFMPF_EXPORT): switches come
// from the glf_switches/glf_slingshots/glf_spinners collections plus the drop/standup
// target configs, the trough is s_trough1..tnob + s_trough_jam, lights come from
// glf_lights, and ball devices from the CreateGlfBallDevice blocks. Same names as
// darkchaos/glf_mpf/config, so the design drives VPX and real hardware alike.
import { getPlayfieldBounds, type GameItem, type TableState } from '../../../../shared/table-state.js';
import { findConstants } from '../../../../shared/vbs-analysis.js';
import { stripAllComments } from '../../../../shared/vbs-analysis.js';

export interface MpfSwitch {
  name: string;
  number: number;
  tags?: string;
  x?: number;
  y?: number;
}
export interface MpfCoil {
  name: string;
  number: number;
}
export interface MpfLight {
  name: string;
  number: number;
  tags?: string;
  x?: number;
  y?: number;
}
export interface MpfBallDevice {
  name: string;
  ball_switches: string[];
  eject_coil?: string;
  mechanical_eject?: boolean;
  jam_switch?: string;
  eject_targets?: string[];
  tags?: string;
}
export interface MpfConfig {
  switches: MpfSwitch[];
  coils: MpfCoil[];
  lights: MpfLight[];
  ballDevices: MpfBallDevice[];
  defaultSourceDevice?: string;
  notes: string[];
}

function getCenter(item: GameItem): { x: number; y: number } | null {
  const d = item.data;
  const c = d.center as { x?: number; y?: number } | undefined;
  if (c && typeof c.x === 'number' && typeof c.y === 'number') return { x: c.x, y: c.y };
  const p = d.position as { x?: number; y?: number } | undefined;
  if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  if (typeof d.x === 'number' && typeof d.y === 'number') return { x: d.x as number, y: d.y as number };
  return null;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function collectionMembers(state: TableState, name: string): string[] | null {
  const c = (state.collections ?? []).find(c => c.name.toLowerCase() === name.toLowerCase());
  return c ? [...(c.items ?? [])] : null;
}

export interface GlfDeviceConfig {
  kind: 'BallDevice' | 'Droptarget' | 'Standuptarget';
  name: string;
  ballSwitches: string[];
  switch: string | null;
  mechanicalEject: boolean;
  defaultDevice: boolean;
}

const WITH_BLOCK = /With\s+CreateGlf(BallDevice|Droptarget|Standuptarget)\s*\(\s*"([^"]+)"\s*\)([\s\S]*?)End\s+With/gi;

export function parseGlfDeviceConfigs(script: string): GlfDeviceConfig[] {
  const out: GlfDeviceConfig[] = [];
  for (const m of stripAllComments(script).matchAll(WITH_BLOCK)) {
    const body = m[3];
    const switches = /\.BallSwitches\s*=\s*Array\s*\(([^)]*)\)/i.exec(body);
    const sw = /\.Switch\s*=\s*"([^"]+)"/i.exec(body);
    out.push({
      kind: m[1] as GlfDeviceConfig['kind'],
      name: m[2],
      ballSwitches: switches ? [...switches[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [],
      switch: sw ? sw[1] : null,
      mechanicalEject: /\.MechanicalEject\s*=\s*True/i.test(body),
      defaultDevice: /\.DefaultDevice\s*=\s*True/i.test(body),
    });
  }
  return out;
}

export function parseTnob(script: string): number | null {
  const c = findConstants(script).find(c => c.name.toLowerCase() === 'tnob');
  if (!c) return null;
  const n = parseInt(c.value, 10);
  return Number.isFinite(n) ? n : null;
}

export const MAX_TROUGH_CHAIN = 7;
const TROUGH_KICKER = /^swTrough(\d+)$/i;

export function deriveMpfConfig(state: TableState): MpfConfig {
  const bounds = getPlayfieldBounds(state);
  const w = bounds.width || 1;
  const h = bounds.height || 1;
  const norm = (c: { x: number; y: number }) => ({
    x: round((c.x - bounds.left) / w),
    y: round((c.y - bounds.top) / h),
  });
  const notes: string[] = [];
  const byName = new Map<string, GameItem>();
  for (const item of state.items) if (item.name) byName.set(item.name.toLowerCase(), item);
  const positioned = <T extends { x?: number; y?: number }>(entry: T, partName: string): T => {
    const item = byName.get(partName.toLowerCase());
    const center = item ? getCenter(item) : null;
    if (!item) notes.push(`"${partName}" is listed for GLF but no part has that name.`);
    if (center) {
      const n = norm(center);
      entry.x = n.x;
      entry.y = n.y;
    }
    return entry;
  };

  const devices = parseGlfDeviceConfigs(state.script);
  const glfSwitches = collectionMembers(state, 'glf_switches');
  const glfSlingshots = collectionMembers(state, 'glf_slingshots');
  const glfSpinners = collectionMembers(state, 'glf_spinners');
  const glfLights = collectionMembers(state, 'glf_lights');
  for (const [name, members] of [
    ['glf_switches', glfSwitches],
    ['glf_slingshots', glfSlingshots],
    ['glf_spinners', glfSpinners],
    ['glf_lights', glfLights],
  ] as const) {
    if (!members) notes.push(`No ${name} collection — GLF registers nothing from it.`);
  }

  const switches: MpfSwitch[] = [];
  const seen = new Set<string>();
  let sNum = 0;
  const addSwitch = (name: string, opts: { position?: string; tags?: string } = {}) => {
    if (seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const sw: MpfSwitch = { name, number: sNum++ };
    if (opts.tags) sw.tags = opts.tags;
    switches.push(opts.position ? positioned(sw, opts.position) : sw);
  };
  for (const name of glfSwitches ?? []) addSwitch(name, { position: name });
  for (const d of devices) {
    if (d.kind === 'Standuptarget' && d.switch) addSwitch(d.switch, { position: d.switch });
  }
  for (const d of devices) {
    if (d.kind === 'Droptarget' && d.switch) addSwitch(d.switch, { position: d.switch });
  }
  for (const name of glfSpinners ?? []) addSwitch(name, { position: name });
  for (const name of glfSlingshots ?? []) addSwitch(name);

  const troughKickers = state.items.filter(i => i.type === 'Kicker' && TROUGH_KICKER.test(i.name ?? ''));
  let tnob = parseTnob(state.script);
  if (tnob === null) {
    tnob = Math.min(troughKickers.length, MAX_TROUGH_CHAIN);
    notes.push(
      `No Const tnob in the script; trough size taken from the swTrough<n> kickers (${tnob}). The framework reads tnob.`
    );
  }
  if (tnob > MAX_TROUGH_CHAIN) {
    notes.push(
      `Const tnob = ${tnob} exceeds the framework's swTrough1..${MAX_TROUGH_CHAIN} chain (ball ${MAX_TROUGH_CHAIN + 1} is created in the part named Drain).`
    );
  }
  const troughSwitches: string[] = [];
  for (let n = 1; n <= tnob; n++) {
    const name = `s_trough${n}`;
    troughSwitches.push(name);
    const kicker = byName.get(`swtrough${n}`);
    if (!kicker) {
      notes.push(
        `tnob = ${tnob} but no Kicker named swTrough${n} — the framework creates ball ${n} there at Glf_Init.`
      );
      addSwitch(name);
    } else {
      addSwitch(name, { position: kicker.name });
    }
  }
  addSwitch('s_trough_jam');
  addSwitch('s_start', { tags: 'start' });

  const coils: MpfCoil[] = [{ name: 'c_trough_eject', number: 0 }];
  let cNum = 1;
  const ballDevices: MpfBallDevice[] = [];

  const troughHandled = (sw: string) => /^(swTrough\d+|Drain)$/i.test(sw);
  for (const d of devices) {
    if (d.kind !== 'BallDevice') continue;
    const name = `balldevice_${d.name}`;
    const clashing = d.ballSwitches.filter(troughHandled);
    if (clashing.length) {
      notes.push(
        `CreateGlfBallDevice("${d.name}") uses ${clashing.join(', ')} — the framework already owns those as the trough/drain; skipped as a ball device.`
      );
      continue;
    }
    for (const sw of d.ballSwitches) {
      if (!byName.has(sw.toLowerCase()))
        notes.push(`Ball device "${d.name}" references "${sw}" but no part has that name.`);
      if (glfSwitches && !glfSwitches.some(m => m.toLowerCase() === sw.toLowerCase())) {
        notes.push(`Ball device "${d.name}" switch "${sw}" is not in glf_switches — GLF never sees it.`);
      }
    }
    ballDevices.push({ name, ball_switches: [...d.ballSwitches], mechanical_eject: d.mechanicalEject });
    coils.push({ name: `c_${name}_eject`, number: cNum++ });
  }

  const hasPlunger = ballDevices.some(b => b.name === 'balldevice_plunger');
  if (!hasPlunger) {
    notes.push('No CreateGlfBallDevice("plunger") — bd_trough ejects to the playfield instead of balldevice_plunger.');
  }
  ballDevices.unshift({
    name: 'bd_trough',
    ball_switches: [...troughSwitches, 's_trough_jam'],
    eject_coil: 'c_trough_eject',
    tags: 'trough, home, drain',
    jam_switch: 's_trough_jam',
    ...(hasPlunger ? { eject_targets: ['balldevice_plunger'] } : {}),
  });

  const lights: MpfLight[] = [];
  let lNum = 0;
  for (const name of glfLights ?? []) {
    const item = byName.get(name.toLowerCase());
    const light: MpfLight = { name, number: lNum++ };
    const pattern = item?.data.blink_pattern;
    if (typeof pattern === 'string' && pattern && !/^[01]+$/.test(pattern)) light.tags = pattern;
    lights.push(positioned(light, name));
  }

  const defaultFromConfig = devices.find(d => d.kind === 'BallDevice' && d.defaultDevice);
  const defaultSourceDevice = defaultFromConfig
    ? `balldevice_${defaultFromConfig.name}`
    : ballDevices.some(b => b.name === 'balldevice_plunger')
      ? 'balldevice_plunger'
      : 'bd_trough';
  if (!defaultFromConfig && defaultSourceDevice === 'bd_trough') {
    notes.push('No CreateGlfBallDevice with .DefaultDevice = True — default_source_device falls back to bd_trough.');
  }
  if (!devices.some(d => d.kind === 'BallDevice')) {
    notes.push('No CreateGlfBallDevice blocks in the script (no plunger lane, scoops, or locks).');
  }

  return { switches, coils, lights, ballDevices, defaultSourceDevice, notes };
}

// ---------------------------------------------------------------------------
// Serialization to the MPF YAML files (config_version=6), darkchaos layout.
// ---------------------------------------------------------------------------

const HEADER = '#config_version=6';

function emitSwitches(cfg: MpfConfig): string {
  if (!cfg.switches.length) return `${HEADER}\nswitches:\n`;
  const lines = [HEADER, '', 'switches:'];
  for (const s of cfg.switches) {
    lines.push(`  ${s.name}:`);
    lines.push(`    number: ${s.number}`);
    if (s.tags) lines.push(`    tags: ${s.tags}`);
    if (s.x !== undefined) lines.push(`    x: ${s.x}`);
    if (s.y !== undefined) lines.push(`    y: ${s.y}`);
  }
  return lines.join('\n') + '\n';
}

function emitCoils(cfg: MpfConfig): string {
  const lines = [HEADER, '', 'coils:'];
  for (const c of cfg.coils) {
    lines.push(`  ${c.name}:`);
    lines.push(`    number: ${c.number}`);
  }
  return lines.join('\n') + '\n';
}

function emitLights(cfg: MpfConfig): string {
  const lines = [HEADER, '', 'lights:'];
  for (const l of cfg.lights) {
    lines.push(`  ${l.name}:`);
    lines.push(`    number: ${l.number}`);
    lines.push(`    subtype: led`);
    lines.push(`    type: rgb`);
    lines.push(`    size: 0.04`);
    if (l.tags) lines.push(`    tags: ${l.tags}`);
    if (l.x !== undefined) lines.push(`    x: ${l.x}`);
    if (l.y !== undefined) lines.push(`    y: ${l.y}`);
  }
  return lines.join('\n') + '\n';
}

function emitBallDevices(cfg: MpfConfig): string {
  const lines = [HEADER, '', 'ball_devices:'];
  for (const b of cfg.ballDevices) {
    lines.push(`  ${b.name}:`);
    lines.push(`    ball_switches: ${b.ball_switches.join(', ')}`);
    if (b.eject_coil) lines.push(`    eject_coil: ${b.eject_coil}`);
    if (b.mechanical_eject) lines.push(`    mechanical_eject: True`);
    if (b.jam_switch) lines.push(`    jam_switch: ${b.jam_switch}`);
    if (b.eject_targets?.length) lines.push(`    eject_targets: ${b.eject_targets.join(', ')}`);
    if (b.tags) lines.push(`    tags: ${b.tags}`);
  }
  return lines.join('\n') + '\n';
}

function emitConfig(cfg: MpfConfig): string {
  const lines = [
    HEADER,
    '',
    'config:',
    '  - switches.yaml',
    '  - coils.yaml',
    '  - lights.yaml',
    '  - ball_devices.yaml',
    '',
  ];
  lines.push('playfields:', '  playfield:', '    tags: default');
  if (cfg.defaultSourceDevice) lines.push(`    default_source_device: ${cfg.defaultSourceDevice}`);
  // A virtual (no-hardware) MPF run needs the trough switches active at boot or it
  // starts with zero balls — darkchaos lists them the same way.
  const trough = cfg.ballDevices.find(b => b.name === 'bd_trough');
  const startActive = trough?.ball_switches.filter(s => s !== trough.jam_switch) ?? [];
  if (startActive.length) {
    lines.push('', 'virtual_platform_start_active_switches:');
    for (const s of startActive) lines.push(`  - ${s}`);
  }
  return lines.join('\n') + '\n';
}

/** Serialize an MpfConfig to the set of files written under glf_mpf/config/. */
export function serializeMpf(cfg: MpfConfig): Record<string, string> {
  return {
    'config.yaml': emitConfig(cfg),
    'switches.yaml': emitSwitches(cfg),
    'coils.yaml': emitCoils(cfg),
    'lights.yaml': emitLights(cfg),
    'ball_devices.yaml': emitBallDevices(cfg),
  };
}
