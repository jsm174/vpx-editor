import { state, elements } from './state.js';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_FACTOR, VIEW_MODE_2D, VIEW_MODE_3D } from '../shared/constants.js';
import { updateZoomDisplay } from './utils.js';
import { render, fitToView, resize2D } from './canvas-renderer.js';
import { updateItemsList } from './items-panel.js';
import { updateLayersList } from './layers-panel.js';
import { updatePropertiesPanel } from './properties-panel.js';
import {
  init3D,
  render3D,
  resize3D,
  get3DRenderer,
  is3DInitialized,
  exitPreviewMode,
  enterPreviewMode,
  getZoom3D,
  setZoom3D,
  updateSceneBackground,
  getWireframeMode,
  stopAnimation,
  resetCamera,
  enable3DKeyboard,
  disable3DKeyboard,
} from './canvas-renderer-3d.js';

export type ViewModeType = typeof VIEW_MODE_2D | typeof VIEW_MODE_3D;

export interface ViewManagerCallbacks {}

export function renderCurrentView(): void {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    render3D();
  } else {
    render();
  }
}

export function resizeCanvas(): void {
  const oldWidth = elements.canvas!.width;
  const oldHeight = elements.canvas!.height;
  const newWidth = elements.container!.clientWidth;
  const newHeight = elements.container!.clientHeight;

  elements.canvas!.width = newWidth;
  elements.canvas!.height = newHeight;

  if (is3DInitialized()) {
    resize3D(newWidth, newHeight);
  }

  if (oldWidth > 0 && oldHeight > 0) {
    resize2D(oldWidth, oldHeight, newWidth, newHeight);
  }

  renderCurrentView();
}

const BACKGLASS_ONLY_TYPES: string[] = ['TextBox', 'Reel'];
const PLAYFIELD_ONLY_TYPES: string[] = [
  'Wall',
  'Gate',
  'Ramp',
  'Flipper',
  'Plunger',
  'Ball',
  'Bumper',
  'Spinner',
  'Trigger',
  'HitTarget',
  'Kicker',
  'Primitive',
  'Rubber',
];

export function updateElementToolbarForBackglassView(): void {
  const toolbar = document.getElementById('elements-toolbar');
  if (!toolbar || state.viewMode === VIEW_MODE_3D) return;

  toolbar.querySelectorAll('.toolbox-btn').forEach((btn: Element) => {
    const button = btn as HTMLButtonElement;
    const type = button.dataset.type;
    let disabled = false;

    if (state.backglassView) {
      disabled = PLAYFIELD_ONLY_TYPES.includes(type || '');
    } else {
      disabled = BACKGLASS_ONLY_TYPES.includes(type || '');
    }

    button.disabled = disabled;
    button.style.opacity = disabled ? '0.4' : '';
    button.style.pointerEvents = disabled ? 'none' : '';
  });
}

export function updateToolboxForTableLock(): void {
  const toolbar = document.getElementById('elements-toolbar');
  if (!toolbar) return;

  if (state.isTableLocked) {
    toolbar.querySelectorAll('.toolbox-btn').forEach((btn: Element) => {
      const button = btn as HTMLButtonElement;
      button.disabled = true;
      button.style.opacity = '0.4';
      button.style.pointerEvents = 'none';
      button.classList.remove('active', 'creating');
    });
    state.tool = 'select';
    state.creationMode = null;
  } else {
    updateElementToolbarForBackglassView();
  }
}

let savedPlayMode: string = 'desktop';
let savedToolState: string = 'select';

