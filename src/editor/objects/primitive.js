import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions, lightOptions, renderProbeOptions } from '../../shared/options-generators.js';
import { PRIMITIVE_DEFAULTS } from '../../shared/object-defaults.js';
import { getWireframeMode } from '../canvas-renderer-3d.js';
import { registerCallback, invokeCallback } from '../../shared/callbacks.js';

const objLoader = new OBJLoader();
const meshCache = new Map();

registerCallback('primitiveRenderCallback');
registerCallback('primitiveStatusCallback');

export function getPrimitiveMeshInfo(item) {
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

export function clearPrimitiveMeshCache() {
  meshCache.clear();
}

export function createPrimitive3DMesh(item) {
  const pos = item.position || { x: 0, y: 0, z: 0 };
  const size = item.size || { x: 1, y: 1, z: 1 };
  const rotAndTra = item.rot_and_tra || [0, 0, 0, 0, 0, 0, 0, 0, 0];

  const isPlayfield = item.name === 'playfield_mesh';

  const rotX = ((rotAndTra[0] || 0) * Math.PI) / 180;
  const rotY = ((rotAndTra[1] || 0) * Math.PI) / 180;
  const rotZ = ((rotAndTra[2] || 0) * Math.PI) / 180;
  const transX = rotAndTra[3] || 0;
  const transY = rotAndTra[4] || 0;
  const transZ = rotAndTra[5] || 0;
  const objRotX = ((rotAndTra[6] || 0) * Math.PI) / 180;
  const objRotY = ((rotAndTra[7] || 0) * Math.PI) / 180;
  const objRotZ = ((rotAndTra[8] || 0) * Math.PI) / 180;

  // Build matrix exactly like VPX RecalculateMatrices:
  // RTmatrix = Trans * RotZ * RotY * RotX * ObjRotZ * ObjRotY * ObjRotX
  // fullMatrix = Scale * RTmatrix * Position
  const scaleMatrix = new THREE.Matrix4().makeScale(size.x || 1, size.y || 1, size.z || 1);
  const transMatrix = new THREE.Matrix4().makeTranslation(transX, transY, transZ);
  const posMatrix = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);

  const rotXMatrix = new THREE.Matrix4().makeRotationX(rotX);
  const rotYMatrix = new THREE.Matrix4().makeRotationY(rotY);
  const rotZMatrix = new THREE.Matrix4().makeRotationZ(rotZ);
  const objRotXMatrix = new THREE.Matrix4().makeRotationX(objRotX);
  const objRotYMatrix = new THREE.Matrix4().makeRotationY(objRotY);
  const objRotZMatrix = new THREE.Matrix4().makeRotationZ(objRotZ);

  // VPX uses row-major matrices, Three.js uses column-major
  // VPX order: Scale * RTmatrix * Position (applied right-to-left in VPX)
  // For Three.js column-major, we need to reverse: Position * RTmatrix * Scale
  // And RTmatrix = ObjRotX * ObjRotY * ObjRotZ * RotX * RotY * RotZ * Trans
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
    loadPrimitiveOBJ(objPath, meshContainer, placeholder, item);
  }

  return group;
}

async function loadPrimitiveOBJ(objPath, meshContainer, placeholder, item) {
  try {
    const result = await window.vpxEditor.readFile(objPath);
    if (!result.success) return;

    const obj = objLoader.parse(result.content);

    let defaultColor = null;
    if (item.color) {
      if (typeof item.color === 'string' && item.color.startsWith('#')) {
        defaultColor = parseInt(item.color.slice(1), 16);
      } else if (typeof item.color === 'number') {
        defaultColor = item.color;
      }
    }

    const isPlayfield = item.name === 'playfield_mesh';
    const imageName = isPlayfield ? state.gamedata?.image : item.image;
    const materialName = isPlayfield ? state.gamedata?.playfield_material : item.material;

    const material = createMaterial(materialName, imageName, defaultColor);
    material.wireframe = getWireframeMode();

    obj.traverse(child => {
      if (child.isMesh) {
        const positions = child.geometry.attributes.position;
        if (positions) {
          for (let i = 0; i < positions.count; i++) {
            positions.setZ(i, -positions.getZ(i));
          }
          positions.needsUpdate = true;
        }

        const normals = child.geometry.attributes.normal;
        if (normals) {
          for (let i = 0; i < normals.count; i++) {
            normals.setZ(i, -normals.getZ(i));
          }
          normals.needsUpdate = true;
        }

        child.material = material;
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
      }
    });

    meshContainer.remove(placeholder);
    placeholder.geometry.dispose();
    placeholder.material.dispose();
    meshContainer.add(obj);
  } catch (e) {
    console.warn('Failed to load OBJ:', objPath, e);
  }
}

