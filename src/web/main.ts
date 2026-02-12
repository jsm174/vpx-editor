import { createPlatform } from '../platform/index';
import './main.css';
import '../shared/manager-modal.css';
import '../features/collection-manager/web/styles.css';
import '../features/image-manager/web/styles.css';
import '../features/sound-manager/web/styles.css';
import '../features/material-manager/web/styles.css';
import '../features/dimensions-manager/web/styles.css';
import '../features/render-probe-manager/web/styles.css';
import '../features/mesh-import/web/styles.css';
import '../features/transform/web/styles.css';
import '../features/prompt/web/styles.css';
import type { EditorSettings, PanelSettings, ConsoleSettings } from '../types/ipc';
import { initWebSettings } from '../features/settings/web/component';
import { initWebAbout } from '../features/about/web/component';
import { initWebTransform } from '../features/transform/web/component';
import { initWebMeshImport } from '../features/mesh-import/web/component';
import {
  VPINBALL_API,
  parseScriptFunctions,
  generateEventHandler,
  findEventHandler,
  getEventsForItemType,
  injectScriptEditorTemplate,
  type ParsedFunction,
  type ScriptGameItem,
} from '../features/script-editor/web/component';
import { initWebImageManager } from '../features/image-manager/web/component';
import { initWebSoundManager } from '../features/sound-manager/web/component';
import { initWebTableInfo } from '../features/table-info/web/component';
import { initWebDimensionsManager } from '../features/dimensions-manager/web/component';
import { initWebMaterialManager } from '../features/material-manager/web/component';
import { initWebRenderProbeManager } from '../features/render-probe-manager/web/component';
import {
  initWebCollectionManager,
  setupCollectionManagerKeyboard,
  type Collection,
} from '../features/collection-manager/web/component';
import { initWebSelectElement, type WebSelectElementInstance } from '../features/search-select/web/component';
import {
  initWebDrawingOrder,
  reorderGameitems,
  type DrawingOrderItem,
  type DrawingOrderMode,
} from '../features/drawing-order/web/component';
import { initWebPrompt, type WebPromptInstance } from '../features/prompt/web/component';
import './api-stub';

import { state, EXTRACTED_DIR, getEvents, updateWindowTitle } from './state';
import { undoManager } from '../editor/undo/index';
import { handleLockTable, openVpxFile, handleSave, isTableLoaded, openFilePicker } from './vpx-file-operations';
import { applyTheme, resolveTheme } from './theme';
import { setupMenu, getIsBackglassMode, setIsBackglassMode } from './menu-setup';

declare global {
  interface Window {
    __vpxEvents: {
      on(event: string, callback: Function): () => void;
      off(event: string, callback: Function): void;
      emit(event: string, ...args: unknown[]): void;
    };
    selectedItems: string[];
  }
}

window.selectedItems = [];

const events = getEvents();
let promptInstance: WebPromptInstance | null = null;

import type { WebImageManagerInstance } from '../features/image-manager/web/component';
import type { WebMaterialManagerInstance } from '../features/material-manager/web/component';
import type { WebSoundManagerInstance } from '../features/sound-manager/web/component';

let imageManagerInstance: WebImageManagerInstance | null = null;
let materialManagerInstance: WebMaterialManagerInstance | null = null;
let soundManagerInstance: WebSoundManagerInstance | null = null;

