import type { VpxEngine, VpxFiles, ProgressCallback } from './types.js';

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
}

export function createVpxEngine(): VpxEngine {
  return new VpinWasmEngine();
}
