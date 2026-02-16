import { initImageManagerComponent, type ImageManagerInstance, type ImageManagerCallbacks } from '../shared/component';
import type { ImageData, GameItem } from '../shared/core';

declare global {
  interface Window {
    imageManager: {
      onInit: (
        callback: (data: {
          extractedDir: string;
          images: Record<string, ImageData>;
          items: Record<string, GameItem>;
          gamedata: Record<string, unknown> | null;
          theme?: string;
          selectImage?: string;
        }) => void
      ) => void;
      onSelectImage: (callback: (imageName: string) => void) => void;
      onSetDisabled: (callback: (disabled: boolean) => void) => void;
      onThemeChanged: (callback: (theme: string) => void) => void;
      readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      readBinaryFile: (path: string) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      getImageInfo: (path: string) => Promise<{ success: boolean; width?: number; height?: number; error?: string }>;
      renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
      deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
      importImage: () => Promise<{ success: boolean; name?: string; originalPath?: string; error?: string }>;
      exportImage: (srcPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
      selectItem: (name: string) => void;
      updateItemImage: (itemName: string, itemType: string, oldName: string, newName: string) => Promise<void>;
      notifyImagesChanged: () => void;
      undoBegin: (description: string) => void;
      undoEnd: () => void;
      undoCancel: () => void;
      undoMarkImages: () => void;
      undoMarkImageCreate: (name: string) => void;
      undoMarkImageDelete: (name: string, imageData: ImageData, path: string) => void;
      undoMarkForUndo: (itemName: string) => void;
      undoMarkGamedata: () => void;
      confirm: (message: string) => Promise<boolean>;
      showRenamePrompt: (entityType: string, currentName: string, existingNames: string[]) => void;
      onRenameResult: (callback: (result: { oldName: string; newName: string }) => void) => void;
      onRefresh: (
        callback: (data: {
          images: Record<string, ImageData>;
          items: Record<string, GameItem>;
          gamedata: Record<string, unknown> | null;
        }) => void
      ) => void;
    };
  }
}

let manager: ImageManagerInstance | null = null;

function createCallbacks(): ImageManagerCallbacks {
  return {
    readFile: async (path: string) => {
      const result = await window.imageManager.readFile(path);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    readBinaryFile: async (path: string) => {
      const result = await window.imageManager.readBinaryFile(path);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    writeBinaryFile: async () => {
      throw new Error('Not implemented - use importImage instead');
    },
    writeFile: async (path: string, content: string) => {
      const result = await window.imageManager.writeFile(path, content);
      if (!result.success) throw new Error(result.error);
    },
    getImageInfo: async (path: string) => {
      return await window.imageManager.getImageInfo(path);
    },
    renameFile: async (oldPath: string, newPath: string) => {
      const result = await window.imageManager.renameFile(oldPath, newPath);
      if (!result.success) throw new Error(result.error);
    },
    deleteFile: async (path: string) => {
      const result = await window.imageManager.deleteFile(path);
      if (!result.success) throw new Error(result.error);
    },
    showConfirm: (message: string) => window.imageManager.confirm(message),
    importImage: async () => {
      return await window.imageManager.importImage();
    },
    exportImage: async (srcPath: string, fileName: string) => {
      const result = await window.imageManager.exportImage(srcPath, fileName);
      if (!result.success && result.error) throw new Error(result.error);
    },
    selectItem: (name: string) => {
      window.imageManager.selectItem(name);
    },
    updateItemImage: async (itemName: string, itemType: string, oldName: string, newName: string) => {
      await window.imageManager.updateItemImage(itemName, itemType, oldName, newName);
    },
    onImagesChanged: () => {
      window.imageManager.notifyImagesChanged();
    },
    undoBegin: (description: string) => window.imageManager.undoBegin(description),
    undoEnd: () => window.imageManager.undoEnd(),
    undoCancel: () => window.imageManager.undoCancel(),
    undoMarkImages: () => window.imageManager.undoMarkImages(),
    undoMarkImageCreate: (name: string) => window.imageManager.undoMarkImageCreate(name),
    undoMarkImageDelete: (name: string, imageData: ImageData, path: string) => {
      window.imageManager.undoMarkImageDelete(name, imageData, path);
    },
    undoMarkForUndo: (itemName: string) => window.imageManager.undoMarkForUndo(itemName),
    undoMarkGamedata: () => window.imageManager.undoMarkGamedata(),
    openRenamePrompt: (currentName: string, existingNames: string[]) => {
      window.imageManager.showRenamePrompt('image', currentName, existingNames);
    },
  };
}

function init(): void {
  const theme = new URLSearchParams(window.location.search).get('theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);

  if (!window.imageManager) {
    document.getElementById('status-bar')!.textContent = 'Error: Preload failed';
    return;
  }

  const elements = {
    listBody: document.getElementById('image-list-body')!,
    filterInput: document.getElementById('filter') as HTMLInputElement,
    previewImg: document.getElementById('preview-image') as HTMLImageElement,
    previewPlaceholder: document.getElementById('preview-placeholder')!,
    detailName: document.getElementById('detail-name')!,
    detailDims: document.getElementById('detail-dimensions')!,
    detailFormat: document.getElementById('detail-format')!,
    detailAlpha: document.getElementById('detail-alpha')!,
    usedByList: document.getElementById('used-by-list')!,
    statusEl: document.getElementById('status-bar')!,
    importBtn: document.getElementById('btn-import')!,
    contextMenu: document.getElementById('context-menu')!,
    renameOverlay: document.getElementById('rename-overlay')!,
    renameInput: document.getElementById('rename-input') as HTMLInputElement,
    renameError: document.getElementById('rename-error')!,
    renameOkBtn: document.getElementById('rename-ok')!,
    renameCancelBtn: document.getElementById('rename-cancel')!,
  };

  const renameCloseBtn = document.getElementById('rename-close');
  if (renameCloseBtn) {
    renameCloseBtn.addEventListener('click', () => {
      elements.renameOverlay.classList.add('hidden');
    });
  }

  const callbacks = createCallbacks();

  manager = initImageManagerComponent(elements, callbacks);
  manager.setUIDisabled(true);

  elements.importBtn.addEventListener('click', () => manager?.importImageNative());

  window.imageManager.onInit(async data => {
    manager!.setData({
      extractedDir: data.extractedDir,
      images: data.images,
      items: data.items,
      gamedata: data.gamedata,
    });
    manager!.setUIDisabled(false);
    await manager!.renderList('');
    if (data.selectImage) {
      await manager!.selectImageByName(data.selectImage);
    }
    elements.statusEl.textContent = `Loaded ${Object.keys(data.images || {}).length} images`;
  });

  window.imageManager.onSelectImage(async imageName => {
    if (!manager) return;
    elements.filterInput.value = '';
    await manager.renderList('');
    await manager.selectImageByName(imageName);
  });

  window.imageManager.onSetDisabled(disabled => {
    manager?.setUIDisabled(disabled);
  });

  window.imageManager.onThemeChanged(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.imageManager.onRenameResult(result => {
    manager?.performRename(result.oldName, result.newName);
  });

  window.imageManager.onRefresh(async data => {
    const previouslySelected = manager?.getSelectedImage();
    manager?.setImages(data.images);
    manager?.setItems(data.items);
    manager?.setGamedata(data.gamedata);
    manager?.clearPreview();
    manager?.renderList('');
    if (previouslySelected && (data.images as Record<string, unknown>)[previouslySelected]) {
      await manager?.selectImageByName(previouslySelected);
    }
    elements.statusEl.textContent = `Refreshed - ${Object.keys(data.images || {}).length} images`;
  });
}

init();
