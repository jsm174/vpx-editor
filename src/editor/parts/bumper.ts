import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { materialOptions, surfaceOptions } from '../../shared/options-generators.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { createMaterialWithTexture } from '../../shared/3d-material-helpers.js';
import { BUMPER_DEFAULTS } from '../../shared/object-defaults.js';
import {
  numberInput,
  checkbox,
  select,
  propGroup,
  propTabs,
  propTabContent,
  timerTab,
} from '../../shared/property-templates.js';
import { getMaterialColor } from '../../shared/color-utils.js';
import { RENDER_COLOR_BLACK, BLUEPRINT_SOLID_COLOR } from '../../shared/constants.js';
import { registerEditable, IEditable } from './registry.js';
import type { Bumper, Point } from '../../types/game-objects.js';

import bumperBaseMesh from '../meshes/bumperBase.json';
import bumperCapMesh from '../meshes/bumperCap.json';
import bumperRingMesh from '../meshes/bumperRing.json';
import bumperSocketMesh from '../meshes/bumperSocket.json';

const BUMPER_POLE_RADIUS = 10.0;
const BUMPER_POLE_OFFSET = 10.0;
const BUMPER_OUTER_RADIUS_MULT = 1.5;
const BUMPER_CROSS_SIZE = 10.0;

interface BumperGeometry {
  r: number;
  outerR: number;
  poleR: number;
  poleOffset: number;
  rad: number;
}

