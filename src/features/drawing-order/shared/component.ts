import { escapeHtml } from '../../../shared/window-utils';

export interface DrawingOrderItem {
  _type?: string;
  name: string;
  height_top?: number;
  height?: number;
  hit_accuracy?: number;
  position?: { x: number; y: number; z?: number };
  drawingIndex?: number;
  [key: string]: unknown;
}

export type DrawingOrderMode = 'select' | 'hit';

export interface DrawingOrderCallbacks {
  onSave: (mode: DrawingOrderMode, orderedNames: string[]) => void;
  onCancel: () => void;
}

export interface GameItemEntry {
  file_name: string;
  [key: string]: unknown;
}

function encodeItemName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function getRawNameFromFileName(fileName: string): string {
  return fileName
    .replace(/^\w+\./, '')
    .replace(/\.json$/, '')
    .toLowerCase();
}

export function reorderGameitems<T extends GameItemEntry>(gameitems: T[], orderedNames: string[]): T[] | null {
  const itemNameToIndex: Record<string, number> = {};
  for (let i = 0; i < gameitems.length; i++) {
    const rawName = getRawNameFromFileName(gameitems[i].file_name);
    itemNameToIndex[rawName] = i;
  }

  const indicesToMove = orderedNames
    .map(name => itemNameToIndex[encodeItemName(name)])
    .filter((i): i is number => i !== undefined);

  if (indicesToMove.length < 2) {
    return null;
  }

  const minIndex = Math.min(...indicesToMove);
  const movedItems = indicesToMove.map(i => gameitems[i]);
  const newGameitems = gameitems.filter((_, i) => !indicesToMove.includes(i));

  for (let i = 0; i < movedItems.length; i++) {
    newGameitems.splice(minIndex + i, 0, movedItems[movedItems.length - 1 - i]);
  }

  return newGameitems;
}

function getHeightValue(item: DrawingOrderItem): string {
  const type = item._type;

  switch (type) {
    case 'Wall':
      return item.height_top != null ? item.height_top.toFixed(1) : '';
    case 'Primitive':
      if (item.position && item.position.z != null) {
        return item.position.z.toFixed(1);
      }
      return '';
    case 'Ramp':
      return item.height_top != null ? item.height_top.toFixed(1) : '';
    case 'Flasher':
      return item.height != null ? item.height.toFixed(1) : '';
    case 'Rubber':
      return item.height != null ? item.height.toFixed(1) : '';
    case 'Spinner':
      return item.height != null ? item.height.toFixed(1) : '';
    case 'Kicker':
      return item.hit_accuracy != null ? item.hit_accuracy.toFixed(1) : '';
    case 'Light':
      return 'n.a.';
    case 'Bumper':
      return 'n.a.';
    case 'Flipper':
      return item.height != null ? item.height.toFixed(1) : '';
    case 'Gate':
      return item.height != null ? item.height.toFixed(1) : '';
    case 'Plunger':
      return item.height != null ? item.height.toFixed(1) : '';
    default:
      return '';
  }
}

function getDisplayType(type: string | undefined): string {
  switch (type) {
    case 'HitTarget':
      return 'Target';
    default:
      return type || '';
  }
}

