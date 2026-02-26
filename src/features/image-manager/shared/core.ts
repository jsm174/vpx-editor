export interface ImageData {
  name: string;
  path?: string;
  alpha_test_value?: number;
  is_opaque?: boolean;
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  path: string;
  ext: string;
}

export interface ImageUsage {
  name: string;
  type: string;
  property: string;
}

export interface GameItem {
  _type: string;
  [key: string]: unknown;
}

export const IMAGE_PROPERTIES: { type: string; props: string[] }[] = [
  { type: 'Wall', props: ['image', 'side_image'] },
  { type: 'Flipper', props: ['image'] },
  { type: 'Bumper', props: ['base_image', 'cap_image', 'ring_image', 'skirt_image'] },
  { type: 'Ramp', props: ['image'] },
  { type: 'Spinner', props: ['image'] },
  { type: 'Gate', props: ['image'] },
  { type: 'Plunger', props: ['image'] },
  { type: 'Kicker', props: ['image'] },
  { type: 'Trigger', props: ['image'] },
  { type: 'Light', props: ['image', 'image_off'] },
  { type: 'HitTarget', props: ['image'] },
  { type: 'Rubber', props: ['image'] },
  { type: 'Flasher', props: ['image_a', 'image_b'] },
  { type: 'Primitive', props: ['image', 'normal_map'] },
  { type: 'Decal', props: ['image'] },
  { type: 'DispReel', props: ['image'] },
];

export const TABLE_IMAGE_PROPERTIES = [
  'image',
  'ball_image',
  'ball_image_front',
  'env_image',
  'image_color_grade',
  'backglass_image_full_desktop',
  'backglass_image_full_fullscreen',
  'backglass_image_full_single_screen',
];

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.hdr', '.exr'];

export const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export function findImageUsage(
  imageName: string,
  items: Record<string, GameItem>,
  gamedata: Record<string, unknown> | null
): ImageUsage[] {
  const usedBy: ImageUsage[] = [];
  const lowerName = imageName.toLowerCase();

  for (const [itemName, item] of Object.entries(items)) {
    const typeDef = IMAGE_PROPERTIES.find(p => p.type === item._type);
    if (!typeDef) continue;
    for (const prop of typeDef.props) {
      if (typeof item[prop] === 'string' && (item[prop] as string).toLowerCase() === lowerName) {
        usedBy.push({ name: itemName, type: item._type, property: prop });
      }
    }
  }

  if (gamedata) {
    for (const prop of TABLE_IMAGE_PROPERTIES) {
      if (typeof gamedata[prop] === 'string' && (gamedata[prop] as string).toLowerCase() === lowerName) {
        usedBy.push({ name: 'Table', type: 'Table', property: prop });
      }
    }
  }

  return usedBy;
}

export function detectImageOpaque(data: Uint8Array): Promise<boolean> {
  return new Promise(resolve => {
    const format = getImageFormat(data);
    if (format === 'JPG' || format === 'BMP') {
      resolve(true);
      return;
    }

    const blob = new Blob([data as BlobPart], {
      type: format === 'PNG' ? 'image/png' : format === 'WEBP' ? 'image/webp' : 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 255) {
          resolve(false);
          return;
        }
      }
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(true);
    };
    img.src = url;
  });
}

export function getImageFormat(data: Uint8Array): string | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'PNG';
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'JPG';
  }
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    return 'WEBP';
  }
  if (data[0] === 0x42 && data[1] === 0x4d) {
    return 'BMP';
  }
  if (data[0] === 0x23 && data[1] === 0x3f) {
    return 'HDR';
  }
  if (data[0] === 0x76 && data[1] === 0x2f && data[2] === 0x31 && data[3] === 0x01) {
    return 'EXR';
  }
  return null;
}

export function getPngDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] !== 0x89 || data[1] !== 0x50) return null;
  const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
  const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
  return { width, height };
}

export function getJpgDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) break;

    const marker = data[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (data[offset + 5] << 8) | data[offset + 6];
      const width = (data[offset + 7] << 8) | data[offset + 8];
      return { width, height };
    }

    const length = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + length;
  }

  return null;
}

export function getWebpDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] !== 0x52 || data[1] !== 0x49 || data[2] !== 0x46 || data[3] !== 0x46) return null;
  if (data.length < 30) return null;
  const fmt = String.fromCharCode(data[12], data[13], data[14], data[15]);
  if (fmt === 'VP8 ') {
    if (data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      return {
        width: (data[26] | (data[27] << 8)) & 0x3fff,
        height: (data[28] | (data[29] << 8)) & 0x3fff,
      };
    }
  } else if (fmt === 'VP8L') {
    const bits = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  } else if (fmt === 'VP8X') {
    return {
      width: (data[24] | (data[25] << 8) | (data[26] << 16)) + 1,
      height: (data[27] | (data[28] << 8) | (data[29] << 16)) + 1,
    };
  }
  return null;
}

