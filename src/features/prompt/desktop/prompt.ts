import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

interface PromptInitData {
  mode: 'new' | 'rename';
  entityType: string;
  currentName: string;
  defaultValue: string;
  existingNames: string[];
  maxLength?: number;
}

export interface PromptAPI {
  onInit: (callback: (data: PromptInitData) => void) => void;
  result: (value: string | null) => void;
}

const promptAPI: PromptAPI = {
  onInit: (callback: (data: PromptInitData) => void): void => {
    ipcRenderer.on('init-prompt', (_event: IpcRendererEvent, data: PromptInitData) => callback(data));
  },
  result: (value: string | null): void => {
    if (value === null) {
      ipcRenderer.send('prompt-cancel');
    } else {
      ipcRenderer.send('prompt-submit', value);
    }
  },
};

contextBridge.exposeInMainWorld('vpxPrompt', promptAPI);

contextBridge.exposeInMainWorld('vpxEditor', {
  onThemeChanged: (callback: (theme: string) => void): void => {
    ipcRenderer.on('set-theme', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
});
