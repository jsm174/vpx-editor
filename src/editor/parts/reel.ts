import { state, elements } from '../state.js';
import { toScreen, getLineWidth, getStrokeStyle } from '../utils.js';
import { imageOptions, soundOptions } from '../../shared/options-generators.js';
import { REEL_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, RENDER_COLOR_BLUE, BLUEPRINT_SOLID_COLOR } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';

interface ReelItem {
  name?: string;
  ver1?: { x: number; y: number };
  reel_count?: number;
  width?: number;
  height?: number;
  reel_spacing?: number;
  back_color?: string;
  is_visible?: boolean;
  is_transparent?: boolean;
  digit_range?: number;
  image?: string;
  use_image_grid?: boolean;
  images_per_grid_row?: number;
  motor_steps?: number;
  update_interval?: number;
  sound?: string;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  is_locked?: boolean;
}

interface ReelGeometry {
  reelCount: number;
  reelWidth: number;
  reelHeight: number;
  spacing: number;
  boxWidth: number;
  boxHeight: number;
}

function getReelGeometry(item: ReelItem): ReelGeometry {
  const reelCount = Math.min(item.reel_count ?? REEL_DEFAULTS.reel_count, 32);
  const reelWidth = item.width ?? REEL_DEFAULTS.width;
  const reelHeight = item.height ?? REEL_DEFAULTS.height;
  const spacing = item.reel_spacing ?? REEL_DEFAULTS.reel_spacing;
  const boxWidth = reelCount * (reelWidth + spacing) + spacing;
  const boxHeight = reelHeight + spacing * 2;
  return { reelCount, reelWidth, reelHeight, spacing, boxWidth, boxHeight };
}

function drawReel(
  ctx: CanvasRenderingContext2D,
  item: ReelItem,
  x1: number,
  y1: number,
  scale: number,
  backFillStyle: string | null,
  reelFillStyle: string | null,
  strokeStyle: string | null,
  lineWidth: number
): void {
  const { reelCount, reelWidth, reelHeight, spacing, boxWidth, boxHeight } = getReelGeometry(item);

  const screenBoxW = boxWidth * scale;
  const screenBoxH = boxHeight * scale;

  if (backFillStyle) {
    ctx.fillStyle = backFillStyle;
    ctx.fillRect(x1, y1, screenBoxW, screenBoxH);
  }

  if (reelFillStyle) {
    ctx.fillStyle = reelFillStyle;
    for (let i = 0; i < reelCount; i++) {
      const sx = x1 + (i * (reelWidth + spacing) + spacing) * scale;
      const sy = y1 + spacing * scale;
      const sw = reelWidth * scale;
      const sh = reelHeight * scale;
      ctx.fillRect(sx, sy, sw, sh);
    }
  }

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x1, y1, screenBoxW, screenBoxH);

    for (let i = 0; i < reelCount; i++) {
      const sx = x1 + (i * (reelWidth + spacing) + spacing) * scale;
      const sy = y1 + spacing * scale;
      const sw = reelWidth * scale;
      const sh = reelHeight * scale;
      ctx.strokeRect(sx, sy, sw, sh);
    }
  }
}

export function uiRenderPass1(item: ReelItem, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const v1 = item.ver1 || { x: 0, y: 0 };
  const { x: x1, y: y1 } = toScreen(v1.x, v1.y);
  drawReel(
    elements.ctx,
    item,
    x1,
    y1,
    state.zoom,
    item.back_color || REEL_DEFAULTS.back_color,
    RENDER_COLOR_BLUE,
    null,
    0
  );
}

export function uiRenderPass2(item: ReelItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const v1 = item.ver1 || { x: 0, y: 0 };
  const { x: x1, y: y1 } = toScreen(v1.x, v1.y);
  drawReel(
    elements.ctx,
    item,
    x1,
    y1,
    state.zoom,
    null,
    null,
    getStrokeStyle(item, isSelected),
    isSelected ? 4 : getLineWidth(isSelected)
  );
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: ReelItem, scale: number, solid: boolean): void {
  const v1 = item.ver1 || { x: 0, y: 0 };
  drawReel(
    ctx,
    item,
    v1.x * scale,
    v1.y * scale,
    scale,
    solid ? BLUEPRINT_SOLID_COLOR : null,
    null,
    RENDER_COLOR_BLACK,
    1
  );
}

export function render(item: ReelItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestReel(item: ReelItem, worldX: number, worldY: number): boolean {
  const v1 = item.ver1 || { x: 0, y: 0 };
  const { boxWidth, boxHeight } = getReelGeometry(item);
  return worldX >= v1.x && worldX <= v1.x + boxWidth && worldY >= v1.y && worldY <= v1.y + boxHeight;
}

export function reelProperties(item: ReelItem): string {
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
          <input type="color" class="prop-input" data-prop="back_color" value="${item.back_color || REEL_DEFAULTS.back_color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Single Digit Range (0 -></label>
          <input type="number" class="prop-input" data-prop="digit_range" value="${item.digit_range ?? REEL_DEFAULTS.digit_range}" step="1" min="0">
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
          <input type="number" class="prop-input" data-prop="images_per_grid_row" data-type="int" value="${item.images_per_grid_row ?? REEL_DEFAULTS.images_per_grid_row}" step="1" min="1">
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
          <input type="number" class="prop-input" data-prop="reel_count" value="${item.reel_count ?? REEL_DEFAULTS.reel_count}" step="1" min="1" max="32">
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
          <input type="number" class="prop-input" data-prop="reel_spacing" value="${(item.reel_spacing ?? REEL_DEFAULTS.reel_spacing).toFixed(1)}" step="1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="state">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Motor Steps</label>
          <input type="number" class="prop-input" data-prop="motor_steps" value="${item.motor_steps ?? REEL_DEFAULTS.motor_steps}" step="1" min="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Update Interval</label>
          <input type="number" class="prop-input" data-prop="update_interval" data-type="int" value="${item.update_interval ?? REEL_DEFAULTS.update_interval}" step="10" min="1">
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
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${item.timer_interval ?? REEL_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: ReelItem): Point | null {
  return item.ver1 ? { x: item.ver1.x, y: item.ver1.y } : null;
}

function putCenter(item: ReelItem, center: Point): void {
  item.ver1 = { x: center.x, y: center.y };
}

const renderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestReel,
  getProperties: reelProperties,
  getCenter,
  putCenter,
};

registerEditable('Reel', renderer);
