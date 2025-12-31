import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

let collections = [];
let items = {};
let selectedItems = [];
let selectedManagerCollection = null;
let draggedIndex = null;
let creatingCollection = false;
let editorOpen = false;

setupThemeListener();

window.vpxEditor.onInitCollectionManager?.(data => {
  collections = data.collections || [];
  items = data.items || {};
  selectedItems = data.selectedItems || [];
  selectedManagerCollection = collections.length > 0 ? collections[0].name : null;
  renderManagerList();
});

window.vpxEditor.onCollectionsChanged?.(data => {
  collections = data.collections || [];
  creatingCollection = false;
  if (data.selectCollection) {
    selectedManagerCollection = data.selectCollection;
  } else if (selectedManagerCollection && !collections.find(c => c.name === selectedManagerCollection)) {
    selectedManagerCollection = collections.length > 0 ? collections[0].name : null;
  }
  renderManagerList();
  if (data.selectCollection) {
    const list = document.getElementById('collection-manager-list');
    const selectedItem = list.querySelector('.collection-manager-item.selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }
});

window.vpxEditor.onSetDisabled?.(disabled => {
  if (disabled) {
    collections = [];
    items = {};
    selectedItems = [];
    selectedManagerCollection = null;
    document.getElementById('collection-manager-list').innerHTML = '';
  }
});

window.vpxEditor.onSetEditorOpen?.(isOpen => {
  editorOpen = isOpen;
  const buttons = document.querySelector('.collection-manager-buttons');
  const footer = document.querySelector('.collection-manager-footer');
  const list = document.getElementById('collection-manager-list');
  if (buttons) {
    buttons.querySelectorAll('button').forEach(btn => {
      btn.disabled = isOpen;
      btn.style.opacity = isOpen ? '0.5' : '';
    });
  }
  if (footer) {
    footer.querySelectorAll('button').forEach(btn => {
      btn.disabled = isOpen;
      btn.style.opacity = isOpen ? '0.5' : '';
    });
  }
  if (list) {
    list.style.pointerEvents = isOpen ? 'none' : '';
    list.style.opacity = isOpen ? '0.7' : '';
  }
});

window.vpxEditor.onSelectionChanged?.(items => {
  selectedItems = items || [];
});

function renderManagerList() {
  const list = document.getElementById('collection-manager-list');
  list.innerHTML = '';

  collections.forEach((collection, index) => {
    const item = document.createElement('div');
    item.className = 'collection-manager-item';
    item.draggable = true;
    item.dataset.index = index;
    if (collection.name === selectedManagerCollection) {
      item.classList.add('selected');
    }
    item.innerHTML = `
      <span>${collection.name}</span>
      <span class="collection-manager-item-count">${collection.items.length}</span>
    `;
    item.addEventListener('click', () => {
      selectedManagerCollection = collection.name;
      renderManagerList();
    });
    item.addEventListener('dblclick', () => {
      window.vpxEditor.openCollectionEditor(collection.name);
    });

    item.addEventListener('dragstart', e => {
      draggedIndex = index;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedIndex = null;
      document.querySelectorAll('.collection-manager-item').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetIndex = parseInt(item.dataset.index);
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

    item.addEventListener('drop', e => {
      e.preventDefault();
      const isAbove = item.classList.contains('drag-over-above');
      item.classList.remove('drag-over-above', 'drag-over-below');
      let targetIndex = parseInt(item.dataset.index);

      if (draggedIndex !== null && targetIndex !== draggedIndex) {
        const [movedCollection] = collections.splice(draggedIndex, 1);
        if (draggedIndex < targetIndex) {
          targetIndex--;
        }
        if (!isAbove) {
          targetIndex++;
        }
        collections.splice(targetIndex, 0, movedCollection);
        selectedManagerCollection = movedCollection.name;
        renderManagerList();
        window.vpxEditor.collectionReorder(collections.map(c => c.name));
      }
      draggedIndex = null;
    });

    list.appendChild(item);
  });
}

document.getElementById('collection-manager-close').addEventListener('click', () => {
  window.close();
});

document.getElementById('collection-manager-new').addEventListener('click', () => {
  window.vpxEditor.openCollectionPrompt('new', null);
});

document.getElementById('collection-manager-from-selection').addEventListener('click', async () => {
  if (selectedItems.length === 0 || creatingCollection) return;
  creatingCollection = true;
  window.vpxEditor.collectionCreateFromSelection();
});

document.getElementById('collection-manager-edit').addEventListener('click', () => {
  if (selectedManagerCollection) {
    window.vpxEditor.openCollectionEditor(selectedManagerCollection);
  }
});

document.getElementById('collection-manager-rename').addEventListener('click', () => {
  if (selectedManagerCollection) {
    window.vpxEditor.openCollectionPrompt('rename', selectedManagerCollection);
  }
});

document.getElementById('collection-manager-delete').addEventListener('click', () => {
  if (!selectedManagerCollection) return;
  window.vpxEditor.collectionDelete(selectedManagerCollection);
});

document.getElementById('collection-manager-up').addEventListener('click', () => {
  if (!selectedManagerCollection) return;
  window.vpxEditor.collectionMoveUp(selectedManagerCollection);
});

document.getElementById('collection-manager-down').addEventListener('click', () => {
  if (!selectedManagerCollection) return;
  window.vpxEditor.collectionMoveDown(selectedManagerCollection);
});

setupKeyboardShortcuts({
  onEscape: () => window.close(),
});
