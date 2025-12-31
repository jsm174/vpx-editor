import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

let collectionName = '';
let editorIncludedItems = [];
let editorAvailableItems = [];
let existingNames = [];
let selectedAvailable = null;
let selectedIncluded = null;
let draggedIncludedIndex = null;
let availableFilter = '';
let includedFilter = '';

setupThemeListener();

window.vpxEditor.onInitCollectionEditor?.(data => {
  collectionName = data.collectionName;
  editorIncludedItems = [...data.includedItems];
  editorAvailableItems = [...data.availableItems];
  existingNames = data.existingNames || [];

  document.getElementById('collection-editor-name').value = data.collectionName;
  document.getElementById('collection-editor-fire-events').checked = data.fireEvents ?? false;
  document.getElementById('collection-editor-stop-single').checked = data.stopSingle ?? false;
  document.getElementById('collection-editor-group').checked = data.groupElements ?? false;

  selectedAvailable = null;
  selectedIncluded = null;
  availableFilter = '';
  includedFilter = '';
  document.getElementById('collection-editor-available-filter').value = '';
  document.getElementById('collection-editor-included-filter').value = '';

  renderEditorLists();
  validateName();
});

window.vpxEditor.onUpdateCollectionEditorItems?.(data => {
  const allItems = data.allItems || [];
  existingNames = data.existingNames || [];

  const newIncluded = editorIncludedItems.filter(name => allItems.includes(name));
  const newAvailable = allItems.filter(name => !newIncluded.includes(name));

  const addedItems = allItems.filter(
    name => !editorIncludedItems.includes(name) && !editorAvailableItems.includes(name)
  );
  const renamedInIncluded = editorIncludedItems.filter(name => !allItems.includes(name));

  if (renamedInIncluded.length > 0 && addedItems.length > 0) {
    for (let i = 0; i < editorIncludedItems.length; i++) {
      if (!allItems.includes(editorIncludedItems[i]) && addedItems.length > 0) {
        editorIncludedItems[i] = addedItems.shift();
      }
    }
  }

  editorIncludedItems = editorIncludedItems.filter(name => allItems.includes(name));
  editorAvailableItems = allItems.filter(name => !editorIncludedItems.includes(name));

  renderEditorLists();
  validateName();
});

function renderEditorLists() {
  const availableList = document.getElementById('collection-editor-available');
  const includedList = document.getElementById('collection-editor-included');

  availableList.innerHTML = '';
  includedList.innerHTML = '';

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
    availableList.appendChild(item);
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
    item.dataset.index = index;
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

    item.addEventListener('dragstart', e => {
      draggedIncludedIndex = index;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedIncludedIndex = null;
      document.querySelectorAll('.editor-item').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetIndex = parseInt(item.dataset.index);
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

    item.addEventListener('drop', e => {
      e.preventDefault();
      const isAbove = item.classList.contains('drag-over-above');
      item.classList.remove('drag-over-above', 'drag-over-below');
      let targetIndex = parseInt(item.dataset.index);

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

function addToIncluded(name) {
  const idx = editorAvailableItems.indexOf(name);
  if (idx !== -1) {
    editorAvailableItems.splice(idx, 1);
    editorIncludedItems.push(name);
    selectedAvailable = null;
    selectedIncluded = name;
    renderEditorLists();
  }
}

function removeFromIncluded(name) {
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

document.getElementById('collection-editor-available-filter').addEventListener('input', e => {
  availableFilter = e.target.value;
  renderEditorLists();
});

document.getElementById('collection-editor-included-filter').addEventListener('input', e => {
  includedFilter = e.target.value;
  renderEditorLists();
});

document.getElementById('collection-editor-add').addEventListener('click', () => {
  if (selectedAvailable) {
    addToIncluded(selectedAvailable);
  }
});

document.getElementById('collection-editor-remove').addEventListener('click', () => {
  if (selectedIncluded) {
    removeFromIncluded(selectedIncluded);
  }
});

document.getElementById('collection-editor-up').addEventListener('click', () => {
  if (!selectedIncluded) return;
  const idx = editorIncludedItems.indexOf(selectedIncluded);
  if (idx > 0) {
    [editorIncludedItems[idx - 1], editorIncludedItems[idx]] = [editorIncludedItems[idx], editorIncludedItems[idx - 1]];
    renderEditorLists();
  }
});

document.getElementById('collection-editor-down').addEventListener('click', () => {
  if (!selectedIncluded) return;
  const idx = editorIncludedItems.indexOf(selectedIncluded);
  if (idx >= 0 && idx < editorIncludedItems.length - 1) {
    [editorIncludedItems[idx], editorIncludedItems[idx + 1]] = [editorIncludedItems[idx + 1], editorIncludedItems[idx]];
    renderEditorLists();
  }
});

function validateName() {
  const input = document.getElementById('collection-editor-name');
  const okBtn = document.getElementById('collection-editor-ok');
  const newName = input.value.trim();

  if (!newName) {
    okBtn.disabled = true;
    return false;
  }

  const nameExists = existingNames.some(n => n === newName && n !== collectionName);
  if (nameExists) {
    okBtn.disabled = true;
    return false;
  }

  okBtn.disabled = false;
  return true;
}

document.getElementById('collection-editor-name').addEventListener('input', validateName);

document.getElementById('collection-editor-cancel').addEventListener('click', () => {
  window.vpxEditor.collectionEditorCancel();
});

document.getElementById('collection-editor-ok').addEventListener('click', () => {
  if (!validateName()) return;

  const newName = document.getElementById('collection-editor-name').value.trim();
  const fireEvents = document.getElementById('collection-editor-fire-events').checked;
  const stopSingle = document.getElementById('collection-editor-stop-single').checked;
  const group = document.getElementById('collection-editor-group').checked;

  window.vpxEditor.collectionEditorSave({
    originalName: collectionName,
    newName: newName,
    items: editorIncludedItems,
    fire_events: fireEvents,
    stop_single_events: stopSingle,
    group_elements: group,
  });
});

setupKeyboardShortcuts({
  onEscape: () => window.vpxEditor.collectionEditorCancel(),
});
