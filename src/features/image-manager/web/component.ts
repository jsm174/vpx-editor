import { initImageManagerComponent, loadImageManagerData, type ImageManagerInstance } from '../shared/component';
import type { ImageData, GameItem } from '../shared/core';
import { initWebPrompt } from '../../prompt/web/component';
import templateHtml from './template.html?raw';

export type { ImageManagerInstance };

export interface WebImageManagerDeps {
  readFile: (path: string) => Promise<string>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
  writeBinaryFile: (path: string, data: Uint8Array) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  onImagesChanged: () => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => Promise<void>;
  undoMarkImages?: () => void;
  undoMarkImageCreate?: (imageName: string) => void;
  undoMarkImageDelete?: (imageName: string, imageData: unknown, filePath: string) => void;
  undoMarkForUndo?: (itemName: string) => void;
  undoMarkGamedata?: () => void;
}

export interface WebImageManagerInstance {
  open: (extractedDir: string, selectImage?: string) => Promise<void>;
  close: () => void;
  setTheme: (theme: string) => void;
  refresh: () => Promise<void>;
  isOpen: () => boolean;
}

let templateInjected = false;

function injectTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

export function initWebImageManager(
  deps: WebImageManagerDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebImageManagerInstance {
  injectTemplate();

  const modal = document.getElementById('image-manager-modal')!;
  const closeBtn = document.getElementById('image-manager-close')!;
  const importBtn = document.getElementById('image-import-btn')!;
  const statusEl = document.getElementById('image-manager-status')!;
  const prompt = initWebPrompt();

  const imageFileInput = document.createElement('input');
  imageFileInput.type = 'file';
  imageFileInput.accept = 'image/png,image/jpeg,image/webp,image/bmp,.png,.jpg,.jpeg,.webp,.bmp';
  imageFileInput.multiple = true;
  imageFileInput.style.display = 'none';
  document.body.appendChild(imageFileInput);

  let managerInstance: ImageManagerInstance | null = null;
  let lastExtractedDir: string | null = null;

  async function open(extractedDir: string, selectImage?: string): Promise<void> {
    lastExtractedDir = extractedDir;
    const { images, items, gamedata } = await loadImageManagerData(extractedDir, {
      readFile: deps.readFile,
    });

    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    if (!managerInstance) {
      managerInstance = initImageManagerComponent(
        {
          listBody: document.getElementById('image-list-body')!,
          filterInput: document.getElementById('image-filter') as HTMLInputElement,
          previewImg: document.getElementById('image-preview') as HTMLImageElement,
          previewPlaceholder: document.getElementById('image-preview-placeholder')!,
          detailName: document.getElementById('image-detail-name')!,
          detailDims: document.getElementById('image-detail-dims')!,
          detailFormat: document.getElementById('image-detail-format')!,
          usedByList: document.getElementById('image-used-by-list')!,
          statusEl,
          contextMenu: document.getElementById('image-context-menu')!,
        },
        {
          readFile: deps.readFile,
          readBinaryFile: deps.readBinaryFile,
          writeBinaryFile: deps.writeBinaryFile,
          writeFile: deps.writeFile,
          getImageInfo: async path => {
            try {
              const data = await deps.readBinaryFile(path);
              let width = 0,
                height = 0;
              if (data[0] === 0x89 && data[1] === 0x50) {
                width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
                height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
              } else if (data[0] === 0xff && data[1] === 0xd8) {
                let offset = 2;
                while (offset < data.length) {
                  if (data[offset] !== 0xff) break;
                  const marker = data[offset + 1];
                  if (marker === 0xc0 || marker === 0xc2) {
                    height = (data[offset + 5] << 8) | data[offset + 6];
                    width = (data[offset + 7] << 8) | data[offset + 8];
                    break;
                  }
                  const length = (data[offset + 2] << 8) | data[offset + 3];
                  offset += 2 + length;
                }
              }
              return { success: width > 0 && height > 0, width, height };
            } catch {
              return { success: false };
            }
          },
          renameFile: deps.renameFile,
          deleteFile: deps.deleteFile,
          showConfirm: async (message: string) => confirm(message),
          openRenamePrompt: (currentName: string, existingNames: string[]) => {
            prompt
              .show({
                mode: 'rename',
                entityType: 'image',
                currentName,
                existingNames,
              })
              .then(result => {
                if (result.submitted && result.value) {
                  managerInstance?.performRename(currentName, result.value);
                }
              });
          },
          exportImage: async (srcPath: string, fileName: string) => {
            const data = await deps.readBinaryFile(srcPath);
            const blob = new Blob([new Uint8Array(data)]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          },
          onImagesChanged: deps.onImagesChanged,
          undoBegin: deps.undoBegin,
          undoEnd: deps.undoEnd,
          undoMarkImages: deps.undoMarkImages,
          undoMarkImageCreate: deps.undoMarkImageCreate,
          undoMarkImageDelete: deps.undoMarkImageDelete,
          undoMarkForUndo: deps.undoMarkForUndo,
          undoMarkGamedata: deps.undoMarkGamedata,
        },
        { extractedDir, images, items, gamedata }
      );
    } else {
      managerInstance.setData({ extractedDir, images, items, gamedata });
    }

    managerInstance.setSelectedImage(null);
    (document.getElementById('image-filter') as HTMLInputElement).value = '';
    document.getElementById('image-preview')!.style.display = 'none';
    document.getElementById('image-preview-placeholder')!.style.display = 'block';
    document.getElementById('image-detail-name')!.textContent = '-';
    document.getElementById('image-detail-dims')!.textContent = '-';
    document.getElementById('image-detail-format')!.textContent = '-';
    document.getElementById('image-used-by-list')!.innerHTML = '';

    await managerInstance.renderList();
    statusEl.textContent = `Loaded ${Object.keys(images).length} images`;
    modal.classList.remove('hidden');
    if (selectImage) {
      await managerInstance.selectImageByName(selectImage);
    }
  }

  function close(): void {
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);

  importBtn.addEventListener('click', () => imageFileInput.click());

  imageFileInput.addEventListener('change', async () => {
    if (imageFileInput.files && imageFileInput.files.length > 0 && managerInstance) {
      await managerInstance.importImages(imageFileInput.files);
      imageFileInput.value = '';
    }
  });

  function isOpen(): boolean {
    return !modal.classList.contains('hidden');
  }

  async function refresh(): Promise<void> {
    if (isOpen() && lastExtractedDir) {
      await open(lastExtractedDir);
    }
  }

  return {
    open,
    close,
    setTheme: (theme: string) => modal.setAttribute('data-theme', theme),
    refresh,
    isOpen,
  };
}

export { loadImageManagerData };
export type { ImageData, GameItem };
