import * as THREE from 'three';
import { state, isItemVisible, getItemByFileName, type GameItem, type Material } from './state.js';
import { getEditable } from './parts/index.js';
import { buildPrimitiveFullMatrix, buildPrimitiveExportGeometry } from './parts/primitive.js';
import type { GameData } from '../types/data.js';

// The element types that implement IEditable::ExportMesh upstream. Everything else
// (lights, flashers, decals, plungers, textboxes, reels) contributes no geometry.
const EXPORTABLE_TYPES = new Set([
  'Wall',
  'Ramp',
  'Rubber',
  'Flipper',
  'Bumper',
  'Gate',
  'Kicker',
  'Trigger',
  'Spinner',
  'HitTarget',
  'Primitive',
]);

// Upstream only consults the part's own visibility property in Ramp, Rubber,
// Primitive and Trigger. The rest are gated by sub-part flags (a wall's top/side,
// a bumper's base/ring/skirt/cap, a gate's or spinner's bracket, a kicker's type),
// which create3DMesh already honours, or are exported unconditionally.
const VISIBILITY_GATED_TYPES = new Set(['Ramp', 'Rubber', 'Primitive', 'Trigger']);

const DUMMY_MATERIAL_BASE = '#FF69B4';

interface ItemWithVisibility extends GameItem {
  is_visible?: boolean;
  visible?: boolean;
}

function f(v: number): string {
  return (Number.isFinite(v) ? v : 0).toFixed(6);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

class ObjWriter {
  private obj: string[] = [];
  private mtl: string[] = ['# Visual Pinball table mat file'];
  private faceOffset = 0;

  constructor(mtlFileName: string) {
    this.obj.push('# Visual Pinball table OBJ file');
    this.obj.push(`mtllib ${mtlFileName}`);
  }

  writeObjectName(name: string): void {
    this.obj.push(`o ${name}`);
  }

  writeVertexInfo(positions: THREE.Vector3[], uvs: { u: number; v: number }[], normals: THREE.Vector3[]): void {
    for (const p of positions) this.obj.push(`v ${f(p.x)} ${f(p.y)} ${f(-p.z)}`);
    for (const t of uvs) this.obj.push(`vt ${f(t.u)} ${f(1 - t.v)}`);
    for (const n of normals) this.obj.push(`vn ${f(n.x)} ${f(n.y)} ${f(-n.z)}`);
  }

  writeFaceInfoList(indices: ArrayLike<number>): void {
    this.obj.push('s 1');
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const a = indices[i + 2] + 1 + this.faceOffset;
      const b = indices[i + 1] + 1 + this.faceOffset;
      const c = indices[i] + 1 + this.faceOffset;
      this.obj.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
    }
  }

  updateFaceOffset(numVertices: number): void {
    this.faceOffset += numVertices;
  }

  writeMaterial(materialName: string): void {
    const material = state.materials[materialName] as
      (Material & { base_color?: string; glossy_color?: string; opacity?: number }) | undefined;
    const kd = hexToRgb(material?.base_color || DUMMY_MATERIAL_BASE);
    const ks = hexToRgb(material?.glossy_color || '#000000');
    const opacity = material?.opacity ?? 1.0;
    this.mtl.push(
      `newmtl ${materialName.replace(/ /g, '')}`,
      'Ns 7.843137',
      'Ka 0.000000 0.000000 0.000000',
      `Kd ${f(kd.r)} ${f(kd.g)} ${f(kd.b)}`,
      `Ks ${f(ks.r)} ${f(ks.g)} ${f(ks.b)}`,
      'Ni 1.500000',
      `d ${f(opacity)}`,
      'illum 5',
      ''
    );
  }

  useTexture(materialName: string): void {
    this.obj.push(`usemtl ${materialName}`);
  }

  getObj(): string {
    return this.obj.join('\n') + '\n';
  }

  getMtl(): string {
    return this.mtl.join('\n') + '\n';
  }
}

function writeGeometry(
  writer: ObjWriter,
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  materialName: string
): void {
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr) return;

  const count = positionAttr.count;
  const normalAttr = geometry.getAttribute('normal');
  const uvAttr = geometry.getAttribute('uv');

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const positions: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const uvs: { u: number; v: number }[] = [];

  for (let i = 0; i < count; i++) {
    positions.push(new THREE.Vector3().fromBufferAttribute(positionAttr, i).applyMatrix4(matrix));
    normals.push(
      normalAttr
        ? new THREE.Vector3().fromBufferAttribute(normalAttr, i).applyMatrix3(normalMatrix).normalize()
        : new THREE.Vector3(0, 0, 1)
    );
    uvs.push(uvAttr ? { u: uvAttr.getX(i), v: uvAttr.getY(i) } : { u: 0, v: 0 });
  }

  const index = geometry.getIndex();
  const indices = index ? index.array : Array.from({ length: count }, (_, i) => i);
  if (indices.length < 3) return;

  writer.writeVertexInfo(positions, uvs, normals);
  writer.writeMaterial(materialName);
  writer.useTexture(materialName);
  writer.writeFaceInfoList(indices);
  writer.updateFaceOffset(count);
}

