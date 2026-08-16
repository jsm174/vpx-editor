import * as THREE from 'three';
import { state, GameItem, getItem } from './state.js';
import { createObject, saveNewObject, generateUniqueName } from './object-factory.js';
import { saveItemToFile } from './table-loader.js';
import { generateUniqueFileName } from '../shared/gameitem-utils.js';
import { buildPrimitiveFullMatrix, PrimitiveItem } from './parts/primitive.js';

interface FlasherLike extends GameItem {
  render_mode?: string;
  render_style?: number;
  pos_x?: number;
  pos_y?: number;
  height?: number;
  rot_x?: number;
  depth_bias?: number;
  is_visible?: boolean;
  part_group_name?: string | null;
  drag_points?: { x?: number; y?: number }[];
}

async function getPrimitiveMeshData(
  prim: PrimitiveItem & GameItem
): Promise<{ positions: Float32Array; indices: Uint32Array } | null> {
  if (prim.use_3d_mesh && prim._fileName) {
    const objPath = `${state.extractedDir}/${prim._fileName.replace('.json', '.obj')}`;
    const result = await window.vpxEditor.objToMesh(objPath);
    if (result.success && result.mesh) {
      return { positions: result.mesh.positions, indices: result.mesh.indices };
    }
    return null;
  }
  const result = await window.vpxEditor.generateBuiltinPrimitive(prim.sides ?? 4, !!prim.draw_textures_inside);
  if (result.success && result.mesh) {
    return { positions: result.mesh.positions, indices: result.mesh.indices };
  }
  return null;
}

export async function upgradeBackglassPrimitives(): Promise<void> {
  const primitiveNames: string[] = [];
  for (const [key, item] of Object.entries(state.items) as [string, GameItem][]) {
    if (item._type === 'Flasher') {
      const flasher = item as FlasherLike;
      if (flasher.render_mode === 'ext_render' && (flasher.render_style ?? 0) === 1) {
        return;
      }
    }
    if (item._type === 'Primitive' && ((item as PrimitiveItem).image || '').toLowerCase() === 'backglassimage') {
      primitiveNames.push(key);
    }
  }

  for (const primName of primitiveNames) {
    const prim = getItem(primName) as (PrimitiveItem & GameItem) | undefined;
    if (!prim) continue;

    const meshData = await getPrimitiveMeshData(prim);
    if (!meshData) continue;

    const matrix = buildPrimitiveFullMatrix(prim);
    const vertexCount = meshData.positions.length / 3;
    const vertices: THREE.Vector3[] = new Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      vertices[i] = new THREE.Vector3(
        meshData.positions[i * 3],
        meshData.positions[i * 3 + 1],
        meshData.positions[i * 3 + 2]
      ).applyMatrix4(matrix);
    }

    const planeNormal = new THREE.Vector3(0, 0, 0);
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i + 2 < meshData.indices.length; i += 3) {
      const a = vertices[meshData.indices[i]];
      const b = vertices[meshData.indices[i + 1]];
      const c = vertices[meshData.indices[i + 2]];
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      n.crossVectors(ac, ab).normalize();
      const weight = -n.z;
      if (weight > 0) {
        planeNormal.addScaledVector(n, weight);
      }
    }

    planeNormal.x = 0;
    const normalLength = planeNormal.length();
    if (normalLength <= 1e-5) continue;
    planeNormal.divideScalar(normalLength);

    let planeDist = Infinity;
    for (const idx of meshData.indices) {
      planeDist = Math.min(planeDist, planeNormal.dot(vertices[idx]));
    }

    const planeYAxis = new THREE.Vector3(0, planeNormal.z, -planeNormal.y);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const idx of meshData.indices) {
      const v = vertices[idx];
      if (planeNormal.dot(v) < planeDist + 1) {
        const px = v.x;
        const py = v.dot(planeYAxis);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    const backglassWidth = maxX - minX;
    const backglassHeight = maxY - minY;
    if (backglassWidth <= 0 || backglassHeight <= 0) continue;

    const center = planeNormal
      .clone()
      .multiplyScalar(planeDist)
      .addScaledVector(planeYAxis, minY + 0.5 * backglassHeight);
    center.x += minX + 0.5 * backglassWidth;

    const flasher = createObject('Flasher', { x: 0, y: 0 }) as FlasherLike | null;
    if (!flasher) continue;

    const flasherName = generateUniqueName(prim.name || 'Flasher');
    flasher.name = flasherName;
    const existingFileNames = state.gameitems.map(gi => gi.file_name);
    flasher._fileName = `gameitems/${generateUniqueFileName('Flasher', flasherName, existingFileNames)}`;

    const halfW = backglassWidth / 2;
    const halfH = backglassHeight / 2;
    if (flasher.drag_points) {
      const cornersX = [-halfW, -halfW, halfW, halfW];
      const cornersY = [-halfH, halfH, halfH, -halfH];
      flasher.drag_points.forEach((pt, i) => {
        pt.x = center.x + cornersX[i];
        pt.y = center.y + cornersY[i];
      });
    }
    flasher.pos_x = center.x;
    flasher.pos_y = center.y;
    flasher.height = center.z;
    flasher.rot_x = -180 - (Math.atan2(planeNormal.y, planeNormal.z) * 180) / Math.PI;
    flasher.render_mode = 'ext_render';
    flasher.render_style = 1;
    flasher.depth_bias = prim.depth_bias ?? 0;
    flasher.is_visible = prim.is_visible !== false;
    if (prim.part_group_name) {
      flasher.part_group_name = prim.part_group_name;
    }

    const saved = await saveNewObject(flasher as GameItem, true);
    if (!saved) continue;

    prim.is_visible = false;
    await saveItemToFile(primName);

    console.warn(
      `Primitive '${prim.name}' used as a deprecated VR backglass was hidden and an external renderer flasher named '${flasherName}' was added. This may cause script issues.`
    );
  }
}
