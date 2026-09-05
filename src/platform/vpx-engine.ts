import type { GlbExportOptions, MeshIoOptions, ObjExportOptions } from '@francisdb/vpin-wasm';
import type { VpxEngine, VpxFiles, ProgressCallback, PrimitiveMeshData } from './types.js';

let vpinModule: typeof import('@francisdb/vpin-wasm') | null = null;

export class VpinWasmEngine implements VpxEngine {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    vpinModule = await import('@francisdb/vpin-wasm');
    await vpinModule.default();
    this.initialized = true;
    console.log('VPin WASM engine initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async extract(vpxData: Uint8Array, onProgress?: ProgressCallback): Promise<VpxFiles> {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    return vpinModule.extract(vpxData, onProgress) as VpxFiles;
  }

  assemble(files: VpxFiles, onProgress?: ProgressCallback): Uint8Array {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    return vpinModule.assemble(files, onProgress);
  }

  exportGlb(files: VpxFiles, exportInvisibleItems: boolean = false, onProgress?: ProgressCallback): Uint8Array {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    const options: GlbExportOptions & { visibility?: 'render' | 'editor' } = {
      exportInvisibleItems,
      visibility: 'editor',
    };
    return vpinModule.export_glb(files, options, onProgress);
  }

  exportObj(files: VpxFiles, options?: ObjExportOptions | null, onProgress?: ProgressCallback): VpxFiles {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    return vpinModule.export_obj(files, options ?? null, onProgress);
  }

  objToMesh(data: Uint8Array, options: MeshIoOptions | null = null): PrimitiveMeshData {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    const mesh = vpinModule.obj_to_mesh(data, options);
    const result: PrimitiveMeshData = {
      name: mesh.name,
      positions: mesh.positions,
      texCoords: mesh.texCoords,
      normals: mesh.normals,
      indices: mesh.indices,
      midpoint: mesh.midpoint,
    };
    mesh.free();
    return result;
  }

  meshToObj(
    name: string,
    positions: Float32Array,
    texCoords: Float32Array,
    normals: Float32Array,
    indices: Uint32Array,
    options: MeshIoOptions | null = null
  ): Uint8Array {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    return vpinModule.mesh_to_obj(name, positions, texCoords, normals, indices, options);
  }

  generateBuiltinPrimitive(sides: number, drawTexturesInside: boolean): PrimitiveMeshData {
    if (!this.initialized || !vpinModule) {
      throw new Error('VpxEngine not initialized');
    }
    const mesh = vpinModule.generate_builtin_primitive(sides, drawTexturesInside);
    const result: PrimitiveMeshData = {
      name: mesh.name,
      positions: mesh.positions,
      texCoords: mesh.texCoords,
      normals: mesh.normals,
      indices: mesh.indices,
      midpoint: mesh.midpoint,
    };
    mesh.free();
    return result;
  }
}

export function createVpxEngine(): VpxEngine {
  return new VpinWasmEngine();
}
