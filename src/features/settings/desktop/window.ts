import {
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_TABLE_BACKGROUND_COLOR,
  DEFAULT_THEME,
  DEFAULT_GRID_SIZE,
  DEFAULT_TEXTURE_QUALITY,
  DEFAULT_UNIT_CONVERSION,
  UNIT_CONVERSION_INCHES,
  UNIT_CONVERSION_MM,
  UNIT_CONVERSION_VPU,
} from '../../../shared/constants.js';
import { vpUnitsToUnit, unitToVpUnits, getUnitLabelFor } from '../../../shared/unit-conversion.js';
import { setupThemeListener, setupKeyboardShortcuts } from '../../../shared/window-utils.js';
import type { EditorSettings } from '../../../types/ipc.js';

const GRID_SIZE_MIN_VPU = 5;
const GRID_SIZE_MAX_VPU = 500;

function getGridUnitDisplay(unit: string): { step: number; decimals: number } {
  switch (unit) {
    case UNIT_CONVERSION_INCHES:
      return { step: 0.1, decimals: 3 };
    case UNIT_CONVERSION_MM:
      return { step: 1, decimals: 2 };
    default:
      return { step: 1, decimals: 2 };
  }
}

let originalTheme: string = DEFAULT_THEME;

const drawDragpoints = document.getElementById('settings-draw-dragpoints') as HTMLInputElement;
const drawLightcenters = document.getElementById('settings-draw-lightcenters') as HTMLInputElement;
const colorMaterial = document.getElementById('settings-color-material') as HTMLInputElement;
const colorSelect = document.getElementById('settings-color-select') as HTMLInputElement;
const colorSelectLocked = document.getElementById('settings-color-select-locked') as HTMLInputElement;
const colorFill = document.getElementById('settings-color-fill') as HTMLInputElement;
const colorBackground = document.getElementById('settings-color-background') as HTMLInputElement;
const gridSizeInput = document.getElementById('settings-grid-size') as HTMLInputElement;
const gridSizeSuffix = document.getElementById('settings-grid-size-suffix') as HTMLElement;
const defaultColorsBtn = document.getElementById('settings-default-colors') as HTMLButtonElement;
const themeSelect = document.getElementById('settings-theme') as HTMLSelectElement;
const textureQualitySelect = document.getElementById('settings-texture-quality') as HTMLSelectElement;
const vpinballPathInput = document.getElementById('settings-vpinball-path') as HTMLInputElement;
const vpinballError = document.getElementById('settings-vpinball-error') as HTMLElement;
const btnBrowseVpinball = document.getElementById('settings-browse-vpinball') as HTMLButtonElement;
const okBtn = document.getElementById('settings-ok') as HTMLButtonElement;
const cancelBtn = document.getElementById('settings-cancel') as HTMLButtonElement;
const unitConversionSelect = document.getElementById('settings-unit-conversion') as HTMLSelectElement;

let vpinballValid: boolean = true;
let gridSizeValid: boolean = true;
let gridSizeVpu: number = DEFAULT_GRID_SIZE;

function applyGridUnit(unit: string): void {
  const { step, decimals } = getGridUnitDisplay(unit);
  gridSizeInput.step = String(step);
  gridSizeInput.min = vpUnitsToUnit(GRID_SIZE_MIN_VPU, unit).toFixed(decimals);
  gridSizeInput.max = vpUnitsToUnit(GRID_SIZE_MAX_VPU, unit).toFixed(decimals);
  gridSizeInput.value = vpUnitsToUnit(gridSizeVpu, unit).toFixed(decimals);
  gridSizeSuffix.textContent = unit === UNIT_CONVERSION_VPU ? '' : `(${getUnitLabelFor(unit)})`;
}

async function validatePath(input: HTMLInputElement): Promise<boolean> {
  const pathVal = input.value.trim();
  if (!pathVal) {
    input.classList.remove('invalid');
    vpinballError.textContent = '';
    return true;
  }
  const result = await window.vpxEditor.checkFileExists(pathVal);
  input.classList.toggle('invalid', !result.valid);
  vpinballError.textContent = result.valid ? '' : result.error || 'Invalid path';
  return result.valid;
}

function readGridSizeFromInput(): void {
  const unit = unitConversionSelect.value || DEFAULT_UNIT_CONVERSION;
  const displayed = parseFloat(gridSizeInput.value);
  if (!isNaN(displayed)) {
    gridSizeVpu = unitToVpUnits(displayed, unit);
  }
}

