import type { AuditFinding } from '@francisdb/vpin-wasm';
import { state, getItem } from './state.js';
import { selectItem } from './items-panel.js';
import { appendConsoleLine } from './console-panel.js';

export type AuditSeverity = AuditFinding['severity'];

export interface AuditRow extends AuditFinding {
  itemName?: string;
}

const SEVERITIES: AuditSeverity[] = ['error', 'warning', 'suggestion', 'info'];
const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  suggestion: 'Suggestions',
  info: 'Notes',
};

let findings: AuditRow[] = [];
let hiddenSeverities = new Set<AuditSeverity>();
let running = false;
let initialized = false;

function panel(): HTMLElement | null {
  return document.getElementById('audit-panel');
}

function sortRows(rows: AuditRow[]): AuditRow[] {
  return rows.sort((a, b) => {
    const s = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
    if (s !== 0) return s;
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return a.message.localeCompare(b.message);
  });
}

export async function runTableAudit(): Promise<AuditRow[] | null> {
  if (!state.extractedDir || running) return null;
  running = true;
  try {
    const result = await window.vpxEditor.auditTable();
    if (!result.success || !result.findings) {
      appendConsoleLine(`Table audit failed: ${result.error ?? 'unknown error'}`, 'error');
      return null;
    }
    const rows: AuditRow[] = result.findings.map(f => ({
      ...f,
      itemName: f.item && getItem(f.item) ? (getItem(f.item)!.name as string) : undefined,
    }));
    findings = sortRows(rows);
    return findings;
  } catch (err) {
    appendConsoleLine(`Table audit failed: ${(err as Error).message}`, 'error');
    return null;
  } finally {
    running = false;
  }
}

function countBySeverity(rows: AuditRow[]): Record<AuditSeverity, number> {
  const counts: Record<AuditSeverity, number> = { error: 0, warning: 0, suggestion: 0, info: 0 };
  for (const row of rows) counts[row.severity]++;
  return counts;
}

export function auditSummary(rows: AuditRow[]): string {
  const counts = countBySeverity(rows);
  if (rows.length === 0) return 'Table audit: no issues found';
  const parts = SEVERITIES.filter(s => counts[s] > 0).map(s => `${counts[s]} ${SEVERITY_LABELS[s].toLowerCase()}`);
  return `Table audit: ${parts.join(', ')}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPanel(): void {
  const root = panel();
  if (!root) return;
  const filters = root.querySelector('#audit-filters') as HTMLElement;
  const list = root.querySelector('#audit-list') as HTMLElement;
  const counts = countBySeverity(findings);

  filters.innerHTML = SEVERITIES.map(
    s =>
      `<button class="audit-chip ${s}${hiddenSeverities.has(s) ? ' off' : ''}" data-severity="${s}" ${
        counts[s] === 0 ? 'disabled' : ''
      }>${SEVERITY_LABELS[s]} <span class="audit-chip-count">${counts[s]}</span></button>`
  ).join('');

  const visible = findings.filter(f => !hiddenSeverities.has(f.severity));
  if (running) {
    list.innerHTML = '<div class="audit-empty">Auditing table...</div>';
    return;
  }
  if (visible.length === 0) {
    list.innerHTML = `<div class="audit-empty">${findings.length === 0 ? 'No issues found.' : 'Nothing to show for the selected severities.'}</div>`;
    return;
  }
  list.innerHTML = visible
    .map((f, i) => {
      const target = f.line ? `line ${f.line}${f.column ? `:${f.column}` : ''}` : f.itemName ? f.itemName : '';
      const clickable = f.line || f.itemName ? ' clickable' : '';
      return `<div class="audit-row${clickable}" data-index="${findings.indexOf(f)}" data-i="${i}">
        <span class="audit-severity ${f.severity}">${f.severity}</span>
        <span class="audit-message">${escapeHtml(f.message)}</span>
        <span class="audit-target">${escapeHtml(target)}</span>
        <span class="audit-code">${escapeHtml(f.code)}</span>
      </div>`;
    })
    .join('');
}

function activate(row: AuditRow): void {
  if (row.line) {
    window.vpxEditor.scriptEditorGotoLine(row.line, row.column ?? 1);
    return;
  }
  if (row.itemName && getItem(row.itemName)) {
    selectItem(row.itemName);
  }
}

function initPanel(): void {
  if (initialized) return;
  const root = panel();
  if (!root) return;
  initialized = true;

  root.querySelector('#audit-close')?.addEventListener('click', () => closeTableAudit());
  root.querySelector('#audit-rerun')?.addEventListener('click', () => {
    void refreshTableAudit();
  });
  root.querySelector('#audit-filters')?.addEventListener('click', e => {
    const chip = (e.target as HTMLElement).closest('.audit-chip') as HTMLElement | null;
    if (!chip) return;
    const severity = chip.dataset.severity as AuditSeverity;
    if (hiddenSeverities.has(severity)) hiddenSeverities.delete(severity);
    else hiddenSeverities.add(severity);
    renderPanel();
  });
  root.querySelector('#audit-list')?.addEventListener('click', e => {
    const rowEl = (e.target as HTMLElement).closest('.audit-row') as HTMLElement | null;
    if (!rowEl) return;
    const index = parseInt(rowEl.dataset.index || '-1', 10);
    const row = findings[index];
    if (row) activate(row);
  });
}

async function refreshTableAudit(): Promise<void> {
  const root = panel();
  if (root) {
    root.classList.remove('hidden');
    initPanel();
  }
  renderPanel();
  const rows = await runTableAudit();
  renderPanel();
  if (rows) appendConsoleLine(auditSummary(rows), rows.some(r => r.severity === 'error') ? 'warn' : 'info');
}

export async function openTableAudit(): Promise<void> {
  if (!state.extractedDir) return;
  await refreshTableAudit();
}

export function closeTableAudit(): void {
  panel()?.classList.add('hidden');
}

export function resetTableAudit(): void {
  findings = [];
  hiddenSeverities = new Set();
  closeTableAudit();
}

export async function runTableAuditForMcp(): Promise<AuditRow[] | null> {
  const rows = await runTableAudit();
  const root = panel();
  if (rows && root && !root.classList.contains('hidden')) {
    initPanel();
    renderPanel();
  }
  return rows;
}

export async function runTableAuditAfterLoad(): Promise<void> {
  if (!state.extractedDir) return;
  resetTableAudit();
  const rows = await runTableAudit();
  if (!rows) return;
  const hasErrors = rows.some(r => r.severity === 'error');
  appendConsoleLine(auditSummary(rows), hasErrors ? 'warn' : 'info');
  if (hasErrors) {
    const root = panel();
    if (root) {
      root.classList.remove('hidden');
      initPanel();
      renderPanel();
    }
  }
}
