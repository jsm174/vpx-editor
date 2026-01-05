import { setupThemeListener, setupKeyboardShortcuts, escapeHtml } from '../../shared/window-utils.js';
import type { DrawingOrderItem, DrawingOrderMode } from '../../types/ipc.js';

let items: DrawingOrderItem[] = [];
let selectedIndex: number = -1;
let mode: DrawingOrderMode = 'select';
let draggedIndex: number | null = null;

setupThemeListener();

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

function getDisplayType(type: string): string {
  switch (type) {
    case 'HitTarget':
      return 'Target';
    default:
      return type;
  }
}

function updateButtonStates(): void {
  const upBtn = document.getElementById('drawing-order-up') as HTMLButtonElement;
  const downBtn = document.getElementById('drawing-order-down') as HTMLButtonElement;

  upBtn.disabled = selectedIndex <= 0;
  downBtn.disabled = selectedIndex < 0 || selectedIndex >= items.length - 1;
}

function renderTable(): void {
  const container = document.querySelector('.drawing-order-table-container') as HTMLElement;
  const tbody = document.querySelector('#drawing-order-table tbody') as HTMLTableSectionElement;
  const table = document.getElementById('drawing-order-table') as HTMLTableElement;

  if (items.length === 0) {
    table.style.display = 'none';
    let emptyEl = container.querySelector('.drawing-order-empty-state') as HTMLElement | null;
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'drawing-order-empty-state';
      emptyEl.textContent = 'No items';
      container.appendChild(emptyEl);
    }
    updateButtonStates();
    return;
  }

  table.style.display = '';
  const emptyEl = container.querySelector('.drawing-order-empty-state');
  if (emptyEl) emptyEl.remove();

  tbody.innerHTML = items
    .map(
      (item: DrawingOrderItem, index: number) => `
    <tr data-index="${index}" class="${index === selectedIndex ? 'selected' : ''}" draggable="true">
      <td>${escapeHtml(item.name)}</td>
      <td>${getHeightValue(item)}</td>
      <td>${getDisplayType(item._type || '')}</td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('tr[data-index]').forEach((row: Element) => {
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
      tbody.querySelectorAll('tr').forEach((r: Element) => r.classList.remove('drag-over'));
    });

    row.addEventListener('dragover', (e: Event) => {
      e.preventDefault();
      const dragEvent = e as DragEvent;
      dragEvent.dataTransfer!.dropEffect = 'move';
      const targetIndex = parseInt(rowElement.dataset.index!, 10);
      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        tbody.querySelectorAll('tr').forEach((r: Element) => r.classList.remove('drag-over'));
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
  window.vpxEditor.saveDrawingOrder({ mode, items });
  window.close();
}

function doCancel(): void {
  window.vpxEditor.drawingOrderCancel();
  window.close();
}

(document.getElementById('drawing-order-up') as HTMLButtonElement).onclick = moveUp;
(document.getElementById('drawing-order-down') as HTMLButtonElement).onclick = moveDown;
(document.getElementById('drawing-order-ok') as HTMLButtonElement).onclick = doSave;
(document.getElementById('drawing-order-cancel') as HTMLButtonElement).onclick = doCancel;

document.addEventListener('keydown', (e: KeyboardEvent) => {
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
  }
});

setupKeyboardShortcuts({
  onEscape: (): void => doCancel(),
  onEnter: (): void => doSave(),
  requireMeta: true,
});

window.vpxEditor.onInitDrawingOrder?.(data => {
  mode = data.mode || 'select';
  items = data.items || [];
  selectedIndex = items.length > 0 ? 0 : -1;
  document.title = mode === 'hit' ? 'Drawing Order (Hit)' : 'Drawing Order (Select)';
  renderTable();
});
