import fs from 'fs-extra';
import path from 'node:path';
import { generateUniqueFileName } from '../../shared/gameitem-utils.js';
import type { EditOperation, EditResult, VpxReader } from './types.js';
import type { GameItemRef } from '../../shared/table-state.js';
import { buildBundle } from './library/bundle.js';
import { retargetPart } from '../../shared/geometry.js';
import { getDefaultMaterial, validateMaterialFields } from '../../shared/material-defaults.js';
import type { TableState } from '../../shared/table-state.js';
import { extractDonorAssets, cleanupDonor, type DonorAssetSet } from './library/library-assets.js';

export interface DirectEditDeps {
  workDir: string;
  vpx?: VpxReader;
}

const IMAGE_REF_KEYS = ['image', 'image_a', 'image_b'];
const MATERIAL_REF_KEYS = [
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

async function readGameitems(workDir: string): Promise<GameItemRef[]> {
  try {
    const content = await fs.promises.readFile(path.join(workDir, 'gameitems.json'), 'utf-8');
    return JSON.parse(content) as GameItemRef[];
  } catch {
    return [];
  }
}

async function writeGameitems(workDir: string, items: GameItemRef[]): Promise<void> {
  await fs.promises.writeFile(path.join(workDir, 'gameitems.json'), JSON.stringify(items, null, 2));
}

async function findGameItem(
  workDir: string,
  partName: string
): Promise<{ ref: GameItemRef; type: string; data: Record<string, unknown> } | null> {
  const refs = await readGameitems(workDir);
  const lower = partName.toLowerCase();
  for (const ref of refs) {
    if (!ref.file_name) continue;
    try {
      const raw = await fs.promises.readFile(path.join(workDir, 'gameitems', ref.file_name), 'utf-8');
      const wrapper = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      const type = Object.keys(wrapper)[0];
      const data = wrapper[type];
      if (typeof data?.name === 'string' && data.name.toLowerCase() === lower) {
        return { ref, type, data };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function writeGameItemFile(
  workDir: string,
  fileName: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  const fullPath = path.join(workDir, 'gameitems', fileName);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, JSON.stringify({ [type]: data }, null, 2));
}

// Direct-write part ops receive raw vpin-shaped data. The tool layer's `position`
// convenience field is only translated to the real anchor fields by the renderer
// roundtrip — if it reaches here, the part would land at the vpin defaults.
function positionGuard(data: Record<string, unknown> | undefined): EditResult | null {
  if (data && 'position' in data) {
    return {
      success: false,
      applied: false,
      error:
        "Part data contains a `position` field, which only the editor window can translate to the part's real anchor fields. Open the table in an editor window, or supply the vpin fields (center/x/y) directly.",
    };
  }
  return null;
}

async function applyModifyPart(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const partName = payload.name as string;
  const patch = payload.patch as Record<string, unknown>;
  const guarded = positionGuard(patch);
  if (guarded) return guarded;
  const found = await findGameItem(workDir, partName);
  if (!found) return { success: false, applied: false, error: `Part not found: ${partName}` };
  const merged = { ...found.data, ...patch };
  await writeGameItemFile(workDir, found.ref.file_name, found.type, merged);
  return {
    success: true,
    applied: true,
    description: `Modified ${found.type} "${partName}" (${Object.keys(patch).length} fields)`,
  };
}

async function applyAddPart(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const type = payload.type as string;
  const data = payload.data as Record<string, unknown>;
  const name = data.name as string;
  if (!name) return { success: false, applied: false, error: 'New part must include a "name" field' };
  const guarded = positionGuard(data);
  if (guarded) return guarded;
  const refs = await readGameitems(workDir);
  const fileName = generateUniqueFileName(type, name, refs.map(r => r.file_name).filter(Boolean));
  refs.push({
    file_name: fileName,
    is_locked: false,
    editor_layer: 0,
    editor_layer_name: 'Layer_1',
    editor_layer_visibility: true,
  });
  await writeGameitems(workDir, refs);
  await writeGameItemFile(workDir, fileName, type, data);
  return { success: true, applied: true, description: `Added ${type} "${name}" (${fileName})` };
}

async function applyDeletePart(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const partName = payload.name as string;
  const found = await findGameItem(workDir, partName);
  if (!found) return { success: false, applied: false, error: `Part not found: ${partName}` };
  const refs = await readGameitems(workDir);
  const remaining = refs.filter(r => r.file_name !== found.ref.file_name);
  await writeGameitems(workDir, remaining);
  try {
    await fs.promises.unlink(path.join(workDir, 'gameitems', found.ref.file_name));
  } catch {
    // ignore unlink failure
  }
  return { success: true, applied: true, description: `Deleted ${found.type} "${partName}"` };
}

async function applyEditScript(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const mode = payload.mode as string;
  const content = payload.content as string;
  const scriptPath = path.join(workDir, 'script.vbs');
  let existing = '';
  try {
    existing = await fs.promises.readFile(scriptPath, 'utf-8');
  } catch {
    // file may not exist; treat as empty
  }
  let next = existing;
  if (mode === 'replace') next = content;
  else if (mode === 'append') next = existing + (existing.endsWith('\n') ? '' : '\n') + content;
  else if (mode === 'prepend') next = content + (content.endsWith('\n') ? '' : '\n') + existing;
  await fs.promises.writeFile(scriptPath, next);
  const detail = mode === 'replace' ? '' : `: ${previewSnippet(content)}`;
  return { success: true, applied: true, description: `Script ${mode} (${content.length} chars)${detail}` };
}

async function applyReplaceScriptString(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const oldString = payload.oldString as string;
  const newString = payload.newString as string;
  if (!oldString) return { success: false, applied: false, error: 'oldString must be non-empty' };
  const scriptPath = path.join(workDir, 'script.vbs');
  let existing = '';
  try {
    existing = await fs.promises.readFile(scriptPath, 'utf-8');
  } catch {
    return { success: false, applied: false, error: 'No script.vbs in work folder' };
  }
  const occurrences = existing.split(oldString).length - 1;
  if (occurrences === 0) {
    return {
      success: false,
      applied: false,
      error: 'oldString not found in script. Use vpx_script(action:"search") first to locate the exact text.',
    };
  }
  if (occurrences > 1) {
    return {
      success: false,
      applied: false,
      error: `oldString matches ${occurrences} places — make it unique (add surrounding context) or use vpx_script(action:"replace_sub") for a Sub/Function.`,
    };
  }
  const next = existing.split(oldString).join(newString);
  await fs.promises.writeFile(scriptPath, next);
  return {
    success: true,
    applied: true,
    description: `Script string replaced (${oldString.length}→${newString.length} chars): ${previewSnippet(oldString)} → ${previewSnippet(newString)}`,
  };
}

function detectEol(text: string): string {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/\n/g) ?? []).length - crlf;
  return crlf > lf ? '\r\n' : '\n';
}

function previewSnippet(s: string, max = 60): string {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return JSON.stringify(collapsed);
  return JSON.stringify(collapsed.slice(0, max) + '…');
}

async function applyReplaceScriptRange(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const startLine = payload.startLine as number;
  const endLine = payload.endLine as number;
  const content = (payload.content as string) ?? '';
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
    return { success: false, applied: false, error: 'startLine and endLine must be integers (1-based, inclusive)' };
  }
  if (startLine < 1 || endLine < startLine) {
    return {
      success: false,
      applied: false,
      error: `Invalid range ${startLine}..${endLine} — must satisfy 1 <= startLine <= endLine`,
    };
  }
  const { splitLines } = await import('../../shared/vbs-analysis.js');
  const scriptPath = path.join(workDir, 'script.vbs');
  let existing = '';
  try {
    existing = await fs.promises.readFile(scriptPath, 'utf-8');
  } catch {
    return { success: false, applied: false, error: 'No script.vbs in work folder' };
  }
  const lines = splitLines(existing);
  if (endLine > lines.length) {
    return { success: false, applied: false, error: `endLine ${endLine} exceeds script length ${lines.length}` };
  }
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const replacement = content === '' ? [] : splitLines(content);
  const next = [...before, ...replacement, ...after].join(detectEol(existing));
  await fs.promises.writeFile(scriptPath, next);
  const removed = endLine - startLine + 1;
  return {
    success: true,
    applied: true,
    description:
      replacement.length === 0
        ? `Deleted lines ${startLine}-${endLine} (${removed} lines)`
        : `Replaced lines ${startLine}-${endLine} (${removed} → ${replacement.length} lines)`,
  };
}

async function applyReplaceSub(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const subName = payload.subName as string;
  const newBody = payload.newBody as string;
  if (!subName) return { success: false, applied: false, error: 'subName required' };
  const { findSubs, splitLines } = await import('../../shared/vbs-analysis.js');
  const scriptPath = path.join(workDir, 'script.vbs');
  let existing = '';
  try {
    existing = await fs.promises.readFile(scriptPath, 'utf-8');
  } catch {
    return { success: false, applied: false, error: 'No script.vbs in work folder' };
  }
  const subs = findSubs(existing);
  const matches = subs.filter(s => s.name.toLowerCase() === subName.toLowerCase());
  if (matches.length === 0) {
    return {
      success: false,
      applied: false,
      error: `Sub/Function "${subName}" not found. Existing subs: ${subs
        .map(s => s.name)
        .join(', ')
        .slice(0, 200)}`,
    };
  }
  if (matches.length > 1) {
    return {
      success: false,
      applied: false,
      error: `Multiple Sub/Functions named "${subName}" found (lines ${matches.map(m => m.startLine).join(', ')}) — fix the duplicate first.`,
    };
  }
  const sub = matches[0];
  const lines = splitLines(existing);
  const before = lines.slice(0, sub.startLine - 1);
  const after = lines.slice(sub.endLine);
  const next = [...before, ...splitLines(newBody), ...after].join(detectEol(existing));
  await fs.promises.writeFile(scriptPath, next);
  return {
    success: true,
    applied: true,
    description: `Replaced ${sub.kind} ${sub.name} (lines ${sub.startLine}-${sub.endLine}, ${newBody.length} chars)`,
  };
}

async function readMaterials(workDir: string): Promise<Record<string, unknown>[]> {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(workDir, 'materials.json'), 'utf-8')) as Record<
      string,
      unknown
    >[];
  } catch {
    return [];
  }
}

