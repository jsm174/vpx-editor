// Emits GLF game-logic config blocks. Field names/values are grounded in the
// bundled GLF docs (resources/glf/docs/ball-device.md). Output is plain VBS the
// table author would otherwise hand-write inside ConfigureGlfDevices().

/** Result of emitting one GLF component: the VBS plus the names it references, for validation. */
export interface EmittedComponent {
  /** The device config (a `With CreateGlf...` block) — belongs INSIDE ConfigureGlfDevices(). */
  deviceConfig: string;
  /** Top-level callback Sub(s) — belong at script top level, NOT inside ConfigureGlfDevices(). */
  callbacks: string;
  /** deviceConfig + callbacks joined, for preview display only. */
  config: string;
  /** Switch names the config references — each must resolve to a placed part. */
  switchRefs: string[];
  /** Coil names the config references. */
  coilRefs: string[];
  /** Sub/Function names this block defines — for collision/lint checks. */
  definedSubs: string[];
  /** Feel-layer helpers (subs/constants) this block calls — must exist in the target. */
  helperRefs: string[];
}

export interface BallDeviceSpec {
  /** Device name, e.g. "scoop". Used for CreateGlfBallDevice("<name>"). */
  name: string;
  /** Switch part names that detect a ball in the device, e.g. ["s_scoop"]. */
  ballSwitches: string[];
  /** Eject timeout in ms (GLF default 1000). */
  ejectTimeout?: number;
  /** Discharge angle (degrees) for the eject Kick. */
  kickAngle?: number;
  /** Discharge velocity for the eject Kick. */
  kickForce?: number;
  /** Kicker part referenced in the eject callback; defaults to the first ball switch. */
  kickerPart?: string;
  /** Player ejects the ball (plunger lane); exits then don't count as lost balls. */
  mechanicalEject?: boolean;
  /** Register as glf_plunger — the device new balls are served to. */
  defaultDevice?: boolean;
  /** Events that trigger ejecting every held ball (locks). */
  ejectAllEvents?: string[];
  /**
   * Emit the full VPW-style callback (sound, DOF, randomness tolerance, failed-kick
   * branch) as in the GLF example table. Requires the feel layer (SoundSaucerKick, DOF,
   * <Name>AngleTol/StrengthTol). Off by default so the output stays portable. The
   * callbacks reference helpers the caller must guarantee exist (validate before applying).
   */
  feelLayer?: boolean;
}

