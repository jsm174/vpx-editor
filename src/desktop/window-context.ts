import { BrowserWindow } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';

export type WebContentsWithWindowId = WebContents & { windowId?: string };

export function setWebContentsWindowId(webContents: WebContents, id: string): void {
  (webContents as WebContentsWithWindowId).windowId = id;
}

export interface WindowContextState {
  extractedDir: string | null;
  currentTablePath: string | null;
  tableName: string | null;
  isTableDirty: boolean;
  hasExternalChanges: boolean;
  isTableLocked: boolean;
  backglassViewEnabled: boolean;
  is3DMode: boolean;
  meshImportPrimitiveFileName: string | null;
}

export interface WindowContextChildWindows {
  scriptEditorWindow: BrowserWindow | null;
  imageManagerWindow: BrowserWindow | null;
  materialManagerWindow: BrowserWindow | null;
  soundManagerWindow: BrowserWindow | null;
  collectionManagerWindow: BrowserWindow | null;
  dimensionsManagerWindow: BrowserWindow | null;
  renderProbeManagerWindow: BrowserWindow | null;
  searchSelectWindow: BrowserWindow | null;
}

export class WindowContext implements WindowContextState, WindowContextChildWindows {
  public readonly id: string;
  public readonly window: BrowserWindow;
  public extractedDir: string | null;
  public currentTablePath: string | null;
  public tableName: string | null;
  public isTableDirty: boolean;
  public hasExternalChanges: boolean;
  public isTableLocked: boolean;
  public backglassViewEnabled: boolean;
  public is3DMode: boolean;
  public scriptEditorWindow: BrowserWindow | null;
  public scriptEditorClosePending: boolean;
  public scriptEditorCursorPosition: { lineNumber: number; column: number } | null;
  public closeConfirmed: boolean;
  public imageManagerWindow: BrowserWindow | null;
  public materialManagerWindow: BrowserWindow | null;
  public soundManagerWindow: BrowserWindow | null;
  public collectionManagerWindow: BrowserWindow | null;
  public dimensionsManagerWindow: BrowserWindow | null;
  public renderProbeManagerWindow: BrowserWindow | null;
  public searchSelectWindow: BrowserWindow | null;
  public meshImportPrimitiveFileName: string | null;

  public constructor(id: string, browserWindow: BrowserWindow) {
    this.id = id;
    this.window = browserWindow;

    this.extractedDir = null;
    this.currentTablePath = null;
    this.tableName = null;
    this.isTableDirty = false;
    this.hasExternalChanges = false;
    this.isTableLocked = false;
    this.backglassViewEnabled = false;
    this.is3DMode = false;

    this.scriptEditorWindow = null;
    this.scriptEditorClosePending = false;
    this.scriptEditorCursorPosition = null;
    this.closeConfirmed = false;
    this.imageManagerWindow = null;
    this.materialManagerWindow = null;
    this.soundManagerWindow = null;
    this.collectionManagerWindow = null;
    this.dimensionsManagerWindow = null;
    this.renderProbeManagerWindow = null;
    this.searchSelectWindow = null;
    this.meshImportPrimitiveFileName = null;
  }

  public updateWindowTitle(): void {
    if (!this.window || this.window.isDestroyed()) return;

    if (!this.tableName) {
      this.window.setTitle('VPX Editor');
      return;
    }

    const dirtyIndicator = this.isTableDirty ? ' *' : '';
    this.window.setTitle(`VPX Editor - [${this.tableName}.vpx]${dirtyIndicator}`);
  }

  public markDirty(): void {
    if (!this.isTableDirty) {
      this.isTableDirty = true;
      this.closeConfirmed = false;
      this.updateWindowTitle();
    }
  }

  public markClean(): void {
    this.isTableDirty = false;
    this.hasExternalChanges = false;
    this.closeConfirmed = false;
    this.updateWindowTitle();
  }

  public closeChildWindows(): void {
    const windows: (BrowserWindow | null)[] = [
      this.scriptEditorWindow,
      this.imageManagerWindow,
      this.materialManagerWindow,
      this.soundManagerWindow,
      this.collectionManagerWindow,
      this.dimensionsManagerWindow,
      this.renderProbeManagerWindow,
      this.searchSelectWindow,
    ];

    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    }

