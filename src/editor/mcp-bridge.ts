import { state, elements, undoManager, getItem, type GameItem } from './state.js';
import { createObject, deleteObject, saveNewObject } from './object-factory.js';
import { updateItemsList, selectItem } from './items-panel.js';
import { updateLayersList } from './layers-panel.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { loadTable, saveItemToFile } from './table-loader.js';
import { invalidateItem, invalidateAllItems } from './canvas-renderer-3d.js';
import { clearPrimitiveMeshCache } from './parts/primitive.js';
import { moveObjectTo, getItemAnchor } from './object-operations.js';
import { applyGroupVisibilityToItem, syncIndexVisibility, saveGameitemsIndex } from './layer-operations.js';
import { generateUniqueFileName } from '../shared/gameitem-utils.js';
import { renderCurrentView, updateElementToolbarForBackglassView, updateToolboxForTableLock } from './view-manager.js';
import { updateClipboardMenuState } from './clipboard.js';
import { handleMcpCaptureRequest } from './mcp-capture.js';

export interface McpBridgeHooks {
  runUndoRedo: (direction: 'undo' | 'redo') => Promise<boolean>;
  updateUndoRedoButtons: () => void;
}

interface McpReloadRequest {
  reason?: string;
  undo?: {
    domain?: string;
    description?: string;
    partName?: string;
    scriptBefore?: string;
    scriptAfter?: string;
  };
}

interface McpPartRequest {
  operation: 'create' | 'modify' | 'delete';
  type?: string;
  position?: { x: number; y: number; z?: number };
  name?: string;
  overrides?: Record<string, unknown>;
  partName?: string;
}

interface McpPartResult {
  success: boolean;
  name?: string;
  type?: string;
  fileName?: string;
  warning?: string;
  error?: string;
  [key: string]: unknown;
}

const LAYER_KEYS = ['part_group_name', 'editor_layer_visibility', '_layer'];

let queue: Promise<unknown> = Promise.resolve();

export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function findItemNameInsensitive(name: string): string | null {
  const lower = name.toLowerCase();
  for (const existing of Object.keys(state.items)) {
    if (existing.toLowerCase() === lower) return existing;
  }
  return null;
}

function normalizeDragPoints(item: GameItem): void {
  if (!Array.isArray(item.drag_points)) return;
  item.drag_points = (item.drag_points as Record<string, unknown>[]).map(pt => ({
    z: 0,
    smooth: false,
    is_slingshot: false,
    has_auto_texture: true,
    tex_coord: 0,
    is_locked: false,
    editor_layer: 0,
    editor_layer_name: '',
    editor_layer_visibility: true,
    ...pt,
  })) as typeof item.drag_points;
}

function applyOverrides(item: GameItem, overrides: Record<string, unknown>, skip: string[]): void {
  const target = item as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    if (k.startsWith('_') && k !== '_layer') continue;
    if (skip.includes(k)) continue;
    if (k === 'return' && item._type === 'Flipper') {
      target.return_ = v;
      continue;
    }
    target[k] = v;
  }
  normalizeDragPoints(item);
}

async function syncLayerFields(item: GameItem, overrides: Record<string, unknown>): Promise<void> {
  if (!LAYER_KEYS.some(k => k in overrides)) return;
  applyGroupVisibilityToItem(item, (item.part_group_name as string | undefined) ?? null);
  undoManager.markGameitemsListForUndo();
  syncIndexVisibility(item);
  await saveGameitemsIndex();
}

async function reloadPartFromDisk(partName: string, description: string, withMaterials: boolean): Promise<void> {
  const item = getItem(partName);
  if (!item || !item._fileName || !state.extractedDir) return;
  undoManager.beginUndo(description);
  undoManager.markForUndo(item.name as string);
  if (withMaterials) undoManager.markMaterialsForUndo();
  const result = await window.vpxEditor.readFile(`${state.extractedDir}/${item._fileName}`);
  if (result.success && result.content) {
    const itemData = JSON.parse(result.content);
    Object.assign(item, itemData[Object.keys(itemData)[0]]);
  }
  await undoManager.endUndo();
  clearPrimitiveMeshCache();
  invalidateItem(item.name as string);
}