async function writeMaterials(workDir: string, materials: Record<string, unknown>[]): Promise<void> {
  await fs.promises.writeFile(path.join(workDir, 'materials.json'), JSON.stringify(materials, null, 2));
}

async function applyAddMaterial(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const material = payload.material as Record<string, unknown>;
  const name = material.name as string;
  if (!name) return { success: false, applied: false, error: 'Material must include a "name" field' };
  const invalid = validateMaterialFields(material);
  if (invalid) return { success: false, applied: false, error: invalid };
  const materials = await readMaterials(workDir);
  if (materials.some(m => (m.name as string).toLowerCase() === name.toLowerCase())) {
    return { success: false, applied: false, error: `Material already exists: ${name}` };
  }
  materials.push({ ...getDefaultMaterial(), ...material });
  await writeMaterials(workDir, materials);
  return { success: true, applied: true, description: `Added material "${name}"` };
}

async function applyModifyMaterial(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  const patch = payload.patch as Record<string, unknown>;
  const invalid = validateMaterialFields(patch);
  if (invalid) return { success: false, applied: false, error: invalid };
  const materials = await readMaterials(workDir);
  const idx = materials.findIndex(m => (m.name as string).toLowerCase() === name.toLowerCase());
  if (idx === -1) return { success: false, applied: false, error: `Material not found: ${name}` };
  materials[idx] = { ...getDefaultMaterial(), ...materials[idx], ...patch };
  await writeMaterials(workDir, materials);
  return { success: true, applied: true, description: `Modified material "${name}"` };
}

