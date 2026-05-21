import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import type { VpxReader } from '../types.js';

const ROOT_PREFIX = '/vpx/';

export interface ExtractedDonor {
  tempDir: string;
}

export interface DonorImage {
  bytes: Buffer;
  internalName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface DonorSound {
  bytes: Buffer;
  ext: string;
  fade: number;
  volume: number;
  balance: number;
  outputTarget: string;
}

export interface DonorAssetSet {
  tempDir: string;
  imageBytesByName: Map<string, DonorImage>;
  soundBytesByName: Map<string, DonorSound>;
  meshBytesByFileName: Map<string, Buffer>;
}

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.webp') return 'image/webp';
  if (e === '.bmp') return 'image/bmp';
  return 'image/png';
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function extractVpxToTemp(donorTablePath: string, vpx: VpxReader): Promise<ExtractedDonor | { error: string }> {
  if (!(await fileExists(donorTablePath))) {
    return { error: `Donor .vpx not found on disk at ${donorTablePath}` };
  }
  const tempDir = path.join(os.tmpdir(), `vpx-donor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.promises.mkdir(tempDir, { recursive: true });
  try {
    const buffer = await fs.promises.readFile(donorTablePath);
    const files = await vpx.extract(new Uint8Array(buffer));
    for (const [filePath, data] of Object.entries(files)) {
      const relative = filePath.startsWith(ROOT_PREFIX) ? filePath.slice(ROOT_PREFIX.length) : filePath;
      const full = path.join(tempDir, relative);
      await fs.promises.mkdir(path.dirname(full), { recursive: true });
      await fs.promises.writeFile(full, data);
    }
    return { tempDir };
  } catch (err) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return { error: `Failed to extract donor: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function cleanupDonor(tempDir: string): Promise<void> {
  if (!tempDir) return;
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

interface ImagesJsonEntry {
  name: string;
  internal_name?: string;
  path?: string;
  width?: number;
  height?: number;
}

interface ImageLookupResult {
  image?: DonorImage;
  error?: string;
}

async function readImageBytesFromEntry(tempDir: string, entry: ImagesJsonEntry): Promise<DonorImage | null> {
  const candidates: string[] = [];
  if (entry.path) candidates.push(path.join(tempDir, entry.path));
  if (entry.internal_name) candidates.push(path.join(tempDir, 'images', entry.internal_name));
  for (const candidate of candidates) {
    try {
      const bytes = await fs.promises.readFile(candidate);
      const ext = path.extname(candidate);
      return {
        bytes,
        internalName: entry.internal_name ?? path.basename(candidate),
        mimeType: mimeFromExt(ext),
        width: entry.width ?? null,
        height: entry.height ?? null,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

async function findImageInTemp(tempDir: string, imageName: string): Promise<ImageLookupResult> {
  let list: ImagesJsonEntry[] = [];
  let imagesJsonExists = false;
  try {
    list = JSON.parse(await fs.promises.readFile(path.join(tempDir, 'images.json'), 'utf-8')) as ImagesJsonEntry[];
    imagesJsonExists = true;
  } catch {
    // no images.json — fall through to filesystem-based search
  }

  const target = imageName.toLowerCase();
  const targetNoExt = stripExt(target);

  // Strategy 1: exact match on `name` (case-insensitive)
  // Strategy 2: match `name` after stripping extension on either side
  // Strategy 3: match `internal_name` (basename) or its sans-extension form
  for (const entry of list) {
    const nameLc = entry.name.toLowerCase();
    if (nameLc !== target && stripExt(nameLc) !== targetNoExt) continue;
    const found = await readImageBytesFromEntry(tempDir, entry);
    if (found) return { image: found };
  }
  for (const entry of list) {
    if (!entry.internal_name) continue;
    const internLc = entry.internal_name.toLowerCase();
    const internNoExt = stripExt(path.basename(internLc));
    if (internLc !== target && internNoExt !== targetNoExt) continue;
    const found = await readImageBytesFromEntry(tempDir, entry);
    if (found) return { image: found };
  }

  // Strategy 4: walk tempDir/images/ and match by basename (sans extension)
  try {
    const imagesDir = path.join(tempDir, 'images');
    const entries = await fs.promises.readdir(imagesDir);
    for (const fileName of entries) {
      const lc = fileName.toLowerCase();
      if (stripExt(lc) !== targetNoExt && lc !== target) continue;
      try {
        const bytes = await fs.promises.readFile(path.join(imagesDir, fileName));
        return {
          image: {
            bytes,
            internalName: fileName,
            mimeType: mimeFromExt(path.extname(fileName)),
            width: null,
            height: null,
          },
        };
      } catch {
        continue;
      }
    }
  } catch {
    // no images dir
  }

  const available = imagesJsonExists
    ? list
        .map(e => e.name)
        .slice(0, 25)
        .join(', ') + (list.length > 25 ? `, … (${list.length} total)` : '')
    : '(no images.json in donor extraction)';
  return { error: `Image "${imageName}" not found. Available in donor: ${available}` };
}

interface SoundsJsonEntry {
  name: string;
  path?: string;
  name_dedup?: string;
  fade?: number;
  volume?: number;
  balance?: number;
  output_target?: string;
}

async function findSoundsInTemp(tempDir: string, neededSoundRefs: Set<string>): Promise<Map<string, DonorSound>> {
  const found = new Map<string, DonorSound>();
  let entries: SoundsJsonEntry[] = [];
  try {
    entries = JSON.parse(await fs.promises.readFile(path.join(tempDir, 'sounds.json'), 'utf-8')) as SoundsJsonEntry[];
  } catch {
    return found;
  }
  const wanted = new Set([...neededSoundRefs].map(n => n.toLowerCase()));
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    if (!wanted.has(key) || found.has(key)) continue;
    const ext = path.extname(entry.path ?? '').toLowerCase() || '.wav';
    const fileName = `${entry.name_dedup ?? entry.name}${ext}`;
    try {
      const bytes = await fs.promises.readFile(path.join(tempDir, 'sounds', fileName));
      found.set(key, {
        bytes,
        ext,
        fade: entry.fade ?? 0,
        volume: entry.volume ?? 0,
        balance: entry.balance ?? 0,
        outputTarget: entry.output_target ?? 'table',
      });
    } catch {
      continue;
    }
  }
  return found;
}

export async function extractDonorAssets(
  donorTablePath: string,
  vpx: VpxReader,
  neededImageRefs: Set<string>,
  neededSoundRefs: Set<string>,
  neededMeshFile: string | null
): Promise<DonorAssetSet | { error: string }> {
  if (neededImageRefs.size === 0 && neededSoundRefs.size === 0 && !neededMeshFile) {
    return { tempDir: '', imageBytesByName: new Map(), soundBytesByName: new Map(), meshBytesByFileName: new Map() };
  }
  const extracted = await extractVpxToTemp(donorTablePath, vpx);
  if ('error' in extracted) return extracted;
  const { tempDir } = extracted;

  const imageBytesByName = new Map<string, DonorImage>();
  for (const refName of neededImageRefs) {
    const result = await findImageInTemp(tempDir, refName);
    if (result.image) imageBytesByName.set(refName.toLowerCase(), result.image);
  }

  const soundBytesByName = await findSoundsInTemp(tempDir, neededSoundRefs);

  const meshBytesByFileName = new Map<string, Buffer>();
  if (neededMeshFile) {
    const meshPath = path.join(tempDir, neededMeshFile.replace(/^\/+/, ''));
    try {
      meshBytesByFileName.set(neededMeshFile, await fs.promises.readFile(meshPath));
    } catch {
      // mesh missing; skip
    }
  }

  return { tempDir, imageBytesByName, soundBytesByName, meshBytesByFileName };
}

export async function readDonorImage(
  donorTablePath: string,
  vpx: VpxReader,
  imageName: string
): Promise<DonorImage | { error: string }> {
  const extracted = await extractVpxToTemp(donorTablePath, vpx);
  if ('error' in extracted) return extracted;
  try {
    const result = await findImageInTemp(extracted.tempDir, imageName);
    if (result.image) return result.image;
    return { error: result.error ?? `Image "${imageName}" not found` };
  } finally {
    await cleanupDonor(extracted.tempDir);
  }
}
