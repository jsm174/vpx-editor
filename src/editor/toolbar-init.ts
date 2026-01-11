import { state, elements, Point, setItem, deleteItem } from './state.js';
import { VIEW_MODE_3D } from '../shared/constants.js';
import { createObject, saveNewObject } from './object-factory.js';
import { updateItemsList, selectItem } from './items-panel.js';
import { updateLayersList } from './layers-panel.js';
import { render } from './canvas-renderer.js';
import { is3DInitialized } from './canvas-renderer-3d.js';
import { setCanvasCursor } from './cursor-utils.js';
import type { ObjectType } from '../types/game-objects.js';

export type { ObjectType };

export interface ElementCursors {
  [key: string]: string;
}

export interface ObjectTypeLabels {
  [key: string]: string;
}

function is3DMode(): boolean {
  return state.viewMode === VIEW_MODE_3D && is3DInitialized();
}

export const elementCursors: ElementCursors = {
  Wall: 'wall',
  Gate: 'gate',
  Ramp: 'ramp',
  Flipper: 'flipper',
  Plunger: 'plunger',
  Bumper: 'bumper',
  Spinner: 'spinner',
  Timer: 'timer',
  Trigger: 'trigger',
  Light: 'light',
  Kicker: 'kicker',
  HitTarget: 'target',
  Rubber: 'rubber',
  Flasher: 'flasher',
  Decal: 'decal',
  TextBox: 'textbox',
  Primitive: 'primitive',
  LightSequencer: 'lightsequencer',
  Reel: 'reel',
};

const elementIcons: ElementCursors = {
  Wall: 'wall',
  Gate: 'gate',
  Ramp: 'ramp',
  Flipper: 'flipper',
  Plunger: 'plunger',
  Bumper: 'bumper',
  Spinner: 'spinner',
  Timer: 'timer',
  Trigger: 'trigger',
  Light: 'light',
  Kicker: 'kicker',
  HitTarget: 'target',
  Rubber: 'rubber',
  Flasher: 'flasher',
  Decal: 'decal',
  TextBox: 'textbox',
  Primitive: 'primitive',
  LightSequencer: 'lightsequencer',
  Reel: 'reel',
  Ball: 'ball',
};

export const objectTypeLabels: ObjectTypeLabels = {
  Wall: 'Wall',
  Gate: 'Gate',
  Ramp: 'Ramp',
  Flipper: 'Flipper',
  Plunger: 'Plunger',
  Bumper: 'Bumper',
  Spinner: 'Spinner',
  Timer: 'Timer',
  Trigger: 'Trigger',
  Light: 'Light',
  Kicker: 'Kicker',
  HitTarget: 'Target',
  Rubber: 'Rubber',
  Flasher: 'Flasher',
  Decal: 'Decal',
  TextBox: 'Text Box',
  Primitive: 'Primitive',
  LightSequencer: 'Light Sequencer',
  Reel: 'EM Reel',
  Ball: 'Ball',
};

let creationModeSetTime: number = 0;
let isCreatingObject: boolean = false;

export function getCreationModeSetTime(): number {
  return creationModeSetTime;
}

export function setUIEnabled(enabled: boolean): void {
  const opacity = enabled ? '' : '0.4';
  const pointerEvents = enabled ? '' : 'none';

  document.querySelectorAll('#toolbar .tool-btn, #toolbar .tool-select').forEach((el: Element) => {
    const element = el as HTMLButtonElement;
    element.disabled = !enabled;
    element.style.opacity = opacity;
    element.style.pointerEvents = pointerEvents;
  });

  document.querySelectorAll('#toolbox-panel .toolbox-btn').forEach((el: Element) => {
    const element = el as HTMLButtonElement;
    element.disabled = !enabled;
    element.style.opacity = opacity;
    element.style.pointerEvents = pointerEvents;
    if (!enabled) {
      element.classList.remove('active', 'creating');
    }
  });

  const newLayerBtn = document.getElementById('new-layer-btn') as HTMLButtonElement | null;
  if (newLayerBtn) {
    newLayerBtn.disabled = !enabled;
    newLayerBtn.style.opacity = opacity;
    newLayerBtn.style.pointerEvents = pointerEvents;
  }

  const layerFilterInput = document.getElementById('layer-filter-input') as HTMLInputElement | null;
  if (layerFilterInput) {
    layerFilterInput.disabled = !enabled;
    layerFilterInput.style.opacity = opacity;
  }

  if (enabled) {
    const selectBtn = document.getElementById('tool-select');
    if (selectBtn && state.tool === 'select') {
      selectBtn.classList.add('active');
    }
  }
}

export function exitCreationMode(): void {
  state.creationMode = null;
  state.tool = 'select';
  document.querySelectorAll('.toolbox-btn').forEach((b: Element) => b.classList.remove('creating'));
  document.getElementById('tool-select')?.classList.add('active');
  document.getElementById('tool-pan')?.classList.remove('active');
  setCanvasCursor('default');
  elements.statusBar!.textContent = 'Ready';
}

export function enterCreationMode(type: string): void {
  state.creationMode = type;
  creationModeSetTime = Date.now();
  state.tool = 'select';
  document.querySelectorAll('.toolbox-btn').forEach((b: Element) => b.classList.remove('creating'));
  const btn = document.querySelector(`.toolbox-btn[data-type="${type}"]`);
  if (btn) btn.classList.add('creating');
  document.getElementById('tool-select')?.classList.remove('active');
  document.getElementById('tool-pan')?.classList.remove('active');
  const cursorFile = elementCursors[type] || type.toLowerCase();
  setCanvasCursor(`url('cursors/${cursorFile}.png') 0 0, crosshair`);
  elements.statusBar!.textContent = `Click to place ${type}`;
}

