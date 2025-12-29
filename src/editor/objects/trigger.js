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
import { materialOptions, surfaceOptions } from '../../shared/options-generators.js';
import { TRIGGER_DEFAULTS } from '../../shared/object-defaults.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';

import triggerSimpleMesh from '../meshes/triggerSimple.json';
import triggerStarMesh from '../meshes/triggerStar.json';
import triggerButtonMesh from '../meshes/triggerButton.json';
import triggerWireDMesh from '../meshes/triggerWireD.json';
import triggerInderMesh from '../meshes/triggerInder.json';

export function createTrigger3DMesh(item) {
  const center = item.center || item.vCenter;
  if (!center) return null;

  const shape = (item.shape || 'wire_a').toLowerCase();
  const radius = item.radius ?? TRIGGER_DEFAULTS.radius;
  const scaleX = item.scale_x ?? TRIGGER_DEFAULTS.scaleX;
  const scaleY = item.scale_y ?? TRIGGER_DEFAULTS.scaleY;
  const rotation = ((item.rotation ?? TRIGGER_DEFAULTS.rotation) * Math.PI) / 180;

  let meshData;
  let useRadius = false;

  switch (shape) {
    case 'star':
      meshData = triggerStarMesh;
      useRadius = true;
      break;
    case 'button':
      meshData = triggerButtonMesh;
      useRadius = true;
      break;
    case 'wire_d':
      meshData = triggerWireDMesh;
      break;
    case 'inder':
      meshData = triggerInderMesh;
      break;
    case 'wire_a':
    case 'wire_b':
    case 'wire_c':
    case 'none':
    default:
      meshData = triggerSimpleMesh;
      break;
  }

  const sx = useRadius ? radius : scaleX;
  const sy = useRadius ? radius : scaleY;
  const sz = useRadius ? radius : 1;

  const geometry = createMeshGeometry(meshData, { scaleX: sx, scaleY: sy, scaleZ: sz, rotation });
  const material = createMaterial(item.material, null);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, center.y, 0.5);

  return mesh;
}

export function renderTrigger(item, isSelected) {
  const center = item.center || item.vCenter;
  if (!center) return;

  const shape = (item.shape || 'wire_a').toLowerCase();
  const radius = item.radius ?? TRIGGER_DEFAULTS.radius;
  const rotation = ((item.rotation ?? TRIGGER_DEFAULTS.rotation) * Math.PI) / 180;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected, '#00b400');
  elements.ctx.lineWidth = getLineWidth(isSelected);

  if (shape === 'star' || shape === 'button') {
    const r = radius;
    const r2 = r * Math.SQRT1_2;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const screenCenter = toScreen(center.x, center.y);
    const screenRadius = r * state.zoom;

    elements.ctx.beginPath();
    elements.ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
    elements.ctx.stroke();

    const endpoints = [
      { x: -r, y: 0 },
      { x: r, y: 0 },
      { x: 0, y: -r },
      { x: 0, y: r },
      { x: -r2, y: -r2 },
      { x: r2, y: r2 },
      { x: -r2, y: r2 },
      { x: r2, y: -r2 },
    ].map(p => {
      const rx = p.x * cos - p.y * sin;
      const ry = p.x * sin + p.y * cos;
      return toScreen(center.x + rx, center.y + ry);
    });

    elements.ctx.beginPath();
    elements.ctx.moveTo(endpoints[0].x, endpoints[0].y);
    elements.ctx.lineTo(endpoints[1].x, endpoints[1].y);
    elements.ctx.moveTo(endpoints[2].x, endpoints[2].y);
    elements.ctx.lineTo(endpoints[3].x, endpoints[3].y);
    elements.ctx.moveTo(endpoints[4].x, endpoints[4].y);
    elements.ctx.lineTo(endpoints[5].x, endpoints[5].y);
    elements.ctx.moveTo(endpoints[6].x, endpoints[6].y);
    elements.ctx.lineTo(endpoints[7].x, endpoints[7].y);
    elements.ctx.stroke();
  } else {
    if (item.drag_points && item.drag_points.length >= 3) {
      let vertices;
      if (shape === 'none') {
        vertices = item.drag_points.map(p => {
          const v = p.vertex || p;
          return { x: v.x, y: v.y };
        });
      } else {
        vertices = generateSmoothedPath(item.drag_points, true, 8);
      }
      if (vertices.length >= 3) {
        elements.ctx.beginPath();
        const first = toScreen(vertices[0].x, vertices[0].y);
        elements.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < vertices.length; i++) {
          const pt = toScreen(vertices[i].x, vertices[i].y);
          elements.ctx.lineTo(pt.x, pt.y);
        }
        elements.ctx.closePath();
        if (state.viewSolid) {
          elements.ctx.fillStyle = getFillColorWithAlpha(0.3);
          elements.ctx.fill();
        }
        elements.ctx.stroke();

        if (vertices.length === 4) {
          const p0 = toScreen(vertices[0].x, vertices[0].y);
          const p1 = toScreen(vertices[1].x, vertices[1].y);
          const p2 = toScreen(vertices[2].x, vertices[2].y);
          const p3 = toScreen(vertices[3].x, vertices[3].y);
          elements.ctx.beginPath();
          elements.ctx.moveTo(p0.x, p0.y);
          elements.ctx.lineTo(p2.x, p2.y);
          elements.ctx.moveTo(p1.x, p1.y);
          elements.ctx.lineTo(p3.x, p3.y);
          elements.ctx.stroke();
        }
      }
    }

    if (shape === 'wire_a' || shape === 'wire_b' || shape === 'wire_c' || shape === 'wire_d' || shape === 'inder') {
      let meshData;
      if (shape === 'wire_d') {
        meshData = triggerWireDMesh;
      } else if (shape === 'inder') {
        meshData = triggerInderMesh;
      } else {
        meshData = triggerSimpleMesh;
      }

      if (meshData.indices && meshData.indices.length > 0) {
        const scaleX = item.scale_x ?? TRIGGER_DEFAULTS.scaleX;
        const scaleY = item.scale_y ?? TRIGGER_DEFAULTS.scaleY;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const numPts = Math.floor(meshData.indices.length / 3) + 1;
        const drawPts = [];

        const ax = meshData.positions[meshData.indices[0] * 3];
        const ay = meshData.positions[meshData.indices[0] * 3 + 1];
        const arx = (ax * cos - ay * sin) * scaleX;
        const ary = (ax * sin + ay * cos) * scaleY;
        drawPts.push(toScreen(center.x + arx, center.y + ary));

        for (let i = 0; i < meshData.indices.length; i += 3) {
          const idx = meshData.indices[i + 1];
          const bx = meshData.positions[idx * 3];
          const by = meshData.positions[idx * 3 + 1];
          const brx = (bx * cos - by * sin) * scaleX;
          const bry = (bx * sin + by * cos) * scaleY;
          drawPts.push(toScreen(center.x + brx, center.y + bry));
        }

        if (drawPts.length > 1) {
          elements.ctx.beginPath();
          elements.ctx.moveTo(drawPts[0].x, drawPts[0].y);
          for (let i = 1; i < drawPts.length; i++) {
            elements.ctx.lineTo(drawPts[i].x, drawPts[i].y);
          }
          elements.ctx.stroke();
        }
      }
    }
  }
}

