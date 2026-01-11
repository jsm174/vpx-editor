import type { Platform } from '../platform/index';

export interface WebState {
  platform: Platform | null;
  tableLoaded: boolean;
  currentFileName: string;
  currentFileHandle: FileSystemFileHandle | null;
  globalIsTableLocked: boolean;
  isTableDirty: boolean;
}

export const state: WebState = {
  platform: null,
  tableLoaded: false,
  currentFileName: 'table.vpx',
  currentFileHandle: null,
  globalIsTableLocked: false,
  isTableDirty: false,
};

export function updateWindowTitle(): void {
  const dirtyIndicator = state.isTableDirty ? ' *' : '';
  document.title = `VPX Editor - ${state.currentFileName}${dirtyIndicator}`;
}

export function markDirty(): void {
  if (!state.isTableDirty) {
    state.isTableDirty = true;
    updateWindowTitle();
  }
}

export function markClean(): void {
  if (state.isTableDirty) {
    state.isTableDirty = false;
    updateWindowTitle();
  }
}

export const EXTRACTED_DIR = '/vpx-work';

export const TEMPLATES: Record<string, { file: string; name: string }> = {
  'new-table': { file: 'blankTable.vpx', name: 'New Table' },
  'new-blank': { file: 'strippedTable.vpx', name: 'Blank Table' },
  'new-example': { file: 'exampleTable.vpx', name: 'Example Table' },
  'new-lightseq': { file: 'lightSeqTable.vpx', name: 'Light Sequence Demo' },
};

export function getEvents() {
  return window.__vpxEvents;
}
