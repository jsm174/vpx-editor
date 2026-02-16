import {
  initMaterialManagerComponent,
  loadMaterialManagerData,
  type MaterialManagerInstance,
} from '../shared/component';
import { initWebPrompt } from '../../prompt/web/component';
import templateHtml from './template.html?raw';

export type { MaterialManagerInstance };

export interface WebMaterialManagerDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  onMaterialsChanged: () => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => Promise<void>;
  undoMarkMaterials?: () => void;
  undoMarkMaterialCreate?: (materialName: string) => void;
  undoMarkMaterialDelete?: (materialName: string, materialData: unknown) => void;
  undoMarkForUndo?: (itemName: string) => void;
}

export interface WebMaterialManagerInstance {
  open: (extractedDir: string, selectMaterial?: string) => Promise<void>;
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

export function initWebMaterialManager(
  deps: WebMaterialManagerDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebMaterialManagerInstance {
  injectTemplate();

  const modal = document.getElementById('material-modal')!;
  const closeBtn = document.getElementById('material-close')!;
  const prompt = initWebPrompt();

  let materialInstance: MaterialManagerInstance | null = null;
  let lastExtractedDir: string | null = null;

  async function open(extractedDir: string, selectMaterial?: string): Promise<void> {
    lastExtractedDir = extractedDir;
    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    const { materials, items, gamedata } = await loadMaterialManagerData(extractedDir, {
      readFile: deps.readFile,
    });

    if (!materialInstance) {
      const elements = {
        listBody: document.getElementById('material-list-body')!,
        filterInput: document.getElementById('material-filter') as HTMLInputElement,
        addBtn: document.getElementById('material-add-btn')!,
        cloneBtn: document.getElementById('material-clone-btn')!,
        statusEl: document.getElementById('material-status')!,
        propertiesContainer: document.getElementById('material-properties-container')!,
        emptyState: document.getElementById('material-empty-state')!,
        editOverlay: document.getElementById('material-edit-overlay')!,
        editTitle: document.getElementById('material-edit-title')!,
        editForm: document.getElementById('material-edit-form')!,
        editOkBtn: document.getElementById('material-edit-ok')!,
        editCancelBtn: document.getElementById('material-edit-cancel')!,
        confirmOverlay: document.getElementById('material-confirm-overlay')!,
        confirmMessage: document.getElementById('material-confirm-message')!,
        confirmOkBtn: document.getElementById('material-confirm-ok')!,
        confirmCancelBtn: document.getElementById('material-confirm-cancel')!,
        contextMenu: document.getElementById('material-context-menu')!,
      };

      materialInstance = initMaterialManagerComponent(elements, {
        readFile: deps.readFile,
        writeFile: deps.writeFile,
        onMaterialsChanged: deps.onMaterialsChanged,
        showConfirm: (message: string) => Promise.resolve(confirm(message)),
        openRenamePrompt: (currentName: string, existingNames: string[]) => {
          prompt
            .show({
              mode: 'rename',
              entityType: 'material',
              currentName,
              existingNames,
            })
            .then(result => {
              if (result.submitted && result.value) {
                materialInstance?.performRename(currentName, result.value);
              }
            });
        },
        undoBegin: deps.undoBegin,
        undoEnd: deps.undoEnd,
        undoMarkMaterials: deps.undoMarkMaterials,
        undoMarkMaterialCreate: deps.undoMarkMaterialCreate,
        undoMarkMaterialDelete: deps.undoMarkMaterialDelete,
        undoMarkForUndo: deps.undoMarkForUndo,
      });
    }

    materialInstance.setData({
      extractedDir,
      materials,
      items,
      gamedata,
    });
    materialInstance.setUIDisabled(false);
    materialInstance.renderList('');
    if (selectMaterial) {
      materialInstance.selectMaterialByName(selectMaterial);
    }
    document.getElementById('material-status')!.textContent = `Loaded ${Object.keys(materials).length} materials`;
    modal.classList.remove('hidden');
  }

  function close(): void {
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);

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

export { loadMaterialManagerData };
