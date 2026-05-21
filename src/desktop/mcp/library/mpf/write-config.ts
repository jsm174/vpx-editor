import fs from 'fs-extra';
import path from 'node:path';
import { serializeMpf, type MpfConfig } from './from-table.js';

/**
 * Where the MPF config lives for a table: a `glf_mpf/config/` folder next to the .vpx
 * (darkchaos layout) so it's ready to take to a real machine. For an unsaved table the
 * .vpx path is null, so it falls back to the table's work folder.
 */
export function mpfConfigDir(handle: { vpxPath: string | null; workDir: string }): string {
  const base = handle.vpxPath ? path.dirname(handle.vpxPath) : handle.workDir;
  return path.join(base, 'glf_mpf', 'config');
}

export async function writeMpfConfig(dir: string, cfg: MpfConfig): Promise<string[]> {
  await fs.ensureDir(dir);
  const files = serializeMpf(cfg);
  const written: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    await fs.writeFile(full, content);
    written.push(full);
  }
  return written;
}
