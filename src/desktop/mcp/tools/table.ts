import { z } from 'zod';
import { findItem, itemsByType, summarizeCounts, getPlayfieldBounds } from '../../../shared/table-state.js';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE } from './edit-util.js';

const tableInput = z.object({
  action: z
    .enum(['overview', 'parts', 'part', 'part_groups', 'collections', 'info', 'windows', 'attach'])
    .describe(
      '"overview": path, name, dimensions, part counts. ' +
        '"parts": list parts (filter via type/nameRegex/partGroup/layer/limit). ' +
        '"part": full JSON for one part (use `name`). ' +
        '"part_groups": layer/part-group hierarchy. ' +
        '"collections": user-defined collections + members. ' +
        '"info": table metadata (gamedata + info merged). ' +
        '"windows": list open editor windows with a table (this session works on ONE attached window). ' +
        '"attach": re-attach this session to a window (use `windowId` from "windows").'
    ),
  name: z.string().optional().describe('For action="part": the exact part name (case-insensitive).'),
  windowId: z.string().optional().describe('For action="attach": the window id to attach this session to.'),
  type: z.string().optional().describe('For action="parts": filter by item type (e.g. "Flipper", "Primitive").'),
  nameRegex: z.string().optional().describe('For action="parts": case-insensitive regex matched against item names.'),
  partGroup: z.string().optional().describe('For action="parts": filter by part group name.'),
  layer: z.number().int().optional().describe('For action="parts": filter by editor layer index.'),
  limit: z.number().int().positive().max(2000).default(200).optional().describe('For action="parts": max items.'),
});

const table: Tool<typeof tableInput> = {
  name: 'vpx_table',
  annotations: { readOnlyHint: true },
  description:
    'Read-only inspection of the active table. Dispatch by `action`: ' +
    '"overview" (path/name/dimensions/counts), "parts" (filtered part list), "part" (full JSON for one part by `name`), ' +
    '"part_groups" (layer hierarchy), "collections" (collections + members), "info" (gamedata + info metadata), ' +
    '"windows" (open editor windows; this session is pinned to one), "attach" (pin the session to `windowId`). ' +
    'For materials use vpx_material, for images use vpx_image, for the VBS script use vpx_script.',
  inputSchema: tableInput,
  async execute(input, ctx) {
    if (input.action === 'windows') {
      const windows = await ctx.listWindows();
      return jsonResult({
        count: windows.length,
        windows,
        note: 'This session is attached to at most one window; edits go there regardless of which window the user focuses. Use action:"attach" to switch.',
      });
    }

    if (input.action === 'attach') {
      if (!input.windowId) return errorResult('action="attach" requires `windowId` (see action:"windows").');
      const result = await ctx.attachWindow(input.windowId);
      if (!result.ok) return errorResult(result.error ?? 'Attach failed');
      return jsonResult({ attached: true, ...result.handle });
    }

    const state = await ctx.loadActiveState();
    if (!state) return errorResult(NO_ACTIVE_TABLE);

    if (input.action === 'overview') {
      const handle = await ctx.getActiveTable();
      return jsonResult({
        tableName: handle?.tableName ?? state.info.table_name ?? null,
        vpxPath: handle?.vpxPath ?? null,
        workDir: state.workDir,
        isLocked: handle?.isLocked ?? false,
        author: state.info.author_name ?? null,
        releaseDate: state.info.release_date ?? null,
        bounds: getPlayfieldBounds(state),
        partCounts: summarizeCounts(state),
        totalParts: state.items.length,
        materialsCount: state.materials.length,
        imagesCount: state.images.length,
        soundsCount: state.sounds.length,
        collectionsCount: state.collections.length,
        scriptSizeBytes: state.script.length,
      });
    }

    if (input.action === 'parts') {
      let items = state.items;
      if (input.type) items = items.filter(i => i.type.toLowerCase() === input.type!.toLowerCase());
      if (input.nameRegex) {
        try {
          const re = new RegExp(input.nameRegex, 'i');
          items = items.filter(i => re.test(i.name));
        } catch (e) {
          return errorResult(`Invalid nameRegex: ${(e as Error).message}`);
        }
      }
      if (input.partGroup)
        items = items.filter(i => (i.data.part_group_name as string | undefined) === input.partGroup);
      if (input.layer !== undefined) items = items.filter(i => i.ref.editor_layer === input.layer);
      const limit = input.limit ?? 200;
      const truncated = items.length > limit;
      items = items.slice(0, limit);
      return jsonResult({
        total: state.items.length,
        matched: items.length,
        truncated,
        items: items.map(i => ({
          name: i.name,
          type: i.type,
          partGroup: i.data.part_group_name ?? null,
          layer: i.ref.editor_layer ?? null,
          isLocked: i.ref.is_locked ?? false,
          center: i.data.center ?? i.data.position ?? null,
        })),
      });
    }

    if (input.action === 'part') {
      if (!input.name) return errorResult('action="part" requires `name`.');
      const item = findItem(state, input.name);
      if (!item) return errorResult(`Part not found: ${input.name}`);
      return jsonResult({
        name: item.name,
        type: item.type,
        fileName: item.fileName,
        ref: item.ref,
        data: item.data,
      });
    }

    if (input.action === 'part_groups') {
      const groups = itemsByType(state, 'PartGroup');
      const counts = new Map<string, number>();
      for (const item of state.items) {
        const g = (item.data.part_group_name as string | undefined) ?? '';
        counts.set(g, (counts.get(g) || 0) + 1);
      }
      return jsonResult({
        partGroupItems: groups.map(g => ({ name: g.name, isLocked: g.ref.is_locked ?? false })),
        memberCounts: Object.fromEntries(counts),
      });
    }

    if (input.action === 'collections') {
      return jsonResult({ count: state.collections.length, collections: state.collections });
    }

    return jsonResult({ gamedata: state.gamedata, info: state.info });
  },
};

export function buildTableTools(): Tool[] {
  return [table];
}
