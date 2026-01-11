import type { StorageProvider } from '../types.js';

export class ElectronStorageProvider implements StorageProvider {
  private cache: Map<string, unknown> = new Map();

  private get api() {
    if (typeof window !== 'undefined' && (window as any).vpxEditorAPI) {
      return (window as any).vpxEditorAPI;
    }
    return null;
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    if (this.api) {
      const result = await this.api.getSetting(key);
      if (result !== undefined) {
        this.cache.set(key, result);
        return result as T;
      }
      return defaultValue;
    }

    return defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);

    if (this.api) {
      await this.api.saveSetting(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);

    if (this.api) {
      await this.api.deleteSetting(key);
    }
  }
}

export function createElectronStorageProvider(): ElectronStorageProvider {
  return new ElectronStorageProvider();
}
