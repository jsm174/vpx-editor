import { loadFromWorkFolder, type TableState } from '../../../shared/table-state.js';
import type { VpxReader } from '../types.js';
import { cleanupDonor, extractVpxToTemp } from './library-assets.js';

/**
 * Load a single .vpx file into a TableState via a throwaway temp folder. Binary assets
 * (image/mesh bytes) are NOT kept after this returns; callers that need bytes re-extract
 * from the same path via library-assets helpers.
 */
export async function loadTableFromVpx(vpxPath: string, vpx: VpxReader): Promise<TableState> {
  const extracted = await extractVpxToTemp(vpxPath, vpx, 'vpx-mcp-load');
  if ('error' in extracted) throw new Error(extracted.error);
  try {
    return await loadFromWorkFolder(extracted.tempDir);
  } finally {
    await cleanupDonor(extracted.tempDir);
  }
}
