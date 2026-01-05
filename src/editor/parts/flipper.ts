import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth, distToSegment } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { FLIPPER_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, RENDER_COLOR_GRAY } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';

import flipperBaseMesh from '../meshes/flipperBase.json';

interface MeshData {
  positions: number[];
  normals: number[];
  uvs?: number[];
  indices?: number[];
}

interface FlipperItem {
  center?: Point;
  base_radius?: number;
  end_radius?: number;
  flipper_radius_max?: number;
  flipper_radius_min?: number;
  height?: number;
  start_angle?: number;
  end_angle?: number;
  rubber_thickness?: number;
  rubber_height?: number;
  rubber_width?: number;
  material?: string;
  image?: string;
  rubber_material?: string;
  surface?: string;
  is_visible?: boolean;
  is_enabled?: boolean;
  is_reflection_enabled?: boolean;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  mass?: number;
  strength?: number;
  elasticity?: number;
  elasticity_falloff?: number;
  friction?: number;
  return_?: number;
  ramp_up?: number;
  scatter?: number;
  torque_damping?: number;
  torque_damping_angle?: number;
  override_physics?: number;
  _locked?: boolean;
  is_locked?: boolean;
}

interface FlipperVertices {
  endCenter: Point;
  rgv: Point[];
}

interface FlipperParams {
  angleRad: number;
  angleRad2: number;
  br: number;
  er: number;
  len: number;
  rubThick: number;
  startAngleVal: number;
  endAngleVal: number;
}

function createFlipperGeometry(
  meshData: MeshData,
  baseRadius: number,
  endRadius: number,
  flipperRadius: number,
  zScale: number,
  zOffset: number
): THREE.BufferGeometry {
  const positions = new Float32Array(meshData.positions.length);
  const normals = new Float32Array(meshData.normals.length);

  const meshEndY = 0.887744;
  const meshBaseRadius = 0.100762;

  for (let i = 0; i < meshData.positions.length; i += 3) {
    let x = meshData.positions[i];
    let y = meshData.positions[i + 1];
    let z = meshData.positions[i + 2];

    const isEnd = y > 0.5;
    if (isEnd) {
      const radiusScale = endRadius / meshBaseRadius;
      x *= radiusScale;
      const localY = (y - meshEndY) * radiusScale;
      y = flipperRadius + localY;
    } else {
      const radiusScale = baseRadius / meshBaseRadius;
      x *= radiusScale;
      y *= radiusScale;
    }

    x = -x;
    y = -y;

    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z * zScale + zOffset;

    normals[i] = -meshData.normals[i];
    normals[i + 1] = -meshData.normals[i + 1];
    normals[i + 2] = meshData.normals[i + 2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  if (meshData.uvs && meshData.uvs.length > 0) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(meshData.uvs), 2));
  }

  if (meshData.indices && meshData.indices.length > 0) {
    geometry.setIndex(meshData.indices);
  }

  return geometry;
}

export function createFlipper3DMesh(item: FlipperItem): THREE.Group | null {
  const center = item.center;
  if (!center) return null;

  const baseRadius = item.base_radius ?? FLIPPER_DEFAULTS.base_radius;
  const endRadius = item.end_radius ?? FLIPPER_DEFAULTS.end_radius;
  const flipperRadius = item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipper_radius_max;
  const height = item.height ?? FLIPPER_DEFAULTS.height;
  const startAngle = ((item.start_angle ?? FLIPPER_DEFAULTS.start_angle) * Math.PI) / 180;

  const rubberThickness = item.rubber_thickness ?? FLIPPER_DEFAULTS.rubber_thickness;
  const rubberHeight = item.rubber_height ?? FLIPPER_DEFAULTS.rubber_height;
  const rubberWidth = item.rubber_width ?? FLIPPER_DEFAULTS.rubber_width;

  const group = new THREE.Group();

  const baseMat = createMaterial(item.material, item.image);

  const bodyBaseRadius = baseRadius - rubberThickness;
  const bodyEndRadius = endRadius - rubberThickness;
  const bodyGeom = createFlipperGeometry(
    flipperBaseMesh as MeshData,
    bodyBaseRadius,
    bodyEndRadius,
    flipperRadius,
    height,
    0
  );
  const bodyMesh = new THREE.Mesh(bodyGeom, baseMat);
  group.add(bodyMesh);

  if (rubberThickness > 0) {
    const rubberMat = createMaterial(item.rubber_material, null);
    const rubberGeom = createFlipperGeometry(
      flipperBaseMesh as MeshData,
      baseRadius,
      endRadius,
      flipperRadius,
      rubberWidth,
      rubberHeight
    );
    const rubberMesh = new THREE.Mesh(rubberGeom, rubberMat);
    group.add(rubberMesh);
  }

  group.rotation.z = startAngle;
  group.position.set(center.x, center.y, 0);
  return group;
}

