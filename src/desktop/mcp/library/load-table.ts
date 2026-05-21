import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { loadFromWorkFolder, type TableState } from '../../../shared/table-state.js';
import type { VpxReader } from '../types.js';

const ROOT_PREFIX = '/vpx/';

/**
 * Load a single .vpx file into a TableState on demand. Extracts the binary to a
 * throwaway temp folder, reads it fully into memory via loadFromWorkFolder, then
 * removes the temp folder. Replaces the old SQLite corpus index — donor parts are
 * read one table at a time, not from a pre-built index.
 *
 * Binary assets (image/mesh bytes) are NOT kept after this returns; callers that
 * need bytes re-extract from the same path via library-assets helpers.
 */
export async function loadTableFromVpx(vpxPath: string, vpx: VpxReader): Promise<TableState> {
  const buffer = await fs.promises.readFile(vpxPath);
  const workDir = path.join(os.tmpdir(), `vpx-mcp-load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.promises.mkdir(workDir, { recursive: true });
  try {
    const files = await vpx.extract(new Uint8Array(buffer));
    for (const [filePath, data] of Object.entries(files)) {
      const relative = filePath.startsWith(ROOT_PREFIX) ? filePath.slice(ROOT_PREFIX.length) : filePath;
      const full = path.join(workDir, relative);
      await fs.promises.mkdir(path.dirname(full), { recursive: true });
      await fs.promises.writeFile(full, data);
    }
    return await loadFromWorkFolder(workDir);
  } finally {
    try {
      await fs.promises.rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
  }
}
