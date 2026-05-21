import { z } from 'zod';
import fs from 'fs-extra';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { confirmable, runEdit } from './edit-util.js';

const INLINE_BASE64_LIMIT = 200 * 1024; // PNG bytes; base64 inflates by ~33%
const FULL_SCRIPT_LIMIT = 120 * 1024;

const libraryInput = z.object({
  action: z
    .enum(['inspect', 'get_script', 'extract_bundle', 'clone', 'get_image'])
    .describe(
      '"inspect": overview of a donor .vpx — table info, playfield bounds, every part grouped by type, collections, materials/images/sounds, script Sub index (use `tablePath`). START HERE when studying a table. ' +
        '"get_script": read the donor\'s VBS — one Sub (`subName`), a grep (`pattern`), a line range (`startLine`+`endLine`), or the whole thing if small. ' +
        '"extract_bundle": a part + every material/image/mesh/sub it references, as JSON (use `tablePath` + `partName`). ' +
        '"clone": copy a part (with its materials/textures/script subs) from a donor .vpx INTO the active table (use `tablePath` + `partName` + `targetPosition`, then `confirm`). ' +
        '"get_image": image bytes from a donor .vpx (use `tablePath` + `imageName`). ' +
        'Donor tables are read on demand from an absolute `tablePath` — there is no pre-built corpus index.'
    ),
  tablePath: z.string().optional().describe('Absolute path to the donor .vpx file to read (required by every action).'),
  partName: z.string().optional().describe('For extract_bundle / clone: name of the part in the donor table.'),
  imageName: z.string().optional().describe("For get_image: name of the image in the donor table's images.json."),
  // get_script selectors
  subName: z
    .string()
    .optional()
    .describe('For get_script: return just this Sub/Function (case-insensitive; names come from inspect).'),
  pattern: z.string().optional().describe('For get_script: substring or regex to grep the donor script for.'),
  isRegex: z.boolean().default(false).optional().describe('For get_script: treat `pattern` as a regex.'),
  contextLines: z
    .number()
    .int()
    .min(0)
    .max(20)
    .default(2)
    .optional()
    .describe('For get_script: context lines around each match.'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('For get_script: max grep matches.'),
  startLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For get_script: 1-based start of a line range (inclusive).'),
  endLine: z.number().int().positive().optional().describe('For get_script: 1-based end of a line range (inclusive).'),
  format: z
    .enum(['path', 'inline'])
    .default('path')
    .optional()
    .describe(
      `For get_image: "path" (default) writes to a temp file and returns the path — safe for large images. "inline" returns base64; auto-falls-back to path if the image exceeds ${INLINE_BASE64_LIMIT} bytes.`
    ),
  // clone params
  targetPosition: z.object({ x: z.number(), y: z.number() }).optional().describe('For clone: where to place the part.'),
  scale: z.number().positive().default(1).optional().describe('For clone: uniform scale factor.'),
  rotation: z
    .number()
    .default(0)
    .optional()
    .describe(
      "For clone: rotation in DEGREES about the target position — turns drag points, the center, and the type's orientation field (Flipper start/end angle, Kicker/Bumper orientation, Gate/Spinner/Trigger rotation, Primitive rot_and_tra Z, HitTarget/Rubber/Flasher rot_z)."
    ),
  textureOverride: z
    .string()
    .optional()
    .describe('For clone: replace any "image" property in the donor part with this image name.'),
  renamePrefix: z
    .string()
    .optional()
    .describe(
      'For clone: prefix added to part/material/image names to avoid collisions. ' +
        'Sounds keep their donor names — the lifted script references them verbatim.'
    ),
  exactName: z
    .string()
    .optional()
    .describe(
      'For clone: name the cloned part exactly this (instead of renamePrefix + donor name) — e.g. the switch name a GLF config references. Event-handler Subs are renamed to match.'
    ),
  geometryOnly: z
    .boolean()
    .optional()
    .describe(
      "For clone: copy only the part + materials/images/mesh, skipping the donor's script Subs and sounds (a GLF mechanism gets its logic from CreateGlf* config, not the donor's ROM subs)."
    ),
  ...confirmable,
});

const library: Tool<typeof libraryInput> = {
  name: 'vpx_library',
  annotations: { destructiveHint: true },
  description:
    'Study any .vpx on disk by absolute path and (optionally) clone a part from it into the active table. ' +
    'When the user points at a table to copy or learn from, start with "inspect", then "get_script" to see how its parts are wired. Dispatch by `action`: ' +
    '"inspect" (full structural overview: parts by type, collections, assets, script Sub index), "get_script" (read the donor VBS by Sub/grep/range), ' +
    '"extract_bundle" (part + every material/image/sound/mesh/sub it references), "clone" (copy a part with all its dependencies into the active table), ' +
    '"get_image" (image bytes). Only "clone" mutates the active table; the rest are read-only and need no table open. ' +
    'For scaffolding NEW GLF tables and devices, prefer vpx_new and vpx_glf.',
  inputSchema: libraryInput,
  async execute(input, ctx) {
    if (!input.tablePath)
      return errorResult(`action="${input.action}" requires \`tablePath\` (absolute path to a .vpx).`);
    if (!(await fs.pathExists(input.tablePath))) return errorResult(`Donor table not found: ${input.tablePath}`);

    if (input.action === 'inspect') {
      const state = await ctx.loadTable(input.tablePath);
      if (!state) return errorResult(`Could not read donor table: ${input.tablePath}`);
      const { summarizeDonorTable } = await import('../library/inspect.js');
      return jsonResult(summarizeDonorTable(state, input.tablePath));
    }

    if (input.action === 'get_script') {
      const state = await ctx.loadTable(input.tablePath);
      if (!state) return errorResult(`Could not read donor table: ${input.tablePath}`);
      const { findSubs, grep, splitLines } = await import('../../../shared/vbs-analysis.js');

      if (input.subName) {
        const wanted = input.subName.toLowerCase();
        const sub = findSubs(state.script).find(s => s.name.toLowerCase() === wanted);
        if (!sub)
          return errorResult(
            `No Sub/Function named "${input.subName}" in donor script. Run action="inspect" for the Sub index.`
          );
        return jsonResult({
          tablePath: input.tablePath,
          subName: sub.name,
          kind: sub.kind,
          startLine: sub.startLine,
          endLine: sub.endLine,
          content: `${sub.header}\n${sub.body}`,
        });
      }

      if (input.pattern) {
        const pattern = input.isRegex ? new RegExp(input.pattern, 'i') : input.pattern;
        try {
          const matches = grep(state.script, pattern, input.contextLines ?? 2);
          const limit = input.limit ?? 100;
          return jsonResult({
            tablePath: input.tablePath,
            total: matches.length,
            matches: matches.slice(0, limit),
            truncated: matches.length > limit,
          });
        } catch (err) {
          return errorResult(`Search failed: ${(err as Error).message}`);
        }
      }

      const lines = splitLines(state.script);
      if (input.startLine !== undefined || input.endLine !== undefined) {
        const start = input.startLine ?? 1;
        const end = Math.min(input.endLine ?? lines.length, lines.length);
        if (start > end) return errorResult(`Invalid range: startLine ${start} > endLine ${end}.`);
        return jsonResult({
          tablePath: input.tablePath,
          startLine: start,
          endLine: end,
          totalLines: lines.length,
          content: lines.slice(start - 1, end).join('\n'),
        });
      }

      if (state.script.length > FULL_SCRIPT_LIMIT) {
        return errorResult(
          `Donor script is ${state.script.length} bytes (limit ${FULL_SCRIPT_LIMIT} for a full read). ` +
            'Narrow it with `subName`, `pattern`, or `startLine`/`endLine` — action="inspect" lists every Sub with its line range.'
        );
      }
      return jsonResult({
        tablePath: input.tablePath,
        sizeBytes: state.script.length,
        totalLines: lines.length,
        script: state.script,
      });
    }

    if (input.action === 'extract_bundle') {
      if (!input.partName) return errorResult('action="extract_bundle" requires `partName`.');
      const state = await ctx.loadTable(input.tablePath);
      if (!state) return errorResult(`Could not read donor table: ${input.tablePath}`);
      const { buildBundle } = await import('../library/bundle.js');
      const bundle = await buildBundle(state, input.partName);
      if (!bundle) return errorResult(`Part not found in donor: ${input.partName}`);
      return jsonResult(bundle);
    }

    if (input.action === 'clone') {
      if (!input.partName) return errorResult('action="clone" requires `partName`.');
      if (!input.targetPosition) return errorResult('action="clone" requires `targetPosition` ({x, y}).');
      // Donor state is loaded only when actually applying; preview returns without a roundtrip.
      let donorState = null;
      if (input.confirm) {
        donorState = await ctx.loadTable(input.tablePath);
        if (!donorState) return errorResult(`Could not read donor table: ${input.tablePath}`);
      }
      return runEdit(ctx, {
        kind: 'clone-bundle',
        payload: {
          donorState,
          donorTablePath: input.tablePath,
          partName: input.partName,
          targetPosition: input.targetPosition,
          scale: input.scale ?? 1,
          rotation: input.rotation ?? 0,
          textureOverride: input.textureOverride ?? null,
          renamePrefix: input.renamePrefix ?? null,
          exactName: input.exactName ?? null,
          geometryOnly: input.geometryOnly ?? false,
        },
        description: `Clone "${input.partName}" from ${input.tablePath}`,
        preview: !input.confirm,
      });
    }

    // get_image
    if (!input.imageName) return errorResult('action="get_image" requires `imageName`.');
    const { readDonorImage } = await import('../library/library-assets.js');
    const result = await readDonorImage(input.tablePath, ctx.vpx, input.imageName);
    if ('error' in result) return errorResult(result.error);

    const requestedFormat = input.format ?? 'path';
    const tooBigForInline = requestedFormat === 'inline' && result.bytes.length > INLINE_BASE64_LIMIT;
    const useInline = requestedFormat === 'inline' && !tooBigForInline;

    const base = {
      tablePath: input.tablePath,
      imageName: input.imageName,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
      sizeBytes: result.bytes.length,
    };

    if (useInline) {
      return jsonResult({ ...base, format: 'inline', base64: result.bytes.toString('base64') });
    }
    const path = await import('node:path');
    const os = await import('node:os');
    const ext = path.extname(result.internalName) || (result.mimeType.includes('jpeg') ? '.jpg' : '.png');
    const outDir = path.join(os.tmpdir(), 'vpx-mcp-library-images');
    await fs.ensureDir(outDir);
    const outFile = path.join(outDir, `${path.basename(input.tablePath, '.vpx')}__${input.imageName}${ext}`);
    await fs.promises.writeFile(outFile, result.bytes);
    return jsonResult({
      ...base,
      format: 'path',
      path: outFile,
      ...(tooBigForInline
        ? { note: `Image exceeded ${INLINE_BASE64_LIMIT} byte inline limit; auto-fell-back to path mode.` }
        : {}),
    });
  },
};

export function buildLibraryTools(): Tool[] {
  return [library];
}