function setFlipperVertices(
  basex: number,
  basey: number,
  angle: number,
  flipperRadius: number,
  baseRadius: number,
  endRadius: number
): FlipperVertices {
  const fa = Math.asin((baseRadius - endRadius) / flipperRadius);
  const faceNormOffset = Math.PI / 2 - fa;

  const endx = basex + flipperRadius * Math.sin(angle);
  const endy = basey - flipperRadius * Math.cos(angle);

  const faceNormx1 = Math.sin(angle - faceNormOffset);
  const faceNormy1 = -Math.cos(angle - faceNormOffset);
  const faceNormx2 = Math.sin(angle + faceNormOffset);
  const faceNormy2 = -Math.cos(angle + faceNormOffset);

  return {
    endCenter: { x: endx, y: endy },
    rgv: [
      { x: basex + baseRadius * faceNormx1, y: basey + baseRadius * faceNormy1 },
      { x: endx + endRadius * faceNormx1, y: endy + endRadius * faceNormy1 },
      { x: endx + endRadius * faceNormx2, y: endy + endRadius * faceNormy2 },
      { x: basex + baseRadius * faceNormx2, y: basey + baseRadius * faceNormy2 },
    ],
  };
}

function arcFromPoints(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const startAngle = Math.atan2(y1 - cy, x1 - cx);
  const endAngle = Math.atan2(y2 - cy, x2 - cx);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, true);
  ctx.stroke();
}

function drawFlipperOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  verts: FlipperVertices,
  br: number,
  er: number
): void {
  const { endCenter, rgv } = verts;

  ctx.beginPath();
  ctx.moveTo(rgv[0].x, rgv[0].y);
  ctx.lineTo(rgv[1].x, rgv[1].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rgv[2].x, rgv[2].y);
  ctx.lineTo(rgv[3].x, rgv[3].y);
  ctx.stroke();

  arcFromPoints(ctx, cx, cy, br, rgv[0].x, rgv[0].y, rgv[3].x, rgv[3].y);
  arcFromPoints(ctx, endCenter.x, endCenter.y, er, rgv[2].x, rgv[2].y, rgv[1].x, rgv[1].y);
}

function drawFlipperShapeStroke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  verts: FlipperVertices,
  br: number,
  er: number
): void {
  const { endCenter, rgv } = verts;

  ctx.beginPath();
  ctx.moveTo(rgv[0].x, rgv[0].y);
  ctx.lineTo(rgv[1].x, rgv[1].y);
  ctx.lineTo(rgv[2].x, rgv[2].y);
  ctx.lineTo(rgv[3].x, rgv[3].y);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(endCenter.x, endCenter.y, er, 0, Math.PI * 2);
  ctx.stroke();
}

function getFlipperParams(item: FlipperItem, scale: number): FlipperParams {
  const startAngleVal = item.start_angle ?? FLIPPER_DEFAULTS.start_angle;
  const endAngleVal = item.end_angle ?? FLIPPER_DEFAULTS.end_angle;
  const angleRad = (startAngleVal * Math.PI) / 180;
  const angleRad2 = (endAngleVal * Math.PI) / 180;

  const baseRadius = item.base_radius ?? FLIPPER_DEFAULTS.base_radius;
  const endRadius = item.end_radius ?? FLIPPER_DEFAULTS.end_radius;
  const flipperRadius = item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipper_radius_max;
  const rubberThickness = item.rubber_thickness ?? FLIPPER_DEFAULTS.rubber_thickness;

  const br = baseRadius * scale;
  const er = endRadius * scale;
  const len = flipperRadius * scale;
  const rubThick = rubberThickness * scale;

  return { angleRad, angleRad2, br, er, len, rubThick, startAngleVal, endAngleVal };
}