export function initDrawingOrderComponent(
  container: HTMLElement,
  mode: DrawingOrderMode,
  initialItems: DrawingOrderItem[],
  callbacks: DrawingOrderCallbacks
): void {
  let items = [...initialItems];
  let selectedIndex = items.length > 0 ? 0 : -1;
  let draggedIndex: number | null = null;

  const title = mode === 'hit' ? 'Drawing Order (Hit)' : 'Drawing Order (Select)';

  container.innerHTML = `
    <div class="drawing-order-container">
      <div class="drawing-order-header">${title}</div>
      <div class="drawing-order-table-container">
        <table class="drawing-order-table">
          <thead>
            <tr>
              <th style="width: 200px">Name</th>
              <th style="width: 100px">Height/Z</th>
              <th style="width: 100px">Type</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="drawing-order-reorder-buttons">
        <button class="win-btn drawing-order-up">Up</button>
        <button class="win-btn drawing-order-down">Down</button>
      </div>
      <div class="drawing-order-footer">
        <button class="win-btn drawing-order-cancel">Cancel</button>
        <button class="win-btn primary drawing-order-ok">OK</button>
      </div>
    </div>
  `;

  const tableContainer = container.querySelector('.drawing-order-table-container') as HTMLElement;
  const table = container.querySelector('.drawing-order-table') as HTMLTableElement;
  const tbody = container.querySelector('.drawing-order-table tbody') as HTMLTableSectionElement;
  const upBtn = container.querySelector('.drawing-order-up') as HTMLButtonElement;
  const downBtn = container.querySelector('.drawing-order-down') as HTMLButtonElement;
  const okBtn = container.querySelector('.drawing-order-ok') as HTMLButtonElement;
  const cancelBtn = container.querySelector('.drawing-order-cancel') as HTMLButtonElement;

  function updateButtonStates(): void {
    upBtn.disabled = selectedIndex <= 0;
    downBtn.disabled = selectedIndex < 0 || selectedIndex >= items.length - 1;
  }

  function renderTable(): void {
    if (items.length === 0) {
      table.style.display = 'none';
      let emptyEl = tableContainer.querySelector('.drawing-order-empty-state') as HTMLElement | null;
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'drawing-order-empty-state';
        emptyEl.textContent = 'No items';
        tableContainer.appendChild(emptyEl);
      }
      updateButtonStates();
      return;
    }

    table.style.display = '';
    const emptyEl = tableContainer.querySelector('.drawing-order-empty-state');
    if (emptyEl) emptyEl.remove();

    tbody.innerHTML = items
      .map(
        (item, index) => `
        <tr data-index="${index}" class="${index === selectedIndex ? 'selected' : ''}" draggable="true">
          <td>${escapeHtml(item.name)}</td>
          <td>${getHeightValue(item)}</td>
          <td>${getDisplayType(item._type)}</td>
        </tr>
      `
      )
      .join('');

    tbody.querySelectorAll('tr[data-index]').forEach(row => {
      const rowElement = row as HTMLTableRowElement;

      row.addEventListener('click', () => {
        selectedIndex = parseInt(rowElement.dataset.index!, 10);
        renderTable();
      });

      row.addEventListener('dragstart', (e: Event) => {
        const dragEvent = e as DragEvent;
        draggedIndex = parseInt(rowElement.dataset.index!, 10);
        rowElement.classList.add('dragging');
        dragEvent.dataTransfer!.effectAllowed = 'move';
      });

      row.addEventListener('dragend', () => {
        rowElement.classList.remove('dragging');
        draggedIndex = null;
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', (e: Event) => {
        e.preventDefault();
        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer!.dropEffect = 'move';
        const targetIndex = parseInt(rowElement.dataset.index!, 10);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
          rowElement.classList.add('drag-over');
        }
      });

      row.addEventListener('dragleave', () => {
        rowElement.classList.remove('drag-over');
      });

      row.addEventListener('drop', (e: Event) => {
        e.preventDefault();
        const targetIndex = parseInt(rowElement.dataset.index!, 10);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          const draggedItem = items[draggedIndex];
          items.splice(draggedIndex, 1);
          items.splice(targetIndex, 0, draggedItem);
          selectedIndex = targetIndex;
          renderTable();
        }
      });
    });

    if (selectedIndex >= 0) {
      const selectedRow = tbody.querySelector(`tr[data-index="${selectedIndex}"]`);
      if (selectedRow) {
        selectedRow.scrollIntoView({ block: 'nearest' });
      }
    }

    updateButtonStates();
  }

  function moveUp(): void {
    if (selectedIndex <= 0) return;

    const temp = items[selectedIndex];
    items[selectedIndex] = items[selectedIndex - 1];
    items[selectedIndex - 1] = temp;
    selectedIndex--;
    renderTable();
  }

  function moveDown(): void {
    if (selectedIndex < 0 || selectedIndex >= items.length - 1) return;

    const temp = items[selectedIndex];
    items[selectedIndex] = items[selectedIndex + 1];
    items[selectedIndex + 1] = temp;
    selectedIndex++;
    renderTable();
  }

  function doSave(): void {
    const orderedNames = items.map(item => item.name);
    callbacks.onSave(mode, orderedNames);
  }

  function doCancel(): void {
    callbacks.onCancel();
  }

  upBtn.onclick = moveUp;
  downBtn.onclick = moveDown;
  okBtn.onclick = doSave;
  cancelBtn.onclick = doCancel;

  container.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.altKey) {
        moveUp();
      } else if (selectedIndex > 0) {
        selectedIndex--;
        renderTable();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.altKey) {
        moveDown();
      } else if (selectedIndex < items.length - 1) {
        selectedIndex++;
        renderTable();
      }
    } else if (e.key === 'Escape') {
      doCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      doSave();
    }
  });

  renderTable();
}
