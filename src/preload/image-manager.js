import { contextBridge, ipcRenderer } from 'electron';
import { createCommonBridge } from './common-bridge.js';

contextBridge.exposeInMainWorld('imageManager', {
  ...createCommonBridge(),
  getImageInfo: imagePath => ipcRenderer.invoke('get-image-info', imagePath),
  readBinaryFile: filePath => ipcRenderer.invoke('read-binary-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  importImage: () => ipcRenderer.invoke('import-image'),
  exportImage: (srcPath, suggestedName) => ipcRenderer.invoke('export-image', srcPath, suggestedName),
  deleteFile: filePath => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  updateItemImage: (itemName, itemType, oldImage, newImage) =>
    ipcRenderer.invoke('update-item-image', itemName, itemType, oldImage, newImage),
  notifyImagesChanged: () => ipcRenderer.send('images-changed'),
  undoMarkImages: () => ipcRenderer.send('undo-mark-images'),
  undoMarkImageCreate: imageName => ipcRenderer.send('undo-mark-image-create', imageName),
  undoMarkImageDelete: (imageName, imageData, filePath) =>
    ipcRenderer.send('undo-mark-image-delete', imageName, imageData, filePath),
});
