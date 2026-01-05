import { setupThemeListener, setupInputKeyboard } from '../../shared/window-utils.js';

let currentName: string = '';
let type: string = 'element';

setupThemeListener();

window.vpxEditor.onInitRenamePrompt((data: { currentName: string; type: string }) => {
  currentName = data.currentName || '';
  type = data.type || 'element';

  document.title = type === 'table' ? 'Rename Table' : 'Rename';

  const input = document.getElementById('prompt-input') as HTMLInputElement;
  input.value = data.currentName || '';
  input.focus();
  input.select();

  (document.getElementById('prompt-error') as HTMLElement).textContent = '';
  validate();
});

function validate(): boolean {
  const input = document.getElementById('prompt-input') as HTMLInputElement;
  const okBtn = document.getElementById('prompt-ok') as HTMLButtonElement;
  const error = document.getElementById('prompt-error') as HTMLElement;
  const newName = input.value.trim();

  if (!newName) {
    okBtn.disabled = true;
    error.textContent = 'Name cannot be empty';
    return false;
  }

  if (newName === currentName) {
    okBtn.disabled = true;
    error.textContent = '';
    return false;
  }

  if (newName.length > 32) {
    okBtn.disabled = true;
    error.textContent = 'Name is too long (max 32 characters)';
    return false;
  }

  okBtn.disabled = false;
  error.textContent = '';
  return true;
}

(document.getElementById('prompt-input') as HTMLInputElement).addEventListener('input', validate);

(document.getElementById('prompt-cancel') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.renamePromptResult(null);
});

(document.getElementById('prompt-ok') as HTMLButtonElement).addEventListener('click', () => {
  if (!validate()) return;
  const name = (document.getElementById('prompt-input') as HTMLInputElement).value.trim();
  window.vpxEditor.renamePromptResult(name);
});

setupInputKeyboard(document.getElementById('prompt-input') as HTMLInputElement, {
  onEnter: (): void => {
    if (validate()) {
      const name = (document.getElementById('prompt-input') as HTMLInputElement).value.trim();
      window.vpxEditor.renamePromptResult(name);
    }
  },
  onEscape: (): void => window.vpxEditor.renamePromptResult(null),
});
