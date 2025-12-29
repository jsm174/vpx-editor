import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { imageOptions } from '../../shared/options-generators.js';
import { BALL_DEFAULTS } from '../../shared/object-defaults.js';

export function renderBall(item, isSelected) {
  const pos = item.pos || { x: 0, y: 0 };
  const { x: cx, y: cy } = toScreen(pos.x, pos.y);
  const radius = (item.radius ?? BALL_DEFAULTS.radius) * state.zoom;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  elements.ctx.stroke();
}

export function ballProperties(item) {
  const pos = item.pos || { x: 0, y: 0, z: BALL_DEFAULTS.radius };
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Forced</label>
          <input type="checkbox" class="prop-input" data-prop="force_reflection" ${item.force_reflection ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Rendering</div>
        <div class="prop-row">
          <label class="prop-label">Use Table Settings</label>
          <input type="checkbox" class="prop-input" data-prop="use_table_settings" ${item.use_table_settings ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Ball Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Spherical Map</label>
          <input type="checkbox" class="prop-input" data-prop="spherical_mapping" ${item.spherical_mapping !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Decal</label>
          <select class="prop-select" data-prop="image_decal">${imageOptions(item.image_decal)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Logo Mode</label>
          <input type="checkbox" class="prop-input" data-prop="decal_mode" ${item.decal_mode ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Tint</label>
          <input type="color" class="prop-input" data-prop="color" value="${item.color || '#ffffff'}">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Reflections</div>
        <div class="prop-row">
          <label class="prop-label">Playfield Strength</label>
          <input type="number" class="prop-input" data-prop="playfield_reflection_strength" value="${(item.playfield_reflection_strength ?? BALL_DEFAULTS.playfield_reflection_strength).toFixed(2)}" step="0.1" min="0">
        </div>
        <div class="prop-row">
          <label class="prop-label">Bulb Strength</label>
          <input type="number" class="prop-input" data-prop="bulb_intensity_scale" value="${(item.bulb_intensity_scale ?? BALL_DEFAULTS.bulb_intensity_scale).toFixed(2)}" step="0.1" min="0">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="pos.x" value="${pos.x.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="pos.y" value="${pos.y.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z</label>
          <input type="number" class="prop-input" data-prop="pos.z" value="${(pos.z ?? BALL_DEFAULTS.radius).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Radius</label>
          <input type="number" class="prop-input" data-prop="radius" value="${(item.radius ?? BALL_DEFAULTS.radius).toFixed(2)}" step="1" min="1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Mass</label>
          <input type="number" class="prop-input" data-prop="mass" value="${(item.mass ?? BALL_DEFAULTS.mass).toFixed(3)}" step="0.1" min="0.001">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? BALL_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