interface DecodedImageSource {
  bytes: Buffer;
  ext: string;
}

async function decodeImageSource(source: Record<string, unknown>): Promise<DecodedImageSource | { error: string }> {
  if (typeof source.path === 'string') {
    const bytes = await fs.promises.readFile(source.path);
    const ext = (path.extname(source.path) || '.png').toLowerCase();
    return { bytes, ext };
  }
  if (typeof source.base64 === 'string') {
    const bytes = Buffer.from(source.base64, 'base64');
    const mime = (source.mimeType as string) ?? 'image/png';
    const ext = mime.includes('jpeg') ? '.jpg' : mime.includes('webp') ? '.webp' : '.png';
    return { bytes, ext };
  }
  if (source.libraryRef && typeof source.libraryRef === 'object') {
    return { error: 'libraryRef image source not yet implemented' };
  }
  return { error: 'Invalid image source. Use {path}, {base64}, or {libraryRef}.' };
}

interface ImageEntry {
  name: string;
  path?: string;
  internal_name?: string;
  name_dedup?: string;
  [k: string]: unknown;
}

// vpin's read_images resolves the disk file as images/{name_dedup ?? name}.{ext-from-path},
// and the editor's image manager probes images/{name}{ext} — both use the RAW name, so the
// file must be named by it (illegal filename characters stripped, recorded via name_dedup).
function sanitizeImageFileBase(name: string): string {
  return name.replace(/[/\\?<>:*|"\u0000-\u001f]/g, '').trim();
}

function imageFileCandidates(entry: ImageEntry): string[] {
  const out: string[] = [];
  const ext = entry.path ? path.extname(entry.path) : '';
  const base = entry.name_dedup ?? entry.name;
  if (base && ext) out.push(`${base}${ext}`);
  if (entry.internal_name) out.push(entry.internal_name);
  return [...new Set(out)];
}

async function readImagesJson(workDir: string): Promise<ImageEntry[]> {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(workDir, 'images.json'), 'utf-8')) as ImageEntry[];
  } catch {
    return [];
  }
}

