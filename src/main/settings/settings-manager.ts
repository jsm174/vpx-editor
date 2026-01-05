import { app, screen, BrowserWindow } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';
import {
  DEFAULT_THEME,
  DEFAULT_GRID_SIZE,
  DEFAULT_TEXTURE_QUALITY,
  DEFAULT_VPINBALL_PATH_MACOS,
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_TABLE_BACKGROUND_COLOR,
} from '../../shared/constants.js';

export interface EditorColors {
  defaultMaterial: string;
  elementSelect: string;
  elementSelectLocked: string;
  elementFill: string;
  tableBackground: string;
}

export const DEFAULT_EDITOR_COLORS: Readonly<EditorColors> = {
  defaultMaterial: DEFAULT_MATERIAL_COLOR,
  elementSelect: DEFAULT_ELEMENT_SELECT_COLOR,
  elementSelectLocked: DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  elementFill: DEFAULT_ELEMENT_FILL_COLOR,
  tableBackground: DEFAULT_TABLE_BACKGROUND_COLOR,
} as const;

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface Settings {
  theme: string;
  recentFiles: string[];
  panels: Record<string, unknown>;
  viewSolid: boolean;
  viewOutline: boolean;
  vpinballPath: string;
  useEmbeddedVpxtool: boolean;
  vpxtoolPath: string;
  viewGrid: boolean;
  viewBackdrop: boolean;
  consoleHeight: number;
  consoleVisible: boolean;
  gridSize: number;
  textureQuality: number;
  editorColors: EditorColors;
  alwaysDrawDragPoints: boolean;
  drawLightCenters: boolean;
  lastTableFolder: string | null;
  lastObjFolder: string | null;
  windowBounds: Record<string, WindowBounds>;
  unitConversion?: string;
  [key: `last${string}Folder`]: string | null;
}

export interface SettingsManager {
  getSettings(): Settings;
  loadSettings(): void;
  saveSettings(): void;
  getSettingsPath(): string;
  getLastFolder(type: string): string;
  setLastFolder(type: string, folderPath: string): void;
  getWindowBounds(windowName: string, defaults: WindowBounds): WindowBounds;
  setWindowBounds(windowName: string, bounds: WindowBounds): void;
  resetWindowBounds(): void;
  trackWindowBounds(win: BrowserWindow, windowName: string): void;
}

let settings: Settings = {
  theme: DEFAULT_THEME,
  recentFiles: [],
  panels: {},
  viewSolid: true,
  viewOutline: false,
  vpinballPath: process.platform === 'darwin' ? DEFAULT_VPINBALL_PATH_MACOS : '',
  useEmbeddedVpxtool: true,
  vpxtoolPath: '',
  viewGrid: true,
  viewBackdrop: true,
  consoleHeight: 200,
  consoleVisible: true,
  gridSize: DEFAULT_GRID_SIZE,
  textureQuality: DEFAULT_TEXTURE_QUALITY,
  editorColors: { ...DEFAULT_EDITOR_COLORS },
  alwaysDrawDragPoints: false,
  drawLightCenters: false,
  lastTableFolder: null,
  lastObjFolder: null,
  windowBounds: {},
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): void {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8');
    const saved = JSON.parse(data) as Partial<Settings>;
    settings = { ...settings, ...saved } as Settings;
    settings.recentFiles = (settings.recentFiles || []).filter(f => fs.existsSync(f));
    if (!settings.editorColors) {
      settings.editorColors = { ...DEFAULT_EDITOR_COLORS };
    } else {
      settings.editorColors = { ...DEFAULT_EDITOR_COLORS, ...settings.editorColors };
    }
  } catch {}
}

function saveSettings(): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch (e: unknown) {
    console.error('Failed to save settings:', e);
  }
}

function getDocumentsFolder(): string {
  return path.join(app.getPath('home'), 'Documents');
}

function getLastFolder(type: string): string {
  const key = `last${type}Folder` as keyof Settings;
  return (settings[key] as string | null) || getDocumentsFolder();
}

function setLastFolder(type: string, folderPath: string): void {
  const key = `last${type}Folder` as `last${string}Folder`;
  settings[key] = folderPath;
  saveSettings();
}

interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boundsIntersectDisplay(bounds: WindowBounds): boolean {
  const displays: Electron.Display[] = screen.getAllDisplays();
  const minVisible: number = 50;

  for (const display of displays) {
    const db: DisplayBounds = display.bounds;
    const left: number = Math.max(bounds.x ?? 0, db.x);
    const top: number = Math.max(bounds.y ?? 0, db.y);
    const right: number = Math.min((bounds.x ?? 0) + bounds.width, db.x + db.width);
    const bottom: number = Math.min((bounds.y ?? 0) + bounds.height, db.y + db.height);

    const overlapWidth: number = right - left;
    const overlapHeight: number = bottom - top;

    if (overlapWidth >= minVisible && overlapHeight >= minVisible) {
      return true;
    }
  }
  return false;
}

function getCenteredBounds(width: number, height: number): WindowBounds {
  const primaryDisplay: Electron.Display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight }: { width: number; height: number } = primaryDisplay.workAreaSize;
  return {
    x: Math.round((screenWidth - width) / 2),
    y: Math.round((screenHeight - height) / 2),
    width,
    height,
  };
}

function getWindowBounds(windowName: string, defaults: WindowBounds): WindowBounds {
  const saved: WindowBounds | undefined = settings.windowBounds?.[windowName];
  if (saved && boundsIntersectDisplay(saved)) {
    return { ...defaults, ...saved };
  }
  if (saved) {
    return getCenteredBounds(saved.width || defaults.width, saved.height || defaults.height);
  }
  return defaults;
}

function setWindowBounds(windowName: string, bounds: WindowBounds): void {
  if (!settings.windowBounds) {
    settings.windowBounds = {};
  }
  settings.windowBounds[windowName] = bounds;
  saveSettings();
}

function resetWindowBounds(): void {
  settings.windowBounds = {};
  saveSettings();
}

function trackWindowBounds(win: BrowserWindow, windowName: string): void {
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const saveBounds = (): void => {
    if (win.isDestroyed()) return;
    const bounds: Electron.Rectangle = win.getBounds();
    setWindowBounds(windowName, bounds);
  };

  win.on('resize', (): void => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveBounds, 500);
  });

  win.on('move', (): void => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveBounds, 500);
  });
}

export {
  settings,
  loadSettings,
  saveSettings,
  getSettingsPath,
  getLastFolder,
  setLastFolder,
  getWindowBounds,
  setWindowBounds,
  resetWindowBounds,
  trackWindowBounds,
};
