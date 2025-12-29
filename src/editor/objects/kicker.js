import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { createMaterialWithTexture } from '../../shared/3d-material-helpers.js';
import { materialOptions, surfaceOptions } from '../../shared/options-generators.js';
import { KICKER_DEFAULTS } from '../../shared/object-defaults.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';

const KICKER_TYPES = [
  { value: 'cup', label: 'Cup' },
  { value: 'cup2', label: 'Cup 2' },
  { value: 'gottlieb', label: 'Gottlieb' },
  { value: 'hole', label: 'Hole' },
  { value: 'hole_simple', label: 'Hole Simple' },
  { value: 'invisible', label: 'Invisible' },
  { value: 'williams', label: 'Williams' },
];

function kickerTypeOptions(currentValue) {
  return KICKER_TYPES.map(({ value, label }) => {
    const selected = value === currentValue ? ' selected' : '';
    return `<option value="${value}"${selected}>${label}</option>`;
  }).join('');
}

import kickerCupMesh from '../meshes/kickerCup.json';
import kickerHoleMesh from '../meshes/kickerHole.json';
import kickerSimpleHoleMesh from '../meshes/kickerSimpleHole.json';
import kickerWilliamsMesh from '../meshes/kickerWilliams.json';
import kickerGottliebMesh from '../meshes/kickerGottlieb.json';
import kickerT1Mesh from '../meshes/kickerT1.json';

export function createKicker3DMesh(item) {
  const center = item.center;
  if (!center) return null;

  const kickerType = (item.kicker_type || 'hole').toLowerCase();
  if (kickerType === 'invisible') return null;

  const radius = item.radius ?? KICKER_DEFAULT_RADIUS;
  let orientation = ((item.orientation ?? KICKER_DEFAULT_ORIENTATION) * Math.PI) / 180;
  let zOffset = 0;
  let meshData;
  let textureName = null;

  switch (kickerType) {
    case 'cup':
      meshData = kickerCupMesh;
      zOffset = -0.18;
      textureName = 'KickerCup.webp';
      break;
    case 'williams':
      meshData = kickerWilliamsMesh;
      orientation += Math.PI / 2;
      textureName = 'KickerWilliams.webp';
      break;
    case 'gottlieb':
      meshData = kickerGottliebMesh;
      textureName = 'KickerGottlieb.webp';
      break;
    case 'cup2':
      meshData = kickerT1Mesh;
      textureName = 'KickerT1.webp';
      break;
    case 'hole':
      meshData = kickerHoleMesh;
      orientation = 0;
      textureName = 'KickerHoleWood.webp';
      break;
    case 'hole_simple':
    default:
      meshData = kickerSimpleHoleMesh;
      orientation = 0;
      textureName = 'KickerHoleWood.webp';
      break;
  }

  const geometry = createMeshGeometry(meshData, { scale: radius, rotation: orientation, offsetZ: zOffset * radius });
  const material = createMaterialWithTexture(item.material, null, textureName);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, center.y, 0.5);

  return mesh;
}

export function renderKicker(item, isSelected) {
  const { center } = item;
  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const radius = item.radius ?? KICKER_DEFAULTS.radius;
  const orientation = item.orientation ?? KICKER_DEFAULTS.orientation;
  const r = radius * state.zoom;
  const rad = (-orientation * Math.PI) / 180;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, r, 0, Math.PI * 2);
  elements.ctx.stroke();

  [0.75, 0.5, 0.25].forEach(scale => {
    elements.ctx.beginPath();
    elements.ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    elements.ctx.stroke();
  });

  const arrowLen = r * 0.5;
  const arrowHeadLen = arrowLen * 0.5;
  const tipX = cx + Math.sin(rad) * arrowLen;
  const tipY = cy - Math.cos(rad) * arrowLen;

  elements.ctx.strokeStyle = '#ff0000';
  elements.ctx.lineWidth = 1;
  elements.ctx.beginPath();
  elements.ctx.moveTo(cx, cy);
  elements.ctx.lineTo(tipX, tipY);
  elements.ctx.stroke();

  elements.ctx.beginPath();
  elements.ctx.moveTo(tipX, tipY);
  elements.ctx.lineTo(tipX + Math.sin(rad + 2.5) * arrowHeadLen, tipY - Math.cos(rad + 2.5) * arrowHeadLen);
  elements.ctx.moveTo(tipX, tipY);
  elements.ctx.lineTo(tipX + Math.sin(rad - 2.5) * arrowHeadLen, tipY - Math.cos(rad - 2.5) * arrowHeadLen);
  elements.ctx.stroke();
}

export function kickerProperties(item) {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Display</label>
          <select class="prop-select" data-prop="kicker_type">${kickerTypeOptions(item.kicker_type || 'hole')}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Radius</label>
          <input type="number" class="prop-input" data-prop="radius" value="${(item.radius ?? KICKER_DEFAULTS.radius).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Orientation</label>
          <input type="number" class="prop-input" data-prop="orientation" value="${(item.orientation ?? KICKER_DEFAULTS.orientation).toFixed(1)}" step="5">
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
          <label class="prop-label">Fall Through</label>
          <input type="checkbox" class="prop-input" data-prop="fall_through" ${item.fall_through ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Legacy</label>
          <input type="checkbox" class="prop-input" data-prop="legacy_mode" ${item.legacy_mode ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? KICKER_DEFAULTS.scatter).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Accuracy (0..1)</label>
          <input type="number" class="prop-input" data-prop="hit_accuracy" value="${(item.hit_accuracy ?? KICKER_DEFAULTS.hitAccuracy).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Height</label>
          <input type="number" class="prop-input" data-prop="hit_height" value="${(item.hit_height ?? KICKER_DEFAULTS.hitHeight).toFixed(1)}" step="5">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? KICKER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
