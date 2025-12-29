import * as THREE from 'three';
import { state, elements } from '../state.js';
import {
  toScreen,
  generateSmoothedPath,
  getStrokeStyle,
  getLineWidth,
  getFillColorWithAlpha,
  pointInPolygon,
} from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { RUBBER_DEFAULTS } from '../../shared/object-defaults.js';

export function createRubber3DMesh(item) {
  const points = item.drag_points;
  if (!points || points.length < 2) return null;

  const thickness = item.thickness ?? RUBBER_DEFAULTS.thickness;
  const height = item.height ?? RUBBER_DEFAULTS.height;
  const rotX = ((item.rot_x ?? RUBBER_DEFAULTS.rotX) * Math.PI) / 180;
  const rotY = ((item.rot_y ?? RUBBER_DEFAULTS.rotY) * Math.PI) / 180;
  const rotZ = ((item.rot_z ?? RUBBER_DEFAULTS.rotZ) * Math.PI) / 180;

  const smoothed = generateSmoothedPath(points, true);
  if (smoothed.length < 2) return null;

  const pathPoints = smoothed.map(v => new THREE.Vector3(v.x, v.y, height / 2));

  const curve = new THREE.CatmullRomCurve3(pathPoints, true);
  const tubeGeom = new THREE.TubeGeometry(curve, pathPoints.length * 2, thickness / 2, 8, true);
  const material = createMaterial(item.material, item.image);
  const mesh = new THREE.Mesh(tubeGeom, material);

  if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
    const center = new THREE.Vector3();
    tubeGeom.computeBoundingBox();
    tubeGeom.boundingBox.getCenter(center);

    mesh.position.set(-center.x, -center.y, -center.z);

    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.order = 'ZYX';
    group.rotation.set(rotX, rotY, rotZ);
    group.position.set(center.x, center.y, center.z);
    return group;
  }

  return mesh;
}

