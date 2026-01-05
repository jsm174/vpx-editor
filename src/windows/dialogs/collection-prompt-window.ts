import { setupThemeListener, setupInputKeyboard } from '../../shared/window-utils.js';

let currentName: string = '';
let mode: string = 'new';

setupThemeListener();

window.vpxEditor.onInitCollectionPrompt((data: { mode: string; name: string | null }) => {
  currentName = data.name || '';
  mode = data.mode;

  document.title = mode === 'rename' ? 'Rename Collection' : 'New Collection';

  const input = document.getElementById('prompt-input') as HTMLInputElement;
  input.value = data.name || '';
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

  if (mode === 'rename' && newName === currentName) {
    okBtn.disabled = true;
    error.textContent = '';
    return false;
  }

  okBtn.disabled = false;
  error.textContent = '';
  return true;
}

(document.getElementById('prompt-input') as HTMLInputElement).addEventListener('input', validate);

(document.getElementById('prompt-cancel') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.collectionPromptResult(null);
});

(document.getElementById('prompt-ok') as HTMLButtonElement).addEventListener('click', () => {
  if (!validate()) return;
  const name = (document.getElementById('prompt-input') as HTMLInputElement).value.trim();
  window.vpxEditor.collectionPromptResult(name);
});

setupInputKeyboard(document.getElementById('prompt-input') as HTMLInputElement, {
  onEnter: (): void => {
    if (validate()) {
      const name = (document.getElementById('prompt-input') as HTMLInputElement).value.trim();
      window.vpxEditor.collectionPromptResult(name);
    }
  },
  onEscape: (): void => window.vpxEditor.collectionPromptResult(null),
});