export function switchViewMode(mode: ViewModeType): void {
  if (state.viewMode === mode) return;
  if (mode === VIEW_MODE_3D && state.backglassView) return;
  state.viewMode = mode;

  document.getElementById('tool-3d')!.classList.toggle('active', mode === VIEW_MODE_3D);

  const playModeSelect = document.getElementById('play-mode-select') as HTMLSelectElement | null;
  if (mode === VIEW_MODE_2D) {
    savedPlayMode = state.previewViewMode || 'desktop';
    exitPreviewMode();
    if (playModeSelect) playModeSelect.style.display = 'none';
  } else if (mode === VIEW_MODE_3D) {
    if (playModeSelect) {
      playModeSelect.style.display = '';
      playModeSelect.value = savedPlayMode;
    }
    state.previewViewMode = savedPlayMode;
  }

  const gridBtn = document.getElementById('toggle-grid');
  const backdropBtn = document.getElementById('toggle-backdrop');
  if (gridBtn) gridBtn.style.display = mode === VIEW_MODE_2D ? '' : 'none';
  if (backdropBtn) backdropBtn.style.display = mode === VIEW_MODE_2D ? '' : 'none';
  document.getElementById('toggle-wireframe')!.style.display = mode === VIEW_MODE_3D ? '' : 'none';
  document.getElementById('toggle-materials')!.style.display = 'none';

  const elementsToolbar = document.getElementById('elements-toolbar');
  if (elementsToolbar) {
    elementsToolbar.querySelectorAll('.toolbox-btn').forEach((btn: Element) => {
      const button = btn as HTMLButtonElement;
      button.disabled = mode === VIEW_MODE_3D;
      button.style.opacity = mode === VIEW_MODE_3D ? '0.4' : '';
      button.style.pointerEvents = mode === VIEW_MODE_3D ? 'none' : '';
    });
  }

  const backglassBtn = document.getElementById('toggle-backglass') as HTMLButtonElement;
  backglassBtn.disabled = mode === VIEW_MODE_3D;
  backglassBtn.style.opacity = mode === VIEW_MODE_3D ? '0.4' : '';
  backglassBtn.style.pointerEvents = mode === VIEW_MODE_3D ? 'none' : '';

  const magnifyBtn = document.getElementById('tool-magnify') as HTMLButtonElement | null;
  const selectBtn = document.getElementById('tool-select') as HTMLButtonElement | null;
  const panBtn = document.getElementById('tool-pan') as HTMLButtonElement | null;

  if (mode === VIEW_MODE_3D) {
    savedToolState = state.tool;
  }

  [magnifyBtn, selectBtn, panBtn].forEach((btn: HTMLButtonElement | null) => {
    if (btn) {
      btn.disabled = mode === VIEW_MODE_3D;
      btn.style.opacity = mode === VIEW_MODE_3D ? '0.4' : '';
      btn.style.pointerEvents = mode === VIEW_MODE_3D ? 'none' : '';
      btn.classList.remove('active');
    }
  });

  if (mode === VIEW_MODE_2D) {
    updateElementToolbarForBackglassView();
    updateToolboxForTableLock();
    state.tool = savedToolState;
    const btnMap: Record<string, HTMLButtonElement | null> = { select: selectBtn, pan: panBtn, magnify: magnifyBtn };
    const savedBtn = btnMap[savedToolState];
    if (savedBtn) savedBtn.classList.add('active');
  }

  window.vpxEditor.notify3DModeChanged(mode === VIEW_MODE_3D);

  if (mode === VIEW_MODE_3D) {
    state.showMaterials = true;
    elements.canvas!.style.display = 'none';
    const needsInit = !is3DInitialized();
    if (needsInit) {
      init3D(elements.container!);
    }
    get3DRenderer().domElement.style.display = 'block';
    enterPreviewMode(savedPlayMode, true);
    render3D(needsInit);
    const zoom = getZoom3D();
    elements.zoomLevelEl!.textContent = `${Math.round(zoom * 100)}%`;
    document.getElementById('toggle-wireframe')!.classList.toggle('active', getWireframeMode());
    enable3DKeyboard();
  } else {
    disable3DKeyboard();
    stopAnimation();
    if (is3DInitialized()) {
      get3DRenderer().domElement.style.display = 'none';
    }
    elements.canvas!.style.display = 'block';
    updateZoomDisplay();
    render();
  }
}

export function setupZoomButtons(): void {
  document.getElementById('zoom-in')!.addEventListener('click', (): void => {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      setZoom3D(ZOOM_FACTOR);
    } else {
      state.zoom = Math.min(MAX_ZOOM, state.zoom * ZOOM_FACTOR);
      updateZoomDisplay();
      render();
    }
  });

  document.getElementById('zoom-out')!.addEventListener('click', (): void => {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      setZoom3D(1 / ZOOM_FACTOR);
    } else {
      state.zoom = Math.max(MIN_ZOOM, state.zoom / ZOOM_FACTOR);
      updateZoomDisplay();
      render();
    }
  });

  document.getElementById('zoom-home')!.addEventListener('click', (): void => {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      resetCamera();
      elements.zoomLevelEl!.textContent = '100%';
    } else {
      fitToView();
    }
  });
}

export function setupToggleButtons(): void {
  document.getElementById('toggle-grid')?.addEventListener('click', (): void => {
    state.showGrid = !state.showGrid;
    document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
    render();
  });

  document.getElementById('toggle-backdrop')?.addEventListener('click', (): void => {
    state.showBackdrop = !state.showBackdrop;
    document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
    renderCurrentView();
  });
}

export function setupBackglassToggle(selectItemCallback: (item: string | null, clearSelection: boolean) => void): void {
  document.getElementById('toggle-backglass')!.addEventListener('click', (): void => {
    if (state.viewMode === VIEW_MODE_3D) return;
    state.backglassView = !state.backglassView;
    document.getElementById('toggle-backglass')!.classList.toggle('active', state.backglassView);
    const tool3dBtn = document.getElementById('tool-3d') as HTMLButtonElement;
    tool3dBtn.disabled = state.backglassView;
    tool3dBtn.style.opacity = state.backglassView ? '0.4' : '';
    tool3dBtn.style.pointerEvents = state.backglassView ? 'none' : '';
    selectItemCallback(null, true);
    updateElementToolbarForBackglassView();
    updateToolboxForTableLock();
    updateItemsList();
    updateLayersList();
    updatePropertiesPanel();
    fitToView();
    window.vpxEditor.notifyBackglassViewChanged(state.backglassView);
  });
}

export function registerCallbacks(_callbacks: ViewManagerCallbacks): void {}

export function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  updateSceneBackground();
  renderCurrentView();
}