export async function createObjectAtPosition(type: string, position: Point): Promise<void> {
  if (isCreatingObject) return;
  isCreatingObject = true;

  try {
    const obj = createObject(type, position);
    if (!obj) {
      exitCreationMode();
      render();
      return;
    }

    const baseFileName = obj._fileName!.replace('gameitems/', '');
    setItem(obj.name as string, obj, baseFileName);
    const saved = await saveNewObject(obj);

    if (saved) {
      updateItemsList('', false);
      updateLayersList();
      selectItem(obj.name as string, false, true);
      elements.statusBar!.textContent = `Created ${type}: ${obj.name}`;
    } else {
      deleteItem(obj.name as string);
      elements.statusBar!.textContent = `Failed to create ${type}`;
    }

    exitCreationMode();
    state.tool = 'select';
    document.getElementById('tool-select')?.classList.add('active');
    render();
  } finally {
    isCreatingObject = false;
  }
}

export function setMagnifyMode(enabled: boolean): void {
  const magnifyBtn = document.getElementById('tool-magnify');
  const selectBtn = document.getElementById('tool-select');
  const panBtn = document.getElementById('tool-pan');

  if (enabled) {
    exitCreationMode();
    state.tool = 'magnify';
    magnifyBtn?.classList.add('active');
    selectBtn?.classList.remove('active');
    panBtn?.classList.remove('active');
    setCanvasCursor("url('cursors/magnify.png') 0 0, zoom-in");
  } else {
    state.tool = 'select';
    magnifyBtn?.classList.remove('active');
    selectBtn?.classList.add('active');
    panBtn?.classList.remove('active');
    setCanvasCursor('default');
  }
}

export function initElementsToolbar(): void {
  const objectTypes: ObjectType[] = [
    'Wall',
    'Gate',
    'Ramp',
    'Flipper',
    'Plunger',
    'Bumper',
    'Spinner',
    'Timer',
    'Trigger',
    'Light',
    'Kicker',
    'HitTarget',
    'Decal',
    'TextBox',
    'Reel',
    'LightSequencer',
    'Primitive',
    'Flasher',
    'Rubber',
    'Ball',
  ];

  const toolbar = document.getElementById('elements-toolbar');
  if (!toolbar) return;

  for (const type of objectTypes) {
    const btn = document.createElement('button');
    btn.className = 'toolbox-btn';
    btn.dataset.type = type;
    btn.dataset.tooltip = objectTypeLabels[type] || type;

    const img = document.createElement('img');
    img.src = `icons/${elementIcons[type] || type.toLowerCase()}.png`;
    img.alt = type;
    btn.appendChild(img);

    btn.addEventListener('click', (e: MouseEvent): void => {
      e.stopPropagation();
      if (state.creationMode === type) {
        exitCreationMode();
      } else {
        enterCreationMode(type);
      }
    });

    toolbar.appendChild(btn);
  }
}

export function initToolboxTools(): void {
  const magnifyBtn = document.getElementById('tool-magnify');
  const selectBtn = document.getElementById('tool-select');
  const panBtn = document.getElementById('tool-pan');

  if (magnifyBtn) {
    magnifyBtn.addEventListener('click', (): void => {
      if (is3DMode()) return;
      if (state.tool === 'magnify') {
        setMagnifyMode(false);
      } else {
        setMagnifyMode(true);
      }
    });
  }

  if (selectBtn) {
    selectBtn.addEventListener('click', (): void => {
      if (is3DMode()) return;
      exitCreationMode();
      state.tool = 'select';
      selectBtn.classList.add('active');
      magnifyBtn?.classList.remove('active');
      panBtn?.classList.remove('active');
      setCanvasCursor('default');
    });
  }

  if (panBtn) {
    panBtn.addEventListener('click', (): void => {
      if (is3DMode()) return;
      exitCreationMode();
      state.tool = 'pan';
      panBtn.classList.add('active');
      magnifyBtn?.classList.remove('active');
      selectBtn?.classList.remove('active');
      setCanvasCursor('grab');
    });
  }
}

export function initScriptButton(): void {
  const scriptBtn = document.getElementById('tool-script');
  if (scriptBtn) {
    scriptBtn.addEventListener('click', (): void => {
      if (!state.extractedDir) return;
      window.vpxEditor.toggleScriptEditor();
    });
  }
}

export function initTooltips(): void {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  let showTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentTarget: HTMLElement | null = null;

  document.addEventListener('mouseover', (e: MouseEvent): void => {
    const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
    if (!target || target === currentTarget) return;

    currentTarget = target;
    if (showTimeout) clearTimeout(showTimeout);

    showTimeout = setTimeout((): void => {
      const text = target.dataset.tooltip;
      if (!text) return;

      tooltip.textContent = text;

      const rect = target.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      let top = rect.bottom + 8;

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.transform = 'translateX(-50%)';

      const tooltipRect = tooltip.getBoundingClientRect();
      if (tooltipRect.left < 4) {
        tooltip.style.left = '4px';
        tooltip.style.transform = 'translateX(0)';
      }
      if (tooltipRect.right > window.innerWidth - 4) {
        tooltip.style.left = window.innerWidth - 4 + 'px';
        tooltip.style.transform = 'translateX(-100%)';
      }
      if (top + tooltipRect.height > window.innerHeight) {
        tooltip.style.top = rect.top - tooltipRect.height - 8 + 'px';
      }

      tooltip.classList.add('visible');
    }, 400);
  });

  document.addEventListener('mouseout', (e: MouseEvent): void => {
    const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
    if (target === currentTarget) {
      if (showTimeout) clearTimeout(showTimeout);
      tooltip.classList.remove('visible');
      currentTarget = null;
    }
  });
}
