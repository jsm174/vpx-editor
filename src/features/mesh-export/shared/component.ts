import type { ObjExchangeOptions } from '../../../shared/obj-transform.js';
import {
  DEFAULT_OBJ_EXCHANGE,
  getObjProfileValue,
  objProfileRadiosHtml,
  optionsForProfile,
} from '../../../shared/obj-exchange-ui.js';

export type MeshExportOptions = ObjExchangeOptions;

export const DEFAULT_MESH_EXPORT_OPTIONS: MeshExportOptions = DEFAULT_OBJ_EXCHANGE;

export interface MeshExportCallbacks {
  onExport: (options: MeshExportOptions) => void;
  onCancel: () => void;
}

export function createMeshExportHTML(options: MeshExportOptions = DEFAULT_MESH_EXPORT_OPTIONS): string {
  return `
    <div class="mesh-export-container">
      <fieldset class="mesh-export-options">
        <legend>Units and axes</legend>
        ${objProfileRadiosHtml('mesh-export-profile', options)}
      </fieldset>

      <div class="mesh-export-footer">
        <button class="win-btn" id="mesh-export-cancel">Cancel</button>
        <button class="win-btn primary" id="mesh-export-ok">Export</button>
      </div>
    </div>
  `;
}

export function initMeshExportComponent(
  container: HTMLElement,
  callbacks: MeshExportCallbacks
): { destroy: () => void } {
  const okBtn = container.querySelector('#mesh-export-ok') as HTMLButtonElement;
  const cancelBtn = container.querySelector('#mesh-export-cancel') as HTMLButtonElement;

  const handleExport = (): void =>
    callbacks.onExport(optionsForProfile(getObjProfileValue(container, 'mesh-export-profile')));
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
