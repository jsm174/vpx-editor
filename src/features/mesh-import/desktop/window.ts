import { setupKeyboardShortcuts, setupThemeListener } from '../../../shared/window-utils.js';
import {
  getObjProfileValue,
  optionsForProfile,
  profileFor,
  setObjProfileValue,
} from '../../../shared/obj-exchange-ui.js';
import { parseObjHeaderComment, type ObjOrientation } from '../../../shared/obj-transform.js';
import { createMeshImportHTML, DEFAULT_MESH_IMPORT_EXCHANGE, type MeshImportOptions } from '../shared/component.js';

const params = new URLSearchParams(window.location.search);
const root = document.getElementById('mesh-import-root') as HTMLElement;
root.innerHTML = createMeshImportHTML({
  unit: params.get('unit') || DEFAULT_MESH_IMPORT_EXCHANGE.unit,
  orientation: (params.get('orientation') as ObjOrientation) || DEFAULT_MESH_IMPORT_EXCHANGE.orientation,
});

let selectedFile: string | null = null;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const pathInput = $<HTMLInputElement>('mesh-import-path');
const browseBtn = $<HTMLButtonElement>('mesh-import-browse');
const okBtn = $<HTMLButtonElement>('mesh-import-ok');
const cancelBtn = $<HTMLButtonElement>('mesh-import-cancel');

const centerMeshCheck = $<HTMLInputElement>('mesh-import-center-mesh');
const materialCheck = $<HTMLInputElement>('mesh-import-material');
const absPositionRadio = $<HTMLInputElement>('mesh-import-abs-position');
const detected = $<HTMLElement>('mesh-import-detected');

function collectOptions(): MeshImportOptions {
  return {
    centerMesh: centerMeshCheck.checked,
    importMaterial: materialCheck.checked,
    absolutePosition: absPositionRadio.checked,
    ...optionsForProfile(getObjProfileValue(document, 'mesh-import-profile')),
  };
}

browseBtn.addEventListener('click', async (): Promise<void> => {
  const result = await window.vpxEditor.browseObjFile();
  if (!result) return;

  selectedFile = result;
  pathInput.value = result;
  okBtn.disabled = false;

  const header = await window.vpxEditor.readObjHeader(result);
  const fromHeader = header ? parseObjHeaderComment(header) : null;
  if (fromHeader) {
    setObjProfileValue(document, 'mesh-import-profile', profileFor(fromHeader).value);
    detected.textContent = 'Units and axes detected from the file.';
    detected.classList.remove('hidden');
  } else {
    detected.classList.add('hidden');
  }
});

okBtn.addEventListener('click', (): void => {
  if (!selectedFile) return;
  window.vpxEditor.meshImportResult({ meshData: selectedFile, options: collectOptions() });
});

cancelBtn.addEventListener('click', (): void => {
  window.vpxEditor.meshImportResult(null);
});

setupThemeListener();
setupKeyboardShortcuts({
  onEscape: () => window.vpxEditor.meshImportResult(null),
  onEnter: () => {
    if (!okBtn.disabled) okBtn.click();
  },
});