export function hitTestTrigger(item, worldX, worldY, center, distFromCenter) {
  const shape = (item.shape || 'wire_a').toLowerCase();
  if (shape === 'star' || shape === 'button') {
    return distFromCenter < (item.radius ?? TRIGGER_DEFAULTS.radius);
  }
  if (!item.drag_points || item.drag_points.length < 3) return false;
  const pts = item.drag_points.map(p => {
    const v = p.vertex || p;
    return { x: v.x, y: v.y };
  });
  return pointInPolygon(worldX, worldY, pts);
}

export function triggerProperties(item) {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Shape</label>
          <select class="prop-select" data-prop="shape">
            <option value="button"${item.shape === 'button' ? ' selected' : ''}>Button</option>
            <option value="inder"${item.shape === 'inder' ? ' selected' : ''}>Inder</option>
            <option value="none"${item.shape === 'none' ? ' selected' : ''}>None</option>
            <option value="star"${item.shape === 'star' ? ' selected' : ''}>Star</option>
            <option value="wire_a"${!item.shape || item.shape === 'wire_a' ? ' selected' : ''}>Wire A</option>
            <option value="wire_b"${item.shape === 'wire_b' ? ' selected' : ''}>Wire B</option>
            <option value="wire_c"${item.shape === 'wire_c' ? ' selected' : ''}>Wire C</option>
            <option value="wire_d"${item.shape === 'wire_d' ? ' selected' : ''}>Wire D</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Wire Thickness</label>
          <input type="number" class="prop-input" data-prop="wire_thickness" value="${(item.wire_thickness ?? TRIGGER_DEFAULTS.wireThickness).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Star Radius</label>
          <input type="number" class="prop-input" data-prop="radius" value="${(item.radius ?? TRIGGER_DEFAULTS.radius).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Rotation</label>
          <input type="number" class="prop-input" data-prop="rotation" value="${(item.rotation ?? TRIGGER_DEFAULTS.rotation).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Animation Speed</label>
          <input type="number" class="prop-input" data-prop="anim_speed" value="${(item.anim_speed ?? TRIGGER_DEFAULTS.animSpeed).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" value="${(item.center?.x ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" value="${(item.center?.y ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(item.surface)}</select>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_enabled" ${item.is_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Height</label>
          <input type="number" class="prop-input" data-prop="hit_height" value="${(item.hit_height ?? TRIGGER_DEFAULTS.hitHeight).toFixed(1)}" step="5">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? TRIGGER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
