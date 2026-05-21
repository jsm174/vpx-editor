import { z } from 'zod';
import { jsonResult, type Tool } from '../types.js';

const guideInput = z.object({});

const guide: Tool<typeof guideInput> = {
  name: 'vpx_guide',
  annotations: { readOnlyHint: true, openWorldHint: false },
  description:
    'START HERE. Call this FIRST whenever the user is new, asks "what can you do?", or wants to build / design / start a ' +
    'pinball table or homebrew machine and you are unsure of the workflow. Returns a plain-English orientation, the ' +
    'recommended step-by-step workflow with the exact commands to run, and a glossary of the terms (GLF, MPF, trough…). ' +
    'Works with NO table open. The user never needs to know tool names — read this, then drive the workflow for them.',
  inputSchema: guideInput,
  async execute(_input, ctx) {
    const handle = await ctx.getActiveTable();
    const hasTable = !!handle;

    return jsonResult({
      whatThisIs:
        'This editor lets you build an original ("homebrew") Visual Pinball table and the game logic to run it — ' +
        'on screen and, optionally, on real pinball hardware. You drive it for the user in plain English; they do not need to know any commands.',
      youAreHere: hasTable
        ? `A table is already open: "${handle!.tableName ?? 'untitled'}". You can inspect and edit it.`
        : 'No table is open yet — that is fine. You do NOT need one open to start; you can create one.',
      recommendedNext: hasTable
        ? 'vpx_table(action:"overview") to see what the table has, then vpx_glf(action:"status") to check its game logic.'
        : 'vpx_new(action:"create", start:"glf", name:"MyMachine", dir:"<the folder you are working in>") — creates a playable table on disk to build on.',
      workflow: [
        {
          step: 1,
          do: 'Create a table (no table needs to be open).',
          command: 'vpx_new(action:"create", start:"glf", name:"MyMachine", dir:"<the folder you are working in>")',
          why:
            'Gives you a minimal but already-playable GLF table: two flippers, a ball trough, and a plunger. Use start:"blank" for a bare table. ' +
            'Always pass dir (your current working directory, as an absolute path) so the table is saved there as MyMachine.vpx immediately, ' +
            'with no Save dialog. Later vpx_save calls then write to the same file.',
        },
        {
          step: 2,
          do: 'See what you have.',
          command: 'vpx_table(action:"overview")  /  vpx_table(action:"parts")',
          why: 'Lists the parts (flippers, trough kickers, plunger, lights). vpx_script(action:"get") shows the game code.',
        },
        {
          step: 3,
          do: 'Add game mechanisms — and LOOK at what you placed.',
          command: 'vpx_glf(action:"list_devices")  then  vpx_glf(action:"add_device", ...)  then  vpx_view()',
          why:
            'Wires GLF logic for devices like a scoop or extra flipper. Place the part first (vpx_part), then wire it. ' +
            'After every placement, vpx_view() returns a screenshot — verify positions visually instead of trusting coordinates.',
        },
        {
          step: 4,
          do: 'Boot-test it.',
          command: 'vpx_test()',
          why: 'Assembles the table and runs it in VPinballX for a few seconds, reporting any script errors. Fix and repeat until it boots clean.',
        },
        {
          step: 5,
          do: 'Make it run on REAL hardware (optional but a core goal).',
          command: 'vpx_save, then vpx_mpf(action:"generate")',
          why: 'Writes an MPF config (switches/coils/lights/ball-devices) into glf_mpf/config next to the saved .vpx so the same design can drive a physical machine. Use action:"status" to preview before saving.',
        },
        {
          step: 6,
          do: 'Play it.',
          command: 'vpx_save (or vpx_test for a quick automated boot check), then open the .vpx in VPinballX',
          why: 'The starter is a real, working table — the ball launches, drains to the trough, and the flippers respond.',
        },
      ],
      glossary: {
        VPX: 'Visual Pinball X — the table format and simulator.',
        GLF: 'Game Logic Framework — the VBScript framework that runs the rules (devices, modes, scoring). vpx_glf builds it.',
        MPF: 'Mission Pinball Framework — config that drives REAL pinball hardware. vpx_mpf generates it from your table.',
        trough: 'The mechanism that holds/serves balls; "plunger" launches one into play.',
        ConfigureGlfDevices: 'The spot in the table script where GLF devices are declared.',
      },
      learnMore: {
        listGlfTopics: 'vpx_reference(action:"glf_list")',
        readAGlfDoc: 'vpx_reference(action:"glf_doc", name:"ball-device")',
        studyAnExistingTable:
          'vpx_library(action:"inspect", tablePath:"/abs/path.vpx") — when the user points at a .vpx to copy or learn from, ' +
          'inspect it first, read its wiring with action:"get_script", then action:"clone" to copy a part in.',
        docs: 'docs/mcp/getting-started.md, glf-tables.md, mpf-workflow.md',
      },
      tip: 'Edit results carry a nextStep — follow the chain and you can walk a complete beginner from nothing to a playable, hardware-ready machine. Use vpx_view to look, vpx_geometry to measure.',
    });
  },
};

export function buildGuideTools(): Tool[] {
  return [guide];
}
