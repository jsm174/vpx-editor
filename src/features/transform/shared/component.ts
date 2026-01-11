export type TransformType = 'rotate' | 'scale' | 'translate';

export interface TransformData {
  type: TransformType;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
  useOrigin?: boolean;
  centerX?: number;
  centerY?: number;
}

export interface TransformInitData {
  type: TransformType;
  centerX?: number;
  centerY?: number;
  mouseX?: number;
  mouseY?: number;
}

export interface TransformCallbacks {
  onApply: (data: TransformData) => void;
  onUndo: () => void;
  onSave: (data: TransformData) => void;
  onCancel: () => void;
}

export function createTransformHTML(): string {
  return `
    <div class="transform-container">
      <div id="rotate-panel" class="transform-panel hidden">
        <div class="transform-body">
          <div class="transform-row">
            <label>Rotate by</label>
            <input type="number" id="rotate-angle" class="win-input" value="0.0" step="0.1">
          </div>
          <div class="transform-row checkbox-row">
            <input type="checkbox" id="rotate-use-origin">
            <label for="rotate-use-origin">Rotate around origin</label>
          </div>
          <div class="transform-row">
            <label>Center</label>
            <span class="coord-label">X</span>
            <input type="number" id="rotate-center-x" class="win-input" step="0.1">
          </div>
          <div class="transform-row">
            <span class="spacer"></span>
            <span class="coord-label">Y</span>
            <input type="number" id="rotate-center-y" class="win-input" step="0.1">
          </div>
        </div>
      </div>

      <div id="scale-panel" class="transform-panel hidden">
        <div class="transform-body">
          <div class="transform-row">
            <label>Scale X</label>
            <input type="number" id="scale-x" class="win-input" value="1.0" step="0.1">
          </div>
          <div class="transform-row">
            <label>Scale Y</label>
            <input type="number" id="scale-y" class="win-input" value="1.0" step="0.1">
          </div>
          <div class="transform-row checkbox-row">
            <input type="checkbox" id="scale-square" checked>
            <label for="scale-square">Square Scaling</label>
          </div>
          <div class="transform-row checkbox-row">
            <input type="checkbox" id="scale-use-origin">
            <label for="scale-use-origin">Scale around origin</label>
          </div>
          <div class="transform-row">
            <label>Center</label>
            <span class="coord-label">X</span>
            <input type="number" id="scale-center-x" class="win-input" step="0.1">
          </div>
          <div class="transform-row">
            <span class="spacer"></span>
            <span class="coord-label">Y</span>
            <input type="number" id="scale-center-y" class="win-input" step="0.1">
          </div>
        </div>
      </div>

      <div id="translate-panel" class="transform-panel hidden">
        <div class="transform-body">
          <div class="transform-row">
            <label>Offset</label>
            <span class="coord-label">X</span>
            <input type="number" id="translate-x" class="win-input" value="0.0" step="1">
          </div>
          <div class="transform-row">
            <span class="spacer"></span>
            <span class="coord-label">Y</span>
            <input type="number" id="translate-y" class="win-input" value="0.0" step="1">
          </div>
        </div>
      </div>

      <div class="transform-footer">
        <div class="footer-left">
          <button class="win-btn" id="btn-apply">Apply</button>
          <button class="win-btn" id="btn-undo">Undo</button>
        </div>
        <div class="footer-right">
          <button class="win-btn" id="btn-ok">OK</button>
          <button class="win-btn" id="btn-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

export function initTransformComponent(
  container: HTMLElement,
  initData: TransformInitData,
  callbacks: TransformCallbacks
): { destroy: () => void } {
  const $ = <T extends HTMLElement>(id: string): T | null => container.querySelector(`#${id}`);

  const rotatePanel = $<HTMLElement>('rotate-panel');
  const scalePanel = $<HTMLElement>('scale-panel');
  const translatePanel = $<HTMLElement>('translate-panel');

  const rotateAngle = $<HTMLInputElement>('rotate-angle');
  const rotateUseOrigin = $<HTMLInputElement>('rotate-use-origin');
  const rotateCenterX = $<HTMLInputElement>('rotate-center-x');
  const rotateCenterY = $<HTMLInputElement>('rotate-center-y');

  const scaleX = $<HTMLInputElement>('scale-x');
  const scaleY = $<HTMLInputElement>('scale-y');
  const scaleSquare = $<HTMLInputElement>('scale-square');
  const scaleUseOrigin = $<HTMLInputElement>('scale-use-origin');
  const scaleCenterX = $<HTMLInputElement>('scale-center-x');
  const scaleCenterY = $<HTMLInputElement>('scale-center-y');

  const translateX = $<HTMLInputElement>('translate-x');
  const translateY = $<HTMLInputElement>('translate-y');

  const btnApply = $<HTMLButtonElement>('btn-apply');
  const btnUndo = $<HTMLButtonElement>('btn-undo');
  const btnOk = $<HTMLButtonElement>('btn-ok');
  const btnCancel = $<HTMLButtonElement>('btn-cancel');

  const transformType = initData.type;

  function showPanel(): void {
    rotatePanel?.classList.toggle('hidden', transformType !== 'rotate');
    scalePanel?.classList.toggle('hidden', transformType !== 'scale');
    translatePanel?.classList.toggle('hidden', transformType !== 'translate');
  }

  function getTransformData(): TransformData | null {
    if (transformType === 'rotate') {
      return {
        type: 'rotate',
        angle: parseFloat(rotateAngle?.value || '0') || 0,
        useOrigin: rotateUseOrigin?.checked || false,
        centerX: parseFloat(rotateCenterX?.value || '0') || 0,
        centerY: parseFloat(rotateCenterY?.value || '0') || 0,
      };
    } else if (transformType === 'scale') {
      return {
        type: 'scale',
        scaleX: parseFloat(scaleX?.value || '1') || 1,
        scaleY: parseFloat(scaleY?.value || '1') || 1,
        useOrigin: scaleUseOrigin?.checked || false,
        centerX: parseFloat(scaleCenterX?.value || '0') || 0,
        centerY: parseFloat(scaleCenterY?.value || '0') || 0,
      };
    } else if (transformType === 'translate') {
      return {
        type: 'translate',
        offsetX: parseFloat(translateX?.value || '0') || 0,
        offsetY: parseFloat(translateY?.value || '0') || 0,
      };
    }
    return null;
  }

  function resetValues(): void {
    if (transformType === 'rotate' && rotateAngle) {
      rotateAngle.value = '0.0';
    } else if (transformType === 'scale' && scaleX && scaleY) {
      scaleX.value = '1.0';
      scaleY.value = '1.0';
    } else if (transformType === 'translate' && translateX && translateY) {
      translateX.value = '0.0';
      translateY.value = '0.0';
    }
  }

  showPanel();

  if (transformType === 'rotate') {
    if (rotateAngle) rotateAngle.value = '0.0';
    if (rotateUseOrigin) rotateUseOrigin.checked = true;
    if (rotateCenterX) rotateCenterX.value = initData.centerX?.toFixed(2) || '0';
    if (rotateCenterY) rotateCenterY.value = initData.centerY?.toFixed(2) || '0';
    rotateAngle?.focus();
    rotateAngle?.select();
  } else if (transformType === 'scale') {
    if (scaleX) scaleX.value = '1.0';
    if (scaleY) {
      scaleY.value = '1.0';
      scaleY.disabled = true;
    }
    if (scaleSquare) scaleSquare.checked = true;
    if (scaleUseOrigin) scaleUseOrigin.checked = true;
    if (scaleCenterX) scaleCenterX.value = initData.centerX?.toFixed(2) || '0';
    if (scaleCenterY) scaleCenterY.value = initData.centerY?.toFixed(2) || '0';
    scaleX?.focus();
    scaleX?.select();
  } else if (transformType === 'translate') {
    if (translateX) translateX.value = '0.0';
    if (translateY) translateY.value = '0.0';
    translateX?.focus();
    translateX?.select();
  }

  if (scaleSquare) {
    scaleSquare.onchange = () => {
      if (scaleY) {
        if (scaleSquare.checked) {
          scaleY.value = scaleX?.value || '1.0';
          scaleY.disabled = true;
        } else {
          scaleY.disabled = false;
        }
      }
    };
  }

  if (scaleX) {
    scaleX.oninput = () => {
      if (scaleSquare?.checked && scaleY) {
        scaleY.value = scaleX.value;
      }
    };
  }

  if (rotateUseOrigin) {
    rotateUseOrigin.onchange = () => {
      if (rotateUseOrigin.checked) {
        if (rotateCenterX) rotateCenterX.value = initData.centerX?.toFixed(2) || '0';
        if (rotateCenterY) rotateCenterY.value = initData.centerY?.toFixed(2) || '0';
      } else {
        if (rotateCenterX) rotateCenterX.value = initData.mouseX?.toFixed(2) || '0';
        if (rotateCenterY) rotateCenterY.value = initData.mouseY?.toFixed(2) || '0';
      }
    };
  }

  if (scaleUseOrigin) {
    scaleUseOrigin.onchange = () => {
      if (scaleUseOrigin.checked) {
        if (scaleCenterX) scaleCenterX.value = initData.centerX?.toFixed(2) || '0';
        if (scaleCenterY) scaleCenterY.value = initData.centerY?.toFixed(2) || '0';
      } else {
        if (scaleCenterX) scaleCenterX.value = initData.mouseX?.toFixed(2) || '0';
        if (scaleCenterY) scaleCenterY.value = initData.mouseY?.toFixed(2) || '0';
      }
    };
  }

  if (btnApply) {
    btnApply.onclick = () => {
      const data = getTransformData();
      if (data) callbacks.onApply(data);
    };
  }

  if (btnUndo) {
    btnUndo.onclick = () => {
      callbacks.onUndo();
      resetValues();
    };
  }

  if (btnOk) {
    btnOk.onclick = () => {
      const data = getTransformData();
      if (data) callbacks.onSave(data);
    };
  }

  if (btnCancel) {
    btnCancel.onclick = () => callbacks.onCancel();
  }

  return {
    destroy: () => {},
  };
}
