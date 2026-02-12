import type { OpfsFileSystem } from '../platform/web/file-system';
import { runAllUpgrades, type FileSystemAdapter } from '../shared/table-upgrades';
import { state, EXTRACTED_DIR, TEMPLATES, getEvents, updateWindowTitle, markClean } from './state';
import type { VpxFiles } from '../platform/types';

const ROOT_DIR = '/vpx';

function createFsAdapter(opfs: OpfsFileSystem): FileSystemAdapter {
  return {
    exists: (path: string) => opfs.exists(path),
    readFile: (path: string) => opfs.readFile(path),
    writeFile: (path: string, content: string) => opfs.writeFile(path, content),
    deleteFile: (path: string) => opfs.deleteFile(path),
    listDir: (path: string) => opfs.listDir(path),
  };
}

export function updateLockTableMenuItem(): void {
  const menuItem = document.getElementById('menu-lock-table');
  if (menuItem) {
    menuItem.textContent = state.globalIsTableLocked ? 'Unlock Table' : 'Lock Table';
  }
}

export async function handleLockTable(): Promise<void> {
  if (!state.tableLoaded || !state.platform) return;
  const events = getEvents();

  const message = state.globalIsTableLocked
    ? 'This table is locked to avoid modification.\n\nYou do not need to unlock it to adjust settings like the camera or rendering options.\n\nAre you sure you want to unlock the table?'
    : 'Lock this table?\n\nThis will lock the table to prevent unexpected modifications.';

  const confirmed = confirm(message);
  if (!confirmed) return;

  try {
    const gamedataPath = `${EXTRACTED_DIR}/gamedata.json`;
    const gamedataContent = await state.platform.fileSystem.readFile(gamedataPath);
    const gamedata = JSON.parse(gamedataContent);
    gamedata.locked = (gamedata.locked || 0) + 1;
    state.globalIsTableLocked = (gamedata.locked & 1) !== 0;
    await state.platform.fileSystem.writeFile(gamedataPath, JSON.stringify(gamedata, null, 2));

    updateLockTableMenuItem();
    events.emit('table-lock-changed', state.globalIsTableLocked);
  } catch (error) {
    console.error('Failed to toggle table lock:', error);
  }
}

export async function openVpxFile(file: File): Promise<void> {
  if (!state.platform) throw new Error('Platform not initialized');
  const events = getEvents();

  events.emit('loading', { show: true });
  events.emit('status', `Loading ${file.name}...`);
  events.emit('console-open');
  events.emit('console-output', { type: 'info', text: `Opening: ${file.name}` });

  try {
    const arrayBuffer = await file.arrayBuffer();
    const vpxData = new Uint8Array(arrayBuffer);

    const wasmProgress = (message: string) => {
      events.emit('console-output', { type: 'info', text: message });
      events.emit('status', message);
    };

    wasmProgress('Parsing VPX file...');
    const files = await state.platform.vpxEngine.extract(vpxData, wasmProgress);

    const opfs = state.platform.fileSystem as OpfsFileSystem;
    await opfs.clear();

    const fileEntries = Object.entries(files);
    const totalFiles = fileEntries.length;
    for (let i = 0; i < fileEntries.length; i++) {
      const [filePath, data] = fileEntries[i];
      const relativePath = filePath.replace(ROOT_DIR, EXTRACTED_DIR);
      try {
        await opfs.writeBinaryFile(relativePath, data);
      } catch (e) {
        console.warn(`Failed to write file ${filePath}:`, e);
      }
      delete files[filePath];
      if ((i + 1) % 10 === 0 || i === totalFiles - 1) {
        events.emit('status', `Extracting files... ${i + 1}/${totalFiles}`);
      }
    }

    events.emit('console-output', { type: 'success', text: `Extracted ${totalFiles} files` });

    const fsAdapter = createFsAdapter(opfs);
    await runAllUpgrades(fsAdapter, EXTRACTED_DIR, (type, text) => {
      events.emit('console-output', { type, text });
    });

    state.tableLoaded = true;
    state.currentFileName = file.name;
    state.isTableDirty = false;
    updateWindowTitle();

    try {
      const gamedataContent = await state.platform.fileSystem.readFile(`${EXTRACTED_DIR}/gamedata.json`);
      const gamedata = JSON.parse(gamedataContent);
      state.globalIsTableLocked = ((gamedata.locked || 0) & 1) !== 0;
    } catch {
      state.globalIsTableLocked = false;
    }
    updateLockTableMenuItem();

    events.emit('table-loaded', {
      extractedDir: EXTRACTED_DIR,
      vpxPath: file.name,
      tableName: file.name.replace('.vpx', ''),
      isTableLocked: state.globalIsTableLocked,
    });

    events.emit('status', 'Loaded');
    updateMenuState();
  } catch (error) {
    events.emit('console-output', { type: 'error', text: `Error: ${error}` });
    events.emit('status', `Error: ${error}`);
    throw error;
  } finally {
    events.emit('loading', { show: false });
  }
}

