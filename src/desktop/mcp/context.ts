import { randomUUID } from 'node:crypto';
import { serializeTable } from './edit-queue.js';
import { fileTransaction } from './file-transaction.js';
import type { FileChange } from '../../shared/file-changes.js';
import path from 'node:path';
import fs from 'fs-extra';
import type { WindowRegistry, WindowContext } from '../window-context.js';
import { loadFromWorkFolder, type TableState } from '../../shared/table-state.js';
import { loadTableFromVpx } from './library/load-table.js';
import { applyEditDirect } from './edit-handler.js';
import type { RendererBridge } from './renderer-bridge.js';
import { buildPrimitiveObjExport, importPrimitiveMesh } from '../mesh-exchange.js';
import { findItem, loadFromWorkFolder as loadWorkFolderState } from '../../shared/table-state.js';
import type { ObjExchangeOptions } from '../../shared/obj-transform.js';
import { runPlayTest } from './play-test.js';
import { isRunningInFlatpak } from '../vpx-operations.js';
import type {
  ActiveTableHandle,
  CaptureRequest,
  CaptureResult,
  EditOperation,
  EditResult,
  GeometryRequest,
  MeshExportRequest,
  MeshImportRequest,
  PlayTestResult,
  ToolContext,
  VpxReader,
  WindowSummary,
} from './types.js';

export interface ContextDeps {
  windowRegistry: WindowRegistry;
  getSystemScriptsPath: () => string | null;
  getGlfPath: () => string | null;
  getTemplatesPath: () => string | null;
  getMcpPort: () => number;
  getVpinballPath: () => string | null;
  initVpinModule: () => Promise<typeof import('@francisdb/vpin-wasm')>;
  /** Create a new table from a bundled template, opening an editor window. Resolves to the window id. */
  createTable: (templateName: string, displayName: string) => Promise<string | null>;
  /** Save the table in the given window via the editor's normal save flow (may open a native Save As dialog). */
  saveTable: (windowId: string) => Promise<{ saved: boolean; error?: string }>;
  renderer: RendererBridge;
  log: (msg: string, windowId?: string | null) => void;
}

class VpinReader implements VpxReader {
  constructor(private readonly initVpin: () => Promise<typeof import('@francisdb/vpin-wasm')>) {}

  async extract(buffer: Uint8Array): Promise<Record<string, Uint8Array>> {
    const vpin = await this.initVpin();
    return vpin.extract(buffer) as Record<string, Uint8Array>;
  }

  async objToMesh(
    data: Uint8Array
  ): Promise<{ positions: Float32Array; texCoords: Float32Array; normals: Float32Array; indices: Uint32Array }> {
    const vpin = await this.initVpin();
    const mesh = vpin.obj_to_mesh(data, null);
    const result = {
      positions: new Float32Array(mesh.positions),
      texCoords: new Float32Array(mesh.texCoords),
      normals: new Float32Array(mesh.normals),
      indices: new Uint32Array(mesh.indices),
    };
    mesh.free();
    return result;
  }
}

function activeContext(registry: WindowRegistry): WindowContext | null {
  const focused = registry.getFocused();
  if (focused && focused.hasTable()) return focused;
  for (const ctx of registry.getAll()) {
    if (ctx.hasTable()) return ctx;
  }
  return null;
}

const RENDERER_REQUEST_TIMEOUTS: Record<string, number> = {
  'part-op': 30_000,
  capture: 45_000,
  'undo-redo': 30_000,
  geometry: 45_000,
  'export-obj': 60_000,
};

function sendRendererRequest(
  deps: ContextDeps,
  ctx: WindowContext,
  kind: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!ctx.window || ctx.window.isDestroyed()) {
    return Promise.resolve({ success: false, error: 'Editor window destroyed' });
  }
  return deps.renderer.request(
    ctx.window,
    kind,
    { workDir: ctx.extractedDir, ...payload },
    RENDERER_REQUEST_TIMEOUTS[kind] ?? 30_000
  );
}

async function sendPartOpToRenderer(
  deps: ContextDeps,
  ctx: WindowContext,
  payload: Record<string, unknown>
): Promise<EditResult> {
  const result = await sendRendererRequest(deps, ctx, 'part-op', payload);
  if (result.success === true) {
    return {
      success: true,
      applied: true,
      description:
        `${(payload.operation as string) ?? 'part-op'} ${(result.type as string) ?? ''} "${(result.name as string) ?? ''}"`.trim(),
      note: typeof result.warning === 'string' ? result.warning : undefined,
    };
  }
  return { success: false, applied: false, error: (result.error as string) ?? 'Unknown renderer error' };
}

