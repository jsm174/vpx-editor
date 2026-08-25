import { setupKeyboardShortcuts, setupThemeListener } from '../../../shared/window-utils.js';
import {
  createMeshExportHTML,
  initMeshExportComponent,
  DEFAULT_MESH_EXPORT_OPTIONS,
  type MeshExportOptions,
} from '../shared/component.js';
import type { ObjOrientation } from '../../../shared/obj-transform.js';

const params = new URLSearchParams(window.location.search);
const initialOptions: MeshExportOptions = {
  unit: params.get('unit') || DEFAULT_MESH_EXPORT_OPTIONS.unit,
  orientation: (params.get('orientation') as ObjOrientation) || DEFAULT_MESH_EXPORT_OPTIONS.orientation,
};

const root = document.getElementById('mesh-export-root') as HTMLElement;
root.innerHTML = createMeshExportHTML(initialOptions);

initMeshExportComponent(root, {
  onExport: options => window.vpxEditor.meshExportResult(options),
  onCancel: () => window.vpxEditor.meshExportResult(null),
});

setupThemeListener();
setupKeyboardShortcuts({
  onEscape: () => window.vpxEditor.meshExportResult(null),
  onEnter: () => (document.getElementById('mesh-export-ok') as HTMLButtonElement).click(),
});
