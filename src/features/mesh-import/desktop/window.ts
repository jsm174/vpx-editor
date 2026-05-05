import type { MeshImportOptions } from '../shared/component';

let selectedFile: string | null = null;

const pathInput = document.getElementById('mesh-import-path') as HTMLInputElement;
const browseBtn = document.getElementById('mesh-import-browse') as HTMLButtonElement;
const okBtn = document.getElementById('mesh-import-ok') as HTMLButtonElement;
const cancelBtn = document.getElementById('mesh-import-cancel') as HTMLButtonElement;

const convertCoordsCheck = document.getElementById('mesh-import-convert-coords') as HTMLInputElement;
const centerMeshCheck = document.getElementById('mesh-import-center-mesh') as HTMLInputElement;
const materialCheck = document.getElementById('mesh-import-material') as HTMLInputElement;
const absPositionRadio = document.getElementById('mesh-import-abs-position') as HTMLInputElement;

function collectOptions(): MeshImportOptions {
  return {
    convertCoords: convertCoordsCheck.checked,
    centerMesh: centerMeshCheck.checked,
    importMaterial: materialCheck.checked,
    absolutePosition: absPositionRadio.checked,
  };
}

browseBtn.addEventListener('click', async (): Promise<void> => {
  const result = await window.vpxEditor.browseObjFile();
  if (result) {
    selectedFile = result;
    pathInput.value = result;
    okBtn.disabled = false;
  }
});

okBtn.addEventListener('click', (): void => {
  if (!selectedFile) return;
  window.vpxEditor.meshImportResult({ meshData: selectedFile, options: collectOptions() });
});

cancelBtn.addEventListener('click', (): void => {
  window.vpxEditor.meshImportResult(null);
});

document.addEventListener('keydown', (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    window.vpxEditor.meshImportResult(null);
  } else if (e.key === 'Enter' && !okBtn.disabled) {
    okBtn.click();
  }
});
