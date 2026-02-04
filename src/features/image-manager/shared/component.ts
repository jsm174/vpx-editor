import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  findImageUsage,
  sortImages,
  type ImageData,
  type GameItem,
  IMAGE_PROPERTIES,
  TABLE_IMAGE_PROPERTIES,
} from './core';
import { addLongPressContextMenu } from '../../../shared/long-press';

export interface ImageManagerCallbacks {
  readFile: (path: string) => Promise<string>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
  writeBinaryFile: (path: string, data: Uint8Array) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  getImageInfo: (path: string) => Promise<{ success: boolean; width?: number; height?: number }>;
  renameFile?: (oldPath: string, newPath: string) => Promise<void>;
  deleteFile?: (path: string) => Promise<void>;
  showConfirm?: (message: string) => Promise<boolean>;
  importImage?: () => Promise<{ success: boolean; name?: string; originalPath?: string; error?: string }>;
  exportImage?: (srcPath: string, fileName: string) => Promise<void>;
  selectItem?: (name: string) => void;
  updateItemImage?: (itemName: string, itemType: string, oldName: string, newName: string) => Promise<void>;
  onImagesChanged?: () => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => void;
  undoCancel?: () => void;
  undoMarkImages?: () => void;
  undoMarkImageCreate?: (name: string) => void;
  undoMarkImageDelete?: (name: string, imageData: ImageData, path: string) => void;
  undoMarkForUndo?: (itemName: string) => void;
  undoMarkGamedata?: () => void;
  openRenamePrompt?: (currentName: string, existingNames: string[]) => void;
}

