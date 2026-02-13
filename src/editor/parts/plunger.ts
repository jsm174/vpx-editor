import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth, convertToUnit, getUnitSuffixHtml } from '../utils.js';
import { createMaterial, getSurfaceHeight } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { PLUNGER_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_GRAY, RENDER_COLOR_BLACK } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';

interface PlungerItem {
  center?: Point;
  width?: number;
  stroke?: number;
  height?: number;
  park_position?: number;
  plunger_type?: string;
  material?: string;
  image?: string;
  anim_frames?: number;
  z_adjust?: number;
  is_reflection_enabled?: boolean;
  rod_diam?: number;
  tip_shape?: string;
  ring_gap?: number;
  ring_diam?: number;
  ring_width?: number;
  spring_diam?: number;
  spring_gauge?: number;
  spring_loops?: number;
  spring_end_loops?: number;
  surface?: string;
  speed_pull?: number;
  speed_fire?: number;
  scatter_velocity?: number;
  is_mech_plunger?: boolean;
  auto_plunger?: boolean;
  is_visible?: boolean;
  mech_strength?: number;
  momentum_xfer?: number;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  is_locked?: boolean;
}

interface PlungerGeometry {
  w: number;
  s: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function getPlungerGeometry(item: PlungerItem, cx: number, cy: number, scale: number): PlungerGeometry {
  const w = (item.width ?? PLUNGER_DEFAULTS.width) * scale;
  const s = (item.stroke ?? PLUNGER_DEFAULTS.stroke) * scale;
  const h = (item.height ?? PLUNGER_DEFAULTS.height) * scale;
  const left = cx - w;
  const right = cx + w;
  const top = cy - s;
  const bottom = cy + h;
  return { w, s, h, left, right, top, bottom };
}

function drawPlunger(
  ctx: CanvasRenderingContext2D,
  item: PlungerItem,
  cx: number,
  cy: number,
  scale: number,
  strokeStyle: string,
  lineWidth: number,
  parkLineColor: string
): void {
  const { s, left, right, top, bottom } = getPlungerGeometry(item, cx, cy, scale);

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(left, top, right - left, bottom - top);

  const parkPosition = item.park_position ?? PLUNGER_DEFAULTS.park_position;
  if (parkPosition > 0 && parkPosition < 1) {
    const parkY = cy - s + parkPosition * s;
    ctx.strokeStyle = parkLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, parkY);
    ctx.lineTo(right, parkY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function uiRenderPass1(_item: PlungerItem, _isSelected: boolean): void {}

export function uiRenderPass2(item: PlungerItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const { center } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  drawPlunger(
    elements.ctx,
    item,
    cx,
    cy,
    state.zoom,
    getStrokeStyle(item, isSelected),
    getLineWidth(isSelected),
    RENDER_COLOR_GRAY
  );
}

export function renderBlueprint(
  ctx: CanvasRenderingContext2D,
  item: PlungerItem,
  scale: number,
  _solid: boolean
): void {
  const { center } = item;
  if (!center) return;

  drawPlunger(ctx, item, center.x * scale, center.y * scale, scale, RENDER_COLOR_BLACK, 1, RENDER_COLOR_BLACK);
}

export function render(item: PlungerItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function plungerProperties(item: PlungerItem): string {
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
          <select class="prop-select" data-prop="plunger_type">
            <option value="modern"${(item.plunger_type || 'modern') === 'modern' ? ' selected' : ''}>Modern</option>
            <option value="flat"${item.plunger_type === 'flat' ? ' selected' : ''}>Flat</option>
            <option value="custom"${item.plunger_type === 'custom' ? ' selected' : ''}>Custom</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Flat Frames</label>
          <input type="number" class="prop-input" data-prop="anim_frames" value="${item.anim_frames ?? PLUNGER_DEFAULTS.anim_frames}" step="1" min="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Width</label>
          <input type="number" class="prop-input" data-prop="width" data-convert-units value="${convertToUnit(item.width ?? PLUNGER_DEFAULTS.width).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Z Adjustment</label>
          <input type="number" class="prop-input" data-prop="z_adjust" value="${(item.z_adjust ?? PLUNGER_DEFAULTS.z_adjust).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Custom Settings</div>
        <div class="prop-row">
          <label class="prop-label">Rod Diameter</label>
          <input type="number" class="prop-input" data-prop="rod_diam" data-convert-units value="${convertToUnit(item.rod_diam ?? PLUNGER_DEFAULTS.rod_diam).toFixed(2)}" step="${convertToUnit(0.1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Tip Shape</label>
          <input type="text" class="prop-input" data-prop="tip_shape" value="${item.tip_shape || ''}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Ring Gap</label>
          <input type="number" class="prop-input" data-prop="ring_gap" data-convert-units value="${convertToUnit(item.ring_gap ?? PLUNGER_DEFAULTS.ring_gap).toFixed(2)}" step="${convertToUnit(0.5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Ring Diam</label>
          <input type="number" class="prop-input" data-prop="ring_diam" data-convert-units value="${convertToUnit(item.ring_diam ?? PLUNGER_DEFAULTS.ring_diam).toFixed(2)}" step="${convertToUnit(0.1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Ring Width</label>
          <input type="number" class="prop-input" data-prop="ring_width" data-convert-units value="${convertToUnit(item.ring_width ?? PLUNGER_DEFAULTS.ring_width).toFixed(2)}" step="${convertToUnit(0.1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Spring Diam</label>
          <input type="number" class="prop-input" data-prop="spring_diam" data-convert-units value="${convertToUnit(item.spring_diam ?? PLUNGER_DEFAULTS.spring_diam).toFixed(2)}" step="${convertToUnit(0.1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Spring Gauge</label>
          <input type="number" class="prop-input" data-prop="spring_gauge" data-convert-units value="${convertToUnit(item.spring_gauge ?? PLUNGER_DEFAULTS.spring_gauge).toFixed(2)}" step="${convertToUnit(0.1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Spring Loops</label>
          <input type="number" class="prop-input" data-prop="spring_loops" data-convert-units value="${convertToUnit(item.spring_loops ?? PLUNGER_DEFAULTS.spring_loops).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">End Loops</label>
          <input type="number" class="prop-input" data-prop="spring_end_loops" data-convert-units value="${convertToUnit(item.spring_end_loops ?? PLUNGER_DEFAULTS.spring_end_loops).toFixed(2)}" step="${convertToUnit(0.5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" data-convert-units value="${convertToUnit(item.center?.x ?? 0).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" data-convert-units value="${convertToUnit(item.center?.y ?? 0).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
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
          <label class="prop-label">Pull Speed</label>
          <input type="number" class="prop-input" data-prop="speed_pull" value="${(item.speed_pull ?? PLUNGER_DEFAULTS.speed_pull).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Release Speed</label>
          <input type="number" class="prop-input" data-prop="speed_fire" value="${(item.speed_fire ?? PLUNGER_DEFAULTS.speed_fire).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Stroke Length</label>
          <input type="number" class="prop-input" data-prop="stroke" data-convert-units value="${convertToUnit(item.stroke ?? PLUNGER_DEFAULTS.stroke).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Velocity</label>
          <input type="number" class="prop-input" data-prop="scatter_velocity" value="${(item.scatter_velocity ?? PLUNGER_DEFAULTS.scatter_velocity).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Enable Mechanical Plunger</label>
          <input type="checkbox" class="prop-input" data-prop="is_mech_plunger" ${item.is_mech_plunger ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Auto Plunger</label>
          <input type="checkbox" class="prop-input" data-prop="auto_plunger" ${item.auto_plunger ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Mech Strength</label>
          <input type="number" class="prop-input" data-prop="mech_strength" value="${(item.mech_strength ?? PLUNGER_DEFAULTS.mech_strength).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Momentum Xfer</label>
          <input type="number" class="prop-input" data-prop="momentum_xfer" value="${(item.momentum_xfer ?? PLUNGER_DEFAULTS.momentum_xfer).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Park Position (0..1)</label>
          <input type="number" class="prop-input" data-prop="park_position" value="${(item.park_position ?? PLUNGER_DEFAULTS.park_position).toFixed(4)}" step="0.01" min="0" max="1">
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
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${item.timer_interval ?? PLUNGER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

interface PlungerCoord {
  r: number;
  y: number;
  tv: number;
  nx: number;
  ny: number;
}

const MODERN_COORDS: PlungerCoord[] = [
  { r: 0.2, y: 0.0, tv: 0.0, nx: 1.0, ny: 0.0 },
  { r: 0.3, y: 3.0, tv: 0.11, nx: 1.0, ny: 0.0 },
  { r: 0.35, y: 5.0, tv: 0.14, nx: 1.0, ny: 0.0 },
  { r: 0.35, y: 23.0, tv: 0.19, nx: 1.0, ny: 0.0 },
  { r: 0.45, y: 23.0, tv: 0.21, nx: 0.8, ny: 0.0 },
  { r: 0.25, y: 24.0, tv: 0.25, nx: 0.3, ny: 0.0 },
  { r: 0.25, y: 100.0, tv: 1.0, nx: 0.3, ny: 0.0 },
];

const CIRCLE_POINTS = 24;
const SPRING_MIN_SPACING = 2.2;

function buildCustomCoords(
  item: PlungerItem,
  width: number
): {
  coords: PlungerCoord[];
  rody: number;
  springRadius: number;
  springGauge: number;
  springLoops: number;
  springEndLoops: number;
} {
  const tipShape = item.tip_shape || '0 .34; 2 .6; 3 .64; 5 .7; 7 .84; 8 .88; 9 .9; 11 .92; 14 .92; 39 .84';
  const rodDiam = item.rod_diam ?? PLUNGER_DEFAULTS.rod_diam;
  const ringGap = item.ring_gap ?? PLUNGER_DEFAULTS.ring_gap;
  const ringDiam = item.ring_diam ?? PLUNGER_DEFAULTS.ring_diam;
  const ringWidth = item.ring_width ?? PLUNGER_DEFAULTS.ring_width;
  const springDiam = item.spring_diam ?? PLUNGER_DEFAULTS.spring_diam;
  const springGauge = item.spring_gauge ?? PLUNGER_DEFAULTS.spring_gauge;
  const springLoops = item.spring_loops ?? PLUNGER_DEFAULTS.spring_loops;
  const springEndLoops = item.spring_end_loops ?? PLUNGER_DEFAULTS.spring_end_loops;

  const tipEntries: { y: number; r: number }[] = [];
  const parts = tipShape.split(';');
  let tiplen = 0;
  for (const part of parts) {
    const tokens = part.trim().split(/[\s,]+/);
    if (tokens.length < 2) continue;
    let y = parseFloat(tokens[0]) || 0;
    const diam = parseFloat(tokens[1]) || 0;
    const r = diam * 0.5;
    if (y < tiplen) y = tiplen;
    tiplen = y;
    tipEntries.push({ y, r });
  }
  if (tipEntries.length === 0) {
    tipEntries.push({ y: 0, r: 0 });
  }

  const coords: PlungerCoord[] = [];

  const c0 = { r: 0, y: 0 };
  for (let i = 0; i < tipEntries.length; i++) {
    const prv = i > 0 ? tipEntries[i - 1] : c0;
    const cur = tipEntries[i];
    const nxt = i + 1 < tipEntries.length ? tipEntries[i + 1] : cur;

    const tv = tiplen > 0 ? (0.24 * cur.y) / tiplen : 0;

    const x0 = prv.r,
      y0 = prv.y;
    const x1 = nxt.r,
      y1 = nxt.y;
    const yd = y1 - y0;
    const xd = (x1 - x0) * width;
    const rl = Math.sqrt(xd * xd + yd * yd);
    const nx = rl > 0 ? yd / rl : 1.0;
    const ny = rl > 0 ? -xd / rl : 0.0;

    coords.push({ r: cur.r, y: cur.y, tv, nx, ny });
  }

  const rRod = rodDiam / 2.0;
  let y = tiplen;

  coords.push({ r: rRod, y, tv: 0.24, nx: 1.0, ny: 0.0 });

  coords.push({ r: rRod, y, tv: 0.51, nx: 1.0, ny: 0.0 });
  y += ringGap;
  coords.push({ r: rRod, y, tv: 0.55, nx: 1.0, ny: 0.0 });

  const rRing = ringDiam / 2.0;
  coords.push({ r: rRod, y, tv: 0.26, nx: 0.0, ny: -1.0 });
  coords.push({ r: rRing, y, tv: 0.33, nx: 0.0, ny: -1.0 });
  coords.push({ r: rRing, y, tv: 0.33, nx: 1.0, ny: 0.0 });
  y += ringWidth;
  coords.push({ r: rRing, y, tv: 0.42, nx: 1.0, ny: 0.0 });
  coords.push({ r: rRing, y, tv: 0.42, nx: 0.0, ny: 1.0 });
  coords.push({ r: rRod, y, tv: 0.49, nx: 0.0, ny: 1.0 });

  coords.push({ r: rRod, y, tv: 0.51, nx: 1.0, ny: 0.0 });

  const springMin = (springLoops + springEndLoops) * SPRING_MIN_SPACING;
  const rody = y + springMin;
  coords.push({ r: rRod, y: rody, tv: 0.74, nx: 1.0, ny: 0.0 });

  return { coords, rody, springRadius: springDiam * 0.5, springGauge, springLoops, springEndLoops };
}

export function createPlunger3DMesh(item: PlungerItem): THREE.Group | null {
  const center = item.center;
  if (!center) return null;
  if (item.is_visible === false) return null;

  const width = item.width ?? PLUNGER_DEFAULTS.width;
  const stroke = item.stroke ?? PLUNGER_DEFAULTS.stroke;
  const height = item.height ?? PLUNGER_DEFAULTS.height;
  const zAdjust = item.z_adjust ?? PLUNGER_DEFAULTS.z_adjust;
  const parkPosition = item.park_position ?? PLUNGER_DEFAULTS.park_position;
  const plungerType = (item.plunger_type || 'modern').toLowerCase();

  const zheight = zAdjust;

  const ytip = -stroke * (1 - parkPosition);
  const ratio = 1.0 - parkPosition;

  const group = new THREE.Group();

  if (plungerType === 'flat') {
    const xLt = -width;
    const xRt = width;
    const yTop = ytip;
    const yBot = height;
    const z = zheight + width * 1.25;

    const positions = new Float32Array([xLt, yBot, z, xLt, yTop, z, xRt, yTop, z, xRt, yBot, z]);
    const normals = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
    const uvs = new Float32Array([0, 1, 0, 0, 1, 0, 1, 1]);
    const indices = [0, 1, 2, 2, 3, 0];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const mat = createMaterial(item.material, item.image);
    group.add(new THREE.Mesh(geometry, mat));
  } else {
    let latheCoords: PlungerCoord[];
    let rody: number;
    let springRadius = 0,
      springGauge = 0,
      springLoops = 0,
      springEndLoops = 0;

    if (plungerType === 'custom') {
      const custom = buildCustomCoords(item, width);
      latheCoords = custom.coords;
      rody = custom.rody;
      springRadius = custom.springRadius;
      springGauge = custom.springGauge;
      springLoops = custom.springLoops;
      springEndLoops = custom.springEndLoops;
    } else {
      latheCoords = MODERN_COORDS;
      rody = height;
    }

    const lathePoints = latheCoords.length;
    const latheVts = lathePoints * CIRCLE_POINTS;

    const springN = plungerType === 'custom' ? Math.floor((springLoops + springEndLoops) * CIRCLE_POINTS) : 0;
    const springVts = springN * 3;
    const totalVts = latheVts + springVts;

    const positions = new Float32Array(totalVts * 3);
    const normals = new Float32Array(totalVts * 3);
    const uvs = new Float32Array(totalVts * 2);

    let tu = 0.51;
    const stepU = 1.0 / CIRCLE_POINTS;
    for (let l = 0, offset = 0; l < CIRCLE_POINTS; l++, offset += lathePoints, tu += stepU) {
      if (tu > 1.0) tu -= 1.0;
      const angle = ((Math.PI * 2.0) / CIRCLE_POINTS) * l;
      const sn = Math.sin(angle);
      const cs = Math.cos(angle);

      let pmm1tv = 0;
      for (let m = 0; m < lathePoints; m++) {
        const c = latheCoords[m];
        const idx = offset + m;

        let y = c.y + ytip;
        let tv = c.tv;

        if (m + 1 === lathePoints) {
          y = rody;
          tv = pmm1tv + (tv - pmm1tv) * ratio;
        }

        positions[idx * 3] = c.r * (sn * width);
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = c.r * (cs * width) + width + zheight;

        normals[idx * 3] = c.nx * sn;
        normals[idx * 3 + 1] = c.ny;
        normals[idx * 3 + 2] = -c.nx * cs;

        uvs[idx * 2] = tu;
        uvs[idx * 2 + 1] = pmm1tv = tv;
      }
    }

    if (plungerType === 'custom' && springN > 0) {
      const springGaugeRel = springGauge / width;

      const shaftTopCoord = latheCoords[lathePoints - 2];
      const y0 = shaftTopCoord.y + ytip;
      const y1 = rody;

      const nEnd = Math.floor(springEndLoops * CIRCLE_POINTS);
      const nMain = springN - nEnd;
      const yEnd = springEndLoops * springGauge * SPRING_MIN_SPACING;
      const dyMain = nMain > 1 ? (y1 - y0 - yEnd) / (nMain - 1) : 0;
      const dyEnd = nEnd > 1 ? yEnd / (nEnd - 1) : 0;
      let dy = dyEnd;

      const dtheta = (Math.PI * 2.0) / (CIRCLE_POINTS - 1) + Math.PI / (springN - 1);
      let theta = Math.PI;
      let springY = y0;
      let pmIdx = latheVts;

      for (let i = springN; i > 0; i--, theta += dtheta, springY += dy) {
        if (i === nMain) dy = dyMain;
        if (theta >= Math.PI * 2.0) theta -= Math.PI * 2.0;
        const sn = Math.sin(theta);
        const cs = Math.cos(theta);

        positions[pmIdx * 3] = springRadius * (sn * width);
        positions[pmIdx * 3 + 1] = springY - springGauge;
        positions[pmIdx * 3 + 2] = springRadius * (cs * width) + width + zheight;
        normals[pmIdx * 3] = 0.0;
        normals[pmIdx * 3 + 1] = -1.0;
        normals[pmIdx * 3 + 2] = 0.0;
        uvs[pmIdx * 2] = (sn + 1.0) * 0.5;
        uvs[pmIdx * 2 + 1] = 0.76;
        pmIdx++;

        positions[pmIdx * 3] = (springRadius + springGaugeRel / 1.5) * (sn * width);
        positions[pmIdx * 3 + 1] = springY;
        positions[pmIdx * 3 + 2] = (springRadius + springGaugeRel / 1.5) * (cs * width) + width + zheight;
        normals[pmIdx * 3] = sn;
        normals[pmIdx * 3 + 1] = 0.0;
        normals[pmIdx * 3 + 2] = -cs;
        uvs[pmIdx * 2] = (sn + 1.0) * 0.5;
        uvs[pmIdx * 2 + 1] = 0.85;
        pmIdx++;

        positions[pmIdx * 3] = springRadius * (sn * width);
        positions[pmIdx * 3 + 1] = springY + springGauge;
        positions[pmIdx * 3 + 2] = springRadius * (cs * width) + width + zheight;
        normals[pmIdx * 3] = 0.0;
        normals[pmIdx * 3 + 1] = 1.0;
        normals[pmIdx * 3 + 2] = 0.0;
        uvs[pmIdx * 2] = (sn + 1.0) * 0.5;
        uvs[pmIdx * 2 + 1] = 0.98;
        pmIdx++;
      }
    }

    const latheIndices = 6 * CIRCLE_POINTS * (lathePoints - 1);
    let springIndices = 0;
    if (plungerType === 'custom') {
      springIndices = 4 * springVts - 12;
      if (springIndices < 0) springIndices = 0;
    }
    const totalIndices = latheIndices + springIndices;
    const indices: number[] = new Array(totalIndices);
    let k = 0;

    for (let l = 0, offset = 0; l < CIRCLE_POINTS; l++, offset += lathePoints) {
      for (let m = 0; m < lathePoints - 1; m++) {
        indices[k++] = (m + offset) % latheVts;
        indices[k++] = (m + offset + lathePoints) % latheVts;
        indices[k++] = (m + offset + 1 + lathePoints) % latheVts;

        indices[k++] = (m + offset + 1 + lathePoints) % latheVts;
        indices[k++] = (m + offset + 1) % latheVts;
        indices[k++] = (m + offset) % latheVts;
      }
    }

    if (springIndices > 0) {
      for (let l = 0, sOffset = latheVts; l < springIndices; l += 12, sOffset += 3) {
        const topNz = normals[(sOffset + 1) * 3 + 2];
        if (topNz <= 0.0) {
          indices[k++] = sOffset + 0;
          indices[k++] = sOffset + 3;
          indices[k++] = sOffset + 1;
          indices[k++] = sOffset + 1;
          indices[k++] = sOffset + 3;
          indices[k++] = sOffset + 4;
          indices[k++] = sOffset + 4;
          indices[k++] = sOffset + 5;
          indices[k++] = sOffset + 2;
          indices[k++] = sOffset + 2;
          indices[k++] = sOffset + 1;
          indices[k++] = sOffset + 4;
        } else {
          indices[k++] = sOffset + 3;
          indices[k++] = sOffset + 0;
          indices[k++] = sOffset + 4;
          indices[k++] = sOffset + 4;
          indices[k++] = sOffset + 0;
          indices[k++] = sOffset + 1;
          indices[k++] = sOffset + 1;
          indices[k++] = sOffset + 2;
          indices[k++] = sOffset + 5;
          indices[k++] = sOffset + 5;
          indices[k++] = sOffset + 1;
          indices[k++] = sOffset + 2;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const mat = createMaterial(item.material, item.image);
    group.add(new THREE.Mesh(geometry, mat));
  }

  group.position.set(center.x, center.y, getSurfaceHeight(item.surface));
  return group;
}

function getCenter(item: PlungerItem): Point | null {
  return item.center ? { x: item.center.x, y: item.center.y } : null;
}

function putCenter(item: PlungerItem, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const plungerRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  create3DMesh: createPlunger3DMesh,
  getProperties: plungerProperties,
  getCenter,
  putCenter,
};

registerEditable('Plunger', plungerRenderer);
