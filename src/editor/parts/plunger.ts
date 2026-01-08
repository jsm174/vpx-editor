import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth, convertToUnit, getUnitSuffixHtml } from '../utils.js';
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? PLUNGER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
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
  getProperties: plungerProperties,
  getCenter,
  putCenter,
};

registerEditable('Plunger', plungerRenderer);
