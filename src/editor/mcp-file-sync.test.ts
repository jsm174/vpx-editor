import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { restoreFileChanges } from '../desktop/mcp/file-transaction.js';
import type { FileChange } from '../shared/file-changes.js';

const { editorState } = vi.hoisted(() => ({
  editorState: {
    extractedDir: '',
    isTableLocked: false,
    isDragging: false,
    items: {} as Record<string, Record<string, unknown>>,
    images: {},
    imageNames: [],
    materials: {},
    materialNames: [],
    sounds: [],
    soundNames: [],
    collections: [],
    textureCache: new Map(),
  },
}));
vi.mock('./state.js', () => ({
  state: editorState,
  get undoManager() {
    return undoManager;
  },
  elements: {},
  getItem: (name: string) => editorState.items[name],
}));
vi.mock('./table-loader.js', () => ({ loadTable: vi.fn() }));
vi.mock('./parts/primitive.js', () => ({ clearPrimitiveMeshCache: vi.fn() }));
vi.mock('./canvas-renderer-3d.js', () => ({ invalidateAllItems: vi.fn() }));
vi.mock('./layers-panel.js', () => ({ updateCollectionsList: vi.fn() }));
vi.mock('./mesh-files.js', () => ({}));
import { undoManager } from './undo/undo-manager.js';
import { syncEditedFiles } from './mcp-file-sync.js';

