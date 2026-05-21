import type { TableState } from '../../../shared/table-state.js';
import { findItem } from '../../../shared/table-state.js';
import {
  findSubs,
  findSubsReferencingIdentifier,
  findClasses,
  findClassReferencesInText,
  findSubReferencesInText,
  type VbsSub,
  type VbsClass,
} from '../../../shared/vbs-analysis.js';

export interface ClonedSub {
  name: string;
  kind: 'sub' | 'function';
  header: string;
  body: string;
  startLine: number;
  endLine: number;
}

export interface ClonedClass {
  name: string;
  body: string;
  startLine: number;
  endLine: number;
}

export interface Bundle {
  donorPartName: string;
  partType: string;
  partData: Record<string, unknown>;
  materials: { name: string; data: Record<string, unknown> }[];
  images: { name: string; width: number | null; height: number | null }[];
  scriptSubs: ClonedSub[];
  scriptClasses: ClonedClass[];
  soundRefs: string[];
  meshFileName: string | null;
  donorOrigin: { x: number; y: number };
}

function collectMaterialRefs(data: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const keys = [
    'material',
    'rubber_material',
    'ring_material',
    'cap_material',
    'socket_material',
    'top_material',
    'side_material',
    'wire_material',
    'physics_material',
  ];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v) out.add(v);
  }
  return [...out];
}

function collectImageRefs(data: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const keys = ['image', 'image_a', 'image_b'];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v) out.add(v);
  }
  return [...out];
}

/** Sounds are referenced from VBS as string literals (PlaySound "name" and wrapper
 * subs around it), so collect every literal in the lifted script and intersect with
 * the donor's sound list. */
function collectSoundRefs(scriptText: string, sounds: TableState['sounds']): string[] {
  const literals = new Set<string>();
  for (const m of scriptText.matchAll(/"((?:[^"]|"")*)"/g)) {
    const lit = m[1].replace(/""/g, '"').trim();
    if (lit) literals.add(lit.toLowerCase());
  }
  return sounds.filter(s => literals.has(s.name.toLowerCase())).map(s => s.name);
}

export async function buildBundle(state: TableState, partName: string): Promise<Bundle | null> {
  const item = findItem(state, partName);
  if (!item) return null;

  const materialRefs = collectMaterialRefs(item.data);
  const imageRefs = collectImageRefs(item.data);

  const materials: Bundle['materials'] = state.materials
    .filter(m => materialRefs.includes(m.name))
    .map(m => ({ name: m.name, data: m as unknown as Record<string, unknown> }));

  const images: Bundle['images'] = state.images
    .filter(i => imageRefs.includes(i.name))
    .map(i => ({ name: i.name, width: i.width ?? null, height: i.height ?? null }));

  const allSubs = findSubs(state.script);
  const allClasses = findClasses(state.script);
  const allClassNames = allClasses.map(c => c.name);
  const allSubNames = allSubs.map(s => s.name);

  // Pass 1: subs that directly reference the part by name.
  const initialSubs = findSubsReferencingIdentifier(state.script, partName);
  const includedSubs = new Map<string, VbsSub>();
  for (const s of initialSubs) includedSubs.set(s.name, s);

  const includedClasses = new Map<string, VbsClass>();

  // Pass 2 (up to 2 hops): walk references from included subs/classes to other
  // subs/classes defined in this script. Each hop scans the bodies of newly-
  // included items for references and adds any matches.
  const MAX_HOPS = 2;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let changed = false;
    const bodies = [...[...includedSubs.values()].map(s => s.body), ...[...includedClasses.values()].map(c => c.body)];
    const combined = bodies.join('\n');

    for (const cls of findClassReferencesInText(combined, allClassNames)) {
      if (!includedClasses.has(cls)) {
        const def = allClasses.find(c => c.name === cls);
        if (def) {
          includedClasses.set(cls, def);
          changed = true;
        }
      }
    }
    for (const subName of findSubReferencesInText(combined, allSubNames)) {
      if (!includedSubs.has(subName)) {
        const def = allSubs.find(s => s.name === subName);
        if (def) {
          includedSubs.set(subName, def);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const scriptSubs: ClonedSub[] = [...includedSubs.values()].map(s => ({
    name: s.name,
    kind: s.kind,
    header: s.header,
    body: s.body,
    startLine: s.startLine,
    endLine: s.endLine,
  }));
  const scriptClasses: ClonedClass[] = [...includedClasses.values()].map(c => ({
    name: c.name,
    body: c.body,
    startLine: c.startLine,
    endLine: c.endLine,
  }));

  const liftedScript = [...scriptSubs.map(s => s.body), ...scriptClasses.map(c => c.body)].join('\n');
  const soundRefs = collectSoundRefs(liftedScript, state.sounds);

  const center = (item.data.center as { x: number; y: number } | undefined) ??
    (item.data.position as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };

  const meshFileName =
    item.type === 'Primitive' && item.data.use_3d_mesh === true
      ? `gameitems/${item.fileName.replace(/\.json$/, '.obj')}`
      : null;

  return {
    donorPartName: partName,
    partType: item.type,
    partData: item.data,
    materials,
    images,
    scriptSubs,
    scriptClasses,
    soundRefs,
    meshFileName,
    donorOrigin: { x: center.x, y: center.y },
  };
}
