import * as THREE from 'three';
import { state } from '../editor/state.js';
import { createMaterialFromVPX, loadBuiltinTexture } from '../editor/texture-loader.js';
import { DEFAULT_MATERIAL_COLOR } from './constants.js';

function getDefaultMaterialColor(): string {
  return state.editorColors?.defaultMaterial || DEFAULT_MATERIAL_COLOR;
}

export function createMaterial(
  materialName: string | null | undefined,
  imageName: string | null | undefined,
  fallbackColor?: string | number | null
): THREE.MeshStandardMaterial {
  const colorValue = fallbackColor ?? getDefaultMaterialColor();
  const colorNum = typeof colorValue === 'string' ? parseInt(colorValue.replace('#', ''), 16) : colorValue;
  if (state.showMaterials && materialName) {
    return createMaterialFromVPX(materialName, imageName ?? null, colorNum);
  }
  return new THREE.MeshStandardMaterial({
    color: colorValue,
    side: THREE.DoubleSide,
  });
}

export function createMaterialWithTexture(
  materialName: string | null | undefined,
  imageName: string | null | undefined,
  builtinTexture: string | null | undefined,
  fallbackColor?: string
): THREE.MeshStandardMaterial {
  const color = fallbackColor ?? getDefaultMaterialColor();
  const colorNum = parseInt(color.replace('#', ''), 16);
  if (state.showMaterials && materialName) {
    return createMaterialFromVPX(materialName, imageName ?? null, colorNum);
  }
  const useBuiltinTexture = builtinTexture && !imageName;
  const mat = new THREE.MeshStandardMaterial({
    color: useBuiltinTexture ? 0xffffff : color,
    side: THREE.DoubleSide,
    metalness: useBuiltinTexture ? 0.8 : 0,
  });
  if (useBuiltinTexture) {
    mat.map = loadBuiltinTexture(builtinTexture);
    mat.needsUpdate = true;
  }
  return mat;
}

export function addMesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return mesh;
}

export function createMeshWithMaterial(
  geometry: THREE.BufferGeometry,
  materialName: string | null | undefined,
  imageName: string | null | undefined,
  fallbackColor?: string
): THREE.Mesh {
  const material = createMaterial(materialName, imageName, fallbackColor);
  return new THREE.Mesh(geometry, material);
}
