import type { FileSystemProvider } from '../types.js';

export class OpfsFileSystem implements FileSystemProvider {
  private root: FileSystemDirectoryHandle | null = null;
  private pathMap: Map<string, string> = new Map();

  private normalizePath(path: string): string {
    return path.toLowerCase();
  }

  private getActualPath(path: string): string {
    return this.pathMap.get(this.normalizePath(path)) || path;
  }

  private storePath(path: string): void {
    this.pathMap.set(this.normalizePath(path), path);
  }

  private removePath(path: string): void {
    this.pathMap.delete(this.normalizePath(path));
  }

  async init(): Promise<void> {
    this.root = await navigator.storage.getDirectory();
  }

  private async getDirectoryHandle(
    dirPath: string,
    options: { create?: boolean } = {}
  ): Promise<FileSystemDirectoryHandle> {
    if (!this.root) {
      throw new Error('OPFS not initialized');
    }

    if (dirPath === '' || dirPath === '/') {
      return this.root;
    }

    const parts = dirPath.split('/').filter(p => p.length > 0);
    let current = this.root;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: options.create });
    }

    return current;
  }

  private async getFileHandle(filePath: string, options: { create?: boolean } = {}): Promise<FileSystemFileHandle> {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

    const dir = await this.getDirectoryHandle(dirPath, { create: options.create });
    return await dir.getFileHandle(fileName, { create: options.create });
  }

  async readFile(path: string): Promise<string> {
    const actualPath = this.getActualPath(path);
    const handle = await this.getFileHandle(actualPath);
    const file = await handle.getFile();
    return await file.text();
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const actualPath = this.getActualPath(path);
    const handle = await this.getFileHandle(actualPath);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.storePath(path);
    const handle = await this.getFileHandle(path, { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async writeBinaryFile(path: string, content: Uint8Array): Promise<void> {
    this.storePath(path);
    const handle = await this.getFileHandle(path, { create: true });
    const writable = await handle.createWritable();
    await writable.write(
      content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer
    );
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    const actualPath = this.getActualPath(path);
    const dirPath = actualPath.substring(0, actualPath.lastIndexOf('/'));
    const fileName = actualPath.substring(actualPath.lastIndexOf('/') + 1);

    const dir = await this.getDirectoryHandle(dirPath);
    await dir.removeEntry(fileName);
    this.removePath(path);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const content = await this.readBinaryFile(oldPath);
    await this.writeBinaryFile(newPath, content);
    await this.deleteFile(oldPath);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const actualPath = this.getActualPath(path);
      await this.getFileHandle(actualPath);
      return true;
    } catch {
      try {
        const actualPath = this.getActualPath(path);
        await this.getDirectoryHandle(actualPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async listDir(path: string): Promise<string[]> {
    const actualPath = this.getActualPath(path);
    const dir = (await this.getDirectoryHandle(actualPath)) as FileSystemDirectoryHandle &
      AsyncIterable<[string, FileSystemHandle]>;
    const results: string[] = [];

    for await (const [name] of dir) {
      results.push(name);
    }

    return results.sort();
  }

  async mkdir(path: string): Promise<void> {
    await this.getDirectoryHandle(path, { create: true });
  }

  async rmdir(path: string, recursive = false): Promise<void> {
    const actualPath = this.getActualPath(path);
    const parentPath = actualPath.substring(0, actualPath.lastIndexOf('/'));
    const dirName = actualPath.substring(actualPath.lastIndexOf('/') + 1);

    const parent = await this.getDirectoryHandle(parentPath);
    await parent.removeEntry(dirName, { recursive });
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const content = await this.readBinaryFile(src);
    await this.writeBinaryFile(dest, content);
  }

  async stat(path: string): Promise<{ mtimeMs: number; isDirectory: boolean }> {
    const actualPath = this.getActualPath(path);

    try {
      const handle = await this.getFileHandle(actualPath);
      const file = await handle.getFile();
      return {
        mtimeMs: file.lastModified,
        isDirectory: false,
      };
    } catch {
      await this.getDirectoryHandle(actualPath);
      return {
        mtimeMs: Date.now(),
        isDirectory: true,
      };
    }
  }

  async clear(): Promise<void> {
    if (!this.root) return;

    const root = this.root as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>;
    const entries: string[] = [];
    for await (const [name] of root) {
      entries.push(name);
    }

    for (const name of entries) {
      await this.root.removeEntry(name, { recursive: true });
    }

    this.pathMap.clear();
  }

  async getAllPaths(): Promise<string[]> {
    const paths: string[] = [];
    await this.collectPaths(this.root!, '', paths);
    return paths.sort();
  }

  private async collectPaths(dir: FileSystemDirectoryHandle, prefix: string, paths: string[]): Promise<void> {
    const iterable = dir as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>;
    for await (const [name, handle] of iterable) {
      const fullPath = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'file') {
        paths.push('/' + fullPath);
        this.storePath('/' + fullPath);
      } else {
        await this.collectPaths(handle as FileSystemDirectoryHandle, fullPath, paths);
      }
    }
  }
}

export async function createOpfsFileSystem(): Promise<OpfsFileSystem> {
  const fs = new OpfsFileSystem();
  await fs.init();
  return fs;
}
