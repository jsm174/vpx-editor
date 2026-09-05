import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileTransaction, restoreFileChanges, writeEditFile } from './file-transaction.js';
import { applyEditDirect } from './edit-handler.js';
import { UndoRecord } from '../../editor/undo/undo-record.js';
import type { FileChange } from '../../shared/file-changes.js';
import type { EditOperation } from './types.js';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-transaction-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function edit(op: EditOperation): Promise<FileChange[]> {
  let files: FileChange[] = [];
  await fileTransaction(
    root,
    () => applyEditDirect({ workDir: root }, op),
    async (result, changes) => {
      if (!result.success) throw new Error(result.error);
      files = changes;
    }
  );
  return files;
}

describe('file transactions', () => {
  it.each(['image', 'sound'] as const)(
    'restores %s bytes and metadata through replace, delete, undo and redo',
    async kind => {
      const add = await edit({
        kind: `add-${kind}`,
        payload: { name: 'asset', source: { base64: Buffer.from([0, 255, 7]).toString('base64') } },
        description: 'add',
      });
      const binary = add.find(c => c.path.startsWith(`${kind}s/`))!;
      const original = await fs.readFile(path.join(root, binary.path));
      const modified = await edit({
        kind: `modify-${kind}`,
        payload: { name: 'asset', source: { base64: Buffer.from('replacement').toString('base64') } },
        description: 'replace',
      });
      // Undo state survives the editor's persistence format without losing binary data.
      const record = new UndoRecord('replace');
      record.fileChanges = modified;
      const restored = UndoRecord.fromJSON(JSON.parse(JSON.stringify(record.toJSON())));
      await restoreFileChanges(root, restored.fileChanges!, 'before');
      expect(await fs.readFile(path.join(root, binary.path))).toEqual(original);
      await restoreFileChanges(root, restored.fileChanges!, 'after');
      expect(await fs.readFile(path.join(root, binary.path), 'utf-8')).toBe('replacement');
      const deleted = await edit({ kind: `delete-${kind}`, payload: { name: 'asset' }, description: 'delete' });
      await expect(fs.access(path.join(root, binary.path))).rejects.toThrow();
      await restoreFileChanges(root, deleted, 'before');
      expect(await fs.readFile(path.join(root, binary.path), 'utf-8')).toBe('replacement');
      expect(JSON.parse(await fs.readFile(path.join(root, `${kind}s.json`), 'utf-8'))).toHaveLength(1);
      await restoreFileChanges(root, deleted, 'after');
      await expect(fs.access(path.join(root, binary.path))).rejects.toThrow();
      expect(JSON.parse(await fs.readFile(path.join(root, `${kind}s.json`), 'utf-8'))).toEqual([]);
    }
  );

  it('rolls back all files when the renderer rejects the commit', async () => {
    await fs.writeFile(path.join(root, 'script.vbs'), 'old');
    await expect(
      fileTransaction(
        root,
        async () => {
          await writeEditFile(path.join(root, 'script.vbs'), 'new');
          await writeEditFile(path.join(root, 'collections.json'), '[]');
        },
        async () => {
          throw new Error('renderer closed');
        }
      )
    ).rejects.toThrow('renderer closed');
    expect(await fs.readFile(path.join(root, 'script.vbs'), 'utf-8')).toBe('old');
    await expect(fs.access(path.join(root, 'collections.json'))).rejects.toThrow();
  });

  it('rolls back a partial GLF edit if writing the script fails', async () => {
    await fs.writeFile(path.join(root, 'collections.json'), '[]');
    await fs.mkdir(path.join(root, 'script.vbs'));
    await expect(
      edit({
        kind: 'edit-script',
        payload: { mode: 'replace', content: 'new', glfSwitches: ['Scoop'] },
        description: 'wire',
      })
    ).rejects.toThrow();
    expect(await fs.readFile(path.join(root, 'collections.json'), 'utf-8')).toBe('[]');
  });

  it('records GLF script and collection membership as one reversible edit', async () => {
    await fs.writeFile(path.join(root, 'collections.json'), '[]');
    await fs.writeFile(path.join(root, 'script.vbs'), 'old');
    const changes = await edit({
      kind: 'edit-script',
      payload: { mode: 'replace', content: 'new', expectedScript: 'old', glfSwitches: ['Scoop'] },
      description: 'wire',
    });
    expect(changes.map(c => c.path).sort()).toEqual(['collections.json', 'script.vbs']);
    await restoreFileChanges(root, changes, 'before');
    expect(await fs.readFile(path.join(root, 'script.vbs'), 'utf-8')).toBe('old');
    expect(JSON.parse(await fs.readFile(path.join(root, 'collections.json'), 'utf-8'))).toEqual([]);
    await restoreFileChanges(root, changes, 'after');
    expect(JSON.parse(await fs.readFile(path.join(root, 'collections.json'), 'utf-8'))[0].items).toEqual(['Scoop']);
  });

  it('rejects a stale script plan before changing collections', async () => {
    await fs.writeFile(path.join(root, 'collections.json'), '[]');
    await fs.writeFile(path.join(root, 'script.vbs'), 'manual edit');
    await expect(
      edit({
        kind: 'edit-script',
        payload: { mode: 'replace', content: 'new', expectedScript: 'old', glfSwitches: ['Scoop'] },
        description: 'wire',
      })
    ).rejects.toThrow('Script changed');
    expect(await fs.readFile(path.join(root, 'collections.json'), 'utf-8')).toBe('[]');
  });

  it.each(['../outside', '..\\outside', '/absolute', 'bad:name', 'NUL', 'trailing.'])(
    'rejects unsafe sound name %s',
    async name => {
      await expect(
        edit({ kind: 'add-sound', payload: { name, source: { base64: 'AA==' } }, description: 'add' })
      ).rejects.toThrow('Sound name');
      expect(await fs.readdir(root)).toEqual([]);
    }
  );

  it('rejects symlink destinations without changing their targets', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'test.wav'), 'original');
      await fs.symlink(outside, path.join(root, 'sounds'));
      await expect(
        edit({ kind: 'add-sound', payload: { name: 'test', source: { base64: 'AA==' } }, description: 'add' })
      ).rejects.toThrow('symbolic link');
      expect(await fs.readFile(path.join(outside, 'test.wav'), 'utf-8')).toBe('original');
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects unsafe restored paths and rolls back earlier files', async () => {
    await fs.writeFile(path.join(root, 'script.vbs'), 'original');
    await expect(
      restoreFileChanges(
        root,
        [
          { path: 'script.vbs', before: null, after: Buffer.from('changed').toString('base64') },
          { path: '../outside.wav', before: null, after: 'AA==' },
        ],
        'after'
      )
    ).rejects.toThrow('outside');
    expect(await fs.readFile(path.join(root, 'script.vbs'), 'utf-8')).toBe('original');
  });
});
