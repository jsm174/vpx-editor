import { elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { TEXTBOX_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';

interface TextBoxItem {
  name?: string;
  ver1?: { x: number; y: number };
  ver2?: { x: number; y: number };
  back_color?: string;
  font_color?: string;
  intensity_scale?: number;
  font?: { name?: string };
  align?: string;
  is_transparent?: boolean;
  is_dmd?: boolean;
  text?: string;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  is_locked?: boolean;
}

function drawTextBox(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fillStyle: string | null,
  strokeStyle: string | null,
  lineWidth: number
): void {
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
}

export function uiRenderPass1(item: TextBoxItem, _isSelected: boolean): void {
  if (!elements.ctx) return;
  if (!item.ver1 || !item.ver2) return;
  if (!item.back_color) return;

  const { x: x1, y: y1 } = toScreen(item.ver1.x, item.ver1.y);
  const { x: x2, y: y2 } = toScreen(item.ver2.x, item.ver2.y);
  drawTextBox(elements.ctx, x1, y1, x2, y2, item.back_color, null, 0);
}

export function uiRenderPass2(item: TextBoxItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  if (!item.ver1 || !item.ver2) return;

  const { x: x1, y: y1 } = toScreen(item.ver1.x, item.ver1.y);
  const { x: x2, y: y2 } = toScreen(item.ver2.x, item.ver2.y);
  drawTextBox(elements.ctx, x1, y1, x2, y2, null, getStrokeStyle(item, isSelected), getLineWidth(isSelected));
}

export function renderBlueprint(
  ctx: CanvasRenderingContext2D,
  item: TextBoxItem,
  scale: number,
  _solid: boolean
): void {
  if (!item.ver1 || !item.ver2) return;

  const x1 = item.ver1.x * scale;
  const y1 = item.ver1.y * scale;
  const x2 = item.ver2.x * scale;
  const y2 = item.ver2.y * scale;
  drawTextBox(ctx, x1, y1, x2, y2, null, RENDER_COLOR_BLACK, 1);
}

export function render(item: TextBoxItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestTextBox(item: TextBoxItem, worldX: number, worldY: number): boolean {
  const v1 = item.ver1 || { x: 0, y: 0 };
  const v2 = item.ver2 || { x: 100, y: 100 };
  return worldX >= v1.x && worldX <= v2.x && worldY >= v1.y && worldY <= v2.y;
}

export function textBoxProperties(item: TextBoxItem): string {
  const v1 = item.ver1 || { x: 0, y: 0 };
  const v2 = item.ver2 || { x: 100, y: 100 };
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Transparent</label>
          <input type="checkbox" class="prop-input" data-prop="is_transparent" ${item.is_transparent ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Back Color</label>
          <input type="color" class="prop-input" data-prop="back_color" value="${item.back_color || TEXTBOX_DEFAULTS.back_color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Text Color</label>
          <input type="color" class="prop-input" data-prop="font_color" value="${item.font_color || TEXTBOX_DEFAULTS.font_color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Intensity</label>
          <input type="number" class="prop-input" data-prop="intensity_scale" value="${(item.intensity_scale ?? TEXTBOX_DEFAULTS.intensity_scale).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Font</label>
          <input type="text" class="prop-input" value="${item.font?.name || 'Arial'}" readonly style="background: transparent; cursor: default;">
        </div>
        <div class="prop-row">
          <label class="prop-label">Alignment</label>
          <select class="prop-select" data-prop="align">
            <option value="left"${(item.align || 'left') === 'left' ? ' selected' : ''}>Left</option>
            <option value="center"${item.align === 'center' ? ' selected' : ''}>Center</option>
            <option value="right"${item.align === 'right' ? ' selected' : ''}>Right</option>
          </select>
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
          <label class="prop-label">Width</label>
          <input type="number" class="prop-input" data-prop="ver2.x" value="${v2.x.toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="ver2.y" value="${v2.y.toFixed(1)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">State</div>
        <div class="prop-row">
          <label class="prop-label">Use Script DMD</label>
          <input type="checkbox" class="prop-input" data-prop="is_dmd" ${item.is_dmd ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Text</label>
          <input type="text" class="prop-input" data-prop="text" value="${item.text || ''}">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? TEXTBOX_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: TextBoxItem): Point | null {
  return item.ver1 ? { x: item.ver1.x, y: item.ver1.y } : null;
}

function putCenter(item: TextBoxItem, center: Point): void {
  const dx = center.x - (item.ver1?.x ?? 0);
  const dy = center.y - (item.ver1?.y ?? 0);
  item.ver1 = { x: center.x, y: center.y };
  if (item.ver2) {
    item.ver2 = { x: item.ver2.x + dx, y: item.ver2.y + dy };
  }
}

const renderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestTextBox,
  getProperties: textBoxProperties,
  getCenter,
  putCenter,
};

registerEditable('TextBox', renderer);
