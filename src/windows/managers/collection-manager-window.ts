import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

interface Collection {
  name: string;
  items: string[];
}

interface CollectionManagerData {
  collections?: Collection[];
  items?: Record<string, unknown>;
  selectedItems?: string[];
}

interface CollectionsChangedData {
  collections?: Collection[];
  selectCollection?: string;
}

let collections: Collection[] = [];
let selectedItems: string[] = [];
let selectedManagerCollection: string | null = null;
let draggedIndex: number | null = null;
let creatingCollection: boolean = false;

setupThemeListener();

window.vpxEditor.onInitCollectionManager?.(data => {
  const initData = data as CollectionManagerData;
  collections = initData.collections || [];
  selectedItems = initData.selectedItems || [];
  selectedManagerCollection = collections.length > 0 ? collections[0].name : null;
  renderManagerList();
});

window.vpxEditor.onCollectionsChanged?.(data => {
  const changedData = data as CollectionsChangedData;
  collections = changedData.collections || (data as Collection[]) || [];
  creatingCollection = false;
  if (changedData.selectCollection) {
    selectedManagerCollection = changedData.selectCollection;
  } else if (selectedManagerCollection && !collections.find((c: Collection) => c.name === selectedManagerCollection)) {
    selectedManagerCollection = collections.length > 0 ? collections[0].name : null;
  }
  renderManagerList();
  if (changedData.selectCollection) {
    const list = document.getElementById('collection-manager-list') as HTMLElement;
    const selectedItem = list.querySelector('.collection-manager-item.selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }
});

window.vpxEditor.onSetDisabled?.((disabled: boolean) => {
  if (disabled) {
    collections = [];
    selectedItems = [];
    selectedManagerCollection = null;
    (document.getElementById('collection-manager-list') as HTMLElement).innerHTML = '';
  }
});

window.vpxEditor.onSetEditorOpen?.((isOpen: boolean) => {
  const buttons = document.querySelector('.collection-manager-buttons') as HTMLElement | null;
  const footer = document.querySelector('.collection-manager-footer') as HTMLElement | null;
  const list = document.getElementById('collection-manager-list') as HTMLElement | null;
  if (buttons) {
    buttons.querySelectorAll('button').forEach((btn: HTMLButtonElement) => {
      btn.disabled = isOpen;
      btn.style.opacity = isOpen ? '0.5' : '';
    });
  }
  if (footer) {
    footer.querySelectorAll('button').forEach((btn: HTMLButtonElement) => {
      btn.disabled = isOpen;
      btn.style.opacity = isOpen ? '0.5' : '';
    });
  }
  if (list) {
    list.style.pointerEvents = isOpen ? 'none' : '';
    list.style.opacity = isOpen ? '0.7' : '';
  }
});

window.vpxEditor.onSelectionChanged?.((items: string[]) => {
  selectedItems = items || [];
});

function renderManagerList(): void {
  const list = document.getElementById('collection-manager-list') as HTMLElement;
  list.innerHTML = '';

  collections.forEach((collection: Collection, index: number) => {
    const item = document.createElement('div');
    item.className = 'collection-manager-item';
    item.draggable = true;
    item.dataset.index = String(index);
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

    item.addEventListener('dragstart', (e: DragEvent) => {
      draggedIndex = index;
      item.classList.add('dragging');
      e.dataTransfer!.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedIndex = null;
      document.querySelectorAll('.collection-manager-item').forEach((el: Element) => {
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

    item.addEventListener('drop', (e: DragEvent) => {
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
        selectedManagerCollection = movedCollection.name;
        renderManagerList();
        window.vpxEditor.collectionReorder(collections.map((c: Collection) => c.name));
      }
      draggedIndex = null;
    });

    list.appendChild(item);
  });
}

(document.getElementById('collection-manager-close') as HTMLButtonElement).addEventListener('click', () => {
  window.close();
});

(document.getElementById('collection-manager-new') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.openCollectionPrompt('new', null);
});

(document.getElementById('collection-manager-from-selection') as HTMLButtonElement).addEventListener(
  'click',
  async () => {
    if (selectedItems.length === 0 || creatingCollection) return;
    creatingCollection = true;
    window.vpxEditor.collectionCreateFromSelection();
  }
);

(document.getElementById('collection-manager-edit') as HTMLButtonElement).addEventListener('click', () => {
  if (selectedManagerCollection) {
    window.vpxEditor.openCollectionEditor(selectedManagerCollection);
  }
});

(document.getElementById('collection-manager-rename') as HTMLButtonElement).addEventListener('click', () => {
  if (selectedManagerCollection) {
    window.vpxEditor.openCollectionPrompt('rename', selectedManagerCollection);
  }
});

(document.getElementById('collection-manager-delete') as HTMLButtonElement).addEventListener('click', () => {
  if (!selectedManagerCollection) return;
  window.vpxEditor.collectionDelete(selectedManagerCollection);
});

(document.getElementById('collection-manager-up') as HTMLButtonElement).addEventListener('click', () => {
  if (!selectedManagerCollection) return;
  window.vpxEditor.collectionMoveUp(selectedManagerCollection);
});

(document.getElementById('collection-manager-down') as HTMLButtonElement).addEventListener('click', () => {
  if (!selectedManagerCollection) return;
  window.vpxEditor.collectionMoveDown(selectedManagerCollection);
});

setupKeyboardShortcuts({
  onEscape: (): void => window.close(),
});
