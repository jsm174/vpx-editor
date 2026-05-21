import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { buildPrimitiveObjExport, importPrimitiveMesh } from './mesh-exchange.js';
import { parseObjHeaderComment } from '../shared/obj-transform.js';
import { OBJ_ORIENTATION_Y_UP_RH, UNIT_CONVERSION_MM } from '../shared/constants.js';

let vpin: typeof import('@francisdb/vpin-wasm');
let dir: string;
const primFile = 'gameitems/Primitive.Box.json';

beforeAll(async () => {
  vpin = await import('@francisdb/vpin-wasm');
  await vpin.default({
    module_or_path: fs.readFileSync(path.join(process.cwd(), 'node_modules/@francisdb/vpin-wasm/vpin_bg.wasm')),
  });
  dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vpx-mesh-exchange-'));
  await fs.ensureDir(path.join(dir, 'gameitems'));
  await fs.writeJson(path.join(dir, primFile), {
    Primitive: {
      name: 'Box',
      use_3d_mesh: false,
      sides: 4,
      position: { x: 100, y: 200, z: 0 },
      size: { x: 20, y: 20, z: 20 },
    },
  });
  await fs.writeJson(path.join(dir, 'materials.json'), []);
});

afterAll(async () => {
  await fs.remove(dir);
});

describe('primitive mesh exchange', () => {
  it('exports a builtin primitive in Blender units and re-imports it via the header', async () => {
    const exchange = { unit: UNIT_CONVERSION_MM, orientation: OBJ_ORIENTATION_Y_UP_RH };
    const exported = await buildPrimitiveObjExport(vpin, dir, primFile, exchange, 'Box.mtl');
    expect(exported).not.toBeNull();
    expect(parseObjHeaderComment(exported!.obj)).toEqual(exchange);

    const objPath = path.join(dir, 'Box.obj');
    await fs.writeFile(objPath, exported!.obj);
    const header = parseObjHeaderComment(exported!.obj)!;
    const imported = await importPrimitiveMesh(vpin, dir, primFile, objPath, {
      unit: header.unit,
      orientation: header.orientation,
      centerMesh: true,
      absolutePosition: false,
      importMaterial: false,
    });
    expect(imported.success).toBe(true);
    if (!imported.success) return;
    expect(imported.primitive.use_3d_mesh).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'gameitems/Primitive.Box.obj'))).toBe(true);

    const mesh = vpin.obj_to_mesh(
      new Uint8Array(await fs.promises.readFile(path.join(dir, 'gameitems/Primitive.Box.obj'))),
      null
    );
    const extent = Math.max(...Array.from(mesh.positions).map(Math.abs));
    mesh.free();
    expect(extent).toBeGreaterThan(0.4);
    expect(extent).toBeLessThan(0.6);
  });

  it('absolutePosition moves the part to the mesh midpoint', async () => {
    const mesh = vpin.generate_builtin_primitive(4, false);
    const shifted = Float32Array.from(mesh.positions);
    for (let i = 0; i < shifted.length; i += 3) {
      shifted[i] += 300;
      shifted[i + 1] += 400;
    }
    const bytes = vpin.mesh_to_obj('box', shifted, mesh.texCoords, mesh.normals, mesh.indices, null);
    mesh.free();
    const objPath = path.join(dir, 'placed.obj');
    await fs.writeFile(objPath, Buffer.from(bytes));
    const imported = await importPrimitiveMesh(vpin, dir, primFile, objPath, {
      unit: 'vpu',
      orientation: 'vpx',
      centerMesh: false,
      absolutePosition: true,
      importMaterial: false,
    });
    expect(imported.success).toBe(true);
    if (!imported.success) return;
    const pos = imported.primitive.position as { x: number; y: number };
    expect(Math.round(pos.x)).toBe(300);
    expect(Math.round(pos.y)).toBe(400);
    expect(imported.primitive.size).toEqual({ x: 1, y: 1, z: 1 });
  });
});
