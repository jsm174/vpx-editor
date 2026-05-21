import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createToolContext, resolveSaveTarget, type ContextDeps } from './context.js';
import type { WindowContext, WindowRegistry } from '../window-context.js';
import type { EditOperation } from './types.js';

vi.mock('../vpx-operations.js', () => ({ isRunningInFlatpak: () => false }));

let root: string;
let win: WindowContext;
let windows: Map<string, WindowContext>;
let deps: ContextDeps;
const material = (name: string): EditOperation => ({
  kind: 'add-material',
  payload: { material: { name } },
  description: `add ${name}`,
});

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-context-'));
  win = {
    id: 'first',
    extractedDir: root,
    tableGeneration: 0,
    isTableLocked: false,
    mcpEditBusy: false,
    window: { isDestroyed: () => false, webContents: { send: vi.fn() } },
    hasTable: () => !!win.extractedDir,
    markDirty: vi.fn(),
  } as unknown as WindowContext;
  windows = new Map([[win.id, win]]);
  deps = {
    windowRegistry: {
      get: (id: string) => windows.get(id),
      getAll: () => [...windows.values()],
      getFocused: () => [...windows.values()][0],
    } as unknown as WindowRegistry,
    renderer: { request: vi.fn(async () => ({ success: true })), waitForTableReady: async () => true },
    log: vi.fn(),
    getSystemScriptsPath: () => null,
    getGlfPath: () => null,
    getTemplatesPath: () => null,
    getMcpPort: () => 0,
    getVpinballPath: () => null,
    initVpinModule: vi.fn(),
    createTable: vi.fn(),
    saveTable: vi.fn(),
  };
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it('retains both concurrent edits across independent sessions and waits for acknowledgment', async () => {
  let release!: () => void;
  let entered!: () => void;
  const enteredCommit = new Promise<void>(r => {
    entered = r;
  });
  const gate = new Promise<void>(r => {
    release = r;
  });
  let commits = 0;
  deps.renderer.request = vi.fn(async (_win, kind) => {
    if (kind === 'edit-commit' && ++commits === 1) {
      entered();
      await gate;
    }
    return { success: true };
  });
  const a = createToolContext(deps),
    b = createToolContext(deps);
  let finished = false;
  const first = a.applyEdit(material('one')).then(r => {
    finished = true;
    return r;
  });
  await enteredCommit;
  const second = b.applyEdit(material('two'));
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(commits).toBe(1);
  release();
  expect((await Promise.all([first, second])).every(r => r.success)).toBe(true);
  expect(
    JSON.parse(await fs.readFile(path.join(root, 'materials.json'), 'utf-8')).map((m: { name: string }) => m.name)
  ).toEqual(['one', 'two']);
});

it('keeps planning and nested context calls inside the shared table queue', async () => {
  const a = createToolContext(deps),
    b = createToolContext(deps);
  const events: string[] = [];
  await Promise.all(
    [a, b].map((ctx, i) =>
      ctx.runTool!(async () => {
        events.push(`start${i}`);
        await ctx.applyEdit(material(String(i)));
        events.push(`end${i}`);
      })
    )
  );
  expect(events).toEqual(['start0', 'end0', 'start1', 'end1']);
});

it('remains detached after the bound window closes until explicitly attached', async () => {
  const ctx = createToolContext(deps);
  expect((await ctx.getActiveTable())?.windowId).toBe('first');
  windows.delete('first');
  windows.set('second', { ...win, id: 'second' } as WindowContext);
  expect(await ctx.getActiveTable()).toBeNull();
  expect(await ctx.getActiveTable()).toBeNull();
  expect((await ctx.applyEdit(material('wrong'))).success).toBe(false);
  expect(deps.renderer.request).not.toHaveBeenCalled();
  expect((await ctx.attachWindow('second')).ok).toBe(true);
  expect((await ctx.applyEdit(material('right'))).success).toBe(true);
});

it('requires reattachment when a different table occupies the same window', async () => {
  const ctx = createToolContext(deps);
  await ctx.getActiveTable();
  win.extractedDir = `${root}/replacement`;
  win.tableGeneration++;
  expect(await ctx.getActiveTable()).toBeNull();
  expect((await ctx.applyEdit(material('wrong'))).success).toBe(false);
});

it('keeps every attached session after Save As moves the work folder', async () => {
  vi.mocked(deps.createTable).mockResolvedValue(win.id);
  const ctx = createToolContext(deps),
    other = createToolContext(deps);
  expect((await ctx.createTable('blank', 'New table')).ok).toBe(true);
  expect((await other.attachWindow(win.id)).ok).toBe(true);
  expect((await ctx.runTool!(() => ctx.applyEdit(material('before save')))).success).toBe(true);
  const savedDir = path.join(root, 'saved');
  vi.mocked(deps.saveTable).mockImplementation(async () => {
    await fs.mkdir(savedDir);
    await fs.copyFile(path.join(root, 'materials.json'), path.join(savedDir, 'materials.json'));
    win.extractedDir = savedDir;
    win.currentTablePath = path.join(root, 'New table.vpx');
    return { saved: true };
  });
  expect((await ctx.runTool!(() => ctx.saveTable())).saved).toBe(true);
  expect((await ctx.getActiveTable())?.workDir).toBe(savedDir);
  expect((await other.getActiveTable())?.workDir).toBe(savedDir);
  expect((await ctx.runTool!(() => ctx.applyEdit(material('after save')))).success).toBe(true);
  expect((await other.runTool!(() => other.applyEdit(material('other after save')))).success).toBe(true);
  expect(
    JSON.parse(await fs.readFile(path.join(savedDir, 'materials.json'), 'utf-8')).map((m: { name: string }) => m.name)
  ).toEqual(['before save', 'after save', 'other after save']);
});

