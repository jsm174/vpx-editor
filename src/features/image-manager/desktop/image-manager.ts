import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { createCommonBridge, CommonBridgeAPI } from '../../../preload/common-bridge.js';
import type { ImageData, GameItem } from '../shared/core.js';

export interface ImageManagerAPI extends CommonBridgeAPI {
  getImageInfo: (imagePath: string) => Promise<unknown>;
  readBinaryFile: (filePath: string) => Promise<ArrayBuffer>;
  writeFile: (filePath: string, content: string | ArrayBuffer) => Promise<void>;
  importImage: () => Promise<string | null>;
  exportImage: (srcPath: string, suggestedName: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  updateItemImage: (itemName: string, itemType: string, oldImage: string, newImage: string) => Promise<void>;
  notifyImagesChanged: () => void;
  undoMarkImages: () => void;
  undoMarkImageCreate: (imageName: string) => void;
  undoMarkImageDelete: (imageName: string, imageData: unknown, filePath: string) => void;
  onRefresh: (
    callback: (data: {
      images: Record<string, ImageData>;
      items: Record<string, GameItem>;
      gamedata: Record<string, unknown> | null;
    }) => void
  ) => void;
  onSelectImage: (callback: (imageName: string) => void) => void;
}

const imageManagerAPI: ImageManagerAPI = {
  ...createCommonBridge(),
  getImageInfo: (imagePath: string): Promise<unknown> => ipcRenderer.invoke('get-image-info', imagePath),
  readBinaryFile: (filePath: string): Promise<ArrayBuffer> => ipcRenderer.invoke('read-binary-file', filePath),
  writeFile: (filePath: string, content: string | ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('write-file', filePath, content),
  importImage: (): Promise<string | null> => ipcRenderer.invoke('import-image'),
  exportImage: (srcPath: string, suggestedName: string): Promise<boolean> =>
    ipcRenderer.invoke('export-image', srcPath, suggestedName),
  deleteFile: (filePath: string): Promise<void> => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke('rename-file', oldPath, newPath),
  updateItemImage: (itemName: string, itemType: string, oldImage: string, newImage: string): Promise<void> =>
    ipcRenderer.invoke('update-item-image', itemName, itemType, oldImage, newImage),
  notifyImagesChanged: (): void => {
    ipcRenderer.send('images-changed');
  },
  undoMarkImages: (): void => {
    ipcRenderer.send('undo-mark-images');
  },
  undoMarkImageCreate: (imageName: string): void => {
    ipcRenderer.send('undo-mark-image-create', imageName);
  },
  undoMarkImageDelete: (imageName: string, imageData: unknown, filePath: string): void => {
    ipcRenderer.send('undo-mark-image-delete', imageName, imageData, filePath);
  },
  onRefresh: (callback): void => {
    ipcRenderer.on('refresh', (_event, data) => callback(data));
  },
  onSelectImage: (callback: (imageName: string) => void): void => {
    ipcRenderer.on('select-image', (_event: IpcRendererEvent, imageName: string) => callback(imageName));
  },
};

contextBridge.exposeInMainWorld('imageManager', imageManagerAPI);
