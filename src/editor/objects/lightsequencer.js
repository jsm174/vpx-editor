import { state, elements } from '../state.js';
import { toScreen } from '../utils.js';
import { collectionOptions } from '../../shared/options-generators.js';
import { LIGHTSEQUENCER_DEFAULTS } from '../../shared/object-defaults.js';

export function renderLightSequencer(item, isSelected) {
  const center = item.center || item.vCenter || { x: 0, y: 0 };
  const { x: cx, y: cy } = toScreen(center.x, center.y);

  const smallR = 4 * state.zoom;
  const distance = 12 * state.zoom;
  const mainR = 18 * state.zoom;

  const strokeColor = isSelected ? '#0000ff' : '#000000';
  const strokeWidth = isSelected ? 4 : 1;

  for (let i = 0; i < 8; i++) {
    const angle = ((Math.PI * 2) / 8) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    const px = cx + sn * distance;
    const py = cy - cs * distance;

    elements.ctx.fillStyle = i % 2 === 0 ? '#ff0000' : '#800000';
    elements.ctx.strokeStyle = strokeColor;
    elements.ctx.lineWidth = strokeWidth;
    elements.ctx.beginPath();
    elements.ctx.arc(px, py, smallR, 0, Math.PI * 2);
    elements.ctx.fill();
    elements.ctx.stroke();
  }

  elements.ctx.fillStyle = '#ff0000';
  elements.ctx.strokeStyle = strokeColor;
  elements.ctx.lineWidth = strokeWidth;
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy - 3 * state.zoom, smallR, 0, Math.PI * 2);
  elements.ctx.fill();
  elements.ctx.stroke();

  elements.ctx.strokeStyle = strokeColor;
  elements.ctx.lineWidth = strokeWidth;
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, mainR, 0, Math.PI * 2);
  elements.ctx.stroke();

  const tableX = item.pos_x ?? LIGHTSEQUENCER_DEFAULTS.posX;
  const tableY = item.pos_y ?? LIGHTSEQUENCER_DEFAULTS.posY;
  const { x: tcx, y: tcy } = toScreen(tableX, tableY);

  elements.ctx.strokeStyle = '#000000';
  elements.ctx.lineWidth = 1;
  elements.ctx.beginPath();
  elements.ctx.moveTo(tcx - 10 * state.zoom, tcy);
  elements.ctx.lineTo(tcx + 10 * state.zoom, tcy);
  elements.ctx.moveTo(tcx, tcy - 10 * state.zoom);
  elements.ctx.lineTo(tcx, tcy + 10 * state.zoom);
  elements.ctx.stroke();

  const smallR2 = 2 * state.zoom;
  const distance2 = 7 * state.zoom;
  for (let i = 0; i < 8; i++) {
    const angle = ((Math.PI * 2) / 8) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    const px = tcx + sn * distance2;
    const py = tcy - cs * distance2;

    elements.ctx.fillStyle = i % 2 === 0 ? '#ff0000' : '#800000';
    elements.ctx.beginPath();
    elements.ctx.arc(px, py, smallR2, 0, Math.PI * 2);
    elements.ctx.fill();
  }

  elements.ctx.fillStyle = '#ff0000';
  elements.ctx.beginPath();
  elements.ctx.arc(tcx, tcy - 2 * state.zoom, smallR2, 0, Math.PI * 2);
  elements.ctx.fill();
}

export function hitTestLightSequencer(item, worldX, worldY, center, distFromCenter) {
  return distFromCenter < 18;
}

export function lightSequencerProperties(item) {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="states">States</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="states">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Table X Center</label>
          <input type="number" class="prop-input" data-prop="pos_x" value="${(item.pos_x ?? LIGHTSEQUENCER_DEFAULTS.posX).toFixed(1)}" step="10">
        </div>
        <div class="prop-row">
          <label class="prop-label">Table Y Center</label>
          <input type="number" class="prop-input" data-prop="pos_y" value="${(item.pos_y ?? LIGHTSEQUENCER_DEFAULTS.posY).toFixed(1)}" step="10">
        </div>
        <div class="prop-row">
          <label class="prop-label">Collection</label>
          <select class="prop-select" data-prop="collection">${collectionOptions(item.collection)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Update Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="update_interval" value="${item.update_interval ?? LIGHTSEQUENCER_DEFAULTS.updateInterval}" step="5" min="1">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? LIGHTSEQUENCER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
