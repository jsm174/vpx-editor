import { z } from 'zod';
import { errorResult, imageResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';

const viewInput = z.object({
  view: z
    .enum(['2d', '3d'])
    .default('2d')
    .optional()
    .describe(
      '"2d" (default): top-down editor view, whole table fitted unless `region` is given. ' +
        '"3d": the 3D preview as currently framed (requires the 3D view to have been opened in the editor at least once).'
    ),
  region: z
    .object({
      x: z.number().describe('Left edge in table units'),
      y: z.number().describe('Top edge in table units'),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional()
    .describe('2d only: zoom into this rectangle in table coordinates instead of fitting the whole table.'),
  max_width: z
    .number()
    .int()
    .min(256)
    .max(2048)
    .default(1024)
    .optional()
    .describe('Downscale the PNG to at most this many pixels wide (default 1024).'),
});

const view: Tool<typeof viewInput> = {
  name: 'vpx_view',
  title: 'View the table',
  annotations: { readOnlyHint: true },
  description:
    'LOOK at the active table — returns a PNG screenshot of the editor. Default is the 2D top-down view with the whole ' +
    'table fitted; pass `region` (table units: x right, y down, playfield is roughly 0..1000 wide and 0..2000 tall) to ' +
    'zoom into an area. Use this after adding or moving parts to visually verify placement, spot overlaps, and check ' +
    'lane geometry — do not place geometry blind. "3d" captures the 3D preview if the user has opened it.',
  inputSchema: viewInput,
  async execute(input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);

    const result = await ctx.captureView({
      view: input.view ?? '2d',
      region: input.region,
      maxWidth: input.max_width ?? 1024,
    });
    if (!result.ok || !result.dataUrl) {
      return errorResult(result.error ?? 'Capture failed');
    }
    const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    const where = input.region
      ? `region x=${input.region.x} y=${input.region.y} ${input.region.width}×${input.region.height}`
      : 'full table';
    const caption = `${handle.tableName ?? 'table'} — ${input.view === '3d' ? '3D preview' : `2D top-down (${where})`}${
      result.width ? `, ${result.width}×${result.height}px` : ''
    }`;
    return imageResult(base64, caption);
  },
};

export function buildViewTools(): Tool[] {
  return [view as unknown as Tool];
}