function setEditorInput(ctx: WindowContext, busy: boolean): void {
  for (const win of [
    ctx.window,
    ctx.scriptEditorWindow,
    ctx.imageManagerWindow,
    ctx.materialManagerWindow,
    ctx.soundManagerWindow,
    ctx.collectionManagerWindow,
    ctx.dimensionsManagerWindow,
    ctx.renderProbeManagerWindow,
  ]) {
    if (win && !win.isDestroyed()) win.webContents.send('mcp-edit-busy', busy);
  }
}

async function directTransaction<T>(
  ctx: WindowContext,
  deps: ContextDeps,
  description: string,
  edit: () => Promise<T>,
  succeeded: (result: T) => boolean
): Promise<T> {
  const workDir = ctx.extractedDir!;
  const transactionId = randomUUID();
  if (ctx.mcpEditBusy) throw new Error('Editor is busy');
  ctx.mcpEditBusy = true;
  let touched: FileChange[] = [];
  try {
    setEditorInput(ctx, true);
    if (ctx.scriptEditorWindow && !ctx.scriptEditorWindow.isDestroyed()) {
      const flushed = await deps.renderer.request(ctx.scriptEditorWindow, 'edit-flush', { workDir }, 30_000);
      if (flushed.success !== true)
        throw new Error(String(flushed.error ?? 'Script editor could not save pending changes'));
    }
    const prepared = await sendRendererRequest(deps, ctx, 'edit-begin', { transactionId, workDir });
    if (prepared.success !== true) throw new Error(String(prepared.error ?? 'Editor is busy'));
    ctx.mcpEditWriting = true;
    return await fileTransaction(workDir, edit, async (result, changes) => {
      touched = changes;
      if (!succeeded(result)) throw new Error((result as { error?: string }).error ?? 'Edit failed');
      if (ctx.extractedDir !== workDir || ctx.window.isDestroyed() || ctx.isTableLocked) {
        throw new Error('Table changed or closed during the edit');
      }
      const synced = await sendRendererRequest(deps, ctx, 'edit-commit', {
        transactionId,
        workDir,
        description,
        changes,
      });
      if (synced.success !== true) throw new Error(String(synced.error ?? 'Renderer synchronization failed'));
      ctx.markDirty();
      if (
        changes.some(c => c.path === 'script.vbs') &&
        ctx.scriptEditorWindow &&
        !ctx.scriptEditorWindow.isDestroyed()
      ) {
        ctx.scriptEditorWindow.webContents.send(
          'script-undone',
          await fs.readFile(path.join(workDir, 'script.vbs'), 'utf-8')
        );
      }
      deps.log(description, ctx.id);
    });
  } catch (error) {
    // fileTransaction has already restored the old files. Restore renderer state too.
    await sendRendererRequest(deps, ctx, 'edit-abort', { transactionId, workDir, changes: touched });
    throw error;
  } finally {
    try {
      await sendRendererRequest(deps, ctx, 'edit-end', { transactionId, workDir });
    } finally {
      setEditorInput(ctx, false);
      ctx.mcpEditWriting = false;
      ctx.mcpEditBusy = false;
    }
  }
}

async function applyEditAndNotifyRenderer(
  ctx: WindowContext,
  op: EditOperation,
  deps: ContextDeps,
  vpx: VpxReader
): Promise<EditResult> {
  if (!ctx.window || ctx.window.isDestroyed() || !ctx.extractedDir) {
    return { success: false, applied: false, error: 'Editor window has no active table' };
  }
  if (op.kind === 'add-part') {
    const data = op.payload.data as Record<string, unknown>;
    const position = (data.position as { x: number; y: number; z?: number }) ??
      (data.center as { x: number; y: number }) ?? { x: 0, y: 0 };
    const overrides = { ...data };
    delete overrides.position;
    delete overrides.center;
    delete overrides.name;
    return sendPartOpToRenderer(deps, ctx, {
      operation: 'create',
      type: op.payload.type,
      position,
      name: data.name,
      overrides,
    });
  }
  if (op.kind === 'modify-part') {
    return sendPartOpToRenderer(deps, ctx, {
      operation: 'modify',
      partName: op.payload.name,
      overrides: op.payload.patch,
    });
  }
  if (op.kind === 'delete-part') {
    return sendPartOpToRenderer(deps, ctx, {
      operation: 'delete',
      partName: op.payload.name,
    });
  }
  if (op.kind === 'undo' || op.kind === 'redo') {
    const result = await sendRendererRequest(deps, ctx, 'undo-redo', { direction: op.kind });
    if (result.success === true) {
      return { success: true, applied: true, description: (result.description as string) ?? op.kind };
    }
    return { success: false, applied: false, error: (result.error as string) ?? `${op.kind} failed` };
  }

  return directTransaction(
    ctx,
    deps,
    op.description,
    () => applyEditDirect({ workDir: ctx.extractedDir!, vpx }, op),
    result => result.success
  );
}