function itemMaterialName(item: GameItem): string {
  const withMaterials = item as GameItem & { material?: string; top_material?: string; side_material?: string };
  return withMaterials.material || withMaterials.top_material || withMaterials.side_material || '';
}

function writePlayfield(writer: ObjWriter, gd: GameData): void {
  const left = gd.left ?? 0;
  const top = gd.top ?? 0;
  const right = gd.right ?? 0;
  const bottom = gd.bottom ?? 0;

  const positions = [
    new THREE.Vector3(left, top, 0),
    new THREE.Vector3(right, top, 0),
    new THREE.Vector3(left, bottom, 0),
    new THREE.Vector3(right, bottom, 0),
  ];
  const uvs = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 0, v: 1 },
    { u: 1, v: 1 },
  ];
  const normals = positions.map(() => new THREE.Vector3(0, 0, 1));
  const materialName = (gd.playfield_material as string | undefined) || '';

  writer.writeObjectName(state.tableName || 'Table');
  writer.writeVertexInfo(positions, uvs, normals);
  writer.writeMaterial(materialName);
  writer.useTexture(materialName);
  writer.writeFaceInfoList([0, 1, 3, 0, 3, 2]);
  writer.updateFaceOffset(4);
}

function isExportable(item: GameItem, name: string): boolean {
  const type = item._type || '';
  if (!EXPORTABLE_TYPES.has(type)) return false;

  if (VISIBILITY_GATED_TYPES.has(type)) {
    const withVisibility = item as ItemWithVisibility;
    if (withVisibility.is_visible === false || withVisibility.visible === false) return false;
  }

  return isItemVisible(item, name);
}

async function writeItem(writer: ObjWriter, item: GameItem, name: string): Promise<void> {
  if (item._type === 'Primitive') {
    const geometry = await buildPrimitiveExportGeometry(item as Parameters<typeof buildPrimitiveExportGeometry>[0]);
    if (!geometry) return;
    writer.writeObjectName(item.name || name);
    writeGeometry(
      writer,
      geometry,
      buildPrimitiveFullMatrix(item as Parameters<typeof buildPrimitiveFullMatrix>[0]),
      itemMaterialName(item)
    );
    geometry.dispose();
    return;
  }

  const object = getEditable(item._type || '')?.create3DMesh?.(item);
  if (!object) return;

  object.updateMatrixWorld(true);
  const baseName = item.name || name;
  let wroteName = false;

  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    if (mesh.name || !wroteName) {
      writer.writeObjectName(mesh.name ? `${baseName}${mesh.name}` : baseName);
      wroteName = true;
    }

    writeGeometry(writer, mesh.geometry, mesh.matrixWorld, itemMaterialName(item));
  });
}

export async function exportTableMesh(mtlFileName: string): Promise<{ obj: string; mtl: string } | null> {
  const gd = state.gamedata as GameData | null;
  if (!gd) return null;

  const writer = new ObjWriter(mtlFileName);
  writePlayfield(writer, gd);

  for (const gi of state.gameitems) {
    if (!gi.file_name) continue;

    const item = getItemByFileName(gi.file_name);
    if (!item) continue;

    const name = (item.name || '').toLowerCase();
    if (!isExportable(item, name)) continue;

    try {
      await writeItem(writer, item, name);
    } catch (e: unknown) {
      console.warn(`OBJ export error for ${item.name} (${item._type}):`, (e as Error).message);
    }
  }

  return { obj: writer.getObj(), mtl: writer.getMtl() };
}

function downloadFile(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportTableMeshAndSave(): Promise<string | null> {
  const tableName = state.tableName || 'table';

  if (window.vpxEditor?.exportObjMeshGetPath) {
    const objPath = await window.vpxEditor.exportObjMeshGetPath(`${tableName}.obj`);
    if (!objPath) return null;

    const separator = objPath.includes('\\') ? '\\' : '/';
    const objFileName = objPath.split(separator).pop()!;
    const mtlFileName = objFileName.replace(/\.obj$/i, '') + '.mtl';
    const mtlPath = objPath.slice(0, objPath.length - objFileName.length) + mtlFileName;

    const result = await exportTableMesh(mtlFileName);
    if (!result) return null;

    await window.vpxEditor.writeFile(objPath, result.obj);
    await window.vpxEditor.writeFile(mtlPath, result.mtl);
    return objPath;
  }

  const objFileName = `${tableName}.obj`;
  const mtlFileName = `${tableName}.mtl`;
  const result = await exportTableMesh(mtlFileName);
  if (!result) return null;

  downloadFile(result.obj, objFileName);
  downloadFile(result.mtl, mtlFileName);
  return objFileName;
}