export async function saveVpxFile(onProgress?: (message: string) => void): Promise<Uint8Array> {
  if (!state.tableLoaded || !state.platform) {
    throw new Error('No VPX file loaded');
  }

  const events = getEvents();
  const opfs = state.platform.fileSystem as OpfsFileSystem;
  const allFiles = await opfs.getAllPaths();
  const opfsFiles = allFiles.filter(f => f.startsWith(EXTRACTED_DIR));

  const totalFiles = opfsFiles.length;
  const files: VpxFiles = {};
  for (let i = 0; i < opfsFiles.length; i++) {
    const opfsPath = opfsFiles[i];
    const wasmPath = opfsPath.replace(EXTRACTED_DIR, ROOT_DIR);
    const data = await opfs.readBinaryFile(opfsPath);
    files[wasmPath] = data;
    if ((i + 1) % 10 === 0 || i === totalFiles - 1) {
      onProgress?.(`Reading files... ${i + 1}/${totalFiles}`);
    }
  }

  const wasmProgress = (msg: string) => {
    events.emit('console-output', { type: 'info', text: msg });
    onProgress?.(msg);
  };

  wasmProgress('Assembling VPX...');
  const result = state.platform.vpxEngine.assemble(files, wasmProgress);
  events.emit('console-output', { type: 'success', text: `Assembled ${totalFiles} files` });
  return result;
}

async function saveToHandle(handle: FileSystemFileHandle, bytes: Uint8Array): Promise<void> {
  const writable = await handle.createWritable();
  const buffer = new Uint8Array(bytes).buffer;
  await writable.write(new Blob([buffer]));
  await writable.close();
}

async function getNewSaveHandle(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if ('showSaveFilePicker' in window) {
    try {
      return await (
        window as Window & { showSaveFilePicker: (options?: object) => Promise<FileSystemFileHandle> }
      ).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'VPX Files',
            accept: { 'application/octet-stream': ['.vpx'] },
          },
        ],
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }
  return null;
}

