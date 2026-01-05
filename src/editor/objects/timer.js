import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { TIMER_DEFAULTS } from '../../shared/object-defaults.js';

export function uiRenderPass1(item, isSelected) {}

export function uiRenderPass2(item, isSelected) {
  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, 18 * state.zoom, 0, Math.PI * 2);
  elements.ctx.stroke();

  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, 15 * state.zoom, 0, Math.PI * 2);
  elements.ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const angle = ((Math.PI * 2) / 12) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    elements.ctx.beginPath();
    elements.ctx.moveTo(cx + sn * 9 * state.zoom, cy - cs * 9 * state.zoom);
    elements.ctx.lineTo(cx + sn * 15 * state.zoom, cy - cs * 15 * state.zoom);
    elements.ctx.stroke();
  }

  elements.ctx.beginPath();
  elements.ctx.moveTo(cx, cy);
  elements.ctx.lineTo(cx + 10.5 * state.zoom, cy - 7.5 * state.zoom);
  elements.ctx.stroke();
}

export function renderBlueprint(ctx, item, scale, solid) {}

export function render(item, isSelected) {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function renderTimer(item, isSelected) {
  render(item, isSelected);
}

export function timerProperties(item) {
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? TIMER_DEFAULTS.interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
