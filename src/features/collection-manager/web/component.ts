import { initCollectionManagerComponent, type Collection } from '../shared/component';
import templateHtml from './template.html?raw';

export type { Collection };

export interface WebCollectionManagerDeps {
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  getSelectedItems: () => string[];
  onCollectionsChanged: () => void;
  onClose: () => void;
}

export interface WebCollectionManagerInstance {
  setData: (data: { extractedDir: string; collections: Collection[]; allItems: string[] }) => void;
  setUIDisabled: (disabled: boolean) => void;
  renderList: () => void;
  selectCollection: (name: string | null) => void;
  refreshButtonStates: () => void;
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

export function initWebCollectionManager(deps: WebCollectionManagerDeps): WebCollectionManagerInstance {
  injectTemplate();

  const elements = {
    list: document.getElementById('collection-list')!,
    newBtn: document.getElementById('collection-new-btn')!,
    fromSelectionBtn: document.getElementById('collection-from-selection-btn')!,
    editBtn: document.getElementById('collection-edit-btn')!,
    renameBtn: document.getElementById('collection-rename-btn')!,
    deleteBtn: document.getElementById('collection-delete-btn')!,
    upBtn: document.getElementById('collection-up-btn')!,
    downBtn: document.getElementById('collection-down-btn')!,
    closeBtn: document.getElementById('collection-close')!,
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
    promptTitle: document.getElementById('collection-prompt-title') ?? undefined,
    promptCloseBtn: document.getElementById('collection-prompt-close') ?? undefined,
    promptInput: document.getElementById('collection-prompt-input') as HTMLInputElement,
    promptError: document.getElementById('collection-prompt-error')!,
    promptOkBtn: document.getElementById('collection-prompt-ok')!,
    promptCancelBtn: document.getElementById('collection-prompt-cancel')!,
  };

  return initCollectionManagerComponent(elements, {
    writeFile: deps.writeFile,
    readFile: deps.readFile,
    getSelectedItems: deps.getSelectedItems,
    onCollectionsChanged: deps.onCollectionsChanged,
    onClose: deps.onClose,
  });
}

export function setupCollectionManagerKeyboard(_modal: HTMLElement, _onClose: () => void): void {}
