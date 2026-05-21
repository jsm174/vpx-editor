import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileChange } from '../../shared/file-changes.js';

interface Journal {
  root: string;
  before: Map<string, Buffer | null>;
}
const current = new AsyncLocalStorage<Journal>();

async function read(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function remember(file: string): Promise<void> {
  const journal = current.getStore();
  if (!journal) return;
  const full = path.resolve(file);
  const relative = path.relative(journal.root, full);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Edit destination is outside the table work folder');
  }
  // Refuse symlink destinations, including parent directories.
  let ancestor = full;
  while (ancestor !== journal.root) {
    try {
      if ((await fs.lstat(ancestor)).isSymbolicLink()) throw new Error('Edit destination contains a symbolic link');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    ancestor = path.dirname(ancestor);
  }
  if (!journal.before.has(full)) journal.before.set(full, await read(full));
}

export async function writeEditFile(file: string, data: string | Uint8Array): Promise<void> {
  await remember(file);
  await fs.writeFile(file, data);
}

export async function unlinkEditFile(file: string): Promise<void> {
  await remember(file);
  await fs.unlink(file);
}

/** Roll back all touched files on failure, including failure to synchronize the renderer. */
export async function fileTransaction<T>(
  root: string,
  edit: () => Promise<T>,
  commit: (result: T, changes: FileChange[]) => Promise<void>
): Promise<T> {
  const journal: Journal = { root: path.resolve(root), before: new Map() };
  return current.run(journal, async () => {
    try {
      const result = await edit();
      const changes: FileChange[] = [];
      for (const [file, before] of journal.before) {
        const after = await read(file);
        if (before === null ? after === null : after !== null && before.equals(after)) continue;
        changes.push({
          path: path.relative(journal.root, file).split(path.sep).join('/'),
          before: before?.toString('base64') ?? null,
          after: after?.toString('base64') ?? null,
        });
      }
      await commit(result, changes);
      return result;
    } catch (error) {
      const failures: string[] = [];
      for (const [file, before] of [...journal.before].reverse()) {
        try {
          if (before === null) await fs.rm(file, { force: true });
          else await fs.writeFile(file, before);
        } catch (err) {
          failures.push(String(err));
        }
      }
      if (failures.length) throw new Error(`${String(error)}; rollback failed: ${failures.join('; ')}`);
      throw error;
    }
  });
}

export async function restoreFileChanges(
  root: string,
  changes: FileChange[],
  direction: 'before' | 'after'
): Promise<void> {
  if (direction !== 'before' && direction !== 'after') throw new Error('Invalid restore direction');
  await fileTransaction(
    root,
    async () => {
      for (const change of changes) {
        const file = path.resolve(root, change.path);
        const content = change[direction];
        if (content === null) {
          try {
            await unlinkEditFile(file);
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
          }
        } else {
          await writeEditFile(file, Buffer.from(content, 'base64'));
        }
      }
    },
    async () => {}
  );
}
