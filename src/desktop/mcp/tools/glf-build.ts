import { z } from 'zod';
import fs from 'fs-extra';
import path from 'node:path';
import { errorResult, jsonResult, type Tool, type ToolContext } from '../types.js';
import { confirmable, NO_ACTIVE_TABLE } from './edit-util.js';
import { emitBallDevice, emitFlipper, type EmittedComponent } from '../library/glf/emit.js';
import {
  detectGlfScaffold,
  injectGlfFramework,
  mergeGlfScaffold,
  structuralPrerequisites,
  GLF_TABLE_ELEMENT,
  type ScaffoldStatus,
} from '../library/glf/scaffold.js';
import type { Collection } from '../../../types/data.js';
import { assembleGlfScript } from '../library/glf/assemble.js';
import { NameRegistry } from '../library/glf/naming.js';
import {
  validateReferences,
  validateHelpers,
  validateScaffold,
  validateNoRedefinitions,
  validateFlipperSwitch,
  lintMergedScript,
  combineFindings,
  type Finding,
} from '../library/validate.js';

// Devices vpx_glf can wire into a table's ConfigureGlfDevices. Each links its GLF doc.
const DEVICES: Record<string, { title: string; doc: string; summary: string }> = {
  ball_device: {
    title: 'Ball device (scoop / VUK / lock / plunger lane)',
    doc: 'ball-device',
    summary:
      'Any mechanism that captures and ejects a ball. Needs switch part(s) that detect the ball. ' +
      'NOT the trough: the framework drives that by name (Kickers swTrough1..tnob plus Drain).',
  },
  flipper: {
    title: 'Flipper',
    doc: 'flipper',
    summary: 'Player-controlled flipper. Needs the VPX flipper part; its button switch is virtual (keyboard).',
  },
};

const glfInput = z.object({
  action: z
    .enum(['status', 'scaffold', 'list_devices', 'add_device'])
    .describe(
      '"status": is the active table GLF-bootable? (framework/constants/hooks/collections). ' +
        '"scaffold": make the table GLF-bootable — embeds the framework if missing and merges the harness ' +
        '(constants + Glf_* calls in the Table_Init/Exit/Key hooks + ConfigureGlfDevices) into the existing script without redefining it. ' +
        '"list_devices": the devices add_device can wire, with their GLF docs. ' +
        '"add_device": wire a GLF device into ConfigureGlfDevices + its callback (use `device` + `name`; preview unless `confirm`).'
    ),
  device: z.enum(['ball_device', 'flipper']).optional().describe('For add_device: which device to wire.'),
  name: z.string().optional().describe('For add_device: device name, e.g. "scoop" or "left".'),
  switches: z
    .array(z.string())
    .optional()
    .describe(
      'For add_device ball_device: the switch PART name(s) that detect the ball (must already exist; added to the glf_switches collection when missing).'
    ),
  flipperPart: z
    .string()
    .optional()
    .describe('For add_device flipper: the VPX flipper part name (e.g. "LeftFlipper").'),
  switchName: z
    .string()
    .optional()
    .describe('For add_device flipper: the button switch name (default s_<name>_flipper).'),
  ejectTimeout: z.number().int().positive().optional().describe('For add_device ball_device: EjectTimeout ms.'),
  kickAngle: z.number().optional().describe('For add_device ball_device: eject KickBall angle (deg).'),
  kickForce: z.number().optional().describe('For add_device ball_device: eject KickBall velocity.'),
  mechanicalEject: z
    .boolean()
    .optional()
    .describe('For add_device ball_device: the player ejects the ball (plunger lane).'),
  defaultDevice: z
    .boolean()
    .optional()
    .describe('For add_device ball_device: this device serves new balls (the plunger).'),
  feel: z
    .boolean()
    .optional()
    .describe(
      'For add_device ball_device: emit the feel-layer callback (SoundSaucerKick, KickerAngleTol/KickerStrengthTol randomness). ' +
        'Requires those helpers in the table; missing ones are surfaced as warnings.'
    ),
  tableElement: z
    .string()
    .optional()
    .describe('For scaffold: VPX table element used in hooks (default "Table1"; the framework only supports Table1).'),
  gameName: z.string().optional().describe('For scaffold: cGameName (default the table name).'),
  ...confirmable,
});

