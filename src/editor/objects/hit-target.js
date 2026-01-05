import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { HITTARGET_DEFAULTS } from '../../shared/object-defaults.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { RENDER_COLOR_BLACK, RENDER_COLOR_RED } from '../../shared/constants.js';

import hitTargetRoundMesh from '../meshes/hitTargetRound.json';
import hitTargetRectangleMesh from '../meshes/hitTargetRectangle.json';
import hitTargetFatRectangleMesh from '../meshes/hitTargetFatRectangle.json';
import hitTargetFatSquareMesh from '../meshes/hitTargetFatSquare.json';
import hitTargetT1SlimMesh from '../meshes/hitTargetT1Slim.json';
import hitTargetT2SlimMesh from '../meshes/hitTargetT2Slim.json';
import dropTargetT2Mesh from '../meshes/dropTargetT2.json';
import dropTargetT3Mesh from '../meshes/dropTargetT3.json';
import dropTargetT4Mesh from '../meshes/dropTargetT4.json';

export function createHitTarget3DMesh(item) {
  const pos = item.vPosition || item.position;
  if (!pos) return null;

  const size = item.size || {
    x: HITTARGET_DEFAULTS.size_x,
    y: HITTARGET_DEFAULTS.size_y,
    z: HITTARGET_DEFAULTS.size_z,
  };
  const rotZ = ((item.rot_z ?? HITTARGET_DEFAULTS.rot_z) * Math.PI) / 180;
  const targetType = (item.target_type || 'drop_target_simple').toLowerCase();

  let meshData;

  switch (targetType) {
    case 'drop_target_beveled':
      meshData = dropTargetT2Mesh;
      break;
    case 'drop_target_simple':
      meshData = dropTargetT3Mesh;
      break;
    case 'drop_target_flat_simple':
      meshData = dropTargetT4Mesh;
      break;
    case 'hit_target_round':
      meshData = hitTargetRoundMesh;
      break;
    case 'hit_target_rectangle':
      meshData = hitTargetRectangleMesh;
      break;
    case 'hit_fat_target_rectangle':
      meshData = hitTargetFatRectangleMesh;
      break;
    case 'hit_fat_target_square':
      meshData = hitTargetFatSquareMesh;
      break;
    case 'hit_target_slim':
      meshData = hitTargetT1SlimMesh;
      break;
    case 'hit_fat_target_slim':
      meshData = hitTargetT2SlimMesh;
      break;
    default:
      meshData = dropTargetT3Mesh;
      break;
  }

  const geometry = createMeshGeometry(meshData, { scaleX: size.x, scaleY: size.y, scaleZ: size.z, rotation: rotZ });
  const material = createMaterial(item.material, item.image);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(pos.x, pos.y, (pos.z || 0) + 0.5);

  return mesh;
}

const HALFLENGTH = 50.0;
const LEN1 = HALFLENGTH * 0.5;
const LEN2 = LEN1 * 0.5;
const ARROW_ANGLE = 0.6;

function getMeshForTargetType(targetType) {
  switch (targetType) {
    case 'drop_target_beveled':
      return dropTargetT2Mesh;
    case 'drop_target_simple':
      return dropTargetT3Mesh;
    case 'drop_target_flat_simple':
      return dropTargetT4Mesh;
    case 'hit_target_round':
      return hitTargetRoundMesh;
    case 'hit_target_rectangle':
      return hitTargetRectangleMesh;
    case 'hit_fat_target_rectangle':
      return hitTargetFatRectangleMesh;
    case 'hit_fat_target_square':
      return hitTargetFatSquareMesh;
    case 'hit_target_slim':
      return hitTargetT1SlimMesh;
    case 'hit_fat_target_slim':
      return hitTargetT2SlimMesh;
    default:
      return dropTargetT3Mesh;
  }
}

