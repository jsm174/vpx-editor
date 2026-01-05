import { ipcRenderer, IpcRendererEvent } from 'electron';

export interface CommonBridgeAPI {
  onInit: (callback: (data: unknown) => void) => void;
  onSetDisabled: (callback: (disabled: boolean) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  confirm: (message: string) => Promise<boolean>;
  selectItem: (itemName: string) => void;
  undoBegin: (description: string) => void;
  undoEnd: () => void;
  undoCancel: () => void;
  undoMarkForUndo: (itemName: string) => void;
  undoMarkGamedata: () => void;
}

export function createCommonBridge(): CommonBridgeAPI {
  return {
    onInit: (callback: (data: unknown) => void): void => {
      ipcRenderer.on('init', (_event: IpcRendererEvent, data: unknown) => callback(data));
    },
    onSetDisabled: (callback: (disabled: boolean) => void): void => {
      ipcRenderer.on('set-disabled', (_event: IpcRendererEvent, disabled: boolean) => callback(disabled));
    },
    onThemeChanged: (callback: (theme: string) => void): void => {
      ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
    },
    confirm: (message: string): Promise<boolean> => ipcRenderer.invoke('confirm-dialog', message),
    selectItem: (itemName: string): void => {
      ipcRenderer.send('select-item', itemName);
    },
    undoBegin: (description: string): void => {
      ipcRenderer.send('undo-begin', description);
    },
    undoEnd: (): void => {
      ipcRenderer.send('undo-end');
    },
    undoCancel: (): void => {
      ipcRenderer.send('undo-cancel');
    },
    undoMarkForUndo: (itemName: string): void => {
      ipcRenderer.send('undo-mark-for-undo', itemName);
    },
    undoMarkGamedata: (): void => {
      ipcRenderer.send('undo-mark-gamedata');
    },
  };
}