export function renderPrimitive(item, isSelected) {
  const pos = item.position || { x: 0, y: 0, z: 0 };

  if (item.name === 'playfield_mesh') return;

  const cacheKey = item._fileName;
  const cached = cacheKey ? meshCache.get(cacheKey) : null;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected, '#555555');
  elements.ctx.lineWidth = getLineWidth(isSelected);

  if (cached && cached.vertices && cached.indices) {
    const size = item.size || { x: 1, y: 1, z: 1 };
    const rotAndTra = item.rot_and_tra || [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const transformed = transformMeshVertices(cached.vertices, cached.normals || [], pos, size, rotAndTra);
    const edgeFactor = item.edge_factor_ui ?? 0.25;
    const numVertices = cached.vertices.length / 3;
    drawWireframe(
      transformed.vertices2D,
      cached.indices,
      cached.normalIndices,
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

    elements.ctx.beginPath();
    elements.ctx.moveTo(p0.x, p0.y);
    elements.ctx.lineTo(p1.x, p1.y);
    elements.ctx.lineTo(p2.x, p2.y);
    elements.ctx.lineTo(p3.x, p3.y);
    elements.ctx.closePath();
    elements.ctx.stroke();

    elements.ctx.beginPath();
    elements.ctx.moveTo(p0.x, p0.y);
    elements.ctx.lineTo(p2.x, p2.y);
    elements.ctx.moveTo(p1.x, p1.y);
    elements.ctx.lineTo(p3.x, p3.y);
    elements.ctx.stroke();
  }
}

function transformMeshVertices(vertices, normals, pos, size, rotAndTra) {
  const rotX = ((rotAndTra[0] || 0) * Math.PI) / 180;
  const rotY = ((rotAndTra[1] || 0) * Math.PI) / 180;
  const rotZ = ((rotAndTra[2] || 0) * Math.PI) / 180;
  const transX = rotAndTra[3] || 0;
  const transY = rotAndTra[4] || 0;
  const transZ = rotAndTra[5] || 0;
  const objRotX = ((rotAndTra[6] || 0) * Math.PI) / 180;
  const objRotY = ((rotAndTra[7] || 0) * Math.PI) / 180;
  const objRotZ = ((rotAndTra[8] || 0) * Math.PI) / 180;

  const vertices2D = [];
  const normalsZ = [];

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

function drawWireframe(vertices2D, indices, normalIndices, normalsZ, edgeFactor, numVertices, item, isSelected) {
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

async function loadMeshForCache(item) {
  if (!item._fileName || !state.extractedDir) return;

  const cacheKey = item._fileName;
  meshCache.set(cacheKey, { loading: true });

  const objPath = `${state.extractedDir}/${item._fileName.replace('.json', '.obj')}`;

  try {
    const result = await window.vpxEditor.readFile(objPath);
    if (!result.success) {
      meshCache.set(cacheKey, { error: true });
      return;
    }

    const parsed = parseOBJSimple(result.content);
    meshCache.set(cacheKey, parsed);

    invokeCallback('primitiveRenderCallback');
    invokeCallback('primitiveStatusCallback', item);
  } catch (e) {
    meshCache.set(cacheKey, { error: true });
  }
}

function parseOBJSimple(objText) {
  const vertices = [];
  const normals = [];
  const indices = [];
  const normalIndices = [];
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
      const faceVerts = [];
      const faceNorms = [];
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

export function primitiveProperties(item) {
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
          <input type="number" class="prop-input" data-prop="position.x" value="${pos.x.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="position.y" value="${pos.y.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z</label>
          <input type="number" class="prop-input" data-prop="position.z" value="${pos.z.toFixed(2)}" step="1">
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
          <input type="number" class="prop-input" data-prop="rot_and_tra.3" value="${rot[3].toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">TransY</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.4" value="${rot[4].toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">TransZ</label>
          <input type="number" class="prop-input" data-prop="rot_and_tra.5" value="${rot[5].toFixed(1)}" step="1">
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
          <input type="number" class="prop-input" data-prop="sides" value="${item.sides ?? PRIMITIVE_DEFAULTS.sides}" step="1" min="3" max="100">
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
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
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
        <div class="prop-row">
          <label class="prop-label">Physics Material</label>
          <select class="prop-select" data-prop="physics_material">${materialOptions(item.physics_material)}</select>
        </div>
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
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? PRIMITIVE_DEFAULTS.elasticity_FALLOFF).toFixed(3)}" step="0.01">
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
