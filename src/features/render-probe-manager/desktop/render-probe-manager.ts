import { contextBridge, ipcRenderer } from 'electron';
import { createCommonBridge, CommonBridgeAPI } from '../../../preload/common-bridge.js';

export interface RenderProbeManagerAPI extends CommonBridgeAPI {
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  notifyRenderProbesChanged: () => void;
  undoMarkRenderProbes: () => void;
  undoMarkRenderProbeCreate: (probeName: string) => void;
  undoMarkRenderProbeDelete: (probeName: string, probeData: unknown) => void;
}

const renderProbeManagerAPI: RenderProbeManagerAPI = {
  ...createCommonBridge(),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('write-file', filePath, content),
  notifyRenderProbesChanged: (): void => {
    ipcRenderer.send('renderprobes-changed');
  },
  undoMarkRenderProbes: (): void => {
    ipcRenderer.send('undo-mark-renderprobes');
  },
  undoMarkRenderProbeCreate: (probeName: string): void => {
    ipcRenderer.send('undo-mark-renderprobe-create', probeName);
  },
  undoMarkRenderProbeDelete: (probeName: string, probeData: unknown): void => {
    ipcRenderer.send('undo-mark-renderprobe-delete', probeName, probeData);
  },
};

contextBridge.exposeInMainWorld('renderProbeManager', renderProbeManagerAPI);