export function getBmpDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] !== 0x42 || data[1] !== 0x4d || data.length < 26) return null;
  const width = data[18] | (data[19] << 8) | (data[20] << 16) | (data[21] << 24);
  const h = data[22] | (data[23] << 8) | (data[24] << 16) | (data[25] << 24);
  return { width, height: Math.abs(h) };
}

export function getHdrDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] !== 0x23 || data[1] !== 0x3f) return null;
  const header = new TextDecoder().decode(data.subarray(0, Math.min(data.length, 4096)));
  const match = header.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/);
  if (!match) return null;
  return { width: parseInt(match[2]), height: parseInt(match[1]) };
}

export function getExrDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data[0] !== 0x76 || data[1] !== 0x2f || data[2] !== 0x31 || data[3] !== 0x01) return null;
  let offset = 8;
  while (offset < data.length - 1) {
    let nameEnd = offset;
    while (nameEnd < data.length && data[nameEnd] !== 0) nameEnd++;
    if (nameEnd === offset) break;
    const name = new TextDecoder().decode(data.subarray(offset, nameEnd));
    offset = nameEnd + 1;
    let typeEnd = offset;
    while (typeEnd < data.length && data[typeEnd] !== 0) typeEnd++;
    offset = typeEnd + 1;
    const size = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
    offset += 4;
    if (name === 'dataWindow' && size === 16) {
      const xMin = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
      const yMin = data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) | (data[offset + 7] << 24);
      const xMax = data[offset + 8] | (data[offset + 9] << 8) | (data[offset + 10] << 16) | (data[offset + 11] << 24);
      const yMax = data[offset + 12] | (data[offset + 13] << 8) | (data[offset + 14] << 16) | (data[offset + 15] << 24);
      return { width: xMax - xMin + 1, height: yMax - yMin + 1 };
    }
    offset += size;
  }
  return null;
}

export function getImageDimensions(data: Uint8Array): { width: number; height: number } | null {
  const format = getImageFormat(data);
  switch (format) {
    case 'PNG':
      return getPngDimensions(data);
    case 'JPG':
      return getJpgDimensions(data);
    case 'WEBP':
      return getWebpDimensions(data);
    case 'BMP':
      return getBmpDimensions(data);
    case 'HDR':
      return getHdrDimensions(data);
    case 'EXR':
      return getExrDimensions(data);
    default:
      return null;
  }
}

export function hdrFloatDataToDataUrl(
  width: number,
  height: number,
  pixels: ArrayLike<number>,
  isHalfFloat: boolean
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    const si = i * 4;
    const di = i * 4;

    let r: number, g: number, b: number;
    if (isHalfFloat) {
      r = fromHalfFloat(pixels[si]);
      g = fromHalfFloat(pixels[si + 1]);
      b = fromHalfFloat(pixels[si + 2]);
    } else {
      r = pixels[si];
      g = pixels[si + 1];
      b = pixels[si + 2];
    }

    imageData.data[di] = (Math.min(1, Math.pow(Math.max(0, r / (1 + r)), 0.4545)) * 255) | 0;
    imageData.data[di + 1] = (Math.min(1, Math.pow(Math.max(0, g / (1 + g)), 0.4545)) * 255) | 0;
    imageData.data[di + 2] = (Math.min(1, Math.pow(Math.max(0, b / (1 + b)), 0.4545)) * 255) | 0;
    imageData.data[di + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

function fromHalfFloat(val: number): number {
  const s = (val & 0x8000) >> 15;
  const e = (val & 0x7c00) >> 10;
  const f = val & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : (s ? -1 : 1) * Infinity;
  return (s ? -1 : 1) * 2 ** (e - 15) * (1 + f / 1024);
}

export function sortImages<T extends { name: string; used?: boolean; size?: number; format?: string }>(
  list: T[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc'
): T[] {
  return [...list].sort((a, b) => {
    let aVal: string | number | boolean;
    let bVal: string | number | boolean;

    switch (sortColumn) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'used':
        aVal = a.used ? 1 : 0;
        bVal = b.used ? 1 : 0;
        break;
      case 'size':
        aVal = a.size || 0;
        bVal = b.size || 0;
        break;
      case 'format':
        aVal = (a.format || '').toLowerCase();
        bVal = (b.format || '').toLowerCase();
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}
