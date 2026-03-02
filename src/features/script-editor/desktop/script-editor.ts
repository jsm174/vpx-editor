import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface ScriptEditorAPI {
  onInit: (callback: (data: unknown) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  onTableLockChanged: (callback: (isLocked: boolean) => void) => void;
  saveScript: (content: string) => Promise<void>;
  notifyScriptChanged: () => void;
  onCheckCanClose: (callback: () => void) => void;
  respondCanClose: (canClose: boolean) => void;
  saveCursorPosition: (position: { lineNumber: number; column: number }) => void;
  onScriptUndone: (callback: (content: string) => void) => void;
  showUnsavedChangesDialog: () => Promise<string>;
}

const scriptEditorAPI: ScriptEditorAPI = {
  onInit: (callback: (data: unknown) => void): void => {
    ipcRenderer.on('init', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onThemeChanged: (callback: (theme: string) => void): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  onTableLockChanged: (callback: (isLocked: boolean) => void): void => {
    ipcRenderer.on('table-lock-changed', (_event: IpcRendererEvent, isLocked: boolean) => callback(isLocked));
  },
  saveScript: (content: string): Promise<void> => ipcRenderer.invoke('save-script', content),
  notifyScriptChanged: (): void => {
    ipcRenderer.send('script-changed');
  },
  onCheckCanClose: (callback: () => void): void => {
    ipcRenderer.on('check-can-close', () => callback());
  },
  respondCanClose: (canClose: boolean): void => {
    ipcRenderer.send('can-close-response', canClose);
  },
  saveCursorPosition: (position: { lineNumber: number; column: number }): void => {
    ipcRenderer.send('script-editor-cursor-position', position);
  },
  onScriptUndone: (callback: (content: string) => void): void => {
    ipcRenderer.on('script-undone', (_event: IpcRendererEvent, content: string) => callback(content));
  },
  showUnsavedChangesDialog: (): Promise<string> => ipcRenderer.invoke('script-editor-unsaved-changes-dialog'),
};

contextBridge.exposeInMainWorld('scriptEditor', scriptEditorAPI);
