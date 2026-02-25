import { initImageManagerComponent, loadImageManagerData, type ImageManagerInstance } from '../shared/component';
import { getImageDimensions, hdrFloatDataToDataUrl, type ImageData, type GameItem } from '../shared/core';
import { initWebPrompt } from '../../prompt/web/component';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import templateHtml from './template.html?raw';

const exrLoader = new EXRLoader();
const rgbeLoader = new RGBELoader();

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
  imageFileInput.accept = 'image/png,image/jpeg,image/webp,image/bmp,.png,.jpg,.jpeg,.webp,.bmp,.hdr,.exr';
  imageFileInput.multiple = true;
  imageFileInput.style.display = 'none';
  document.body.appendChild(imageFileInput);

  let managerInstance: ImageManagerInstance | null = null;
  let lastExtractedDir: string | null = null;

  async function open(extractedDir: string, selectImage?: string): Promise<void> {
    lastExtractedDir = extractedDir;
    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);
    statusEl.textContent = 'Loading...';
    modal.classList.remove('hidden');

    const { images, items, gamedata } = await loadImageManagerData(extractedDir, {
      readFile: deps.readFile,
    });

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
              const dims = getImageDimensions(data);
              return dims ? { success: true, width: dims.width, height: dims.height } : { success: false };
            } catch {
              return { success: false };
            }
          },
          renderHdrToDataUrl: async (data: Uint8Array, ext: string): Promise<string | null> => {
            try {
              const buffer =
                data.buffer.byteLength === data.byteLength
                  ? data.buffer
                  : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
              const parsed = ext === '.exr' ? (exrLoader as any).parse(buffer) : (rgbeLoader as any).parse(buffer);
              const isHalf = parsed.data instanceof Uint16Array;
              return hdrFloatDataToDataUrl(parsed.width, parsed.height, parsed.data, isHalf);
            } catch {
              return null;
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
