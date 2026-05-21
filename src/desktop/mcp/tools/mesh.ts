import path from 'node:path';
import fs from 'fs-extra';
import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { NO_ACTIVE_TABLE, resolveOutputDir } from './edit-util.js';
import { parseObjHeaderComment } from '../../../shared/obj-transform.js';
import {
  OBJ_ORIENTATION_VPX,
  OBJ_ORIENTATION_Y_UP_RH,
  UNIT_CONVERSION_INCHES,
  UNIT_CONVERSION_M,
  UNIT_CONVERSION_MM,
  UNIT_CONVERSION_VPU,
} from '../../../shared/constants.js';

export const objUnit = z
  .enum([UNIT_CONVERSION_VPU, UNIT_CONVERSION_INCHES, UNIT_CONVERSION_MM, UNIT_CONVERSION_M])
  .describe('Length unit of the OBJ file. "vpu" = raw Visual Pinball units (50 vpu ≈ 1 inch).');

export const objOrientation = z
  .enum([OBJ_ORIENTATION_VPX, OBJ_ORIENTATION_Y_UP_RH])
  .describe(
    'Axis convention of the OBJ file: "vpx" (z-down, VPX native) or "y-up-rh" (Blender/glTF style, y up, right-handed).'
  );

const meshInput = z.object({
  action: z
    .enum(['import', 'export'])
    .describe(
      '"import": replace a Primitive\'s mesh with an OBJ file from disk (Blender output, a downloaded model, …). ' +
        '"export": write one Primitive\'s mesh (+MTL when it has a material) to disk for editing in Blender.'
    ),
  partName: z.string().describe('Name of an existing Primitive part (add one with vpx_part first if needed).'),
  path: z.string().optional().describe('For "import": absolute path to the .obj file.'),
  outputDir: z
    .string()
    .optional()
    .describe(
      'For "export": absolute directory for the files (default: a "<table>_export" folder next to the saved .vpx, or a temp folder for an unsaved table; never inside the work dir).'
    ),
  unit: objUnit
    .optional()
    .describe(
      'Units the OBJ is in (import) or should be written in (export). On import, defaults to the "# vpx-editor" header written by this editor\'s exports, else "vpu".'
    ),
  orientation: objOrientation
    .optional()
    .describe('Axis convention (import: of the file; export: to write). Same default rule as `unit`.'),
  centerMesh: z
    .boolean()
    .optional()
    .describe('For "import": recentre the mesh on its midpoint so the part\'s position places it (default true).'),
  absolutePosition: z
    .boolean()
    .optional()
    .describe(
      'For "import": the OBJ is already in table coordinates — move the part to the mesh midpoint and reset size to 1 (default false).'
    ),
  importMaterial: z
    .boolean()
    .optional()
    .describe(
      'For "import": read the sibling .mtl and assign its material to the part (default true when one exists).'
    ),
});

const mesh: Tool<typeof meshInput> = {
  name: 'vpx_mesh',
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  description:
    "Move Primitive meshes between the table and OBJ files, converting units and axes on the way (the same path as the editor's Mesh Import/Export). " +
    '"import" a Blender-made OBJ onto an existing Primitive (vpx_part add a Primitive first, then import into it); ' +
    '"export" one Primitive\'s mesh for external editing. Exported files carry a "# vpx-editor units=… orientation=…" header, ' +
    'so re-importing a file this tool exported needs no unit/orientation arguments. For the whole table use vpx_geometry(action:"export_obj").',
  inputSchema: meshInput,
  async execute(input, ctx) {
    const handle = await ctx.getActiveTable();
    if (!handle) return errorResult(NO_ACTIVE_TABLE);

    if (input.action === 'import') {
      if (!input.path) return errorResult('action="import" requires `path` (absolute path to an .obj file).');
      if (!path.isAbsolute(input.path)) return errorResult('`path` must be absolute.');
      if (!(await fs.pathExists(input.path))) return errorResult(`OBJ file not found: ${input.path}`);
      const head = await readHead(input.path);
      const header = parseObjHeaderComment(head);
      const unit = input.unit ?? header?.unit ?? UNIT_CONVERSION_VPU;
      const orientation = input.orientation ?? header?.orientation ?? OBJ_ORIENTATION_VPX;
      const mtlExists = await fs.pathExists(input.path.replace(/\.obj$/i, '.mtl'));
      const result = await ctx.importPrimitiveMesh({
        partName: input.partName,
        filePath: input.path,
        unit,
        orientation,
        centerMesh: input.centerMesh ?? true,
        absolutePosition: input.absolutePosition ?? false,
        importMaterial: input.importMaterial ?? mtlExists,
      });
      if (!result.ok) return errorResult(result.error);
      const prim = result.primitive;
      return jsonResult({
        imported: true,
        partName: input.partName,
        meshPath: result.path,
        unit,
        orientation,
        unitSource: input.unit ? 'argument' : header ? 'obj header' : 'default',
        position: prim.position,
        size: prim.size,
        ...(result.materialName ? { material: result.materialName } : {}),
        nextStep:
          'Verify placement with vpx_geometry(action:"summary", parts:[partName]) or vpx_view(view:"3d"); adjust with vpx_part(action:"modify").',
      });
    }

    const dir = resolveOutputDir(handle, input.outputDir);
    if (typeof dir !== 'string') return errorResult(dir.error);
    const base = input.partName.replace(/[^A-Za-z0-9_.-]+/g, '_');
    const mtlFileName = `${base}.mtl`;
    const exchange =
      input.unit || input.orientation
        ? { unit: input.unit ?? UNIT_CONVERSION_VPU, orientation: input.orientation ?? OBJ_ORIENTATION_VPX }
        : undefined;
    const result = await ctx.exportPrimitiveMesh({ partName: input.partName, mtlFileName, exchange });
    if (!result.ok) return errorResult(result.error);
    await fs.ensureDir(dir);
    const objPath = path.join(dir, `${base}.obj`);
    await fs.writeFile(objPath, result.obj, 'utf-8');
    let mtlPath: string | null = null;
    if (result.mtl) {
      mtlPath = path.join(dir, mtlFileName);
      await fs.writeFile(mtlPath, result.mtl, 'utf-8');
    }
    return jsonResult({
      objPath,
      mtlPath,
      unit: exchange?.unit ?? UNIT_CONVERSION_VPU,
      orientation: exchange?.orientation ?? OBJ_ORIENTATION_VPX,
      note: 'The OBJ header records units/orientation, so vpx_mesh(action:"import") of an edited copy needs no extra arguments.',
    });
  },
};

async function readHead(filePath: string): Promise<string> {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await fh.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf-8');
  } finally {
    await fh.close();
  }
}

export function buildMeshTools(): Tool[] {
  return [mesh];
}
