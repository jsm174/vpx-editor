import { app, screen } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';
import {
  DEFAULT_THEME,
  DEFAULT_GRID_SIZE,
  DEFAULT_TEXTURE_QUALITY,
  DEFAULT_UNIT_CONVERSION,
  DEFAULT_VPINBALL_PATH_MACOS,
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_TABLE_BACKGROUND_COLOR,
} from '../../shared/constants.js';

const DEFAULT_EDITOR_COLORS = {
  defaultMaterial: DEFAULT_MATERIAL_COLOR,
  elementSelect: DEFAULT_ELEMENT_SELECT_COLOR,
  elementSelectLocked: DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  elementFill: DEFAULT_ELEMENT_FILL_COLOR,
  tableBackground: DEFAULT_TABLE_BACKGROUND_COLOR,
};

let settings = {
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

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8');
    const saved = JSON.parse(data);
    settings = { ...settings, ...saved };
    settings.recentFiles = (settings.recentFiles || []).filter(f => fs.existsSync(f));
    if (!settings.editorColors) {
      settings.editorColors = { ...DEFAULT_EDITOR_COLORS };
    } else {
      settings.editorColors = { ...DEFAULT_EDITOR_COLORS, ...settings.editorColors };
    }
  } catch (e) {}
}

function saveSettings() {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function getDocumentsFolder() {
  return path.join(app.getPath('home'), 'Documents');
}

function getLastFolder(type) {
  const key = `last${type}Folder`;
  return settings[key] || getDocumentsFolder();
}

function setLastFolder(type, folderPath) {
  const key = `last${type}Folder`;
  settings[key] = folderPath;
  saveSettings();
}

function boundsIntersectDisplay(bounds) {
  const displays = screen.getAllDisplays();
  const minVisible = 50;

  for (const display of displays) {
    const db = display.bounds;
    const left = Math.max(bounds.x, db.x);
    const top = Math.max(bounds.y, db.y);
    const right = Math.min(bounds.x + bounds.width, db.x + db.width);
    const bottom = Math.min(bounds.y + bounds.height, db.y + db.height);

    const overlapWidth = right - left;
    const overlapHeight = bottom - top;

    if (overlapWidth >= minVisible && overlapHeight >= minVisible) {
      return true;
    }
  }
  return false;
}

function getCenteredBounds(width, height) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  return {
    x: Math.round((screenWidth - width) / 2),
    y: Math.round((screenHeight - height) / 2),
    width,
    height,
  };
}

function getWindowBounds(windowName, defaults) {
  const saved = settings.windowBounds?.[windowName];
  if (saved && boundsIntersectDisplay(saved)) {
    return { ...defaults, ...saved };
  }
  if (saved) {
    return getCenteredBounds(saved.width || defaults.width, saved.height || defaults.height);
  }
  return defaults;
}

function setWindowBounds(windowName, bounds) {
  if (!settings.windowBounds) {
    settings.windowBounds = {};
  }
  settings.windowBounds[windowName] = bounds;
  saveSettings();
}

function resetWindowBounds() {
  settings.windowBounds = {};
  saveSettings();
}

function trackWindowBounds(win, windowName) {
  let saveTimeout = null;
  const saveBounds = () => {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    setWindowBounds(windowName, bounds);
  };

  win.on('resize', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveBounds, 500);
  });

  win.on('move', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveBounds, 500);
  });
}

export {
  settings,
  loadSettings,
  saveSettings,
  getSettingsPath,
  DEFAULT_EDITOR_COLORS,
  getLastFolder,
  setLastFolder,
  getWindowBounds,
  setWindowBounds,
  resetWindowBounds,
  trackWindowBounds,
};
