import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { TIMER_DEFAULTS } from '../../shared/object-defaults.js';
import { registerEditable, IEditable, Point } from './registry.js';
import type { Timer } from '../../types/game-objects.js';

export function uiRenderPass1(_item: Timer, _isSelected: boolean): void {}

export function uiRenderPass2(item: Timer, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);

  ctx.strokeStyle = getStrokeStyle(item, isSelected);
  ctx.lineWidth = getLineWidth(isSelected);

  ctx.beginPath();
  ctx.arc(cx, cy, 18 * state.zoom, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 15 * state.zoom, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const angle = ((Math.PI * 2) / 12) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    ctx.beginPath();
    ctx.moveTo(cx + sn * 9 * state.zoom, cy - cs * 9 * state.zoom);
    ctx.lineTo(cx + sn * 15 * state.zoom, cy - cs * 15 * state.zoom);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 10.5 * state.zoom, cy - 7.5 * state.zoom);
  ctx.stroke();
}

export function renderBlueprint(_ctx: CanvasRenderingContext2D, _item: Timer, _scale: number, _solid: boolean): void {}

export function render(item: Timer, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function timerProperties(item: Timer): string {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="timer">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_timer_enabled" ${item.is_timer_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${item.timer_interval ?? TIMER_DEFAULTS.interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: Timer): Point | null {
  const center = item.center || (item as { vCenter?: Point }).vCenter;
  return center ? { x: center.x, y: center.y } : null;
}

function putCenter(item: Timer, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const timerRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  getProperties: timerProperties,
  getCenter,
  putCenter,
};

registerEditable('Timer', timerRenderer);