/** PascalCase a normalized name: "left scoop" -> "LeftScoop". */
function pascalCase(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** The eject callback Sub name for a device, e.g. "scoop" -> "ScoopEjectCallback". */
export function ejectCallbackName(deviceName: string): string {
  return `${pascalCase(deviceName)}EjectCallback`;
}

/**
 * Emit a GLF ball device (scoop / VUK / physical lock) with its eject callback.
 * Mirrors resources/glf/docs/ball-device.md (note: the real property is
 * `EjectTimeout`; the doc's inline example has a `.EjectTimemout` typo).
 */
export function emitBallDevice(spec: BallDeviceSpec): EmittedComponent {
  const switches = spec.ballSwitches.length ? spec.ballSwitches : [`s_${spec.name.toLowerCase()}`];
  const callback = ejectCallbackName(spec.name);
  const ejectTimeout = spec.ejectTimeout ?? 1000;
  const kicker = spec.kickerPart ?? switches[0];
  const ang = spec.kickAngle ?? 14.8;
  const vel = spec.kickForce ?? 70;
  const switchArray = switches.map(s => `"${s}"`).join(', ');

  const deviceLines = [
    `With CreateGlfBallDevice("${spec.name}")`,
    `    .BallSwitches = Array(${switchArray})`,
    `    .EjectTimeout = ${ejectTimeout}`,
  ];
  if (spec.mechanicalEject) deviceLines.push(`    .MechanicalEject = True`);
  if (spec.defaultDevice) deviceLines.push(`    .DefaultDevice = True`);
  if (spec.ejectAllEvents?.length) {
    deviceLines.push(`    .EjectAllEvents = Array(${spec.ejectAllEvents.map(e => `"${e}"`).join(', ')})`);
  }
  // A mechanical-eject device (plunger lane) has no commanded eject: the framework's
  // Eject() is a no-op when EjectCallback is unset (m_eject_callback stays Null), and
  // the ball switch is often a Trigger, which has no Kick method.
  const emitCallback = !spec.mechanicalEject;
  if (emitCallback) deviceLines.push(`    .EjectCallback = "${callback}"`);
  deviceLines.push(`End With`);
  const deviceConfig = deviceLines.join('\n');

  // Helpers from the feel layer (scripts/src/vpx in the GLF example table). The
  // tolerance constants are shared across devices there: KickerAngleTol/KickerStrengthTol.
  const helperRefs: string[] = [];
  let callbackBody: string[] = [];
  if (!emitCallback) {
    callbackBody = [];
  } else if (spec.feelLayer) {
    helperRefs.push('SoundSaucerKick', 'KickerAngleTol', 'KickerStrengthTol');
    callbackBody = [
      `Sub ${callback}(ball)`,
      `    Dim ang, vel`,
      `    If ${kicker}.BallCntOver > 0 Then`,
      `        ang = ${ang} + KickerAngleTol*2*(rnd-0.5)`,
      `        vel = ${vel} + KickerStrengthTol*2*(rnd-0.5)`,
      `        ${kicker}.Kick ang, vel`,
      `        SoundSaucerKick 1, ${kicker}`,
      `    Else`,
      `        SoundSaucerKick 0, ${kicker}`,
      `    End If`,
      `End Sub`,
    ];
  } else {
    callbackBody = [
      `Sub ${callback}(ball)`,
      `    If ${kicker}.BallCntOver > 0 Then`,
      `        ${kicker}.Kick ${ang}, ${vel}`,
      `    End If`,
      `End Sub`,
    ];
  }

  const callbacks = callbackBody.join('\n');
  return {
    deviceConfig,
    callbacks,
    config: callbacks ? `${deviceConfig}\n\n${callbacks}` : deviceConfig,
    switchRefs: [...switches],
    coilRefs: [],
    definedSubs: emitCallback ? [callback] : [],
    helperRefs,
  };
}

export interface FlipperSpec {
  /** Device name, e.g. "left" / "right". Used for CreateGlfFlipper("<name>"). */
  name: string;
  /** The VPX flipper part this drives (e.g. "LeftFlipper"). */
  flipperPart: string;
  /** Switch the flipper button maps to. Defaults to s_<name>_flipper. */
  switchName?: string;
}

/** PascalCase action-callback name for a flipper, e.g. "left" -> "LeftFlipperAction". */
export function flipperActionName(name: string): string {
  return `${pascalCase(name)}FlipperAction`;
}

/**
 * Emit a GLF flipper (config + action callback) mirroring vpx-example-glf's ZFLP wiring.
 * The callback rotates the VPX flipper part; sound/DOF polish is left to the author.
 */
export function emitFlipper(spec: FlipperSpec): EmittedComponent {
  const sw = spec.switchName ?? `s_${spec.name.toLowerCase()}_flipper`;
  const callback = flipperActionName(spec.name);
  const part = spec.flipperPart;

  const deviceConfig = [
    `With CreateGlfFlipper("${spec.name}")`,
    `    .Switch = "${sw}"`,
    `    .ActionCallback = "${callback}"`,
    `    .EnableEvents = Array("ball_started", "enable_flippers")`,
    `    .DisableEvents = Array("kill_flippers")`,
    `End With`,
  ].join('\n');

  const callbacks = [
    `Sub ${callback}(Enabled)`,
    `    If Enabled Then`,
    `        ${part}.RotateToEnd`,
    `    Else`,
    `        ${part}.RotateToStart`,
    `    End If`,
    `End Sub`,
  ].join('\n');

  return {
    deviceConfig,
    callbacks,
    config: `${deviceConfig}\n\n${callbacks}`,
    switchRefs: [sw],
    coilRefs: [],
    definedSubs: [callback],
    helperRefs: [],
  };
}