function enhanceApi(): void {
  const api = window.vpxEditorAPI;
  promptInstance = initWebPrompt();

  api.readFile = async (path: string) => {
    try {
      const content = await state.platform!.fileSystem.readFile(path);
      return { success: true, content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  api.readBinaryFile = async (path: string) => {
    try {
      const data = await state.platform!.fileSystem.readBinaryFile(path);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  api.writeFile = async (path: string, content: string) => {
    try {
      await state.platform!.fileSystem.writeFile(path, content);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  api.writeBinaryFile = async (path: string, content: Uint8Array) => {
    try {
      await state.platform!.fileSystem.writeBinaryFile(path, content);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  api.listDir = async (path: string) => {
    return state.platform!.fileSystem.listDir(path);
  };

  api.deleteFile = async (path: string) => {
    try {
      await state.platform!.fileSystem.deleteFile(path);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  api.renameFile = async (oldPath: string, newPath: string) => {
    try {
      await state.platform!.fileSystem.renameFile(oldPath, newPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  api.checkFileExists = async (path: string) => {
    const exists = await state.platform!.fileSystem.exists(path);
    return { valid: exists, error: exists ? undefined : 'File not found' };
  };

  api.getExtractedDir = async () => EXTRACTED_DIR;
  api.getTableName = async () => state.currentFileName.replace('.vpx', '');

  api.getTheme = async () => {
    const settings = await state.platform!.storage.get<EditorSettings>('editorSettings');
    return resolveTheme(settings?.theme);
  };

  api.previewTheme = (theme: string) => {
    applyTheme(theme);
  };

  api.restoreTheme = async (theme?: string) => {
    if (theme) {
      applyTheme(theme);
    } else {
      const settings = await state.platform!.storage.get<EditorSettings>('editorSettings');
      applyTheme(settings?.theme);
    }
  };

  api.saveTheme = async (theme: string) => {
    const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
    settings.theme = theme;
    await state.platform!.storage.set('editorSettings', settings);
    applyTheme(theme);
  };

  api.getViewSettings = async () => {
    return (
      (await state.platform!.storage.get('viewSettings')) || {
        solid: true,
        outline: false,
        grid: true,
        backdrop: true,
      }
    );
  };

  api.saveViewSettings = async (settings: {
    solid?: boolean;
    outline?: boolean;
    grid?: boolean;
    backdrop?: boolean;
  }) => {
    const current = (await state.platform!.storage.get('viewSettings')) || {
      solid: true,
      outline: false,
      grid: true,
      backdrop: true,
    };
    const updated = { ...current, ...settings };
    await state.platform!.storage.set('viewSettings', updated);
  };

  api.getGridSize = async () => {
    return (await state.platform!.storage.get<number>('gridSize')) || 50;
  };

  api.getTextureQuality = async () => {
    return (await state.platform!.storage.get<number>('textureQuality')) || 2048;
  };

  api.getEditorSettings = async () => {
    return (
      (await state.platform!.storage.get('editorSettings')) || {
        unitConversion: 'vpu',
      }
    );
  };

  api.saveSettings = async (settings: EditorSettings) => {
    await state.platform!.storage.set('editorSettings', settings);
  };

  api.getPanelSettings = async () => {
    return (await state.platform!.storage.get<PanelSettings>('panelSettings')) || {};
  };

  api.savePanelSettings = async (settings: PanelSettings) => {
    await state.platform!.storage.set('panelSettings', settings);
  };

  api.getConsoleSettings = async () => {
    return (await state.platform!.storage.get<ConsoleSettings>('consoleSettings')) || {};
  };

  api.saveConsoleSettings = async (settings: ConsoleSettings) => {
    await state.platform!.storage.set('consoleSettings', settings);
  };

  api.notifySelectionChanged = (items: string[]) => {
    window.selectedItems = items || [];
    events.emit('selection-changed', items || []);
  };

  api.getImageInfo = async (path: string) => {
    const data = await state.platform!.fileSystem.readBinaryFile(path);
    return new Promise<{ width: number; height: number }>(resolve => {
      const blob = new Blob([data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  };

  api.playTable = async () => {
    alert('Playing tables is not available in the web version.');
  };

  api.getGamedata = async () => {
    try {
      const content = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/gamedata.json`);
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  api.saveGamedata = async (gamedata: Record<string, unknown>) => {
    await state.platform!.fileSystem.writeFile(`${EXTRACTED_DIR}/gamedata.json`, JSON.stringify(gamedata, null, 2));
  };

  api.getInfo = async () => {
    try {
      const content = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/info.json`);
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  api.saveInfo = async (info: Record<string, unknown>) => {
    await state.platform!.fileSystem.writeFile(`${EXTRACTED_DIR}/info.json`, JSON.stringify(info, null, 2));
  };

  api.getImages = async () => {
    try {
      const content = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/images.json`);
      return JSON.parse(content);
    } catch {
      return [];
    }
  };

  api.getMaterials = async () => {
    try {
      const content = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/materials.json`);
      return JSON.parse(content);
    } catch {
      return {};
    }
  };

  api.saveMaterials = async (materials: Record<string, unknown>) => {
    await state.platform!.fileSystem.writeFile(`${EXTRACTED_DIR}/materials.json`, JSON.stringify(materials, null, 2));
  };

  api.getSounds = async () => {
    try {
      const content = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/sounds.json`);
      return JSON.parse(content);
    } catch {
      return [];
    }
  };

  api.refreshImageManager = () => {
    imageManagerInstance?.refresh();
  };

  api.refreshMaterialManager = () => {
    materialManagerInstance?.refresh();
  };

  api.refreshSoundManager = () => {
    soundManagerInstance?.refresh();
  };

  api.getCollections = async () => {
    try {
      const content = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/collections.json`);
      return JSON.parse(content);
    } catch {
      return [];
    }
  };

  api.saveCollections = async (collections: unknown[]) => {
    await state.platform!.fileSystem.writeFile(
      `${EXTRACTED_DIR}/collections.json`,
      JSON.stringify(collections, null, 2)
    );
  };

  api.getGameitemsIndex = async () => {
    try {
      const files = await state.platform!.fileSystem.listDir(`${EXTRACTED_DIR}/gameitems`);
      return files.filter(f => f.endsWith('.json')).map(f => ({ file_name: f }));
    } catch {
      return [];
    }
  };

  api.showRenameDialog = (data: {
    mode: 'table' | 'element' | 'partgroup';
    currentName: string;
    existingNames: string[];
    elementType?: string;
  }) => {
    const { currentName, existingNames = [], mode, elementType } = data;
    const title = elementType ? `Rename ${elementType}` : undefined;
    promptInstance!
      .show({
        mode: 'rename',
        entityType: mode,
        currentName,
        existingNames,
        maxLength: 32,
        title,
      })
      .then(result => {
        if (result.submitted && result.value) {
          events.emit('rename-submitted', { mode, oldName: currentName, newName: result.value });
        }
      });
  };

  api.toggleTableLock = handleLockTable;
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', e => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      if (!isTableLoaded()) {
        openFilePicker();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }

    if (e.key === 'F7') {
      e.preventDefault();
      events.emit('toggle-script-editor');
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      events.emit('toggle-lock');
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
      e.preventDefault();
      events.emit('paste-at-original');
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      events.emit('show-select-element');
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      events.emit('show-drawing-order', 'hit');
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      events.emit('show-drawing-order', 'select');
    }

    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      if (isTableLoaded()) {
        events.emit('toggle-backglass-view', !getIsBackglassMode());
      }
    }
  });
}

function setupViewMenuState(): void {
  const solidCheck = document.querySelector('#menu-view-solid .menu-check');
  const outlineCheck = document.querySelector('#menu-view-outline .menu-check');
  const gridCheck = document.querySelector('#menu-view-grid .menu-check');
  const backdropCheck = document.querySelector('#menu-view-backdrop .menu-check');
  const backglassCheck = document.querySelector('#menu-view-backglass .menu-check');

  let viewSettings = { solid: true, outline: false, grid: true, backdrop: true };

  function updateChecks(): void {
    if (solidCheck) solidCheck.textContent = viewSettings.solid ? '✓' : '';
    if (outlineCheck) outlineCheck.textContent = viewSettings.outline ? '✓' : '';
    if (gridCheck) gridCheck.textContent = viewSettings.grid ? '✓' : '';
    if (backdropCheck) backdropCheck.textContent = viewSettings.backdrop ? '✓' : '';
    if (backglassCheck) backglassCheck.textContent = getIsBackglassMode() ? '✓' : '';
  }

  events.on('backglass-view-changed', (enabled: boolean) => {
    setIsBackglassMode(enabled);
    updateChecks();
  });

  window.vpxEditor.getViewSettings?.().then(settings => {
    if (settings) {
      viewSettings = { ...viewSettings, ...settings };
      updateChecks();
    }
  });

  events.on('view-settings-changed', (settings: Partial<typeof viewSettings>) => {
    viewSettings = { ...viewSettings, ...settings };
    updateChecks();
    window.vpxEditor.saveViewSettings?.(viewSettings);
  });

  events.on('toggle-grid', () => {
    viewSettings.grid = !viewSettings.grid;
    updateChecks();
    window.vpxEditor.saveViewSettings?.({ grid: viewSettings.grid });
    events.emit('view-settings-changed', viewSettings);
  });

  events.on('toggle-backdrop', () => {
    viewSettings.backdrop = !viewSettings.backdrop;
    updateChecks();
    window.vpxEditor.saveViewSettings?.({ backdrop: viewSettings.backdrop });
    events.emit('view-settings-changed', viewSettings);
  });
}

function setupDropHandler(): void {
  const canvas = document.getElementById('canvas-container');
  if (!canvas) return;

  canvas.addEventListener('dragover', e => {
    e.preventDefault();
  });

  canvas.addEventListener('drop', async e => {
    e.preventDefault();
    if (isTableLoaded()) return;
    const file = e.dataTransfer?.files[0];
    if (file && file.name.toLowerCase().endsWith('.vpx')) {
      await openVpxFile(file);
      state.currentFileHandle = null;
      state.currentFileName = file.name;
      state.isTableDirty = false;
      updateWindowTitle();
    }
  });
}

function showBlueprintModal(): void {
  const modal = document.getElementById('blueprint-modal')!;
  modal.classList.remove('hidden');
}

function setupBlueprintModal(): void {
  const modal = document.getElementById('blueprint-modal')!;
  const closeBtn = document.getElementById('blueprint-modal-close')!;
  const cancelBtn = document.getElementById('blueprint-cancel')!;
  const outlineBtn = document.getElementById('blueprint-outline')!;
  const solidBtn = document.getElementById('blueprint-solid')!;

  function closeModal(result: { solid: boolean } | null): void {
    modal.classList.add('hidden');
    if (result) {
      const isBackglass = getIsBackglassMode();
      import('../editor/blueprint-export.js').then(({ exportBlueprintAndDownload }) => {
        exportBlueprintAndDownload(result.solid, isBackglass);
      });
    }
  }

  closeBtn.addEventListener('click', () => closeModal(null));
  cancelBtn.addEventListener('click', () => closeModal(null));
  outlineBtn.addEventListener('click', () => closeModal({ solid: false }));
  solidBtn.addEventListener('click', () => closeModal({ solid: true }));

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('hidden') && e.key === 'Escape') {
      closeModal(null);
    }
  });
}

declare const require: {
  config: (options: { paths: Record<string, string> }) => void;
  (deps: string[], callback: (monaco: typeof import('monaco-editor')) => void): void;
};

declare const monaco: typeof import('monaco-editor');

function setupScriptEditorModal(): void {
  injectScriptEditorTemplate();
  const modal = document.getElementById('script-editor-modal')!;
  const closeBtn = document.getElementById('script-editor-close')!;
  const container = document.getElementById('script-editor-container')!;
  const statusEl = document.getElementById('script-status')!;
  const cursorPosEl = document.getElementById('script-cursor-pos')!;
  const titleEl = modal.querySelector('.script-editor-title')!;
  const itemList = document.getElementById('script-item-list') as HTMLSelectElement;
  const eventList = document.getElementById('script-event-list') as HTMLSelectElement;
  const functionList = document.getElementById('script-function-list') as HTMLSelectElement;

  let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
  let monacoLoaded = false;
  let tableItems: ScriptGameItem[] = [];
  let parsedFunctions: ParsedFunction[] = [];
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isTableLocked = false;

  function setStatus(msg: string): void {
    statusEl.textContent = msg;
  }

  function updateFunctionList(): void {
    if (!editor) return;
    const code = editor.getValue();
    parsedFunctions = parseScriptFunctions(code);
    functionList.innerHTML = '<option value="">(Select Function)</option>';
    for (const fn of parsedFunctions) {
      const opt = document.createElement('option');
      opt.value = String(fn.line);
      opt.textContent = fn.name;
      functionList.appendChild(opt);
    }
  }

  function populateItemList(items: ScriptGameItem[]): void {
    tableItems = items || [];
    itemList.innerHTML = '<option value="">(All Items)</option>';
    const sortedItems = [...tableItems].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sortedItems) {
      const opt = document.createElement('option');
      opt.value = item.name;
      opt.dataset.type = item.type;
      opt.textContent = item.name;
      itemList.appendChild(opt);
    }
  }

  function updateEventList(itemType: string): void {
    eventList.innerHTML = '<option value="">(Select Event)</option>';
    const evts = getEventsForItemType(itemType);
    for (const evt of evts) {
      const opt = document.createElement('option');
      opt.value = evt;
      opt.textContent = '_' + evt;
      eventList.appendChild(opt);
    }
  }

  async function saveScript(): Promise<void> {
    if (!editor || !state.tableLoaded) return;

    const content = editor.getValue();
    const scriptPath = `${EXTRACTED_DIR}/script.vbs`;

    try {
      await state.platform!.fileSystem.writeFile(scriptPath, content);
      setStatus('Saved');
      events.emit('script-changed');
    } catch (error) {
      setStatus(`Save failed: ${error}`);
    }
  }

  function scheduleAutoSave(): void {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveScript();
    }, 500);
  }

  function goToOrCreateEventHandler(itemName: string, eventName: string): void {
    if (!editor || !itemName || !eventName) return;

    const code = editor.getValue();
    const result = findEventHandler(code, itemName, eventName);

    if (result.found) {
      editor.revealLineInCenter(result.line);
      editor.setPosition({ lineNumber: result.line, column: 1 });
      editor.focus();
      return;
    }

    if (isTableLocked) return;

    const newSub = generateEventHandler(itemName, eventName);
    const model = editor.getModel();
    if (!model) return;

    const lastLine = model.getLineCount();
    model.applyEdits([
      {
        range: new monaco.Range(lastLine, model.getLineMaxColumn(lastLine), lastLine, model.getLineMaxColumn(lastLine)),
        text: newSub,
      },
    ]);
    editor.revealLineInCenter(lastLine + 2);
    editor.setPosition({ lineNumber: lastLine + 2, column: 2 });
    editor.focus();
  }

  async function loadMonaco(): Promise<void> {
    if (monacoLoaded) return;

    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
      script.onload = () => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
          monacoLoaded = true;

          monaco.languages.registerCompletionItemProvider('vb', {
            provideCompletionItems: () => {
              const suggestions: import('monaco-editor').languages.CompletionItem[] = [];
              for (const item of tableItems) {
                suggestions.push({
                  label: item.name,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  insertText: item.name,
                  detail: item.type,
                  range: undefined as unknown as import('monaco-editor').IRange,
                });
              }
              for (const api of VPINBALL_API) {
                suggestions.push({
                  label: api,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: api,
                  detail: 'VPinball API',
                  range: undefined as unknown as import('monaco-editor').IRange,
                });
              }
              for (const fn of parsedFunctions) {
                suggestions.push({
                  label: fn.name,
                  kind:
                    fn.type === 'sub'
                      ? monaco.languages.CompletionItemKind.Method
                      : monaco.languages.CompletionItemKind.Function,
                  insertText: fn.name,
                  detail: fn.type,
                  range: undefined as unknown as import('monaco-editor').IRange,
                });
              }
              return { suggestions };
            },
          });

          resolve();
        });
      };
      document.head.appendChild(script);
    });
  }

  async function openScriptEditor(): Promise<void> {
    if (!state.tableLoaded) {
      setStatus('No table loaded');
      return;
    }

    await loadMonaco();

    const scriptPath = `${EXTRACTED_DIR}/script.vbs`;
    let content = '';
    try {
      content = await state.platform!.fileSystem.readFile(scriptPath);
    } catch {
      content = '';
    }

    let items: ScriptGameItem[] = [];
    try {
      const gameitemsJson = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/gameitems.json`);
      const gameitemsData = JSON.parse(gameitemsJson) as { file_name: string }[];
      for (const gi of gameitemsData) {
        const fileName = gi.file_name || '';
        if (!fileName) continue;
        const type = fileName.split('.')[0] || 'Unknown';
        try {
          const itemJson = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/gameitems/${fileName}`);
          const itemData = JSON.parse(itemJson);
          const itemType = Object.keys(itemData)[0];
          const item = itemData[itemType];
          if (item.name) {
            items.push({ name: item.name, type: itemType || type });
          }
        } catch {
          continue;
        }
      }
    } catch {
      items = [];
    }

    populateItemList(items);

    const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
    const theme = resolveTheme(settings.theme);
    modal.setAttribute('data-theme', theme);

    titleEl.textContent = state.currentFileName ? `Script Editor - [${state.currentFileName}]` : 'Script Editor';

    container.innerHTML = '';
    const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

    editor = monaco.editor.create(container, {
      value: content,
      language: 'vb',
      theme: monacoTheme,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'Consolas', 'Monaco', 'Menlo', monospace",
      lineNumbers: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 4,
      insertSpaces: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
    });

    let updateTimeout: ReturnType<typeof setTimeout> | null = null;
    editor.onDidChangeModelContent(() => {
      scheduleAutoSave();
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(updateFunctionList, 500);
    });

    editor.onDidChangeCursorPosition(e => {
      cursorPosEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveScript();
    });

    setStatus('Ready');
    updateFunctionList();
    modal.classList.remove('hidden');
    events.emit('script-editor-opened');
  }

  function closeScriptEditor(): void {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveScript();
    }
    if (editor) {
      editor.dispose();
      editor = null;
    }
    modal.classList.add('hidden');
    events.emit('script-editor-closed');
  }

  closeBtn.addEventListener('click', closeScriptEditor);

  itemList.addEventListener('change', e => {
    const selectedOption = (e.target as HTMLSelectElement).selectedOptions[0];
    const itemType = selectedOption?.dataset?.type || '';
    updateEventList(itemType);
  });

  eventList.addEventListener('change', e => {
    const itemName = itemList.value;
    const eventName = (e.target as HTMLSelectElement).value;
    if (itemName && eventName) {
      goToOrCreateEventHandler(itemName, eventName);
      (e.target as HTMLSelectElement).value = '';
    }
  });

  functionList.addEventListener('change', e => {
    const line = parseInt((e.target as HTMLSelectElement).value, 10);
    if (editor && line) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }
  });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('hidden') && e.key === 'Escape') {
      closeScriptEditor();
    }
  });

  events.on('toggle-script-editor', openScriptEditor);
}