async function loadFrameworkText(ctx: ToolContext): Promise<string | null> {
  if (!ctx.config.glfPath) return null;
  const file = path.join(ctx.config.glfPath, 'vpx-glf.vbs');
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
}

interface ScaffoldPlan {
  script: string;
  changes: string[];
  findings: Finding[];
  embedsFramework: boolean;
}

// Merges framework + harness into the current script without redefining anything.
// The lint/changes are computed on the table-script portion only — running the
// pitfall linter over the 17k-line framework would drown the report.
function planScaffold(
  script: string,
  scaffold: ScaffoldStatus,
  frameworkText: string | null,
  opts: { tableElement: string; gameName: string }
): ScaffoldPlan {
  const findings: Finding[] = [];
  const embedsFramework = !scaffold.present.glfLoaded;
  if (embedsFramework && frameworkText) {
    findings.push(...validateNoRedefinitions(script, frameworkText));
  }
  const merged = mergeGlfScaffold(script, opts);
  const changes = [...(embedsFramework ? ['Embed the GLF framework (vpx-glf.vbs)'] : []), ...merged.changes];
  let finalScript = merged.script;
  if (embedsFramework && frameworkText) {
    finalScript = mergeGlfScaffold(injectGlfFramework(script, frameworkText), opts).script;
  }
  return { script: finalScript, changes, findings, embedsFramework };
}

