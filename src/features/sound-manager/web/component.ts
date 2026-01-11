import { initSoundManagerComponent, loadSoundManagerData, type SoundManagerInstance } from '../shared/component';
import type { SoundData } from '../shared/core';
import { initWebPrompt } from '../../prompt/web/component';
import templateHtml from './template.html?raw';

export type { SoundManagerInstance };

export interface WebSoundManagerDeps {
  readFile: (path: string) => Promise<string>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
  writeBinaryFile: (path: string, data: Uint8Array) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  onSoundsChanged: () => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => Promise<void>;
  undoMarkSounds?: () => void;
  undoMarkSoundCreate?: (soundName: string) => void;
  undoMarkSoundDelete?: (soundName: string, soundData: unknown, filePath: string) => void;
}

export interface WebSoundManagerInstance {
  open: (extractedDir: string) => Promise<void>;
  close: () => void;
  setTheme: (theme: string) => void;
  refresh: () => Promise<void>;
  isOpen: () => boolean;
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

export function initWebSoundManager(
  deps: WebSoundManagerDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebSoundManagerInstance {
  injectTemplate();

  const modal = document.getElementById('sound-manager-modal')!;
  const closeBtn = document.getElementById('sound-manager-close')!;
  const importBtn = document.getElementById('sound-import-btn')!;
  const statusEl = document.getElementById('sound-manager-status')!;
  const prompt = initWebPrompt();

  const soundFileInput = document.createElement('input');
  soundFileInput.type = 'file';
  soundFileInput.accept = 'audio/wav,audio/mpeg,audio/ogg,.wav,.mp3,.ogg,.flac';
  soundFileInput.multiple = true;
  soundFileInput.style.display = 'none';
  document.body.appendChild(soundFileInput);

  let managerInstance: SoundManagerInstance | null = null;
  let lastExtractedDir: string | null = null;

  async function open(extractedDir: string): Promise<void> {
    lastExtractedDir = extractedDir;
    const { sounds } = await loadSoundManagerData(extractedDir, {
      readFile: deps.readFile,
    });

    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    if (!managerInstance) {
      managerInstance = initSoundManagerComponent(
        {
          listBody: document.getElementById('sound-list-body')!,
          filterInput: document.getElementById('sound-filter') as HTMLInputElement,
          statusEl,
          propertiesContainer: document.getElementById('sound-properties-container')!,
          emptyState: document.getElementById('sound-empty-state')!,
          contextMenu: document.getElementById('sound-context-menu')!,
        },
        {
          readFile: deps.readFile,
          readBinaryFile: deps.readBinaryFile,
          writeBinaryFile: deps.writeBinaryFile,
          writeFile: deps.writeFile,
          renameFile: deps.renameFile,
          deleteFile: deps.deleteFile,
          showConfirm: async (message: string) => confirm(message),
          openRenamePrompt: (currentName: string, existingNames: string[]) => {
            prompt
              .show({
                mode: 'rename',
                entityType: 'sound',
                currentName,
                existingNames,
              })
              .then(result => {
                if (result.submitted && result.value) {
                  managerInstance?.performRename(currentName, result.value);
                }
              });
          },
          exportSound: async (srcPath: string, fileName: string) => {
            const data = await deps.readBinaryFile(srcPath);
            const blob = new Blob([new Uint8Array(data)]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          },
          onSoundsChanged: deps.onSoundsChanged,
          undoBegin: deps.undoBegin,
          undoEnd: deps.undoEnd,
          undoMarkSounds: deps.undoMarkSounds,
          undoMarkSoundCreate: deps.undoMarkSoundCreate,
          undoMarkSoundDelete: deps.undoMarkSoundDelete,
        },
        { extractedDir, sounds }
      );
    } else {
      managerInstance.setData({ extractedDir, sounds });
    }

    managerInstance.setSelectedSound(null);
    (document.getElementById('sound-filter') as HTMLInputElement).value = '';
    document.getElementById('sound-properties-container')!.style.display = 'none';
    document.getElementById('sound-empty-state')!.style.display = 'block';

    await managerInstance.renderList();
    statusEl.textContent = `Loaded ${sounds.length} sounds`;
    modal.classList.remove('hidden');
  }

  function close(): void {
    if (managerInstance) managerInstance.stopSound();
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);

  importBtn.addEventListener('click', () => soundFileInput.click());

  soundFileInput.addEventListener('change', async () => {
    if (soundFileInput.files && soundFileInput.files.length > 0 && managerInstance) {
      await managerInstance.importSounds(soundFileInput.files);
      soundFileInput.value = '';
    }
  });

  function isOpen(): boolean {
    return !modal.classList.contains('hidden');
  }

  async function refresh(): Promise<void> {
    if (isOpen() && lastExtractedDir) {
      await open(lastExtractedDir);
    }
  }

  return {
    open,
    close,
    setTheme: (theme: string) => modal.setAttribute('data-theme', theme),
    refresh,
    isOpen,
  };
}

export { loadSoundManagerData };
export type { SoundData };