function setupImageManagerModal(): void {
  imageManagerInstance = initWebImageManager(
    {
      readFile: path => state.platform!.fileSystem.readFile(path),
      readBinaryFile: path => state.platform!.fileSystem.readBinaryFile(path),
      writeBinaryFile: (path, data) => state.platform!.fileSystem.writeBinaryFile(path, data),
      writeFile: (path, content) => state.platform!.fileSystem.writeFile(path, content),
      renameFile: (oldPath, newPath) => state.platform!.fileSystem.renameFile(oldPath, newPath),
      deleteFile: path => state.platform!.fileSystem.deleteFile(path),
      onImagesChanged: () => events.emit('images-changed'),
      undoBegin: desc => undoManager.beginUndo(desc),
      undoEnd: () => undoManager.endUndo(),
      undoMarkImages: () => undoManager.markImagesForUndo(),
      undoMarkImageCreate: name => undoManager.markImageForCreate(name),
      undoMarkImageDelete: (name, data, path) => undoManager.markImageForDelete(name, data, path),
      undoMarkForUndo: name => undoManager.markForUndo(name),
      undoMarkGamedata: () => undoManager.markGamedataForUndo(),
    },
    resolveTheme,
    async () => {
      const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
      return settings.theme;
    }
  );

  events.on('show-image-manager', async () => {
    if (!state.tableLoaded) {
      document.getElementById('image-manager-status')!.textContent = 'No table loaded';
      return;
    }
    await imageManagerInstance!.open(EXTRACTED_DIR);
  });
}

