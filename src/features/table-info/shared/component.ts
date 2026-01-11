import { escapeHtml } from '../../../shared/window-utils';
import type { TableInfo } from '../../../types/data';
import type { TableInfoFormData, TableInfoInitData } from '../../../types/ipc';

export type { TableInfoFormData, TableInfoInitData };

interface CustomPropertyEntry {
  name: string;
  value: string;
}

type SortColumn = 'name' | 'value';
type SortDirection = 'asc' | 'desc';

export interface TableInfoCallbacks {
  onSave: (data: TableInfoFormData) => void;
  onCancel: () => void;
}

export interface TableInfoElements {
  nameInput: HTMLInputElement;
  authorInput: HTMLInputElement;
  versionInput: HTMLInputElement;
  releaseInput: HTMLInputElement;
  dateSavedInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  websiteInput: HTMLInputElement;
  blurbInput: HTMLTextAreaElement;
  descriptionInput: HTMLTextAreaElement;
  rulesInput: HTMLTextAreaElement;
  screenshotSelect: HTMLSelectElement;
  customTableBody: HTMLTableSectionElement;
  customTableHeaders: NodeListOf<Element>;
  addBtn: HTMLButtonElement;
  deleteBtn: HTMLButtonElement;
  okBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  dialogOverlay: HTMLElement;
  dialogTitle: HTMLElement;
  dialogNameInput: HTMLInputElement;
  dialogValueInput: HTMLInputElement;
  dialogOkBtn: HTMLButtonElement;
  dialogCancelBtn: HTMLButtonElement;
}

export interface TableInfoInstance {
  setData: (data: TableInfoInitData) => void;
  getFormData: () => TableInfoFormData;
  destroy: () => void;
}

export function initTableInfoComponent(elements: TableInfoElements, callbacks: TableInfoCallbacks): TableInfoInstance {
  let info: TableInfo = {};
  let gamedata: { screen_shot?: string } = {};
  let images: { name: string }[] = [];
  let customProperties: Record<string, string> = {};
  let customPropertiesOrder: string[] = [];
  let selectedCustomKey: string | null = null;
  let sortColumn: SortColumn = 'name';
  let sortDirection: SortDirection = 'asc';
  let editingKey: string | null = null;

  function populateForm(): void {
    elements.nameInput.value = info.table_name || '';
    elements.authorInput.value = info.author_name || '';
    elements.versionInput.value = info.table_version || '';
    elements.releaseInput.value = info.release_date || '';
    elements.dateSavedInput.value = info.table_save_date || '';
    elements.emailInput.value = info.author_email || '';
    elements.websiteInput.value = info.author_website || '';
    elements.blurbInput.value = info.table_blurb || '';
    elements.descriptionInput.value = info.table_description || '';
    elements.rulesInput.value = info.table_rules || '';
  }

  function populateScreenshotDropdown(): void {
    elements.screenshotSelect.innerHTML = '<option value="">(none)</option>';
    for (const img of images) {
      const option = document.createElement('option');
      option.value = img.name;
      option.textContent = img.name;
      elements.screenshotSelect.appendChild(option);
    }
    elements.screenshotSelect.value = gamedata.screen_shot || '';
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
    const entries = getSortedCustomProperties();

    elements.customTableHeaders.forEach((th: Element) => {
      th.classList.remove('sort-asc', 'sort-desc');
      const thElement = th as HTMLElement;
      if (thElement.dataset.sort === sortColumn) {
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });

    if (entries.length === 0) {
      elements.customTableBody.innerHTML =
        '<tr><td colspan="2" class="table-info-empty-state">No custom properties</td></tr>';
      return;
    }

    elements.customTableBody.innerHTML = entries
      .map(
        (entry: CustomPropertyEntry) => `
      <tr data-key="${escapeHtml(entry.name)}" class="${entry.name === selectedCustomKey ? 'selected' : ''}">
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.value)}</td>
      </tr>
    `
      )
      .join('');

    elements.customTableBody.querySelectorAll('tr[data-key]').forEach((row: Element) => {
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
    elements.dialogTitle.textContent = 'Add Custom Property';
    elements.dialogNameInput.value = '';
    elements.dialogValueInput.value = '';
    elements.dialogNameInput.disabled = false;
    elements.dialogOverlay.classList.remove('hidden');
    elements.dialogNameInput.focus();
  }

  function openEditDialog(key: string): void {
    editingKey = key;
    elements.dialogTitle.textContent = 'Edit Custom Property';
    elements.dialogNameInput.value = key;
    elements.dialogValueInput.value = customProperties[key] || '';
    elements.dialogNameInput.disabled = true;
    elements.dialogOverlay.classList.remove('hidden');
    elements.dialogValueInput.focus();
  }

  function closeDialog(): void {
    elements.dialogOverlay.classList.add('hidden');
    editingKey = null;
  }

  function saveDialog(): void {
    const name = elements.dialogNameInput.value.trim();
    const value = elements.dialogValueInput.value;

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
        table_name: elements.nameInput.value || null,
        author_name: elements.authorInput.value || null,
        table_version: elements.versionInput.value || null,
        release_date: elements.releaseInput.value || null,
        table_save_date: info.table_save_date,
        table_save_rev: info.table_save_rev,
        author_email: elements.emailInput.value || null,
        author_website: elements.websiteInput.value || null,
        table_blurb: elements.blurbInput.value || null,
        table_description: elements.descriptionInput.value || null,
        table_rules: elements.rulesInput.value || null,
        properties: customProperties,
        properties_order: customPropertiesOrder,
      },
      screenshot: elements.screenshotSelect.value,
      originalScreenshot: gamedata.screen_shot || '',
    };
  }

  function handleColumnSort(th: Element): void {
    const thElement = th as HTMLElement;
    const col = thElement.dataset.sort as SortColumn;
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
    renderCustomTable();
  }

  function deleteSelectedProperty(): void {
    if (!selectedCustomKey) return;
    delete customProperties[selectedCustomKey];
    customPropertiesOrder = customPropertiesOrder.filter((k: string) => k !== selectedCustomKey);
    selectedCustomKey = null;
    renderCustomTable();
  }

  elements.customTableHeaders.forEach((th: Element) => {
    th.addEventListener('click', () => handleColumnSort(th));
  });

  elements.addBtn.onclick = openAddDialog;
  elements.deleteBtn.onclick = deleteSelectedProperty;
  elements.dialogOkBtn.onclick = saveDialog;
  elements.dialogCancelBtn.onclick = closeDialog;

  elements.dialogOverlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === elements.dialogOverlay) {
      closeDialog();
    }
  });

  elements.dialogNameInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      elements.dialogValueInput.focus();
    } else if (e.key === 'Escape') {
      closeDialog();
    }
  });

  elements.dialogValueInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') saveDialog();
    else if (e.key === 'Escape') closeDialog();
  });

  elements.okBtn.addEventListener('click', () => {
    callbacks.onSave(getFormData());
  });

  elements.cancelBtn.addEventListener('click', () => {
    callbacks.onCancel();
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (elements.dialogOverlay.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        callbacks.onCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        callbacks.onSave(getFormData());
      }
    }
  }

  document.addEventListener('keydown', handleKeydown);

  function setData(data: TableInfoInitData): void {
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
  }

  function destroy(): void {
    document.removeEventListener('keydown', handleKeydown);
  }

  return {
    setData,
    getFormData,
    destroy,
  };
}
