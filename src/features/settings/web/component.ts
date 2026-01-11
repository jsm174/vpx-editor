import { createSettingsHTML, initSettingsComponent } from '../shared/component.js';
import type { EditorSettings } from '../../../types/ipc.js';
import templateHtml from './template.html?raw';

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

export interface WebSettingsDeps {
  storage: {
    get: <T>(key: string) => Promise<T | null | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  events: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
  applyTheme: (theme?: string) => void;
}

export function initWebSettings(deps: WebSettingsDeps): void {
  injectTemplate();
  const modal = document.getElementById('settings-modal')!;
  const content = modal.querySelector('.settings-modal-content')!;

  async function showSettings(): Promise<void> {
    const settings = (await deps.storage.get<EditorSettings>('editorSettings')) || {};

    content.innerHTML = createSettingsHTML({
      showPathsTab: false,
      showResetWindows: false,
    });

    initSettingsComponent(
      content as HTMLElement,
      settings,
      {
        onSave: async (newSettings: EditorSettings) => {
          await deps.storage.set('editorSettings', newSettings);
          deps.applyTheme(newSettings.theme);
          deps.events.emit('editor-settings-changed', newSettings);
          modal.classList.add('hidden');
        },
        onCancel: () => {
          deps.applyTheme(settings.theme);
          modal.classList.add('hidden');
        },
        onThemePreview: (theme: string) => {
          deps.applyTheme(theme);
        },
      },
      {
        showPathsTab: false,
        showResetWindows: false,
      }
    );

    modal.classList.remove('hidden');
  }

  const closeBtn = document.getElementById('settings-modal-close')!;

  async function closeSettings(): Promise<void> {
    const settings = (await deps.storage.get<EditorSettings>('editorSettings')) || {};
    deps.applyTheme(settings.theme);
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', closeSettings);

  deps.events.on('show-settings', showSettings);
}