function setupSoundManagerModal(): void {
  soundManagerInstance = initWebSoundManager(
    {
      readFile: path => state.platform!.fileSystem.readFile(path),
      readBinaryFile: path => state.platform!.fileSystem.readBinaryFile(path),
      writeBinaryFile: (path, data) => state.platform!.fileSystem.writeBinaryFile(path, data),
      writeFile: (path, content) => state.platform!.fileSystem.writeFile(path, content),
      renameFile: (oldPath, newPath) => state.platform!.fileSystem.renameFile(oldPath, newPath),
      deleteFile: path => state.platform!.fileSystem.deleteFile(path),
      onSoundsChanged: () => events.emit('sounds-changed'),
      undoBegin: desc => undoManager.beginUndo(desc),
      undoEnd: () => undoManager.endUndo(),
      undoMarkSounds: () => undoManager.markSoundsForUndo(),
      undoMarkSoundCreate: name => undoManager.markSoundForCreate(name),
      undoMarkSoundDelete: (name, data, path) => undoManager.markSoundForDelete(name, data, path),
    },
    resolveTheme,
    async () => {
      const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
      return settings.theme;
    }
  );

  events.on('show-sound-manager', async () => {
    if (!state.tableLoaded) {
      document.getElementById('sound-manager-status')!.textContent = 'No table loaded';
      return;
    }
    await soundManagerInstance!.open(EXTRACTED_DIR);
  });
}

