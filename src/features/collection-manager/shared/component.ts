export interface Collection {
  name: string;
  items?: string[];
  fire_events?: boolean;
  stop_single_events?: boolean;
  group_elements?: boolean;
}

export interface CollectionEditorElements {
  nameInput: HTMLInputElement;
  availableFilter: HTMLInputElement;
  includedFilter: HTMLInputElement;
  availableList: HTMLElement;
  includedList: HTMLElement;
  addBtn: HTMLElement;
  removeBtn: HTMLElement;
  upBtn: HTMLElement;
  downBtn: HTMLElement;
  fireEvents: HTMLInputElement;
  stopSingle: HTMLInputElement;
  group: HTMLInputElement;
  okBtn: HTMLElement;
  cancelBtn: HTMLElement;
  closeBtn?: HTMLElement;
  errorEl: HTMLElement;
}

export interface CollectionEditorData {
  collectionName: string;
  includedItems: string[];
  availableItems: string[];
  existingNames: string[];
  fireEvents: boolean;
  stopSingle: boolean;
  groupElements: boolean;
}

export interface CollectionEditorCallbacks {
  onSave: (data: {
    originalName: string;
    newName?: string;
    items: string[];
    fire_events: boolean;
    stop_single_events: boolean;
    group_elements: boolean;
  }) => void;
  onCancel: () => void;
}

export interface CollectionEditorInstance {
  setData: (data: CollectionEditorData) => void;
  destroy: () => void;
}

