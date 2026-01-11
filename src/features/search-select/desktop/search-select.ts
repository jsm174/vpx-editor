import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface SearchSelectAPI {
  onInit: (callback: (data: unknown) => void) => void;
  onUpdate: (callback: (data: unknown) => void) => void;
  onSetDisabled: (callback: (disabled: boolean) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  selectItem: (itemName: string) => void;
  selectItems: (itemNames: string[]) => void;
  onSelectionChanged: (callback: (selectedItems: string[]) => void) => void;
}

const searchSelectAPI: SearchSelectAPI = {
  onInit: (callback: (data: unknown) => void): void => {
    ipcRenderer.on('init', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onUpdate: (callback: (data: unknown) => void): void => {
    ipcRenderer.on('update', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onSetDisabled: (callback: (disabled: boolean) => void): void => {
    ipcRenderer.on('set-disabled', (_event: IpcRendererEvent, disabled: boolean) => callback(disabled));
  },
  onThemeChanged: (callback: (theme: string) => void): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  selectItem: (itemName: string): void => {
    ipcRenderer.send('select-item', itemName);
  },
  selectItems: (itemNames: string[]): void => {
    ipcRenderer.send('select-items', itemNames);
  },
  onSelectionChanged: (callback: (selectedItems: string[]) => void): void => {
    ipcRenderer.on('selection-changed', (_event: IpcRendererEvent, selectedItems: string[]) => callback(selectedItems));
  },
};

contextBridge.exposeInMainWorld('searchSelect', searchSelectAPI);
