import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { materialOptions, imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { PLUNGER_DEFAULTS } from '../../shared/object-defaults.js';

export function renderPlunger(item, isSelected) {
  const { center, width, stroke, height } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const w = (width ?? PLUNGER_DEFAULTS.width) * state.zoom;
  const s = (stroke ?? PLUNGER_DEFAULTS.stroke) * state.zoom;
  const h = (height ?? PLUNGER_DEFAULTS.height) * state.zoom;

  const left = cx - w;
  const right = cx + w;
  const top = cy - s;
  const bottom = cy + h;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);
  elements.ctx.strokeRect(left, top, right - left, bottom - top);

  const parkPosition = item.park_position ?? PLUNGER_DEFAULTS.parkPosition;
  if (parkPosition > 0 && parkPosition < 1) {
    const parkY = cy - s + parkPosition * s;
    elements.ctx.strokeStyle = '#808080';
    elements.ctx.lineWidth = 1;
    elements.ctx.setLineDash([4, 4]);
    elements.ctx.beginPath();
    elements.ctx.moveTo(left, parkY);
    elements.ctx.lineTo(right, parkY);
    elements.ctx.stroke();
    elements.ctx.setLineDash([]);
  }
}

export function plungerProperties(item) {
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
          <input type="number" class="prop-input" data-prop="anim_frames" value="${item.anim_frames ?? PLUNGER_DEFAULTS.animFrames}" step="1" min="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Width</label>
          <input type="number" class="prop-input" data-prop="width" value="${(item.width ?? PLUNGER_DEFAULTS.width).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z Adjustment</label>
          <input type="number" class="prop-input" data-prop="z_adjust" value="${(item.z_adjust ?? PLUNGER_DEFAULTS.zAdjust).toFixed(1)}" step="1">
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
          <input type="number" class="prop-input" data-prop="rod_diam" value="${(item.rod_diam ?? PLUNGER_DEFAULTS.rodDiam).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Tip Shape</label>
          <input type="text" class="prop-input" data-prop="tip_shape" value="${item.tip_shape || ''}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Ring Gap</label>
          <input type="number" class="prop-input" data-prop="ring_gap" value="${(item.ring_gap ?? PLUNGER_DEFAULTS.ringGap).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Ring Diam</label>
          <input type="number" class="prop-input" data-prop="ring_diam" value="${(item.ring_diam ?? PLUNGER_DEFAULTS.ringDiam).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Ring Width</label>
          <input type="number" class="prop-input" data-prop="ring_width" value="${(item.ring_width ?? PLUNGER_DEFAULTS.ringWidth).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Spring Diam</label>
          <input type="number" class="prop-input" data-prop="spring_diam" value="${(item.spring_diam ?? PLUNGER_DEFAULTS.springDiam).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Spring Gauge</label>
          <input type="number" class="prop-input" data-prop="spring_gauge" value="${(item.spring_gauge ?? PLUNGER_DEFAULTS.springGauge).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Spring Loops</label>
          <input type="number" class="prop-input" data-prop="spring_loops" value="${(item.spring_loops ?? PLUNGER_DEFAULTS.springLoops).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">End Loops</label>
          <input type="number" class="prop-input" data-prop="spring_end_loops" value="${(item.spring_end_loops ?? PLUNGER_DEFAULTS.springEndLoops).toFixed(1)}" step="0.5">
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
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(item.surface)}</select>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Pull Speed</label>
          <input type="number" class="prop-input" data-prop="speed_pull" value="${(item.speed_pull ?? PLUNGER_DEFAULTS.speedPull).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Release Speed</label>
          <input type="number" class="prop-input" data-prop="speed_fire" value="${(item.speed_fire ?? PLUNGER_DEFAULTS.speedFire).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Stroke Length</label>
          <input type="number" class="prop-input" data-prop="stroke" value="${(item.stroke ?? PLUNGER_DEFAULTS.stroke).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Velocity</label>
          <input type="number" class="prop-input" data-prop="scatter_velocity" value="${(item.scatter_velocity ?? PLUNGER_DEFAULTS.scatterVelocity).toFixed(2)}" step="1">
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
          <input type="number" class="prop-input" data-prop="mech_strength" value="${(item.mech_strength ?? PLUNGER_DEFAULTS.mechStrength).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Momentum Xfer</label>
          <input type="number" class="prop-input" data-prop="momentum_xfer" value="${(item.momentum_xfer ?? PLUNGER_DEFAULTS.momentumXfer).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Park Position (0..1)</label>
          <input type="number" class="prop-input" data-prop="park_position" value="${(item.park_position ?? PLUNGER_DEFAULTS.parkPosition).toFixed(4)}" step="0.01" min="0" max="1">
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
