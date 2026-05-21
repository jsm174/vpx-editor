import { z } from 'zod';
import fs from 'fs-extra';
import path from 'node:path';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';
import { deriveMpfConfig, serializeMpf } from '../library/mpf/from-table.js';
import { mpfConfigDir, writeMpfConfig } from '../library/mpf/write-config.js';

const MPF_FILES = ['config.yaml', 'switches.yaml', 'coils.yaml', 'lights.yaml', 'ball_devices.yaml'] as const;

const mpfInput = z.object({
  action: z
    .enum(['generate', 'status', 'get'])
    .describe(
      '"generate": derive an MPF machine config from the active table and write it to glf_mpf/config/ next to the table. ' +
        '"status": preview what would be generated (counts + notes + YAML) without writing. ' +
        '"get": read one already-generated config file (use `file`).'
    ),
  file: z.enum(MPF_FILES).optional().describe('For get: which generated file to read (default config.yaml).'),
});

const mpf: Tool<typeof mpfInput> = {
  name: 'vpx_mpf',
  annotations: { destructiveHint: true },
  description:
    'Generate Mission Pinball Framework (MPF) hardware config from the active GLF table, so the same design can drive a ' +
    "REAL physical machine. Mirrors the framework's own exporter: switches from the glf_* collections + target configs + s_trough1..tnob, " +
    'lights from glf_lights, ball devices from the CreateGlfBallDevice blocks; numbers the hardware and writes a glf_mpf/config/ folder ' +
    'next to the table (darkchaos layout; inside the temp work dir while the table is unsaved). ' +
    'Actions: "generate" (write), "status" (preview, no write), "get" (read a file). See docs/mcp/mpf-workflow.md.',
  inputSchema: mpfInput,
  async execute(input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);

    if (input.action === 'get') {
      const dir = mpfConfigDir(handle);
      const file = input.file ?? 'config.yaml';
      const full = path.join(dir, file);
      if (!(await fs.pathExists(full))) {
        return errorResult(`No MPF config at ${full}. Run vpx_mpf(action:"generate") first.`);
      }
      return jsonResult({ file, path: full, content: await fs.readFile(full, 'utf-8') });
    }

    const state = await ctx.loadActiveState();
    if (!state) return errorResult('Could not load the active table.');
    const cfg = deriveMpfConfig(state);
    const summary = {
      switches: cfg.switches.length,
      coils: cfg.coils.length,
      lights: cfg.lights.length,
      ballDevices: cfg.ballDevices.map(b => b.name),
      defaultSourceDevice: cfg.defaultSourceDevice ?? null,
    };

    if (input.action === 'status') {
      return jsonResult({
        applied: false,
        summary,
        notes: cfg.notes,
        wouldWriteTo: mpfConfigDir(handle),
        preview: serializeMpf(cfg),
      });
    }

    // generate
    const dir = mpfConfigDir(handle);
    const written = await writeMpfConfig(dir, cfg);
    return jsonResult({
      applied: true,
      summary,
      notes: cfg.notes,
      configDir: dir,
      files: written.map(f => path.basename(f)),
      nextStep:
        'Review the YAML (names match the GLF switches; numbers are sequential placeholders — set real hardware addresses). ' +
        'Point your MPF machine folder at this glf_mpf/config. See docs/mcp/mpf-workflow.md.',
    });
  },
};

export function buildMpfTools(): Tool[] {
  return [mpf];
}
