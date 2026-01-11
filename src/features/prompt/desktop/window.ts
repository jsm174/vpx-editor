import { setupThemeListener, setupInputKeyboard } from '../../../shared/window-utils.js';

declare global {
  interface Window {
    vpxPrompt: {
      onInit: (callback: (data: PromptInitData) => void) => void;
      result: (value: string | null) => void;
    };
  }
}

interface PromptInitData {
  mode: 'new' | 'rename';
  entityType: string;
  currentName: string;
  defaultValue: string;
  existingNames: string[];
  maxLength?: number;
}

let mode: 'new' | 'rename' = 'rename';
let entityType: string = 'element';
let currentName: string = '';
let existingNames: string[] = [];
let maxLength: number = 0;

setupThemeListener();

window.vpxPrompt.onInit((data: PromptInitData) => {
  mode = data.mode || 'rename';
  entityType = data.entityType || 'element';
  currentName = data.currentName || '';
  existingNames = data.existingNames || [];
  maxLength = data.maxLength || 0;

  const titleMap: Record<string, Record<string, string>> = {
    collection: { new: 'New Collection', rename: 'Rename Collection' },
    image: { new: 'New Image', rename: 'Rename Image' },
    sound: { new: 'New Sound', rename: 'Rename Sound' },
    material: { new: 'New Material', rename: 'Rename Material' },
    table: { new: 'Rename Table', rename: 'Rename Table' },
    renderprobe: { new: 'New Render Probe', rename: 'Rename Render Probe' },
  };

  const entityTitles = titleMap[entityType];
  document.title = entityTitles ? entityTitles[mode] : mode === 'new' ? `New ${entityType}` : `Rename ${entityType}`;

  const input = document.getElementById('prompt-input') as HTMLInputElement;
  input.value = data.defaultValue || '';
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

  if (mode === 'rename' && newName.toLowerCase() === currentName.toLowerCase()) {
    okBtn.disabled = true;
    error.textContent = '';
    return false;
  }

  if (maxLength > 0 && newName.length > maxLength) {
    okBtn.disabled = true;
    error.textContent = `Name is too long (max ${maxLength} characters)`;
    return false;
  }

  const newNameLower = newName.toLowerCase();
  const currentNameLower = currentName.toLowerCase();
  const isDuplicate = existingNames.some(
    n => n.toLowerCase() === newNameLower && (mode === 'new' || n.toLowerCase() !== currentNameLower)
  );
  if (isDuplicate) {
    okBtn.disabled = true;
    error.textContent = 'Name already exists';
    return false;
  }

  okBtn.disabled = false;
  error.textContent = '';
  return true;
}

(document.getElementById('prompt-input') as HTMLInputElement).addEventListener('input', validate);

(document.getElementById('prompt-cancel') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxPrompt.result(null);
});

(document.getElementById('prompt-ok') as HTMLButtonElement).addEventListener('click', () => {
  if (!validate()) return;
  const name = (document.getElementById('prompt-input') as HTMLInputElement).value.trim();
  window.vpxPrompt.result(name);
});

setupInputKeyboard(document.getElementById('prompt-input') as HTMLInputElement, {
  onEnter: (): void => {
    if (validate()) {
      const name = (document.getElementById('prompt-input') as HTMLInputElement).value.trim();
      window.vpxPrompt.result(name);
    }
  },
  onEscape: (): void => window.vpxPrompt.result(null),
});
