import type { DialogProvider, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from '../types.js';

export class ElectronDialogProvider implements DialogProvider {
  private get api() {
    if (typeof window !== 'undefined' && (window as any).vpxEditorAPI) {
      return (window as any).vpxEditorAPI;
    }
    return null;
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<string | null> {
    if (this.api) {
      const result = await this.api.showOpenDialog(options);
      return result.filePath || null;
    }
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
      properties: options.properties,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    if (this.api) {
      const result = await this.api.showSaveDialog(options);
      return result.filePath || null;
    }
    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
    });
    if (result.canceled) {
      return null;
    }
    return result.filePath || null;
  }

  async showMessageBox(options: MessageBoxOptions): Promise<number> {
    if (this.api) {
      const result = await this.api.showMessageBox(options);
      return result.response;
    }
    const { dialog } = await import('electron');
    const result = await dialog.showMessageBox({
      type: options.type,
      buttons: options.buttons,
      defaultId: options.defaultId,
      title: options.title,
      message: options.message,
      detail: options.detail,
    });
    return result.response;
  }

  showErrorBox(title: string, message: string): void {
    if (this.api) {
      this.api.showErrorBox(title, message);
      return;
    }
    import('electron').then(({ dialog }) => {
      dialog.showErrorBox(title, message);
    });
  }
}

export function createElectronDialogProvider(): ElectronDialogProvider {
  return new ElectronDialogProvider();
}
