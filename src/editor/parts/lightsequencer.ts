import { state, elements } from '../state.js';
import { toScreen, getSelectColor, convertToUnit, getUnitSuffixHtml } from '../utils.js';
import { collectionOptions } from '../../shared/options-generators.js';
import { LIGHTSEQUENCER_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, RENDER_COLOR_RED, RENDER_COLOR_DARK_RED } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';
import type { LightSequencer } from '../../types/game-objects.js';

export function uiRenderPass1(item: LightSequencer, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const center = item.center || { x: 0, y: 0 };
  const { x: cx, y: cy } = toScreen(center.x, center.y);

  const smallR = 4 * state.zoom;
  const distance = 12 * state.zoom;

  for (let i = 0; i < 8; i++) {
    const angle = ((Math.PI * 2) / 8) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    const px = cx + sn * distance;
    const py = cy - cs * distance;

    ctx.fillStyle = i % 2 === 0 ? RENDER_COLOR_RED : RENDER_COLOR_DARK_RED;
    ctx.beginPath();
    ctx.arc(px, py, smallR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = RENDER_COLOR_RED;
  ctx.beginPath();
  ctx.arc(cx, cy - 3 * state.zoom, smallR, 0, Math.PI * 2);
  ctx.fill();

  const tableX = item.pos_x ?? LIGHTSEQUENCER_DEFAULTS.pos_x;
  const tableY = item.pos_y ?? LIGHTSEQUENCER_DEFAULTS.pos_y;
  const { x: tcx, y: tcy } = toScreen(tableX, tableY);

  const smallR2 = 2 * state.zoom;
  const distance2 = 7 * state.zoom;
  for (let i = 0; i < 8; i++) {
    const angle = ((Math.PI * 2) / 8) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    const px = tcx + sn * distance2;
    const py = tcy - cs * distance2;

    ctx.fillStyle = i % 2 === 0 ? RENDER_COLOR_RED : RENDER_COLOR_DARK_RED;
    ctx.beginPath();
    ctx.arc(px, py, smallR2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = RENDER_COLOR_RED;
  ctx.beginPath();
  ctx.arc(tcx, tcy - 2 * state.zoom, smallR2, 0, Math.PI * 2);
  ctx.fill();
}

export function uiRenderPass2(item: LightSequencer, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const center = item.center || { x: 0, y: 0 };
  const { x: cx, y: cy } = toScreen(center.x, center.y);

  const smallR = 4 * state.zoom;
  const distance = 12 * state.zoom;
  const mainR = 18 * state.zoom;

  const strokeColor = isSelected ? getSelectColor() : RENDER_COLOR_BLACK;
  const strokeWidth = isSelected ? 4 : 1;

  for (let i = 0; i < 8; i++) {
    const angle = ((Math.PI * 2) / 8) * i;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    const px = cx + sn * distance;
    const py = cy - cs * distance;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(px, py, smallR, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.arc(cx, cy - 3 * state.zoom, smallR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, mainR, 0, Math.PI * 2);
  ctx.stroke();

  const tableX = item.pos_x ?? LIGHTSEQUENCER_DEFAULTS.pos_x;
  const tableY = item.pos_y ?? LIGHTSEQUENCER_DEFAULTS.pos_y;
  const { x: tcx, y: tcy } = toScreen(tableX, tableY);

  ctx.strokeStyle = RENDER_COLOR_BLACK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tcx - 10 * state.zoom, tcy);
  ctx.lineTo(tcx + 10 * state.zoom, tcy);
  ctx.moveTo(tcx, tcy - 10 * state.zoom);
  ctx.lineTo(tcx, tcy + 10 * state.zoom);
  ctx.stroke();
}

export function renderBlueprint(
  _ctx: CanvasRenderingContext2D,
  _item: LightSequencer,
  _scale: number,
  _solid: boolean
): void {}

export function render(item: LightSequencer, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestLightSequencer(
  _item: LightSequencer,
  _worldX: number,
  _worldY: number,
  _center?: Point,
  distFromCenter?: number
): boolean {
  return (distFromCenter ?? 0) < 18;
}

export function lightSequencerProperties(item: LightSequencer): string {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="states">States</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="states">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Table X Center</label>
          <input type="number" class="prop-input" data-prop="pos_x" data-convert-units value="${convertToUnit(item.pos_x ?? LIGHTSEQUENCER_DEFAULTS.pos_x).toFixed(2)}" step="${convertToUnit(10).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Table Y Center</label>
          <input type="number" class="prop-input" data-prop="pos_y" data-convert-units value="${convertToUnit(item.pos_y ?? LIGHTSEQUENCER_DEFAULTS.pos_y).toFixed(2)}" step="${convertToUnit(10).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Collection</label>
          <select class="prop-select" data-prop="collection">${collectionOptions(item.collection)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Update Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="update_interval" value="${item.update_interval ?? LIGHTSEQUENCER_DEFAULTS.update_interval}" step="5" min="1">
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

function getCenter(item: LightSequencer): Point | null {
  const center = item.center;
  return center ? { x: center.x, y: center.y } : null;
}

function putCenter(item: LightSequencer, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const lightSequencerRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestLightSequencer,
  getProperties: lightSequencerProperties,
  getCenter,
  putCenter,
};

registerEditable('LightSequencer', lightSequencerRenderer);