async function recordMcpUndo(undo: McpReloadRequest['undo']): Promise<void> {
  if (!undo) return;
  const description = undo.description || 'MCP edit';
  if ((undo.domain === 'part' || undo.domain === 'part-and-materials') && undo.partName) {
    await reloadPartFromDisk(undo.partName, description, undo.domain === 'part-and-materials');
    return;
  }
  if (undo.domain === 'script') {
    if (
      typeof undo.scriptBefore === 'string' &&
      typeof undo.scriptAfter === 'string' &&
      undo.scriptBefore !== undo.scriptAfter
    ) {
      await undoManager.recordScriptChange(undo.scriptBefore, undo.scriptAfter);
    }
    return;
  }
  if (undo.domain === 'materials' || undo.domain === 'images' || undo.domain === 'sounds') {
    undoManager.beginUndo(description);
    if (undo.domain === 'materials') undoManager.markMaterialsForUndo();
    else if (undo.domain === 'images') undoManager.markImagesForUndo();
    else undoManager.markSoundsForUndo();
    await undoManager.endUndo();
  }
}

async function applyReload(batch: McpReloadRequest[], hooks: McpBridgeHooks): Promise<void> {
  const domains = new Set(batch.map(b => b.undo?.domain ?? 'none'));
  for (const item of batch) await recordMcpUndo(item.undo);

  if (domains.has('none')) {
    await loadTable();
    updateElementToolbarForBackglassView();
    updateToolboxForTableLock();
    updateClipboardMenuState();
  } else {
    if (domains.has('images')) {
      for (const texture of state.textureCache.values()) texture.dispose();
      state.textureCache.clear();
    }
    if (domains.has('images') || domains.has('materials') || domains.has('part-and-materials')) {
      invalidateAllItems();
    }
    if (!domains.has('script') || domains.size > 1) {
      renderCurrentView();
      updatePropertiesPanel();
    }
  }
  if (domains.has('images')) window.vpxEditor.refreshImageManager();
  if (domains.has('materials') || domains.has('part-and-materials')) window.vpxEditor.refreshMaterialManager();
  if (domains.has('sounds')) window.vpxEditor.refreshSoundManager();
  hooks.updateUndoRedoButtons();

  const current = batch[batch.length - 1];
  if (elements.statusBar) {
    elements.statusBar.textContent = `Updated after MCP edit${current.reason ? ` (${current.reason})` : ''}`;
  }
}

async function handleMcpPartOp(data: McpPartRequest): Promise<McpPartResult> {
  if (!state.extractedDir) return { success: false, error: 'No active table' };
  if (state.isTableLocked) return { success: false, error: 'Table is locked' };

  if (data.operation === 'create') {
    if (!data.type || !data.position) return { success: false, error: 'create requires type and position' };
    if (data.name && findItemNameInsensitive(data.name)) {
      return {
        success: false,
        error: `A part named "${data.name}" already exists — it may have been created by an earlier (timed-out) call. Use vpx_table(action:"part") to check it, or pick another name.`,
      };
    }
    const obj = createObject(data.type, { x: data.position.x, y: data.position.y });
    if (!obj) return { success: false, error: `Unknown part type: ${data.type}` };
    let zWarning: string | undefined;
    if (data.position.z !== undefined) {
      if (obj.position && typeof obj.position === 'object') {
        (obj.position as unknown as Record<string, number>).z = data.position.z;
      } else {
        zWarning = `${data.type} has no z position — it sits on its surface; the supplied z was ignored.`;
      }
    }
    if (data.name) {
      obj.name = data.name;
      obj._fileName = `gameitems/${generateUniqueFileName(
        data.type,
        data.name,
        state.gameitems.map(gi => gi.file_name)
      )}`;
    }
    if (data.overrides) applyOverrides(obj, data.overrides, ['name', 'position']);
    undoManager.beginUndo(`${obj._type} created (MCP)`);
    const saved = await saveNewObject(obj, true);
    if (saved && data.overrides) await syncLayerFields(obj, data.overrides);
    await undoManager.endUndo();
    if (!saved) return { success: false, error: 'saveNewObject failed' };
    updateItemsList('', false);
    updateLayersList();
    selectItem(obj.name as string, false, true);
    renderCurrentView();
    return { success: true, name: obj.name as string, type: obj._type, fileName: obj._fileName, warning: zWarning };
  }

  if (data.operation === 'modify') {
    if (!data.partName || !data.overrides) return { success: false, error: 'modify requires partName and overrides' };
    const item = getItem(data.partName);
    if (!item) return { success: false, error: `Part not found: ${data.partName}` };
    if (item.is_locked) return { success: false, error: `Part "${data.partName}" is locked in the editor.` };
    if ('name' in data.overrides && data.overrides.name !== item.name) {
      return { success: false, error: 'Renaming via modify is not supported.' };
    }
    undoManager.beginUndo(`${item._type} modified (MCP)`);
    undoManager.markForUndo(item.name as string);
    const position = data.overrides.position as { x?: number; y?: number; z?: number } | undefined;
    applyOverrides(item, data.overrides, ['name', 'position']);
    if (position && (position.x !== undefined || position.y !== undefined || position.z !== undefined)) {
      const anchor = getItemAnchor(item);
      moveObjectTo(item.name as string, position.x ?? anchor.x, position.y ?? anchor.y, position.z);
    }
    const ok = await saveItemToFile(item.name as string);
    await syncLayerFields(item, data.overrides);
    await undoManager.endUndo();
    if (!ok) return { success: false, error: 'saveItemToFile failed' };
    invalidateItem(item.name as string);
    updateLayersList();
    updatePropertiesPanel();
    renderCurrentView();
    return { success: true, name: item.name as string, type: item._type };
  }

  if (data.operation === 'delete') {
    if (!data.partName) return { success: false, error: 'delete requires partName' };
    const item = getItem(data.partName);
    if (!item) return { success: false, error: `Part not found: ${data.partName}` };
    const ok = await deleteObject(data.partName);
    if (!ok) return { success: false, error: 'deleteObject failed' };
    updateItemsList('', false);
    updateLayersList();
    renderCurrentView();
    return { success: true, name: data.partName };
  }

  return { success: false, error: `Unknown operation: ${(data as { operation: string }).operation}` };
}