function setupDimensionsModal(): void {
  const dimensionsManager = initWebDimensionsManager(
    {
      readFile: path => state.platform!.fileSystem.readFile(path),
      writeFile: (path, content) => state.platform!.fileSystem.writeFile(path, content),
      onGamedataChanged: () => events.emit('gamedata-changed'),
    },
    resolveTheme,
    async () => {
      const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
      return settings.theme;
    }
  );

  events.on('show-dimensions', async () => {
    if (!state.tableLoaded) return;
    await dimensionsManager.open(EXTRACTED_DIR);
  });
}

function setupMaterialManagerModal(): void {
  materialManagerInstance = initWebMaterialManager(
    {
      readFile: path => state.platform!.fileSystem.readFile(path),
      writeFile: (path, content) => state.platform!.fileSystem.writeFile(path, content),
      onMaterialsChanged: () => events.emit('materials-changed'),
      undoBegin: desc => undoManager.beginUndo(desc),
      undoEnd: () => undoManager.endUndo(),
      undoMarkMaterials: () => undoManager.markMaterialsForUndo(),
      undoMarkMaterialCreate: name => undoManager.markMaterialForCreate(name),
      undoMarkMaterialDelete: (name, data) => undoManager.markMaterialForDelete(name, data),
      undoMarkForUndo: name => undoManager.markForUndo(name),
    },
    resolveTheme,
    async () => {
      const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
      return settings.theme;
    }
  );

  events.on('show-material-manager', async () => {
    if (!state.tableLoaded) return;
    await materialManagerInstance!.open(EXTRACTED_DIR);
  });
}

