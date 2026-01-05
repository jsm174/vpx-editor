import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

let collectionName: string = '';
let editorIncludedItems: string[] = [];
let editorAvailableItems: string[] = [];
let existingNames: string[] = [];
let selectedAvailable: string | null = null;
let selectedIncluded: string | null = null;
let draggedIncludedIndex: number | null = null;
let availableFilter: string = '';
let includedFilter: string = '';

setupThemeListener();

window.vpxEditor.onInitCollectionEditor((data: { name: string; items: string[]; allItems: string[] }) => {
  collectionName = data.name;
  editorIncludedItems = [...data.items];
  editorAvailableItems = data.allItems.filter((item: string) => !data.items.includes(item));
  existingNames = [];

  (document.getElementById('collection-editor-name') as HTMLInputElement).value = data.name;
  (document.getElementById('collection-editor-fire-events') as HTMLInputElement).checked = false;
  (document.getElementById('collection-editor-stop-single') as HTMLInputElement).checked = false;
  (document.getElementById('collection-editor-group') as HTMLInputElement).checked = false;

  selectedAvailable = null;
  selectedIncluded = null;
  availableFilter = '';
  includedFilter = '';
  (document.getElementById('collection-editor-available-filter') as HTMLInputElement).value = '';
  (document.getElementById('collection-editor-included-filter') as HTMLInputElement).value = '';

  renderEditorLists();
  validateName();
});

function renderEditorLists(): void {
  const availableList = document.getElementById('collection-editor-available') as HTMLElement;
  const includedList = document.getElementById('collection-editor-included') as HTMLElement;

  availableList.innerHTML = '';
  includedList.innerHTML = '';

  const availableFilterLower = availableFilter.toLowerCase();
  const filteredAvailable = availableFilter
    ? editorAvailableItems.filter((name: string) => name.toLowerCase().includes(availableFilterLower))
    : editorAvailableItems;

  for (const name of filteredAvailable) {
    const item = document.createElement('div');
    item.className = 'editor-item';
    if (name === selectedAvailable) item.classList.add('selected');
    item.textContent = name;
    item.addEventListener('click', () => {
      selectedAvailable = name;
      selectedIncluded = null;
      renderEditorLists();
    });
    item.addEventListener('dblclick', () => {
      addToIncluded(name);
    });
    availableList.appendChild(item);
  }

  const includedFilterLower = includedFilter.toLowerCase();
  const filteredIncluded = includedFilter
    ? editorIncludedItems
        .map((name: string, index: number) => ({ name, index }))
        .filter(({ name }) => name.toLowerCase().includes(includedFilterLower))
    : editorIncludedItems.map((name: string, index: number) => ({ name, index }));

  filteredIncluded.forEach(({ name, index }: { name: string; index: number }) => {
    const item = document.createElement('div');
    item.className = 'editor-item';
    item.draggable = true;
    item.dataset.index = String(index);
    if (name === selectedIncluded) item.classList.add('selected');
    item.textContent = name;
    item.addEventListener('click', () => {
      selectedIncluded = name;
      selectedAvailable = null;
      renderEditorLists();
    });
    item.addEventListener('dblclick', () => {
      removeFromIncluded(name);
    });

    item.addEventListener('dragstart', (e: DragEvent) => {
      draggedIncludedIndex = index;
      item.classList.add('dragging');
      e.dataTransfer!.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedIncludedIndex = null;
      document.querySelectorAll('.editor-item').forEach((el: Element) => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });
    });

    item.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      const targetIndex = parseInt(item.dataset.index!);
      if (draggedIncludedIndex !== null && targetIndex !== draggedIncludedIndex) {
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isAbove = e.clientY < midY;
        item.classList.remove('drag-over-above', 'drag-over-below');
        item.classList.add(isAbove ? 'drag-over-above' : 'drag-over-below');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over-above', 'drag-over-below');
    });

    item.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const isAbove = item.classList.contains('drag-over-above');
      item.classList.remove('drag-over-above', 'drag-over-below');
      let targetIndex = parseInt(item.dataset.index!);

      if (draggedIncludedIndex !== null && targetIndex !== draggedIncludedIndex) {
        const [movedItem] = editorIncludedItems.splice(draggedIncludedIndex, 1);
        if (draggedIncludedIndex < targetIndex) {
          targetIndex--;
        }
        if (!isAbove) {
          targetIndex++;
        }
        editorIncludedItems.splice(targetIndex, 0, movedItem);
        selectedIncluded = movedItem;
        renderEditorLists();
      }
      draggedIncludedIndex = null;
    });

    includedList.appendChild(item);
  });
}

