import {
  TOOLBOX_MIN_WIDTH,
  TOOLBOX_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
} from '../shared/constants.js';

interface PanelSettings {
  toolboxWidth?: number;
  rightPanelWidth?: number;
  layersHeight?: number;
}

export function savePanelSettings(): void {
  const panelSettings: PanelSettings = {
    toolboxWidth: document.getElementById('toolbox-panel')?.offsetWidth,
    rightPanelWidth: document.getElementById('right-panel')?.offsetWidth,
    layersHeight: document.getElementById('layers-panel')?.offsetHeight,
  };
  window.vpxEditor.savePanelSettings(panelSettings);
}

export async function loadPanelSettings(): Promise<void> {
  try {
    const panelSettings: PanelSettings | null = await window.vpxEditor.getPanelSettings();
    if (!panelSettings) return;

    if (panelSettings.toolboxWidth) {
      const panel = document.getElementById('toolbox-panel');
      if (panel) panel.style.width = panelSettings.toolboxWidth + 'px';
    }
    if (panelSettings.rightPanelWidth) {
      const panel = document.getElementById('right-panel');
      if (panel) panel.style.width = panelSettings.rightPanelWidth + 'px';
    }
    if (panelSettings.layersHeight) {
      const panel = document.getElementById('layers-panel');
      if (panel) {
        panel.style.flex = 'none';
        panel.style.height = panelSettings.layersHeight + 'px';
      }
    }
  } catch {}
}

export function initToolboxResize(resizeCanvas: () => void): void {
  const handle = document.getElementById('toolbox-resize-handle');
  const panel = document.getElementById('toolbox-panel');
  if (!handle || !panel) return;

  let startX: number;
  let startWidth: number;
  let activePointerId: number | null = null;

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    const delta = e.clientX - startX;
    const newWidth = Math.min(TOOLBOX_MAX_WIDTH, Math.max(TOOLBOX_MIN_WIDTH, startWidth + delta));
    panel.style.width = newWidth + 'px';
    resizeCanvas();
  };

  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerEnd);
    handle.removeEventListener('pointercancel', onPointerEnd);
    savePanelSettings();
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
  });
}

export function initRightPanelResize(resizeCanvas: () => void): void {
  const handle = document.getElementById('right-resize-handle');
  const panel = document.getElementById('right-panel');
  if (!handle || !panel) return;

  let startX: number;
  let startWidth: number;
  let activePointerId: number | null = null;

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    const delta = startX - e.clientX;
    const newWidth = Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, startWidth + delta));
    panel.style.width = newWidth + 'px';
    resizeCanvas();
  };

  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerEnd);
    handle.removeEventListener('pointercancel', onPointerEnd);
    savePanelSettings();
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
  });
}

export function initLayersResize(): void {
  const handle = document.getElementById('layers-resize-handle');
  const panel = document.getElementById('layers-panel');
  const rightPanel = document.getElementById('right-panel');
  if (!handle || !panel || !rightPanel) return;

  let startY: number;
  let startHeight: number;
  let activePointerId: number | null = null;

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    const delta = startY - e.clientY;
    const maxHeight = rightPanel.offsetHeight - 100;
    const newHeight = Math.min(maxHeight, Math.max(80, startHeight + delta));
    panel.style.flex = 'none';
    panel.style.height = newHeight + 'px';
  };

  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerEnd);
    handle.removeEventListener('pointercancel', onPointerEnd);
    savePanelSettings();
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    startY = e.clientY;
    startHeight = panel.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
  });
}
