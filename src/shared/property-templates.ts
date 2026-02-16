import { convertToUnit, getUnitSuffixHtml } from '../editor/utils';

export function propRow(label: string, content: string): string {
  return `<div class="prop-row">
  <label class="prop-label">${label}</label>
  ${content}
</div>`;
}

export interface NumberInputOptions {
  min?: number;
  max?: number;
  readonly?: boolean;
  convertUnits?: boolean;
}

export function numberInput(
  label: string,
  prop: string,
  value: number | string,
  step: number = 1,
  options: NumberInputOptions = {}
): string {
  const { min, max, readonly, convertUnits } = options;

  let displayValue = value;
  let displayStep = step;
  let convertAttr = '';
  let unitSuffix = '';

  if (convertUnits && typeof value === 'number') {
    displayValue = convertToUnit(value);
    displayStep = convertToUnit(step);
    convertAttr = ' data-convert-units';
    unitSuffix = getUnitSuffixHtml();
  }

  const decimals = displayStep < 1 ? Math.max(1, -Math.floor(Math.log10(displayStep))) : 0;
  const attrs = [
    `type="number"`,
    `class="prop-input${readonly ? ' readonly' : ''}"`,
    `data-prop="${prop}"`,
    `value="${typeof displayValue === 'number' ? displayValue.toFixed(decimals) : displayValue}"`,
    `step="${displayStep}"`,
  ];
  if (min !== undefined) attrs.push(`min="${min}"`);
  if (max !== undefined) attrs.push(`max="${max}"`);
  if (readonly) attrs.push('readonly');

  return propRow(label, `<input ${attrs.join(' ')}${convertAttr}>${unitSuffix}`);
}

export function checkbox(label: string, prop: string, checked: boolean | undefined): string {
  return propRow(label, `<input type="checkbox" class="prop-input" data-prop="${prop}" ${checked ? 'checked' : ''}>`);
}

export function select(label: string, prop: string, optionsHtml: string): string {
  return propRow(label, `<select class="prop-select" data-prop="${prop}">${optionsHtml}</select>`);
}

export function materialSelect(label: string, prop: string, optionsHtml: string): string {
  return propRow(
    label,
    `<div class="prop-select-with-goto"><select class="prop-select" data-prop="${prop}">${optionsHtml}</select><img src="icons/material-goto.svg" class="prop-goto-icon" data-goto-prop="${prop}" title="Open in Material Manager"></div>`
  );
}

export function colorInput(label: string, prop: string, value: string | null | undefined): string {
  return propRow(label, `<input type="color" class="prop-color" data-prop="${prop}" value="${value || '#ffffff'}">`);
}

export interface TextInputOptions {
  readonly?: boolean;
  maxlength?: number;
}

export function textInput(
  label: string,
  prop: string,
  value: string | null | undefined,
  options: TextInputOptions = {}
): string {
  const { readonly, maxlength } = options;
  const attrs = [
    `type="text"`,
    `class="prop-input${readonly ? ' readonly' : ''}"`,
    `data-prop="${prop}"`,
    `value="${value || ''}"`,
  ];
  if (maxlength) attrs.push(`maxlength="${maxlength}"`);
  if (readonly) attrs.push('readonly');

  return propRow(label, `<input ${attrs.join(' ')}>`);
}

export function propGroup(content: string, title: string | null = null): string {
  const titleHtml = title ? `<div class="prop-group-title">${title}</div>` : '';
  return `<div class="prop-group">${titleHtml}${content}</div>`;
}

export interface Tab {
  id: string;
  label: string;
}

export function propTabs(tabs: Tab[]): string {
  const buttons = tabs
    .map((tab, i) => `<button class="prop-tab${i === 0 ? ' active' : ''}" data-tab="${tab.id}">${tab.label}</button>`)
    .join('');
  return `<div class="prop-tabs">${buttons}</div>`;
}

export function propTabContent(id: string, content: string, active: boolean = false): string {
  return `<div class="prop-tab-content${active ? ' active' : ''}" data-tab="${id}">${content}</div>`;
}

export interface TimerItem {
  is_timer_enabled?: boolean;
  timer_interval?: number;
}

export function timerTab(item: TimerItem, defaultInterval: number = 100): string {
  return propTabContent(
    'timer',
    propGroup(`
    ${checkbox('Enabled', 'is_timer_enabled', item.is_timer_enabled)}
    ${numberInput('Interval (ms)', 'timer_interval', item.timer_interval ?? defaultInterval, 10, { min: 1 })}
  `)
  );
}

export interface PositionItem {
  center?: { x?: number; y?: number };
  pos?: { x?: number; y?: number };
  position?: { x?: number; y?: number };
  vCenter?: { x?: number; y?: number };
}

export function positionGroup(item: PositionItem, fields: ('x' | 'y')[] = ['x', 'y']): string {
  let content = '';

  if (fields.includes('x')) {
    const x = item.center?.x ?? item.pos?.x ?? item.position?.x ?? item.vCenter?.x ?? 0;
    content += numberInput(
      'X',
      item.center ? 'center.x' : item.pos ? 'pos.x' : item.position ? 'position.x' : 'vCenter.x',
      x,
      1,
      { convertUnits: true }
    );
  }
  if (fields.includes('y')) {
    const y = item.center?.y ?? item.pos?.y ?? item.position?.y ?? item.vCenter?.y ?? 0;
    content += numberInput(
      'Y',
      item.center ? 'center.y' : item.pos ? 'pos.y' : item.position ? 'position.y' : 'vCenter.y',
      y,
      1,
      { convertUnits: true }
    );
  }

  return propGroup(content, 'Position');
}
