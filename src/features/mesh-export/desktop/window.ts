import { setupKeyboardShortcuts, setupThemeListener } from '../../../shared/window-utils.js';
import {
  createMeshExportHTML,
  initMeshExportComponent,
  DEFAULT_MESH_EXPORT_OPTIONS,
  type MeshExportInit,
  type MeshExportKind,
} from '../shared/component.js';
import { normalizeItemFilter, type ObjOrientation } from '../../../shared/obj-transform.js';

const params = new URLSearchParams(window.location.search);
let selectedItems: string[] = [];
try {
  selectedItems = JSON.parse(params.get('selection') || '[]') as string[];
} catch {
  selectedItems = [];
}
const init: MeshExportInit = {
  kind: (params.get('kind') as MeshExportKind) === 'glb' ? 'glb' : 'obj',
  options: {
    unit: params.get('unit') || DEFAULT_MESH_EXPORT_OPTIONS.unit,
    orientation: (params.get('orientation') as ObjOrientation) || DEFAULT_MESH_EXPORT_OPTIONS.orientation,
    itemFilter: normalizeItemFilter(params.get('itemFilter')),
    skipEditorHiddenItems: params.get('skipHidden') === '1',
  },
  selectedItems,
};

const root = document.getElementById('mesh-export-root') as HTMLElement;
root.innerHTML = createMeshExportHTML(init);

initMeshExportComponent(root, {
  onExport: options => window.vpxEditor.meshExportResult(options),
  onCancel: () => window.vpxEditor.meshExportResult(null),
});

setupThemeListener();
setupKeyboardShortcuts({
  onEscape: () => window.vpxEditor.meshExportResult(null),
  onEnter: () => (document.getElementById('mesh-export-ok') as HTMLButtonElement).click(),
});
