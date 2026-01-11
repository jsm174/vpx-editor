export interface FileContext {
  extractedDir: string;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
  writeBinaryFile: (path: string, data: Uint8Array) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<void>;
  listDir: (path: string) => Promise<string[]>;
}

export interface DialogContext {
  showConfirm: (message: string, detail?: string) => Promise<boolean>;
  showError: (message: string) => Promise<void>;
}

export interface UndoContext {
  begin: (description: string) => void;
  end: () => void;
  markCollections: () => void;
}

export interface OperationContext {
  file: FileContext;
  dialog?: DialogContext;
  undo?: UndoContext;
  markDirty?: () => void;
}