export function uiRenderPass1(item: FlipperItem, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const { center } = item;
  if (!center) return;

  if (!state.viewSolid) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const { angleRad, br, er, len, rubThick } = getFlipperParams(item, state.zoom);

  const verts = setFlipperVertices(cx, cy, angleRad, len, br, er);
  const { endCenter, rgv } = verts;

  const fillColor = state.editorColors?.elementFill || '#b1cfb3';

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(endCenter.x, endCenter.y, er, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(rgv[0].x, rgv[0].y);
  ctx.lineTo(rgv[1].x, rgv[1].y);
  ctx.lineTo(rgv[2].x, rgv[2].y);
  ctx.lineTo(rgv[3].x, rgv[3].y);
  ctx.closePath();
  ctx.fill();

  const rubBr = br - rubThick;
  const rubEr = er - rubThick;

  if (rubBr > 0 && rubEr > 0) {
    const rubVerts = setFlipperVertices(cx, cy, angleRad, len, rubBr, rubEr);

    ctx.beginPath();
    ctx.arc(cx, cy, rubBr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rubVerts.endCenter.x, rubVerts.endCenter.y, rubEr, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(rubVerts.rgv[0].x, rubVerts.rgv[0].y);
    ctx.lineTo(rubVerts.rgv[1].x, rubVerts.rgv[1].y);
    ctx.lineTo(rubVerts.rgv[2].x, rubVerts.rgv[2].y);
    ctx.lineTo(rubVerts.rgv[3].x, rubVerts.rgv[3].y);
    ctx.closePath();
    ctx.fill();
  }
}

export function uiRenderPass2(item: FlipperItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const { center } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const { angleRad, angleRad2, br, er, len, rubThick, endAngleVal, startAngleVal } = getFlipperParams(item, state.zoom);

  const verts = setFlipperVertices(cx, cy, angleRad, len, br, er);

  const rubBr = br - rubThick;
  const rubEr = er - rubThick;

  if (rubBr > 0 && rubEr > 0) {
    const rubVerts = setFlipperVertices(cx, cy, angleRad, len, rubBr, rubEr);
    ctx.strokeStyle = getStrokeStyle(item, isSelected);
    ctx.lineWidth = getLineWidth(isSelected);
    drawFlipperShapeStroke(ctx, cx, cy, rubVerts, rubBr, rubEr);
  }

  ctx.strokeStyle = getStrokeStyle(item, isSelected);
  ctx.lineWidth = getLineWidth(isSelected);
  drawFlipperShapeStroke(ctx, cx, cy, verts, br, er);

  ctx.strokeStyle = RENDER_COLOR_GRAY;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  const verts2 = setFlipperVertices(cx, cy, angleRad2, len, br, er);
  drawFlipperShapeStroke(ctx, cx, cy, verts2, br, er);

  const sweepRadius = len + er;
  const tip1x = cx + Math.sin(angleRad) * sweepRadius;
  const tip1y = cy - Math.cos(angleRad) * sweepRadius;
  const tip2x = cx + Math.sin(angleRad2) * sweepRadius;
  const tip2y = cy - Math.cos(angleRad2) * sweepRadius;

  if (endAngleVal < startAngleVal) {
    arcFromPoints(ctx, cx, cy, sweepRadius, tip1x, tip1y, tip2x, tip2y);
  } else {
    arcFromPoints(ctx, cx, cy, sweepRadius, tip2x, tip2y, tip1x, tip1y);
  }

  ctx.setLineDash([]);
}

export function renderBlueprint(
  ctx: CanvasRenderingContext2D,
  item: FlipperItem,
  scale: number,
  _solid: boolean
): void {
  const { center } = item;
  if (!center) return;

  const cx = center.x * scale;
  const cy = center.y * scale;
  const { angleRad, angleRad2, br, er, len, rubThick, endAngleVal, startAngleVal } = getFlipperParams(item, scale);

  const verts = setFlipperVertices(cx, cy, angleRad, len, br, er);

  ctx.strokeStyle = RENDER_COLOR_BLACK;
  ctx.lineWidth = 1;
  drawFlipperOutline(ctx, cx, cy, verts, br, er);

  const rubBr = br - rubThick;
  const rubEr = er - rubThick;

  if (rubBr > 0 && rubEr > 0) {
    const rubVerts = setFlipperVertices(cx, cy, angleRad, len, rubBr, rubEr);
    drawFlipperOutline(ctx, cx, cy, rubVerts, rubBr, rubEr);
  }

  ctx.strokeStyle = RENDER_COLOR_GRAY;
  ctx.setLineDash([4, 4]);

  const verts2 = setFlipperVertices(cx, cy, angleRad2, len, br, er);
  drawFlipperOutline(ctx, cx, cy, verts2, br, er);

  const sweepRadius = len + er;
  const tip1x = cx + Math.sin(angleRad) * sweepRadius;
  const tip1y = cy - Math.cos(angleRad) * sweepRadius;
  const tip2x = cx + Math.sin(angleRad2) * sweepRadius;
  const tip2y = cy - Math.cos(angleRad2) * sweepRadius;

  if (endAngleVal < startAngleVal) {
    arcFromPoints(ctx, cx, cy, sweepRadius, tip1x, tip1y, tip2x, tip2y);
  } else {
    arcFromPoints(ctx, cx, cy, sweepRadius, tip2x, tip2y, tip1x, tip1y);
  }

  ctx.setLineDash([]);
}

export function render(item: FlipperItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestFlipper(
  item: FlipperItem,
  worldX: number,
  worldY: number,
  center: Point,
  distFromCenter: number
): boolean {
  const baseRadius = item.base_radius ?? FLIPPER_DEFAULTS.base_radius;
  const endRadius = item.end_radius ?? FLIPPER_DEFAULTS.end_radius;
  const flipperRadius = item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipper_radius_max;
  const angle = ((item.start_angle ?? FLIPPER_DEFAULTS.start_angle) * Math.PI) / 180;

  if (distFromCenter < baseRadius) return true;

  const endX = center.x + Math.sin(angle) * flipperRadius;
  const endY = center.y - Math.cos(angle) * flipperRadius;

  const distFromEnd = Math.sqrt((worldX - endX) ** 2 + (worldY - endY) ** 2);
  if (distFromEnd < endRadius) return true;

  if (distToSegment(worldX, worldY, center.x, center.y, endX, endY) < baseRadius) return true;

  return false;
}

export function flipperProperties(item: FlipperItem): string {
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
          <label class="prop-label">Rubber Material</label>
          <select class="prop-select" data-prop="rubber_material">${materialOptions(item.rubber_material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Thickness</label>
          <input type="number" class="prop-input" data-prop="rubber_thickness" value="${(item.rubber_thickness ?? FLIPPER_DEFAULTS.rubber_thickness).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Offset Height</label>
          <input type="number" class="prop-input" data-prop="rubber_height" value="${(item.rubber_height ?? FLIPPER_DEFAULTS.rubber_height).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Width</label>
          <input type="number" class="prop-input" data-prop="rubber_width" value="${(item.rubber_width ?? FLIPPER_DEFAULTS.rubber_width).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_enabled" ${item.is_enabled !== false ? 'checked' : ''}>
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
          <input type="number" class="prop-input" data-prop="center.x" value="${(item.center?.x ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" value="${(item.center?.y ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Base Radius</label>
          <input type="number" class="prop-input" data-prop="base_radius" value="${(item.base_radius ?? FLIPPER_DEFAULTS.base_radius).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">End Radius</label>
          <input type="number" class="prop-input" data-prop="end_radius" value="${(item.end_radius ?? FLIPPER_DEFAULTS.end_radius).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Length</label>
          <input type="number" class="prop-input" data-prop="flipper_radius_max" value="${(item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipper_radius_max).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Start Angle</label>
          <input type="number" class="prop-input" data-prop="start_angle" value="${(item.start_angle ?? FLIPPER_DEFAULTS.start_angle).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">End Angle</label>
          <input type="number" class="prop-input" data-prop="end_angle" value="${(item.end_angle ?? FLIPPER_DEFAULTS.end_angle).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${(item.height ?? FLIPPER_DEFAULTS.height).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Max.Difficulty Length</label>
          <input type="number" class="prop-input" data-prop="flipper_radius_min" value="${(item.flipper_radius_min ?? FLIPPER_DEFAULTS.flipper_radius_min).toFixed(2)}" step="1">
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
          <label class="prop-label">Mass</label>
          <input type="number" class="prop-input" data-prop="mass" value="${(item.mass ?? FLIPPER_DEFAULTS.mass).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Strength</label>
          <input type="number" class="prop-input" data-prop="strength" value="${(item.strength ?? FLIPPER_DEFAULTS.strength).toFixed(1)}" step="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? FLIPPER_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? FLIPPER_DEFAULTS.elasticity_falloff).toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? FLIPPER_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Return Strength Ratio</label>
          <input type="number" class="prop-input" data-prop="return_" value="${(item.return_ ?? FLIPPER_DEFAULTS.return).toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Coil Ramp Up</label>
          <input type="number" class="prop-input" data-prop="ramp_up" value="${(item.ramp_up ?? FLIPPER_DEFAULTS.ramp_up).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? FLIPPER_DEFAULTS.scatter).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">EOS Torque</label>
          <input type="number" class="prop-input" data-prop="torque_damping" value="${(item.torque_damping ?? FLIPPER_DEFAULTS.torque_damping).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">EOS Torque Angle</label>
          <input type="number" class="prop-input" data-prop="torque_damping_angle" value="${(item.torque_damping_angle ?? FLIPPER_DEFAULTS.torque_damping_angle).toFixed(1)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Overwrite Physics</label>
          <input type="number" class="prop-input" data-prop="override_physics" value="${item.override_physics ?? 0}" step="1" min="0">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? FLIPPER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: FlipperItem): Point | null {
  return item.center ? { x: item.center.x, y: item.center.y } : null;
}

function putCenter(item: FlipperItem, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const flipperRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestFlipper,
  create3DMesh: createFlipper3DMesh,
  getProperties: flipperProperties,
  getCenter,
  putCenter,
};

registerEditable('Flipper', flipperRenderer);
