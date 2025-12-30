import { contextBridge, ipcRenderer } from 'electron';
import { createCommonBridge } from './common-bridge.js';

contextBridge.exposeInMainWorld('renderProbeManager', {
  ...createCommonBridge(),
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  notifyRenderProbesChanged: () => ipcRenderer.send('renderprobes-changed'),
  undoMarkRenderProbes: () => ipcRenderer.send('undo-mark-renderprobes'),
  undoMarkRenderProbeCreate: probeName => ipcRenderer.send('undo-mark-renderprobe-create', probeName),
  undoMarkRenderProbeDelete: (probeName, probeData) =>
    ipcRenderer.send('undo-mark-renderprobe-delete', probeName, probeData),
});