function setupRenderProbeManagerModal(): void {
  const renderProbeManager = initWebRenderProbeManager(
    {
      readFile: path => state.platform!.fileSystem.readFile(path),
      writeFile: (path, content) => state.platform!.fileSystem.writeFile(path, content),
      onRenderProbesChanged: () => events.emit('renderprobes-changed'),
    },
    resolveTheme,
    async () => {
      const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
      return settings.theme;
    }
  );

  events.on('show-render-probe-manager', async () => {
    if (!state.tableLoaded) return;
    await renderProbeManager.open(EXTRACTED_DIR);
  });
}

function setupCollectionManagerModal(): void {
  let selectedItems: string[] = [];

  function closeCollectionManager(): void {
    const modal = document.getElementById('collection-modal');
    if (modal) modal.classList.add('hidden');
  }

  const collectionInstance = initWebCollectionManager({
    writeFile: (path, content) => state.platform!.fileSystem.writeFile(path, content),
    readFile: path => state.platform!.fileSystem.readFile(path),
    getSelectedItems: () => selectedItems,
    onCollectionsChanged: async () => {
      try {
        const json = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/collections.json`);
        events.emit('collections-changed', JSON.parse(json));
      } catch {}
    },
    onClose: closeCollectionManager,
  });

  events.on('selection-changed', (items: string[]) => {
    selectedItems = items || [];
    collectionInstance.refreshButtonStates();
  });

  const modal = document.getElementById('collection-modal')!;
  const closeBtn = document.getElementById('collection-close')!;

  async function openCollectionManager(): Promise<void> {
    if (!state.tableLoaded) return;

    const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
    const theme = resolveTheme(settings.theme);
    modal.setAttribute('data-theme', theme);

    let collections: Collection[] = [];
    let allItems: string[] = [];

    try {
      const collectionsJson = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/collections.json`);
      collections = JSON.parse(collectionsJson);
    } catch {
      collections = [];
    }

    try {
      const gameitemsJson = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/gameitems.json`);
      const gameitemsData = JSON.parse(gameitemsJson) as { file_name: string }[];
      for (const gi of gameitemsData) {
        const fileName = gi.file_name || '';
        if (!fileName) continue;
        try {
          const itemJson = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/gameitems/${fileName}`);
          const itemData = JSON.parse(itemJson);
          const itemType = Object.keys(itemData)[0];
          const item = itemData[itemType];
          if (item.name) {
            allItems.push(item.name);
          }
        } catch {
          continue;
        }
      }
      allItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } catch {
      allItems = [];
    }

    selectedItems = window.selectedItems || [];
    collectionInstance.setData({
      extractedDir: EXTRACTED_DIR,
      collections,
      allItems,
    });
    collectionInstance.setUIDisabled(false);
    collectionInstance.renderList();
    modal.classList.remove('hidden');
  }

  closeBtn.addEventListener('click', closeCollectionManager);
  setupCollectionManagerKeyboard(modal, closeCollectionManager);
  events.on('show-collection-manager', openCollectionManager);
}

