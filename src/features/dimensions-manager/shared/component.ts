import { escapeHtml } from '../../../shared/window-utils';
import type { GameData } from '../../../types/data.js';
import type { PredefinedTable } from './table-sizes';

export type { PredefinedTable };

const DEFAULT_GLASS_BOTTOM = 3.0;
const DEFAULT_GLASS_TOP = 8.5;

interface SortedTable extends PredefinedTable {
  originalIndex: number;
}

export interface DimensionsApplyData {
  width: number;
  height: number;
  glassTop: number;
  glassBottom: number;
}

interface OriginalDimensions {
  width: number;
  height: number;
  glassTop: number;
  glassBottom: number;
}

type SortColumn = 'name' | 'width' | 'height' | 'glassBottom' | 'glassTop' | 'comment';
type SortDirection = 'asc' | 'desc';

function getGlassBottom(t: PredefinedTable): number {
  return t.glassBottom ?? DEFAULT_GLASS_BOTTOM;
}

function getGlassTop(t: PredefinedTable): number {
  return t.glassTop ?? DEFAULT_GLASS_TOP;
}

function getComment(t: PredefinedTable): string {
  return t.comment ?? '';
}

const VP_TO_INCHES = 1.0625 / 50;
const INCHES_TO_VP = 50 / 1.0625;

export function vpToInches(vp: number): number {
  return vp * VP_TO_INCHES;
}

export function inchesToVp(inches: number): number {
  return inches * INCHES_TO_VP;
}

function formatNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n.toFixed(decimals);
}

export interface DimensionsManagerCallbacks {
  onApply: (data: DimensionsApplyData) => Promise<void>;
  onClose: () => void;
}

export interface DimensionsManagerElements {
  tableBody: HTMLTableSectionElement;
  tableHeaders: NodeListOf<Element>;
  refWidthIn: HTMLInputElement;
  refHeightIn: HTMLInputElement;
  refWidthVp: HTMLInputElement;
  refHeightVp: HTMLInputElement;
  refGlassTop: HTMLInputElement;
  refGlassBottom: HTMLInputElement;
  refAspectRatio: HTMLElement;
  curWidthIn: HTMLInputElement;
  curHeightIn: HTMLInputElement;
  curWidthVp: HTMLInputElement;
  curHeightVp: HTMLInputElement;
  curGlassTop: HTMLInputElement;
  curGlassBottom: HTMLInputElement;
  curAspectRatio: HTMLElement;
  copyBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  applyBtn: HTMLButtonElement;
}

export interface DimensionsManagerInstance {
  setData: (gamedata: GameData) => void;
  setUIDisabled: (disabled: boolean) => void;
  destroy: () => void;
}