async function handleMcpUndoRedo(direction: 'undo' | 'redo', hooks: McpBridgeHooks): Promise<Record<string, unknown>> {
  const available = direction === 'undo' ? undoManager.canUndo() : undoManager.canRedo();
  if (!available) return { success: false, error: `Nothing to ${direction}.` };
  const description = direction === 'undo' ? undoManager.getUndoDescription() : undoManager.getRedoDescription();
  const ok = await hooks.runUndoRedo(direction);
  if (ok)
    return { success: true, description: `${direction === 'undo' ? 'Undid' : 'Redid'}: ${description ?? 'edit'}` };
  return { success: false, error: `${direction} failed or another undo/redo is in progress — check the editor.` };
}

async function dispatch(data: { kind: string; [key: string]: unknown }, hooks: McpBridgeHooks) {
  if (data.kind === 'part-op') return handleMcpPartOp(data as unknown as McpPartRequest);
  if (data.kind === 'capture') return handleMcpCaptureRequest(data);
  if (data.kind === 'undo-redo') return handleMcpUndoRedo(data.direction === 'redo' ? 'redo' : 'undo', hooks);
  if (data.kind === 'geometry') {
    const { handleMcpGeometryRequest } = await import('./mcp-geometry.js');
    return handleMcpGeometryRequest(data);
  }
  if (data.kind === 'export-obj') {
    const { handleMcpExportObjRequest } = await import('./mcp-geometry.js');
    return handleMcpExportObjRequest(data);
  }
  return { success: false, error: `Unknown mcp request kind: ${data.kind}` };
}

export function initMcpBridge(hooks: McpBridgeHooks): void {
  let pendingReloads: McpReloadRequest[] = [];

  window.vpxEditor.onMcpReloadRequested?.((data: McpReloadRequest) => {
    if (!state.extractedDir) return;
    pendingReloads.push(data ?? {});
    void runExclusive(async () => {
      if (pendingReloads.length === 0 || !state.extractedDir) return;
      const batch = pendingReloads;
      pendingReloads = [];
      await applyReload(batch, hooks);
    });
  });

  window.vpxEditor.onMcpRequest?.((raw: unknown) => {
    const data = raw as { requestId: string; kind: string; [key: string]: unknown };
    void runExclusive(async () => {
      let result: Record<string, unknown>;
      try {
        result = (await dispatch(data, hooks)) as Record<string, unknown>;
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : String(err) };
      }
      window.vpxEditor.replyMcpRequest?.({ requestId: data.requestId, ...result });
    });
  });
}
