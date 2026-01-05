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
} from '../../shared/constants.js';
import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';
import type { EditorSettings } from '../../types/ipc.js';

let originalTheme: string = DEFAULT_THEME;

const drawDragpoints = document.getElementById('settings-draw-dragpoints') as HTMLInputElement;
const drawLightcenters = document.getElementById('settings-draw-lightcenters') as HTMLInputElement;
const colorMaterial = document.getElementById('settings-color-material') as HTMLInputElement;
const colorSelect = document.getElementById('settings-color-select') as HTMLInputElement;
const colorSelectLocked = document.getElementById('settings-color-select-locked') as HTMLInputElement;
const colorFill = document.getElementById('settings-color-fill') as HTMLInputElement;
const colorBackground = document.getElementById('settings-color-background') as HTMLInputElement;
const gridSizeInput = document.getElementById('settings-grid-size') as HTMLInputElement;
const defaultColorsBtn = document.getElementById('settings-default-colors') as HTMLButtonElement;
const themeSelect = document.getElementById('settings-theme') as HTMLSelectElement;
const textureQualitySelect = document.getElementById('settings-texture-quality') as HTMLSelectElement;
const vpinballPathInput = document.getElementById('settings-vpinball-path') as HTMLInputElement;
const vpxtoolPathInput = document.getElementById('settings-vpxtool-path') as HTMLInputElement;
const vpxtoolOverride = document.getElementById('settings-vpxtool-override') as HTMLInputElement;
const vpxtoolPathRow = document.querySelector('.settings-vpxtool-row') as HTMLElement;
const btnBrowseVpinball = document.getElementById('settings-browse-vpinball') as HTMLButtonElement;
const btnBrowseVpxtool = document.getElementById('settings-browse-vpxtool') as HTMLButtonElement;
const okBtn = document.getElementById('settings-ok') as HTMLButtonElement;
const cancelBtn = document.getElementById('settings-cancel') as HTMLButtonElement;
const unitConversionSelect = document.getElementById('settings-unit-conversion') as HTMLSelectElement;

let vpinballValid: boolean = true;
let vpxtoolValid: boolean = true;
let gridSizeValid: boolean = true;

document.querySelectorAll('.settings-tab').forEach((tab: Element) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach((t: Element) => t.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach((c: Element) => c.classList.remove('active'));
    tab.classList.add('active');
    const tabElement = tab as HTMLElement;
    document.getElementById('tab-' + tabElement.dataset.tab)!.classList.add('active');
  });
});

async function validatePath(input: HTMLInputElement): Promise<boolean> {
  const pathVal = input.value.trim();
  if (!pathVal) {
    input.classList.remove('invalid');
    return true;
  }
  const exists: boolean = await window.vpxEditor.checkFileExists(pathVal);
  input.classList.toggle('invalid', !exists);
  return exists;
}

function validateGridSize(): boolean {
  const val = parseInt(gridSizeInput.value, 10);
  const valid = !isNaN(val) && val >= 5 && val <= 500;
  gridSizeInput.classList.toggle('invalid', !valid);
  gridSizeValid = valid;
  return valid;
}

async function validateAll(): Promise<void> {
  vpinballValid = await validatePath(vpinballPathInput);
  if (vpxtoolOverride.checked) {
    const pathVal = vpxtoolPathInput.value.trim();
    if (!pathVal) {
      vpxtoolPathInput.classList.add('invalid');
      vpxtoolValid = false;
    } else {
      vpxtoolValid = await validatePath(vpxtoolPathInput);
    }
  } else {
    vpxtoolPathInput.classList.remove('invalid');
    vpxtoolValid = true;
  }
  validateGridSize();
  okBtn.disabled = !vpinballValid || !vpxtoolValid || !gridSizeValid;
}

function updateVpxtoolState(): void {
  const override = vpxtoolOverride.checked;
  vpxtoolPathInput.disabled = !override;
  btnBrowseVpxtool.disabled = !override;
  vpxtoolPathRow.classList.toggle('dimmed', !override);
  if (!override && vpxtoolPathInput.classList.contains('invalid')) {
    vpxtoolPathInput.value = '';
    vpxtoolPathInput.classList.remove('invalid');
  }
  validateAll();
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
  gridSizeInput.value = String(settingsData.gridSize || DEFAULT_GRID_SIZE);
  themeSelect.value = settingsData.theme || DEFAULT_THEME;
  textureQualitySelect.value = String(settingsData.textureQuality || DEFAULT_TEXTURE_QUALITY);
  unitConversionSelect.value = String(
    settingsData.unitConversion !== undefined ? settingsData.unitConversion : DEFAULT_UNIT_CONVERSION
  );

  originalTheme = settingsData.theme || DEFAULT_THEME;

  vpinballPathInput.value = settingsData.vpinballPath || '';
  vpxtoolPathInput.value = settingsData.vpxtoolPath || '';
  vpxtoolOverride.checked = !settingsData.useEmbeddedVpxtool;

  updateVpxtoolState();
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

vpxtoolOverride.onchange = updateVpxtoolState;
vpinballPathInput.oninput = validateAll;
vpxtoolPathInput.oninput = validateAll;
gridSizeInput.oninput = validateAll;

btnBrowseVpinball.onclick = async (): Promise<void> => {
  const result: string | null = await window.vpxEditor.browseExecutable('VPinballX');
  if (result) {
    vpinballPathInput.value = result;
    validateAll();
  }
};

btnBrowseVpxtool.onclick = async (): Promise<void> => {
  const result: string | null = await window.vpxEditor.browseExecutable('vpxtool');
  if (result) {
    vpxtoolPathInput.value = result;
    validateAll();
  }
};

okBtn.onclick = async (): Promise<void> => {
  const settings: EditorSettings = {
    gridSize: parseInt(gridSizeInput.value, 10) || 50,
    vpinballPath: vpinballPathInput.value,
    useEmbeddedVpxtool: !vpxtoolOverride.checked,
    vpxtoolPath: vpxtoolPathInput.value,
    theme: themeSelect.value,
    alwaysDrawDragPoints: drawDragpoints.checked,
    drawLightCenters: drawLightcenters.checked,
    textureQuality: parseInt(textureQualitySelect.value, 10),
    unitConversion: parseInt(unitConversionSelect.value, 10),
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