function downloadFile(bytes: Uint8Array, fileName: string): void {
  const buffer = new Uint8Array(bytes).buffer;
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function handleSave(): Promise<void> {
  const events = getEvents();
  const handle = state.currentFileHandle || (await getNewSaveHandle(state.currentFileName));

  if (!handle && 'showSaveFilePicker' in window) {
    events.emit('status', 'Save cancelled');
    return;
  }

  try {
    events.emit('loading', { show: true });
    events.emit('status', 'Saving...');
    events.emit('console-open');

    const progressCallback = (message: string) => {
      events.emit('status', message);
    };

    const bytes = await saveVpxFile(progressCallback);

    if (handle) {
      await saveToHandle(handle, bytes);
      if (!state.currentFileHandle) {
        state.currentFileHandle = handle;
        state.currentFileName = handle.name;
      }
    } else {
      downloadFile(bytes, state.currentFileName);
    }

    markClean();
    updateWindowTitle();
    const fileName = state.currentFileName || 'table.vpx';
    events.emit('console-output', { type: 'success', text: `Saved to ${fileName}` });
    events.emit('status', `Saved to ${fileName}`);
    events.emit('mark-save-point');
  } catch (error) {
    events.emit('console-output', { type: 'error', text: `Error: ${error}` });
    events.emit('status', `Error: ${error}`);
    alert(`Failed to save: ${error}`);
  } finally {
    events.emit('loading', { show: false });
  }
}

export async function handleSaveAs(): Promise<void> {
  const events = getEvents();
  const handle = await getNewSaveHandle(state.currentFileName);

  if (!handle && 'showSaveFilePicker' in window) {
    events.emit('status', 'Save cancelled');
    return;
  }

  try {
    events.emit('loading', { show: true });
    events.emit('status', 'Saving...');
    events.emit('console-open');

    const progressCallback = (message: string) => {
      events.emit('status', message);
    };

    const bytes = await saveVpxFile(progressCallback);

    if (handle) {
      await saveToHandle(handle, bytes);
      state.currentFileHandle = handle;
      state.currentFileName = handle.name;
    } else {
      downloadFile(bytes, state.currentFileName);
    }

    markClean();
    updateWindowTitle();
    const fileName = state.currentFileName || 'table.vpx';
    events.emit('console-output', { type: 'success', text: `Saved to ${fileName}` });
    events.emit('status', `Saved to ${fileName}`);
    events.emit('mark-save-point');
  } catch (error) {
    events.emit('console-output', { type: 'error', text: `Error: ${error}` });
    events.emit('status', `Error: ${error}`);
    alert(`Failed to save: ${error}`);
  } finally {
    events.emit('loading', { show: false });
  }
}

export function isTableLoaded(): boolean {
  return state.tableLoaded;
}

let isBackglassMode = false;

export function setBackglassMode(mode: boolean): void {
  isBackglassMode = mode;
}

export function updateMenuState(): void {
  const tableLoaded = isTableLoaded();
  const menu = document.getElementById('menu-dropdown');
  if (!menu) return;

  const openActions = ['new-table', 'new-blank', 'new-example', 'new-lightseq', 'open'];
  const saveActions = ['save', 'save-as', 'close', 'export-blueprint'];

  menu.querySelectorAll('.menu-item[data-action]').forEach(item => {
    const action = (item as HTMLElement).dataset.action;
    if (!action) return;

    if (openActions.includes(action)) {
      item.classList.toggle('disabled', tableLoaded);
    } else if (saveActions.includes(action)) {
      item.classList.toggle('disabled', !tableLoaded);
    }
  });

  const tableRequiredMenus = ['menu-edit', 'menu-view', 'menu-insert', 'menu-table'];
  tableRequiredMenus.forEach(menuId => {
    const menuEl = document.getElementById(menuId);
    if (menuEl) {
      menuEl.classList.toggle('disabled', !tableLoaded);
    }
  });

  const insertMenu = document.getElementById('insert-menu');
  if (insertMenu) {
    insertMenu.querySelectorAll('.menu-item').forEach(item => {
      const el = item as HTMLElement;
      const playfieldOnly = el.dataset.playfieldOnly === 'true';
      const backglassOnly = el.dataset.backglassOnly === 'true';

      if (playfieldOnly) {
        el.classList.toggle('disabled', isBackglassMode);
      } else if (backglassOnly) {
        el.classList.toggle('disabled', !isBackglassMode);
      }
    });
  }
}

export async function handleClose(): Promise<void> {
  if (!state.tableLoaded || !state.platform) return;
  const events = getEvents();

  state.tableLoaded = false;
  state.currentFileHandle = null;
  state.currentFileName = 'table.vpx';
  state.globalIsTableLocked = false;
  state.isTableDirty = false;
  updateLockTableMenuItem();

  const opfs = state.platform.fileSystem as OpfsFileSystem;
  await opfs.clear();

  document.title = 'VPX Editor';
  events.emit('table-closed');
  events.emit('status', 'Table closed');
  updateMenuState();
}

export async function openFilePicker(): Promise<void> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (
        window as Window & { showOpenFilePicker: (options?: object) => Promise<FileSystemFileHandle[]> }
      ).showOpenFilePicker({
        types: [
          {
            description: 'VPX Files',
            accept: { 'application/octet-stream': ['.vpx'] },
          },
        ],
      });
      const file = await handle.getFile();
      await openVpxFile(file);
      state.currentFileHandle = handle;
      state.currentFileName = file.name;
      state.isTableDirty = false;
      updateWindowTitle();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to open file:', err);
      }
    }
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.vpx';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (file) {
      await openVpxFile(file);
      state.currentFileHandle = null;
      state.currentFileName = file.name;
      state.isTableDirty = false;
      updateWindowTitle();
    }
  };
  input.click();
}

export async function loadTemplate(templateKey: string): Promise<void> {
  if (!state.platform) return;
  const events = getEvents();
  const template = TEMPLATES[templateKey];
  if (!template) return;

  events.emit('loading', { show: true });
  events.emit('status', `Loading ${template.name}...`);

  try {
    const base = import.meta.env.BASE_URL || './';
    const response = await fetch(`${base}templates/${template.file}`);
    if (!response.ok) throw new Error(`Failed to fetch template: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    const file = new File([blob], template.file, { type: 'application/octet-stream' });
    await openVpxFile(file);
    state.currentFileHandle = null;
    state.currentFileName = template.file;
    state.isTableDirty = false;
    updateWindowTitle();
  } catch (error) {
    events.emit('status', `Error: ${error}`);
    console.error('Failed to load template:', error);
  } finally {
    events.emit('loading', { show: false });
  }
}
