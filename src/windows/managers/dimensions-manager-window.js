import { setupKeyboardShortcuts, escapeHtml } from '../../shared/window-utils.js';

const DEFAULT_GLASS_BOTTOM = 3.0;
const DEFAULT_GLASS_TOP = 8.5;

const PREDEFINED_TABLES = [
  {
    name: 'Alvin G.',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Atari (widebody)',
    width: 27.0,
    height: 45.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Bally EM (standard)',
    width: 20.25,
    height: 41.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Bally (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: 2.375,
    glassTop: 2.375,
    comment: 'Glasses measured by Wylte.',
  },
  {
    name: 'Bally (widebody)',
    width: 26.75,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  { name: 'Capcom', width: 20.25, height: 46.0, glassBottom: null, glassTop: null, comment: 'Missing glass measures.' },
  {
    name: 'Data East (up to Hook)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Data East/Sega (standard)',
    width: 20.25,
    height: 46.0,
    glassBottom: 2.375,
    glassTop: 8.0,
    comment: 'Glass measured by Wylte on Tommy.',
  },
  {
    name: 'Data East/Sega (widebody)',
    width: 23.25,
    height: 46.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Game Plan',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Gottlieb EM (through 76)',
    width: 20.25,
    height: 41.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Gottlieb EM (76-79)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Gottlieb System 1 (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Gottlieb System 1 (widebody)',
    width: 26.75,
    height: 47.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Gottlieb System 80 (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Gottlieb System 80 (widebody)',
    width: 23.875,
    height: 47.875,
    glassBottom: null,
    glassTop: null,
    comment: 'Verified on actual machines.',
  },
  {
    name: 'Gottlieb System 80 (extrawide)',
    width: 26.75,
    height: 46.5,
    glassBottom: null,
    glassTop: null,
    comment: 'Circus & Star Race.',
  },
  {
    name: 'Gottlieb System 3',
    width: 20.25,
    height: 46.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Stern (widebody)',
    width: 23.875,
    height: 45.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Stern (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Stern Modern (standard)',
    width: 20.25,
    height: 45.0,
    glassBottom: 2.25,
    glassTop: 8.5,
    comment: 'Glass measured by Wylte on Ghostbusters.',
  },
  {
    name: 'Williams EM (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Measured by Bord.',
  },
  {
    name: 'Williams System 1-11 (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: null,
    glassTop: 5.5,
    comment: 'Top glass measured on Bad Cats.',
  },
  {
    name: 'Williams System 1-11 (widebody)',
    width: 27.0,
    height: 42.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Williams WPC (standard)',
    width: 20.25,
    height: 46.0,
    glassBottom: 3.15,
    glassTop: 7.15,
    comment: 'Glass measured from pics.',
  },
  {
    name: 'Williams WPC (superpin)',
    width: 23.25,
    height: 46.0,
    glassBottom: 2.5,
    glassTop: 7.5,
    comment: 'Glass measured by Wylte on Judge Dredd.',
  },
  {
    name: 'Williams Pinball 2000',
    width: 20.5,
    height: 43.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Missing glass measures.',
  },
  {
    name: 'Zaccaria (standard)',
    width: 20.25,
    height: 42.0,
    glassBottom: 3.15,
    glassTop: 4.0,
    comment: 'Glass measured on Robot.',
  },
  { name: 'Black Knight 2000 (1991)', width: 20.25, height: 46.0, glassBottom: null, glassTop: null, comment: null },
  { name: 'Bride Of Pinbot (1991)', width: 20.25, height: 45.25, glassBottom: null, glassTop: null, comment: null },
  {
    name: "Bram Stoker's Dracula (1993)",
    width: 20.25,
    height: 45.0,
    glassBottom: null,
    glassTop: null,
    comment: 'Verified to be 20.25.',
  },
  { name: 'Doctor Who (1992)', width: 20.25, height: 45.0625, glassBottom: null, glassTop: null, comment: null },
  { name: 'Future Spa (1979)', width: 26.7717, height: 40.55118, glassBottom: null, glassTop: null, comment: null },
  { name: "Guns N' Roses (1994)", width: 23.0, height: 46.0, glassBottom: null, glassTop: null, comment: null },
  { name: 'Hercules (1979 Atari)', width: 36.0, height: 72.0, glassBottom: null, glassTop: null, comment: null },
  { name: 'Mystery Castle (1993)', width: 20.25, height: 46.0, glassBottom: null, glassTop: null, comment: null },
  { name: 'Safe Cracker (1996)', width: 16.5, height: 41.5, glassBottom: null, glassTop: null, comment: null },
  {
    name: 'Secret Service (1988)',
    width: 20.275,
    height: 42.126,
    glassBottom: null,
    glassTop: null,
    comment: 'Measured by Baron Shadow.',
  },
  { name: 'Star Trek 25th (1991)', width: 20.25, height: 42.625, glassBottom: null, glassTop: null, comment: null },
  { name: 'Varkon (1982)', width: 24.0, height: 21.0, glassBottom: null, glassTop: null, comment: null },
  { name: 'World Cup Soccer (1994)', width: 20.25, height: 45.75, glassBottom: null, glassTop: null, comment: null },
];

function getGlassBottom(t) {
  return t.glassBottom ?? DEFAULT_GLASS_BOTTOM;
}
function getGlassTop(t) {
  return t.glassTop ?? DEFAULT_GLASS_TOP;
}
function getComment(t) {
  return t.comment ?? '';
}

const VP_TO_INCHES = 1.0625 / 50;
const INCHES_TO_VP = 50 / 1.0625;

function vpToInches(vp) {
  return vp * VP_TO_INCHES;
}
function inchesToVp(inches) {
  return inches * INCHES_TO_VP;
}
function formatNum(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n.toFixed(decimals);
}

let gamedata = {};
let sortColumn = 'name';
let sortDirection = 'asc';
let selectedIndex = -1;
let originalDimensions = {};
let uiDisabled = true;

function setUIDisabled(disabled) {
  uiDisabled = disabled;
  document.getElementById('dim-copy-btn').disabled = disabled;
  document.getElementById('dim-apply-btn').disabled = disabled;
  document.querySelectorAll('.dimensions-prop-input.editable').forEach(input => {
    input.disabled = disabled;
  });
}

function populateCurrentTable() {
  const widthVp = gamedata.right || 0;
  const heightVp = gamedata.bottom || 0;
  const glassTopVp = gamedata.glass_top_height || 0;
  const glassBottomVp = gamedata.glass_bottom_height || 0;

  document.getElementById('dim-cur-width-vp').value = formatNum(widthVp, 2);
  document.getElementById('dim-cur-height-vp').value = formatNum(heightVp, 2);
  document.getElementById('dim-cur-width-in').value = formatNum(vpToInches(widthVp), 2);
  document.getElementById('dim-cur-height-in').value = formatNum(vpToInches(heightVp), 2);
  document.getElementById('dim-cur-glass-top').value = formatNum(vpToInches(glassTopVp), 2);
  document.getElementById('dim-cur-glass-bottom').value = formatNum(vpToInches(glassBottomVp), 2);

  updateCurrentAspectRatio();
}

function updateCurrentAspectRatio() {
  const width = parseFloat(document.getElementById('dim-cur-width-vp').value) || 0;
  const height = parseFloat(document.getElementById('dim-cur-height-vp').value) || 0;
  const ratio = width > 0 ? (height / width).toFixed(3) : '-';
  document.getElementById('dim-cur-aspect-ratio').textContent = ratio;
}

function findBestMatch() {
  const widthIn = vpToInches(gamedata.right || 0);
  const heightIn = vpToInches(gamedata.bottom || 0);
  const glassTopIn = vpToInches(gamedata.glass_top_height || 0);
  const glassBottomIn = vpToInches(gamedata.glass_bottom_height || 0);

  let bestIdx = -1;
  let bestErr = Infinity;

  PREDEFINED_TABLES.forEach((t, idx) => {
    const wErr = widthIn - t.width;
    const hErr = heightIn - t.height;
    const gtErr = glassTopIn - getGlassTop(t);
    const gbErr = glassBottomIn - getGlassBottom(t);
    const err = wErr * wErr + hErr * hErr + 0.01 * gtErr * gtErr + 0.00001 * gbErr * gbErr;
    if (err < bestErr) {
      bestErr = err;
      bestIdx = idx;
    }
  });

  return bestIdx;
}

function getSortedTables() {
  const tables = PREDEFINED_TABLES.map((t, idx) => ({ ...t, originalIndex: idx }));
  tables.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
    if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  return tables;
}

function renderTableList() {
  const tbody = document.querySelector('#dimensions-table tbody');
  const tables = getSortedTables();

  document.querySelectorAll('#dimensions-table th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  tbody.innerHTML = tables
    .map(
      t => `
    <tr data-index="${t.originalIndex}" class="${t.originalIndex === selectedIndex ? 'selected' : ''}">
      <td>${escapeHtml(t.name)}</td>
      <td>${formatNum(t.width)}</td>
      <td>${formatNum(t.height)}</td>
      <td>${formatNum(getGlassBottom(t))}</td>
      <td>${formatNum(getGlassTop(t))}</td>
      <td class="comment-cell" title="${escapeHtml(getComment(t))}">${escapeHtml(getComment(t))}</td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      selectRow(parseInt(row.dataset.index));
    });
  });
}

function scrollToSelected() {
  const selected = document.querySelector('#dimensions-table tbody tr.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
}

function selectRow(index) {
  selectedIndex = index;
  renderTableList();
  updateReferencePanel();
}

function updateReferencePanel() {
  if (selectedIndex < 0 || selectedIndex >= PREDEFINED_TABLES.length) {
    document.getElementById('dim-ref-width-in').value = '';
    document.getElementById('dim-ref-height-in').value = '';
    document.getElementById('dim-ref-width-vp').value = '';
    document.getElementById('dim-ref-height-vp').value = '';
    document.getElementById('dim-ref-glass-top').value = '';
    document.getElementById('dim-ref-glass-bottom').value = '';
    document.getElementById('dim-ref-aspect-ratio').textContent = '-';
    return;
  }

  const t = PREDEFINED_TABLES[selectedIndex];
  document.getElementById('dim-ref-width-in').value = formatNum(t.width);
  document.getElementById('dim-ref-height-in').value = formatNum(t.height);
  document.getElementById('dim-ref-width-vp').value = formatNum(inchesToVp(t.width), 2);
  document.getElementById('dim-ref-height-vp').value = formatNum(inchesToVp(t.height), 2);
  document.getElementById('dim-ref-glass-top').value = formatNum(getGlassTop(t));
  document.getElementById('dim-ref-glass-bottom').value = formatNum(getGlassBottom(t));

  const ratio = (t.height / t.width).toFixed(3);
  document.getElementById('dim-ref-aspect-ratio').textContent = ratio;
}

function updateApplyButton() {
  if (uiDisabled) return;
  const widthVp = parseFloat(document.getElementById('dim-cur-width-vp').value) || 0;
  const heightVp = parseFloat(document.getElementById('dim-cur-height-vp').value) || 0;
  const glassTopIn = parseFloat(document.getElementById('dim-cur-glass-top').value) || 0;
  const glassBottomIn = parseFloat(document.getElementById('dim-cur-glass-bottom').value) || 0;

  const changed =
    Math.abs(widthVp - originalDimensions.width) > 0.01 ||
    Math.abs(heightVp - originalDimensions.height) > 0.01 ||
    Math.abs(inchesToVp(glassTopIn) - originalDimensions.glassTop) > 0.01 ||
    Math.abs(inchesToVp(glassBottomIn) - originalDimensions.glassBottom) > 0.01;

  document.getElementById('dim-apply-btn').disabled = !changed;
}

if (window.dimensionsManager) {
  window.dimensionsManager.onInit(data => {
    gamedata = data.gamedata || {};
    if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);

    originalDimensions = {
      width: gamedata.right || 0,
      height: gamedata.bottom || 0,
      glassTop: gamedata.glass_top_height || 0,
      glassBottom: gamedata.glass_bottom_height || 0,
    };

    setUIDisabled(false);
    populateCurrentTable();
    renderTableList();

    const bestMatch = findBestMatch();
    if (bestMatch >= 0) {
      selectRow(bestMatch);
    }

    setTimeout(() => scrollToSelected(), 50);
  });

  window.dimensionsManager.onThemeChanged(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.dimensionsManager.onSetDisabled(disabled => {
    setUIDisabled(disabled);
    if (disabled) {
      gamedata = {};
      selectedIndex = -1;
      originalDimensions = {};
      populateCurrentTable();
      renderTableList();
      updateReferencePanel();
    }
  });
}

document.querySelectorAll('#dimensions-table th').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
    renderTableList();
  });
});

document.getElementById('dim-cur-width-in').addEventListener('input', e => {
  const inches = parseFloat(e.target.value) || 0;
  document.getElementById('dim-cur-width-vp').value = formatNum(inchesToVp(inches), 2);
  updateCurrentAspectRatio();
  updateApplyButton();
});

document.getElementById('dim-cur-height-in').addEventListener('input', e => {
  const inches = parseFloat(e.target.value) || 0;
  document.getElementById('dim-cur-height-vp').value = formatNum(inchesToVp(inches), 2);
  updateCurrentAspectRatio();
  updateApplyButton();
});

document.getElementById('dim-cur-width-vp').addEventListener('input', e => {
  const vp = parseFloat(e.target.value) || 0;
  document.getElementById('dim-cur-width-in').value = formatNum(vpToInches(vp), 2);
  updateCurrentAspectRatio();
  updateApplyButton();
});

document.getElementById('dim-cur-height-vp').addEventListener('input', e => {
  const vp = parseFloat(e.target.value) || 0;
  document.getElementById('dim-cur-height-in').value = formatNum(vpToInches(vp), 2);
  updateCurrentAspectRatio();
  updateApplyButton();
});

document.getElementById('dim-cur-glass-top').addEventListener('input', updateApplyButton);
document.getElementById('dim-cur-glass-bottom').addEventListener('input', updateApplyButton);

document.getElementById('dim-copy-btn').addEventListener('click', () => {
  if (selectedIndex < 0) return;

  const t = PREDEFINED_TABLES[selectedIndex];
  document.getElementById('dim-cur-width-in').value = formatNum(t.width);
  document.getElementById('dim-cur-height-in').value = formatNum(t.height);
  document.getElementById('dim-cur-width-vp').value = formatNum(inchesToVp(t.width), 2);
  document.getElementById('dim-cur-height-vp').value = formatNum(inchesToVp(t.height), 2);
  document.getElementById('dim-cur-glass-top').value = formatNum(getGlassTop(t));
  document.getElementById('dim-cur-glass-bottom').value = formatNum(getGlassBottom(t));
  updateCurrentAspectRatio();
  updateApplyButton();
});

document.getElementById('dim-apply-btn').addEventListener('click', async () => {
  const widthVp = parseFloat(document.getElementById('dim-cur-width-vp').value) || 0;
  const heightVp = parseFloat(document.getElementById('dim-cur-height-vp').value) || 0;
  const glassTopIn = parseFloat(document.getElementById('dim-cur-glass-top').value) || 0;
  const glassBottomIn = parseFloat(document.getElementById('dim-cur-glass-bottom').value) || 0;

  await window.dimensionsManager.applyDimensions({
    width: widthVp,
    height: heightVp,
    glassTop: inchesToVp(glassTopIn),
    glassBottom: inchesToVp(glassBottomIn),
  });

  originalDimensions = {
    width: widthVp,
    height: heightVp,
    glassTop: inchesToVp(glassTopIn),
    glassBottom: inchesToVp(glassBottomIn),
  };

  updateApplyButton();
});

document.getElementById('dim-close-btn').addEventListener('click', () => {
  window.dimensionsManager.close();
});

setupKeyboardShortcuts({
  onEscape: () => window.dimensionsManager.close(),
});
