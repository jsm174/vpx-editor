import * as THREE from 'three';
import { state, getItemByFileName, getItemSpaceReference, isItemVisibleForExport, type GameItem } from './state.js';
import { exportTableMesh } from './obj-export.js';
import type { ObjExchangeOptions } from '../shared/obj-transform.js';
import { getEditable } from './parts/index.js';
import { buildPrimitiveFullMatrix, buildPrimitiveExportGeometry } from './parts/primitive.js';
import { getSpaceReferenceOffset, type SpaceReference } from './view-setup.js';
import { summarize } from '../shared/mesh-analysis.js';
import { waitForLoadComplete } from './mcp-capture.js';
import type { GameData } from '../types/data.js';

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

const VISIBILITY_GATED_TYPES = new Set(['Ramp', 'Rubber', 'Primitive', 'Trigger']);

interface ItemWithVisibility extends GameItem {
  is_visible?: boolean;
  visible?: boolean;
}

function isExportable(item: GameItem): boolean {
  const type = item._type || '';
  if (!EXPORTABLE_TYPES.has(type)) return false;

  if (VISIBILITY_GATED_TYPES.has(type)) {
    const withVisibility = item as ItemWithVisibility;
    if (withVisibility.is_visible === false || withVisibility.visible === false) return false;
  }

  return isItemVisibleForExport(item);
}

function spaceMatrix(item: GameItem): THREE.Matrix4 {
  const spaceRef = getItemSpaceReference(item) as SpaceReference;
  const zOffset = getSpaceReferenceOffset(state.gamedata as GameData | null, spaceRef);
  return new THREE.Matrix4().makeTranslation(0, 0, zOffset);
}

async function forEachItemGeometry(
  item: GameItem,
  cb: (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => void
): Promise<void> {
  const spaceOffset = spaceMatrix(item);

  if (item._type === 'Primitive') {
    const geometry = await buildPrimitiveExportGeometry(item as Parameters<typeof buildPrimitiveExportGeometry>[0]);
    if (!geometry) return;
    cb(
      geometry,
      spaceOffset.clone().multiply(buildPrimitiveFullMatrix(item as Parameters<typeof buildPrimitiveFullMatrix>[0]))
    );
    geometry.dispose();
    return;
  }

  const object = getEditable(item._type || '')?.create3DMesh?.(item);
  if (!object) return;

  object.updateMatrixWorld(true);
  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    cb(mesh.geometry, spaceOffset.clone().multiply(mesh.matrixWorld));
  });
}

interface GeometryRequest {
  parts?: string[];
  region?: { x: number; y: number; width: number; height: number };
}

export async function handleMcpGeometryRequest(raw: unknown): Promise<Record<string, unknown>> {
  const data = raw as GeometryRequest;
  if (!state.extractedDir || !state.gamedata) {
    return { success: false, error: 'No active table' };
  }
  await waitForLoadComplete();

  const gd = state.gamedata as GameData;
  const wanted = data.parts?.length ? new Set(data.parts.map(p => p.toLowerCase())) : null;
  const matched = new Set<string>();
  const noMesh: string[] = [];
  const parts: Record<string, unknown>[] = [];
  const v = new THREE.Vector3();

  for (const gi of state.gameitems) {
    if (!gi.file_name) continue;
    const item = getItemByFileName(gi.file_name);
    if (!item?.name) continue;
    const lower = item.name.toLowerCase();
    if (wanted) {
      if (!wanted.has(lower)) continue;
      matched.add(lower);
    }
    if (!EXPORTABLE_TYPES.has(item._type || '')) {
      if (wanted) noMesh.push(item.name);
      continue;
    }
    const visible = isExportable(item);

    const positions: number[] = [];
    let triangles = 0;
    try {
      await forEachItemGeometry(item, (geometry, matrix) => {
        const pos = geometry.getAttribute('position');
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          positions.push(v.x, v.y, v.z);
        }
        const index = geometry.getIndex();
        triangles += (index ? index.count : pos.count) / 3;
      });
    } catch (e: unknown) {
      console.warn(`Geometry query error for ${item.name} (${item._type}):`, (e as Error).message);
      continue;
    }
    if (!positions.length) {
      if (wanted) noMesh.push(item.name);
      continue;
    }

    const summary = summarize(positions);
    if (data.region) {
      const r = data.region;
      const b = summary.bbox;
      if (b.max.x < r.x || b.min.x > r.x + r.width || b.max.y < r.y || b.min.y > r.y + r.height) continue;
    }
    parts.push({
      name: item.name,
      type: item._type || '',
      ...summary,
      triangleCount: Math.round(triangles),
      ...(visible ? {} : { visible: false }),
    });
  }

  const notFound = wanted ? [...wanted].filter(w => !matched.has(w)) : [];
  return {
    success: true,
    table: { left: gd.left ?? 0, top: gd.top ?? 0, right: gd.right ?? 0, bottom: gd.bottom ?? 0 },
    parts,
    ...(noMesh.length ? { noMesh } : {}),
    ...(notFound.length ? { notFound } : {}),
  };
}

export async function handleMcpExportObjRequest(raw: unknown): Promise<Record<string, unknown>> {
  const data = raw as { mtlFileName?: string; exchange?: ObjExchangeOptions };
  if (!state.extractedDir || !state.gamedata) {
    return { success: false, error: 'No active table' };
  }
  await waitForLoadComplete();
  const result = await exportTableMesh(data.mtlFileName || 'table.mtl', data.exchange);
  if (!result) return { success: false, error: 'Table has no exportable geometry' };
  return { success: true, obj: result.obj, mtl: result.mtl };
}
