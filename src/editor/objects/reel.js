import { state, elements } from '../state.js';
import { toScreen, getLineWidth } from '../utils.js';
import { imageOptions, soundOptions } from '../../shared/options-generators.js';
import { REEL_DEFAULTS } from '../../shared/object-defaults.js';

export function renderReel(item, isSelected) {
  const v1 = item.ver1 || { x: 0, y: 0 };

  const reelCount = Math.min(item.reel_count ?? REEL_DEFAULTS.reelCount, 32);
  const reelWidth = item.width ?? REEL_DEFAULTS.width;
  const reelHeight = item.height ?? REEL_DEFAULTS.height;
  const spacing = item.reel_spacing ?? REEL_DEFAULTS.reelSpacing;

  const boxWidth = reelCount * (reelWidth + spacing) + spacing;
  const boxHeight = reelHeight + spacing * 2;

  const { x: x1, y: y1 } = toScreen(v1.x, v1.y);
  const screenBoxW = boxWidth * state.zoom;
  const screenBoxH = boxHeight * state.zoom;

  elements.ctx.fillStyle = item.back_color || REEL_DEFAULTS.backColor;
  elements.ctx.fillRect(x1, y1, screenBoxW, screenBoxH);

  elements.ctx.fillStyle = 'rgb(0, 0, 255)';
  for (let i = 0; i < reelCount; i++) {
    const rx = v1.x + i * (reelWidth + spacing) + spacing;
    const ry = v1.y + spacing;
    const { x: sx, y: sy } = toScreen(rx, ry);
    const sw = reelWidth * state.zoom;
    const sh = reelHeight * state.zoom;
    elements.ctx.fillRect(sx, sy, sw, sh);
  }

  elements.ctx.strokeStyle = isSelected ? '#0000ff' : '#000000';
  elements.ctx.lineWidth = isSelected ? 4 : getLineWidth(isSelected);
  elements.ctx.strokeRect(x1, y1, screenBoxW, screenBoxH);

  for (let i = 0; i < reelCount; i++) {
    const rx = v1.x + i * (reelWidth + spacing) + spacing;
    const ry = v1.y + spacing;
    const { x: sx, y: sy } = toScreen(rx, ry);
    const sw = reelWidth * state.zoom;
    const sh = reelHeight * state.zoom;
    elements.ctx.strokeRect(sx, sy, sw, sh);
  }
}

export function hitTestReel(item, worldX, worldY) {
  const v1 = item.ver1 || { x: 0, y: 0 };
  const reelCount = Math.min(item.reel_count ?? REEL_DEFAULTS.reelCount, 32);
  const reelWidth = item.width ?? REEL_DEFAULTS.width;
  const reelHeight = item.height ?? REEL_DEFAULTS.height;
  const spacing = item.reel_spacing ?? REEL_DEFAULTS.reelSpacing;
  const boxW = reelCount * (reelWidth + spacing) + spacing;
  const boxH = reelHeight + spacing * 2;
  return worldX >= v1.x && worldX <= v1.x + boxW && worldY >= v1.y && worldY <= v1.y + boxH;
}

export function reelProperties(item) {
  const v1 = item.ver1 || { x: 0, y: 0 };
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="state">State</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Background Transparent</label>
          <input type="checkbox" class="prop-input" data-prop="is_transparent" ${item.is_transparent ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Background Color</label>
          <input type="color" class="prop-input" data-prop="back_color" value="${item.back_color || REEL_DEFAULTS.backColor}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Single Digit Range (0 -></label>
          <input type="number" class="prop-input" data-prop="digit_range" value="${item.digit_range ?? REEL_DEFAULTS.digitRange}" step="1" min="0">
        </div>
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Image Grid</div>
        <div class="prop-row">
          <label class="prop-label">Use Image Grid</label>
          <input type="checkbox" class="prop-input" data-prop="use_image_grid" ${item.use_image_grid ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Images Per Row</label>
          <input type="number" class="prop-input" data-prop="images_per_grid_row" value="${item.images_per_grid_row ?? REEL_DEFAULTS.imagesPerGridRow}" step="1" min="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="ver1.x" value="${v1.x.toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="ver1.y" value="${v1.y.toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reels (Max 32)</label>
          <input type="number" class="prop-input" data-prop="reel_count" value="${item.reel_count ?? REEL_DEFAULTS.reelCount}" step="1" min="1" max="32">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reel Width</label>
          <input type="number" class="prop-input" data-prop="width" value="${(item.width ?? REEL_DEFAULTS.width).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reel Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${(item.height ?? REEL_DEFAULTS.height).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reel Spacing</label>
          <input type="number" class="prop-input" data-prop="reel_spacing" value="${(item.reel_spacing ?? REEL_DEFAULTS.reelSpacing).toFixed(1)}" step="1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="state">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Motor Steps</label>
          <input type="number" class="prop-input" data-prop="motor_steps" value="${item.motor_steps ?? REEL_DEFAULTS.motorSteps}" step="1" min="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Update Interval</label>
          <input type="number" class="prop-input" data-prop="update_interval" value="${item.update_interval ?? REEL_DEFAULTS.updateInterval}" step="10" min="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Sound</label>
          <select class="prop-select" data-prop="sound">${soundOptions(item.sound)}</select>
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? REEL_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