async function unlinkImageFiles(workDir: string, entry: ImageEntry): Promise<void> {
  for (const candidate of imageFileCandidates(entry)) {
    try {
      await fs.promises.unlink(path.join(workDir, 'images', candidate));
    } catch {
      // best effort
    }
  }
}

async function applyAddImage(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  const source = payload.source as Record<string, unknown>;
  if (!name) return { success: false, applied: false, error: 'Image must have a name' };

  const decoded = await decodeImageSource(source);
  if ('error' in decoded) return { success: false, applied: false, error: decoded.error };

  const images = await readImagesJson(workDir);
  if (images.some(i => i.name.toLowerCase() === name.toLowerCase())) {
    return {
      success: false,
      applied: false,
      error: `Image "${name}" already exists. Use vpx_image(action:"modify") to replace its bytes, or vpx_image(action:"delete") first.`,
    };
  }

  const base = sanitizeImageFileBase(name);
  if (!base) return { success: false, applied: false, error: `Image name "${name}" has no filesystem-safe characters` };
  const fileName = `${base}${decoded.ext}`;
  const imagesDir = path.join(workDir, 'images');
  await fs.promises.mkdir(imagesDir, { recursive: true });
  await fs.promises.writeFile(path.join(imagesDir, fileName), decoded.bytes);
  const entry: ImageEntry = { name, path: fileName };
  if (base !== name) entry.name_dedup = base;
  images.push(entry);
  await fs.promises.writeFile(path.join(workDir, 'images.json'), JSON.stringify(images, null, 2));
  return { success: true, applied: true, description: `Added image "${name}" (${decoded.bytes.length} bytes)` };
}

async function applyModifyImage(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  const source = payload.source as Record<string, unknown>;
  if (!name) return { success: false, applied: false, error: 'Image name required' };

  const images = await readImagesJson(workDir);
  const idx = images.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
  if (idx === -1)
    return {
      success: false,
      applied: false,
      error: `Image "${name}" not found. Use vpx_image(action:"add") to create it.`,
    };

  const decoded = await decodeImageSource(source);
  if ('error' in decoded) return { success: false, applied: false, error: decoded.error };

  const imagesDir = path.join(workDir, 'images');
  await fs.promises.mkdir(imagesDir, { recursive: true });

  const existing = images[idx];
  const base = sanitizeImageFileBase(existing.name);
  if (!base)
    return { success: false, applied: false, error: `Image name "${existing.name}" has no filesystem-safe characters` };
  const fileName = `${base}${decoded.ext}`;
  await unlinkImageFiles(workDir, existing);
  await fs.promises.writeFile(path.join(imagesDir, fileName), decoded.bytes);
  const entry: ImageEntry = { ...existing, path: fileName };
  delete entry.internal_name;
  if (base !== existing.name) entry.name_dedup = base;
  else delete entry.name_dedup;
  images[idx] = entry;
  await fs.promises.writeFile(path.join(workDir, 'images.json'), JSON.stringify(images, null, 2));
  return { success: true, applied: true, description: `Replaced image "${name}" (${decoded.bytes.length} bytes)` };
}

async function applyDeleteImage(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  if (!name) return { success: false, applied: false, error: 'Image name required' };
  const images = await readImagesJson(workDir);
  const idx = images.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return { success: false, applied: false, error: `Image not found: ${name}` };
  const removed = images[idx];
  images.splice(idx, 1);
  await fs.promises.writeFile(path.join(workDir, 'images.json'), JSON.stringify(images, null, 2));
  await unlinkImageFiles(workDir, removed);
  return { success: true, applied: true, description: `Deleted image "${name}"` };
}

const SOUND_EXTS = ['.wav', '.mp3', '.ogg', '.flac'];

interface SoundEntry {
  name: string;
  path: string;
  internal_name: string;
  fade: number;
  volume: number;
  balance: number;
  output_target: string;
}

interface DecodedSoundSource {
  bytes: Buffer;
  ext: string;
}

