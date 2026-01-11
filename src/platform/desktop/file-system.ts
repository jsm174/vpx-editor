import type { FileSystemProvider } from '../types.js';

export class ElectronFileSystem implements FileSystemProvider {
  private fs: typeof import('fs-extra') | null = null;

  async init(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).vpxEditorAPI) {
      return;
    }
    this.fs = await import('fs-extra');
  }

  private get api() {
    if (typeof window !== 'undefined' && (window as any).vpxEditorAPI) {
      return (window as any).vpxEditorAPI;
    }
    return null;
  }

  async readFile(path: string): Promise<string> {
    if (this.api) {
      const result = await this.api.readFile(path);
      if (!result.success) throw new Error(result.error || 'Read failed');
      return result.content;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    return this.fs.readFile(path, 'utf-8');
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    if (this.api) {
      const result = await this.api.readBinaryFile(path);
      if (!result.success) throw new Error(result.error || 'Read failed');
      return result.content;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    const buffer = await this.fs.readFile(path);
    return new Uint8Array(buffer);
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.api) {
      const result = await this.api.writeFile(path, content);
      if (!result.success) throw new Error(result.error || 'Write failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.writeFile(path, content, 'utf-8');
  }

  async writeBinaryFile(path: string, content: Uint8Array): Promise<void> {
    if (this.api) {
      const result = await this.api.writeBinaryFile(path, content);
      if (!result.success) throw new Error(result.error || 'Write failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.writeFile(path, Buffer.from(content));
  }

  async deleteFile(path: string): Promise<void> {
    if (this.api) {
      const result = await this.api.deleteFile(path);
      if (!result.success) throw new Error(result.error || 'Delete failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.unlink(path);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (this.api) {
      const result = await this.api.renameFile(oldPath, newPath);
      if (!result.success) throw new Error(result.error || 'Rename failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.rename(oldPath, newPath);
  }

  async exists(path: string): Promise<boolean> {
    if (this.api) {
      const result = await this.api.checkFileExists(path);
      return result.valid;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    try {
      await this.fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async listDir(path: string): Promise<string[]> {
    if (this.api) {
      const result = await this.api.listDir(path);
      if (!result.success) throw new Error(result.error || 'List failed');
      return result.files;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    return this.fs.readdir(path);
  }

  async mkdir(path: string): Promise<void> {
    if (this.api) {
      const result = await this.api.mkdir(path);
      if (!result.success) throw new Error(result.error || 'Mkdir failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.mkdir(path, { recursive: true });
  }

  async rmdir(path: string, recursive = false): Promise<void> {
    if (this.api) {
      const result = await this.api.rmdir(path, recursive);
      if (!result.success) throw new Error(result.error || 'Rmdir failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.rm(path, { recursive, force: true });
  }

  async copyFile(src: string, dest: string): Promise<void> {
    if (this.api) {
      const result = await this.api.copyFile(src, dest);
      if (!result.success) throw new Error(result.error || 'Copy failed');
      return;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    await this.fs.copyFile(src, dest);
  }

  async stat(path: string): Promise<{ mtimeMs: number; isDirectory: boolean }> {
    if (this.api) {
      const result = await this.api.stat(path);
      if (!result.success) throw new Error(result.error || 'Stat failed');
      return result.stat;
    }
    if (!this.fs) throw new Error('FileSystem not initialized');
    const stat = await this.fs.stat(path);
    return {
      mtimeMs: stat.mtimeMs,
      isDirectory: stat.isDirectory(),
    };
  }
}

export function createElectronFileSystem(): ElectronFileSystem {
  return new ElectronFileSystem();
}
