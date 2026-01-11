import { setupThemeListener, setupKeyboardShortcuts } from '../../../shared/window-utils.js';
import { initCollectionEditorComponent, type CollectionEditorData } from '../shared/component.js';

setupThemeListener();

const elements = {
  nameInput: document.getElementById('collection-editor-name') as HTMLInputElement,
  availableFilter: document.getElementById('collection-editor-available-filter') as HTMLInputElement,
  includedFilter: document.getElementById('collection-editor-included-filter') as HTMLInputElement,
  availableList: document.getElementById('collection-editor-available')!,
  includedList: document.getElementById('collection-editor-included')!,
  addBtn: document.getElementById('collection-editor-add')!,
  removeBtn: document.getElementById('collection-editor-remove')!,
  upBtn: document.getElementById('collection-editor-up')!,
  downBtn: document.getElementById('collection-editor-down')!,
  fireEvents: document.getElementById('collection-editor-fire-events') as HTMLInputElement,
  stopSingle: document.getElementById('collection-editor-stop-single') as HTMLInputElement,
  group: document.getElementById('collection-editor-group') as HTMLInputElement,
  okBtn: document.getElementById('collection-editor-ok')!,
  cancelBtn: document.getElementById('collection-editor-cancel')!,
  errorEl: document.getElementById('collection-editor-error')!,
};

const editor = initCollectionEditorComponent(elements, {
  onSave: data => window.vpxEditor.collectionEditorSave(data),
  onCancel: () => window.vpxEditor.collectionEditorCancel(),
});

window.vpxEditor.onInitCollectionEditor((data: CollectionEditorData) => {
  editor.setData(data);
});

setupKeyboardShortcuts({
  onEscape: (): void => window.vpxEditor.collectionEditorCancel(),
});
