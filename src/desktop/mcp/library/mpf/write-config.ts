import fs from 'fs-extra';
import path from 'node:path';
import { serializeMpf, type MpfConfig } from './from-table.js';

/** The MPF config lives in `glf_mpf/config/` next to the .vpx (darkchaos layout) so it can go straight to a real machine. */
export function mpfConfigDir(handle: { vpxPath: string | null }): string | null {
  return handle.vpxPath ? path.join(path.dirname(handle.vpxPath), 'glf_mpf', 'config') : null;
}

export const MPF_NEEDS_SAVED_TABLE =
  'The table has not been saved, so there is no folder to write the MPF config next to. Save with vpx_save first, then run vpx_mpf(action:"generate").';

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
