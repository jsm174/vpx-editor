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
import { updateVRButtonVisibility } from './table-loader.js';

export function renderCurrentView() {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    render3D();
  } else {
    render();
  }
}

export function resizeCanvas() {
  const oldWidth = elements.canvas.width;
  const oldHeight = elements.canvas.height;
  const newWidth = elements.container.clientWidth;
  const newHeight = elements.container.clientHeight;

  elements.canvas.width = newWidth;
  elements.canvas.height = newHeight;

  if (is3DInitialized()) {
    resize3D(newWidth, newHeight);
  }

  if (!state.is3DMode && oldWidth > 0 && oldHeight > 0) {
    resize2D(oldWidth, oldHeight, newWidth, newHeight);
  } else {
    renderCurrentView();
  }
}

const BACKGLASS_ONLY_TYPES = ['TextBox', 'Reel'];
const PLAYFIELD_ONLY_TYPES = [
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

export function updateElementToolbarForBackglassView() {
  const toolbar = document.getElementById('elements-toolbar');
  if (!toolbar || state.viewMode === VIEW_MODE_3D) return;

  toolbar.querySelectorAll('.toolbox-btn').forEach(btn => {
    const type = btn.dataset.type;
    let disabled = false;

    if (state.backglassView) {
      disabled = PLAYFIELD_ONLY_TYPES.includes(type);
    } else {
      disabled = BACKGLASS_ONLY_TYPES.includes(type);
    }

    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.4' : '';
    btn.style.pointerEvents = disabled ? 'none' : '';
  });
}

export function updateToolboxForTableLock() {
  const toolbar = document.getElementById('elements-toolbar');
  if (!toolbar) return;

  if (state.isTableLocked) {
    toolbar.querySelectorAll('.toolbox-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      btn.classList.remove('active', 'creating');
    });
    state.tool = 'select';
    state.creationMode = null;
  } else {
    updateElementToolbarForBackglassView();
  }
}

let savedVRState = false;
let savedToolState = 'select';

export function switchViewMode(mode) {
  if (state.viewMode === mode) return;
  if (mode === VIEW_MODE_3D && state.backglassView) return;
  state.viewMode = mode;

  document.getElementById('tool-3d').classList.toggle('active', mode === VIEW_MODE_3D);

  const vrModeToggle = document.getElementById('vr-mode-toggle');
  if (mode === VIEW_MODE_2D) {
    savedVRState = state.previewViewMode === 'vr';
    vrModeToggle.classList.remove('active');
    state.previewViewMode = 'editor';
    exitPreviewMode();
  } else if (mode === VIEW_MODE_3D && savedVRState) {
    state.previewViewMode = 'vr';
    vrModeToggle.classList.add('active');
    enterPreviewMode('vr');
  }
  updateVRButtonVisibility();

  const gridBtn = document.getElementById('toggle-grid');
  const backdropBtn = document.getElementById('toggle-backdrop');
  if (gridBtn) gridBtn.style.display = mode === VIEW_MODE_2D ? '' : 'none';
  if (backdropBtn) backdropBtn.style.display = mode === VIEW_MODE_2D ? '' : 'none';
  document.getElementById('toggle-wireframe').style.display = mode === VIEW_MODE_3D ? '' : 'none';
  document.getElementById('toggle-materials').style.display = 'none';

  const elementsToolbar = document.getElementById('elements-toolbar');
  if (elementsToolbar) {
    elementsToolbar.querySelectorAll('.toolbox-btn').forEach(btn => {
      btn.disabled = mode === VIEW_MODE_3D;
      btn.style.opacity = mode === VIEW_MODE_3D ? '0.4' : '';
      btn.style.pointerEvents = mode === VIEW_MODE_3D ? 'none' : '';
    });
  }

  const backglassBtn = document.getElementById('toggle-backglass');
  backglassBtn.disabled = mode === VIEW_MODE_3D;
  backglassBtn.style.opacity = mode === VIEW_MODE_3D ? '0.4' : '';
  backglassBtn.style.pointerEvents = mode === VIEW_MODE_3D ? 'none' : '';

  const magnifyBtn = document.getElementById('tool-magnify');
  const selectBtn = document.getElementById('tool-select');
  const panBtn = document.getElementById('tool-pan');

  if (mode === VIEW_MODE_3D) {
    savedToolState = state.tool;
  }

  [magnifyBtn, selectBtn, panBtn].forEach(btn => {
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
    const btnMap = { select: selectBtn, pan: panBtn, magnify: magnifyBtn };
    const savedBtn = btnMap[savedToolState];
    if (savedBtn) savedBtn.classList.add('active');
  }

  window.vpxEditor.notify3DModeChanged?.(mode === VIEW_MODE_3D);

  if (mode === VIEW_MODE_3D) {
    state.showMaterials = true;
    elements.canvas.style.display = 'none';
    const needsInit = !is3DInitialized();
    if (needsInit) {
      init3D(elements.container);
    }
    get3DRenderer().domElement.style.display = 'block';
    render3D(needsInit);
    const zoom = getZoom3D();
    elements.zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
    document.getElementById('toggle-wireframe').classList.toggle('active', getWireframeMode());
    enable3DKeyboard();
  } else {
    disable3DKeyboard();
    stopAnimation();
    if (is3DInitialized()) {
      get3DRenderer().domElement.style.display = 'none';
    }
    elements.canvas.style.display = 'block';
    updateZoomDisplay();
    render();
  }
}

export function setupZoomButtons() {
  document.getElementById('zoom-in').addEventListener('click', () => {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      setZoom3D(ZOOM_FACTOR);
    } else {
      state.zoom = Math.min(MAX_ZOOM, state.zoom * ZOOM_FACTOR);
      updateZoomDisplay();
      render();
    }
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      setZoom3D(1 / ZOOM_FACTOR);
    } else {
      state.zoom = Math.max(MIN_ZOOM, state.zoom / ZOOM_FACTOR);
      updateZoomDisplay();
      render();
    }
  });

  document.getElementById('zoom-home').addEventListener('click', () => {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      resetCamera();
      elements.zoomLevelEl.textContent = '100%';
    } else {
      fitToView();
    }
  });
}

export function setupToggleButtons() {
  document.getElementById('toggle-grid')?.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
    render();
  });

  document.getElementById('toggle-backdrop')?.addEventListener('click', () => {
    state.showBackdrop = !state.showBackdrop;
    document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
    renderCurrentView();
  });
}

export function setupBackglassToggle(selectItemCallback) {
  document.getElementById('toggle-backglass').addEventListener('click', () => {
    if (state.viewMode === VIEW_MODE_3D) return;
    state.backglassView = !state.backglassView;
    document.getElementById('toggle-backglass').classList.toggle('active', state.backglassView);
    const tool3dBtn = document.getElementById('tool-3d');
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
    window.vpxEditor.notifyBackglassViewChanged?.(state.backglassView);
  });
}

let setMagnifyModeCallback = null;
let exitCreationModeCallback = null;

export function registerCallbacks(callbacks) {
  setMagnifyModeCallback = callbacks.setMagnifyMode;
  exitCreationModeCallback = callbacks.exitCreationMode;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateSceneBackground();
  renderCurrentView();
}