export function createBumper3DMesh(item: Bumper): THREE.Group | null {
  const center = item.center;
  if (!center) return null;

  const radius = item.radius ?? BUMPER_DEFAULTS.radius;
  const heightScale = item.height_scale ?? BUMPER_DEFAULTS.height_scale;
  const orientation = ((item.orientation ?? BUMPER_DEFAULTS.orientation) * Math.PI) / 180;
  const baseHeight = 0;

  const group = new THREE.Group();

  if (item.is_base_visible !== false) {
    const geom = createMeshGeometry(bumperBaseMesh, {
      scaleXY: radius,
      scaleZ: heightScale,
      offsetZ: baseHeight,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.base_material, null, 'BumperBase.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  if (item.is_cap_visible !== false) {
    const geom = createMeshGeometry(bumperCapMesh, {
      scaleXY: radius * 2,
      scaleZ: heightScale,
      offsetZ: heightScale + baseHeight,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.cap_material, null, 'BumperCap.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  if (item.is_ring_visible !== false) {
    const geom = createMeshGeometry(bumperRingMesh, {
      scaleXY: radius,
      scaleZ: heightScale,
      offsetZ: baseHeight,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.ring_material, null, 'BumperRing.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  if (item.is_socket_visible !== false) {
    const geom = createMeshGeometry(bumperSocketMesh, {
      scaleXY: radius,
      scaleZ: heightScale,
      offsetZ: baseHeight + 5,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.socket_material, null, 'BumperSkirt.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  group.position.set(center.x, center.y, 0.5);
  return group;
}

function getBumperGeometry(item: Bumper, scale: number): BumperGeometry {
  const radius = item.radius ?? BUMPER_DEFAULTS.radius;
  const orientation = item.orientation ?? BUMPER_DEFAULTS.orientation;
  const r = radius * scale;
  const outerR = r * BUMPER_OUTER_RADIUS_MULT;
  const poleR = BUMPER_POLE_RADIUS * scale;
  const poleOffset = r + BUMPER_POLE_OFFSET * scale;
  const rad = (-(orientation - 90) * Math.PI) / 180;

  return { r, outerR, poleR, poleOffset, rad };
}

function drawBumperCircles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  outerR: number,
  poleR: number,
  poleOffset: number,
  rad: number,
  strokeStyle: string,
  lineWidth: number,
  fillStyle: string | null
): void {
  const pole1x = cx - Math.cos(rad) * poleOffset;
  const pole1y = cy - Math.sin(rad) * poleOffset;
  const pole2x = cx + Math.cos(rad) * poleOffset;
  const pole2y = cy + Math.sin(rad) * poleOffset;

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;

  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(pole1x, pole1y, poleR, 0, Math.PI * 2);
  if (fillStyle) ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pole2x, pole2y, poleR, 0, Math.PI * 2);
  if (fillStyle) ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  if (fillStyle) ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fillStyle) ctx.fill();
  ctx.stroke();
}

export function uiRenderPass1(item: Bumper, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;
  const { center } = item;
  if (!center) return;

  if (!state.viewSolid) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const { r, outerR, poleR, poleOffset, rad } = getBumperGeometry(item, state.zoom);

  const defaultColor = state.editorColors?.defaultMaterial || '#ff69b4';
  const capColor = getMaterialColor(item.cap_material, defaultColor);
  const baseColor = getMaterialColor(item.base_material, defaultColor);

  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(cx - Math.cos(rad) * poleOffset, cy - Math.sin(rad) * poleOffset, poleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + Math.cos(rad) * poleOffset, cy + Math.sin(rad) * poleOffset, poleR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

export function uiRenderPass2(item: Bumper, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;
  const { center } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const { r, outerR, poleR, poleOffset, rad } = getBumperGeometry(item, state.zoom);

  drawBumperCircles(
    ctx,
    cx,
    cy,
    r,
    outerR,
    poleR,
    poleOffset,
    rad,
    getStrokeStyle(item, isSelected),
    getLineWidth(isSelected),
    null
  );

  if (state.drawLightCenters) {
    const crossSize = BUMPER_CROSS_SIZE * state.zoom;
    ctx.strokeStyle = RENDER_COLOR_BLACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - crossSize, cy);
    ctx.lineTo(cx + crossSize, cy);
    ctx.moveTo(cx, cy - crossSize);
    ctx.lineTo(cx, cy + crossSize);
    ctx.stroke();
  }
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: Bumper, scale: number, solid: boolean): void {
  const { center } = item;
  if (!center) return;

  const cx = center.x * scale;
  const cy = center.y * scale;
  const { r, outerR, poleR, poleOffset, rad } = getBumperGeometry(item, scale);

  drawBumperCircles(
    ctx,
    cx,
    cy,
    r,
    outerR,
    poleR,
    poleOffset,
    rad,
    RENDER_COLOR_BLACK,
    1,
    solid ? BLUEPRINT_SOLID_COLOR : null
  );
}

export function render(item: Bumper, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestBumper(
  item: Bumper,
  _worldX: number,
  _worldY: number,
  _center?: Point,
  distFromCenter?: number
): boolean {
  const r = (item.radius ?? BUMPER_DEFAULTS.radius) * 1.5;
  return (distFromCenter ?? 0) < r;
}

export function bumperProperties(item: Bumper): string {
  return `
    ${propTabs([
      { id: 'visuals', label: 'Visuals' },
      { id: 'physics', label: 'Physics' },
      { id: 'timer', label: 'Timer' },
    ])}

    ${propTabContent(
      'visuals',
      `
      ${propGroup(`
        ${select('Cap Material', 'cap_material', materialOptions(item.cap_material))}
        ${select('Base Material', 'base_material', materialOptions(item.base_material))}
        ${select('Skirt Material', 'socket_material', materialOptions(item.socket_material))}
        ${select('Ring Material', 'ring_material', materialOptions(item.ring_material))}
        ${numberInput('Radius', 'radius', item.radius ?? BUMPER_DEFAULTS.radius, 1)}
        ${numberInput('Height Scale', 'height_scale', item.height_scale ?? BUMPER_DEFAULTS.height_scale, 5)}
        ${numberInput('Orientation', 'orientation', item.orientation ?? BUMPER_DEFAULTS.orientation, 5)}
        ${numberInput('Ring Speed', 'ring_speed', item.ring_speed ?? BUMPER_DEFAULTS.ring_speed, 0.1)}
        ${numberInput('Ring Drop Offset', 'ring_drop_offset', item.ring_drop_offset ?? BUMPER_DEFAULTS.ring_drop_offset, 1)}
        ${checkbox('Reflection Enabled', 'is_reflection_enabled', item.is_reflection_enabled !== false)}
        ${checkbox('Cap Visible', 'is_cap_visible', item.is_cap_visible !== false)}
        ${checkbox('Base Visible', 'is_base_visible', item.is_base_visible !== false)}
        ${checkbox('Ring Visible', 'is_ring_visible', item.is_ring_visible !== false)}
        ${checkbox('Skirt Visible', 'is_socket_visible', item.is_socket_visible !== false)}
      `)}
      ${propGroup(
        `
        ${numberInput('X', 'center.x', item.center?.x ?? 0, 1)}
        ${numberInput('Y', 'center.y', item.center?.y ?? 0, 1)}
        ${select('Surface', 'surface', surfaceOptions(item.surface))}
      `,
        'Position'
      )}
    `,
      true
    )}

    ${propTabContent(
      'physics',
      `
      ${propGroup(`
        ${checkbox('Has Hit Event', 'hit_event', item.hit_event)}
        ${numberInput('Force', 'force', item.force ?? BUMPER_DEFAULTS.force, 0.5)}
        ${numberInput('Hit Threshold', 'threshold', item.threshold ?? BUMPER_DEFAULTS.threshold, 0.5)}
        ${numberInput('Scatter Angle', 'scatter', item.scatter ?? BUMPER_DEFAULTS.scatter, 1)}
        ${checkbox('Collidable', 'is_collidable', item.is_collidable !== false)}
      `)}
    `
    )}

    ${timerTab(item, BUMPER_DEFAULTS.timer_interval)}
  `;
}

function getCenter(item: Bumper): Point | null {
  return item.center ? { x: item.center.x, y: item.center.y } : null;
}

function putCenter(item: Bumper, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const bumperRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestBumper,
  create3DMesh: createBumper3DMesh,
  getProperties: bumperProperties,
  getCenter,
  putCenter,
};

registerEditable('Bumper', bumperRenderer);