function renderHitTargetMeshToCtx(ctx, meshData, px, py, size, rotZ, transformFn) {
  if (!meshData || !meshData.indices || !meshData.positions) return;

  const cos = Math.cos(rotZ);
  const sin = Math.sin(rotZ);

  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  for (let i = 0; i < meshData.indices.length; i += 3) {
    const i0 = meshData.indices[i] * 3;
    const i1 = meshData.indices[i + 1] * 3;
    const i2 = meshData.indices[i + 2] * 3;

    const ax = meshData.positions[i0] * size.x;
    const ay = meshData.positions[i0 + 1] * size.y;
    const bx = meshData.positions[i1] * size.x;
    const by = meshData.positions[i1 + 1] * size.y;
    const cx = meshData.positions[i2] * size.x;
    const cy = meshData.positions[i2 + 1] * size.y;

    const a = transformFn(px + ax * cos - ay * sin, py + ax * sin + ay * cos);
    const b = transformFn(px + bx * cos - by * sin, py + bx * sin + by * cos);
    const c = transformFn(px + cx * cos - cy * sin, py + cx * sin + cy * cos);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function uiRenderPass1(item, isSelected) {}

export function uiRenderPass2(item, isSelected) {
  const pos = item.vPosition || item.position;
  if (!pos) return;

  const { x: px, y: py } = toScreen(pos.x, pos.y);
  const size = item.size || {
    x: HITTARGET_DEFAULTS.size_x,
    y: HITTARGET_DEFAULTS.size_y,
    z: HITTARGET_DEFAULTS.size_z,
  };
  const rotZ = ((item.rot_z ?? HITTARGET_DEFAULTS.rot_z) * Math.PI) / 180;
  const targetType = (item.target_type || 'drop_target_simple').toLowerCase();

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  const meshData = getMeshForTargetType(targetType);
  renderHitTargetMeshToCtx(elements.ctx, meshData, pos.x, pos.y, size, rotZ, toScreen);

  if (isSelected && !item.is_locked) {
    const radangle = ((item.rot_z ?? HITTARGET_DEFAULTS.rot_z) * Math.PI) / 180 - Math.PI;

    const sn = Math.sin(radangle);
    const cs = Math.cos(radangle);
    const tipX = px + sn * LEN1 * state.zoom;
    const tipY = py - cs * LEN1 * state.zoom;

    elements.ctx.strokeStyle = RENDER_COLOR_RED;
    elements.ctx.lineWidth = 1;

    elements.ctx.beginPath();
    elements.ctx.moveTo(tipX, tipY);
    elements.ctx.lineTo(px, py);
    elements.ctx.stroke();

    elements.ctx.beginPath();
    elements.ctx.moveTo(tipX, tipY);
    const arrowAng1 = radangle + ARROW_ANGLE;
    elements.ctx.lineTo(px + Math.sin(arrowAng1) * LEN2 * state.zoom, py - Math.cos(arrowAng1) * LEN2 * state.zoom);
    elements.ctx.moveTo(tipX, tipY);
    const arrowAng2 = radangle - ARROW_ANGLE;
    elements.ctx.lineTo(px + Math.sin(arrowAng2) * LEN2 * state.zoom, py - Math.cos(arrowAng2) * LEN2 * state.zoom);
    elements.ctx.stroke();
  }
}

export function renderBlueprint(ctx, item, scale, solid) {
  const pos = item.vPosition || item.position;
  if (!pos) return;

  const size = item.size || {
    x: HITTARGET_DEFAULTS.size_x,
    y: HITTARGET_DEFAULTS.size_y,
    z: HITTARGET_DEFAULTS.size_z,
  };
  const rotZ = ((item.rot_z ?? HITTARGET_DEFAULTS.rot_z) * Math.PI) / 180;
  const targetType = (item.target_type || 'drop_target_simple').toLowerCase();

  ctx.strokeStyle = RENDER_COLOR_BLACK;
  ctx.lineWidth = 1;

  const meshData = getMeshForTargetType(targetType);
  const transformFn = (x, y) => ({ x: x * scale, y: y * scale });
  renderHitTargetMeshToCtx(ctx, meshData, pos.x, pos.y, size, rotZ, transformFn);
}

export function render(item, isSelected) {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function renderHitTarget(item, isSelected) {
  render(item, isSelected);
}

export function hitTargetProperties(item) {
  const rawPos = item.position || {};
  const pos = { x: rawPos.x ?? 0, y: rawPos.y ?? 0, z: rawPos.z ?? 0 };
  const rawSize = item.size || {};
  const size = {
    x: rawSize.x ?? HITTARGET_DEFAULTS.size_x,
    y: rawSize.y ?? HITTARGET_DEFAULTS.size_y,
    z: rawSize.z ?? HITTARGET_DEFAULTS.size_z,
  };
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Type</label>
          <select class="prop-select" data-prop="target_type">
            <option value="drop_target_beveled"${item.target_type === 'drop_target_beveled' ? ' selected' : ''}>DropTarget Beveled</option>
            <option value="drop_target_simple"${(item.target_type || 'drop_target_simple') === 'drop_target_simple' ? ' selected' : ''}>DropTarget Simple</option>
            <option value="drop_target_flat_simple"${item.target_type === 'drop_target_flat_simple' ? ' selected' : ''}>DropTarget Simple Flat</option>
            <option value="hit_target_rectangle"${item.target_type === 'hit_target_rectangle' ? ' selected' : ''}>HitTarget Rectangle</option>
            <option value="hit_fat_target_rectangle"${item.target_type === 'hit_fat_target_rectangle' ? ' selected' : ''}>HitTarget Rectangle Fat</option>
            <option value="hit_target_round"${item.target_type === 'hit_target_round' ? ' selected' : ''}>HitTarget Round</option>
            <option value="hit_target_slim"${item.target_type === 'hit_target_slim' ? ' selected' : ''}>HitTarget Slim</option>
            <option value="hit_fat_target_slim"${item.target_type === 'hit_fat_target_slim' ? ' selected' : ''}>HitTarget Slim Fat</option>
            <option value="hit_fat_target_square"${item.target_type === 'hit_fat_target_square' ? ' selected' : ''}>HitTarget Square Fat</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Drop Speed</label>
          <input type="number" class="prop-input" data-prop="drop_speed" value="${(item.drop_speed ?? HITTARGET_DEFAULTS.drop_speed).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Raise Delay (ms)</label>
          <input type="number" class="prop-input" data-prop="raise_delay" value="${item.raise_delay ?? HITTARGET_DEFAULTS.raise_delay}" step="10">
        </div>
        <div class="prop-row">
          <label class="prop-label">Depth Bias</label>
          <input type="number" class="prop-input" data-prop="depth_bias" value="${(item.depth_bias ?? HITTARGET_DEFAULTS.depth_bias).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Disable Spot Lights (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_top_old" value="${(item.disable_lighting_top_old ?? HITTARGET_DEFAULTS.disable_lighting_top).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Translucency (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_below" value="${(item.disable_lighting_below ?? HITTARGET_DEFAULTS.disable_lighting_below).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
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
          <label class="prop-label">Scale X</label>
          <input type="number" class="prop-input" data-prop="size.x" value="${size.x.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scale Y</label>
          <input type="number" class="prop-input" data-prop="size.y" value="${size.y.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scale Z</label>
          <input type="number" class="prop-input" data-prop="size.z" value="${size.z.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Orientation</label>
          <input type="number" class="prop-input" data-prop="rot_z" value="${(item.rot_z ?? HITTARGET_DEFAULTS.rot_z).toFixed(1)}" step="5">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Has Hit Event</label>
          <input type="checkbox" class="prop-input" data-prop="use_hit_event" ${item.use_hit_event ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Threshold</label>
          <input type="number" class="prop-input" data-prop="threshold" value="${(item.threshold ?? HITTARGET_DEFAULTS.threshold).toFixed(2)}" step="0.5">
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
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? HITTARGET_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? HITTARGET_DEFAULTS.elasticity_FALLOFF).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? HITTARGET_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? HITTARGET_DEFAULTS.scatter).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Legacy Mode</label>
          <input type="checkbox" class="prop-input" data-prop="is_legacy" ${item.is_legacy ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_collidable" ${item.is_collidable !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">IsDropped</label>
          <input type="checkbox" class="prop-input" data-prop="is_dropped" ${item.is_dropped ? 'checked' : ''}>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="timer">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_timer_enabled" ${item.is_timer_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? HITTARGET_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
