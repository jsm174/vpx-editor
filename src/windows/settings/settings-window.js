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

let originalTheme = DEFAULT_THEME;

const drawDragpoints = document.getElementById('settings-draw-dragpoints');
const drawLightcenters = document.getElementById('settings-draw-lightcenters');
const colorMaterial = document.getElementById('settings-color-material');
const colorSelect = document.getElementById('settings-color-select');
const colorSelectLocked = document.getElementById('settings-color-select-locked');
const colorFill = document.getElementById('settings-color-fill');
const colorBackground = document.getElementById('settings-color-background');
const gridSizeInput = document.getElementById('settings-grid-size');
const defaultColorsBtn = document.getElementById('settings-default-colors');
const themeSelect = document.getElementById('settings-theme');
const textureQualitySelect = document.getElementById('settings-texture-quality');
const vpinballPathInput = document.getElementById('settings-vpinball-path');
const vpxtoolPathInput = document.getElementById('settings-vpxtool-path');
const vpxtoolOverride = document.getElementById('settings-vpxtool-override');
const vpxtoolPathRow = document.querySelector('.settings-vpxtool-row');
const btnBrowseVpinball = document.getElementById('settings-browse-vpinball');
const btnBrowseVpxtool = document.getElementById('settings-browse-vpxtool');
const okBtn = document.getElementById('settings-ok');
const cancelBtn = document.getElementById('settings-cancel');
const unitConversionSelect = document.getElementById('settings-unit-conversion');

let vpinballValid = true;
let vpxtoolValid = true;
let gridSizeValid = true;

document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

async function validatePath(input) {
  const pathVal = input.value.trim();
  if (!pathVal) {
    input.classList.remove('invalid');
    return true;
  }
  const exists = await window.vpxEditor.checkFileExists(pathVal);
  input.classList.toggle('invalid', !exists);
  return exists;
}

function validateGridSize() {
  const val = parseInt(gridSizeInput.value, 10);
  const valid = !isNaN(val) && val >= 5 && val <= 500;
  gridSizeInput.classList.toggle('invalid', !valid);
  gridSizeValid = valid;
  return valid;
}

async function validateAll() {
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

function updateVpxtoolState() {
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
  const editorColors = data.editorColors || {};
  drawDragpoints.checked = data.alwaysDrawDragPoints || false;
  drawLightcenters.checked = data.drawLightCenters || false;
  colorMaterial.value = editorColors.defaultMaterial || DEFAULT_MATERIAL_COLOR;
  colorSelect.value = editorColors.elementSelect || DEFAULT_ELEMENT_SELECT_COLOR;
  colorSelectLocked.value = editorColors.elementSelectLocked || DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
  colorFill.value = editorColors.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
  colorBackground.value = editorColors.tableBackground || DEFAULT_TABLE_BACKGROUND_COLOR;
  gridSizeInput.value = data.gridSize || DEFAULT_GRID_SIZE;
  themeSelect.value = data.theme || DEFAULT_THEME;
  textureQualitySelect.value = data.textureQuality || DEFAULT_TEXTURE_QUALITY;
  unitConversionSelect.value = data.unitConversion !== undefined ? data.unitConversion : DEFAULT_UNIT_CONVERSION;

  originalTheme = data.theme || DEFAULT_THEME;

  vpinballPathInput.value = data.vpinballPath || '';
  vpxtoolPathInput.value = data.vpxtoolPath || '';
  vpxtoolOverride.checked = !data.useEmbeddedVpxtool;

  updateVpxtoolState();
});

setupThemeListener();

themeSelect.onchange = () => {
  document.documentElement.setAttribute('data-theme', themeSelect.value);
  window.vpxEditor.previewTheme(themeSelect.value);
};

defaultColorsBtn.onclick = () => {
  colorMaterial.value = DEFAULT_MATERIAL_COLOR;
  colorSelect.value = DEFAULT_ELEMENT_SELECT_COLOR;
  colorSelectLocked.value = DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
  colorFill.value = DEFAULT_ELEMENT_FILL_COLOR;
  colorBackground.value = DEFAULT_TABLE_BACKGROUND_COLOR;
};

document.getElementById('settings-reset-windows').onclick = () => {
  window.vpxEditor.resetWindowBounds();
};

vpxtoolOverride.onchange = updateVpxtoolState;
vpinballPathInput.oninput = validateAll;
vpxtoolPathInput.oninput = validateAll;
gridSizeInput.oninput = validateAll;

btnBrowseVpinball.onclick = async () => {
  const result = await window.vpxEditor.browseExecutable('VPinballX');
  if (result) {
    vpinballPathInput.value = result;
    validateAll();
  }
};

btnBrowseVpxtool.onclick = async () => {
  const result = await window.vpxEditor.browseExecutable('vpxtool');
  if (result) {
    vpxtoolPathInput.value = result;
    validateAll();
  }
};

okBtn.onclick = async () => {
  await window.vpxEditor.saveSettings({
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
  });
  window.close();
};

cancelBtn.onclick = () => {
  window.vpxEditor.restoreTheme?.(originalTheme);
  window.close();
};

setupKeyboardShortcuts({
  onEscape: () => {
    window.vpxEditor.restoreTheme?.(originalTheme);
    window.close();
  },
});