export function initCollectionEditorComponent(
  elements: CollectionEditorElements,
  callbacks: CollectionEditorCallbacks
): CollectionEditorInstance {
  let collectionName = '';
  let existingNames: string[] = [];
  let editorIncludedItems: string[] = [];
  let editorAvailableItems: string[] = [];
  let selectedAvailable: string | null = null;
  let selectedIncluded: string | null = null;
  let availableFilter = '';
  let includedFilter = '';
  let draggedIncludedIndex: number | null = null;

  function renderLists(): void {
    elements.availableList.innerHTML = '';
    elements.includedList.innerHTML = '';

    const availableFilterLower = availableFilter.toLowerCase();
    const filteredAvailable = availableFilter
      ? editorAvailableItems.filter(name => name.toLowerCase().includes(availableFilterLower))
      : editorAvailableItems;

    for (const name of filteredAvailable) {
      const item = document.createElement('div');
      item.className = 'editor-item';
      if (name === selectedAvailable) item.classList.add('selected');
      item.textContent = name;
      item.addEventListener('click', () => {
        selectedAvailable = name;
        selectedIncluded = null;
        renderLists();
      });
      item.addEventListener('dblclick', () => {
        addToIncluded(name);
      });
      elements.availableList.appendChild(item);
    }

    const includedFilterLower = includedFilter.toLowerCase();
    const filteredIncluded = includedFilter
      ? editorIncludedItems
          .map((name, index) => ({ name, index }))
          .filter(({ name }) => name.toLowerCase().includes(includedFilterLower))
      : editorIncludedItems.map((name, index) => ({ name, index }));

    filteredIncluded.forEach(({ name, index }) => {
      const item = document.createElement('div');
      item.className = 'editor-item';
      item.draggable = true;
      item.dataset.index = String(index);
      if (name === selectedIncluded) item.classList.add('selected');
      item.textContent = name;

      item.addEventListener('click', () => {
        selectedIncluded = name;
        selectedAvailable = null;
        renderLists();
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
        elements.includedList.querySelectorAll('.editor-item').forEach(el => {
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
          renderLists();
        }
        draggedIncludedIndex = null;
      });

      elements.includedList.appendChild(item);
    });
  }

  function addToIncluded(name: string): void {
    const idx = editorAvailableItems.indexOf(name);
    if (idx !== -1) {
      editorAvailableItems.splice(idx, 1);
      editorIncludedItems.push(name);
      selectedAvailable = null;
      selectedIncluded = name;
      renderLists();
    }
  }

  function removeFromIncluded(name: string): void {
    const idx = editorIncludedItems.indexOf(name);
    if (idx !== -1) {
      editorIncludedItems.splice(idx, 1);
      editorAvailableItems.push(name);
      editorAvailableItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      selectedIncluded = null;
      selectedAvailable = name;
      renderLists();
    }
  }

  function validate(): boolean {
    const newName = elements.nameInput.value.trim();
    const okBtn = elements.okBtn as HTMLButtonElement;

    if (!newName) {
      okBtn.disabled = true;
      elements.errorEl.textContent = 'Name cannot be empty';
      return false;
    }

    const newNameLower = newName.toLowerCase();
    const currentNameLower = collectionName.toLowerCase();
    const nameExists = existingNames.some(
      n => n.toLowerCase() === newNameLower && n.toLowerCase() !== currentNameLower
    );
    if (nameExists) {
      okBtn.disabled = true;
      elements.errorEl.textContent = 'Name already exists';
      return false;
    }

    okBtn.disabled = false;
    elements.errorEl.textContent = '';
    return true;
  }

  function save(): void {
    if (!validate()) return;

    const newName = elements.nameInput.value.trim();
    callbacks.onSave({
      originalName: collectionName,
      newName: newName !== collectionName ? newName : undefined,
      items: editorIncludedItems,
      fire_events: elements.fireEvents.checked,
      stop_single_events: elements.stopSingle.checked,
      group_elements: elements.group.checked,
    });
  }

  elements.availableFilter.addEventListener('input', e => {
    availableFilter = (e.target as HTMLInputElement).value;
    renderLists();
  });

  elements.includedFilter.addEventListener('input', e => {
    includedFilter = (e.target as HTMLInputElement).value;
    renderLists();
  });

  elements.addBtn.addEventListener('click', () => {
    if (selectedAvailable) addToIncluded(selectedAvailable);
  });

  elements.removeBtn.addEventListener('click', () => {
    if (selectedIncluded) removeFromIncluded(selectedIncluded);
  });

  elements.upBtn.addEventListener('click', () => {
    if (!selectedIncluded) return;
    const idx = editorIncludedItems.indexOf(selectedIncluded);
    if (idx > 0) {
      [editorIncludedItems[idx - 1], editorIncludedItems[idx]] = [
        editorIncludedItems[idx],
        editorIncludedItems[idx - 1],
      ];
      renderLists();
    }
  });

  elements.downBtn.addEventListener('click', () => {
    if (!selectedIncluded) return;
    const idx = editorIncludedItems.indexOf(selectedIncluded);
    if (idx >= 0 && idx < editorIncludedItems.length - 1) {
      [editorIncludedItems[idx], editorIncludedItems[idx + 1]] = [
        editorIncludedItems[idx + 1],
        editorIncludedItems[idx],
      ];
      renderLists();
    }
  });

  elements.okBtn.addEventListener('click', save);
  elements.cancelBtn.addEventListener('click', () => callbacks.onCancel());
  elements.closeBtn?.addEventListener('click', () => callbacks.onCancel());
  elements.nameInput.addEventListener('input', validate);

  function setData(data: CollectionEditorData): void {
    collectionName = data.collectionName;
    existingNames = data.existingNames;
    editorIncludedItems = [...data.includedItems];
    editorAvailableItems = [...data.availableItems];
    selectedAvailable = null;
    selectedIncluded = null;
    availableFilter = '';
    includedFilter = '';

    elements.nameInput.value = data.collectionName;
    elements.availableFilter.value = '';
    elements.includedFilter.value = '';
    elements.fireEvents.checked = data.fireEvents;
    elements.stopSingle.checked = data.stopSingle;
    elements.group.checked = data.groupElements;

    renderLists();
    validate();
  }

  return {
    setData,
    destroy: () => {},
  };
}

export interface CollectionManagerElements {
  list: HTMLElement;
  newBtn: HTMLElement;
  fromSelectionBtn: HTMLElement;
  editBtn: HTMLElement;
  renameBtn: HTMLElement;
  deleteBtn: HTMLElement;
  upBtn: HTMLElement;
  downBtn: HTMLElement;
  closeBtn?: HTMLElement;
  statusEl: HTMLElement | null;
  editorOverlay: HTMLElement;
  editorNameInput: HTMLInputElement;
  editorAvailableFilter: HTMLInputElement;
  editorIncludedFilter: HTMLInputElement;
  editorAvailableList: HTMLElement;
  editorIncludedList: HTMLElement;
  editorAddBtn: HTMLElement;
  editorRemoveBtn: HTMLElement;
  editorUpBtn: HTMLElement;
  editorDownBtn: HTMLElement;
  editorFireEvents: HTMLInputElement;
  editorStopSingle: HTMLInputElement;
  editorGroup: HTMLInputElement;
  editorOkBtn: HTMLElement;
  editorCancelBtn: HTMLElement;
  editorCloseBtn?: HTMLElement;
  editorError: HTMLElement;
  promptOverlay: HTMLElement;
  promptTitle?: HTMLElement;
  promptCloseBtn?: HTMLElement;
  promptInput: HTMLInputElement;
  promptError: HTMLElement;
  promptOkBtn: HTMLElement;
  promptCancelBtn: HTMLElement;
}

export interface CollectionManagerCallbacks {
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  getSelectedItems?: () => string[];
  onCollectionsChanged?: () => void;
  onClose?: () => void;
  openEditorWindow?: (name: string) => void;
  openPromptWindow?: (mode: 'new' | 'rename', name?: string) => void;
  createFromSelection?: () => void;
  moveUp?: (name: string) => void;
  moveDown?: (name: string) => void;
  deleteCollection?: (name: string) => void;
}

export interface CollectionManagerData {
  extractedDir: string;
  collections: Collection[];
  allItems: string[];
}

export interface CollectionManagerInstance {
  setData: (data: CollectionManagerData) => void;
  setUIDisabled: (disabled: boolean) => void;
  renderList: () => void;
  selectCollection: (name: string | null) => void;
  refreshButtonStates: () => void;
  getCollections: () => Collection[];
  destroy: () => void;
}

export function initCollectionManagerComponent(
  elements: CollectionManagerElements,
  callbacks: CollectionManagerCallbacks,
  initialData?: CollectionManagerData
): CollectionManagerInstance {
  let collections: Collection[] = initialData?.collections || [];
  let allItems: string[] = initialData?.allItems || [];
  let extractedDir = initialData?.extractedDir || '';
  let selectedCollection: string | null = null;
  let uiDisabled = true;
  let draggedIndex: number | null = null;

  let editorCollection: string = '';
  let editorIncludedItems: string[] = [];
  let editorAvailableItems: string[] = [];
  let selectedAvailable: string | null = null;
  let selectedIncluded: string | null = null;
  let availableFilter = '';
  let includedFilter = '';
  let draggedIncludedIndex: number | null = null;

  let promptMode: 'new' | 'rename' = 'new';
  let promptCurrentName = '';

  function setStatus(msg: string): void {
    if (elements.statusEl) {
      elements.statusEl.textContent = msg;
    }
  }

  async function saveCollections(): Promise<void> {
    await callbacks.writeFile(`${extractedDir}/collections.json`, JSON.stringify(collections, null, 2));
    callbacks.onCollectionsChanged?.();
  }

  function renderList(): void {
    elements.list.innerHTML = '';

    collections.forEach((collection, index) => {
      const item = document.createElement('div');
      item.className = 'collection-manager-item';
      item.draggable = true;
      item.dataset.index = String(index);
      if (collection.name === selectedCollection) {
        item.classList.add('selected');
      }
      const itemCount = collection.items?.length || 0;
      item.innerHTML = `
        <span>${collection.name}</span>
        <span class="collection-manager-item-count">${itemCount}</span>
      `;

      item.addEventListener('click', () => {
        selectedCollection = collection.name;
        renderList();
      });

      item.addEventListener('dblclick', () => {
        if (callbacks.openEditorWindow) {
          callbacks.openEditorWindow(collection.name);
        } else {
          openEditor(collection.name);
        }
      });

      item.addEventListener('dragstart', (e: DragEvent) => {
        draggedIndex = index;
        item.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedIndex = null;
        elements.list.querySelectorAll('.collection-manager-item').forEach(el => {
          el.classList.remove('drag-over-above', 'drag-over-below');
        });
      });

      item.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        const targetIndex = parseInt(item.dataset.index!, 10);
        if (draggedIndex !== null && targetIndex !== draggedIndex) {
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

      item.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        const isAbove = item.classList.contains('drag-over-above');
        item.classList.remove('drag-over-above', 'drag-over-below');
        let targetIndex = parseInt(item.dataset.index!, 10);

        if (draggedIndex !== null && targetIndex !== draggedIndex) {
          const [movedCollection] = collections.splice(draggedIndex, 1);
          if (draggedIndex < targetIndex) {
            targetIndex--;
          }
          if (!isAbove) {
            targetIndex++;
          }
          collections.splice(targetIndex, 0, movedCollection);
          selectedCollection = movedCollection.name;
          renderList();
          await saveCollections();
        }
        draggedIndex = null;
      });

      elements.list.appendChild(item);

      if (collection.name === selectedCollection) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });

    updateButtonStates();
  }

  function updateButtonStates(): void {
    const hasSelection = selectedCollection !== null;
    const selectedIndex = selectedCollection ? collections.findIndex(c => c.name === selectedCollection) : -1;
    const canMoveUp = hasSelection && selectedIndex > 0;
    const canMoveDown = hasSelection && selectedIndex >= 0 && selectedIndex < collections.length - 1;
    const hasItemSelection = (callbacks.getSelectedItems?.() || []).length > 0;

    if (elements.editBtn instanceof HTMLButtonElement) elements.editBtn.disabled = !hasSelection || uiDisabled;
    if (elements.renameBtn instanceof HTMLButtonElement) elements.renameBtn.disabled = !hasSelection || uiDisabled;
    if (elements.deleteBtn instanceof HTMLButtonElement) elements.deleteBtn.disabled = !hasSelection || uiDisabled;
    if (elements.upBtn instanceof HTMLButtonElement) elements.upBtn.disabled = !canMoveUp || uiDisabled;
    if (elements.downBtn instanceof HTMLButtonElement) elements.downBtn.disabled = !canMoveDown || uiDisabled;
    if (elements.newBtn instanceof HTMLButtonElement) elements.newBtn.disabled = uiDisabled;
    if (elements.fromSelectionBtn instanceof HTMLButtonElement)
      elements.fromSelectionBtn.disabled = !hasItemSelection || uiDisabled;
  }

  function openEditor(collectionName: string): void {
    const collection = collections.find(c => c.name === collectionName);
    if (!collection) return;

    editorCollection = collectionName;
    const collectionItems = collection.items || [];
    editorIncludedItems = [...collectionItems];
    editorAvailableItems = allItems.filter(item => !collectionItems.includes(item));
    selectedAvailable = null;
    selectedIncluded = null;
    availableFilter = '';
    includedFilter = '';

    elements.editorNameInput.value = collectionName;
    elements.editorAvailableFilter.value = '';
    elements.editorIncludedFilter.value = '';
    elements.editorFireEvents.checked = collection.fire_events || false;
    elements.editorStopSingle.checked = collection.stop_single_events || false;
    elements.editorGroup.checked = collection.group_elements || false;

    renderEditorLists();
    validateEditor();
    elements.editorOverlay.classList.remove('hidden');
  }

  function renderEditorLists(): void {
    elements.editorAvailableList.innerHTML = '';
    elements.editorIncludedList.innerHTML = '';

    const availableFilterLower = availableFilter.toLowerCase();
    const filteredAvailable = availableFilter
      ? editorAvailableItems.filter(name => name.toLowerCase().includes(availableFilterLower))
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
      elements.editorAvailableList.appendChild(item);
    }

    const includedFilterLower = includedFilter.toLowerCase();
    const filteredIncluded = includedFilter
      ? editorIncludedItems
          .map((name, index) => ({ name, index }))
          .filter(({ name }) => name.toLowerCase().includes(includedFilterLower))
      : editorIncludedItems.map((name, index) => ({ name, index }));

    filteredIncluded.forEach(({ name, index }) => {
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
        elements.editorIncludedList.querySelectorAll('.editor-item').forEach(el => {
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

      elements.editorIncludedList.appendChild(item);
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
      editorAvailableItems.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      selectedIncluded = null;
      selectedAvailable = name;
      renderEditorLists();
    }
  }

  function validateEditor(): boolean {
    const newName = elements.editorNameInput.value.trim();
    const okBtn = elements.editorOkBtn as HTMLButtonElement;

    if (!newName) {
      okBtn.disabled = true;
      elements.editorError.textContent = 'Name cannot be empty';
      return false;
    }

    const newNameLower = newName.toLowerCase();
    const currentNameLower = editorCollection.toLowerCase();
    const exists = collections.some(
      c => c.name.toLowerCase() === newNameLower && c.name.toLowerCase() !== currentNameLower
    );
    if (exists) {
      okBtn.disabled = true;
      elements.editorError.textContent = 'Name already exists';
      return false;
    }

    okBtn.disabled = false;
    elements.editorError.textContent = '';
    return true;
  }

  async function saveEditor(): Promise<void> {
    if (!validateEditor()) return;

    const newName = elements.editorNameInput.value.trim();
    const collection = collections.find(c => c.name === editorCollection);
    if (!collection) return;

    if (newName !== editorCollection) {
      collection.name = newName;
    }

    collection.items = [...editorIncludedItems];
    collection.fire_events = elements.editorFireEvents.checked;
    collection.stop_single_events = elements.editorStopSingle.checked;
    collection.group_elements = elements.editorGroup.checked;

    await saveCollections();
    selectedCollection = newName;
    elements.editorOverlay.classList.add('hidden');
    renderList();
    setStatus(`Saved: ${newName}`);
  }

  function generateUniqueName(): string {
    const baseName = 'Collection';
    let suggestedName = baseName;
    let counter = 1;
    const existingNames = collections.map(c => c.name);
    while (existingNames.includes(suggestedName)) {
      suggestedName = `${baseName}_${counter++}`;
    }
    return suggestedName;
  }

  function openPrompt(mode: 'new' | 'rename', name?: string): void {
    promptMode = mode;
    promptCurrentName = name || '';
    elements.promptInput.value = mode === 'new' ? generateUniqueName() : name || '';
    elements.promptError.textContent = '';
    if (elements.promptTitle) {
      elements.promptTitle.textContent = mode === 'new' ? 'New Collection' : 'Rename Collection';
    }
    elements.promptOverlay.classList.remove('hidden');
    elements.promptInput.focus();
    elements.promptInput.select();
    validatePrompt();
  }

  function validatePrompt(): boolean {
    const newName = elements.promptInput.value.trim();
    const okBtn = elements.promptOkBtn as HTMLButtonElement;

    if (!newName) {
      okBtn.disabled = true;
      elements.promptError.textContent = 'Name cannot be empty';
      return false;
    }

    if (promptMode === 'rename' && newName.toLowerCase() === promptCurrentName.toLowerCase()) {
      okBtn.disabled = true;
      elements.promptError.textContent = '';
      return false;
    }

    const newNameLower = newName.toLowerCase();
    const currentNameLower = promptCurrentName.toLowerCase();
    const exists = collections.some(
      c => c.name.toLowerCase() === newNameLower && (promptMode === 'new' || c.name.toLowerCase() !== currentNameLower)
    );
    if (exists) {
      okBtn.disabled = true;
      elements.promptError.textContent = 'Name already exists';
      return false;
    }

    okBtn.disabled = false;
    elements.promptError.textContent = '';
    return true;
  }

  async function submitPrompt(): Promise<void> {
    if (!validatePrompt()) return;

    const newName = elements.promptInput.value.trim();

    if (promptMode === 'new') {
      const newCollection: Collection = {
        name: newName,
        items: [],
      };
      collections.push(newCollection);
      selectedCollection = newName;
      await saveCollections();
      renderList();
      setStatus(`Created: ${newName}`);
    } else {
      const collection = collections.find(c => c.name === promptCurrentName);
      if (collection) {
        collection.name = newName;
        selectedCollection = newName;
        await saveCollections();
        renderList();
        setStatus(`Renamed: ${promptCurrentName} → ${newName}`);
      }
    }

    elements.promptOverlay.classList.add('hidden');
  }

  async function createFromSelection(): Promise<void> {
    const selectedItems = callbacks.getSelectedItems?.() || [];
    if (selectedItems.length === 0) {
      setStatus('No items selected');
      return;
    }

    let baseName = 'Collection';
    let counter = 1;
    let name = baseName;
    while (collections.some(c => c.name === name)) {
      name = `${baseName}${counter++}`;
    }

    const newCollection: Collection = {
      name,
      items: [...selectedItems],
    };
    collections.push(newCollection);
    selectedCollection = name;
    await saveCollections();
    renderList();
    setStatus(`Created: ${name} (${selectedItems.length} items)`);
  }

  async function deleteCollection(): Promise<void> {
    if (!selectedCollection) return;

    const confirmed = confirm(`Delete collection "${selectedCollection}"?`);
    if (!confirmed) return;

    const name = selectedCollection;
    collections = collections.filter(c => c.name !== name);
    selectedCollection = collections.length > 0 ? collections[0].name : null;
    await saveCollections();
    renderList();
    setStatus(`Deleted: ${name}`);
  }

  async function moveUp(): Promise<void> {
    if (!selectedCollection) return;
    const idx = collections.findIndex(c => c.name === selectedCollection);
    if (idx > 0) {
      [collections[idx - 1], collections[idx]] = [collections[idx], collections[idx - 1]];
      await saveCollections();
      renderList();
    }
  }

  async function moveDown(): Promise<void> {
    if (!selectedCollection) return;
    const idx = collections.findIndex(c => c.name === selectedCollection);
    if (idx >= 0 && idx < collections.length - 1) {
      [collections[idx], collections[idx + 1]] = [collections[idx + 1], collections[idx]];
      await saveCollections();
      renderList();
    }
  }

  elements.newBtn.addEventListener('click', () => {
    if (callbacks.openPromptWindow) {
      callbacks.openPromptWindow('new');
    } else {
      openPrompt('new');
    }
  });
  elements.fromSelectionBtn.addEventListener('click', () => {
    if (callbacks.createFromSelection) {
      callbacks.createFromSelection();
    } else {
      createFromSelection();
    }
  });
  elements.editBtn.addEventListener('click', () => {
    if (!selectedCollection) return;
    if (callbacks.openEditorWindow) {
      callbacks.openEditorWindow(selectedCollection);
    } else {
      openEditor(selectedCollection);
    }
  });
  elements.renameBtn.addEventListener('click', () => {
    if (!selectedCollection) return;
    if (callbacks.openPromptWindow) {
      callbacks.openPromptWindow('rename', selectedCollection);
    } else {
      openPrompt('rename', selectedCollection);
    }
  });
  elements.deleteBtn.addEventListener('click', () => {
    if (!selectedCollection) return;
    if (callbacks.deleteCollection) {
      callbacks.deleteCollection(selectedCollection);
    } else {
      deleteCollection();
    }
  });
  elements.upBtn.addEventListener('click', () => {
    if (!selectedCollection) return;
    if (callbacks.moveUp) {
      callbacks.moveUp(selectedCollection);
    } else {
      moveUp();
    }
  });
  elements.downBtn.addEventListener('click', () => {
    if (!selectedCollection) return;
    if (callbacks.moveDown) {
      callbacks.moveDown(selectedCollection);
    } else {
      moveDown();
    }
  });
  elements.closeBtn?.addEventListener('click', () => callbacks.onClose?.());

  elements.editorAvailableFilter.addEventListener('input', e => {
    availableFilter = (e.target as HTMLInputElement).value;
    renderEditorLists();
  });

  elements.editorIncludedFilter.addEventListener('input', e => {
    includedFilter = (e.target as HTMLInputElement).value;
    renderEditorLists();
  });

  elements.editorAddBtn.addEventListener('click', () => {
    if (selectedAvailable) addToIncluded(selectedAvailable);
  });

  elements.editorRemoveBtn.addEventListener('click', () => {
    if (selectedIncluded) removeFromIncluded(selectedIncluded);
  });

  elements.editorUpBtn.addEventListener('click', () => {
    if (!selectedIncluded) return;
    const idx = editorIncludedItems.indexOf(selectedIncluded);
    if (idx > 0) {
      [editorIncludedItems[idx - 1], editorIncludedItems[idx]] = [
        editorIncludedItems[idx],
        editorIncludedItems[idx - 1],
      ];
      renderEditorLists();
    }
  });

  elements.editorDownBtn.addEventListener('click', () => {
    if (!selectedIncluded) return;
    const idx = editorIncludedItems.indexOf(selectedIncluded);
    if (idx >= 0 && idx < editorIncludedItems.length - 1) {
      [editorIncludedItems[idx], editorIncludedItems[idx + 1]] = [
        editorIncludedItems[idx + 1],
        editorIncludedItems[idx],
      ];
      renderEditorLists();
    }
  });

  elements.editorOkBtn.addEventListener('click', saveEditor);
  elements.editorCancelBtn.addEventListener('click', () => {
    elements.editorOverlay.classList.add('hidden');
  });
  elements.editorCloseBtn?.addEventListener('click', () => {
    elements.editorOverlay.classList.add('hidden');
  });
  elements.editorNameInput.addEventListener('input', validateEditor);

  elements.promptInput.addEventListener('input', validatePrompt);
  elements.promptOkBtn.addEventListener('click', submitPrompt);
  elements.promptCancelBtn.addEventListener('click', () => {
    elements.promptOverlay.classList.add('hidden');
  });

  elements.promptCloseBtn?.addEventListener('click', () => {
    elements.promptOverlay.classList.add('hidden');
  });

  elements.promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitPrompt();
    } else if (e.key === 'Escape') {
      elements.promptOverlay.classList.add('hidden');
    }
  });

  function setData(data: CollectionManagerData): void {
    extractedDir = data.extractedDir;
    collections = data.collections || [];
    allItems = data.allItems || [];
    if (!selectedCollection || !collections.some(c => c.name === selectedCollection)) {
      selectedCollection = collections.length > 0 ? collections[0].name : null;
    }
  }

  function setUIDisabled(disabled: boolean): void {
    uiDisabled = disabled;
    updateButtonStates();
    if (disabled) {
      collections = [];
      allItems = [];
      selectedCollection = null;
      elements.list.innerHTML = '';
      setStatus('No table loaded');
    }
  }

  function destroy(): void {
    // Cleanup if needed
  }

  return {
    setData,
    setUIDisabled,
    renderList,
    selectCollection: (name: string | null) => {
      selectedCollection = name;
      renderList();
    },
    refreshButtonStates: updateButtonStates,
    getCollections: () => collections,
    destroy,
  };
}