const b64 = (value: string) => Buffer.from(value).toString('base64');
let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-undo-'));
  await fs.mkdir(path.join(root, 'images'));
  await fs.mkdir(path.join(root, 'gameitems'));
  editorState.extractedDir = root;
  editorState.items = {};
  undoManager.clear();
  undoManager.enabled = true;
  undoManager.isProcessing = false;
  vi.stubGlobal('document', { body: { inert: false } });
  vi.stubGlobal('window', {
    vpxEditor: {
      restoreMcpFiles: async (dir: string, changes: FileChange[], direction: 'before' | 'after') => {
        try {
          await restoreFileChanges(dir, changes, direction);
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      readFile: async (file: string) => {
        try {
          return { success: true, content: await fs.readFile(file, 'utf-8') };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
      refreshImageManager: vi.fn(),
      refreshMaterialManager: vi.fn(),
      refreshSoundManager: vi.fn(),
      notifyScriptUndone: vi.fn(),
      markDirty: vi.fn(),
      markClean: vi.fn(),
    },
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

it('uses the real undo manager to restore image bytes and renderer metadata', async () => {
  const changes: FileChange[] = [
    { path: 'images/Art.png', before: b64('old pixels'), after: b64('new pixels') },
    {
      path: 'images.json',
      before: b64('[{"name":"Art","path":"Art.png","width":1}]'),
      after: b64('[{"name":"Art","path":"Art.png","width":2}]'),
    },
  ];
  await restoreFileChanges(root, changes, 'after');
  await syncEditedFiles(changes);
  await undoManager.recordFileChange('Replace art', changes);
  expect((await undoManager.undo())?.valueOf()).toMatchObject({ success: true });
  expect(await fs.readFile(path.join(root, 'images/Art.png'), 'utf-8')).toBe('old pixels');
  expect(editorState.images).toMatchObject({ Art: { width: 1 } });
  expect(await undoManager.redo()).toMatchObject({ success: true });
  expect(await fs.readFile(path.join(root, 'images/Art.png'), 'utf-8')).toBe('new pixels');
  expect(editorState.images).toMatchObject({ Art: { width: 2 } });
});

it('restores primitive JSON and mesh bytes together without replacing editor-only fields', async () => {
  editorState.items.Box = {
    name: 'Box',
    _fileName: 'gameitems/Box.json',
    _type: 'Primitive',
    _layer: 3,
    use_3d_mesh: true,
  };
  const changes: FileChange[] = [
    { path: 'gameitems/Box.obj', before: b64('old mesh'), after: b64('new mesh') },
    {
      path: 'gameitems/Box.json',
      before: b64('{"Primitive":{"name":"Box","use_3d_mesh":true,"sides":4}}'),
      after: b64('{"Primitive":{"name":"Box","use_3d_mesh":true,"sides":8}}'),
    },
  ];
  await restoreFileChanges(root, changes, 'after');
  await syncEditedFiles(changes);
  await undoManager.recordFileChange('Import mesh', changes);
  expect(await undoManager.undo()).toMatchObject({ success: true });
  expect(await fs.readFile(path.join(root, 'gameitems/Box.obj'), 'utf-8')).toBe('old mesh');
  expect(editorState.items.Box).toMatchObject({ sides: 4, _layer: 3 });
  expect(await undoManager.redo()).toMatchObject({ success: true });
  expect(await fs.readFile(path.join(root, 'gameitems/Box.obj'), 'utf-8')).toBe('new mesh');
  expect(editorState.items.Box).toMatchObject({ sides: 8, _layer: 3 });
});

it('undoes GLF script and collection changes in the same history step', async () => {
  const changes: FileChange[] = [
    { path: 'script.vbs', before: b64('old script'), after: b64('new script') },
    { path: 'collections.json', before: b64('[]'), after: b64('[{"name":"glf_switches","items":["Scoop"]}]') },
  ];
  await restoreFileChanges(root, changes, 'after');
  await syncEditedFiles(changes);
  await undoManager.recordFileChange('Wire scoop', changes);
  expect(await undoManager.undo()).toMatchObject({ success: true });
  expect(editorState.collections).toEqual([]);
  expect(await fs.readFile(path.join(root, 'script.vbs'), 'utf-8')).toBe('old script');
  expect(await undoManager.redo()).toMatchObject({ success: true });
  expect(editorState.collections).toEqual([{ name: 'glf_switches', items: ['Scoop'] }]);
});

it('retains a failed undo on the stack so it can be retried', async () => {
  await undoManager.recordFileChange('bad destination', [
    { path: '../outside', before: b64('old'), after: b64('new') },
  ]);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await undoManager.undo()).toMatchObject({ success: false });
  expect(undoManager.canUndo()).toBe(true);
  expect(undoManager.canRedo()).toBe(false);
  log.mockRestore();
});

vi.mock('./view-manager.js', () => ({ renderCurrentView: vi.fn() }));
vi.mock('./properties-panel.js', () => ({ updatePropertiesPanel: vi.fn() }));

import { handleMcpTransaction, isMcpEditing } from './mcp-edit-transaction.js';
const hooks = { updateUndoRedoButtons: vi.fn() };

it('rejects a direct edit while a manual undo transaction is open', async () => {
  undoManager.beginUndo('manual');
  const result = await handleMcpTransaction({ kind: 'edit-begin', transactionId: 'busy', workDir: root }, hooks);
  expect(result.success).toBe(false);
  expect(isMcpEditing()).toBe(false);
  undoManager.cancelUndo();
});

it('acknowledges a commit only after syncing files and recording one undo entry', async () => {
  const changes: FileChange[] = [{ path: 'script.vbs', before: b64('old'), after: b64('new') }];
  const request = { transactionId: 'commit', workDir: root };
  expect(await handleMcpTransaction({ ...request, kind: 'edit-begin' }, hooks)).toEqual({ success: true });
  expect(document.body.inert).toBe(true);
  expect(undoManager.enabled).toBe(false);
  await restoreFileChanges(root, changes, 'after');
  expect(
    await handleMcpTransaction({ ...request, kind: 'edit-commit', description: 'script', changes }, hooks)
  ).toEqual({ success: true });
  expect(undoManager.undoStack).toHaveLength(1);
  expect(undoManager.undoStack[0].fileChanges).toEqual(changes);
  await handleMcpTransaction({ ...request, kind: 'edit-end' }, hooks);
  expect(document.body.inert).toBe(false);
  expect(undoManager.enabled).toBe(true);
  expect(isMcpEditing()).toBe(false);
});

it('can abort a late commit without losing the previous redo history', async () => {
  const changes: FileChange[] = [{ path: 'script.vbs', before: b64('old'), after: b64('new') }];
  await restoreFileChanges(root, changes, 'after');
  await undoManager.recordFileChange('earlier', changes);
  await undoManager.undo();
  const redo = [...undoManager.redoStack];
  const request = { transactionId: 'late', workDir: root };
  await handleMcpTransaction({ ...request, kind: 'edit-begin' }, hooks);
  await restoreFileChanges(root, changes, 'after');
  await handleMcpTransaction({ ...request, kind: 'edit-commit', description: 'late', changes }, hooks);
  await restoreFileChanges(root, changes, 'before');
  await handleMcpTransaction({ ...request, kind: 'edit-abort', changes }, hooks);
  await handleMcpTransaction({ ...request, kind: 'edit-end' }, hooks);
  expect(undoManager.undoStack).toHaveLength(0);
  expect(undoManager.redoStack).toEqual(redo);
  expect(document.body.inert).toBe(false);
});

it('releases input after an unexpected table change', async () => {
  const request = { transactionId: 'unloaded', workDir: root };
  await handleMcpTransaction({ ...request, kind: 'edit-begin' }, hooks);
  editorState.extractedDir = '';
  expect(await handleMcpTransaction({ ...request, kind: 'edit-end' }, hooks)).toEqual({ success: true });
  expect(document.body.inert).toBe(false);
  expect(undoManager.enabled).toBe(true);
  expect(isMcpEditing()).toBe(false);
});

it('refreshes asset managers when replacement changes only the bytes', async () => {
  await syncEditedFiles([
    { path: 'images/Art.png', before: b64('old'), after: b64('new') },
    { path: 'sounds/hit.wav', before: b64('old'), after: b64('new') },
  ]);
  expect(window.vpxEditor.refreshImageManager).toHaveBeenCalled();
  expect(window.vpxEditor.refreshSoundManager).toHaveBeenCalled();
});

it('restores renderer state as well as disk after a failed undo refresh', async () => {
  const changes: FileChange[] = [
    { path: 'images.json', before: b64('[]'), after: b64('[{"name":"Art"}]') },
    { path: 'collections.json', before: b64('[]'), after: b64('[{"name":"GI","items":[]}]') },
  ];
  await restoreFileChanges(root, changes, 'after');
  await syncEditedFiles(changes);
  await undoManager.recordFileChange('combined', changes);
  const read = window.vpxEditor.readFile;
  let failed = false;
  vi.spyOn(window.vpxEditor, 'readFile').mockImplementation(async file => {
    if (file.endsWith('collections.json') && !failed) {
      failed = true;
      return { success: false, error: 'transient read error' };
    }
    return read(file);
  });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await undoManager.undo()).toMatchObject({ success: false });
  expect(editorState.images).toEqual({ Art: { name: 'Art' } });
  expect(JSON.parse(await fs.readFile(path.join(root, 'images.json'), 'utf-8'))).toEqual([{ name: 'Art' }]);
  expect(undoManager.canUndo()).toBe(true);
  log.mockRestore();
});
