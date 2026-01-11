import { ipcMain, dialog } from 'electron';
import fs from 'fs-extra';
import type { WindowContext } from '../../../desktop/window-context';
import type { FileContext } from '../../../shared/file-context';
import {
  createCollection,
  deleteCollection,
  renameCollection,
  moveCollectionUp,
  moveCollectionDown,
  reorderCollections,
  updateCollection,
  addItemsToCollection,
  type Collection,
  type CollectionUpdate,
} from '../shared/operations';

function createFileContext(ctx: WindowContext): FileContext | null {
  if (!ctx.extractedDir) return null;
  const extractedDir = ctx.extractedDir;

  return {
    extractedDir,
    readFile: (path: string) => fs.promises.readFile(path, 'utf-8'),
    writeFile: (path: string, content: string) => fs.promises.writeFile(path, content),
    readBinaryFile: (path: string) => fs.promises.readFile(path),
    writeBinaryFile: (path: string, data: Uint8Array) => fs.promises.writeFile(path, data),
    exists: (path: string) => Promise.resolve(fs.existsSync(path)),
    deleteFile: (path: string) => fs.promises.unlink(path),
    listDir: (path: string) => fs.promises.readdir(path),
  };
}

interface CollectionHandlerDeps {
  getContextForManagerEvent: (event: { sender: Electron.WebContents }) => WindowContext | null;
}

export function setupCollectionHandlers(deps: CollectionHandlerDeps): void {
  const { getContextForManagerEvent } = deps;

  function notifyCollectionsChanged(ctx: WindowContext, collections: Collection[]) {
    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', { collections });
    }
  }

  function wrapWithUndo(ctx: WindowContext, description: string, fn: () => Promise<void>) {
    ctx.window.webContents.send('undo-begin', description);
    ctx.window.webContents.send('undo-mark-collections');
    return fn().finally(() => {
      ctx.window.webContents.send('undo-end');
    });
  }

  function markChanges(ctx: WindowContext) {
    ctx.hasExternalChanges = true;
    ctx.markDirty();
  }

  ipcMain.on('collection-create', async (event, name: string) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, `Create collection ${name}`, async () => {
      const collections = await createCollection(fileCtx, name);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });
  });

  ipcMain.on('collection-create-from-selection', async event => {
    const ctx = getContextForManagerEvent(event);
    if (!ctx?.extractedDir) return;
    ctx.window.webContents.send('collection-create-from-selection-request');
  });

  ipcMain.on('collection-delete', async (event, name: string) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    const result = await dialog.showMessageBox(ctx.collectionManagerWindow || ctx.window, {
      type: 'question',
      message: 'Delete Collection',
      detail: `Are you sure you want to delete the collection "${name}"?`,
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response !== 1) return;

    await wrapWithUndo(ctx, `Delete collection ${name}`, async () => {
      const collections = await deleteCollection(fileCtx, name);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });
  });

  ipcMain.on('collection-rename', async (event, oldName: string, newName: string) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, `Rename collection ${oldName}`, async () => {
      const collections = await renameCollection(fileCtx, oldName, newName);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });
  });

  ipcMain.on('collection-move-up', async (event, name: string) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, `Move collection ${name} up`, async () => {
      const collections = await moveCollectionUp(fileCtx, name);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });
  });

  ipcMain.on('collection-move-down', async (event, name: string) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, `Move collection ${name} down`, async () => {
      const collections = await moveCollectionDown(fileCtx, name);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });
  });

  ipcMain.on('collection-reorder', async (event, names: string[]) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, 'Reorder collections', async () => {
      const collections = await reorderCollections(fileCtx, names);
      markChanges(ctx);
      ctx.window.webContents.send('collections-reordered', { collections });
    });
  });

  ipcMain.on('collection-save-editor', async (event, data: CollectionUpdate) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, `Edit collection ${data.originalName}`, async () => {
      const collections = await updateCollection(fileCtx, data);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collection-editor-saved');
    }
  });

  ipcMain.on('collection-add-items', async (event, name: string, items: string[]) => {
    const ctx = getContextForManagerEvent(event);
    const fileCtx = ctx ? createFileContext(ctx) : null;
    if (!ctx || !fileCtx) return;

    await wrapWithUndo(ctx, `Add items to ${name}`, async () => {
      const collections = await addItemsToCollection(fileCtx, name, items);
      markChanges(ctx);
      notifyCollectionsChanged(ctx, collections);
    });
  });

  ipcMain.on('notify-collections-changed', (event, collections: Collection[], selectCollection?: string) => {
    const ctx = getContextForManagerEvent(event);
    if (!ctx) return;

    if (ctx.collectionManagerWindow) {
      ctx.collectionManagerWindow.webContents.send('collections-changed', {
        collections,
        selectCollection,
      });
    }
  });
}
