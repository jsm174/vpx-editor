import { undoManager } from '../editor/state.js';

export interface UndoOptions {
  skipUndo?: boolean;
  markCollections?: boolean;
}

export async function withUndo<T>(name: string, fn: () => Promise<T>, options: UndoOptions = {}): Promise<T> {
  const { skipUndo = false, markCollections = false } = options;

  if (skipUndo) {
    return await fn();
  }

  undoManager.beginUndo(name);
  if (markCollections) {
    undoManager.markCollectionsForUndo();
  }

  try {
    const result = await fn();
    undoManager.endUndo();
    return result;
  } catch (e: unknown) {
    undoManager.cancelUndo();
    throw e;
  }
}

export function withUndoSync<T>(name: string, fn: () => T, options: UndoOptions = {}): T {
  const { skipUndo = false, markCollections = false } = options;

  if (skipUndo) {
    return fn();
  }

  undoManager.beginUndo(name);
  if (markCollections) {
    undoManager.markCollectionsForUndo();
  }

  try {
    const result = fn();
    undoManager.endUndo();
    return result;
  } catch (e: unknown) {
    undoManager.cancelUndo();
    throw e;
  }
}
