import path from 'node:path';
import { findSubs, splitLines } from '../../../shared/vbs-analysis.js';
import { getPlayfieldBounds, summarizeCounts, type TableState } from '../../../shared/table-state.js';

const NAMES_PER_TYPE_CAP = 200;
const ASSET_NAMES_CAP = 150;
const SUBS_CAP = 300;

function capped(names: string[], cap: number): { names: string[]; omitted?: number } {
  if (names.length <= cap) return { names };
  return { names: names.slice(0, cap), omitted: names.length - cap };
}

export function summarizeDonorTable(state: TableState, tablePath: string) {
  const partsByType: Record<string, ReturnType<typeof capped>> = {};
  const grouped = new Map<string, string[]>();
  for (const item of state.items) {
    const list = grouped.get(item.type) ?? [];
    list.push(item.name);
    grouped.set(item.type, list);
  }
  for (const [type, names] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
    partsByType[type] = capped(names, NAMES_PER_TYPE_CAP);
  }

  const subs = findSubs(state.script);

  return {
    tablePath,
    tableName: state.info.table_name || path.basename(tablePath, '.vpx'),
    info: {
      author: state.info.author_name ?? null,
      version: state.info.table_version ?? null,
      blurb: state.info.table_blurb ?? null,
      saveDate: state.info.table_save_date ?? null,
    },
    playfieldBounds: getPlayfieldBounds(state),
    partCounts: summarizeCounts(state),
    partsByType,
    collections: state.collections.map(c => ({
      name: c.name,
      fireEvents: c.fire_events ?? false,
      items: c.items ?? [],
    })),
    materials: {
      total: state.materials.length,
      ...capped(
        state.materials.map(m => m.name),
        ASSET_NAMES_CAP
      ),
    },
    images: {
      total: state.images.length,
      entries: state.images.slice(0, ASSET_NAMES_CAP).map(i => ({ name: i.name, width: i.width, height: i.height })),
      ...(state.images.length > ASSET_NAMES_CAP ? { omitted: state.images.length - ASSET_NAMES_CAP } : {}),
    },
    sounds: {
      total: state.sounds.length,
      ...capped(
        state.sounds.map(s => s.name),
        ASSET_NAMES_CAP
      ),
    },
    script: {
      sizeBytes: state.script.length,
      lineCount: splitLines(state.script).length,
      subs: subs.slice(0, SUBS_CAP).map(s => ({ kind: s.kind, name: s.name, lines: [s.startLine, s.endLine] })),
      ...(subs.length > SUBS_CAP ? { subsOmitted: subs.length - SUBS_CAP } : {}),
    },
    nextSteps:
      'Study deeper with vpx_library: get_script (subName / pattern / line range) to read how parts are wired, ' +
      'extract_bundle for a part + everything it references, get_image for textures, clone to copy a part into the active table.',
  };
}
