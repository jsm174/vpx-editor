import templateHtml from './template.html?raw';

export interface PromptOptions {
  mode: 'new' | 'rename';
  entityType: string;
  currentName: string;
  defaultValue?: string;
  existingNames: string[];
  maxLength?: number;
  title?: string;
}

export interface PromptResult {
  submitted: boolean;
  value: string | null;
}

export interface WebPromptInstance {
  show: (options: PromptOptions) => Promise<PromptResult>;
}

let templateInjected = false;

function injectTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

const titleMap: Record<string, Record<string, string>> = {
  collection: { new: 'New Collection', rename: 'Rename Collection' },
  image: { new: 'New Image', rename: 'Rename Image' },
  sound: { new: 'New Sound', rename: 'Rename Sound' },
  material: { new: 'New Material', rename: 'Rename Material' },
  table: { new: 'Rename Table', rename: 'Rename Table' },
  element: { new: 'New Element', rename: 'Rename' },
  renderprobe: { new: 'New Render Probe', rename: 'Rename Render Probe' },
};

export function initWebPrompt(): WebPromptInstance {
  injectTemplate();

  const overlay = document.getElementById('prompt-overlay')!;
  const title = document.getElementById('prompt-title')!;
  const input = document.getElementById('prompt-input') as HTMLInputElement;
  const error = document.getElementById('prompt-error')!;
  const okBtn = document.getElementById('prompt-ok') as HTMLButtonElement;
  const cancelBtn = document.getElementById('prompt-cancel')!;
  const closeBtn = document.getElementById('prompt-close')!;

  function show(options: PromptOptions): Promise<PromptResult> {
    return new Promise(resolve => {
      const {
        mode,
        entityType,
        currentName,
        defaultValue,
        existingNames = [],
        maxLength = 0,
        title: customTitle,
      } = options;

      const entityTitles = titleMap[entityType];
      const defaultTitle = entityTitles ? entityTitles[mode] : mode === 'new' ? 'New' : 'Rename';
      title.textContent = customTitle || defaultTitle;

      input.value = defaultValue ?? currentName;
      error.textContent = '';
      okBtn.disabled = true;
      overlay.classList.remove('hidden');
      input.focus();
      input.select();

      const validate = (): boolean => {
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
      };

      const cleanup = (): void => {
        input.removeEventListener('input', validate);
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn.removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKeydown);
        overlay.classList.add('hidden');
      };

      const onOk = (): void => {
        if (!validate()) return;
        const newName = input.value.trim();
        cleanup();
        resolve({ submitted: true, value: newName });
      };

      const onCancel = (): void => {
        cleanup();
        resolve({ submitted: false, value: null });
      };

      const onKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'Enter') {
          onOk();
        }
      };

      input.addEventListener('input', validate);
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn.addEventListener('click', onCancel);
      input.addEventListener('keydown', onKeydown);

      validate();
    });
  }

  return { show };
}
