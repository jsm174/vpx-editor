export interface RecipeParam {
  name: string;
  description: string;
  default: string;
}

export interface VbsPattern {
  name: string;
  title: string;
  description: string;
  parts: string[];
  snippet: string;
  gotchas: string[];
  aliases?: string[];
  params?: RecipeParam[];
  sourceTables?: string[];
  // The GLF flavor: how to build this as ORIGINAL game logic (preferred for new tables)
  // rather than the ROM/core.vbs `snippet` above. vpx_glf(action:"add_device") emits and
  // validates it once the geometry is placed.
  glf?: { note: string; snippet: string };
}

export const VBS_PATTERNS: Record<string, VbsPattern> = {
  spinning_disc: {
    name: 'spinning_disc',
    title: 'Spinning flat disc (visual rotation) with optional ball-pushing physics',
    description:
      'Rotate a flat n-gon Primitive via a Timer so it visibly spins. Optionally add a Trigger + cvpmTurntable (from core.vbs) for "ball rides the disc" physics — the same mechanism as Tron Legacy\'s center disc.',
    parts: ['Primitive (disc, use_3d_mesh: false)', 'Timer', 'Trigger (optional, for ball physics)'],
    snippet: [
      "' --- Top of script: load core.vbs (read-only, bundled with vpinball) ---",
      'ExecuteGlobal GetTextFile("core.vbs")',
      '',
      "' --- Visual rotation ---",
      'Sub SpinDiscTimer_Timer()',
      '    SpinDisc.RotAndTra2 = (SpinDisc.RotAndTra2 + 6) Mod 360',
      'End Sub',
      '',
      '\' --- Optional: ball-pushing physics (the actual "turntable" mechanic) ---',
      "' Uses cvpmTurntable from core.vbs.",
      'Dim ttSpin',
      'Set ttSpin = New cvpmTurntable',
      'ttSpin.InitTurntable SpinDiscTrigger, "ttSpinHandler"   \' (trigger, event-handler name)',
      'ttSpin.MotorOn = True',
      "ttSpin.Strength = 160                                      ' see calibration gotcha below",
    ].join('\n'),
    gotchas: [
      'Texture authoring: vpinball maps n-gon Primitive textures to the TOP-LEFT QUADRANT of the image (UV 0,0 → 0.5,0.5). For a square PNG, center your art at (SIZE/4, SIZE/4) — NOT (SIZE/2, SIZE/2). Call vpx_part(action:"template", type:"Primitive") for the full rule with concrete coordinates.',
      'Use RotAndTra(2), not RotZ/ObjRotZ — RotAndTra(2) is the canonical pattern (world Z rotation, vpin docs: src/vpx/gameitem/primitive.rs:49-65).',
      'Timer must have is_timer_enabled: true AND timer_interval set (e.g. 10ms for ~60fps).',
      'For the ball-physics overlay, the Trigger must cover the disc footprint with drag_points in ABSOLUTE world coordinates (not relative). For radius r around disc center (cx, cy), use [{x:cx-r,y:cy-r},{x:cx-r,y:cy+r},{x:cx+r,y:cy+r},{x:cx+r,y:cy-r}]. hit_height should match the disc surface (e.g. position.z + small offset).',
      'Strength calibration: current core.vbs `cvpmTurntable.AffectBall` divides by 8000 per tick, so Strength = 10 produces almost no force. Start around 80–240 (snippet uses 160). The older Tron-style `myTurnTable` divides by 1000, so values copied from Tron tables look ~8× too strong if you swap helpers. Always grep your actual core.vbs for the divisor before tuning.',
      'cvpmTurntable lives in core.vbs and is loaded via ExecuteGlobal GetTextFile("core.vbs"). DO NOT copy the class body into your script — core.vbs is bundled with vpinball, read-only, and always available.',
      'The blank-table template already loads controller.vbs but NOT core.vbs by default — verify your script has the ExecuteGlobal line at the top before using cvpmTurntable.',
      'On older vpinball bundles the helper may be named myTurnTable instead. Use vpx_reference(action:"system_summarize") to check what your install has.',
    ],
  },

  drop_target_bank: {
    name: 'drop_target_bank',
    title: 'Bank of drop targets with reset',
    description:
      'Standard pattern for a row of drop targets (HitTarget with target_type drop_target_beveled, drop_target_simple, or drop_target_flat_simple) — track individual hits and reset all when the bank clears.',
    parts: ['HitTarget × N (drop type)', 'Timer (optional, for reset delay)'],
    snippet: [
      "Dim DropTargetsHit(2)   ' track 3 targets",
      '',
      'Sub DT1_Hit() : DropTargetsHit(0) = True : CheckDropBank : End Sub',
      'Sub DT2_Hit() : DropTargetsHit(1) = True : CheckDropBank : End Sub',
      'Sub DT3_Hit() : DropTargetsHit(2) = True : CheckDropBank : End Sub',
      '',
      'Sub CheckDropBank()',
      '    Dim i, allDown : allDown = True',
      '    For i = 0 To 2',
      '        If Not DropTargetsHit(i) Then allDown = False',
      '    Next',
      '    If allDown Then',
      '        AddScore 10000',
      '        DT1.IsDropped = False',
      '        DT2.IsDropped = False',
      '        DT3.IsDropped = False',
      '        For i = 0 To 2 : DropTargetsHit(i) = False : Next',
      '    End If',
      'End Sub',
    ].join('\n'),
    gotchas: [
      'Use HitTarget with target_type "drop_target_beveled", "drop_target_simple", or "drop_target_flat_simple" — these auto-drop on hit. Other target_type values are static hit targets.',
      'Setting IsDropped = False raises the target; True drops it programmatically.',
      "AddScore is a typical helper from core.vbs / vpmController — use whatever your table's scoring convention is.",
    ],
  },

  pop_bumper_hit: {
    name: 'pop_bumper_hit',
    title: 'Pop bumper hit + sound + score',
    description: 'Standard Bumper_Hit handler that plays a sound, awards points, and optionally pulses a light.',
    parts: ['Bumper', 'Sound (optional)', 'Light (optional, for hit flash)'],
    snippet: [
      'Sub Bumper1_Hit()',
      '    PlaySound "fx_bumper1"',
      '    AddScore 100',
      '    Bumper1Light.State = LightStateBlinking',
      '    Bumper1Light.BlinkInterval = 50',
      "    Bumper1FlashTimer.Enabled = True   ' restart pulse timer",
      'End Sub',
      '',
      'Sub Bumper1FlashTimer_Timer()',
      '    Bumper1Light.State = LightStateOff',
      '    Bumper1FlashTimer.Enabled = False',
      'End Sub',
    ].join('\n'),
    gotchas: [
      'Bumper_Hit fires once per ball impact. Use a Timer for time-bound effects (light pulse, sound chain).',
      'Sounds are referenced by name from sounds.json — import via vpx_sound(action:"add") or the sound manager first.',
      'For multi-stage scoring (e.g. spotting all 4 bumpers), maintain state in a script-level Dim array.',
    ],
  },

  flipper_collide: {
    name: 'flipper_collide',
    title: 'Flipper collision events (live catch / cradle)',
    description:
      'Flipper_Collide fires when the ball touches the flipper. Use it for live catch, post pass, and similar timing tricks.',
    parts: ['Flipper'],
    snippet: [
      'Sub LeftFlipper_Collide(parm)',
      "    ' parm is the impact angle (0 = tip, ~90 = base)",
      '    If parm < 45 And LeftFlipper.CurrentAngle < LeftFlipper.EndAngle + 5 Then',
      "        ' Tip impact while moving up — play 'live catch' sound",
      '        PlaySound "fx_live_catch"',
      '    End If',
      'End Sub',
    ].join('\n'),
    gotchas: [
      "The `parm` argument is the impact angle in degrees, measured from the flipper's leading edge.",
      'CurrentAngle changes during flip — compare against EndAngle (full up) and StartAngle (resting) to detect what phase the flipper is in.',
      "Flipper_Collide can fire many times per ball pass; debounce if you're triggering audio.",
    ],
  },

  gate_event: {
    name: 'gate_event',
    title: 'Gate hit event (one-way ball flow)',
    description: 'Standard handler for a Gate part — fires when a ball passes through.',
    parts: ['Gate'],
    snippet: ['Sub Gate1_Hit()', '    PlaySound "fx_gate"', '    AddScore 50', 'End Sub'].join('\n'),
    gotchas: [
      "Gate_Hit fires on every pass — both directions if the gate is open-both, only the open direction if it's one-way.",
      'Use gate_type "wire_w" for the classic Z-shaped wire gate.',
    ],
  },

  pop_bumper_array: {
    name: 'pop_bumper_array',
    title: 'Array of N pop bumpers (VPW assembly)',
    description:
      'Lay out N pop bumpers the way VPW tables do: each bumper is a triplet of a Bumper (physics/collision body) plus a BumperCap and BumperBulb Primitive, named with a shared index suffix (Bumper1/BumperCap1/BumperBulb1). A Light per bumper drives the hit flash. Combine with the pop_bumper_hit recipe for the score/sound/flash handler.',
    aliases: ['pop bumpers', 'jet bumpers', 'thumper bumpers', 'bumper cluster'],
    parts: ['Bumper × N', 'Primitive BumperCapN × N', 'Primitive BumperBulbN × N', 'Light × N (hit flash)'],
    params: [
      {
        name: 'count',
        description: 'How many bumpers',
        default: '3 (VPW corpus: 36/48 tables use 3; hh and stwr use 4)',
      },
      {
        name: 'layout',
        description: 'Arrangement of the bumper centers',
        default: 'triangular cluster; arc/diamond for 4',
      },
      { name: 'spacing', description: 'Center-to-center distance between bumpers', default: '~80-100 vpx units' },
    ],
    sourceTables: ['stwr (Star Wars DE, 4 bumpers)', 'hh (Haunted House, 4 bumpers)'],
    snippet: [
      "' One triplet per bumper, parallel index suffix N (1..count):",
      "'   Bumper.BumperN      - collision body (set force/threshold in part props)",
      "'   Primitive.BumperCapN - cap mesh, parented over the bumper",
      "'   Primitive.BumperBulbN - lit bulb mesh",
      "'   Light.BumperNLight   - drives the flash (see pop_bumper_hit)",
      '',
      "' Hit handler per bumper (see pop_bumper_hit recipe for the flash timer):",
      'Sub Bumper1_Hit() : PlaySound "fx_bumper" : AddScore 100 : BumperFlash 1 : End Sub',
      'Sub Bumper2_Hit() : PlaySound "fx_bumper" : AddScore 100 : BumperFlash 2 : End Sub',
      'Sub Bumper3_Hit() : PlaySound "fx_bumper" : AddScore 100 : BumperFlash 3 : End Sub',
    ].join('\n'),
    gotchas: [
      'Keep the index suffix consistent across the whole triplet (BumperN/BumperCapN/BumperBulbN) — the cap/bulb primitives are positioned over the matching Bumper, not auto-attached.',
      'The Bumper part carries the physics (force, hit threshold); the Cap/Bulb primitives are visual only.',
      'For 4 bumpers, VPW uses a diamond/arc; for 3, a triangle. Pick centers first, then place each triplet at a center.',
    ],
  },

  vuk: {
    name: 'vuk',
    title: 'VUK / scoop / saucer (vertical up-kicker via cvpmBallStack)',
    description:
      'A hole that captures the ball and kicks it back out. Across the VPW corpus this is built with core.vbs cvpmBallStack: a Kicker part captures the ball, .InitSaucer binds it, a SolCallback wired to .SolOut discharges it, and the Kicker_Hit handler feeds the ball in with .AddBall. Identical shape in Star Wars, Big Bang Bar, Jokerz, Tommy, etc.',
    aliases: ['vuk', 'scoop', 'saucer', 'vertical up-kicker', 'popper', 'eject hole', 'kickout', 'ball eject'],
    parts: [
      'Kicker (the hole, e.g. sw33)',
      'Trigger (optional, for entry detection)',
      '(script-only: cvpmBallStack from core.vbs)',
    ],
    params: [
      { name: 'kicker', description: 'Kicker part name (often a switch name like sw33)', default: 'sw33' },
      { name: 'switch', description: 'PinMAME switch number for the captured-ball state', default: '33' },
      { name: 'kickAngle', description: 'Discharge direction in degrees (.InitSaucer arg 3)', default: '220' },
      { name: 'kickForce', description: 'Discharge strength (.InitSaucer arg 4)', default: '85' },
    ],
    sourceTables: [
      'stwr (cvpmBallStack ×2)',
      'bbb (bsRHole.SolOut)',
      'jokrz (bsLEject.SolOut)',
      'tomy (ExitVUK/ExitScoop)',
    ],
    snippet: [
      'ExecuteGlobal GetTextFile("core.vbs")   \' cvpmBallStack lives in core.vbs',
      '',
      'Dim SolRightEject',
      'Set SolRightEject = New cvpmBallStack',
      'With SolRightEject',
      "    .InitSaucer sw33, 33, 220, 85   ' kicker, switch#, kick angle, kick force",
      'End With',
      '',
      "' Discharge — wire to the solenoid that fires the kicker:",
      'SolCallback(7) = "SolRightEject.SolOut"',
      '',
      "' Capture — feed the ball into the mechanism when it falls in the hole:",
      'Sub sw33_Hit : SolRightEject.AddBall 1 : SoundSaucerLock : End Sub',
    ].join('\n'),
    gotchas: [
      'cvpmBallStack is in core.vbs — load it via ExecuteGlobal GetTextFile("core.vbs") at the top; do NOT paste the class body.',
      '.InitSaucer args are (kicker, switch#, kickAngle, kickForce). The kicker must be a Kicker part whose name matches the first arg.',
      'On a non-ROM (original) table without SolCallback, call SolRightEject.SolOut directly from your own timer/event instead of wiring SolCallback.',
      'The kick angle is in vpinball degrees relative to the table; verify the discharge clears the surrounding geometry.',
    ],
    glf: {
      note: 'PREFERRED for original (non-ROM) tables. GLF models a VUK/scoop as a ball device: a Kicker part captures the ball and an eject callback kicks it out — no SolCallback/cvpmBallStack. Verified against the vpx-example-glf table (CreateGlfBallDevice "kicker1"/"kicker2"). The bridge is naming: the placed Kicker must be named exactly the switch the config references (s_<name>). Place the Kicker (vpx_part, or vpx_library(action:"clone", exactName:"s_scoop", geometryOnly:true) from a donor), then vpx_glf(action:"add_device", device:"ball_device", name:"scoop", switches:["s_scoop"]) emits this config, adds the switch to glf_switches, validates references, and previews before applying.',
      snippet: [
        "' Inside ConfigureGlfDevices():",
        'With CreateGlfBallDevice("scoop")',
        '    .BallSwitches = Array("s_scoop")',
        '    .EjectTimeout = 2000',
        '    .EjectCallback = "ScoopEjectCallback"',
        'End With',
        '',
        "' Top-level callback (kicks the ball out of the device):",
        'Sub ScoopEjectCallback(ball)',
        '    If s_scoop.BallCntOver > 0 Then',
        '        s_scoop.Kick 14.8, 70',
        '    End If',
        'End Sub',
      ].join('\n'),
    },
  },

  upper_playfield: {
    name: 'upper_playfield',
    title: 'Upper / mini playfield with subway feed (VPW assembly)',
    description:
      'A raised deck the ball plays on, fed and returned by a subway. Modeled on Indiana Jones (VPW): an elevated minipf Primitive deck (with screw + ON/OFF lamp-state prims), reached/returned by a Ramp.Subway -> Trigger.SubwayExit -> Primitive.subwayscoop -> Wall.Subway1 path. Detect existing ones by an elevated-Z deck primitive clustered with minipf*/subway* naming.',
    aliases: ['upper playfield', 'mini playfield', 'mini pf', 'second level', 'raised deck', 'upper pf', 'pf2'],
    parts: [
      'Primitive minipf (the deck surface, elevated Z)',
      'Primitive minipf_screws',
      'Primitive minipf1..N / minipf1OFF (lit lamp ON/OFF states)',
      'Ramp Subway (feed/return path)',
      'Trigger SubwayExit',
      'Primitive subwayscoop',
      'Wall Subway1 (deck edge walls)',
    ],
    params: [
      {
        name: 'elevation',
        description: 'Z height of the deck above the main playfield (VERIFY against a real extract)',
        default: 'TBD — confirm from ij minipf primitive position.z',
      },
      {
        name: 'feed',
        description: 'How the ball reaches the deck',
        default: 'subway (under-PF kicker up) or an ascending ramp',
      },
      {
        name: 'walls',
        description: 'Edge containment for the raised surface',
        default: 'Wall ring around the deck footprint',
      },
    ],
    sourceTables: ['ij (Indiana Jones, minipf+subway)', 'jd (Judge Dredd)'],
    snippet: [
      "' Geometry assembly (place via vpx_part), not primarily script:",
      "'   Primitive.minipf      - deck mesh, position.z raised above PF",
      "'   Wall.Subway1          - containment walls around the deck footprint",
      "'   Ramp.Subway           - feed/return path connecting PF <-> deck",
      "'   Trigger.SubwayExit    - detects the ball leaving the subway",
      "'   Primitive.subwayscoop - the up-kicker hole feeding the deck (see vuk recipe)",
      '',
      "' The ball is usually lifted to the deck by a VUK — compose with the 'vuk' recipe:",
      "Sub SubwayExit_Hit : ' ball has arrived on the upper deck",
      '    PlaySound "fx_subwayexit"',
      'End Sub',
    ].join('\n'),
    gotchas: [
      'The deck Primitive must sit at a raised position.z; surrounding Walls need matching height_top/height_bottom so the ball stays on the deck.',
      'A ball physically reaches the upper deck via a VUK/subway, not by rolling up — pair this with the vuk recipe for the lift.',
      'minipf1..N / minipf1OFF primitives are pre-lit/unlit copies toggled for lamp states; only one variant is visible at a time.',
      'elevation default is unverified — extract ij minipf and read position.z before relying on a number.',
    ],
  },

  dmd_message: {
    name: 'dmd_message',
    title: 'DMD-style score / message display via core.vbs',
    description:
      'For tables that emulate a DMD scoreboard, core.vbs provides helpers like cvpmDictionary and message queues. This is the minimal pattern.',
    parts: ['(none — script-only)'],
    snippet: [
      '\' Requires: ExecuteGlobal GetTextFile("core.vbs") at top of script',
      "' Plus a Controller binding (vpmController = ...) for the DMD device.",
      '',
      'Sub ShowScore(player, score)',
      '    If Not IsObject(Controller) Then Exit Sub',
      '    Controller.HandleMechanics = 0',
      '    Controller.B2SOn',
      "    ' On PinMAME-backed tables, the ROM drives the DMD directly.",
      "    ' For B2S-only tables, write to Controller.B2SSetData N, value.",
      'End Sub',
    ].join('\n'),
    gotchas: [
      'Real DMD output requires either a PinMAME ROM (Controller object handles it) or B2S server (Controller.B2SSetData).',
      'For plain text on a Flasher-based fake DMD, use a TextBox + Timer to scroll content frame by frame.',
      'core.vbs is loaded via `ExecuteGlobal GetTextFile("core.vbs")` — must be at the very top of the script.',
    ],
  },
};

export const PATTERN_NAMES = Object.keys(VBS_PATTERNS);