function addToIncluded(name: string): void {
  const idx = editorAvailableItems.indexOf(name);
  if (idx !== -1) {
    editorAvailableItems.splice(idx, 1);
    editorIncludedItems.push(name);
    selectedAvailable = null;
    selectedIncluded = name;
    renderEditorLists();
  }
}

function removeFromIncluded(name: string): void {
  const idx = editorIncludedItems.indexOf(name);
  if (idx !== -1) {
    editorIncludedItems.splice(idx, 1);
    editorAvailableItems.push(name);
    editorAvailableItems.sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase()));
    selectedIncluded = null;
    selectedAvailable = name;
    renderEditorLists();
  }
}

(document.getElementById('collection-editor-available-filter') as HTMLInputElement).addEventListener(
  'input',
  (e: Event) => {
    availableFilter = (e.target as HTMLInputElement).value;
    renderEditorLists();
  }
);

(document.getElementById('collection-editor-included-filter') as HTMLInputElement).addEventListener(
  'input',
  (e: Event) => {
    includedFilter = (e.target as HTMLInputElement).value;
    renderEditorLists();
  }
);

(document.getElementById('collection-editor-add') as HTMLButtonElement).addEventListener('click', () => {
  if (selectedAvailable) {
    addToIncluded(selectedAvailable);
  }
});

(document.getElementById('collection-editor-remove') as HTMLButtonElement).addEventListener('click', () => {
  if (selectedIncluded) {
    removeFromIncluded(selectedIncluded);
  }
});

(document.getElementById('collection-editor-up') as HTMLButtonElement).addEventListener('click', () => {
  if (!selectedIncluded) return;
  const idx = editorIncludedItems.indexOf(selectedIncluded);
  if (idx > 0) {
    [editorIncludedItems[idx - 1], editorIncludedItems[idx]] = [editorIncludedItems[idx], editorIncludedItems[idx - 1]];
    renderEditorLists();
  }
});

(document.getElementById('collection-editor-down') as HTMLButtonElement).addEventListener('click', () => {
  if (!selectedIncluded) return;
  const idx = editorIncludedItems.indexOf(selectedIncluded);
  if (idx >= 0 && idx < editorIncludedItems.length - 1) {
    [editorIncludedItems[idx], editorIncludedItems[idx + 1]] = [editorIncludedItems[idx + 1], editorIncludedItems[idx]];
    renderEditorLists();
  }
});

function validateName(): boolean {
  const input = document.getElementById('collection-editor-name') as HTMLInputElement;
  const okBtn = document.getElementById('collection-editor-ok') as HTMLButtonElement;
  const newName = input.value.trim();

  if (!newName) {
    okBtn.disabled = true;
    return false;
  }

  const nameExists = existingNames.some((n: string) => n === newName && n !== collectionName);
  if (nameExists) {
    okBtn.disabled = true;
    return false;
  }

  okBtn.disabled = false;
  return true;
}

(document.getElementById('collection-editor-name') as HTMLInputElement).addEventListener('input', validateName);

(document.getElementById('collection-editor-cancel') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.collectionEditorCancel();
});

(document.getElementById('collection-editor-ok') as HTMLButtonElement).addEventListener('click', () => {
  if (!validateName()) return;

  const newName = (document.getElementById('collection-editor-name') as HTMLInputElement).value.trim();

  window.vpxEditor.collectionEditorSave(newName, editorIncludedItems);
});

setupKeyboardShortcuts({
  onEscape: (): void => window.vpxEditor.collectionEditorCancel(),
});
