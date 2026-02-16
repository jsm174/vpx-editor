import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth, convertToUnit, getUnitSuffixHtml } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions, lightOptions, renderProbeOptions } from '../../shared/options-generators.js';
import { materialSelect } from '../../shared/property-templates.js';
import { PRIMITIVE_DEFAULTS } from '../../shared/object-defaults.js';
import { getWireframeMode } from '../canvas-renderer-3d.js';
import { registerCallback, invokeCallback } from '../../shared/callbacks.js';
import { RENDER_COLOR_BLACK, BLUEPRINT_SOLID_COLOR } from '../../shared/constants.js';
import { generateBuiltinMesh } from '../../shared/builtin-primitive-mesh.js';
import { registerEditable, IEditable, Point } from './registry.js';

interface PrimitiveItem {
  name?: string;
  _fileName?: string;
  position?: { x: number; y: number; z: number };
  size?: { x: number; y: number; z: number };
  rot_and_tra?: number[];
  color?: string | number;
  image?: string;
  material?: string;
  is_locked?: boolean;
  normal_map?: string;
  object_space_normal_map?: boolean;
  light_map?: string;
  reflection_probe?: string;
  refraction_probe?: string;
  reflection_strength?: number;
  refraction_thickness?: number;
  is_visible?: boolean;
  static_rendering?: boolean;
  is_reflection_enabled?: boolean;
  use_depth_mask?: boolean;
  backfaces_enabled?: boolean;
  add_blend?: boolean;
  depth_bias?: number;
  display_texture?: boolean;
  draw_textures_inside?: boolean;
  sides?: number;
  edge_factor_ui?: number;
  hit_event?: boolean;
  threshold?: number;
  physics_material?: string;
  overwrite_physics?: boolean;
  elasticity?: number;
  elasticity_falloff?: number;
  friction?: number;
  scatter?: number;
  is_collidable?: boolean;
  is_toy?: boolean;
  collision_reduction_factor?: number;
  disable_lighting_top_old?: number;
  disable_lighting_below?: number;
  alpha?: number;
  use_3d_mesh?: boolean;
}

interface MeshCacheEntry {
  loading?: boolean;
  error?: boolean;
  vertices?: number[];
  normals?: number[];
  indices?: number[];
  normalIndices?: number[];
}

interface TransformedMesh {
  vertices2D: number[];
  normalsZ: number[];
}

interface MeshInfo {
  numVertices: number;
  numPolygons: number;
}

const objLoader = new OBJLoader();
const meshCache = new Map<string, MeshCacheEntry>();

registerCallback('primitiveRenderCallback');
registerCallback('primitiveStatusCallback');

export { builtinMeshToOBJ } from '../../shared/builtin-primitive-mesh.js';

export function getPrimitiveMeshInfo(item: PrimitiveItem): MeshInfo | null {
  if (!item || !item._fileName) return null;
  const cached = meshCache.get(item._fileName);
  if (!cached || cached.loading || cached.error) return null;
  if (cached.vertices && cached.indices) {
    const numVertices = cached.vertices.length / 3;
    const numPolygons = Math.floor(cached.indices.length / 3);
    return { numVertices, numPolygons };
  }
  return null;
}

export function clearPrimitiveMeshCache(): void {
  meshCache.clear();
}

