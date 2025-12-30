import {
  setupThemeListener,
  setupKeyboardShortcuts,
  setupInputKeyboard,
  escapeHtml,
} from '../../shared/window-utils.js';

let info = {};
let gamedata = {};
let images = [];
let customProperties = {};
let customPropertiesOrder = [];
let selectedCustomKey = null;
let sortColumn = 'name';
let sortDirection = 'asc';
let editingKey = null;

setupThemeListener();

function populateForm() {
  document.getElementById('table-info-name').value = info.table_name || '';
  document.getElementById('table-info-author').value = info.author_name || '';
  document.getElementById('table-info-version').value = info.table_version || '';
  document.getElementById('table-info-release').value = info.release_date || '';
  document.getElementById('table-info-date-saved').value = info.table_save_date || '';
  document.getElementById('table-info-email').value = info.author_email || '';
  document.getElementById('table-info-website').value = info.author_website || '';
  document.getElementById('table-info-blurb').value = info.table_blurb || '';
  document.getElementById('table-info-description').value = info.table_description || '';
  document.getElementById('table-info-rules').value = info.table_rules || '';
}

function populateScreenshotDropdown() {
  const select = document.getElementById('table-info-screenshot');
  select.innerHTML = '<option value="">(none)</option>';

  for (const img of images) {
    const option = document.createElement('option');
    option.value = img.name;
    option.textContent = img.name;
    select.appendChild(option);
  }

  select.value = gamedata.screen_shot || '';
}

function getSortedCustomProperties() {
  const entries = customPropertiesOrder
    .filter(key => customProperties[key] !== undefined)
    .map(key => ({ name: key, value: customProperties[key] }));

  entries.sort((a, b) => {
    const aVal = a[sortColumn].toLowerCase();
    const bVal = b[sortColumn].toLowerCase();
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return entries;
}

function renderCustomTable() {
  const tbody = document.querySelector('#table-info-custom-table tbody');
  const entries = getSortedCustomProperties();

  document.querySelectorAll('#table-info-custom-table th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="table-info-empty-state">No custom properties</td></tr>';
    return;
  }

  tbody.innerHTML = entries
    .map(
      entry => `
    <tr data-key="${escapeHtml(entry.name)}" class="${entry.name === selectedCustomKey ? 'selected' : ''}">
      <td>${escapeHtml(entry.name)}</td>
      <td>${escapeHtml(entry.value)}</td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('tr[data-key]').forEach(row => {
    row.addEventListener('click', () => {
      selectedCustomKey = row.dataset.key;
      renderCustomTable();
    });
    row.addEventListener('dblclick', () => {
      selectedCustomKey = row.dataset.key;
      openEditDialog(row.dataset.key);
    });
  });
}

function openAddDialog() {
  editingKey = null;
  document.getElementById('table-info-dialog-title').textContent = 'Add Custom Property';
  document.getElementById('table-info-dialog-name').value = '';
  document.getElementById('table-info-dialog-value').value = '';
  document.getElementById('table-info-dialog-name').disabled = false;
  document.getElementById('table-info-custom-dialog').classList.remove('hidden');
  document.getElementById('table-info-dialog-name').focus();
}

function openEditDialog(key) {
  editingKey = key;
  document.getElementById('table-info-dialog-title').textContent = 'Edit Custom Property';
  document.getElementById('table-info-dialog-name').value = key;
  document.getElementById('table-info-dialog-value').value = customProperties[key] || '';
  document.getElementById('table-info-dialog-name').disabled = true;
  document.getElementById('table-info-custom-dialog').classList.remove('hidden');
  document.getElementById('table-info-dialog-value').focus();
}

function closeDialog() {
  document.getElementById('table-info-custom-dialog').classList.add('hidden');
  editingKey = null;
}

function saveDialog() {
  const name = document.getElementById('table-info-dialog-name').value.trim();
  const value = document.getElementById('table-info-dialog-value').value;

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

function getFormData() {
  return {
    info: {
      table_name: document.getElementById('table-info-name').value || null,
      author_name: document.getElementById('table-info-author').value || null,
      table_version: document.getElementById('table-info-version').value || null,
      release_date: document.getElementById('table-info-release').value || null,
      table_save_date: info.table_save_date,
      table_save_rev: info.table_save_rev,
      author_email: document.getElementById('table-info-email').value || null,
      author_website: document.getElementById('table-info-website').value || null,
      table_blurb: document.getElementById('table-info-blurb').value || null,
      table_description: document.getElementById('table-info-description').value || null,
      table_rules: document.getElementById('table-info-rules').value || null,
      properties: customProperties,
      properties_order: customPropertiesOrder,
    },
    screenshot: document.getElementById('table-info-screenshot').value,
    originalScreenshot: gamedata.screen_shot || '',
  };
}

document.querySelectorAll('#table-info-custom-table th').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
    renderCustomTable();
  });
});

document.getElementById('table-info-add-btn').onclick = openAddDialog;

document.getElementById('table-info-delete-btn').onclick = () => {
  if (!selectedCustomKey) return;
  delete customProperties[selectedCustomKey];
  customPropertiesOrder = customPropertiesOrder.filter(k => k !== selectedCustomKey);
  selectedCustomKey = null;
  renderCustomTable();
};

document.getElementById('table-info-dialog-ok').onclick = saveDialog;
document.getElementById('table-info-dialog-cancel').onclick = closeDialog;

document.getElementById('table-info-custom-dialog').addEventListener('click', e => {
  if (e.target.id === 'table-info-custom-dialog') {
    closeDialog();
  }
});

setupInputKeyboard(document.getElementById('table-info-dialog-name'), {
  onEnter: () => document.getElementById('table-info-dialog-value').focus(),
  onEscape: () => closeDialog(),
});

setupInputKeyboard(document.getElementById('table-info-dialog-value'), {
  onEnter: () => saveDialog(),
  onEscape: () => closeDialog(),
});

document.getElementById('table-info-ok').addEventListener('click', () => {
  window.vpxEditor.saveTableInfoWindow(getFormData());
  window.close();
});

document.getElementById('table-info-cancel').addEventListener('click', () => {
  window.vpxEditor.cancelTableInfo();
  window.close();
});

setupKeyboardShortcuts({
  onEscape: e => {
    if (document.getElementById('table-info-custom-dialog').classList.contains('hidden')) {
      window.vpxEditor.cancelTableInfo();
      window.close();
    }
  },
  onEnter: e => {
    if (document.getElementById('table-info-custom-dialog').classList.contains('hidden')) {
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