it('rejects queued edits after the table closes', async () => {
  const a = createToolContext(deps),
    b = createToolContext(deps);
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(r => {
    release = r;
  });
  const entered = new Promise<void>(r => {
    started = r;
  });
  const first = a.runTool!(async () => {
    started();
    await gate;
  });
  await entered;
  const second = b.applyEdit(material('wrong'));
  windows.clear();
  release();
  await first;
  await expect(second).rejects.toThrow('changed');
  expect(deps.renderer.request).not.toHaveBeenCalled();
});

it('checks the table lock before writing any part of a compound GLF edit', async () => {
  win.isTableLocked = true;
  const result = await createToolContext(deps).applyEdit({
    kind: 'edit-script',
    description: 'GLF',
    payload: {
      mode: 'replace',
      content: 'new',
      glfSwitches: ['Scoop'],
    },
  });
  expect(result.success).toBe(false);
  expect(await fs.readdir(root)).toEqual([]);
  expect(deps.renderer.request).not.toHaveBeenCalled();
});

it('rolls back writes and releases the editor after renderer failure', async () => {
  deps.renderer.request = vi.fn(async (_win, kind) =>
    kind === 'edit-commit' ? { success: false, error: 'renderer failed' } : { success: true }
  );
  expect(await createToolContext(deps).applyEdit(material('failed'))).toMatchObject({
    success: false,
    error: expect.stringContaining('renderer failed'),
  });
  await expect(fs.access(path.join(root, 'materials.json'))).rejects.toThrow();
  expect(win.mcpEditBusy).toBe(false);
  expect(win.markDirty).not.toHaveBeenCalled();
  expect(vi.mocked(deps.renderer.request).mock.calls.map(c => c[1])).toEqual([
    'edit-begin',
    'edit-commit',
    'edit-abort',
    'edit-end',
  ]);
});

it('flushes pending script-editor saves before beginning a disk transaction', async () => {
  win.scriptEditorWindow = {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  } as unknown as WindowContext['scriptEditorWindow'];
  await createToolContext(deps).applyEdit(material('after flush'));
  expect(vi.mocked(deps.renderer.request).mock.calls.map(c => c[1])).toEqual([
    'edit-flush',
    'edit-begin',
    'edit-commit',
    'edit-end',
  ]);
  expect(win.mcpEditBusy).toBe(false);
  expect(win.mcpEditWriting).toBe(false);
});

it('does not overwrite files when pending manual script changes cannot be saved', async () => {
  win.scriptEditorWindow = {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  } as unknown as WindowContext['scriptEditorWindow'];
  deps.renderer.request = vi.fn(async (_win, kind) =>
    kind === 'edit-flush' ? { success: false, error: 'manual save failed' } : { success: true }
  );
  expect(await createToolContext(deps).applyEdit(material('wrong'))).toMatchObject({
    success: false,
    error: expect.stringContaining('manual save failed'),
  });
  expect(await fs.readdir(root)).toEqual([]);
  expect(win.mcpEditBusy).toBe(false);
  expect(win.mcpEditWriting).toBe(false);
});

it('resolves a save target folder to <TableName>.vpx and rejects relative paths', () => {
  expect(resolveSaveTarget('/work/tables', 'My Machine')).toEqual({
    path: path.join('/work/tables', 'My Machine.vpx'),
  });
  expect(resolveSaveTarget('/work/tables/custom.VPX', 'My Machine')).toEqual({
    path: path.join('/work/tables', 'custom.VPX'),
  });
  expect(resolveSaveTarget('/work/tables', null)).toEqual({ path: path.join('/work/tables', 'untitled.vpx') });
  expect(resolveSaveTarget('tables', 'My Machine')).toHaveProperty('error');
});

it('passes a resolved save target to the editor and reports the new path', async () => {
  vi.mocked(deps.createTable).mockResolvedValue(win.id);
  const ctx = createToolContext(deps);
  expect((await ctx.createTable('blank', 'New table')).ok).toBe(true);
  win.tableName = 'New table';
  const target = path.join(root, 'out');
  vi.mocked(deps.saveTable).mockImplementation(async (_id, targetPath) => {
    win.currentTablePath = targetPath ?? null;
    return { saved: true };
  });
  const result = await ctx.runTool!(() => ctx.saveTable(target));
  expect(deps.saveTable).toHaveBeenCalledWith(win.id, path.join(target, 'New table.vpx'));
  expect(result).toEqual({ saved: true, path: path.join(target, 'New table.vpx') });
  expect((await ctx.runTool!(() => ctx.saveTable('relative/dir'))).error).toMatch(/absolute path/);
});