const glf: Tool<typeof glfInput> = {
  name: 'vpx_glf',
  annotations: { destructiveHint: true },
  description:
    'Build GLF (Game Logic Framework) game logic on the active table — the way to wire a homebrew machine. ' +
    '"status" checks bootability, "scaffold" embeds the framework and merges the GLF harness into the script, "list_devices" lists what can be wired, ' +
    '"add_device" wires a device (ball device, flipper) into ConfigureGlfDevices with its callback. ' +
    'After adding/placing switch parts, run vpx_mpf(action:"generate") to refresh the real-hardware config. ' +
    'Read device docs with vpx_reference(action:"glf_doc").',
  inputSchema: glfInput,
  async execute(input, ctx) {
    if (input.action === 'list_devices') {
      return jsonResult({
        devices: Object.entries(DEVICES).map(([key, d]) => ({
          device: key,
          title: d.title,
          summary: d.summary,
          doc: `vpx_reference(action:"glf_doc", name:"${d.doc}")`,
        })),
        note: 'add_device wires the GLF script config + callback for a device whose geometry already exists. Place parts with vpx_part or vpx_library(action:"clone") first.',
      });
    }

    const state = await ctx.loadActiveState();
    if (!state) return errorResult(NO_ACTIVE_TABLE);
    const tableElement = input.tableElement ?? GLF_TABLE_ELEMENT;
    const collectionNames = (state.collections ?? []).map(c => c.name);
    const partNames = state.items.map(i => i.name).filter((n): n is string => !!n);
    const scaffold = detectGlfScaffold({ script: state.script, collectionNames, partNames, tableElement });

    if (input.action === 'status') {
      return jsonResult({
        bootable: scaffold.bootable,
        oldFramework: scaffold.oldFramework,
        externalScript: scaffold.externalScript,
        present: scaffold.present,
        missing: scaffold.missing,
        warnings: scaffold.warnings,
        structuralPrereqs: structuralPrerequisites(scaffold),
      });
    }

    if (scaffold.oldFramework) {
      return errorResult(
        'This table embeds the LEGACY GLF framework (the old "(new BallDevice)(...)" API) — the modern CreateGlf* ' +
          'devices this tool emits are incompatible with it, and mixing them would break the script. ' +
          'Start a fresh table with vpx_new(action:"create", start:"glf") instead, or migrate the script by hand.'
      );
    }

    if (scaffold.externalScript) {
      return errorResult(
        'This table loads its game from an external tablescript (Include(...) with no CreateGlf* definitions in script.vbs) — ' +
          'the official vpx-example-glf layout. Its hooks, constants and ConfigureGlfDevices live in that file, so editing ' +
          'script.vbs here would redefine them ("Name redefined"). Edit scripts/src/game/_configuration.vbs in the project ' +
          'instead and rebuild the tablescript.'
      );
    }

    if (tableElement.toLowerCase() !== GLF_TABLE_ELEMENT.toLowerCase()) {
      return errorResult(
        `tableElement "${tableElement}" is not supported: the framework hardcodes Table1 (Table1.Option in Glf_Options, ` +
          'Table1.Filename), so Glf_Init would fail. Name the table element Table1.'
      );
    }

    const needsScaffold =
      !scaffold.present.glfLoaded ||
      !scaffold.present.initHook ||
      !scaffold.present.exitHook ||
      !scaffold.present.keyDownHook ||
      !scaffold.present.keyUpHook ||
      !scaffold.present.constants;

    const scaffoldOpts = {
      tableElement,
      gameName: input.gameName ?? state.info?.table_name ?? 'MyGame',
    };
    let frameworkText: string | null = null;
    if (needsScaffold && !scaffold.present.glfLoaded) {
      frameworkText = await loadFrameworkText(ctx);
      if (!frameworkText) {
        return errorResult('The bundled GLF framework (vpx-glf.vbs) is missing — cannot make this table GLF-bootable.');
      }
    }

    if (input.action === 'scaffold') {
      if (!needsScaffold) {
        return jsonResult({
          applied: false,
          bootable: scaffold.bootable,
          note: 'Table already has the GLF scaffold.',
          structuralPrereqs: structuralPrerequisites(scaffold),
        });
      }
      const plan = planScaffold(state.script, scaffold, frameworkText, scaffoldOpts);
      const report = combineFindings(plan.findings);
      if (!input.confirm || report.refuse) {
        return jsonResult({
          applied: false,
          willChange: plan.changes,
          validation: report,
          warnings: scaffold.warnings,
          structuralPrereqs: structuralPrerequisites(scaffold),
          nextStep: report.refuse
            ? 'Resolve validation.findings, then call again with confirm:true.'
            : 'Call again with confirm:true to apply.',
        });
      }
      const res = await ctx.applyEdit({
        kind: 'edit-script',
        payload: { mode: 'replace', content: plan.script, expectedScript: state.script },
        description: 'Merge GLF scaffold',
        preview: false,
      });
      if (!res.success) return errorResult(`Scaffold failed: ${res.error}`);
      return jsonResult({
        applied: true,
        changes: plan.changes,
        warnings: scaffold.warnings,
        structuralPrereqs: structuralPrerequisites(scaffold),
        nextStep:
          'GLF harness merged. Ensure the glf_* collections and a Glf_GameTimer (Enabled, interval -1) exist, then add devices with add_device.',
      });
    }

    // add_device
    if (!input.device) return errorResult('add_device requires `device` (one of: ball_device, flipper).');
    if (!input.name) return errorResult('add_device requires `name`.');
    const existingNames = state.items.map(i => i.name).filter((n): n is string => !!n);

    let emitted: EmittedComponent;
    const findings: Finding[][] = [];
    let switchesToRegister: string[] = [];
    if (input.device === 'ball_device') {
      const troughRefusal = troughGuard(input.name, input.switches ?? []);
      if (troughRefusal) return errorResult(troughRefusal);
      const registry = new NameRegistry(existingNames);
      const switches = input.switches?.length ? input.switches : [registry.allocate('switch', input.name)];
      switchesToRegister = missingGlfSwitches(state.collections ?? [], switches);
      emitted = emitBallDevice({
        name: input.name,
        ballSwitches: switches,
        ejectTimeout: input.ejectTimeout,
        kickAngle: input.kickAngle,
        kickForce: input.kickForce,
        mechanicalEject: input.mechanicalEject,
        defaultDevice: input.defaultDevice,
        feelLayer: input.feel,
      });
      // Ball-device switches are physical parts (kickers) — they must already exist.
      findings.push(validateReferences({ switchRefs: emitted.switchRefs, coilRefs: emitted.coilRefs }, existingNames));
    } else {
      if (!input.flipperPart)
        return errorResult('add_device flipper requires `flipperPart` (the VPX flipper part name).');
      const flipperExists = state.items.some(i => i.type === 'Flipper' && i.name === input.flipperPart);
      if (!flipperExists) {
        return errorResult(
          `Flipper part "${input.flipperPart}" not found. Place it first (vpx_part) or check the name (vpx_table action:"parts").`
        );
      }
      emitted = emitFlipper({ name: input.name, flipperPart: input.flipperPart, switchName: input.switchName });
      // Flipper button switches are virtual (keyboard) — validate they're ones the dispatch fires.
      findings.push(validateFlipperSwitch(emitted.switchRefs[0]));
    }

    const scaffoldPlan = needsScaffold ? planScaffold(state.script, scaffold, frameworkText, scaffoldOpts) : null;
    const baseScript = scaffoldPlan ? scaffoldPlan.script : state.script;
    const assembled = assembleGlfScript(baseScript, {
      scaffoldBlock: null,
      deviceConfig: emitted.deviceConfig,
      callbacks: emitted.callbacks,
    });

    // Redefinitions are checked against the full merged script; the pitfall linter
    // runs over the new code only, so pre-existing table issues can't block the add.
    const report = combineFindings(
      ...findings,
      scaffoldPlan ? scaffoldPlan.findings : [],
      validateNoRedefinitions(baseScript, emitted.callbacks),
      validateHelpers(emitted.helperRefs, assembled),
      validateScaffold(scaffold),
      lintMergedScript(emitted.config)
    );

    const plan = {
      device: input.device,
      name: input.name,
      glfConfig: emitted.config,
      scaffoldChanges: scaffoldPlan?.changes ?? [],
      collectionChanges: switchesToRegister.map(n => `Add "${n}" to the glf_switches collection`),
      structuralPrereqs: structuralPrerequisites(scaffold),
      validation: report,
    };

    if (!input.confirm || report.refuse) {
      return jsonResult({
        ...plan,
        applied: false,
        nextStep: report.refuse
          ? 'Resolve validation.findings, then call again with confirm:true.'
          : 'Preview only. Call again with confirm:true to apply.',
      });
    }

    const res = await ctx.applyEdit({
      kind: 'edit-script',
      payload: { mode: 'replace', content: assembled, expectedScript: state.script, glfSwitches: switchesToRegister },
      description: `Wire GLF ${input.device} "${input.name}"`,
      preview: false,
    });
    if (!res.success) return errorResult(`add_device failed: ${res.error}`);
    return jsonResult({
      ...plan,
      applied: true,
      nextStep:
        'Device wired into ConfigureGlfDevices. Run vpx_mpf(action:"generate") to refresh the MPF hardware config.',
    });
  },
};

