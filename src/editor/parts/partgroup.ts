import { registerEditable, IEditable, Point } from './registry.js';
import type { PartGroup } from '../../types/game-objects.js';

const PARTGROUP_DEFAULT_TIMER_INTERVAL = 100;
const PARTGROUP_DEFAULT_PLAYER_MODE_VISIBILITY_MASK = 0xffff;

interface PartGroupItem extends PartGroup {
  center?: Point;
  is_timer_enabled?: boolean;
  timer_interval?: number;
}

export function uiRenderPass1(_item: PartGroupItem, _isSelected: boolean): void {}

export function uiRenderPass2(_item: PartGroupItem, _isSelected: boolean): void {}

export function renderBlueprint(
  _ctx: CanvasRenderingContext2D,
  _item: PartGroupItem,
  _scale: number,
  _solid: boolean
): void {}

export function render(item: PartGroupItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function partGroupProperties(item: PartGroupItem): string {
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
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${item.timer_interval ?? PARTGROUP_DEFAULT_TIMER_INTERVAL}" step="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: PartGroupItem): Point | null {
  const center = item.center;
  return center ? { x: center.x, y: center.y } : null;
}

function putCenter(item: PartGroupItem, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const partGroupRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  getProperties: partGroupProperties,
  getCenter,
  putCenter,
};

registerEditable('PartGroup', partGroupRenderer);