    this.scriptEditorWindow = null;
    this.imageManagerWindow = null;
    this.materialManagerWindow = null;
    this.soundManagerWindow = null;
    this.collectionManagerWindow = null;
    this.dimensionsManagerWindow = null;
    this.renderProbeManagerWindow = null;
    this.searchSelectWindow = null;
    this.scriptEditorClosePending = false;
  }

  public reset(): void {
    this.closeChildWindows();
    this.extractedDir = null;
    this.currentTablePath = null;
    this.tableName = null;
    this.isTableDirty = false;
    this.hasExternalChanges = false;
    this.isTableLocked = false;
    this.backglassViewEnabled = false;
    this.is3DMode = false;
    this.meshImportPrimitiveFileName = null;
    this.closeConfirmed = false;
    this.updateWindowTitle();
  }

  public hasTable(): boolean {
    return !!this.extractedDir;
  }
}

export interface IWindowRegistry {
  add(ctx: WindowContext): void;
  remove(id: string): void;
  get(id: string): WindowContext | undefined;
  getByWindow(browserWindow: BrowserWindow | undefined): WindowContext | null;
  getByChildWindow(childWindow: BrowserWindow | null | undefined): WindowContext | null;
  getContextFromEvent(event: IpcMainEvent | IpcMainInvokeEvent): WindowContext | null;
  setFocused(ctx: WindowContext): void;
  getFocused(): WindowContext | null;
  getAll(): WindowContext[];
  count(): number;
  forEach(callback: (ctx: WindowContext) => void): void;
  findByTablePath(vpxPath: string): WindowContext | null;
}

export class WindowRegistry implements IWindowRegistry {
  private readonly windows: Map<string, WindowContext>;
  private focusedContext: WindowContext | null;

  public constructor() {
    this.windows = new Map<string, WindowContext>();
    this.focusedContext = null;
  }

  public add(ctx: WindowContext): void {
    this.windows.set(ctx.id, ctx);
  }

  public remove(id: string): void {
    const ctx: WindowContext | undefined = this.windows.get(id);
    if (ctx === this.focusedContext) {
      this.focusedContext = null;
    }
    this.windows.delete(id);
  }

  public get(id: string): WindowContext | undefined {
    return this.windows.get(id);
  }

  public getByWindow(browserWindow: BrowserWindow | undefined): WindowContext | null {
    if (!browserWindow) return null;
    for (const ctx of this.windows.values()) {
      if (ctx.window === browserWindow) {
        return ctx;
      }
    }
    return null;
  }

  public getByChildWindow(childWindow: BrowserWindow | null | undefined): WindowContext | null {
    if (!childWindow) return null;
    for (const ctx of this.windows.values()) {
      if (
        ctx.scriptEditorWindow === childWindow ||
        ctx.imageManagerWindow === childWindow ||
        ctx.materialManagerWindow === childWindow ||
        ctx.soundManagerWindow === childWindow ||
        ctx.collectionManagerWindow === childWindow ||
        ctx.dimensionsManagerWindow === childWindow ||
        ctx.renderProbeManagerWindow === childWindow ||
        ctx.searchSelectWindow === childWindow
      ) {
        return ctx;
      }
    }
    return null;
  }

  public getContextFromEvent(event: IpcMainEvent | IpcMainInvokeEvent): WindowContext | null {
    const webContents = event.sender as WebContentsWithWindowId;
    const windowId: string | undefined = webContents.windowId;

    if (windowId && this.windows.has(windowId)) {
      return this.windows.get(windowId) || null;
    }

    for (const ctx of this.windows.values()) {
      if (ctx.window?.webContents === webContents) {
        return ctx;
      }
    }

    return this.getByChildWindow(BrowserWindow.fromWebContents(webContents));
  }

  public setFocused(ctx: WindowContext): void {
    this.focusedContext = ctx;
  }

  public getFocused(): WindowContext | null {
    return this.focusedContext;
  }

  public getAll(): WindowContext[] {
    return Array.from(this.windows.values());
  }

  public count(): number {
    return this.windows.size;
  }

  public forEach(callback: (ctx: WindowContext) => void): void {
    this.windows.forEach(callback);
  }

  public findByTablePath(vpxPath: string): WindowContext | null {
    if (!vpxPath) return null;
    const normalized: string = vpxPath.toLowerCase();
    for (const ctx of this.windows.values()) {
      if (ctx.currentTablePath && ctx.currentTablePath.toLowerCase() === normalized) {
        return ctx;
      }
    }
    return null;
  }
}