const TROUGH_NAME = /^(trough|bd_trough)$/i;
const TROUGH_SWITCH = /^(swTrough\d*|Drain)$/i;

function troughGuard(name: string, switches: string[]): string | null {
  if (TROUGH_NAME.test(name) || switches.some(sw => TROUGH_SWITCH.test(sw))) {
    return (
      'The trough is not a ball_device in this framework: it is driven by NAME — Kicker parts swTrough1..swTrough<tnob> ' +
      '(tnob <= 7) plus one named Drain (or aliased with Dim Drain : Set Drain = swTroughN), with Const tnob set to the ball count. ' +
      'The framework creates the balls in those kickers at Glf_Init and owns their _Hit/_UnHit handlers, so wiring them as a ' +
      'CreateGlfBallDevice would double-handle every drain. Use add_device for scoops/VUKs/locks/the plunger lane only.'
    );
  }
  return null;
}

function missingGlfSwitches(collections: Collection[], switches: string[]): string[] {
  const glfSwitches = collections.find(c => c.name.toLowerCase() === 'glf_switches');
  const members = new Set((glfSwitches?.items ?? []).map(m => m.toLowerCase()));
  return switches.filter(sw => !members.has(sw.toLowerCase()));
}

export function buildGlfBuildTools(): Tool[] {
  return [glf];
}
