import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { createCommonBridge, CommonBridgeAPI } from '../../../preload/common-bridge.js';

export interface MaterialManagerAPI extends CommonBridgeAPI {
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  updateItemMaterial: (itemName: string, itemType: string, oldMaterial: string, newMaterial: string) => Promise<void>;
  notifyMaterialsChanged: () => void;
  undoMarkMaterials: () => void;
  undoMarkMaterialCreate: (materialName: string) => void;
  undoMarkMaterialDelete: (materialName: string, materialData: unknown) => void;
  openMaterialEditor: (
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ) => void;
  onMaterialEditorResult: (callback: (result: Record<string, unknown> | null) => void) => void;
  onRefresh: (callback: (data: { materials: Record<string, unknown>; items: Record<string, unknown> }) => void) => void;
}

const materialManagerAPI: MaterialManagerAPI = {
  ...createCommonBridge(),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke('write-file', filePath, content),
  updateItemMaterial: (itemName: string, itemType: string, oldMaterial: string, newMaterial: string): Promise<void> =>
    ipcRenderer.invoke('update-item-material', itemName, itemType, oldMaterial, newMaterial),
  notifyMaterialsChanged: (): void => {
    ipcRenderer.send('materials-changed');
  },
  undoMarkMaterials: (): void => {
    ipcRenderer.send('undo-mark-materials');
  },
  undoMarkMaterialCreate: (materialName: string): void => {
    ipcRenderer.send('undo-mark-material-create', materialName);
  },
  undoMarkMaterialDelete: (materialName: string, materialData: unknown): void => {
    ipcRenderer.send('undo-mark-material-delete', materialName, materialData);
  },
  openMaterialEditor: (
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ): void => {
    ipcRenderer.send('open-material-editor', { material, mode, existingNames, originalName });
  },
  onMaterialEditorResult: (callback: (result: Record<string, unknown> | null) => void): void => {
    ipcRenderer.on('material-editor-result', (_event: IpcRendererEvent, result) => callback(result));
  },
  onRefresh: (callback): void => {
    ipcRenderer.on('refresh', (_event: IpcRendererEvent, data) => callback(data));
  },
};

contextBridge.exposeInMainWorld('materialManager', materialManagerAPI);
