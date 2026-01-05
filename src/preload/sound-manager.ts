import { contextBridge, ipcRenderer } from 'electron';
import { createCommonBridge, CommonBridgeAPI } from './common-bridge.js';

export interface SoundManagerAPI extends CommonBridgeAPI {
  readFile: (filePath: string) => Promise<string>;
  readBinaryFile: (filePath: string) => Promise<ArrayBuffer>;
  writeFile: (filePath: string, content: string | ArrayBuffer) => Promise<void>;
  listDir: (dirPath: string) => Promise<string[]>;
  getSoundInfo: (soundPath: string) => Promise<unknown>;
  importSound: () => Promise<string | null>;
  exportSound: (srcPath: string, suggestedName: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  notifySoundsChanged: () => void;
}

const soundManagerAPI: SoundManagerAPI = {
  ...createCommonBridge(),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('read-file', filePath),
  readBinaryFile: (filePath: string): Promise<ArrayBuffer> => ipcRenderer.invoke('read-binary-file', filePath),
  writeFile: (filePath: string, content: string | ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('write-file', filePath, content),
  listDir: (dirPath: string): Promise<string[]> => ipcRenderer.invoke('list-dir', dirPath),
  getSoundInfo: (soundPath: string): Promise<unknown> => ipcRenderer.invoke('get-sound-info', soundPath),
  importSound: (): Promise<string | null> => ipcRenderer.invoke('import-sound'),
  exportSound: (srcPath: string, suggestedName: string): Promise<boolean> =>
    ipcRenderer.invoke('export-sound', srcPath, suggestedName),
  deleteFile: (filePath: string): Promise<void> => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke('rename-file', oldPath, newPath),
  notifySoundsChanged: (): void => {
    ipcRenderer.send('sounds-changed');
  },
};

contextBridge.exposeInMainWorld('soundManager', soundManagerAPI);
