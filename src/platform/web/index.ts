import type { Platform, PlatformCapabilities } from '../types.js';
import { createVpxEngine } from '../vpx-engine.js';
import { OpfsFileSystem } from './file-system.js';
import { WebDialogProvider } from './dialogs.js';
import { WebStorageProvider } from './storage.js';
import { WebMenuProvider } from './menu.js';

export class WebPlatform implements Platform {
  readonly capabilities: PlatformCapabilities = {
    hasNativeMenus: false,
    hasNativeDialogs: false,
    hasNativeFileSystem: false,
    canPlayTables: false,
    canSpawnProcesses: false,
    isOfflineCapable: true,
    platformName: 'web',
  };

  readonly fileSystem: OpfsFileSystem;
  readonly vpxEngine = createVpxEngine();
  readonly dialogs: WebDialogProvider;
  readonly storage: WebStorageProvider;
  readonly menu: WebMenuProvider;

  constructor() {
    this.fileSystem = new OpfsFileSystem();
    this.dialogs = new WebDialogProvider();
    this.storage = new WebStorageProvider();
    this.menu = new WebMenuProvider();
  }

  async init(): Promise<void> {
    await this.fileSystem.init();
    await this.vpxEngine.init();
  }

  getWorkDir(): string {
    return '/vpx-work';
  }

  getTempDir(): string {
    return '/tmp';
  }

  joinPath(...parts: string[]): string {
    return parts.join('/').replace(/\/+/g, '/');
  }

  dirname(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '.' : path.slice(0, lastSlash) || '/';
  }

  basename(path: string, ext?: string): string {
    let base = path.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
    }
    return base;
  }
}

export function createWebPlatform(): WebPlatform {
  return new WebPlatform();
}
