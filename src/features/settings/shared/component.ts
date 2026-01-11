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
} from '../../../shared/constants.js';
import type { EditorSettings } from '../../../types/ipc.js';

export interface SettingsCallbacks {
  onSave: (settings: EditorSettings) => void;
  onCancel: () => void;
  onThemePreview?: (theme: string) => void;
  onBrowseVpinball?: () => Promise<string | null>;
  onResetWindows?: () => void;
  checkFileExists?: (path: string) => Promise<{ valid: boolean; error?: string }>;
}

export interface SettingsOptions {
  showPathsTab?: boolean;
  showResetWindows?: boolean;
}

export function createSettingsHTML(options: SettingsOptions = {}): string {
  const showPaths = options.showPathsTab !== false;
  const showReset = options.showResetWindows !== false;

  return `
    <div class="settings-container">
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="editor">Editor</button>
        ${showPaths ? '<button class="settings-tab" data-tab="paths">Paths</button>' : ''}
      </div>

      <div class="settings-body">
        <div class="settings-tab-content active" id="tab-editor">
          <div class="settings-section">
            <div class="settings-field-row">
              <label>Theme</label>
              <select id="settings-theme" class="win-select">
                <option value="system">System</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div class="settings-field-row">
              <label>3D Texture Quality</label>
              <select id="settings-texture-quality" class="win-select">
                <option value="512">512</option>
                <option value="1024">1K</option>
                <option value="2048">2K</option>
                <option value="3072">3K</option>
                <option value="4096">4K</option>
                <option value="0">Full</option>
              </select>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-checkbox-row">
              <input type="checkbox" id="settings-draw-dragpoints">
              <label for="settings-draw-dragpoints">Always draw control points of table elements</label>
            </div>
            <div class="settings-checkbox-row">
              <input type="checkbox" id="settings-draw-lightcenters">
              <label for="settings-draw-lightcenters">Draw center cross for lights</label>
            </div>
            <div class="settings-color-grid">
              <div class="settings-color-row">
                <label>Default Material color</label>
                <input type="color" id="settings-color-material" class="settings-color-input">
              </div>
              <div class="settings-color-row">
                <label>Element Select color</label>
                <input type="color" id="settings-color-select" class="settings-color-input">
              </div>
              <div class="settings-color-row">
                <label>Element Select color (locked)</label>
                <input type="color" id="settings-color-select-locked" class="settings-color-input">
              </div>
              <div class="settings-color-row">
                <label>Element Fill color</label>
                <input type="color" id="settings-color-fill" class="settings-color-input">
              </div>
              <div class="settings-color-row">
                <label>Table background</label>
                <input type="color" id="settings-color-background" class="settings-color-input">
              </div>
            </div>
            <div class="settings-field-row">
              <button class="win-btn" id="settings-default-colors">Default colors</button>
            </div>
            <div class="settings-field-row">
              <label>Grid size</label>
              <input type="number" id="settings-grid-size" class="win-input settings-number-input" min="5" max="500" step="5">
            </div>
            <div class="settings-field-row">
              <label>Convert VP units to</label>
              <select id="settings-unit-conversion" class="win-select">
                <option value="inches">Inches</option>
                <option value="mm">Millimeters</option>
                <option value="vpu">VPUnits</option>
              </select>
            </div>
            ${showReset ? '<div class="settings-field-row"><button class="win-btn" id="settings-reset-windows">Reset Window Positions</button></div>' : ''}
          </div>
        </div>

        ${
          showPaths
            ? `
        <div class="settings-tab-content" id="tab-paths">
          <div class="settings-section">
            <div class="settings-section-title">Visual Pinball Path <span class="version-hint">(v10.8.1+)</span></div>
            <div class="settings-field-row">
              <input type="text" id="settings-vpinball-path" class="win-input">
              <button class="win-btn" id="settings-browse-vpinball">Browse...</button>
            </div>
            <div id="settings-vpinball-error" class="settings-error"></div>
          </div>
        </div>
        `
            : ''
        }
      </div>

      <div class="settings-footer">
        <button class="win-btn" id="settings-cancel">Cancel</button>
        <button class="win-btn primary" id="settings-ok">OK</button>
      </div>
    </div>
  `;
}

