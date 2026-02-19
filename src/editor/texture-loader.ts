import * as THREE from 'three';
import { state } from './state.js';
import { VIEW_MODE_3D } from '../shared/constants.js';
import { getMetalEnvMap } from './canvas-renderer-3d.js';

interface LoadQueueItem {
  imageName: string;
  resolve: (texture: THREE.Texture | null) => void;
}

interface MimeTypes {
  [key: string]: string;
}

interface VPXMaterial {
  base_color?: string;
  roughness?: number;
  opacity_active?: boolean;
  opacity?: number;
  type?: string;
  is_metal?: boolean;
}

let maxTextureSize = 2048;
const builtinTextureCache: Map<string, THREE.Texture> = new Map();
const LOAD_BATCH_SIZE = 2;

const loadQueue: LoadQueueItem[] = [];
let isProcessingQueue = false;

export function setMaxTextureSize(size: number): void {
  maxTextureSize = size;
}

export function getMaxTextureSize(): number {
  return maxTextureSize;
}

export async function loadTexture(imageName: string): Promise<THREE.Texture | null> {
  if (!imageName || !state.extractedDir) return null;

  if (state.textureCache.has(imageName)) {
    return state.textureCache.get(imageName) ?? null;
  }

  if (state.viewMode !== VIEW_MODE_3D) {
    return null;
  }

  return new Promise(resolve => {
    loadQueue.push({ imageName, resolve });
    scheduleProcessQueue();
  });
}

function scheduleProcessQueue(): void {
  if (isProcessingQueue || loadQueue.length === 0) return;

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => processQueue(), { timeout: 100 });
  } else {
    setTimeout(() => processQueue(), 16);
  }
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue || loadQueue.length === 0) return;
  if (state.viewMode !== VIEW_MODE_3D) {
    return;
  }

  isProcessingQueue = true;

  const batch = loadQueue.splice(0, LOAD_BATCH_SIZE);
  await Promise.all(batch.map(({ imageName, resolve }) => loadTextureInternal(imageName).then(resolve)));

  isProcessingQueue = false;

  if (loadQueue.length > 0 && state.viewMode === VIEW_MODE_3D) {
    scheduleProcessQueue();
  }
}

async function loadTextureInternal(imageName: string): Promise<THREE.Texture | null> {
  if (state.textureCache.has(imageName)) {
    return state.textureCache.get(imageName) ?? null;
  }

  const extensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

  for (const ext of extensions) {
    const imagePath = `${state.extractedDir}/images/${imageName}${ext}`;
    try {
      const result = await window.vpxEditor.readBinaryFile(imagePath);
      if (result.success && result.data) {
        const uint8Array =
          result.data instanceof Uint8Array
            ? result.data
            : Array.isArray(result.data)
              ? new Uint8Array(result.data)
              : new Uint8Array(Object.values(result.data));

        const mimeTypes: MimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
        };

        const blob = new Blob([uint8Array as BlobPart], { type: mimeTypes[ext] });
        const url = URL.createObjectURL(blob);

        try {
          const img = await loadImage(url);
          URL.revokeObjectURL(url);

          const resizedCanvas = resizeImage(img, maxTextureSize);

          const texture = new THREE.CanvasTexture(resizedCanvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.flipY = false;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;

          state.textureCache.set(imageName, texture);
          return texture;
        } catch {
          URL.revokeObjectURL(url);
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = (): void => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function loadBuiltinTexture(textureName: string): THREE.Texture {
  if (builtinTextureCache.has(textureName)) {
    return builtinTextureCache.get(textureName)!;
  }

  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(`textures/${textureName}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = false;

  builtinTextureCache.set(textureName, texture);
  return texture;
}

function resizeImage(img: HTMLImageElement, maxSize: number): HTMLCanvasElement {
  let { width, height } = img;

  if (maxSize === 0 || (width <= maxSize && height <= maxSize)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  const scale = maxSize / Math.max(width, height);
  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  return canvas;
}

function findImageInfo(imageName: string): { is_opaque?: boolean } | undefined {
  const direct = state.images[imageName];
  if (direct) return direct as { is_opaque?: boolean };
  const lowerName = imageName.toLowerCase();
  for (const key of Object.keys(state.images)) {
    if (key.toLowerCase() === lowerName) return state.images[key] as { is_opaque?: boolean };
  }
  return undefined;
}

export function createMaterialFromVPX(
  materialName: string,
  imageName: string | null,
  defaultColor: number = 0x888888
): THREE.MeshStandardMaterial {
  const vpxMaterial = state.materials[materialName] as VPXMaterial | undefined;

  const matOptions: THREE.MeshStandardMaterialParameters = {
    side: THREE.DoubleSide,
  };

  if (vpxMaterial) {
    if (vpxMaterial.base_color) {
      matOptions.color = vpxMaterial.base_color;
    }

    if (vpxMaterial.roughness !== undefined) {
      matOptions.roughness = vpxMaterial.roughness;
    }

    if (vpxMaterial.opacity_active && vpxMaterial.opacity !== undefined && vpxMaterial.opacity < 1.0) {
      matOptions.transparent = true;
      matOptions.opacity = vpxMaterial.opacity;
    }

    const isMetal = vpxMaterial.is_metal || vpxMaterial.type?.toLowerCase() === 'metal';
    if (isMetal) {
      matOptions.metalness = 0.8;
      matOptions.envMap = getMetalEnvMap();
      matOptions.envMapIntensity = 0.3;
    } else {
      matOptions.metalness = 0.0;
    }
  } else {
    matOptions.color = defaultColor;
    matOptions.roughness = 0.5;
    matOptions.metalness = 0.0;
  }

  if (imageName) {
    const imageInfo = findImageInfo(imageName);
    if (imageInfo?.is_opaque === false) {
      matOptions.alphaTest = 0.5;
    }
  }

  if (matOptions.transparent) {
    matOptions.depthWrite = false;
  }

  const material = new THREE.MeshStandardMaterial(matOptions);

  if (imageName && state.showMaterials) {
    loadTexture(imageName).then((texture: THREE.Texture | null) => {
      if (texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
    });
  }

  return material;
}