function setupSelectElementModal(): void {
  let selectElementInstance: WebSelectElementInstance | null = null;

  async function openSelectElement(): Promise<void> {
    if (!state.tableLoaded) return;

    if (!selectElementInstance) {
      selectElementInstance = initWebSelectElement(
        {
          readFile: (path: string) => state.platform!.fileSystem.readFile(path),
          onSelect: (itemNames: string[]) => {
            if (itemNames.length === 1) {
              events.emit('select-item', itemNames[0]);
            } else if (itemNames.length > 1) {
              events.emit('select-items', itemNames);
            }
          },
        },
        resolveTheme,
        async () => {
          const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
          return settings.theme;
        }
      );
    }

    await selectElementInstance.open(EXTRACTED_DIR);
  }

  events.on('show-select-element', openSelectElement);
}

function setupDrawingOrderModal(): void {
  async function saveDrawingOrder(orderedNames: string[]): Promise<void> {
    if (!state.tableLoaded) return;

    try {
      const gameitemsJson = await state.platform!.fileSystem.readFile(`${EXTRACTED_DIR}/gameitems.json`);
      const gameitems = JSON.parse(gameitemsJson) as { file_name: string }[];

      const newGameitems = reorderGameitems(gameitems, orderedNames);
      if (newGameitems) {
        await state.platform!.fileSystem.writeFile(
          `${EXTRACTED_DIR}/gameitems.json`,
          JSON.stringify(newGameitems, null, 2)
        );
        events.emit('gameitems-changed', newGameitems);
      }
    } catch (e) {
      console.error('Failed to save drawing order:', e);
    }
  }

  const drawingOrder = initWebDrawingOrder({ onSave: saveDrawingOrder }, resolveTheme, async () => {
    const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
    return settings.theme;
  });

  function requestDrawingOrder(mode: DrawingOrderMode): void {
    if (!state.tableLoaded) return;
    events.emit('request-drawing-order-data', mode);
  }

  function showDrawingOrderModal(data: { mode: DrawingOrderMode; items: DrawingOrderItem[] }): void {
    if (!state.tableLoaded) return;
    drawingOrder.show(data.mode, data.items || []);
  }

  events.on('show-drawing-order', requestDrawingOrder);
  events.on('drawing-order-data', showDrawingOrderModal);
}

