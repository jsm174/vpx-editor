import { setupThemeListener, setupKeyboardShortcuts } from '../../../shared/window-utils.js';

interface MaterialEditorData {
  material: Record<string, unknown>;
  mode: 'new' | 'clone';
  existingNames: string[];
  originalName: string;
}

let existingNames: string[] = [];
let originalName: string = '';
let mode: 'new' | 'clone' = 'new';

setupThemeListener();

window.vpxEditor.onInitMaterialEditor?.((data: MaterialEditorData) => {
  const mat = data.material;
  existingNames = data.existingNames;
  originalName = data.originalName;
  mode = data.mode;

  document.title = mode === 'new' ? 'New Material' : 'Clone Material';

  (document.getElementById('edit-name') as HTMLInputElement).value = (mat.name as string) || '';
  (document.getElementById('edit-type') as HTMLSelectElement).value = (mat.type_ as string) || 'basic';
  (document.getElementById('edit-elasticity') as HTMLInputElement).value = ((mat.elasticity as number) ?? 0).toFixed(3);
  (document.getElementById('edit-elasticity-falloff') as HTMLInputElement).value = (
    (mat.elasticity_falloff as number) ?? 0
  ).toFixed(3);
  (document.getElementById('edit-friction') as HTMLInputElement).value = ((mat.friction as number) ?? 0).toFixed(3);
  (document.getElementById('edit-scatter') as HTMLInputElement).value = ((mat.scatter_angle as number) ?? 0).toFixed(2);

  const nameInput = document.getElementById('edit-name') as HTMLInputElement;
  nameInput.focus();
  nameInput.select();

  validateName();
});

function validateName(): boolean {
  const input = document.getElementById('edit-name') as HTMLInputElement;
  const okBtn = document.getElementById('editor-ok') as HTMLButtonElement;
  const errorEl = document.getElementById('name-error') as HTMLElement;
  const newName = input.value.trim();

  if (!newName) {
    okBtn.disabled = true;
    errorEl.textContent = 'Name cannot be empty';
    return false;
  }

  const newNameLower = newName.toLowerCase();
  const originalNameLower = originalName.toLowerCase();
  const nameExists = existingNames.some(
    (n: string) => n.toLowerCase() === newNameLower && n.toLowerCase() !== originalNameLower
  );

  if (nameExists) {
    okBtn.disabled = true;
    errorEl.textContent = 'Material already exists';
    return false;
  }

  okBtn.disabled = false;
  errorEl.textContent = '';
  return true;
}

(document.getElementById('edit-name') as HTMLInputElement).addEventListener('input', validateName);

(document.getElementById('editor-cancel') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.materialEditorCancel?.();
});

(document.getElementById('editor-ok') as HTMLButtonElement).addEventListener('click', () => {
  if (!validateName()) return;

  const result = {
    name: (document.getElementById('edit-name') as HTMLInputElement).value.trim(),
    type_: (document.getElementById('edit-type') as HTMLSelectElement).value,
    elasticity: parseFloat((document.getElementById('edit-elasticity') as HTMLInputElement).value),
    elasticity_falloff: parseFloat((document.getElementById('edit-elasticity-falloff') as HTMLInputElement).value),
    friction: parseFloat((document.getElementById('edit-friction') as HTMLInputElement).value),
    scatter_angle: parseFloat((document.getElementById('edit-scatter') as HTMLInputElement).value),
  };

  window.vpxEditor.materialEditorSave?.(result);
});

setupKeyboardShortcuts({
  onEscape: (): void => window.vpxEditor.materialEditorCancel?.(),
});