async function decodeSoundSource(source: Record<string, unknown>): Promise<DecodedSoundSource | { error: string }> {
  if (typeof source.path === 'string') {
    const ext = path.extname(source.path).toLowerCase();
    if (!SOUND_EXTS.includes(ext)) {
      return { error: `Unsupported sound extension "${ext}". Use one of: ${SOUND_EXTS.join(', ')}` };
    }
    const bytes = await fs.promises.readFile(source.path);
    return { bytes, ext };
  }
  if (typeof source.base64 === 'string') {
    const bytes = Buffer.from(source.base64, 'base64');
    const mime = (source.mimeType as string) ?? 'audio/wav';
    const ext = mime.includes('mpeg')
      ? '.mp3'
      : mime.includes('ogg')
        ? '.ogg'
        : mime.includes('flac')
          ? '.flac'
          : '.wav';
    return { bytes, ext };
  }
  return { error: 'Invalid sound source. Use {path} or {base64, mimeType?}.' };
}

async function readSoundsJson(workDir: string): Promise<SoundEntry[]> {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(workDir, 'sounds.json'), 'utf-8')) as SoundEntry[];
  } catch {
    return [];
  }
}

async function writeSoundsJson(workDir: string, sounds: SoundEntry[]): Promise<void> {
  await fs.promises.writeFile(path.join(workDir, 'sounds.json'), JSON.stringify(sounds, null, 2));
}

function soundFileName(sound: SoundEntry): string {
  const ext = path.extname(sound.path).toLowerCase() || '.wav';
  return `${sound.name}${ext}`;
}

async function applyAddSound(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  const source = payload.source as Record<string, unknown>;
  if (!name) return { success: false, applied: false, error: 'Sound must have a name' };

  const decoded = await decodeSoundSource(source);
  if ('error' in decoded) return { success: false, applied: false, error: decoded.error };

  const sounds = await readSoundsJson(workDir);
  if (sounds.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    return {
      success: false,
      applied: false,
      error: `Sound "${name}" already exists. Use action:"modify" to replace its bytes, or action:"delete" first.`,
    };
  }

  const props = payload.properties as Partial<SoundEntry> | undefined;
  const soundsDir = path.join(workDir, 'sounds');
  await fs.promises.mkdir(soundsDir, { recursive: true });
  await fs.promises.writeFile(path.join(soundsDir, `${name}${decoded.ext}`), decoded.bytes);
  sounds.push({
    name,
    path: `${name}${decoded.ext}`,
    internal_name: '',
    fade: props?.fade ?? 0,
    volume: props?.volume ?? 0,
    balance: props?.balance ?? 0,
    output_target: props?.output_target ?? 'table',
  });
  await writeSoundsJson(workDir, sounds);
  return { success: true, applied: true, description: `Added sound "${name}" (${decoded.bytes.length} bytes)` };
}

async function applyModifySound(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  const source = payload.source as Record<string, unknown> | undefined;
  const patch = payload.patch as Record<string, unknown> | undefined;
  if (!name) return { success: false, applied: false, error: 'Sound name required' };

  const sounds = await readSoundsJson(workDir);
  const idx = sounds.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
  if (idx === -1)
    return { success: false, applied: false, error: `Sound "${name}" not found. Use action:"add" to create it.` };

  const existing = sounds[idx];
  const changes: string[] = [];

  if (source) {
    const decoded = await decodeSoundSource(source);
    if ('error' in decoded) return { success: false, applied: false, error: decoded.error };
    const soundsDir = path.join(workDir, 'sounds');
    await fs.promises.mkdir(soundsDir, { recursive: true });
    const oldFileName = soundFileName(existing);
    const newFileName = `${existing.name}${decoded.ext}`;
    if (oldFileName !== newFileName) {
      try {
        await fs.promises.unlink(path.join(soundsDir, oldFileName));
      } catch {
        // best effort
      }
    }
    await fs.promises.writeFile(path.join(soundsDir, newFileName), decoded.bytes);
    existing.path = newFileName;
    changes.push(`bytes (${decoded.bytes.length})`);
  }

  if (patch) {
    for (const key of ['fade', 'volume', 'balance', 'output_target'] as const) {
      if (patch[key] !== undefined) {
        (existing as unknown as Record<string, unknown>)[key] = patch[key];
        changes.push(`${key}=${patch[key]}`);
      }
    }
  }

  if (changes.length === 0) {
    return { success: false, applied: false, error: 'action="modify" requires `source` and/or `patch`.' };
  }

  await writeSoundsJson(workDir, sounds);
  return { success: true, applied: true, description: `Modified sound "${name}" (${changes.join(', ')})` };
}