export function createPrimitive3DMesh(item: PrimitiveItem): THREE.Group {
  const pos = item.position || { x: 0, y: 0, z: 0 };
  const size = item.size || { x: 1, y: 1, z: 1 };
  const rotAndTra = item.rot_and_tra || [0, 0, 0, 0, 0, 0, 0, 0, 0];

  const rotX = ((rotAndTra[0] || 0) * Math.PI) / 180;
  const rotY = ((rotAndTra[1] || 0) * Math.PI) / 180;
  const rotZ = ((rotAndTra[2] || 0) * Math.PI) / 180;
  const transX = rotAndTra[3] || 0;
  const transY = rotAndTra[4] || 0;
  const transZ = rotAndTra[5] || 0;
  const objRotX = ((rotAndTra[6] || 0) * Math.PI) / 180;
  const objRotY = ((rotAndTra[7] || 0) * Math.PI) / 180;
  const objRotZ = ((rotAndTra[8] || 0) * Math.PI) / 180;

  const scaleMatrix = new THREE.Matrix4().makeScale(size.x || 1, size.y || 1, size.z || 1);
  const transMatrix = new THREE.Matrix4().makeTranslation(transX, transY, transZ);
  const posMatrix = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);

  const rotXMatrix = new THREE.Matrix4().makeRotationX(rotX);
  const rotYMatrix = new THREE.Matrix4().makeRotationY(rotY);
  const rotZMatrix = new THREE.Matrix4().makeRotationZ(rotZ);
  const objRotXMatrix = new THREE.Matrix4().makeRotationX(objRotX);
  const objRotYMatrix = new THREE.Matrix4().makeRotationY(objRotY);
  const objRotZMatrix = new THREE.Matrix4().makeRotationZ(objRotZ);

  const rtMatrix = new THREE.Matrix4()
    .multiply(objRotXMatrix)
    .multiply(objRotYMatrix)
    .multiply(objRotZMatrix)
    .multiply(rotXMatrix)
    .multiply(rotYMatrix)
    .multiply(rotZMatrix)
    .multiply(transMatrix);

  const fullMatrix = new THREE.Matrix4().multiply(posMatrix).multiply(rtMatrix).multiply(scaleMatrix);

  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(fullMatrix);

  const meshContainer = new THREE.Group();
  group.add(meshContainer);

  const placeholderGeom = new THREE.BoxGeometry(20, 20, 20);
  const placeholderMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const placeholder = new THREE.Mesh(placeholderGeom, placeholderMat);
  meshContainer.add(placeholder);

  if (item._fileName && state.extractedDir) {
    const objPath = `${state.extractedDir}/${item._fileName.replace('.json', '.obj')}`;
    loadPrimitiveOBJOrBuiltin(objPath, meshContainer, placeholder, item);
  } else if (!item.use_3d_mesh) {
    applyBuiltinMesh3D(meshContainer, placeholder, item);
  }

  return group;
}

function createPrimitiveMaterial(item: PrimitiveItem): THREE.Material {
  let defaultColor: number | null = null;
  if (item.color) {
    if (typeof item.color === 'string' && item.color.startsWith('#')) {
      defaultColor = parseInt(item.color.slice(1), 16);
    } else if (typeof item.color === 'number') {
      defaultColor = item.color;
    }
  }

  const isPlayfield = item.name === 'playfield_mesh';
  const imageName = isPlayfield ? (state.gamedata?.image as string | undefined) : item.image;
  const materialName = isPlayfield ? (state.gamedata?.playfield_material as string | undefined) : item.material;

  const material = createMaterial(materialName, imageName, defaultColor);
  material.wireframe = getWireframeMode();
  return material;
}

function replacePlaceholder(meshContainer: THREE.Group, placeholder: THREE.Mesh, newObj: THREE.Object3D): void {
  meshContainer.remove(placeholder);
  (placeholder.geometry as THREE.BufferGeometry).dispose();
  (placeholder.material as THREE.Material).dispose();
  meshContainer.add(newObj);
}

function applyBuiltinMesh3D(meshContainer: THREE.Group, placeholder: THREE.Mesh, item: PrimitiveItem): void {
  const sides = item.sides ?? PRIMITIVE_DEFAULTS.sides;
  const builtin = generateBuiltinMesh(sides, !!item.draw_textures_inside);
  const verts = builtin.vertices;
  const norms = builtin.normals;
  const idxs = builtin.indices;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(verts.length);
  const normalArr = new Float32Array(norms.length);
  for (let i = 0; i < verts.length; i++) {
    positions[i] = verts[i];
    normalArr[i] = norms[i];
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normalArr, 3));
  geometry.setIndex(idxs);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = createPrimitiveMaterial(item);
  const mesh = new THREE.Mesh(geometry, material);
  const obj = new THREE.Group();
  obj.add(mesh);
  replacePlaceholder(meshContainer, placeholder, obj);
}

async function loadPrimitiveOBJOrBuiltin(
  objPath: string,
  meshContainer: THREE.Group,
  placeholder: THREE.Mesh,
  item: PrimitiveItem
): Promise<void> {
  try {
    const result = await window.vpxEditor.readFile(objPath);
    if (!result.success) {
      if (!item.use_3d_mesh) {
        applyBuiltinMesh3D(meshContainer, placeholder, item);
      }
      return;
    }

    const obj = objLoader.parse(result.content!);
    const material = createPrimitiveMaterial(item);

    obj.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const positions = mesh.geometry.attributes.position as THREE.BufferAttribute;
        if (positions) {
          for (let i = 0; i < positions.count; i++) {
            positions.setZ(i, -positions.getZ(i));
          }
          positions.needsUpdate = true;
        }

        const normals = mesh.geometry.attributes.normal as THREE.BufferAttribute;
        if (normals) {
          for (let i = 0; i < normals.count; i++) {
            normals.setZ(i, -normals.getZ(i));
          }
          normals.needsUpdate = true;
        }

        mesh.material = material;
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
      }
    });

    replacePlaceholder(meshContainer, placeholder, obj);
  } catch (e: unknown) {
    console.warn('Failed to load OBJ:', objPath, e);
  }
}

