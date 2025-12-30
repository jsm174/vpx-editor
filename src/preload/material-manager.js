import { contextBridge, ipcRenderer } from 'electron';
import { createCommonBridge } from './common-bridge.js';

contextBridge.exposeInMainWorld('materialManager', {
  ...createCommonBridge(),
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  updateItemMaterial: (itemName, itemType, oldMaterial, newMaterial) =>
    ipcRenderer.invoke('update-item-material', itemName, itemType, oldMaterial, newMaterial),
  notifyMaterialsChanged: () => ipcRenderer.send('materials-changed'),
  undoMarkMaterials: () => ipcRenderer.send('undo-mark-materials'),
  undoMarkMaterialCreate: materialName => ipcRenderer.send('undo-mark-material-create', materialName),
  undoMarkMaterialDelete: (materialName, materialData) =>
    ipcRenderer.send('undo-mark-material-delete', materialName, materialData),
});