async function applyDeleteSound(workDir: string, payload: Record<string, unknown>): Promise<EditResult> {
  const name = payload.name as string;
  if (!name) return { success: false, applied: false, error: 'Sound name required' };
  const sounds = await readSoundsJson(workDir);
  const idx = sounds.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return { success: false, applied: false, error: `Sound not found: ${name}` };
  const removed = sounds[idx];
  sounds.splice(idx, 1);
  await writeSoundsJson(workDir, sounds);
  try {
    await fs.promises.unlink(path.join(workDir, 'sounds', soundFileName(removed)));
  } catch {
    // best effort
  }
  return { success: true, applied: true, description: `Deleted sound "${name}"` };
}

export function collectImageRefsFromPart(data: Record<string, unknown>): string[] {
  const out = new Set<string>();
  for (const k of IMAGE_REF_KEYS) {
    const v = data[k];
    if (typeof v === 'string' && v) out.add(v);
  }
  return [...out];
}

export function rewriteRefs(
  data: Record<string, unknown>,
  materialMap: Map<string, string>,
  imageMap: Map<string, string>,
  meshFileMap: Map<string, string>
): Record<string, unknown> {
  const out = { ...data };
  const matLc = new Map<string, string>();
  for (const [k, v] of materialMap) matLc.set(k.toLowerCase(), v);
  const imgLc = new Map<string, string>();
  for (const [k, v] of imageMap) imgLc.set(k.toLowerCase(), v);

  for (const k of MATERIAL_REF_KEYS) {
    const v = out[k];
    if (typeof v === 'string' && v) {
      const mapped = matLc.get(v.toLowerCase());
      if (mapped) out[k] = mapped;
    }
  }
  for (const k of IMAGE_REF_KEYS) {
    const v = out[k];
    if (typeof v === 'string' && v) {
      const mapped = imgLc.get(v.toLowerCase());
      if (mapped) out[k] = mapped;
    }
  }
  if (typeof out.mesh_file_name === 'string') {
    const mapped = meshFileMap.get(out.mesh_file_name);
    if (mapped) out.mesh_file_name = mapped;
  }
  return out;
}

