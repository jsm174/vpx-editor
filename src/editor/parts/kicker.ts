import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { createMaterialWithTexture } from '../../shared/3d-material-helpers.js';
import { materialOptions, surfaceOptions } from '../../shared/options-generators.js';
import { KICKER_DEFAULTS } from '../../shared/object-defaults.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { RENDER_COLOR_RED, RENDER_COLOR_BLACK } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';

const KICKER_ARROW_HALF_LENGTH = 50.0;
const KICKER_ARROW_HEAD_ANGLE = 0.6;

const KICKER_TYPES = [
  { value: 'cup', label: 'Cup' },
  { value: 'cup2', label: 'Cup 2' },
  { value: 'gottlieb', label: 'Gottlieb' },
  { value: 'hole', label: 'Hole' },
  { value: 'hole_simple', label: 'Hole Simple' },
  { value: 'invisible', label: 'Invisible' },
  { value: 'williams', label: 'Williams' },
];

function kickerTypeOptions(currentValue: string): string {
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

export function createKicker3DMesh(item: unknown): THREE.Object3D | null {
  const kickerItem = item as {
    center?: Point;
    kicker_type?: string;
    radius?: number;
    orientation?: number;
    material?: string;
  };

  const center = kickerItem.center;
  if (!center) return null;

  const kickerType = (kickerItem.kicker_type || 'hole').toLowerCase();
  if (kickerType === 'invisible') return null;

  const radius = kickerItem.radius ?? KICKER_DEFAULTS.radius;
  let orientation = ((kickerItem.orientation ?? KICKER_DEFAULTS.orientation) * Math.PI) / 180;
  let zOffset = 0;
  let meshData;
  let textureName: string | null = null;

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
  const material = createMaterialWithTexture(kickerItem.material, null, textureName);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, center.y, 0.5);

  return mesh;
}

function getKickerGeometry(item: unknown, scale: number): { r: number; rad: number } {
  const kickerItem = item as {
    radius?: number;
    orientation?: number;
  };

  const radius = kickerItem.radius ?? KICKER_DEFAULTS.radius;
  const orientation = kickerItem.orientation ?? KICKER_DEFAULTS.orientation;
  const r = radius * scale;
  const rad = (-orientation * Math.PI) / 180;
  return { r, rad };
}

function drawKicker(
  ctx: CanvasRenderingContext2D,
  item: unknown,
  cx: number,
  cy: number,
  scale: number,
  strokeStyle: string,
  lineWidth: number,
  arrowColor: string
): void {
  const { r, rad } = getKickerGeometry(item, scale);

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  [0.75, 0.5, 0.25].forEach(s => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
    ctx.stroke();
  });

  const halfLength = KICKER_ARROW_HALF_LENGTH * scale;
  const len1 = halfLength * 0.5;
  const len2 = halfLength * 0.25;
  const tipX = cx + Math.sin(rad) * len1;
  const tipY = cy - Math.cos(rad) * len1;

  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  const arrowAng1 = rad + KICKER_ARROW_HEAD_ANGLE;
  const arrowAng2 = rad - KICKER_ARROW_HEAD_ANGLE;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx + Math.sin(arrowAng1) * len2, cy - Math.cos(arrowAng1) * len2);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx + Math.sin(arrowAng2) * len2, cy - Math.cos(arrowAng2) * len2);
  ctx.stroke();
}

export function uiRenderPass1(_item: unknown, _isSelected: boolean): void {}

export function uiRenderPass2(item: unknown, isSelected: boolean): void {
  if (!elements.ctx) return;
  const kickerItem = item as { center?: Point };
  const { center } = kickerItem;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  drawKicker(
    elements.ctx,
    item,
    cx,
    cy,
    state.zoom,
    getStrokeStyle(item as { is_locked?: boolean }, isSelected),
    getLineWidth(isSelected),
    RENDER_COLOR_RED
  );
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: unknown, scale: number, _solid: boolean): void {
  const kickerItem = item as { center?: Point };
  const { center } = kickerItem;
  if (!center) return;

  drawKicker(ctx, item, center.x * scale, center.y * scale, scale, RENDER_COLOR_BLACK, 1, RENDER_COLOR_RED);
}

export function render(item: unknown, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function kickerProperties(item: unknown): string {
  const kickerItem = item as {
    material?: string;
    kicker_type?: string;
    radius?: number;
    orientation?: number;
    center?: { x?: number; y?: number };
    surface?: string;
    is_enabled?: boolean;
    fall_through?: boolean;
    legacy_mode?: boolean;
    scatter?: number;
    hit_accuracy?: number;
    hit_height?: number;
    is_timer_enabled?: boolean;
    timer_interval?: number;
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
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(kickerItem.material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Display</label>
          <select class="prop-select" data-prop="kicker_type">${kickerTypeOptions(kickerItem.kicker_type || 'hole')}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Radius</label>
          <input type="number" class="prop-input" data-prop="radius" value="${(kickerItem.radius ?? KICKER_DEFAULTS.radius).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Orientation</label>
          <input type="number" class="prop-input" data-prop="orientation" value="${(kickerItem.orientation ?? KICKER_DEFAULTS.orientation).toFixed(1)}" step="5">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" value="${(kickerItem.center?.x ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" value="${(kickerItem.center?.y ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(kickerItem.surface)}</select>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_enabled" ${kickerItem.is_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Fall Through</label>
          <input type="checkbox" class="prop-input" data-prop="fall_through" ${kickerItem.fall_through ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Legacy</label>
          <input type="checkbox" class="prop-input" data-prop="legacy_mode" ${kickerItem.legacy_mode ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(kickerItem.scatter ?? KICKER_DEFAULTS.scatter).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Accuracy (0..1)</label>
          <input type="number" class="prop-input" data-prop="hit_accuracy" value="${(kickerItem.hit_accuracy ?? KICKER_DEFAULTS.hit_accuracy).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Height</label>
          <input type="number" class="prop-input" data-prop="hit_height" value="${(kickerItem.hit_height ?? KICKER_DEFAULTS.hit_height).toFixed(1)}" step="5">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="timer">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_timer_enabled" ${kickerItem.is_timer_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="timer_interval" value="${kickerItem.timer_interval ?? KICKER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: unknown): Point | null {
  const kickerItem = item as { center?: { x?: number; y?: number } };
  const center = kickerItem.center;
  return center ? { x: center.x ?? 0, y: center.y ?? 0 } : null;
}

function putCenter(item: unknown, center: Point): void {
  const kickerItem = item as { center?: { x: number; y: number } };
  kickerItem.center = { x: center.x, y: center.y };
}

const kickerRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  create3DMesh: createKicker3DMesh,
  getProperties: kickerProperties,
  getCenter,
  putCenter,
};
registerEditable('Kicker', kickerRenderer);