function normalize(x, y) {
  const len = Math.sqrt(x * x + y * y);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function generateRubberShape(centerline, thickness, loop = false) {
  if (centerline.length < 2) return { left: [], right: [] };

  const left = [];
  const right = [];
  const halfWidth = thickness / 2;
  const cvertex = centerline.length;

  for (let i = 0; i < cvertex; i++) {
    const prev = loop ? centerline[i > 0 ? i - 1 : cvertex - 1] : i > 0 ? centerline[i - 1] : null;
    const curr = centerline[i];
    const next = loop ? centerline[i < cvertex - 1 ? i + 1 : 0] : i < cvertex - 1 ? centerline[i + 1] : null;

    let vnormal;

    if (!prev) {
      vnormal = normalize(-(next.y - curr.y), next.x - curr.x);
    } else if (!next) {
      vnormal = normalize(-(curr.y - prev.y), curr.x - prev.x);
    } else {
      const v1normal = normalize(prev.y - curr.y, curr.x - prev.x);
      const v2normal = normalize(curr.y - next.y, next.x - curr.x);

      if (Math.abs(v1normal.x - v2normal.x) < 0.0001 && Math.abs(v1normal.y - v2normal.y) < 0.0001) {
        vnormal = v1normal;
      } else {
        const A = prev.y - curr.y;
        const B = curr.x - prev.x;
        const C = A * (v1normal.x - prev.x) + B * (v1normal.y - prev.y);

        const D = next.y - curr.y;
        const E = curr.x - next.x;
        const F = D * (v2normal.x - next.x) + E * (v2normal.y - next.y);

        const det = A * E - B * D;
        if (Math.abs(det) < 0.0001) {
          vnormal = v1normal;
        } else {
          const inv_det = 1.0 / det;
          const intersectx = (B * F - E * C) * inv_det;
          const intersecty = (C * D - A * F) * inv_det;
          vnormal = { x: curr.x - intersectx, y: curr.y - intersecty };
        }
      }
    }

    left.push({
      x: curr.x + vnormal.x * halfWidth,
      y: curr.y + vnormal.y * halfWidth,
    });
    right.push({
      x: curr.x - vnormal.x * halfWidth,
      y: curr.y - vnormal.y * halfWidth,
    });
  }

  if (loop && left.length > 0) {
    left.push({ x: left[0].x, y: left[0].y });
    right.push({ x: right[0].x, y: right[0].y });
  }

  return { left, right };
}

const HIT_SHAPE_DETAIL_LEVEL = 7.0;
const RUBBER_2D_ACCURACY = 4.0 * Math.pow(10.0, (10.0 - HIT_SHAPE_DETAIL_LEVEL) / 1.5);

export function renderRubber(item, isSelected) {
  const points = item.drag_points;
  if (!points || points.length < 2) return;

  const thickness = item.thickness ?? RUBBER_DEFAULTS.thickness;

  const { vertices: centerline, controlPointIndices } = generateSmoothedPath(points, true, RUBBER_2D_ACCURACY, true);
  if (centerline.length < 2) return;

  const { left, right } = generateRubberShape(centerline, thickness, true);

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  elements.ctx.beginPath();

  const firstLeft = toScreen(left[0].x, left[0].y);
  elements.ctx.moveTo(firstLeft.x, firstLeft.y);

  for (let i = 1; i < left.length; i++) {
    const { x, y } = toScreen(left[i].x, left[i].y);
    elements.ctx.lineTo(x, y);
  }

  for (let i = right.length - 1; i >= 0; i--) {
    const { x, y } = toScreen(right[i].x, right[i].y);
    elements.ctx.lineTo(x, y);
  }

  elements.ctx.closePath();
  if (state.viewSolid) {
    elements.ctx.fillStyle = getFillColorWithAlpha(0.6);
    elements.ctx.fill();
  }
  elements.ctx.stroke();

  for (const idx of controlPointIndices) {
    if (idx < left.length && idx < right.length) {
      const leftPt = toScreen(left[idx].x, left[idx].y);
      const rightPt = toScreen(right[idx].x, right[idx].y);
      elements.ctx.beginPath();
      elements.ctx.moveTo(leftPt.x, leftPt.y);
      elements.ctx.lineTo(rightPt.x, rightPt.y);
      elements.ctx.stroke();
    }
  }
}

export function hitTestRubber(item, worldX, worldY) {
  if (!item.drag_points || item.drag_points.length < 2) return false;
  const thickness = item.thickness ?? RUBBER_DEFAULTS.thickness;
  const pts = item.drag_points.map(p => {
    const v = p.vertex || p;
    return { x: v.x, y: v.y };
  });
  const centerline = generateSmoothedPath(pts, true, RUBBER_2D_ACCURACY);
  if (centerline.length < 2) return false;
  const { left, right } = generateRubberShape(centerline, thickness, true);
  const polygon = [...left, ...right.slice().reverse()];
  return pointInPolygon(worldX, worldY, polygon);
}

export function rubberProperties(item) {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Static Rendering</label>
          <input type="checkbox" class="prop-input" data-prop="static_rendering" ${item.static_rendering ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${(item.height ?? RUBBER_DEFAULTS.height).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Thickness</label>
          <input type="number" class="prop-input" data-prop="thickness" value="${item.thickness ?? RUBBER_DEFAULTS.thickness}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Orientation</div>
        <div class="prop-row">
          <label class="prop-label">RotX</label>
          <input type="number" class="prop-input" data-prop="rot_x" value="${(item.rot_x ?? RUBBER_DEFAULTS.rotX).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotY</label>
          <input type="number" class="prop-input" data-prop="rot_y" value="${(item.rot_y ?? RUBBER_DEFAULTS.rotY).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotZ</label>
          <input type="number" class="prop-input" data-prop="rot_z" value="${(item.rot_z ?? RUBBER_DEFAULTS.rotZ).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Show in Editor</label>
          <input type="checkbox" class="prop-input" data-prop="show_in_editor" ${item.show_in_editor !== false ? 'checked' : ''}>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
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
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? RUBBER_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? RUBBER_DEFAULTS.elasticity_FALLOFF).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? RUBBER_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? RUBBER_DEFAULTS.scatter).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Height</label>
          <input type="number" class="prop-input" data-prop="hit_height" value="${(item.hit_height ?? RUBBER_DEFAULTS.hitHeight).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_collidable" ${item.is_collidable ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Has Hit Event</label>
          <input type="checkbox" class="prop-input" data-prop="hit_event" ${item.hit_event ? 'checked' : ''}>
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? RUBBER_DEFAULTS.timerInterval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