async function applyCloneBundle(deps: DirectEditDeps, payload: Record<string, unknown>): Promise<EditResult> {
  const donorTablePath = payload.donorTablePath as string;
  const partName = payload.partName as string;
  const targetPosition = payload.targetPosition as { x: number; y: number };
  const scale = (payload.scale as number) ?? 1;
  const rotation = (payload.rotation as number) ?? 0;
  const textureOverride = payload.textureOverride as string | null;
  const renamePrefix = (payload.renamePrefix as string | null) ?? 'Cloned_';
  // exactName: name the clone verbatim (the GLF name bridge needs the placed part name
  // to equal the switch the config references). geometryOnly: skip the donor's script —
  // a GLF mechanism gets its logic from emitted GLF config, not the donor's ROM subs.
  const exactName = (payload.exactName as string | undefined) || undefined;
  const geometryOnly = payload.geometryOnly === true;

  // Donor state is loaded on demand by the caller (ctx.loadTable) and passed in —
  // no corpus index. donorTablePath is still used to re-extract binary assets below.
  const donorState = payload.donorState as TableState | undefined;
  if (!donorState) {
    return { success: false, applied: false, error: 'clone-bundle requires a pre-loaded `donorState` in the payload.' };
  }
  let donorAssets: DonorAssetSet | null = null;
  try {
    const bundle = await buildBundle(donorState, partName);
    if (!bundle) return { success: false, applied: false, error: `Donor part not found: ${partName}` };

    const partImageRefs = collectImageRefsFromPart(bundle.partData);
    const neededImages = new Set<string>();
    for (const ref of partImageRefs) {
      if (textureOverride && ref === bundle.partData.image) continue;
      neededImages.add(ref);
    }
    const neededMesh = bundle.meshFileName;
    const neededSounds = geometryOnly ? new Set<string>() : new Set(bundle.soundRefs);

    let assetCopyNote = '';
    if ((neededImages.size > 0 || neededSounds.size > 0 || neededMesh) && !deps.vpx) {
      assetCopyNote =
        ' (warning: vpx reader unavailable — binary assets not copied; cloned part may have dangling refs)';
    } else if (neededImages.size > 0 || neededSounds.size > 0 || neededMesh) {
      const result = await extractDonorAssets(donorTablePath, deps.vpx!, neededImages, neededSounds, neededMesh);
      if ('error' in result) {
        assetCopyNote = ` (warning: ${result.error})`;
      } else {
        donorAssets = result;
      }
    }

    const materialNameMap = new Map<string, string>();
    for (const m of bundle.materials) {
      const newName = `${renamePrefix}${m.name}`;
      const renamed = { ...m.data, name: newName };
      const result = await applyAddMaterial(deps.workDir, { material: renamed });
      if (result.applied) {
        materialNameMap.set(m.name, newName);
      } else if (result.error?.includes('already exists')) {
        materialNameMap.set(m.name, newName);
      }
    }

    const imageNameMap = new Map<string, string>();
    if (donorAssets) {
      for (const refName of neededImages) {
        const asset = donorAssets.imageBytesByName.get(refName.toLowerCase());
        if (!asset) continue;
        const newName = `${renamePrefix}${refName}`;
        const result = await applyAddImage(deps.workDir, {
          name: newName,
          source: { base64: asset.bytes.toString('base64'), mimeType: asset.mimeType },
        });
        if (result.applied) imageNameMap.set(refName, newName);
        else if (result.error?.includes('already exists')) imageNameMap.set(refName, newName);
      }
    }

    let soundsCopied = 0;
    const soundsMissing: string[] = [];
    if (neededSounds.size > 0) {
      for (const refName of neededSounds) {
        const asset = donorAssets?.soundBytesByName.get(refName.toLowerCase());
        if (!asset) {
          soundsMissing.push(refName);
          continue;
        }
        const mime =
          asset.ext === '.mp3'
            ? 'audio/mpeg'
            : asset.ext === '.ogg'
              ? 'audio/ogg'
              : asset.ext === '.flac'
                ? 'audio/flac'
                : 'audio/wav';
        const result = await applyAddSound(deps.workDir, {
          name: refName,
          source: { base64: asset.bytes.toString('base64'), mimeType: mime },
          properties: {
            fade: asset.fade,
            volume: asset.volume,
            balance: asset.balance,
            output_target: asset.outputTarget,
          },
        });
        if (result.applied) soundsCopied++;
      }
    }
    if (donorAssets && soundsMissing.length > 0) {
      assetCopyNote += ` (warning: donor sounds not found: ${soundsMissing.join(', ')})`;
    }

    const retargeted = retargetPart(bundle.partData, {
      donorOrigin: bundle.donorOrigin,
      targetOrigin: targetPosition,
      scale,
      rotation,
    });
    const rewritten = rewriteRefs(retargeted, materialNameMap, imageNameMap, new Map());
    const renamedName = exactName ?? `${renamePrefix}${bundle.donorPartName}`;
    rewritten.name = renamedName;
    if (textureOverride) rewritten.image = textureOverride;

    const adds: string[] = [];
    if (materialNameMap.size) adds.push(`materials:${materialNameMap.size}`);
    if (imageNameMap.size) adds.push(`images:${imageNameMap.size}`);
    if (soundsCopied) adds.push(`sounds:${soundsCopied}`);

    const partResult = await applyAddPart(deps.workDir, { type: bundle.partType, data: rewritten });
    if (!partResult.applied) return partResult;
    adds.push(`part:${renamedName}`);

    const meshBytes = neededMesh ? donorAssets?.meshBytesByFileName.get(neededMesh) : undefined;
    if (meshBytes) {
      const added = await findGameItem(deps.workDir, renamedName);
      if (added?.ref.file_name) {
        const meshPath = path.join(deps.workDir, 'gameitems', added.ref.file_name.replace(/\.json$/, '.obj'));
        await fs.promises.writeFile(meshPath, meshBytes);
        adds.push('mesh:1');
      }
    } else if (neededMesh && donorAssets) {
      assetCopyNote += ` (warning: donor mesh ${neededMesh} not found)`;
    }

    if (!geometryOnly && (bundle.scriptClasses.length > 0 || bundle.scriptSubs.length > 0)) {
      const { findClasses, findSubs } = await import('../../shared/vbs-analysis.js');
      const { renameClonedSub } = await import('./library/rename.js');
      const existingScript = await fs.promises.readFile(path.join(deps.workDir, 'script.vbs'), 'utf-8').catch(() => '');
      const existingClassNames = new Set(findClasses(existingScript).map(c => c.name.toLowerCase()));
      const existingSubNames = new Set(findSubs(existingScript).map(s => s.name.toLowerCase()));

      const banner = [
        '',
        "' ============================================================================",
        `' CLONED CODE FROM DONOR: ${path.basename(donorTablePath)}`,
        `' Part: ${bundle.donorPartName} (cloned as ${renamedName})`,
        "'",
        "' MANUAL REVIEW REQUIRED. The block below was lifted verbatim from the donor",
        "' table and may reference symbols that do not exist here (e.g. Controller,",
        "' bsTrough, cGameName, named playfield parts). Inspect each Sub before relying",
        "' on it. Delete or stub out anything that references symbols you do not have.",
        "' ============================================================================",
        '',
      ].join('\n');

      const classBlocks: string[] = [];
      const skippedClasses: string[] = [];
      for (const c of bundle.scriptClasses) {
        if (existingClassNames.has(c.name.toLowerCase())) {
          skippedClasses.push(c.name);
          continue;
        }
        existingClassNames.add(c.name.toLowerCase());
        classBlocks.push(`\n' --- cloned class ${c.name} (from donor) ---\nClass ${c.name}\n${c.body}\nEnd Class\n`);
      }

      const subBlocks: string[] = [];
      const skippedSubs: string[] = [];
      for (const s of bundle.scriptSubs) {
        const renamed = renameClonedSub(s, bundle.donorPartName, renamedName);
        if (existingSubNames.has(renamed.name.toLowerCase())) {
          skippedSubs.push(renamed.name);
          continue;
        }
        existingSubNames.add(renamed.name.toLowerCase());
        const closer = s.kind === 'function' ? 'End Function' : 'End Sub';
        const block = s.startLine === s.endLine ? renamed.header : `${renamed.header}\n${renamed.body}\n${closer}`;
        subBlocks.push(`\n' --- cloned ${s.kind} ${s.name} ---\n${block}\n`);
      }

      const parts: string[] = [];
      if (classBlocks.length > 0 || subBlocks.length > 0) parts.push(banner);
      parts.push(...classBlocks, ...subBlocks);
      if (parts.length > 0) {
        await applyEditScript(deps.workDir, { mode: 'append', content: parts.join('\n') });
      }

      if (classBlocks.length > 0) adds.push(`script:${classBlocks.length}-classes`);
      if (subBlocks.length > 0) adds.push(`script:${subBlocks.length}-subs`);
      if (skippedClasses.length > 0) adds.push(`skipped-existing-classes:${skippedClasses.join(',')}`);
      if (skippedSubs.length > 0) adds.push(`skipped-existing-subs:${skippedSubs.join(',')}`);
    }

    return {
      success: true,
      applied: true,
      description: `Cloned "${partName}" → "${renamedName}" (${adds.join(', ')})${assetCopyNote}`,
    };
  } finally {
    if (donorAssets) await cleanupDonor(donorAssets.tempDir);
  }
}