export function initSettingsComponent(
  container: HTMLElement,
  settings: EditorSettings,
  callbacks: SettingsCallbacks,
  options: SettingsOptions = {}
): { destroy: () => void } {
  const $ = <T extends HTMLElement>(id: string): T | null => container.querySelector(`#${id}`);

  const drawDragpoints = $<HTMLInputElement>('settings-draw-dragpoints');
  const drawLightcenters = $<HTMLInputElement>('settings-draw-lightcenters');
  const colorMaterial = $<HTMLInputElement>('settings-color-material');
  const colorSelect = $<HTMLInputElement>('settings-color-select');
  const colorSelectLocked = $<HTMLInputElement>('settings-color-select-locked');
  const colorFill = $<HTMLInputElement>('settings-color-fill');
  const colorBackground = $<HTMLInputElement>('settings-color-background');
  const gridSizeInput = $<HTMLInputElement>('settings-grid-size');
  const defaultColorsBtn = $<HTMLButtonElement>('settings-default-colors');
  const themeSelect = $<HTMLSelectElement>('settings-theme');
  const textureQualitySelect = $<HTMLSelectElement>('settings-texture-quality');
  const unitConversionSelect = $<HTMLSelectElement>('settings-unit-conversion');
  const okBtn = $<HTMLButtonElement>('settings-ok');
  const cancelBtn = $<HTMLButtonElement>('settings-cancel');
  const resetWindowsBtn = $<HTMLButtonElement>('settings-reset-windows');

  const vpinballPathInput = $<HTMLInputElement>('settings-vpinball-path');
  const vpinballError = $<HTMLElement>('settings-vpinball-error');
  const btnBrowseVpinball = $<HTMLButtonElement>('settings-browse-vpinball');

  const originalTheme = settings.theme || DEFAULT_THEME;
  let vpinballValid = true;
  let gridSizeValid = true;

  const editorColors = settings.editorColors || {};
  if (drawDragpoints) drawDragpoints.checked = settings.alwaysDrawDragPoints || false;
  if (drawLightcenters) drawLightcenters.checked = settings.drawLightCenters || false;
  if (colorMaterial) colorMaterial.value = editorColors.defaultMaterial || DEFAULT_MATERIAL_COLOR;
  if (colorSelect) colorSelect.value = editorColors.elementSelect || DEFAULT_ELEMENT_SELECT_COLOR;
  if (colorSelectLocked)
    colorSelectLocked.value = editorColors.elementSelectLocked || DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
  if (colorFill) colorFill.value = editorColors.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
  if (colorBackground) colorBackground.value = editorColors.tableBackground || DEFAULT_TABLE_BACKGROUND_COLOR;
  if (gridSizeInput) gridSizeInput.value = String(settings.gridSize || DEFAULT_GRID_SIZE);
  if (themeSelect) themeSelect.value = settings.theme || DEFAULT_THEME;
  if (textureQualitySelect) textureQualitySelect.value = String(settings.textureQuality || DEFAULT_TEXTURE_QUALITY);
  if (unitConversionSelect) unitConversionSelect.value = settings.unitConversion || DEFAULT_UNIT_CONVERSION;
  if (vpinballPathInput) vpinballPathInput.value = settings.vpinballPath || '';

  container.querySelectorAll('.settings-tab').forEach((tab: Element) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.settings-tab').forEach((t: Element) => t.classList.remove('active'));
      container.querySelectorAll('.settings-tab-content').forEach((c: Element) => c.classList.remove('active'));
      tab.classList.add('active');
      const tabId = (tab as HTMLElement).dataset.tab;
      container.querySelector(`#tab-${tabId}`)?.classList.add('active');
    });
  });

  async function validatePath(input: HTMLInputElement | null): Promise<boolean> {
    if (!input || !callbacks.checkFileExists) return true;
    const pathVal = input.value.trim();
    if (!pathVal) {
      input.classList.remove('invalid');
      if (vpinballError) vpinballError.textContent = '';
      return true;
    }
    const result = await callbacks.checkFileExists(pathVal);
    input.classList.toggle('invalid', !result.valid);
    if (vpinballError) vpinballError.textContent = result.valid ? '' : result.error || 'Invalid path';
    return result.valid;
  }

  function validateGridSize(): boolean {
    if (!gridSizeInput) return true;
    const val = parseInt(gridSizeInput.value, 10);
    const valid = !isNaN(val) && val >= 5 && val <= 500;
    gridSizeInput.classList.toggle('invalid', !valid);
    gridSizeValid = valid;
    return valid;
  }

  async function validateAll(): Promise<void> {
    if (options.showPathsTab !== false) {
      vpinballValid = await validatePath(vpinballPathInput);
    }
    validateGridSize();
    if (okBtn) okBtn.disabled = !vpinballValid || !gridSizeValid;
  }

  if (themeSelect) {
    themeSelect.onchange = () => {
      callbacks.onThemePreview?.(themeSelect.value);
    };
  }

  if (defaultColorsBtn) {
    defaultColorsBtn.onclick = () => {
      if (colorMaterial) colorMaterial.value = DEFAULT_MATERIAL_COLOR;
      if (colorSelect) colorSelect.value = DEFAULT_ELEMENT_SELECT_COLOR;
      if (colorSelectLocked) colorSelectLocked.value = DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
      if (colorFill) colorFill.value = DEFAULT_ELEMENT_FILL_COLOR;
      if (colorBackground) colorBackground.value = DEFAULT_TABLE_BACKGROUND_COLOR;
    };
  }

  if (resetWindowsBtn && callbacks.onResetWindows) {
    resetWindowsBtn.onclick = callbacks.onResetWindows;
  }

  if (vpinballPathInput) vpinballPathInput.oninput = () => validateAll();
  if (gridSizeInput) gridSizeInput.oninput = () => validateAll();

  if (btnBrowseVpinball && callbacks.onBrowseVpinball) {
    btnBrowseVpinball.onclick = async () => {
      const result = await callbacks.onBrowseVpinball!();
      if (result && vpinballPathInput) {
        vpinballPathInput.value = result;
        validateAll();
      }
    };
  }

  if (okBtn) {
    okBtn.onclick = () => {
      const newSettings: EditorSettings = {
        gridSize: gridSizeInput ? parseInt(gridSizeInput.value, 10) || DEFAULT_GRID_SIZE : DEFAULT_GRID_SIZE,
        theme: themeSelect?.value || DEFAULT_THEME,
        alwaysDrawDragPoints: drawDragpoints?.checked || false,
        drawLightCenters: drawLightcenters?.checked || false,
        textureQuality: textureQualitySelect ? parseInt(textureQualitySelect.value, 10) : DEFAULT_TEXTURE_QUALITY,
        unitConversion: unitConversionSelect?.value || DEFAULT_UNIT_CONVERSION,
        editorColors: {
          defaultMaterial: colorMaterial?.value || DEFAULT_MATERIAL_COLOR,
          elementSelect: colorSelect?.value || DEFAULT_ELEMENT_SELECT_COLOR,
          elementSelectLocked: colorSelectLocked?.value || DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
          elementFill: colorFill?.value || DEFAULT_ELEMENT_FILL_COLOR,
          tableBackground: colorBackground?.value || DEFAULT_TABLE_BACKGROUND_COLOR,
        },
        vpinballPath: vpinballPathInput?.value || '',
      };
      callbacks.onSave(newSettings);
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      callbacks.onThemePreview?.(originalTheme);
      callbacks.onCancel();
    };
  }

  return {
    destroy: () => {
      // Cleanup if needed
    },
  };
}
