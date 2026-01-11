import type { Platform, PlatformCapabilities } from '../types.js';
import { createVpxEngine } from '../vpx-engine.js';
import { ElectronFileSystem } from './file-system.js';
import { ElectronDialogProvider } from './dialogs.js';
import { ElectronStorageProvider } from './storage.js';
import { ElectronMenuProvider } from './menu.js';

export class ElectronPlatform implements Platform {
  readonly capabilities: PlatformCapabilities = {
    hasNativeMenus: true,
    hasNativeDialogs: true,
    hasNativeFileSystem: true,
    canPlayTables: true,
    canSpawnProcesses: true,
    isOfflineCapable: true,
    platformName: 'electron',
  };

  readonly fileSystem: ElectronFileSystem;
  readonly vpxEngine = createVpxEngine();
  readonly dialogs: ElectronDialogProvider;
  readonly storage: ElectronStorageProvider;
  readonly menu: ElectronMenuProvider;

  private _workDir = '';
  private _tempDir = '';
  private pathModule: typeof import('node:path') | null = null;
  private osModule: typeof import('node:os') | null = null;

  constructor() {
    this.fileSystem = new ElectronFileSystem();
    this.dialogs = new ElectronDialogProvider();
    this.storage = new ElectronStorageProvider();
    this.menu = new ElectronMenuProvider();
  }

  async init(): Promise<void> {
    await this.fileSystem.init();
    await this.vpxEngine.init();

    if (typeof window === 'undefined') {
      this.pathModule = await import('node:path');
      this.osModule = await import('node:os');
      this._tempDir = this.osModule.tmpdir();
      this._workDir = process.cwd();
    } else {
      this._tempDir = '/tmp';
      this._workDir = '/';
    }
  }

  getWorkDir(): string {
    return this._workDir;
  }

  getTempDir(): string {
    return this._tempDir;
  }

  joinPath(...parts: string[]): string {
    if (this.pathModule) {
      return this.pathModule.join(...parts);
    }
    return parts.join('/').replace(/\/+/g, '/');
  }

  dirname(path: string): string {
    if (this.pathModule) {
      return this.pathModule.dirname(path);
    }
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '.' : path.slice(0, lastSlash) || '/';
  }

  basename(path: string, ext?: string): string {
    if (this.pathModule) {
      return this.pathModule.basename(path, ext);
    }
    let base = path.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
    }
    return base;
  }
}

export function createElectronPlatform(): ElectronPlatform {
  return new ElectronPlatform();
}
