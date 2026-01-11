import { setupThemeListener, setupKeyboardShortcuts } from '../../../shared/window-utils.js';
import {
  initCollectionManagerComponent,
  type CollectionManagerInstance,
  type Collection,
} from '../shared/component.js';

let managerInstance: CollectionManagerInstance | null = null;
let selectedItems: string[] = [];

setupThemeListener();

const elements = {
  list: document.getElementById('collection-manager-list')!,
  newBtn: document.getElementById('collection-manager-new')!,
  fromSelectionBtn: document.getElementById('collection-manager-from-selection')!,
  editBtn: document.getElementById('collection-manager-edit')!,
  renameBtn: document.getElementById('collection-manager-rename')!,
  deleteBtn: document.getElementById('collection-manager-delete')!,
  upBtn: document.getElementById('collection-manager-up')!,
  downBtn: document.getElementById('collection-manager-down')!,
  closeBtn: undefined,
  statusEl: null,
  editorOverlay: document.getElementById('collection-editor-overlay')!,
  editorNameInput: document.getElementById('collection-editor-name') as HTMLInputElement,
  editorAvailableFilter: document.getElementById('collection-editor-available-filter') as HTMLInputElement,
  editorIncludedFilter: document.getElementById('collection-editor-included-filter') as HTMLInputElement,
  editorAvailableList: document.getElementById('collection-editor-available')!,
  editorIncludedList: document.getElementById('collection-editor-included')!,
  editorAddBtn: document.getElementById('collection-editor-add')!,
  editorRemoveBtn: document.getElementById('collection-editor-remove')!,
  editorUpBtn: document.getElementById('collection-editor-up')!,
  editorDownBtn: document.getElementById('collection-editor-down')!,
  editorFireEvents: document.getElementById('collection-editor-fire-events') as HTMLInputElement,
  editorStopSingle: document.getElementById('collection-editor-stop-single') as HTMLInputElement,
  editorGroup: document.getElementById('collection-editor-group') as HTMLInputElement,
  editorOkBtn: document.getElementById('collection-editor-ok')!,
  editorCancelBtn: document.getElementById('collection-editor-cancel')!,
  editorCloseBtn: document.getElementById('collection-editor-close') ?? undefined,
  editorError: document.getElementById('collection-editor-error')!,
  promptOverlay: document.getElementById('collection-prompt-overlay')!,
  promptInput: document.getElementById('collection-prompt-input') as HTMLInputElement,
  promptError: document.getElementById('collection-prompt-error')!,
  promptOkBtn: document.getElementById('collection-prompt-ok')!,
  promptCancelBtn: document.getElementById('collection-prompt-cancel')!,
};

interface InitData {
  collections: Collection[];
  items?: Record<string, unknown>;
  selectedItems?: string[];
}

async function initManager(data: InitData): Promise<void> {
  const collections = data.collections;
  selectedItems = data.selectedItems || [];

  const allItems: string[] = [];
  if (data.items) {
    for (const name of Object.keys(data.items)) {
      allItems.push(name);
    }
  }
  allItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  if (!managerInstance) {
    managerInstance = initCollectionManagerComponent(elements, {
      writeFile: async (_path: string, content: string) => {
        const cols = JSON.parse(content) as Collection[];
        await window.vpxEditor.saveCollections(cols);
      },
      readFile: async (_path: string) => {
        const cols = await window.vpxEditor.getCollections();
        return JSON.stringify(cols);
      },
      getSelectedItems: () => selectedItems,
      onCollectionsChanged: () => {
        window.vpxEditor.notifyCollectionsChanged?.(managerInstance?.getCollections() || [], null);
      },
      onClose: () => window.close(),
      openEditorWindow: (name: string) => {
        window.vpxEditor.openCollectionEditor(name);
      },
      openPromptWindow: (mode: 'new' | 'rename', name?: string) => {
        window.vpxEditor.openCollectionPrompt(mode, name || null);
      },
      createFromSelection: () => {
        window.vpxEditor.collectionCreateFromSelection();
      },
      moveUp: (name: string) => {
        window.vpxEditor.collectionMoveUp(name);
      },
      moveDown: (name: string) => {
        window.vpxEditor.collectionMoveDown(name);
      },
      deleteCollection: (name: string) => {
        window.vpxEditor.collectionDelete(name);
      },
    });
  }

  managerInstance.setData({
    extractedDir: '',
    collections,
    allItems,
  });
  managerInstance.setUIDisabled(false);
  managerInstance.renderList();
}

window.vpxEditor.onInitCollectionManager?.(initManager as (data: { collections: Collection[] }) => void);

window.vpxEditor.onCollectionsChanged?.((data: Collection[], selectCollection?: string) => {
  if (managerInstance) {
    managerInstance.setData({
      extractedDir: '',
      collections: data,
      allItems: [],
    });
    if (selectCollection) {
      managerInstance.selectCollection(selectCollection);
    } else {
      managerInstance.renderList();
    }
  }
});

window.vpxEditor.onSetDisabled?.((disabled: boolean) => {
  if (managerInstance) {
    managerInstance.setUIDisabled(disabled);
  }
});

window.vpxEditor.onSetEditorOpen?.((isOpen: boolean) => {
  const container = document.querySelector('.collection-manager-container') as HTMLElement;
  if (container) {
    if (isOpen) {
      container.classList.add('disabled');
      container.style.pointerEvents = 'none';
      container.style.opacity = '0.5';
    } else {
      container.classList.remove('disabled');
      container.style.pointerEvents = '';
      container.style.opacity = '';
    }
  }
});

window.vpxEditor.onSelectionChanged?.((items: string[]) => {
  selectedItems = items || [];
  managerInstance?.refreshButtonStates();
});

setupKeyboardShortcuts({
  onEscape: (): void => {
    const editorOverlay = document.getElementById('collection-editor-overlay')!;
    const promptOverlay = document.getElementById('collection-prompt-overlay')!;
    if (!editorOverlay.classList.contains('hidden')) {
      editorOverlay.classList.add('hidden');
    } else if (!promptOverlay.classList.contains('hidden')) {
      promptOverlay.classList.add('hidden');
    } else {
      window.close();
    }
  },
});