export async function loadImageManagerData(
  extractedDir: string,
  callbacks: Pick<ImageManagerCallbacks, 'readFile'>
): Promise<{
  images: Record<string, ImageData>;
  items: Record<string, GameItem>;
  gamedata: Record<string, unknown> | null;
}> {
  let images: Record<string, ImageData> = {};
  let items: Record<string, GameItem> = {};
  let gamedata: Record<string, unknown> | null = null;

  try {
    const imagesJson = await callbacks.readFile(`${extractedDir}/images.json`);
    const imagesArray = JSON.parse(imagesJson) as ImageData[];
    for (const img of imagesArray) {
      if (img.name) images[img.name] = img;
    }
  } catch {
    /* empty */
  }

  try {
    const gameitemsJson = await callbacks.readFile(`${extractedDir}/gameitems.json`);
    const gameitemsList = JSON.parse(gameitemsJson) as { file_name: string }[];
    for (const gi of gameitemsList) {
      const fileName = gi.file_name || '';
      try {
        const itemJson = await callbacks.readFile(`${extractedDir}/gameitems/${fileName}`);
        const itemData = JSON.parse(itemJson);
        const type = Object.keys(itemData)[0];
        const item = itemData[type];
        item._type = type;
        items[item.name || fileName] = item;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* empty */
  }

  try {
    const gamedataJson = await callbacks.readFile(`${extractedDir}/gamedata.json`);
    gamedata = JSON.parse(gamedataJson);
  } catch {
    /* empty */
  }

  return { images, items, gamedata };
}

export interface ImageManagerData {
  extractedDir: string;
  images: Record<string, ImageData>;
  items: Record<string, GameItem>;
  gamedata: Record<string, unknown> | null;
  theme?: string;
}

export interface ImageManagerElements {
  listBody: HTMLElement;
  filterInput: HTMLInputElement;
  previewImg: HTMLImageElement;
  previewPlaceholder: HTMLElement;
  detailName: HTMLElement;
  detailDims: HTMLElement;
  detailFormat: HTMLElement;
  detailAlpha?: HTMLElement;
  usedByList: HTMLElement;
  statusEl: HTMLElement;
  importBtn?: HTMLElement;
  contextMenu?: HTMLElement;
  renameOverlay?: HTMLElement;
  renameInput?: HTMLInputElement;
  renameError?: HTMLElement;
  renameOkBtn?: HTMLElement;
  renameCancelBtn?: HTMLElement;
}

export interface ImageManagerInstance {
  renderList: (filter?: string) => Promise<void>;
  selectImage: (name: string, row: HTMLElement) => Promise<void>;
  selectImageByName: (name: string) => Promise<void>;
  importImages: (files: FileList) => Promise<void>;
  importImageNative: () => Promise<void>;
  renameImage: () => Promise<void>;
  performRename: (oldName: string, newName: string) => Promise<void>;
  deleteImage: () => Promise<void>;
  exportImage: () => Promise<void>;
  getSelectedImage: () => string | null;
  setSelectedImage: (name: string | null) => void;
  getImages: () => Record<string, ImageData>;
  setImages: (newImages: Record<string, ImageData>) => void;
  getItems: () => Record<string, GameItem>;
  setItems: (newItems: Record<string, GameItem>) => void;
  getGamedata: () => Record<string, unknown> | null;
  setGamedata: (newGamedata: Record<string, unknown> | null) => void;
  setData: (data: ImageManagerData) => void;
  setUIDisabled: (disabled: boolean) => void;
  clearPreview: () => void;
  destroy: () => void;
}

interface ImageInfoCacheEntry {
  width: number;
  height: number;
  format: string;
  path: string;
  ext: string;
}

export function initImageManagerComponent(
  elements: ImageManagerElements,
  callbacks: ImageManagerCallbacks,
  initialData?: ImageManagerData
): ImageManagerInstance {
  let images: Record<string, ImageData> = initialData?.images || {};
  let items: Record<string, GameItem> = initialData?.items || {};
  let gamedata: Record<string, unknown> | null = initialData?.gamedata || null;
  let extractedDir = initialData?.extractedDir || '';
  let selectedImage: string | null = null;
  let sortColumn = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';
  const imageInfoCache: Record<string, ImageInfoCacheEntry> = {};

  const {
    listBody,
    filterInput,
    previewImg,
    previewPlaceholder,
    detailName,
    detailDims,
    detailFormat,
    detailAlpha,
    usedByList,
    statusEl,
    contextMenu,
    renameOverlay,
    renameInput,
    renameError,
    renameOkBtn,
    renameCancelBtn,
  } = elements;

  function setStatus(msg: string): void {
    statusEl.textContent = msg;
  }

  async function getImageInfo(imageName: string): Promise<ImageInfoCacheEntry | null> {
    if (imageInfoCache[imageName]) return imageInfoCache[imageName];

    for (const ext of IMAGE_EXTENSIONS) {
      if (ext === '.hdr') continue;
      const imagePath = `${extractedDir}/images/${imageName}${ext}`;
      try {
        const result = await callbacks.getImageInfo(imagePath);
        if (result.success && result.width && result.height) {
          const info = {
            width: result.width,
            height: result.height,
            format: ext.slice(1).toUpperCase(),
            path: imagePath,
            ext,
          };
          imageInfoCache[imageName] = info;
          return info;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async function loadThumbnail(imageName: string, imgEl: HTMLImageElement): Promise<void> {
    for (const ext of IMAGE_EXTENSIONS) {
      if (ext === '.hdr') continue;
      const imagePath = `${extractedDir}/images/${imageName}${ext}`;
      try {
        const data = await callbacks.readBinaryFile(imagePath);
        const mime = IMAGE_MIME_TYPES[ext];
        if (mime && data) {
          const blob = new Blob([new Uint8Array(data)], { type: mime });
          const url = URL.createObjectURL(blob);
          imgEl.src = url;
          imgEl.onload = () => URL.revokeObjectURL(url);
          return;
        }
      } catch {
        continue;
      }
    }
  }

  async function loadPreview(imageName: string): Promise<void> {
    for (const ext of IMAGE_EXTENSIONS) {
      if (ext === '.hdr') continue;
      const imagePath = `${extractedDir}/images/${imageName}${ext}`;
      try {
        const data = await callbacks.readBinaryFile(imagePath);
        const mime = IMAGE_MIME_TYPES[ext];
        if (mime && data) {
          const blob = new Blob([new Uint8Array(data)], { type: mime });
          const url = URL.createObjectURL(blob);
          if ((previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl) {
            URL.revokeObjectURL((previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl!);
          }
          (previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl = url;
          previewImg.src = url;
          previewImg.style.display = 'block';
          if (previewPlaceholder) previewPlaceholder.style.display = 'none';
          return;
        }
      } catch {
        continue;
      }
    }
    previewImg.style.display = 'none';
    if (previewPlaceholder) previewPlaceholder.style.display = 'block';
  }

  async function renderList(filter = ''): Promise<void> {
    const filterLower = filter.toLowerCase();

    const imageList = await Promise.all(
      Object.keys(images).map(async name => {
        const img = images[name];
        const usage = findImageUsage(name, items, gamedata);
        const info = await getImageInfo(name);
        return {
          name,
          path: img.path || '',
          alpha: img.alpha_test_value,
          used: usage.length > 0,
          usageCount: usage.length,
          width: info?.width || 0,
          height: info?.height || 0,
          format: info?.format || '',
          size: (info?.width || 0) * (info?.height || 0),
        };
      })
    );

    let filtered = imageList;
    if (filterLower) {
      filtered = imageList.filter(
        img => img.name.toLowerCase().includes(filterLower) || img.path.toLowerCase().includes(filterLower)
      );
    }

    const sorted = sortImages(filtered, sortColumn, sortDirection);

    listBody.innerHTML = '';
    for (const img of sorted) {
      const tr = document.createElement('tr');
      tr.dataset.name = img.name;
      if (img.name === selectedImage) tr.classList.add('selected');

      const thumbTd = document.createElement('td');
      const thumbImg = document.createElement('img');
      thumbImg.className = 'image-thumb';
      thumbTd.appendChild(thumbImg);
      loadThumbnail(img.name, thumbImg);

      const nameTd = document.createElement('td');
      nameTd.textContent = img.name;

      const sizeTd = document.createElement('td');
      sizeTd.textContent = img.width ? `${img.width}x${img.height}` : '-';

      const formatTd = document.createElement('td');
      formatTd.textContent = img.format || '-';

      const usedTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `used-badge ${img.used ? 'yes' : 'no'}`;
      badge.textContent = img.used ? String(img.usageCount) : 'No';
      usedTd.appendChild(badge);

      tr.append(thumbTd, nameTd, sizeTd, formatTd, usedTd);
      tr.addEventListener('click', () => selectImage(img.name, tr));
      if (contextMenu) {
        addLongPressContextMenu(tr);
        tr.addEventListener('contextmenu', e => {
          selectImage(img.name, tr);
          showContextMenu(e);
        });
      }
      listBody.appendChild(tr);
    }
  }

  async function selectImage(imageName: string, row: HTMLElement): Promise<void> {
    selectedImage = imageName;
    listBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
    row.classList.add('selected');

    detailName.textContent = imageName;
    if (detailAlpha) {
      detailAlpha.textContent = String(images[imageName]?.alpha_test_value ?? '-');
    }

    const info = await getImageInfo(imageName);
    if (info) {
      detailDims.textContent = `${info.width} x ${info.height}`;
      detailFormat.textContent = info.format;
      await loadPreview(imageName);
    } else {
      detailDims.textContent = '-';
      detailFormat.textContent = '-';
      previewImg.style.display = 'none';
      if (previewPlaceholder) previewPlaceholder.style.display = 'block';
    }

    const usage = findImageUsage(imageName, items, gamedata);
    if (usage.length === 0) {
      usedByList.innerHTML = '<div style="color: var(--text-secondary); font-size: 11px;">Not used</div>';
    } else {
      usedByList.innerHTML = '';
      for (const item of usage) {
        const div = document.createElement('div');
        div.className = 'manager-used-by-item';
        div.innerHTML = `${item.name} <span style="color: var(--text-secondary); font-size: 10px;">${item.type}</span>`;
        if (callbacks.selectItem) {
          div.style.cursor = 'pointer';
          div.addEventListener('click', () => callbacks.selectItem!(item.name));
        }
        usedByList.appendChild(div);
      }
    }
  }

  async function selectImageByName(name: string): Promise<void> {
    const row = listBody.querySelector(`tr[data-name="${name}"]`) as HTMLElement;
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await selectImage(name, row);
    }
  }

  async function saveImages(): Promise<void> {
    await callbacks.writeFile(`${extractedDir}/images.json`, JSON.stringify(Object.values(images), null, 2));
  }

  async function importImages(files: FileList): Promise<void> {
    let imported = 0;
    let lastName: string | null = null;

    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.[^.]+$/, '');
      const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.png';

      if (images[name]) {
        setStatus(`Image "${name}" already exists, skipping...`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const imagePath = `${extractedDir}/images/${name}${ext}`;
        await callbacks.writeBinaryFile(imagePath, data);

        images[name] = {
          name,
          path: file.name,
        };
        lastName = name;
        imported++;
      } catch (err) {
        setStatus(`Failed to import ${file.name}: ${err}`);
      }
    }

    if (imported > 0) {
      await saveImages();

      if (lastName) selectedImage = lastName;
      filterInput.value = '';
      await renderList('');
      setStatus(`Imported ${imported} image(s)`);

      callbacks.onImagesChanged?.();

      if (lastName) {
        await selectImageByName(lastName);
      }
    }
  }

  async function importImageNative(): Promise<void> {
    if (!callbacks.importImage) return;

    const result = await callbacks.importImage();
    if (!result.success || !result.name) {
      if (result.error) setStatus(`Import failed: ${result.error}`);
      return;
    }

    callbacks.undoBegin?.(`Import image ${result.name}`);
    callbacks.undoMarkImages?.();
    callbacks.undoMarkImageCreate?.(result.name);

    images[result.name] = {
      name: result.name,
      path: result.originalPath || '',
      alpha_test_value: 128.0,
    };
    await saveImages();
    Object.keys(imageInfoCache).forEach(key => delete imageInfoCache[key]);

    filterInput.value = '';
    selectedImage = result.name;
    await renderList('');
    await selectImageByName(result.name);

    setStatus(`Imported: ${result.name}`);
    callbacks.undoEnd?.();
    callbacks.onImagesChanged?.();
  }

  let renameCurrentName = '';

  function validateRename(): boolean {
    if (!renameInput || !renameOkBtn) return false;
    const newName = renameInput.value.trim();
    const okBtn = renameOkBtn as HTMLButtonElement;

    if (!newName) {
      okBtn.disabled = true;
      if (renameError) renameError.textContent = 'Name cannot be empty';
      return false;
    }

    if (newName === renameCurrentName) {
      okBtn.disabled = true;
      if (renameError) renameError.textContent = '';
      return false;
    }

    const exists = images[newName] !== undefined;
    if (exists) {
      okBtn.disabled = true;
      if (renameError) renameError.textContent = 'Image already exists';
      return false;
    }

    okBtn.disabled = false;
    if (renameError) renameError.textContent = '';
    return true;
  }

  function openRenameDialog(): void {
    if (!selectedImage || !renameOverlay || !renameInput) return;
    renameCurrentName = selectedImage;
    renameInput.value = selectedImage;
    if (renameError) renameError.textContent = '';
    renameOverlay.classList.remove('hidden');
    renameInput.focus();
    renameInput.select();
    validateRename();
  }

  function closeRenameDialog(): void {
    if (renameOverlay) renameOverlay.classList.add('hidden');
  }

  async function executeRename(): Promise<void> {
    if (!selectedImage || !renameInput || !validateRename()) return;

    const newName = renameInput.value.trim();

    if (images[newName]) {
      setStatus(`Image "${newName}" already exists`);
      return;
    }

    const info = await getImageInfo(selectedImage);
    if (!info) {
      setStatus('Could not find image file');
      return;
    }

    const oldName = selectedImage;
    const oldPath = info.path;
    const newPath = `${extractedDir}/images/${newName}${info.ext}`;

    callbacks.undoBegin?.(`Rename image ${oldName}`);
    callbacks.undoMarkImages?.();

    const affectedItems: string[] = [];
    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = IMAGE_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          affectedItems.push(itemName);
          callbacks.undoMarkForUndo?.(itemName);
          break;
        }
      }
    }

    let gamedataWillChange = false;
    if (gamedata) {
      for (const prop of TABLE_IMAGE_PROPERTIES) {
        if (gamedata[prop] === oldName) {
          gamedataWillChange = true;
          break;
        }
      }
      if (gamedataWillChange) {
        callbacks.undoMarkGamedata?.();
      }
    }

    if (callbacks.renameFile) {
      try {
        await callbacks.renameFile(oldPath, newPath);
      } catch (err) {
        setStatus(`Rename failed: ${err}`);
        callbacks.undoCancel?.();
        return;
      }
    }

    const imgData = images[oldName];
    delete images[oldName];
    imgData.name = newName;
    images[newName] = imgData;
    delete imageInfoCache[oldName];

    await saveImages();

    let updatedCount = 0;
    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = IMAGE_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;

      let itemModified = false;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          (item as Record<string, unknown>)[prop] = newName;
          itemModified = true;
        }
      }

      if (itemModified) {
        updatedCount++;
        await callbacks.updateItemImage?.(itemName, item._type, oldName, newName);
      }
    }

    if (gamedata) {
      let gamedataModified = false;
      for (const prop of TABLE_IMAGE_PROPERTIES) {
        if (gamedata[prop] === oldName) {
          gamedata[prop] = newName;
          gamedataModified = true;
        }
      }
      if (gamedataModified) {
        await callbacks.writeFile(`${extractedDir}/gamedata.json`, JSON.stringify(gamedata, null, 2));
      }
    }

    selectedImage = newName;
    Object.keys(imageInfoCache).forEach(key => delete imageInfoCache[key]);
    closeRenameDialog();
    await renderList(filterInput.value);
    await selectImageByName(newName);

    const statusMsg =
      updatedCount > 0
        ? `Renamed to: ${newName} (updated ${updatedCount} object${updatedCount > 1 ? 's' : ''})`
        : `Renamed to: ${newName}`;
    setStatus(statusMsg);
    callbacks.undoEnd?.();
    callbacks.onImagesChanged?.();
  }

  async function renameImage(): Promise<void> {
    if (!selectedImage) return;
    if (callbacks.openRenamePrompt) {
      callbacks.openRenamePrompt(selectedImage, Object.keys(images));
    } else {
      openRenameDialog();
    }
  }

  async function performRename(oldName: string, newName: string): Promise<void> {
    if (!oldName || !newName || oldName === newName) return;

    if (images[newName]) {
      setStatus(`Image "${newName}" already exists`);
      return;
    }

    const info = await getImageInfo(oldName);
    if (!info) {
      setStatus('Could not find image file');
      return;
    }

    const oldPath = info.path;
    const newPath = `${extractedDir}/images/${newName}${info.ext}`;

    callbacks.undoBegin?.(`Rename image ${oldName}`);
    callbacks.undoMarkImages?.();

    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = IMAGE_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          callbacks.undoMarkForUndo?.(itemName);
          break;
        }
      }
    }

    let gamedataWillChange = false;
    if (gamedata) {
      for (const prop of TABLE_IMAGE_PROPERTIES) {
        if (gamedata[prop] === oldName) {
          gamedataWillChange = true;
          break;
        }
      }
      if (gamedataWillChange) {
        callbacks.undoMarkGamedata?.();
      }
    }

    if (callbacks.renameFile) {
      try {
        await callbacks.renameFile(oldPath, newPath);
      } catch (err) {
        setStatus(`Rename failed: ${err}`);
        callbacks.undoCancel?.();
        return;
      }
    }

    const imgData = images[oldName];
    delete images[oldName];
    imgData.name = newName;
    images[newName] = imgData;
    delete imageInfoCache[oldName];

    await saveImages();

    let updatedCount = 0;
    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = IMAGE_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;

      let itemModified = false;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          (item as Record<string, unknown>)[prop] = newName;
          itemModified = true;
        }
      }

      if (itemModified) {
        updatedCount++;
        await callbacks.updateItemImage?.(itemName, item._type, oldName, newName);
      }
    }

    if (gamedata) {
      let gamedataModified = false;
      for (const prop of TABLE_IMAGE_PROPERTIES) {
        if (gamedata[prop] === oldName) {
          gamedata[prop] = newName;
          gamedataModified = true;
        }
      }
      if (gamedataModified) {
        await callbacks.writeFile(`${extractedDir}/gamedata.json`, JSON.stringify(gamedata, null, 2));
      }
    }

    selectedImage = newName;
    await renderList(filterInput.value);
    const row = listBody.querySelector(`tr[data-name="${newName}"]`);
    if (row) await selectImage(newName, row as HTMLElement);

    const statusMsg =
      updatedCount > 0 ? `Renamed to "${newName}", updated ${updatedCount} items` : `Renamed to "${newName}"`;
    setStatus(statusMsg);
    callbacks.undoEnd?.();
    callbacks.onImagesChanged?.();
  }

  async function deleteImage(): Promise<void> {
    if (!selectedImage) return;

    const usage = findImageUsage(selectedImage, items, gamedata);
    let msg = `Delete image "${selectedImage}"?`;
    if (usage.length > 0) {
      msg = `"${selectedImage}" is used by ${usage.length} object(s). Delete anyway?`;
    }

    if (callbacks.showConfirm) {
      const confirmed = await callbacks.showConfirm(msg);
      if (!confirmed) return;
    }

    const info = await getImageInfo(selectedImage);
    const imageData = images[selectedImage];

    callbacks.undoBegin?.(`Delete image ${selectedImage}`);
    callbacks.undoMarkImages?.();
    if (info && imageData) {
      callbacks.undoMarkImageDelete?.(selectedImage, imageData, info.path);
    }

    if (info && callbacks.deleteFile) {
      await callbacks.deleteFile(info.path);
    }

    const deletedName = selectedImage;
    delete images[deletedName];
    delete imageInfoCache[deletedName];
    await saveImages();

    setStatus(`Deleted: ${deletedName}`);
    selectedImage = null;
    clearPreview();
    await renderList(filterInput.value);
    callbacks.undoEnd?.();
    callbacks.onImagesChanged?.();
  }

  async function exportImage(): Promise<void> {
    if (!selectedImage || !callbacks.exportImage) return;

    const info = await getImageInfo(selectedImage);
    if (!info) {
      setStatus('Could not find image file');
      return;
    }

    await callbacks.exportImage(info.path, selectedImage + info.ext);
    setStatus(`Exported: ${selectedImage}`);
  }

  function clearPreview(): void {
    if ((previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl) {
      URL.revokeObjectURL((previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl!);
      (previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl = undefined;
    }
    previewImg.style.display = 'none';
    if (previewPlaceholder) previewPlaceholder.style.display = 'block';
    detailName.textContent = '-';
    detailDims.textContent = '-';
    detailFormat.textContent = '-';
    if (detailAlpha) detailAlpha.textContent = '-';
    usedByList.innerHTML = '';
  }

  function setUIDisabled(disabled: boolean): void {
    if (elements.importBtn instanceof HTMLButtonElement) elements.importBtn.disabled = disabled;
    if (filterInput instanceof HTMLInputElement) filterInput.disabled = disabled;
  }

  function showContextMenu(e: MouseEvent): void {
    if (!contextMenu) return;
    e.preventDefault();
    contextMenu.classList.remove('hidden');
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
  }

  function hideContextMenu(): void {
    if (!contextMenu) return;
    contextMenu.classList.add('hidden');
  }

  function handleContextMenuClick(e: Event): void {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;
    hideContextMenu();
    switch (action) {
      case 'rename':
        renameImage();
        break;
      case 'export':
        exportImage();
        break;
      case 'delete':
        deleteImage();
        break;
    }
  }

  function handleDocumentClick(e: MouseEvent): void {
    if (contextMenu && !(e.target as HTMLElement).closest('.context-menu')) {
      hideContextMenu();
    }
  }

  function handleDocumentKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') hideContextMenu();
  }

  if (contextMenu) {
    contextMenu.addEventListener('click', handleContextMenuClick);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeydown);
  }

  function setupSortHeaders(): void {
    const headerRow = listBody.closest('table')?.querySelector('thead tr');
    if (!headerRow) return;

    headerRow.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = (th as HTMLElement).dataset.sort!;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        headerRow.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        renderList(filterInput.value);
      });
    });
  }

  setupSortHeaders();

  filterInput.addEventListener('input', () => {
    renderList(filterInput.value);
  });

  if (renameInput) {
    renameInput.addEventListener('input', validateRename);
    renameInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') executeRename();
      else if (e.key === 'Escape') closeRenameDialog();
    });
  }
  if (renameOkBtn) renameOkBtn.addEventListener('click', executeRename);
  if (renameCancelBtn) renameCancelBtn.addEventListener('click', closeRenameDialog);

  function setData(data: ImageManagerData): void {
    extractedDir = data.extractedDir;
    images = data.images || {};
    items = data.items || {};
    gamedata = data.gamedata;
    Object.keys(imageInfoCache).forEach(key => delete imageInfoCache[key]);
  }

  function destroy(): void {
    if ((previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl) {
      URL.revokeObjectURL((previewImg as HTMLImageElement & { _blobUrl?: string })._blobUrl!);
    }
    if (contextMenu) {
      contextMenu.removeEventListener('click', handleContextMenuClick);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleDocumentKeydown);
    }
  }

  return {
    renderList,
    selectImage,
    selectImageByName,
    importImages,
    importImageNative,
    renameImage,
    performRename,
    deleteImage,
    exportImage,
    getSelectedImage: () => selectedImage,
    setSelectedImage: (name: string | null) => {
      selectedImage = name;
    },
    getImages: () => images,
    setImages: (newImages: Record<string, ImageData>) => {
      images = newImages;
    },
    getItems: () => items,
    setItems: (newItems: Record<string, GameItem>) => {
      items = newItems;
    },
    getGamedata: () => gamedata,
    setGamedata: (newGamedata: Record<string, unknown> | null) => {
      gamedata = newGamedata;
    },
    setData,
    setUIDisabled,
    clearPreview,
    destroy,
  };
}