export async function applyEditDirect(deps: DirectEditDeps, op: EditOperation): Promise<EditResult> {
  try {
    switch (op.kind) {
      case 'modify-part':
        return applyModifyPart(deps.workDir, op.payload);
      case 'add-part':
        return applyAddPart(deps.workDir, op.payload);
      case 'delete-part':
        return applyDeletePart(deps.workDir, op.payload);
      case 'edit-script':
        return applyEditScript(deps.workDir, op.payload);
      case 'replace-script-string':
        return applyReplaceScriptString(deps.workDir, op.payload);
      case 'replace-sub':
        return applyReplaceSub(deps.workDir, op.payload);
      case 'replace-script-range':
        return applyReplaceScriptRange(deps.workDir, op.payload);
      case 'add-material':
        return applyAddMaterial(deps.workDir, op.payload);
      case 'modify-material':
        return applyModifyMaterial(deps.workDir, op.payload);
      case 'add-image':
        return applyAddImage(deps.workDir, op.payload);
      case 'modify-image':
        return applyModifyImage(deps.workDir, op.payload);
      case 'delete-image':
        return applyDeleteImage(deps.workDir, op.payload);
      case 'add-sound':
        return applyAddSound(deps.workDir, op.payload);
      case 'modify-sound':
        return applyModifySound(deps.workDir, op.payload);
      case 'delete-sound':
        return applyDeleteSound(deps.workDir, op.payload);
      case 'clone-bundle':
        return applyCloneBundle(deps, op.payload);
      case 'undo':
      case 'redo':
        return {
          success: false,
          applied: false,
          error: `${op.kind} not supported in direct-write mode (renderer roundtrip required)`,
        };
      default:
        return { success: false, applied: false, error: `Unknown edit kind: ${op.kind}` };
    }
  } catch (err) {
    return { success: false, applied: false, error: err instanceof Error ? err.message : String(err) };
  }
}
