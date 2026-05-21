import fs from 'fs-extra';
import path from 'node:path';
import {
  generateMtlContent,
  parseMtlContent,
  type MeshImportOptions,
  type ParsedMaterial,
} from '../features/mesh-import/shared/component.js';
import {
  defaultExchange,
  exportMeshIoOptions,
  importMeshIoOptions,
  insertObjHeaderComment,
  isIdentityExchange,
  type ObjExchangeOptions,
} from '../shared/obj-transform.js';
import { UNIT_CONVERSION_VPU } from '../shared/constants.js';

type Vpin = typeof import('@francisdb/vpin-wasm');

export type MeshImportOutcome =
  | { success: true; path: string; materialName?: string; primitive: Record<string, unknown> }
  | { success: false; error: string };

export async function importPrimitiveMesh(
  vpin: Vpin,
  extractedDir: string,
  primitiveFileName: string,
  filePath: string,
  options: MeshImportOptions
): Promise<MeshImportOutcome> {
  const destFileName = primitiveFileName.replace('.json', '.obj');
  const destPath = path.join(extractedDir, destFileName);
  const primitivePath = path.join(extractedDir, primitiveFileName);

  try {
    const buffer = await fs.promises.readFile(filePath);
    const exchange = defaultExchange(options.unit ?? UNIT_CONVERSION_VPU, options.orientation);
    const mesh = vpin.obj_to_mesh(new Uint8Array(buffer), importMeshIoOptions(exchange));
    const midpoint = mesh.midpoint;

    let positions = mesh.positions;
    if (options.centerMesh || options.absolutePosition) {
      const shifted = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        shifted[i] = positions[i] - midpoint[0];
        shifted[i + 1] = positions[i + 1] - midpoint[1];
        shifted[i + 2] = positions[i + 2] - midpoint[2];
      }
      positions = shifted;
    }

    const processedBytes = vpin.mesh_to_obj('mesh', positions, mesh.texCoords, mesh.normals, mesh.indices, null);
    mesh.free();

    await fs.promises.writeFile(destPath, Buffer.from(processedBytes));

    const primData = JSON.parse(await fs.promises.readFile(primitivePath, 'utf-8'));
    const primType = Object.keys(primData)[0];
    const prim = primData[primType] as Record<string, unknown>;

    prim.use_3d_mesh = true;

    if (options.absolutePosition) {
      prim.position = { x: midpoint[0], y: midpoint[1], z: midpoint[2] };
      prim.size = { x: 1, y: 1, z: 1 };
    }

    let materialName: string | undefined;
    if (options.importMaterial) {
      const mtlPath = filePath.replace(/\.obj$/i, '.mtl');
      try {
        const material = parseMtlContent(await fs.promises.readFile(mtlPath, 'utf-8'));
        if (material) {
          await addMaterialToTable(extractedDir, material);
          prim.material = material.name;
          materialName = material.name;
        }
      } catch (mtlErr: unknown) {
        console.warn('Could not load material file:', (mtlErr as Error).message);
      }
    }

    await fs.promises.writeFile(primitivePath, JSON.stringify(primData, null, 2));
    return { success: true, path: destPath, materialName, primitive: prim };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

async function addMaterialToTable(extractedDir: string, material: { name: string }): Promise<void> {
  const materialsPath = path.join(extractedDir, 'materials.json');
  let materials: { name: string }[] = [];
  try {
    materials = JSON.parse(await fs.promises.readFile(materialsPath, 'utf-8'));
  } catch {
    materials = [];
  }
  if (!materials.some(m => m.name === material.name)) {
    materials.push(material);
    await fs.promises.writeFile(materialsPath, JSON.stringify(materials, null, 2));
  }
}

async function findPrimitiveMaterial(
  extractedDir: string,
  primitiveFileName: string
): Promise<{ materialName: string; material: ParsedMaterial } | null> {
  try {
    const itemData = JSON.parse(await fs.promises.readFile(path.join(extractedDir, primitiveFileName), 'utf-8'));
    const matName = itemData.Primitive?.material;
    if (!matName) return null;
    const materials = JSON.parse(
      await fs.promises.readFile(path.join(extractedDir, 'materials.json'), 'utf-8')
    ) as ParsedMaterial[];
    const found = materials.find(m => m.name === matName);
    return found ? { materialName: matName, material: found } : null;
  } catch {
    return null;
  }
}

export interface PrimitiveObjExport {
  obj: string;
  mtl: string | null;
}

export async function buildPrimitiveObjExport(
  vpin: Vpin,
  extractedDir: string,
  primitiveFileName: string,
  exchange: ObjExchangeOptions | undefined,
  mtlFileName: string
): Promise<PrimitiveObjExport | null> {
  const options = defaultExchange(exchange?.unit ?? UNIT_CONVERSION_VPU, exchange?.orientation);
  const srcPath = path.join(extractedDir, primitiveFileName.replace('.json', '.obj'));
  const hasObjFile = await fs.pathExists(srcPath);

  let objContent: string | null = null;
  if (!hasObjFile) {
    const itemData = JSON.parse(await fs.promises.readFile(path.join(extractedDir, primitiveFileName), 'utf-8'));
    const prim = itemData.Primitive;
    if (!prim || prim.use_3d_mesh) return null;
    const mesh = vpin.generate_builtin_primitive(prim.sides ?? 4, !!prim.draw_textures_inside);
    const objBytes = vpin.mesh_to_obj(
      prim.name || 'primitive',
      mesh.positions,
      mesh.texCoords,
      mesh.normals,
      mesh.indices,
      exportMeshIoOptions(options)
    );
    mesh.free();
    objContent = Buffer.from(objBytes).toString('utf-8');
  } else if (!isIdentityExchange(options)) {
    const mesh = vpin.obj_to_mesh(new Uint8Array(await fs.promises.readFile(srcPath)), null);
    const objBytes = vpin.mesh_to_obj(
      mesh.name || 'mesh',
      mesh.positions,
      mesh.texCoords,
      mesh.normals,
      mesh.indices,
      exportMeshIoOptions(options)
    );
    mesh.free();
    objContent = Buffer.from(objBytes).toString('utf-8');
  } else {
    objContent = await fs.promises.readFile(srcPath, 'utf-8');
  }

  const matInfo = await findPrimitiveMaterial(extractedDir, primitiveFileName);
  if (matInfo) {
    const mtlRef = `mtllib ${mtlFileName}\nusemtl ${matInfo.materialName}\n`;
    const firstNewline = objContent.indexOf('\n');
    if (firstNewline >= 0) {
      objContent = objContent.slice(0, firstNewline + 1) + mtlRef + objContent.slice(firstNewline + 1);
    }
  }
  return {
    obj: insertObjHeaderComment(objContent, options),
    mtl: matInfo ? generateMtlContent(matInfo.materialName, matInfo.material) : null,
  };
}