export function uiRenderPass1(_item: PrimitiveItem, _isSelected: boolean): void {}

export function uiRenderPass2(item: PrimitiveItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const pos = item.position || { x: 0, y: 0, z: 0 };

  if (item.name === 'playfield_mesh') return;

  const cacheKey = item._fileName;
  const cached = cacheKey ? meshCache.get(cacheKey) : null;

  ctx.strokeStyle = getStrokeStyle(item, isSelected, '#555555');
  ctx.lineWidth = getLineWidth(isSelected);

  if (cached && cached.vertices && cached.indices) {
    const size = item.size || { x: 1, y: 1, z: 1 };
    const rotAndTra = item.rot_and_tra || [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const transformed = transformMeshVertices(cached.vertices, cached.normals || [], pos, size, rotAndTra);
    const edgeFactor = item.edge_factor_ui ?? 0.25;
    const numVertices = cached.vertices.length / 3;
    drawWireframe(
      transformed.vertices2D,
      cached.indices,
      cached.normalIndices || [],
      transformed.normalsZ,
      edgeFactor,
      numVertices,
      item,
      isSelected
    );
  } else {
    if (cacheKey && !meshCache.has(cacheKey)) {
      loadMeshForCache(item);
    }

    const size = item.size || {
      x: PRIMITIVE_DEFAULTS.size_x,
      y: PRIMITIVE_DEFAULTS.size_y,
      z: PRIMITIVE_DEFAULTS.size_z,
    };
    const halfX = size.x * 0.5;
    const halfY = size.y * 0.5;

    const p0 = toScreen(pos.x - halfX, pos.y - halfY);
    const p1 = toScreen(pos.x - halfX, pos.y + halfY);
    const p2 = toScreen(pos.x + halfX, pos.y + halfY);
    const p3 = toScreen(pos.x + halfX, pos.y - halfY);

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();
  }
}

export function renderBlueprint(
  ctx: CanvasRenderingContext2D,
  item: PrimitiveItem,
  scale: number,
  solid: boolean
): void {
  const pos = item.position || { x: 0, y: 0, z: 0 };

  if (item.name === 'playfield_mesh') return;

  const use3DMesh = item.use_3d_mesh !== false;
  const cacheKey = item._fileName;
  const cached = cacheKey ? meshCache.get(cacheKey) : null;
  const edgeFactor = item.edge_factor_ui ?? 0.25;

  ctx.strokeStyle = RENDER_COLOR_BLACK;
  ctx.lineWidth = 1;

  if (use3DMesh && cached && cached.vertices && cached.indices) {
    const size = item.size || { x: 1, y: 1, z: 1 };
    const rotAndTra = item.rot_and_tra || [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const transformed = transformMeshVerticesForBlueprint(
      cached.vertices,
      cached.normals || [],
      pos,
      size,
      rotAndTra,
      scale
    );
    const numVertices = cached.vertices.length / 3;

    if (solid) {
      ctx.fillStyle = BLUEPRINT_SOLID_COLOR;
      for (let i = 0; i < cached.indices.length; i += 3) {
        const i0 = cached.indices[i];
        const i1 = cached.indices[i + 1];
        const i2 = cached.indices[i + 2];
        const ax = transformed.vertices2D[i0 * 2];
        const ay = transformed.vertices2D[i0 * 2 + 1];
        const bx = transformed.vertices2D[i1 * 2];
        const by = transformed.vertices2D[i1 * 2 + 1];
        const cx = transformed.vertices2D[i2 * 2];
        const cy = transformed.vertices2D[i2 * 2 + 1];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(bx, by);
        ctx.lineTo(ax, ay);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    if (edgeFactor <= 0 || edgeFactor >= 1) {
      if (edgeFactor >= 1 || numVertices <= 100) {
        for (let i = 0; i < cached.indices.length; i += 3) {
          const i0 = cached.indices[i];
          const i1 = cached.indices[i + 1];
          const i2 = cached.indices[i + 2];
          const ax = transformed.vertices2D[i0 * 2];
          const ay = transformed.vertices2D[i0 * 2 + 1];
          const bx = transformed.vertices2D[i1 * 2];
          const by = transformed.vertices2D[i1 * 2 + 1];
          const cx = transformed.vertices2D[i2 * 2];
          const cy = transformed.vertices2D[i2 * 2 + 1];
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.moveTo(bx, by);
          ctx.lineTo(cx, cy);
          ctx.moveTo(cx, cy);
          ctx.lineTo(ax, ay);
          ctx.stroke();
        }
      } else {
        if (cached.indices.length > 0) {
          const i0 = cached.indices[0];
          ctx.beginPath();
          ctx.moveTo(transformed.vertices2D[i0 * 2], transformed.vertices2D[i0 * 2 + 1]);
          for (let i = 0; i < cached.indices.length; i += 3) {
            const i1 = cached.indices[i + 1];
            ctx.lineTo(transformed.vertices2D[i1 * 2], transformed.vertices2D[i1 * 2 + 1]);
          }
          ctx.stroke();
        }
      }
    } else {
      ctx.beginPath();
      for (let i = 0; i < cached.indices.length; i += 3) {
        const i0 = cached.indices[i];
        const i1 = cached.indices[i + 1];
        const i2 = cached.indices[i + 2];
        const ax = transformed.vertices2D[i0 * 2];
        const ay = transformed.vertices2D[i0 * 2 + 1];
        const bx = transformed.vertices2D[i1 * 2];
        const by = transformed.vertices2D[i1 * 2 + 1];
        const cx = transformed.vertices2D[i2 * 2];
        const cy = transformed.vertices2D[i2 * 2 + 1];
        const An = transformed.normalsZ[i0];
        const Bn = transformed.normalsZ[i1];
        const Cn = transformed.normalsZ[i2];

        if (Math.abs(An + Bn) < edgeFactor) {
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
        if (Math.abs(Bn + Cn) < edgeFactor) {
          ctx.moveTo(bx, by);
          ctx.lineTo(cx, cy);
        }
        if (Math.abs(Cn + An) < edgeFactor) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(ax, ay);
        }
      }
      ctx.stroke();
    }
  } else {
    const size = item.size || {
      x: PRIMITIVE_DEFAULTS.size_x,
      y: PRIMITIVE_DEFAULTS.size_y,
      z: PRIMITIVE_DEFAULTS.size_z,
    };
    const halfX = size.x * 0.5;
    const halfY = size.y * 0.5;

    const p0 = { x: (pos.x - halfX) * scale, y: (pos.y - halfY) * scale };
    const p1 = { x: (pos.x - halfX) * scale, y: (pos.y + halfY) * scale };
    const p2 = { x: (pos.x + halfX) * scale, y: (pos.y + halfY) * scale };
    const p3 = { x: (pos.x + halfX) * scale, y: (pos.y - halfY) * scale };

    if (solid) {
      ctx.fillStyle = BLUEPRINT_SOLID_COLOR;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();
  }
}

export function render(item: PrimitiveItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

function transformMeshVertices(
  vertices: number[],
  normals: number[],
  pos: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  rotAndTra: number[]
): TransformedMesh {
  const rotX = ((rotAndTra[0] || 0) * Math.PI) / 180;
  const rotY = ((rotAndTra[1] || 0) * Math.PI) / 180;
  const rotZ = ((rotAndTra[2] || 0) * Math.PI) / 180;
  const transX = rotAndTra[3] || 0;
  const transY = rotAndTra[4] || 0;
  const transZ = rotAndTra[5] || 0;
  const objRotX = ((rotAndTra[6] || 0) * Math.PI) / 180;
  const objRotY = ((rotAndTra[7] || 0) * Math.PI) / 180;
  const objRotZ = ((rotAndTra[8] || 0) * Math.PI) / 180;

  const vertices2D: number[] = [];
  const normalsZ: number[] = [];

  for (let i = 0; i < vertices.length; i += 3) {
    let x = vertices[i];
    let y = vertices[i + 1];
    let z = vertices[i + 2];

    x *= size.x || 1;
    y *= size.y || 1;
    z *= size.z || 1;

    x += transX;
    y += transY;
    z += transZ;

    let temp;
    if (rotZ !== 0) {
      const cz = Math.cos(rotZ),
        sz = Math.sin(rotZ);
      temp = x * cz - y * sz;
      y = x * sz + y * cz;
      x = temp;
    }
    if (rotY !== 0) {
      const cy = Math.cos(rotY),
        sy = Math.sin(rotY);
      temp = x * cy + z * sy;
      z = -x * sy + z * cy;
      x = temp;
    }
    if (rotX !== 0) {
      const cx = Math.cos(rotX),
        sx = Math.sin(rotX);
      temp = y * cx - z * sx;
      z = y * sx + z * cx;
      y = temp;
    }

    if (objRotZ !== 0) {
      const cz = Math.cos(objRotZ),
        sz = Math.sin(objRotZ);
      temp = x * cz - y * sz;
      y = x * sz + y * cz;
      x = temp;
    }
    if (objRotY !== 0) {
      const cy = Math.cos(objRotY),
        sy = Math.sin(objRotY);
      temp = x * cy + z * sy;
      z = -x * sy + z * cy;
      x = temp;
    }
    if (objRotX !== 0) {
      const cx = Math.cos(objRotX),
        sx = Math.sin(objRotX);
      temp = y * cx - z * sx;
      z = y * sx + z * cx;
      y = temp;
    }

    x += pos.x;
    y += pos.y;

    vertices2D.push(x, y);
  }

  for (let i = 0; i < normals.length; i += 3) {
    let nx = normals[i];
    let ny = normals[i + 1];
    let nz = normals[i + 2];

    let temp;
    if (rotZ !== 0) {
      const cz = Math.cos(rotZ),
        sz = Math.sin(rotZ);
      temp = nx * cz - ny * sz;
      ny = nx * sz + ny * cz;
      nx = temp;
    }
    if (rotY !== 0) {
      const cy = Math.cos(rotY),
        sy = Math.sin(rotY);
      temp = nx * cy + nz * sy;
      nz = -nx * sy + nz * cy;
      nx = temp;
    }
    if (rotX !== 0) {
      const cx = Math.cos(rotX),
        sx = Math.sin(rotX);
      temp = ny * cx - nz * sx;
      nz = ny * sx + nz * cx;
      ny = temp;
    }

    if (objRotZ !== 0) {
      const cz = Math.cos(objRotZ),
        sz = Math.sin(objRotZ);
      temp = nx * cz - ny * sz;
      ny = nx * sz + ny * cz;
      nx = temp;
    }
    if (objRotY !== 0) {
      const cy = Math.cos(objRotY),
        sy = Math.sin(objRotY);
      temp = nx * cy + nz * sy;
      nz = -nx * sy + nz * cy;
      nx = temp;
    }
    if (objRotX !== 0) {
      const cx = Math.cos(objRotX),
        sx = Math.sin(objRotX);
      temp = ny * cx - nz * sx;
      nz = ny * sx + nz * cx;
      ny = temp;
    }

    normalsZ.push(nz);
  }

  return { vertices2D, normalsZ };
}

function transformMeshVerticesForBlueprint(
  vertices: number[],
  normals: number[],
  pos: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  rotAndTra: number[],
  scale: number
): TransformedMesh {
  const rotX = ((rotAndTra[0] || 0) * Math.PI) / 180;
  const rotY = ((rotAndTra[1] || 0) * Math.PI) / 180;
  const rotZ = ((rotAndTra[2] || 0) * Math.PI) / 180;
  const transX = rotAndTra[3] || 0;
  const transY = rotAndTra[4] || 0;
  const transZ = rotAndTra[5] || 0;
  const objRotX = ((rotAndTra[6] || 0) * Math.PI) / 180;
  const objRotY = ((rotAndTra[7] || 0) * Math.PI) / 180;
  const objRotZ = ((rotAndTra[8] || 0) * Math.PI) / 180;

  const cosRX = Math.cos(rotX),
    sinRX = Math.sin(rotX);
  const cosRY = Math.cos(rotY),
    sinRY = Math.sin(rotY);
  const cosRZ = Math.cos(rotZ),
    sinRZ = Math.sin(rotZ);
  const cosOX = Math.cos(objRotX),
    sinOX = Math.sin(objRotX);
  const cosOY = Math.cos(objRotY),
    sinOY = Math.sin(objRotY);
  const cosOZ = Math.cos(objRotZ),
    sinOZ = Math.sin(objRotZ);

  const vertices2D: number[] = [];
  const normalsZ: number[] = [];

  for (let i = 0; i < vertices.length; i += 3) {
    let x = vertices[i];
    let y = vertices[i + 1];
    let z = vertices[i + 2];

    x *= size.x || 1;
    y *= size.y || 1;
    z *= size.z || 1;

    x += transX;
    y += transY;
    z += transZ;

    let temp;
    temp = x * cosRZ - y * sinRZ;
    y = x * sinRZ + y * cosRZ;
    x = temp;

    temp = x * cosRY + z * sinRY;
    z = -x * sinRY + z * cosRY;
    x = temp;

    temp = y * cosRX - z * sinRX;
    z = y * sinRX + z * cosRX;
    y = temp;

    temp = x * cosOZ - y * sinOZ;
    y = x * sinOZ + y * cosOZ;
    x = temp;

    temp = x * cosOY + z * sinOY;
    z = -x * sinOY + z * cosOY;
    x = temp;

    temp = y * cosOX - z * sinOX;
    z = y * sinOX + z * cosOX;
    y = temp;

    x += pos.x;
    y += pos.y;

    vertices2D.push(x * scale, y * scale);

    if (normals && normals.length > 0) {
      const ni = i;
      let nx = normals[ni] || 0;
      let ny = normals[ni + 1] || 0;
      let nz = normals[ni + 2] || 0;

      temp = nx * cosRZ - ny * sinRZ;
      ny = nx * sinRZ + ny * cosRZ;
      nx = temp;

      temp = nx * cosRY + nz * sinRY;
      nz = -nx * sinRY + nz * cosRY;
      nx = temp;

      temp = ny * cosRX - nz * sinRX;
      nz = ny * sinRX + nz * cosRX;
      ny = temp;

      temp = nx * cosOZ - ny * sinOZ;
      ny = nx * sinOZ + ny * cosOZ;
      nx = temp;

      temp = nx * cosOY + nz * sinOY;
      nz = -nx * sinOY + nz * cosOY;
      nx = temp;

      temp = ny * cosOX - nz * sinOX;
      nz = ny * sinOX + nz * cosOX;
      ny = temp;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      normalsZ.push(len > 0 ? nz / len : 0);
    } else {
      normalsZ.push(0);
    }
  }

  return { vertices2D, normalsZ };
}

function drawWireframe(
  vertices2D: number[],
  indices: number[],
  normalIndices: number[],
  normalsZ: number[],
  edgeFactor: number,
  numVertices: number,
  item: PrimitiveItem,
  isSelected: boolean
): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  ctx.strokeStyle = getStrokeStyle(item, isSelected, '#555555');
  ctx.lineWidth = getLineWidth(isSelected) / state.zoom;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.beginPath();

  const hasNormals = normalsZ && normalsZ.length > 0 && normalIndices && normalIndices.length > 0;
  const useEdgeFiltering = hasNormals && numVertices > 100 && edgeFactor > 0 && edgeFactor < 1;

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const ax = vertices2D[i0 * 2];
    const ay = vertices2D[i0 * 2 + 1];
    const bx = vertices2D[i1 * 2];
    const by = vertices2D[i1 * 2 + 1];
    const cx = vertices2D[i2 * 2];
    const cy = vertices2D[i2 * 2 + 1];

    if (useEdgeFiltering) {
      const n0 = normalIndices[i];
      const n1 = normalIndices[i + 1];
      const n2 = normalIndices[i + 2];
      const nA = normalsZ[n0] || 0;
      const nB = normalsZ[n1] || 0;
      const nC = normalsZ[n2] || 0;

      if (Math.abs(nA + nB) < edgeFactor) {
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      if (Math.abs(nB + nC) < edgeFactor) {
        ctx.moveTo(bx, by);
        ctx.lineTo(cx, cy);
      }
      if (Math.abs(nC + nA) < edgeFactor) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(ax, ay);
      }
    } else {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.lineTo(ax, ay);
    }
  }

  ctx.stroke();
  ctx.restore();
}

async function loadMeshForCache(item: PrimitiveItem): Promise<void> {
  if (!item._fileName || !state.extractedDir) return;

  const cacheKey = item._fileName;
  meshCache.set(cacheKey, { loading: true });

  const objPath = `${state.extractedDir}/${item._fileName!.replace('.json', '.obj')}`;

  try {
    const result = await window.vpxEditor.readFile(objPath);
    if (!result.success) {
      if (!item.use_3d_mesh) {
        const sides = item.sides ?? PRIMITIVE_DEFAULTS.sides;
        const builtin = generateBuiltinMesh(sides, !!item.draw_textures_inside);
        meshCache.set(cacheKey, { ...builtin, normalIndices: builtin.indices.slice() });
        invokeCallback('primitiveRenderCallback');
        invokeCallback('primitiveStatusCallback', item);
      } else {
        meshCache.set(cacheKey, { error: true });
      }
      return;
    }

    const parsed = parseOBJSimple(result.content!);
    meshCache.set(cacheKey, parsed);

    invokeCallback('primitiveRenderCallback');
    invokeCallback('primitiveStatusCallback', item);
  } catch {
    meshCache.set(cacheKey, { error: true });
  }
}

function parseOBJSimple(objText: string): MeshCacheEntry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const normalIndices: number[] = [];
  const lines = objText.split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      vertices.push(parseFloat(parts[1]) || 0);
      vertices.push(parseFloat(parts[2]) || 0);
      vertices.push(-(parseFloat(parts[3]) || 0));
    } else if (parts[0] === 'vn') {
      normals.push(parseFloat(parts[1]) || 0);
      normals.push(parseFloat(parts[2]) || 0);
      normals.push(-(parseFloat(parts[3]) || 0));
    } else if (parts[0] === 'f') {
      const faceVerts: number[] = [];
      const faceNorms: number[] = [];
      for (let i = 1; i < parts.length; i++) {
        const components = parts[i].split('/');
        const vIdx = parseInt(components[0], 10) - 1;
        const nIdx = components[2] ? parseInt(components[2], 10) - 1 : vIdx;
        faceVerts.push(vIdx);
        faceNorms.push(nIdx);
      }
      for (let i = 1; i < faceVerts.length - 1; i++) {
        indices.push(faceVerts[0], faceVerts[i], faceVerts[i + 1]);
        normalIndices.push(faceNorms[0], faceNorms[i], faceNorms[i + 1]);
      }
    }
  }

  return { vertices, normals, indices, normalIndices };
}

export function primitiveProperties(item: PrimitiveItem): string {
  const pos = item.position || { x: 0, y: 0, z: 0 };
  const size = item.size || {
    x: PRIMITIVE_DEFAULTS.size_x,
    y: PRIMITIVE_DEFAULTS.size_y,
    z: PRIMITIVE_DEFAULTS.size_z,
  };
  const rot = item.rot_and_tra || [0, 0, 0, 0, 0, 0, 0, 0, 0];
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="position">Position</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
    </div>

    <div class="prop-tab-content" data-tab="position">
      <div class="prop-group">
        <div class="prop-group-title">Base Position / Size</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="position.x" data-convert-units value="${convertToUnit(pos.x).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="position.y" data-convert-units value="${convertToUnit(pos.y).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Z</label>
          <input type="number" class="prop-input" data-prop="position.z" data-convert-units value="${convertToUnit(pos.z).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">XSize</label>
          <input type="number" class="prop-input" data-prop="size.x" value="${size.x.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">YSize</label>
          <input type="number" class="prop-input" data-prop="size.y" value="${size.y.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">ZSize</label>
          <input type="number" class="prop-input" data-prop="size.z" value="${size.z.toFixed(2)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Rotation and Transposition</div>
        <div class="prop-row">
          <label class="prop-label">RotX</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.0" value="${rot[0].toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotY</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.1" value="${rot[1].toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotZ</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.2" value="${rot[2].toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">TransX</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.3" data-convert-units value="${convertToUnit(rot[3]).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">TransY</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.4" data-convert-units value="${convertToUnit(rot[4]).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">TransZ</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.5" data-convert-units value="${convertToUnit(rot[5]).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">ObjRotX</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.6" value="${rot[6].toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">ObjRotY</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.7" value="${rot[7].toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">ObjRotZ</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.8" value="${rot[8].toFixed(1)}" step="5">
        </div>
      </div>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-group-title">Geometry</div>
        <div class="prop-row">
          <label class="prop-label">Draw Textures Inside</label>
          <input type="checkbox" class="prop-input" data-prop="draw_textures_inside" ${item.draw_textures_inside ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Legacy/Sides</label>
          <input type="number" class="prop-input" data-prop="sides" data-type="int" value="${item.sides ?? PRIMITIVE_DEFAULTS.sides}" step="1" min="3" max="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Editor</label>
          <input type="number" class="prop-input" data-prop="edge_factor_ui" value="${(item.edge_factor_ui ?? PRIMITIVE_DEFAULTS.edge_factor_ui).toFixed(2)}" step="0.05">
        </div>
        <div class="prop-button-row">
          <button class="prop-button" id="btn-import-mesh" data-filename="${item._fileName || ''}">Import Mesh</button>
          <button class="prop-button" id="btn-export-mesh" data-filename="${item._fileName || ''}" data-name="${item.name || 'mesh'}">Export Mesh</button>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Render Options</div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Static Rendering</label>
          <input type="checkbox" class="prop-input" data-prop="static_rendering" ${item.static_rendering ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Hide Parts Behind</label>
          <input type="checkbox" class="prop-input" data-prop="use_depth_mask" ${item.use_depth_mask !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Render backfacing transparent Triangles (slower, but accurate)</label>
          <input type="checkbox" class="prop-input" data-prop="backfaces_enabled" ${item.backfaces_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Unshaded Additive Blend</label>
          <input type="checkbox" class="prop-input" data-prop="add_blend" ${item.add_blend ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Depth Bias</label>
          <input type="number" class="prop-input" data-prop="depth_bias" value="${(item.depth_bias ?? PRIMITIVE_DEFAULTS.depth_bias).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Lightmap</label>
          <select class="prop-select" data-prop="light_map">${lightOptions(item.light_map)}</select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Material</div>
        ${materialSelect('Material', 'material', materialOptions(item.material))}
        <div class="prop-row">
          <label class="prop-label">Display Image</label>
          <input type="checkbox" class="prop-input" data-prop="display_texture" ${item.display_texture ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Normal Map</label>
          <select class="prop-select" data-prop="normal_map">${imageOptions(item.normal_map)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Object Space</label>
          <input type="checkbox" class="prop-input" data-prop="object_space_normal_map" ${item.object_space_normal_map ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Disable Spot Lights (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_top_old" value="${(item.disable_lighting_top_old ?? PRIMITIVE_DEFAULTS.disable_lighting_top).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Translucency (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_below" value="${(item.disable_lighting_below ?? PRIMITIVE_DEFAULTS.disable_lighting_below).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Modulate Opacity</label>
          <input type="number" class="prop-input" data-prop="alpha" value="${(item.alpha ?? PRIMITIVE_DEFAULTS.alpha).toFixed(1)}" step="5" min="0" max="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Modulate Color</label>
          <input type="color" class="prop-input" data-prop="color" value="${item.color || '#ffffff'}">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Reflections</div>
        <div class="prop-row">
          <label class="prop-label">Reflection Probe</label>
          <select class="prop-select" data-prop="reflection_probe">${renderProbeOptions(item.reflection_probe)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Strength</label>
          <input type="number" class="prop-input" data-prop="reflection_strength" value="${(item.reflection_strength ?? PRIMITIVE_DEFAULTS.reflection_strength).toFixed(2)}" step="0.1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Refractions</div>
        <div class="prop-row">
          <label class="prop-label">Refraction Probe</label>
          <select class="prop-select" data-prop="refraction_probe">${renderProbeOptions(item.refraction_probe)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Thickness</label>
          <input type="number" class="prop-input" data-prop="refraction_thickness" value="${(item.refraction_thickness ?? PRIMITIVE_DEFAULTS.refraction_thickness).toFixed(1)}" step="1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Has Hit Event</label>
          <input type="checkbox" class="prop-input" data-prop="hit_event" ${item.hit_event ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Threshold</label>
          <input type="number" class="prop-input" data-prop="threshold" value="${(item.threshold ?? PRIMITIVE_DEFAULTS.threshold).toFixed(2)}" step="0.5">
        </div>
        ${materialSelect('Physics Material', 'physics_material', materialOptions(item.physics_material))}
        <div class="prop-row">
          <label class="prop-label">Overwrite Material Settings</label>
          <input type="checkbox" class="prop-input" data-prop="overwrite_physics" ${item.overwrite_physics ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? PRIMITIVE_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? PRIMITIVE_DEFAULTS.elasticity_falloff).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? PRIMITIVE_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? PRIMITIVE_DEFAULTS.scatter).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_collidable" ${item.is_collidable ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Toy</label>
          <input type="checkbox" class="prop-input" data-prop="is_toy" ${item.is_toy ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reduce Polygons (0..1)</label>
          <input type="number" class="prop-input" data-prop="collision_reduction_factor" value="${(item.collision_reduction_factor ?? PRIMITIVE_DEFAULTS.collision_reduction_factor).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: PrimitiveItem): Point | null {
  return item.position ? { x: item.position.x, y: item.position.y } : null;
}

function putCenter(item: PrimitiveItem, center: Point): void {
  if (item.position) {
    item.position.x = center.x;
    item.position.y = center.y;
  } else {
    item.position = { x: center.x, y: center.y, z: 0 };
  }
}

const renderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  create3DMesh: createPrimitive3DMesh,
  getProperties: primitiveProperties,
  getCenter,
  putCenter,
};

registerEditable('Primitive', renderer);
