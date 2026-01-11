import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface DimensionsManagerAPI {
  onInit: (callback: (data: unknown) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  onSetDisabled: (callback: (disabled: boolean) => void) => void;
  applyDimensions: (dimensions: unknown) => Promise<void>;
  close: () => void;
}

const dimensionsManagerAPI: DimensionsManagerAPI = {
  onInit: (callback: (data: unknown) => void): void => {
    ipcRenderer.on('init-dimensions', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onThemeChanged: (callback: (theme: string) => void): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  onSetDisabled: (callback: (disabled: boolean) => void): void => {
    ipcRenderer.on('set-disabled', (_event: IpcRendererEvent, disabled: boolean) => callback(disabled));
  },
  applyDimensions: (dimensions: unknown): Promise<void> => ipcRenderer.invoke('apply-dimensions', dimensions),
  close: (): void => {
    ipcRenderer.send('close-dimensions-manager');
  },
};

contextBridge.exposeInMainWorld('dimensionsManager', dimensionsManagerAPI);
