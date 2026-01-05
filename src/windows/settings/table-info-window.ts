import {
  setupThemeListener,
  setupKeyboardShortcuts,
  setupInputKeyboard,
  escapeHtml,
} from '../../shared/window-utils.js';
import type { TableInfo } from '../../types/data.js';
import type { TableInfoFormData } from '../../types/ipc.js';

interface CustomPropertyEntry {
  name: string;
  value: string;
}

type SortColumn = 'name' | 'value';
type SortDirection = 'asc' | 'desc';
type GameData = { screen_shot?: string };
type ImageInfo = { name: string };

let info: TableInfo = {};
let gamedata: GameData = {};
let images: ImageInfo[] = [];
let customProperties: Record<string, string> = {};
let customPropertiesOrder: string[] = [];
let selectedCustomKey: string | null = null;
let sortColumn: SortColumn = 'name';
let sortDirection: SortDirection = 'asc';
let editingKey: string | null = null;

setupThemeListener();

function populateForm(): void {
  (document.getElementById('table-info-name') as HTMLInputElement).value = info.table_name || '';
  (document.getElementById('table-info-author') as HTMLInputElement).value = info.author_name || '';
  (document.getElementById('table-info-version') as HTMLInputElement).value = info.table_version || '';
  (document.getElementById('table-info-release') as HTMLInputElement).value = info.release_date || '';
  (document.getElementById('table-info-date-saved') as HTMLInputElement).value = info.table_save_date || '';
  (document.getElementById('table-info-email') as HTMLInputElement).value = info.author_email || '';
  (document.getElementById('table-info-website') as HTMLInputElement).value = info.author_website || '';
  (document.getElementById('table-info-blurb') as HTMLTextAreaElement).value = info.table_blurb || '';
  (document.getElementById('table-info-description') as HTMLTextAreaElement).value = info.table_description || '';
  (document.getElementById('table-info-rules') as HTMLTextAreaElement).value = info.table_rules || '';
}

function populateScreenshotDropdown(): void {
  const select = document.getElementById('table-info-screenshot') as HTMLSelectElement;
  select.innerHTML = '<option value="">(none)</option>';

  for (const img of images) {
    const option = document.createElement('option');
    option.value = img.name;
    option.textContent = img.name;
    select.appendChild(option);
  }

  select.value = gamedata.screen_shot || '';
}

