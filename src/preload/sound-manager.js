import { contextBridge, ipcRenderer } from 'electron';
import { createCommonBridge } from './common-bridge.js';

contextBridge.exposeInMainWorld('soundManager', {
  ...createCommonBridge(),
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  readBinaryFile: filePath => ipcRenderer.invoke('read-binary-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDir: dirPath => ipcRenderer.invoke('list-dir', dirPath),
  getSoundInfo: soundPath => ipcRenderer.invoke('get-sound-info', soundPath),
  importSound: () => ipcRenderer.invoke('import-sound'),
  exportSound: (srcPath, suggestedName) => ipcRenderer.invoke('export-sound', srcPath, suggestedName),
  deleteFile: filePath => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  notifySoundsChanged: () => ipcRenderer.send('sounds-changed'),
});