async function findPrimitive(
  workDir: string,
  partName: string
): Promise<{ name: string; fileName: string } | { error: string }> {
  const state = await loadWorkFolderState(workDir);
  const item = findItem(state, partName);
  if (!item) return { error: `Part not found: ${partName}` };
  if (item.type !== 'Primitive') {
    return {
      error: `"${item.name}" is a ${item.type}; only Primitive parts carry a mesh. Add one with vpx_part first.`,
    };
  }
  return { name: item.name, fileName: `gameitems/${item.fileName}` };
}

const DONOR_CACHE_MAX = 3;

export function createToolContext(deps: ContextDeps): ToolContext {
  const vpx = new VpinReader(deps.initVpinModule);
  const donorCache = new Map<string, { mtimeMs: number; size: number; state: TableState }>();

  // Each ToolContext belongs to one MCP session and stays attached to one editor
  // window, so a user focusing another table mid-run never retargets the agent.
  let boundWindowId: string | null = null;
  let boundWorkDir: string | null = null;

  function resolve(): { ctx: WindowContext | null; error?: string } {
    if (boundWindowId) {
      const ctx = deps.windowRegistry.get(boundWindowId);
      if (ctx && ctx.window && !ctx.window.isDestroyed() && ctx.hasTable() && ctx.extractedDir === boundWorkDir)
        return { ctx };
      return {
        ctx: null,
        error:
          'The table window this session was attached to is gone (closed or table unloaded). ' +
          'List windows with vpx_table(action:"windows") and re-attach with vpx_table(action:"attach", windowId:"...").',
      };
    }
    const ctx = activeContext(deps.windowRegistry);
    if (ctx) {
      boundWindowId = ctx.id;
      boundWorkDir = ctx.extractedDir;
      return { ctx };
    }
    return { ctx: null };
  }

  function toHandle(ctx: WindowContext): ActiveTableHandle {
    return {
      workDir: ctx.extractedDir!,
      vpxPath: ctx.currentTablePath,
      tableName: ctx.tableName,
      windowId: ctx.id,
      isLocked: ctx.isTableLocked,
    };
  }

  const sessionKey = `session:${randomUUID()}`;
  async function withTable<T>(fn: () => Promise<T>): Promise<T> {
    const { ctx } = resolve();
    if (!ctx?.extractedDir) return fn();
    const workDir = ctx.extractedDir;
    return serializeTable(workDir, async () => {
      if (resolve().ctx !== ctx || ctx.extractedDir !== workDir)
        throw new Error('Attached table changed while the request was queued. Reattach explicitly.');
      return fn();
    });
  }

  const context: ToolContext = {
    runTool: fn => serializeTable(sessionKey, () => withTable(fn)),
    async getActiveTable(): Promise<ActiveTableHandle | null> {
      const { ctx } = resolve();
      if (!ctx || !ctx.extractedDir) return null;
      return toHandle(ctx);
    },
    async loadActiveState(): Promise<TableState | null> {
      const { ctx } = resolve();
      if (!ctx || !ctx.extractedDir) return null;
      return loadFromWorkFolder(ctx.extractedDir);
    },
    async listWindows(): Promise<WindowSummary[]> {
      return deps.windowRegistry
        .getAll()
        .filter(c => c.hasTable() && c.window && !c.window.isDestroyed())
        .map(c => ({
          windowId: c.id,
          tableName: c.tableName,
          vpxPath: c.currentTablePath,
          isDirty: c.isTableDirty,
          isLocked: c.isTableLocked,
          attached: c.id === boundWindowId,
        }));
    },
    async attachWindow(windowId: string) {
      const ctx = deps.windowRegistry.get(windowId);
      if (!ctx || !ctx.window || ctx.window.isDestroyed()) {
        return { ok: false, error: `No editor window with id "${windowId}". Use vpx_table(action:"windows").` };
      }
      if (!ctx.hasTable()) {
        return { ok: false, error: `Window "${windowId}" has no table open.` };
      }
      boundWindowId = ctx.id;
      boundWorkDir = ctx.extractedDir;
      return { ok: true, handle: toHandle(ctx) };
    },
    async loadTable(vpxPath: string): Promise<TableState | null> {
      const resolved = path.resolve(vpxPath);
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(resolved);
      } catch {
        return null;
      }
      const hit = donorCache.get(resolved);
      if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
        donorCache.delete(resolved);
        donorCache.set(resolved, hit);
        return hit.state;
      }
      const state = await loadTableFromVpx(resolved, vpx);
      donorCache.set(resolved, { mtimeMs: stat.mtimeMs, size: stat.size, state });
      if (donorCache.size > DONOR_CACHE_MAX) {
        const oldest = donorCache.keys().next().value;
        if (oldest !== undefined) donorCache.delete(oldest);
      }
      return state;
    },
    async createTable(templateName: string, displayName: string) {
      let windowId: string | null = null;
      try {
        windowId = await deps.createTable(templateName, displayName);
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
      const ctx = windowId ? deps.windowRegistry.get(windowId) : null;
      if (!ctx || !ctx.extractedDir) {
        return { ok: false as const, error: 'Table was created but no active editor window could be found.' };
      }
      if (!(await deps.renderer.waitForTableReady(ctx.extractedDir, 30_000))) {
        return {
          ok: false as const,
          error: 'Editor did not become ready. List windows and attach after it finishes loading.',
        };
      }
      boundWindowId = ctx.id;
      boundWorkDir = ctx.extractedDir;
      return { ok: true as const, workDir: ctx.extractedDir, tableName: ctx.tableName };
    },
    async applyEdit(op: EditOperation): Promise<EditResult> {
      const { ctx, error } = resolve();
      if (!ctx) return { success: false, applied: false, error: error ?? 'No active table' };
      if (ctx.isTableLocked) {
        return {
          success: false,
          applied: false,
          error: 'Active table is locked. Unlock via Tools menu before editing.',
        };
      }
      if (op.preview) {
        return {
          success: true,
          applied: false,
          description: op.description,
          preview: { kind: op.kind, ...op.payload },
        };
      }
      return applyEditAndNotifyRenderer(ctx, op, deps, vpx);
    },
    async saveTable(): Promise<{ saved: boolean; path: string | null; error?: string }> {
      const { ctx, error } = resolve();
      if (!ctx || !ctx.extractedDir) {
        return { saved: false, path: null, error: error ?? 'No active table' };
      }
      const hadPath = !!ctx.currentTablePath;
      try {
        const result = await deps.saveTable(ctx.id);
        if (!result.saved) {
          return {
            saved: false,
            path: ctx.currentTablePath,
            error:
              result.error ??
              (hadPath ? 'Save failed — check the editor console.' : 'The user cancelled the Save dialog.'),
          };
        }
        return { saved: true, path: ctx.currentTablePath };
      } catch (err) {
        return { saved: false, path: ctx.currentTablePath, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async captureView(req: CaptureRequest): Promise<CaptureResult> {
      const { ctx, error } = resolve();
      if (!ctx || !ctx.window || ctx.window.isDestroyed()) {
        return { ok: false, error: error ?? 'No active table window' };
      }
      const result = await sendRendererRequest(deps, ctx, 'capture', {
        view: req.view,
        region: req.region,
        maxWidth: req.maxWidth,
      });
      if (result.success === true && typeof result.dataUrl === 'string') {
        return {
          ok: true,
          dataUrl: result.dataUrl,
          width: result.width as number | undefined,
          height: result.height as number | undefined,
        };
      }
      return { ok: false, error: (result.error as string) ?? 'Capture failed' };
    },
    async queryGeometry(req: GeometryRequest): Promise<Record<string, unknown>> {
      const { ctx, error } = resolve();
      if (!ctx || !ctx.window || ctx.window.isDestroyed()) {
        return { success: false, error: error ?? 'No active table window' };
      }
      return sendRendererRequest(deps, ctx, 'geometry', { parts: req.parts, region: req.region });
    },
    async exportObj(mtlFileName: string, exchange?: ObjExchangeOptions): Promise<Record<string, unknown>> {
      const { ctx, error } = resolve();
      if (!ctx || !ctx.window || ctx.window.isDestroyed()) {
        return { success: false, error: error ?? 'No active table window' };
      }
      return sendRendererRequest(deps, ctx, 'export-obj', { mtlFileName, exchange });
    },
    async importPrimitiveMesh(req: MeshImportRequest) {
      const { ctx, error } = resolve();
      if (!ctx || !ctx.extractedDir || !ctx.window || ctx.window.isDestroyed()) {
        return { ok: false as const, error: error ?? 'No active table' };
      }
      if (ctx.isTableLocked) return { ok: false as const, error: 'Active table is locked.' };
      const found = await findPrimitive(ctx.extractedDir, req.partName);
      if ('error' in found) return { ok: false as const, error: found.error };
      const vpin = await deps.initVpinModule();
      const result = await directTransaction(
        ctx,
        deps,
        `Import mesh into ${found.name}`,
        () =>
          importPrimitiveMesh(vpin, ctx.extractedDir!, found.fileName, req.filePath, {
            unit: req.unit,
            orientation: req.orientation as ObjExchangeOptions['orientation'],
            centerMesh: req.centerMesh,
            absolutePosition: req.absolutePosition,
            importMaterial: req.importMaterial,
          }),
        result => result.success
      );
      if (!result.success) return { ok: false as const, error: result.error };
      return { ok: true as const, path: result.path, materialName: result.materialName, primitive: result.primitive };
    },
    async exportPrimitiveMesh(req: MeshExportRequest) {
      const { ctx, error } = resolve();
      if (!ctx || !ctx.extractedDir) return { ok: false as const, error: error ?? 'No active table' };
      const found = await findPrimitive(ctx.extractedDir, req.partName);
      if ('error' in found) return { ok: false as const, error: found.error };
      const vpin = await deps.initVpinModule();
      try {
        const exported = await buildPrimitiveObjExport(
          vpin,
          ctx.extractedDir,
          found.fileName,
          req.exchange,
          req.mtlFileName
        );
        if (!exported) return { ok: false as const, error: `Primitive "${found.name}" has no mesh to export.` };
        return { ok: true as const, ...exported };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async playTest(opts: { seconds: number }): Promise<PlayTestResult> {
      const fail = (error: string): PlayTestResult => ({
        ok: false,
        ranSeconds: 0,
        exitCode: null,
        timedOut: false,
        earlyExit: false,
        errorLines: [],
        logTail: '',
        error,
      });
      const { ctx, error } = resolve();
      if (!ctx || !ctx.extractedDir) return fail(error ?? 'No active table');
      const vpinballPath = deps.getVpinballPath();
      if (!vpinballPath) {
        return fail('VPinballX path is not configured. Ask the user to set it in Preferences > Paths.');
      }
      try {
        const vpin = await deps.initVpinModule();
        return await runPlayTest({
          workDir: ctx.extractedDir,
          tableName: ctx.tableName ?? 'table',
          vpinballPath,
          flatpak: isRunningInFlatpak(),
          seconds: opts.seconds,
          assemble: files => vpin.assemble(files) as Uint8Array,
          log: msg => deps.log(msg, boundWindowId),
        });
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
    vpx,
    log: (msg: string) => deps.log(msg, boundWindowId),
    config: {
      get mcpPort() {
        return deps.getMcpPort();
      },
      get systemScriptsPath() {
        return deps.getSystemScriptsPath();
      },
      get glfPath() {
        return deps.getGlfPath();
      },
      get templatesPath() {
        return deps.getTemplatesPath();
      },
    },
  };
  for (const key of [
    'applyEdit',
    'importPrimitiveMesh',
    'saveTable',
    'playTest',
    'loadActiveState',
    'captureView',
    'queryGeometry',
    'exportObj',
    'exportPrimitiveMesh',
  ] as const) {
    const method = context[key] as (...args: unknown[]) => Promise<unknown>;
    Object.assign(context, { [key]: (...args: unknown[]) => withTable(() => method(...args)) });
  }
  return context;
}
