import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';
import type { TransformData } from '../../types/ipc.js';

type TransformType = 'rotate' | 'scale' | 'translate' | null;

interface TransformInitData {
  type: 'rotate' | 'scale' | 'translate';
  centerX?: number;
  centerY?: number;
  mouseX?: number;
  mouseY?: number;
}

let transformType: TransformType = null;
let storedData: TransformInitData | null = null;

setupThemeListener();

const rotatePanel = document.getElementById('rotate-panel') as HTMLElement;
const scalePanel = document.getElementById('scale-panel') as HTMLElement;
const translatePanel = document.getElementById('translate-panel') as HTMLElement;

const rotateAngle = document.getElementById('rotate-angle') as HTMLInputElement;
const rotateUseOrigin = document.getElementById('rotate-use-origin') as HTMLInputElement;
const rotateCenterX = document.getElementById('rotate-center-x') as HTMLInputElement;
const rotateCenterY = document.getElementById('rotate-center-y') as HTMLInputElement;

const scaleX = document.getElementById('scale-x') as HTMLInputElement;
const scaleY = document.getElementById('scale-y') as HTMLInputElement;
const scaleSquare = document.getElementById('scale-square') as HTMLInputElement;
const scaleUseOrigin = document.getElementById('scale-use-origin') as HTMLInputElement;
const scaleCenterX = document.getElementById('scale-center-x') as HTMLInputElement;
const scaleCenterY = document.getElementById('scale-center-y') as HTMLInputElement;

const translateX = document.getElementById('translate-x') as HTMLInputElement;
const translateY = document.getElementById('translate-y') as HTMLInputElement;

const btnApply = document.getElementById('btn-apply') as HTMLButtonElement;
const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnOk = document.getElementById('btn-ok') as HTMLButtonElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;

function showPanel(type: TransformType): void {
  transformType = type;
  rotatePanel.classList.toggle('hidden', type !== 'rotate');
  scalePanel.classList.toggle('hidden', type !== 'scale');
  translatePanel.classList.toggle('hidden', type !== 'translate');
}

function getTransformData(): TransformData | null {
  if (transformType === 'rotate') {
    return {
      type: 'rotate',
      angle: parseFloat(rotateAngle.value) || 0,
      useOrigin: rotateUseOrigin.checked,
      centerX: parseFloat(rotateCenterX.value) || 0,
      centerY: parseFloat(rotateCenterY.value) || 0,
    };
  } else if (transformType === 'scale') {
    return {
      type: 'scale',
      scaleX: parseFloat(scaleX.value) || 1,
      scaleY: parseFloat(scaleY.value) || 1,
      useOrigin: scaleUseOrigin.checked,
      centerX: parseFloat(scaleCenterX.value) || 0,
      centerY: parseFloat(scaleCenterY.value) || 0,
    };
  } else if (transformType === 'translate') {
    return {
      type: 'translate',
      offsetX: parseFloat(translateX.value) || 0,
      offsetY: parseFloat(translateY.value) || 0,
    };
  }
  return null;
}

function resetValues(): void {
  if (transformType === 'rotate') {
    rotateAngle.value = '0.0';
  } else if (transformType === 'scale') {
    scaleX.value = '1.0';
    scaleY.value = '1.0';
  } else if (transformType === 'translate') {
    translateX.value = '0.0';
    translateY.value = '0.0';
  }
}

scaleSquare.addEventListener('change', (): void => {
  if (scaleSquare.checked) {
    scaleY.value = scaleX.value;
    scaleY.disabled = true;
  } else {
    scaleY.disabled = false;
  }
});

scaleX.addEventListener('input', (): void => {
  if (scaleSquare.checked) {
    scaleY.value = scaleX.value;
  }
});

rotateUseOrigin.addEventListener('change', (): void => {
  if (!storedData) return;
  if (rotateUseOrigin.checked) {
    rotateCenterX.value = storedData.centerX?.toFixed(2) || '0';
    rotateCenterY.value = storedData.centerY?.toFixed(2) || '0';
  } else {
    rotateCenterX.value = storedData.mouseX?.toFixed(2) || '0';
    rotateCenterY.value = storedData.mouseY?.toFixed(2) || '0';
  }
});

scaleUseOrigin.addEventListener('change', (): void => {
  if (!storedData) return;
  if (scaleUseOrigin.checked) {
    scaleCenterX.value = storedData.centerX?.toFixed(2) || '0';
    scaleCenterY.value = storedData.centerY?.toFixed(2) || '0';
  } else {
    scaleCenterX.value = storedData.mouseX?.toFixed(2) || '0';
    scaleCenterY.value = storedData.mouseY?.toFixed(2) || '0';
  }
});

btnApply.addEventListener('click', (): void => {
  const data = getTransformData();
  if (data) window.vpxEditor.applyTransform(data);
});

btnUndo.addEventListener('click', (): void => {
  window.vpxEditor.undoTransform();
  resetValues();
});

btnOk.addEventListener('click', (): void => {
  const data = getTransformData();
  if (data) window.vpxEditor.saveTransform(data);
  window.close();
});

btnCancel.addEventListener('click', (): void => {
  window.vpxEditor.cancelTransform();
  window.close();
});

setupKeyboardShortcuts({
  onEscape: (): void => {
    window.vpxEditor.cancelTransform();
    window.close();
  },
  onEnter: (): void => {
    const data = getTransformData();
    if (data) window.vpxEditor.saveTransform(data);
    window.close();
  },
});

window.vpxEditor.onInitTransform?.(data => {
  const initData = data as TransformInitData;
  storedData = initData;
  showPanel(initData.type);
  document.title = initData.type.charAt(0).toUpperCase() + initData.type.slice(1);

  if (initData.type === 'rotate') {
    rotateAngle.value = '0.0';
    rotateUseOrigin.checked = true;
    rotateCenterX.value = initData.centerX?.toFixed(2) || '0';
    rotateCenterY.value = initData.centerY?.toFixed(2) || '0';
    rotateAngle.focus();
    rotateAngle.select();
  } else if (initData.type === 'scale') {
    scaleX.value = '1.0';
    scaleY.value = '1.0';
    scaleSquare.checked = true;
    scaleY.disabled = true;
    scaleUseOrigin.checked = true;
    scaleCenterX.value = initData.centerX?.toFixed(2) || '0';
    scaleCenterY.value = initData.centerY?.toFixed(2) || '0';
    scaleX.focus();
    scaleX.select();
  } else if (initData.type === 'translate') {
    translateX.value = '0.0';
    translateY.value = '0.0';
    translateX.focus();
    translateX.select();
  }
});
