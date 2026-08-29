import * as THREE from 'three';

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs?: number[];
  indices?: number[];
}

export interface MeshOptions {
  scaleXY?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  offsetZ?: number;
  rotation?: number;
  rotationX?: number;
}

export function createMeshGeometry(meshData: MeshData, options: MeshOptions = {}): THREE.BufferGeometry {
  const {
    scaleX = options.scaleXY ?? options.scale ?? 1,
    scaleY = options.scaleXY ?? options.scale ?? 1,
    scaleZ = options.scaleXY ?? options.scale ?? 1,
    offsetZ = 0,
    rotation = 0,
    rotationX = 0,
  } = options;

  const positions = new Float32Array(meshData.positions.length);
  const normals = new Float32Array(meshData.normals.length);

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);

  for (let i = 0; i < meshData.positions.length; i += 3) {
    const x = meshData.positions[i] * scaleX;
    let y = meshData.positions[i + 1] * scaleY;
    let z = meshData.positions[i + 2] * scaleZ;
    const nx = meshData.normals[i];
    let ny = meshData.normals[i + 1];
    let nz = meshData.normals[i + 2];

    if (rotationX !== 0) {
      const y0 = y;
      y = y0 * cosX - z * sinX;
      z = y0 * sinX + z * cosX;
      const ny0 = ny;
      ny = ny0 * cosX - nz * sinX;
      nz = ny0 * sinX + nz * cosX;
    }
    z += offsetZ;

    if (rotation !== 0) {
      positions[i] = x * cos - y * sin;
      positions[i + 1] = x * sin + y * cos;
    } else {
      positions[i] = x;
      positions[i + 1] = y;
    }
    positions[i + 2] = z;

    if (rotation !== 0) {
      normals[i] = nx * cos - ny * sin;
      normals[i + 1] = nx * sin + ny * cos;
    } else {
      normals[i] = nx;
      normals[i + 1] = ny;
    }
    normals[i + 2] = nz;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  if (meshData.uvs && meshData.uvs.length > 0) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(meshData.uvs), 2));
  }

  if (meshData.indices && meshData.indices.length > 0) {
    geometry.setIndex(meshData.indices);
  }

  return geometry;
}
