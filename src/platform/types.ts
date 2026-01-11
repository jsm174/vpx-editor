export interface FileSystemProvider {
  readFile(path: string): Promise<string>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string): Promise<void>;
  writeBinaryFile(path: string, content: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  rmdir(path: string, recursive?: boolean): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  stat(path: string): Promise<{ mtimeMs: number; isDirectory: boolean }>;
}

export type ProgressCallback = (message: string) => void;

export type VpxFiles = Record<string, Uint8Array>;

export interface VpxEngine {
  init(): Promise<void>;
  extract(vpxData: Uint8Array, onProgress?: ProgressCallback): Promise<VpxFiles>;
  assemble(files: VpxFiles, onProgress?: ProgressCallback): Uint8Array;
  isInitialized(): boolean;
}

export interface DialogProvider {
  showOpenDialog(options: OpenDialogOptions): Promise<string | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>;
  showMessageBox(options: MessageBoxOptions): Promise<number>;
  showErrorBox(title: string, message: string): void;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
}

export interface StorageProvider {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface MenuProvider {
  setMenu(template: MenuTemplate): void;
  updateMenuState(updates: MenuStateUpdate): void;
}

export interface MenuTemplate {
  items: MenuItem[];
}

export interface MenuItem {
  id?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox';
  accelerator?: string;
  enabled?: boolean;
  checked?: boolean;
  submenu?: MenuItem[];
  click?: () => void;
}

export interface MenuStateUpdate {
  [menuId: string]: {
    enabled?: boolean;
    checked?: boolean;
    visible?: boolean;
  };
}

export interface PlatformCapabilities {
  hasNativeMenus: boolean;
  hasNativeDialogs: boolean;
  hasNativeFileSystem: boolean;
  canPlayTables: boolean;
  canSpawnProcesses: boolean;
  isOfflineCapable: boolean;
  platformName: 'electron' | 'web';
}

export interface Platform {
  capabilities: PlatformCapabilities;
  fileSystem: FileSystemProvider;
  vpxEngine: VpxEngine;
  dialogs: DialogProvider;
  storage: StorageProvider;
  menu: MenuProvider;

  init(): Promise<void>;
  getWorkDir(): string;
  getTempDir(): string;
  joinPath(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
}