export function initDimensionsManagerComponent(
  elements: DimensionsManagerElements,
  callbacks: DimensionsManagerCallbacks,
  tables: PredefinedTable[]
): DimensionsManagerInstance {
  let gamedata: GameData = {};
  let sortColumn: SortColumn = 'name';
  let sortDirection: SortDirection = 'asc';
  let selectedIndex = -1;
  let originalDimensions: OriginalDimensions = { width: 0, height: 0, glassTop: 0, glassBottom: 0 };
  let uiDisabled = true;

  function setUIDisabled(disabled: boolean): void {
    uiDisabled = disabled;
    elements.copyBtn.disabled = disabled;
    elements.applyBtn.disabled = disabled;
    elements.curWidthIn.disabled = disabled;
    elements.curHeightIn.disabled = disabled;
    elements.curWidthVp.disabled = disabled;
    elements.curHeightVp.disabled = disabled;
    elements.curGlassTop.disabled = disabled;
    elements.curGlassBottom.disabled = disabled;
  }

  function populateCurrentTable(): void {
    const widthVp = gamedata.right || 0;
    const heightVp = gamedata.bottom || 0;
    const glassTopVp = gamedata.glass_top_height || 0;
    const glassBottomVp = gamedata.glass_bottom_height || 0;

    elements.curWidthVp.value = formatNum(widthVp, 2);
    elements.curHeightVp.value = formatNum(heightVp, 2);
    elements.curWidthIn.value = formatNum(vpToInches(widthVp), 2);
    elements.curHeightIn.value = formatNum(vpToInches(heightVp), 2);
    elements.curGlassTop.value = formatNum(vpToInches(glassTopVp), 2);
    elements.curGlassBottom.value = formatNum(vpToInches(glassBottomVp), 2);

    updateCurrentAspectRatio();
  }

  function updateCurrentAspectRatio(): void {
    const width = parseFloat(elements.curWidthVp.value) || 0;
    const height = parseFloat(elements.curHeightVp.value) || 0;
    const ratio = width > 0 ? (height / width).toFixed(3) : '-';
    elements.curAspectRatio.textContent = ratio;
  }

  function findBestMatch(): number {
    const widthIn = vpToInches(gamedata.right || 0);
    const heightIn = vpToInches(gamedata.bottom || 0);
    const glassTopIn = vpToInches(gamedata.glass_top_height || 0);
    const glassBottomIn = vpToInches(gamedata.glass_bottom_height || 0);

    let bestIdx = -1;
    let bestErr = Infinity;

    tables.forEach((t, idx) => {
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

  function getSortedTables(): SortedTable[] {
    const sortedTables: SortedTable[] = tables.map((t, idx) => ({
      ...t,
      originalIndex: idx,
    }));
    sortedTables.sort((a, b) => {
      let aVal: string | number | null = a[sortColumn as keyof PredefinedTable] as string | number | null;
      let bVal: string | number | null = b[sortColumn as keyof PredefinedTable] as string | number | null;
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
    return sortedTables;
  }

  function renderTableList(): void {
    const sorted = getSortedTables();

    elements.tableHeaders.forEach((th: Element) => {
      th.classList.remove('sort-asc', 'sort-desc');
      const thElement = th as HTMLElement;
      if (thElement.dataset.sort === sortColumn) {
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });

    elements.tableBody.innerHTML = sorted
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

    elements.tableBody.querySelectorAll('tr').forEach(row => {
      const rowElement = row as HTMLTableRowElement;
      row.addEventListener('click', () => {
        selectRow(parseInt(rowElement.dataset.index!, 10));
      });
    });
  }

  function scrollToSelected(): void {
    const selected = elements.tableBody.querySelector('tr.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }

  function selectRow(index: number): void {
    selectedIndex = index;
    renderTableList();
    updateReferencePanel();
  }

  function updateReferencePanel(): void {
    if (selectedIndex < 0 || selectedIndex >= tables.length) {
      elements.refWidthIn.value = '';
      elements.refHeightIn.value = '';
      elements.refWidthVp.value = '';
      elements.refHeightVp.value = '';
      elements.refGlassTop.value = '';
      elements.refGlassBottom.value = '';
      elements.refAspectRatio.textContent = '-';
      return;
    }

    const t = tables[selectedIndex];
    elements.refWidthIn.value = formatNum(t.width);
    elements.refHeightIn.value = formatNum(t.height);
    elements.refWidthVp.value = formatNum(inchesToVp(t.width), 2);
    elements.refHeightVp.value = formatNum(inchesToVp(t.height), 2);
    elements.refGlassTop.value = formatNum(getGlassTop(t));
    elements.refGlassBottom.value = formatNum(getGlassBottom(t));

    const ratio = (t.height / t.width).toFixed(3);
    elements.refAspectRatio.textContent = ratio;
  }

  function updateApplyButton(): void {
    if (uiDisabled) return;
    const widthVp = parseFloat(elements.curWidthVp.value) || 0;
    const heightVp = parseFloat(elements.curHeightVp.value) || 0;
    const glassTopIn = parseFloat(elements.curGlassTop.value) || 0;
    const glassBottomIn = parseFloat(elements.curGlassBottom.value) || 0;

    const changed =
      Math.abs(widthVp - originalDimensions.width) > 0.01 ||
      Math.abs(heightVp - originalDimensions.height) > 0.01 ||
      Math.abs(inchesToVp(glassTopIn) - originalDimensions.glassTop) > 0.01 ||
      Math.abs(inchesToVp(glassBottomIn) - originalDimensions.glassBottom) > 0.01;

    elements.applyBtn.disabled = !changed;
  }

  elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const thElement = th as HTMLElement;
      const col = thElement.dataset.sort as SortColumn;
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'asc';
      }
      renderTableList();
    });
  });

  elements.curWidthIn.addEventListener('input', () => {
    const inches = parseFloat(elements.curWidthIn.value) || 0;
    elements.curWidthVp.value = formatNum(inchesToVp(inches), 2);
    updateCurrentAspectRatio();
    updateApplyButton();
  });

  elements.curHeightIn.addEventListener('input', () => {
    const inches = parseFloat(elements.curHeightIn.value) || 0;
    elements.curHeightVp.value = formatNum(inchesToVp(inches), 2);
    updateCurrentAspectRatio();
    updateApplyButton();
  });

  elements.curWidthVp.addEventListener('input', () => {
    const vp = parseFloat(elements.curWidthVp.value) || 0;
    elements.curWidthIn.value = formatNum(vpToInches(vp), 2);
    updateCurrentAspectRatio();
    updateApplyButton();
  });

  elements.curHeightVp.addEventListener('input', () => {
    const vp = parseFloat(elements.curHeightVp.value) || 0;
    elements.curHeightIn.value = formatNum(vpToInches(vp), 2);
    updateCurrentAspectRatio();
    updateApplyButton();
  });

  elements.curGlassTop.addEventListener('input', updateApplyButton);
  elements.curGlassBottom.addEventListener('input', updateApplyButton);

  elements.copyBtn.addEventListener('click', () => {
    if (selectedIndex < 0) return;

    const t = tables[selectedIndex];
    elements.curWidthIn.value = formatNum(t.width);
    elements.curHeightIn.value = formatNum(t.height);
    elements.curWidthVp.value = formatNum(inchesToVp(t.width), 2);
    elements.curHeightVp.value = formatNum(inchesToVp(t.height), 2);
    elements.curGlassTop.value = formatNum(getGlassTop(t));
    elements.curGlassBottom.value = formatNum(getGlassBottom(t));
    updateCurrentAspectRatio();
    updateApplyButton();
  });

  elements.applyBtn.addEventListener('click', async () => {
    const widthVp = parseFloat(elements.curWidthVp.value) || 0;
    const heightVp = parseFloat(elements.curHeightVp.value) || 0;
    const glassTopIn = parseFloat(elements.curGlassTop.value) || 0;
    const glassBottomIn = parseFloat(elements.curGlassBottom.value) || 0;

    await callbacks.onApply({
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

  elements.closeBtn.addEventListener('click', () => {
    callbacks.onClose();
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      callbacks.onClose();
    }
  }

  document.addEventListener('keydown', handleKeydown);

  function setData(data: GameData): void {
    gamedata = data;

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
  }

  function destroy(): void {
    document.removeEventListener('keydown', handleKeydown);
  }

  return {
    setData,
    setUIDisabled,
    destroy,
  };
}
