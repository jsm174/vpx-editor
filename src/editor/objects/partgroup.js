import { state, elements } from '../state.js';
import { toScreen, getLineWidth, getSelectColor } from '../utils.js';
import { RENDER_COLOR_GRAY } from '../../shared/constants.js';

const PARTGROUP_DEFAULT_TIMER_INTERVAL = 100;
const PARTGROUP_DEFAULT_PLAYER_MODE_VISIBILITY_MASK = 0xffff;

export function uiRenderPass1(item, isSelected) {}

export function uiRenderPass2(item, isSelected) {
  const center = item.center;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const ctx = elements.ctx;
  const size = 15;

  ctx.strokeStyle = isSelected ? getSelectColor() : RENDER_COLOR_GRAY;
  ctx.lineWidth = getLineWidth(isSelected);

  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx, cy + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
  ctx.stroke();
}

export function renderBlueprint(ctx, item, scale, solid) {}

export function render(item, isSelected) {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function renderPartGroup(item, isSelected) {
  render(item, isSelected);
}

export function partGroupProperties(item) {
  const spaceRefOptions = [
    { value: 'cabinet', label: 'Cabinet' },
    { value: 'cabinet_feet', label: 'Cabinet Feet' },
    { value: 'inherit', label: 'Inherit' },
    { value: 'playfield', label: 'Playfield' },
    { value: 'room', label: 'Room' },
  ];

  const spaceRefHtml = spaceRefOptions
    .map(
      opt =>
        `<option value="${opt.value}"${item.space_reference === opt.value ? ' selected' : ''}>${opt.label}</option>`
    )
    .join('');

  const pmvMask = item.player_mode_visibility_mask ?? PARTGROUP_DEFAULT_PLAYER_MODE_VISIBILITY_MASK;

  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-group-title">Play Mode Visibility Mask</div>
        <div class="prop-row">
          <label class="prop-label">Desktop</label>
          <input type="checkbox" class="prop-input" data-prop="player_mode_visibility_mask" data-mask="1" ${pmvMask & 0x0001 ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Full Single Screen</label>
          <input type="checkbox" class="prop-input" data-prop="player_mode_visibility_mask" data-mask="2" ${pmvMask & 0x0002 ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Cabinet</label>
          <input type="checkbox" class="prop-input" data-prop="player_mode_visibility_mask" data-mask="4" ${pmvMask & 0x0004 ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Mixed Reality</label>
          <input type="checkbox" class="prop-input" data-prop="player_mode_visibility_mask" data-mask="8" ${pmvMask & 0x0008 ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Virtual Reality</label>
          <input type="checkbox" class="prop-input" data-prop="player_mode_visibility_mask" data-mask="16" ${pmvMask & 0x0010 ? 'checked' : ''}>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Space Reference</div>
        <div class="prop-row">
          <label class="prop-label">Reference</label>
          <select class="prop-select" data-prop="space_reference">${spaceRefHtml}</select>
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
          <label class="prop-label">Timer Interval</label>
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? PARTGROUP_DEFAULT_TIMER_INTERVAL}" step="1">
        </div>
      </div>
    </div>
  `;
}