async function init(): Promise<void> {
  try {
    state.platform = await createPlatform();
  } catch (e) {
    const { appendConsoleLine, showConsole } = await import('../editor/console-panel.js');
    showConsole();
    appendConsoleLine(
      'Storage access denied. This may occur in private browsing mode. File operations will not work.',
      'error'
    );
    console.error('Platform initialization failed:', e);
    return;
  }
  enhanceApi();

  const settings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
  applyTheme(settings.theme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const currentSettings = (await state.platform!.storage.get<EditorSettings>('editorSettings')) || {};
    if (currentSettings.theme === 'system' || !currentSettings.theme) {
      applyTheme('system');
    }
  });

  setupMenu({
    isBackglassMode: getIsBackglassMode,
    showBlueprintModal,
  });
  setupKeyboardShortcuts();
  setupDropHandler();
  initWebSettings({
    storage: state.platform!.storage,
    events,
    applyTheme,
  });
  initWebAbout({
    getVersion: window.vpxEditor.getVersion,
    events,
  });
  setupBlueprintModal();
  initWebTransform({ events });
  initWebMeshImport({
    fileSystem: {
      readFile: window.vpxEditor.readFile,
      writeFile: window.vpxEditor.writeFile,
    },
    events,
    getExtractedDir: () => (state.tableLoaded ? EXTRACTED_DIR : null),
  });
  setupScriptEditorModal();
  setupImageManagerModal();
  setupSoundManagerModal();
  initWebTableInfo({
    storage: state.platform!.storage,
    fileSystem: state.platform!.fileSystem,
    events,
    getExtractedDir: () => (state.tableLoaded ? EXTRACTED_DIR : null),
    resolveTheme,
  });
  setupDimensionsModal();
  setupMaterialManagerModal();
  setupRenderProbeManagerModal();
  setupCollectionManagerModal();
  setupSelectElementModal();
  setupDrawingOrderModal();
  setupViewMenuState();

  events.on('selection-changed', (items: string[]) => {
    window.selectedItems = items || [];
  });

  const { resizeCanvas } = await import('../editor/view-manager.js');
  await import('../editor/renderer.js');

  window.addEventListener('resize', resizeCanvas);

  window.addEventListener('beforeunload', e => {
    if (state.isTableDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

init();
