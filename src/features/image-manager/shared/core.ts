export interface ImageData {
  name: string;
  path?: string;
  alpha_test_value?: number;
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

export const TABLE_IMAGE_PROPERTIES = ['image', 'ball_image', 'ball_image_front', 'env_image', 'color_grade_image'];

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.hdr'];

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

  for (const [itemName, item] of Object.entries(items)) {
    const typeDef = IMAGE_PROPERTIES.find(p => p.type === item._type);
    if (!typeDef) continue;
    for (const prop of typeDef.props) {
      if (item[prop] === imageName) {
        usedBy.push({ name: itemName, type: item._type, property: prop });
      }
    }
  }

  if (gamedata) {
    for (const prop of TABLE_IMAGE_PROPERTIES) {
      if (gamedata[prop] === imageName) {
        usedBy.push({ name: 'Table', type: 'Table', property: prop });
      }
    }
  }

  return usedBy;
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
