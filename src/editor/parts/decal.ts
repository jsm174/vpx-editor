import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getLineWidth, getStrokeStyle, drawPolygon, convertToUnit, getUnitSuffixHtml } from '../utils.js';
import { materialOptions, imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { materialSelect, imageSelect } from '../../shared/property-templates.js';
import { DECAL_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, RENDER_COLOR_BLUE, BLUEPRINT_SOLID_COLOR } from '../../shared/constants.js';
import { registerEditable, IEditable } from './registry.js';
import { loadTexture } from '../texture-loader.js';
import { createMaterial, getSurfaceHeight } from '../../shared/3d-material-helpers.js';
import type { Decal, Point } from '../../types/game-objects.js';

interface Corner {
  x: number;
  y: number;
}

function getDecalCorners(item: Decal, cx: number, cy: number, scale: number): Corner[] {
  const halfW = ((item.width ?? DECAL_DEFAULTS.width) * scale) / 2;
  const halfH = ((item.height ?? DECAL_DEFAULTS.height) * scale) / 2;
  const rot = ((item.rotation ?? DECAL_DEFAULTS.rotation) * Math.PI) / 180;

  const sn = Math.sin(rot);
  const cs = Math.cos(rot);

  return [
    { x: cx + sn * halfH + cs * halfW, y: cy - cs * halfH + sn * halfW },
    { x: cx + sn * halfH - cs * halfW, y: cy - cs * halfH - sn * halfW },
    { x: cx - sn * halfH - cs * halfW, y: cy + cs * halfH - sn * halfW },
    { x: cx - sn * halfH + cs * halfW, y: cy + cs * halfH + sn * halfW },
  ];
}

const identityTransform = (x: number, y: number): Point => ({ x, y });

export function uiRenderPass1(item: Decal, _isSelected: boolean): void {
  if (!elements.ctx) return;
  if (!state.viewSolid) return;

  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const corners = getDecalCorners(item, cx, cy, state.zoom);
  drawPolygon(elements.ctx, corners, identityTransform, RENDER_COLOR_BLUE, null, 0);
}

export function uiRenderPass2(item: Decal, isSelected: boolean): void {
  if (!elements.ctx) return;
  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const corners = getDecalCorners(item, cx, cy, state.zoom);
  drawPolygon(
    elements.ctx,
    corners,
    identityTransform,
    null,
    getStrokeStyle(item, isSelected),
    isSelected ? 4 : getLineWidth(isSelected)
  );
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: Decal, scale: number, solid: boolean): void {
  const center = item.center || item.vCenter;
  if (!center) return;

  const cx = center.x * scale;
  const cy = center.y * scale;
  const corners = getDecalCorners(item, cx, cy, scale);
  drawPolygon(ctx, corners, identityTransform, solid ? BLUEPRINT_SOLID_COLOR : null, RENDER_COLOR_BLACK, 1);
}

export function render(item: Decal, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function createDecal3DMesh(item: Decal): THREE.Mesh | null {
  const center = item.center || (item as { vCenter?: Point }).vCenter;
  if (!center) return null;

  const width = item.width ?? DECAL_DEFAULTS.width;
  const height = item.height ?? DECAL_DEFAULTS.height;
  const rotation = ((item.rotation ?? DECAL_DEFAULTS.rotation) * Math.PI) / 180;

  const geometry = new THREE.PlaneGeometry(width, height);

  const material = createMaterial(item.material, null);
  (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

  if (state.showMaterials && item.image && item.decal_type !== 'text') {
    loadTexture(item.image).then(texture => {
      if (texture) {
        (material as THREE.MeshStandardMaterial).map = texture;
        (material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, center.y, getSurfaceHeight(item.surface) + 0.2);
  mesh.rotation.z = -rotation;

  return mesh;
}

export function hitTestDecal(item: Decal, worldX: number, worldY: number, center?: Point): boolean {
  const w = item.width ?? DECAL_DEFAULTS.width;
  const h = item.height ?? DECAL_DEFAULTS.height;
  const hw = w / 2;
  const hh = h / 2;
  const rot = ((item.rotation ?? DECAL_DEFAULTS.rotation) * Math.PI) / 180;
  const c = center || item.center;
  if (!c) return false;
  const dx = worldX - c.x;
  const dy = worldY - c.y;
  const cs = Math.cos(-rot);
  const sn = Math.sin(-rot);
  const rx = dx * cs - dy * sn;
  const ry = dx * sn + dy * cs;
  return Math.abs(rx) <= hw && Math.abs(ry) <= hh;
}

export function decalProperties(item: Decal): string {
  const center = item.center || item.vCenter || { x: 0, y: 0 };
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        ${materialSelect('Material', 'material', materialOptions(item.material))}
        <div class="prop-row">
          <label class="prop-label">Type</label>
          <select class="prop-select" data-prop="decal_type">
            <option value="image"${(item.decal_type || 'image') === 'image' ? ' selected' : ''}>Image</option>
            <option value="text"${item.decal_type === 'text' ? ' selected' : ''}>Text</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Text</label>
          <input type="text" class="prop-input" data-prop="text" value="${item.text || ''}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Vertical Text</label>
          <input type="checkbox" class="prop-input" data-prop="vertical_text" ${item.vertical_text ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Font Color</label>
          <input type="color" class="prop-input" data-prop="color" value="${item.color || '#ffffff'}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Font</label>
          <input type="text" class="prop-input" value="${item.font?.name || 'Arial'}" readonly style="background: transparent; cursor: default;">
        </div>
        ${imageSelect('Image', 'image', imageOptions(item.image))}
        <div class="prop-row">
          <label class="prop-label">Sizing</label>
          <select class="prop-select" data-prop="sizing_type">
            <option value="auto_size"${item.sizing_type === 'auto_size' ? ' selected' : ''}>Auto Size</option>
            <option value="auto_width"${item.sizing_type === 'auto_width' ? ' selected' : ''}>Auto Width</option>
            <option value="manual_size"${(item.sizing_type || 'manual_size') === 'manual_size' ? ' selected' : ''}>Manual Size</option>
          </select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" data-convert-units value="${convertToUnit(center.x).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" data-convert-units value="${convertToUnit(center.y).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Width</label>
          <input type="number" class="prop-input" data-prop="width" data-convert-units value="${convertToUnit(item.width ?? DECAL_DEFAULTS.width).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" data-convert-units value="${convertToUnit(item.height ?? DECAL_DEFAULTS.height).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Rotation</label>
          <input type="number" class="prop-input" data-prop="rotation" value="${(item.rotation ?? DECAL_DEFAULTS.rotation).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(item.surface)}</select>
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: Decal): Point | null {
  const center = item.center || (item as { vCenter?: Point }).vCenter;
  return center ? { x: center.x, y: center.y } : null;
}

function putCenter(item: Decal, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const decalRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestDecal,
  create3DMesh: createDecal3DMesh,
  getProperties: decalProperties,
  getCenter,
  putCenter,
};

registerEditable('Decal', decalRenderer);
