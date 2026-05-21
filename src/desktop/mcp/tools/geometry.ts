import path from 'node:path';
import fs from 'fs-extra';
import { z } from 'zod';
import { errorResult, jsonResult, type Tool, type ToolContext } from '../types.js';
import type { ObjExchangeOptions } from '../../../shared/obj-transform.js';
import { NO_ACTIVE_TABLE, resolveOutputDir } from './edit-util.js';
import { objOrientation, objUnit } from './mesh.js';
import { OBJ_ORIENTATION_VPX, UNIT_CONVERSION_VPU } from '../../../shared/constants.js';

interface Bbox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface PartSummary {
  name: string;
  type: string;
  bbox: Bbox;
  centroid?: { x: number; y: number; z: number };
  triangleCount?: number;
  visible?: boolean;
  [key: string]: unknown;
}

const MIN_OVERLAP = 1;
const MAX_OVERLAPS = 40;
const DEFAULT_LIMIT = 100;

function round1(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 10) / 10;
  if (Array.isArray(v)) return v.map(round1);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, round1(x)]));
  }
  return v;
}

function compactPart(part: PartSummary, detail: boolean): Record<string, unknown> {
  if (detail) return round1(part) as Record<string, unknown>;
  const { name, type, bbox, centroid, triangleCount, visible } = part;
  return round1({ name, type, bbox, centroid, triangleCount, ...(visible === false ? { visible } : {}) }) as Record<
    string,
    unknown
  >;
}

function overlapAxis(a: Bbox, b: Bbox, axis: 'x' | 'y' | 'z'): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function findOverlaps(parts: PartSummary[]): { pairs: Record<string, unknown>[]; total: number } {
  const pairs: { a: string; b: string; overlap: { x: number; y: number; z: number }; volume: number }[] = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const x = overlapAxis(parts[i].bbox, parts[j].bbox, 'x');
      const y = overlapAxis(parts[i].bbox, parts[j].bbox, 'y');
      const z = overlapAxis(parts[i].bbox, parts[j].bbox, 'z');
      if (x < MIN_OVERLAP || y < MIN_OVERLAP || z < MIN_OVERLAP) continue;
      pairs.push({ a: parts[i].name, b: parts[j].name, overlap: { x, y, z }, volume: x * y * z });
    }
  }
  pairs.sort((p, q) => q.volume - p.volume);
  return {
    total: pairs.length,
    pairs: pairs.slice(0, MAX_OVERLAPS).map(p => ({
      parts: [p.a, p.b],
      overlap: { x: Math.round(p.overlap.x), y: Math.round(p.overlap.y), z: Math.round(p.overlap.z) },
    })),
  };
}

const geometryInput = z.object({
  action: z
    .enum(['summary', 'overlaps', 'export_obj'])
    .describe(
      '"summary": world-space mesh measurements per part (bbox, centroid, triangle count; `detail:true` adds shape scores). ' +
        '"overlaps": pairs of parts whose bounding boxes intersect — placement collision candidates. ' +
        '"export_obj": write the visible geometry as OBJ+MTL files (same as File > Export OBJ, with `unit`/`orientation` for Blender) and return their paths.'
    ),
  parts: z.array(z.string()).optional().describe('Limit to these part names (default: all parts with geometry).'),
  region: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional()
    .describe('Limit to parts whose bbox intersects this playfield-coordinate rectangle.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe(
      `For "summary": max parts to return (default ${DEFAULT_LIMIT}); narrow with parts/region instead of raising it.`
    ),
  detail: z.boolean().optional().describe('For "summary": include shape scores and size per part.'),
  outputDir: z
    .string()
    .optional()
    .describe(
      'For "export_obj": absolute directory for the files (default: a "<table>_export" folder next to the saved .vpx, or a temp folder for an unsaved table; never inside the work dir).'
    ),
  unit: objUnit.optional().describe('For "export_obj": units to write (default "vpu").'),
  orientation: objOrientation.optional().describe('For "export_obj": axis convention to write (default "vpx").'),
});

const geometry: Tool<typeof geometryInput> = {
  name: 'vpx_geometry',
  annotations: { readOnlyHint: false, destructiveHint: false },
  description:
    'MEASURE the active table — numeric ground truth about part geometry in VPX units (z = height above the playfield). ' +
    'Use after placing or moving parts to verify real positions, heights, and collisions instead of eyeballing screenshots: ' +
    '"summary" returns per-part world bbox/centroid, "overlaps" flags intersecting bounding boxes, "export_obj" writes OBJ+MTL files for Blender. ' +
    'Covers parts with meshes (walls, ramps, flippers, bumpers, primitives…); lights and script-only parts have none. ' +
    "Parts hidden by the user's layer/view state are still measured, marked visible:false.",
  inputSchema: geometryInput,
  async execute(input, ctx) {
    if (input.action === 'export_obj') {
      return exportObj(ctx, input.outputDir, {
        unit: input.unit ?? UNIT_CONVERSION_VPU,
        orientation: input.orientation ?? OBJ_ORIENTATION_VPX,
      });
    }
    const result = await ctx.queryGeometry({ parts: input.parts, region: input.region });
    if (result.success !== true) return errorResult((result.error as string) ?? NO_ACTIVE_TABLE);

    const parts = (result.parts as PartSummary[]) ?? [];
    const base = {
      table: result.table,
      units: 'VPX units; z is height above the playfield surface (0 = playfield)',
      ...(result.notFound ? { notFound: result.notFound } : {}),
      ...(result.noMesh ? { noMesh: result.noMesh } : {}),
    };

    if (input.action === 'overlaps') {
      const { pairs, total } = findOverlaps(parts);
      return jsonResult({
        ...base,
        partCount: parts.length,
        overlaps: pairs,
        total,
        truncated: total > pairs.length,
        note:
          'Bounding-box test: touching neighbors and rotated/curved parts can appear here without truly colliding — ' +
          'confirm suspicious pairs with vpx_view. Empty means no bbox intersections.',
      });
    }

    const limit = input.limit ?? DEFAULT_LIMIT;
    return jsonResult({
      ...base,
      total: parts.length,
      truncated: parts.length > limit,
      parts: parts.slice(0, limit).map(p => compactPart(p, !!input.detail)),
    });
  },
};

async function exportObj(ctx: ToolContext, outputDir: string | undefined, exchange: ObjExchangeOptions) {
  const handle = await ctx.getActiveTable();
  if (!handle) return errorResult(NO_ACTIVE_TABLE);
  const dir = resolveOutputDir(handle, outputDir);
  if (typeof dir !== 'string') return errorResult(dir.error);

  const baseName = handle.tableName ?? 'table';
  const mtlFileName = `${baseName}.mtl`;
  const result = await ctx.exportObj(mtlFileName, exchange);
  if (result.success !== true) return errorResult((result.error as string) ?? 'Export failed');

  await fs.ensureDir(dir);
  const objPath = path.join(dir, `${baseName}.obj`);
  const mtlPath = path.join(dir, mtlFileName);
  await fs.writeFile(objPath, result.obj as string);
  await fs.writeFile(mtlPath, result.mtl as string);

  return jsonResult({
    objPath,
    mtlPath,
    objBytes: Buffer.byteLength(result.obj as string),
    unit: exchange.unit,
    orientation: exchange.orientation,
    note: 'Visible geometry only (lights/flashers/plungers have no mesh). Files are overwritten on re-export. For Blender pass unit:"mm" (or "m"), orientation:"y-up-rh".',
  });
}

export function buildGeometryTools(): Tool[] {
  return [geometry];
}