function validateGridSizeRange(): boolean {
  const displayed = parseFloat(gridSizeInput.value);
  const valid = !isNaN(displayed) && gridSizeVpu >= GRID_SIZE_MIN_VPU && gridSizeVpu <= GRID_SIZE_MAX_VPU;
  gridSizeInput.classList.toggle('invalid', !valid);
  gridSizeValid = valid;
  return valid;
}

async function validateAll(): Promise<void> {
  vpinballValid = await validatePath(vpinballPathInput);
  validateGridSizeRange();
  okBtn.disabled = !vpinballValid || !gridSizeValid;
}

window.vpxEditor.onInitSettings?.(data => {
  const settingsData = data as EditorSettings;
  const editorColors = settingsData.editorColors || {};
  drawDragpoints.checked = settingsData.alwaysDrawDragPoints || false;
  drawLightcenters.checked = settingsData.drawLightCenters || false;
  colorMaterial.value = editorColors.defaultMaterial || DEFAULT_MATERIAL_COLOR;
  colorSelect.value = editorColors.elementSelect || DEFAULT_ELEMENT_SELECT_COLOR;
  colorSelectLocked.value = editorColors.elementSelectLocked || DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
  colorFill.value = editorColors.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
  colorBackground.value = editorColors.tableBackground || DEFAULT_TABLE_BACKGROUND_COLOR;
  gridSizeVpu = settingsData.gridSize || DEFAULT_GRID_SIZE;
  themeSelect.value = settingsData.theme || DEFAULT_THEME;
  textureQualitySelect.value = String(settingsData.textureQuality || DEFAULT_TEXTURE_QUALITY);
  unitConversionSelect.value = settingsData.unitConversion || DEFAULT_UNIT_CONVERSION;
  applyGridUnit(unitConversionSelect.value);

  originalTheme = settingsData.theme || DEFAULT_THEME;

  vpinballPathInput.value = settingsData.vpinballPath || '';
});

setupThemeListener();

themeSelect.onchange = (): void => {
  document.documentElement.setAttribute('data-theme', themeSelect.value);
  window.vpxEditor.previewTheme(themeSelect.value);
};

defaultColorsBtn.onclick = (): void => {
  colorMaterial.value = DEFAULT_MATERIAL_COLOR;
  colorSelect.value = DEFAULT_ELEMENT_SELECT_COLOR;
  colorSelectLocked.value = DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
  colorFill.value = DEFAULT_ELEMENT_FILL_COLOR;
  colorBackground.value = DEFAULT_TABLE_BACKGROUND_COLOR;
};

(document.getElementById('settings-reset-windows') as HTMLButtonElement).onclick = (): void => {
  window.vpxEditor.resetWindowBounds();
};

vpinballPathInput.oninput = validateAll;
gridSizeInput.oninput = (): void => {
  readGridSizeFromInput();
  validateAll();
};

unitConversionSelect.onchange = (): void => {
  applyGridUnit(unitConversionSelect.value);
  validateGridSizeRange();
};

btnBrowseVpinball.onclick = async (): Promise<void> => {
  const result: string | null = await window.vpxEditor.browseExecutable('VPinballX');
  if (result) {
    vpinballPathInput.value = result;
    validateAll();
  }
};

okBtn.onclick = async (): Promise<void> => {
  readGridSizeFromInput();
  const settings: EditorSettings = {
    gridSize: gridSizeVpu,
    vpinballPath: vpinballPathInput.value,
    theme: themeSelect.value,
    alwaysDrawDragPoints: drawDragpoints.checked,
    drawLightCenters: drawLightcenters.checked,
    textureQuality: parseInt(textureQualitySelect.value, 10),
    unitConversion: unitConversionSelect.value,
    editorColors: {
      defaultMaterial: colorMaterial.value,
      elementSelect: colorSelect.value,
      elementSelectLocked: colorSelectLocked.value,
      elementFill: colorFill.value,
      tableBackground: colorBackground.value,
    },
  };
  await window.vpxEditor.saveSettings(settings);
  window.close();
};

cancelBtn.onclick = (): void => {
  window.vpxEditor.restoreTheme?.(originalTheme);
  window.close();
};

setupKeyboardShortcuts({
  onEscape: (): void => {
    window.vpxEditor.restoreTheme?.(originalTheme);
    window.close();
  },
});
