import {
  DEFAULT_TABLE_EXPORT_FILTER,
  normalizeItemFilter,
  type ObjExchangeOptions,
  type TableExportFilter,
} from '../../../shared/obj-transform.js';
import {
  DEFAULT_OBJ_EXCHANGE,
  getObjProfileValue,
  objProfileRadiosHtml,
  optionsForProfile,
} from '../../../shared/obj-exchange-ui.js';

export type MeshExportKind = 'obj' | 'glb';

export type MeshExportOptions = ObjExchangeOptions & TableExportFilter;

export interface MeshExportInit {
  kind: MeshExportKind;
  options: MeshExportOptions;
  selectedItems: string[];
}

export const DEFAULT_MESH_EXPORT_OPTIONS: MeshExportOptions = {
  ...DEFAULT_OBJ_EXCHANGE,
  ...DEFAULT_TABLE_EXPORT_FILTER,
};

export const MESH_EXPORT_TITLES: Record<MeshExportKind, string> = {
  obj: 'Wavefront OBJ Exporter',
  glb: 'GLB Exporter',
};

export interface MeshExportCallbacks {
  onExport: (options: MeshExportOptions) => void;
  onCancel: () => void;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function createMeshExportHTML(init: MeshExportInit): string {
  const { kind, options, selectedItems } = init;
  const count = selectedItems.length;
  const selectionLabel = count > 0 ? `Selected items only (${count})` : 'Selected items only (nothing selected)';
  const unitsFieldset =
    kind === 'obj'
      ? `<fieldset class="mesh-export-options">
        <legend>Units and axes</legend>
        ${objProfileRadiosHtml('mesh-export-profile', options)}
      </fieldset>`
      : `<p class="mesh-export-note">GLB files use glTF conventions: meters, Y up, right handed.</p>`;
  const filter = normalizeItemFilter(options.itemFilter);
  return `
    <div class="mesh-export-container" data-kind="${kind}">
      ${unitsFieldset}
      <fieldset class="mesh-export-options">
        <legend>Items</legend>
        <div class="obj-profile-radios">
          <label class="obj-profile-radio">
            <input type="radio" name="mesh-export-items" value="everything"${filter === 'everything' ? ' checked' : ''}>
            <span class="obj-profile-radio-text">
              <span class="obj-profile-radio-label">Everything with geometry</span>
              <span class="obj-profile-radio-hint">Skips only items that are invisible at play time.</span>
            </span>
          </label>
          <label class="obj-profile-radio">
            <input type="radio" name="mesh-export-items" value="vpinball"${filter === 'vpinball' ? ' checked' : ''}>
            <span class="obj-profile-radio-text">
              <span class="obj-profile-radio-label">Match Visual Pinball's OBJ export</span>
              <span class="obj-profile-radio-hint">No lights, flashers, decals, plungers or balls.</span>
            </span>
          </label>
        </div>
        <div class="mesh-export-checks">
          <label class="mesh-export-check">
            <input type="checkbox" id="mesh-export-skip-hidden"${options.skipEditorHiddenItems ? ' checked' : ''}>
            <span>Skip items on hidden layers</span>
          </label>
          <label class="mesh-export-check">
            <input type="checkbox" id="mesh-export-selection-only"${count === 0 ? ' disabled' : ''} data-items="${escapeAttr(JSON.stringify(selectedItems))}">
            <span>${selectionLabel}</span>
          </label>
        </div>
      </fieldset>

      <div class="mesh-export-footer">
        <button class="win-btn" id="mesh-export-cancel">Cancel</button>
        <button class="win-btn primary" id="mesh-export-ok">Export</button>
      </div>
    </div>
  `;
}

export function readMeshExportOptions(container: ParentNode): MeshExportOptions {
  const root = container.querySelector('.mesh-export-container') as HTMLElement | null;
  const kind = (root?.dataset.kind as MeshExportKind | undefined) ?? 'obj';
  const exchange =
    kind === 'obj' ? optionsForProfile(getObjProfileValue(container, 'mesh-export-profile')) : DEFAULT_OBJ_EXCHANGE;
  const filterInput = container.querySelector('input[name="mesh-export-items"]:checked') as HTMLInputElement | null;
  const skipHidden = container.querySelector('#mesh-export-skip-hidden') as HTMLInputElement | null;
  const selectionOnly = container.querySelector('#mesh-export-selection-only') as HTMLInputElement | null;
  const options: MeshExportOptions = {
    ...exchange,
    itemFilter: normalizeItemFilter(filterInput?.value),
    skipEditorHiddenItems: skipHidden?.checked === true,
  };
  if (selectionOnly?.checked && !selectionOnly.disabled) {
    try {
      const items = JSON.parse(selectionOnly.dataset.items || '[]') as string[];
      if (items.length > 0) options.onlyItems = items;
    } catch {
      /* ignore malformed selection */
    }
  }
  return options;
}

export function initMeshExportComponent(
  container: HTMLElement,
  callbacks: MeshExportCallbacks
): { destroy: () => void } {
  const okBtn = container.querySelector('#mesh-export-ok') as HTMLButtonElement;
  const cancelBtn = container.querySelector('#mesh-export-cancel') as HTMLButtonElement;

  const handleExport = (): void => callbacks.onExport(readMeshExportOptions(container));
  const handleCancel = (): void => callbacks.onCancel();

  okBtn.addEventListener('click', handleExport);
  cancelBtn.addEventListener('click', handleCancel);

  return {
    destroy: () => {
      okBtn.removeEventListener('click', handleExport);
      cancelBtn.removeEventListener('click', handleCancel);
    },
  };
}