function getSortedCustomProperties(): CustomPropertyEntry[] {
  const entries = customPropertiesOrder
    .filter((key: string) => customProperties[key] !== undefined)
    .map((key: string) => ({ name: key, value: customProperties[key] }));

  entries.sort((a: CustomPropertyEntry, b: CustomPropertyEntry) => {
    const aVal = a[sortColumn].toLowerCase();
    const bVal = b[sortColumn].toLowerCase();
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return entries;
}

function renderCustomTable(): void {
  const tbody = document.querySelector('#table-info-custom-table tbody') as HTMLTableSectionElement;
  const entries = getSortedCustomProperties();

  document.querySelectorAll('#table-info-custom-table th').forEach((th: Element) => {
    th.classList.remove('sort-asc', 'sort-desc');
    const thElement = th as HTMLElement;
    if (thElement.dataset.sort === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="table-info-empty-state">No custom properties</td></tr>';
    return;
  }

  tbody.innerHTML = entries
    .map(
      (entry: CustomPropertyEntry) => `
    <tr data-key="${escapeHtml(entry.name)}" class="${entry.name === selectedCustomKey ? 'selected' : ''}">
      <td>${escapeHtml(entry.name)}</td>
      <td>${escapeHtml(entry.value)}</td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('tr[data-key]').forEach((row: Element) => {
    const rowElement = row as HTMLTableRowElement;
    row.addEventListener('click', () => {
      selectedCustomKey = rowElement.dataset.key || null;
      renderCustomTable();
    });
    row.addEventListener('dblclick', () => {
      selectedCustomKey = rowElement.dataset.key || null;
      openEditDialog(rowElement.dataset.key!);
    });
  });
}

function openAddDialog(): void {
  editingKey = null;
  (document.getElementById('table-info-dialog-title') as HTMLElement).textContent = 'Add Custom Property';
  (document.getElementById('table-info-dialog-name') as HTMLInputElement).value = '';
  (document.getElementById('table-info-dialog-value') as HTMLInputElement).value = '';
  (document.getElementById('table-info-dialog-name') as HTMLInputElement).disabled = false;
  (document.getElementById('table-info-custom-dialog') as HTMLElement).classList.remove('hidden');
  (document.getElementById('table-info-dialog-name') as HTMLInputElement).focus();
}

function openEditDialog(key: string): void {
  editingKey = key;
  (document.getElementById('table-info-dialog-title') as HTMLElement).textContent = 'Edit Custom Property';
  (document.getElementById('table-info-dialog-name') as HTMLInputElement).value = key;
  (document.getElementById('table-info-dialog-value') as HTMLInputElement).value = customProperties[key] || '';
  (document.getElementById('table-info-dialog-name') as HTMLInputElement).disabled = true;
  (document.getElementById('table-info-custom-dialog') as HTMLElement).classList.remove('hidden');
  (document.getElementById('table-info-dialog-value') as HTMLInputElement).focus();
}

function closeDialog(): void {
  (document.getElementById('table-info-custom-dialog') as HTMLElement).classList.add('hidden');
  editingKey = null;
}

function saveDialog(): void {
  const name = (document.getElementById('table-info-dialog-name') as HTMLInputElement).value.trim();
  const value = (document.getElementById('table-info-dialog-value') as HTMLInputElement).value;

  if (!name) return;

  if (editingKey) {
    customProperties[editingKey] = value;
  } else {
    if (!(name in customProperties)) {
      customPropertiesOrder.push(name);
    }
    customProperties[name] = value;
    selectedCustomKey = name;
  }

  closeDialog();
  renderCustomTable();
}

function getFormData(): TableInfoFormData {
  return {
    info: {
      table_name: (document.getElementById('table-info-name') as HTMLInputElement).value || null,
      author_name: (document.getElementById('table-info-author') as HTMLInputElement).value || null,
      table_version: (document.getElementById('table-info-version') as HTMLInputElement).value || null,
      release_date: (document.getElementById('table-info-release') as HTMLInputElement).value || null,
      table_save_date: info.table_save_date,
      table_save_rev: info.table_save_rev,
      author_email: (document.getElementById('table-info-email') as HTMLInputElement).value || null,
      author_website: (document.getElementById('table-info-website') as HTMLInputElement).value || null,
      table_blurb: (document.getElementById('table-info-blurb') as HTMLTextAreaElement).value || null,
      table_description: (document.getElementById('table-info-description') as HTMLTextAreaElement).value || null,
      table_rules: (document.getElementById('table-info-rules') as HTMLTextAreaElement).value || null,
      properties: customProperties,
      properties_order: customPropertiesOrder,
    },
    screenshot: (document.getElementById('table-info-screenshot') as HTMLSelectElement).value,
    originalScreenshot: gamedata.screen_shot || '',
  };
}

document.querySelectorAll('#table-info-custom-table th').forEach((th: Element) => {
  th.addEventListener('click', () => {
    const thElement = th as HTMLElement;
    const col = thElement.dataset.sort as SortColumn;
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
    renderCustomTable();
  });
});

(document.getElementById('table-info-add-btn') as HTMLButtonElement).onclick = openAddDialog;

(document.getElementById('table-info-delete-btn') as HTMLButtonElement).onclick = (): void => {
  if (!selectedCustomKey) return;
  delete customProperties[selectedCustomKey];
  customPropertiesOrder = customPropertiesOrder.filter((k: string) => k !== selectedCustomKey);
  selectedCustomKey = null;
  renderCustomTable();
};

(document.getElementById('table-info-dialog-ok') as HTMLButtonElement).onclick = saveDialog;
(document.getElementById('table-info-dialog-cancel') as HTMLButtonElement).onclick = closeDialog;

(document.getElementById('table-info-custom-dialog') as HTMLElement).addEventListener('click', (e: MouseEvent) => {
  if ((e.target as HTMLElement).id === 'table-info-custom-dialog') {
    closeDialog();
  }
});

setupInputKeyboard(document.getElementById('table-info-dialog-name') as HTMLInputElement, {
  onEnter: (): void => {
    (document.getElementById('table-info-dialog-value') as HTMLInputElement).focus();
  },
  onEscape: (): void => closeDialog(),
});

setupInputKeyboard(document.getElementById('table-info-dialog-value') as HTMLInputElement, {
  onEnter: (): void => saveDialog(),
  onEscape: (): void => closeDialog(),
});

(document.getElementById('table-info-ok') as HTMLButtonElement).addEventListener('click', (): void => {
  window.vpxEditor.saveTableInfoWindow(getFormData());
  window.close();
});

(document.getElementById('table-info-cancel') as HTMLButtonElement).addEventListener('click', (): void => {
  window.vpxEditor.cancelTableInfo();
  window.close();
});

setupKeyboardShortcuts({
  onEscape: (): void => {
    if ((document.getElementById('table-info-custom-dialog') as HTMLElement).classList.contains('hidden')) {
      window.vpxEditor.cancelTableInfo();
      window.close();
    }
  },
  onEnter: (): void => {
    if ((document.getElementById('table-info-custom-dialog') as HTMLElement).classList.contains('hidden')) {
      window.vpxEditor.saveTableInfoWindow(getFormData());
      window.close();
    }
  },
  requireMeta: true,
});

window.vpxEditor.onInitTableInfo?.(data => {
  info = data.info || {};
  gamedata = data.gamedata || {};
  images = data.images || [];
  customProperties = info.properties ? { ...info.properties } : {};
  customPropertiesOrder = info.properties_order ? [...info.properties_order] : Object.keys(customProperties);
  selectedCustomKey = null;
  sortColumn = 'name';
  sortDirection = 'asc';

  populateForm();
  populateScreenshotDropdown();
  renderCustomTable();
});
