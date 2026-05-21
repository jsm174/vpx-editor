import type { FileChange } from '../shared/file-changes.js';
import { state, undoManager } from './state.js';
import { syncEditedFiles } from './mcp-file-sync.js';
import { renderCurrentView } from './view-manager.js';
import { updatePropertiesPanel } from './properties-panel.js';

let editTransaction: {
  id: string;
  workDir: string;
  undoId?: number;
  undo: typeof undoManager.undoStack;
  redo: typeof undoManager.redoStack;
  inert: boolean;
} | null = null;

export async function handleMcpTransaction(
  data: Record<string, unknown>,
  hooks: { updateUndoRedoButtons: () => void }
): Promise<Record<string, unknown>> {
  // Always release our input/undo lock, even if a table unload raced the request.
  if (data.kind === 'edit-end' && editTransaction && editTransaction.id === data.transactionId) {
    document.body.inert = editTransaction.inert;
    undoManager.enabled = true;
    editTransaction = null;
    hooks.updateUndoRedoButtons();
    return { success: true };
  }
  if (data.workDir !== state.extractedDir) return { success: false, error: 'Table changed' };
  if (data.kind === 'edit-begin') {
    if (
      editTransaction ||
      undoManager.isProcessing ||
      undoManager.transactionDepth ||
      state.isDragging ||
      !undoManager.enabled ||
      state.isTableLocked
    ) {
      return { success: false, error: 'Editor is busy or locked. Retry when the current edit finishes.' };
    }
    editTransaction = {
      id: data.transactionId as string,
      workDir: data.workDir as string,
      undo: [...undoManager.undoStack],
      redo: [...undoManager.redoStack],
      inert: document.body.inert,
    };
    document.body.inert = true;
    undoManager.enabled = false;
    return { success: true };
  }
  if (!editTransaction || editTransaction.id !== data.transactionId)
    return { success: false, error: 'Edit transaction expired' };
  const changes = (data.changes ?? []) as FileChange[];
  if (data.kind === 'edit-commit') {
    await syncEditedFiles(changes);
    undoManager.enabled = true;
    try {
      await undoManager.recordFileChange(data.description as string, changes);
      if (changes.length) editTransaction.undoId = undoManager.undoStack.at(-1)?.id;
    } finally {
      undoManager.enabled = false;
    }
    renderCurrentView();
    updatePropertiesPanel();
  } else if (data.kind === 'edit-abort') {
    if (editTransaction.undoId) {
      undoManager.undoStack = editTransaction.undo;
      undoManager.redoStack = editTransaction.redo;
      undoManager._notifyChange();
      undoManager._updateDirtyState();
    }
    await syncEditedFiles(changes);
    renderCurrentView();
  }
  return { success: true };
}

export function isMcpEditing(): boolean {
  return editTransaction !== null;
}
