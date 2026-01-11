import { initSoundManagerComponent, type SoundManagerInstance, type SoundManagerCallbacks } from '../shared/component';
import type { SoundData } from '../shared/core';

declare global {
  interface Window {
    soundManager: {
      onInit: (callback: (data: { extractedDir: string; sounds: unknown[]; theme?: string }) => void) => void;
      onSetDisabled: (callback: (disabled: boolean) => void) => void;
      onThemeChanged: (callback: (theme: string) => void) => void;
      readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      readBinaryFile: (path: string) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      writeBinaryFile: (path: string, data: Uint8Array) => Promise<{ success: boolean; error?: string }>;
      listDir: (path: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
      renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
      deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
      getSoundInfo: (path: string) => Promise<{
        success: boolean;
        format?: string;
        sampleRate?: number;
        channels?: number;
        duration?: number;
        size?: number;
        error?: string;
      }>;
      importSound: () => Promise<{ success: boolean; name?: string; originalPath?: string; error?: string }>;
      exportSound: (srcPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
      notifySoundsChanged: () => void;
      confirm: (message: string) => Promise<boolean>;
      showRenamePrompt: (entityType: string, currentName: string, existingNames: string[]) => void;
      onRenameResult: (callback: (result: { oldName: string; newName: string }) => void) => void;
      onRefresh: (callback: (data: { sounds: unknown[] }) => void) => void;
      undoBegin: (description: string) => void;
      undoEnd: () => void;
      undoMarkSounds: () => void;
      undoMarkSoundCreate: (soundName: string) => void;
      undoMarkSoundDelete: (soundName: string, soundData: unknown, filePath: string) => void;
    };
  }
}

let manager: SoundManagerInstance | null = null;

function createCallbacks(): SoundManagerCallbacks {
  return {
    readFile: async (path: string) => {
      const result = await window.soundManager.readFile(path);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    readBinaryFile: async (path: string) => {
      const result = await window.soundManager.readBinaryFile(path);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    writeBinaryFile: async (path: string, data: Uint8Array) => {
      const result = await window.soundManager.writeBinaryFile(path, data);
      if (!result.success) throw new Error(result.error);
    },
    writeFile: async (path: string, content: string) => {
      const result = await window.soundManager.writeFile(path, content);
      if (!result.success) throw new Error(result.error);
    },
    listDir: async (path: string) => {
      const result = await window.soundManager.listDir(path);
      if (!result.success) throw new Error(result.error);
      return result.files || [];
    },
    renameFile: async (oldPath: string, newPath: string) => {
      const result = await window.soundManager.renameFile(oldPath, newPath);
      if (!result.success) throw new Error(result.error);
    },
    deleteFile: async (path: string) => {
      const result = await window.soundManager.deleteFile(path);
      if (!result.success) throw new Error(result.error);
    },
    getSoundInfo: async (path: string) => {
      return await window.soundManager.getSoundInfo(path);
    },
    showConfirm: (message: string) => window.soundManager.confirm(message),
    importSound: async () => {
      return await window.soundManager.importSound();
    },
    exportSound: async (srcPath: string, fileName: string) => {
      await window.soundManager.exportSound(srcPath, fileName);
    },
    onSoundsChanged: () => {
      window.soundManager.notifySoundsChanged();
    },
    openRenamePrompt: (currentName: string, existingNames: string[]) => {
      window.soundManager.showRenamePrompt('sound', currentName, existingNames);
    },
    undoBegin: (description: string) => {
      window.soundManager.undoBegin(description);
    },
    undoEnd: () => {
      window.soundManager.undoEnd();
    },
    undoMarkSounds: () => {
      window.soundManager.undoMarkSounds();
    },
    undoMarkSoundCreate: (soundName: string) => {
      window.soundManager.undoMarkSoundCreate(soundName);
    },
    undoMarkSoundDelete: (soundName: string, soundData: unknown, filePath: string) => {
      window.soundManager.undoMarkSoundDelete(soundName, soundData, filePath);
    },
  };
}

function init(): void {
  const theme = new URLSearchParams(window.location.search).get('theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);

  if (!window.soundManager) {
    document.getElementById('status-bar')!.textContent = 'Error: Preload failed';
    return;
  }

  const elements = {
    listBody: document.getElementById('sound-list-body')!,
    filterInput: document.getElementById('filter') as HTMLInputElement,
    statusEl: document.getElementById('status-bar')!,
    importBtn: document.getElementById('btn-import')!,
    propertiesContainer: document.getElementById('properties-container')!,
    emptyState: document.getElementById('empty-state')!,
    contextMenu: document.getElementById('context-menu')!,
    renameOverlay: document.getElementById('rename-overlay')!,
    renameInput: document.getElementById('rename-input') as HTMLInputElement,
    renameError: document.getElementById('rename-error')!,
    renameOkBtn: document.getElementById('rename-ok')!,
    renameCancelBtn: document.getElementById('rename-cancel')!,
  };

  const renameCloseBtn = document.getElementById('rename-close');
  if (renameCloseBtn) {
    renameCloseBtn.addEventListener('click', () => {
      elements.renameOverlay.classList.add('hidden');
    });
  }

  const callbacks = createCallbacks();

  manager = initSoundManagerComponent(elements, callbacks);
  manager.setUIDisabled(true);

  elements.importBtn.addEventListener('click', () => manager?.importSoundNative());

  window.soundManager.onInit(async data => {
    manager!.setData({
      extractedDir: data.extractedDir,
      sounds: data.sounds as SoundData[],
    });
    manager!.setUIDisabled(false);
    await manager!.renderList('');
    elements.statusEl.textContent = `Loaded ${(data.sounds || []).length} sounds`;
  });

  window.soundManager.onSetDisabled(disabled => {
    manager?.setUIDisabled(disabled);
  });

  window.soundManager.onThemeChanged(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.soundManager.onRenameResult(result => {
    manager?.performRename(result.oldName, result.newName);
  });

  window.soundManager.onRefresh(async data => {
    const previouslySelected = manager?.getSelectedSound()?.name;
    manager?.setSounds(data.sounds as SoundData[]);
    manager?.setSelectedSound(null);
    await manager?.renderList('');
    if (previouslySelected) {
      const stillExists = (data.sounds as SoundData[]).find(s => s.name === previouslySelected);
      if (stillExists) {
        await manager?.selectSoundByName(previouslySelected);
      } else {
        elements.propertiesContainer.style.display = 'none';
        elements.emptyState.style.display = 'block';
      }
    } else {
      elements.propertiesContainer.style.display = 'none';
      elements.emptyState.style.display = 'block';
    }
    elements.statusEl.textContent = `Refreshed - ${(data.sounds || []).length} sounds`;
  });
}

init();
