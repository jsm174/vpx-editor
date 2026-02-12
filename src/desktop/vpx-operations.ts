import { app, dialog } from 'electron';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import { getLastFolder, setLastFolder, Settings } from './settings-manager.js';
import type { WindowContext, WindowRegistry } from './window-context.js';

const MAX_RECENT_FILES = 10;
const SOURCE_VPX_FILENAME = '.source.vpx';

let vpinModule: typeof import('@francisdb/vpin-wasm') | null = null;

async function initVpinModule(): Promise<typeof import('@francisdb/vpin-wasm')> {
  if (!vpinModule) {
    vpinModule = await import('@francisdb/vpin-wasm');
    await vpinModule.default();
  }
  return vpinModule;
}

interface ExtractOptions {
  forceExtract?: boolean;
}

interface RecentFilesDeps {
  settings: Settings;
  saveSettings: () => void;
  createMenu: () => void;
}

interface ExtractDeps extends RecentFilesDeps {
  windowRegistry: WindowRegistry;
  createEditorWindow: () => WindowContext;
  showWorkFolderModal: (ctx: WindowContext, type: string, message: string) => Promise<string>;
  upgradeOldMaterialsFormat: (dir: string) => Promise<boolean>;
  upgradePlayfieldMeshVisibility: (dir: string, callback?: (type: string, text: string) => void) => Promise<void>;
  upgradeLayersToPartGroups: (dir: string, callback?: (type: string, text: string) => void) => Promise<boolean>;
  upgradePartGroupIsLocked: (dir: string, callback?: (type: string, text: string) => void) => Promise<boolean>;
  cleanupCollectionItems: (dir: string, callback?: (type: string, text: string) => void) => Promise<boolean>;
}

interface OpenDeps {
  windowRegistry: WindowRegistry;
  createEditorWindow: () => WindowContext;
  createMenu: () => void;
}

interface SaveDeps extends RecentFilesDeps {
  windowRegistry: WindowRegistry;
}

interface AssembleDeps {
  windowRegistry: WindowRegistry;
}

interface PlayDeps {
  windowRegistry: WindowRegistry;
  settings: Settings;
}

function isRunningInFlatpak(): boolean {
  return !!process.env.FLATPAK_ID;
}

let vpinballProcess: ChildProcess | null = null;
let playingContext: WindowContext | null = null;

async function getAllFilesRecursively(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFilesRecursively(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      if (entry.name !== SOURCE_VPX_FILENAME) {
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  }
  return files;
}

async function runVpinExtract(
  ctx: WindowContext,
  vpxPath: string,
  workDir: string,
  infoMessage: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const vpin = await initVpinModule();

  sendConsoleOutput(ctx, 'info', infoMessage);

  const vpxData = await fs.promises.readFile(vpxPath);

  const wasmProgress = (msg: string) => {
    sendConsoleOutput(ctx, 'info', msg);
    onProgress?.(msg);
  };

  wasmProgress('Parsing VPX file...');
  const files = vpin.extract(vpxData, wasmProgress) as Record<string, Uint8Array>;
  const filePaths = Object.keys(files);
  const totalFiles = filePaths.length;

  await fs.promises.mkdir(workDir, { recursive: true });
  await fs.promises.writeFile(path.join(workDir, SOURCE_VPX_FILENAME), vpxData);

  const rootPrefix = '/vpx/';

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const relativePath = filePath.startsWith(rootPrefix) ? filePath.slice(rootPrefix.length) : filePath;
    const fullPath = path.join(workDir, relativePath);
    const fileDir = path.dirname(fullPath);

    await fs.promises.mkdir(fileDir, { recursive: true });
    await fs.promises.writeFile(fullPath, files[filePath]);

    if ((i + 1) % 10 === 0 || i === totalFiles - 1) {
      onProgress?.(`Extracting files... ${i + 1}/${totalFiles}`);
    }
  }

  sendConsoleOutput(ctx, 'success', `Extracted ${totalFiles} files`);
}

async function runVpinAssemble(
  ctx: WindowContext,
  outputPath: string,
  infoMessage: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const vpin = await initVpinModule();
  const workDir = ctx.extractedDir!;

  ctx.window.webContents.send('console-open');
  sendConsoleOutput(ctx, 'info', infoMessage);

  const diskFiles = await getAllFilesRecursively(workDir);
  const totalFiles = diskFiles.length;
  const files: Record<string, Uint8Array> = {};

  for (let i = 0; i < diskFiles.length; i++) {
    const fullPath = path.join(workDir, diskFiles[i]);
    const data = await fs.promises.readFile(fullPath);
    const vpxPath = '/vpx/' + diskFiles[i];
    files[vpxPath] = data;
    if ((i + 1) % 10 === 0 || i === totalFiles - 1) {
      onProgress?.(`Reading files... ${i + 1}/${totalFiles}`);
    }
  }

  const wasmProgress = (msg: string) => {
    sendConsoleOutput(ctx, 'info', msg);
    onProgress?.(msg);
  };

  wasmProgress('Assembling VPX...');
  const outputData = vpin.assemble(files, wasmProgress);

  await fs.promises.writeFile(outputPath, outputData);
  sendConsoleOutput(ctx, 'success', `Assembled ${diskFiles.length} files`);

  const sourceVpxPath = path.join(workDir, SOURCE_VPX_FILENAME);
  await fs.promises.writeFile(sourceVpxPath, outputData);
}

function getTemplatePath(templateName: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates', templateName);
  }
  return path.join(process.cwd(), 'public', 'templates', templateName);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sendConsoleOutput(ctx: WindowContext, type: string, text: string): void {
  if (ctx?.window && !ctx.window.isDestroyed()) {
    ctx.window.webContents.send('console-output', { type, text });
  }
}

async function readTableLockState(ctx: WindowContext): Promise<void> {
  if (!ctx.extractedDir) {
    ctx.isTableLocked = false;
    return;
  }
  try {
    const gamedataPath = path.join(ctx.extractedDir, 'gamedata.json');
    const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
    const gamedata = JSON.parse(gamedataContent);
    ctx.isTableLocked = (gamedata.locked & 1) !== 0;
  } catch {
    ctx.isTableLocked = false;
  }
}

export function addToRecentFiles(filePath: string, deps: RecentFilesDeps): void {
  const { settings, saveSettings, createMenu } = deps;
  settings.recentFiles = settings.recentFiles.filter(f => f !== filePath);
  settings.recentFiles.unshift(filePath);
  if (settings.recentFiles.length > MAX_RECENT_FILES) {
    settings.recentFiles = settings.recentFiles.slice(0, MAX_RECENT_FILES);
  }
  saveSettings();
  createMenu();
}

export function removeFromRecentFiles(filePath: string, deps: RecentFilesDeps): void {
  const { settings, saveSettings, createMenu } = deps;
  settings.recentFiles = settings.recentFiles.filter(f => f !== filePath);
  saveSettings();
  createMenu();
}

export async function extractVPX(vpxPath: string, options: ExtractOptions = {}, deps: ExtractDeps): Promise<void> {
  const {
    windowRegistry,
    createEditorWindow,
    showWorkFolderModal,
    createMenu,
    upgradeOldMaterialsFormat,
    upgradePlayfieldMeshVisibility,
    upgradeLayersToPartGroups,
    upgradePartGroupIsLocked,
    cleanupCollectionItems,
    settings,
    saveSettings,
  } = deps;

  const vpxExists = await fileExists(vpxPath);
  if (!vpxExists) {
    dialog.showErrorBox('File Not Found', `The file could not be found:\n${vpxPath}`);
    removeFromRecentFiles(vpxPath, { settings, saveSettings, createMenu });
    return;
  }

  let ctx = windowRegistry.getFocused();

  const existingCtx = windowRegistry.findByTablePath(vpxPath);
  if (existingCtx) {
    existingCtx.window.focus();
    return;
  }

  if (!ctx || ctx.hasTable()) {
    ctx = createEditorWindow();
    await new Promise<void>(resolve => ctx!.window.webContents.once('did-finish-load', resolve));
  }

  ctx!.closeChildWindows();
  ctx!.currentTablePath = vpxPath;
  ctx!.tableName = path.basename(vpxPath, '.vpx');
  ctx!.isTableDirty = false;

  const vpxDir = path.dirname(vpxPath);
  const workDir = path.join(vpxDir, `${ctx!.tableName}_work`);

  ctx!.window.webContents.send('loading', { show: true });
  ctx!.window.webContents.send('console-open');
  sendConsoleOutput(ctx!, 'info', `Opening: ${vpxPath}`);

  const workFolderExists = await fileExists(workDir);

  if (workFolderExists && options.forceExtract) {
    await fs.promises.rm(workDir, { recursive: true, force: true });
    sendConsoleOutput(ctx!, 'info', 'Removed existing work folder');
  } else if (workFolderExists) {
    const vpxStat = await fs.promises.stat(vpxPath);
    const workStat = await fs.promises.stat(workDir);

    ctx!.window.webContents.send('loading', { show: false });

    if (workStat.mtimeMs > vpxStat.mtimeMs) {
      const response = await showWorkFolderModal(
        ctx!,
        'resume',
        'A previous editing session was found. Resume or start fresh?'
      );

      if (response === 'cancel') {
        ctx!.window.webContents.send('loading', { show: false });
        ctx!.reset();
        return;
      }

      if (response === 'resume') {
        ctx!.extractedDir = workDir;
        ctx!.backglassViewEnabled = false;
        ctx!.is3DMode = false;
        await readTableLockState(ctx!);
        addToRecentFiles(vpxPath, { settings, saveSettings, createMenu });
        ctx!.updateWindowTitle();
        ctx!.window.webContents.send('table-loaded', {
          extractedDir: ctx!.extractedDir,
          vpxPath,
          tableName: ctx!.tableName,
          isTableLocked: ctx!.isTableLocked,
        });
        ctx!.window.webContents.send('status', 'Loaded');
        ctx!.window.webContents.send('loading', { show: false });
        createMenu();
        return;
      }
    } else {
      const response = await showWorkFolderModal(
        ctx!,
        'external',
        'A work folder exists but the VPX file appears newer. What would you like to do?'
      );

      if (response === 'cancel') {
        ctx!.window.webContents.send('loading', { show: false });
        ctx!.reset();
        return;
      }

      if (response === 'resume') {
        ctx!.extractedDir = workDir;
        ctx!.backglassViewEnabled = false;
        ctx!.is3DMode = false;
        await readTableLockState(ctx!);
        addToRecentFiles(vpxPath, { settings, saveSettings, createMenu });
        ctx!.updateWindowTitle();
        ctx!.window.webContents.send('table-loaded', {
          extractedDir: ctx!.extractedDir,
          vpxPath,
          tableName: ctx!.tableName,
          isTableLocked: ctx!.isTableLocked,
        });
        ctx!.window.webContents.send('status', 'Loaded');
        ctx!.window.webContents.send('loading', { show: false });
        createMenu();
        return;
      }
    }

    await fs.promises.rm(workDir, { recursive: true, force: true });
    sendConsoleOutput(ctx!, 'info', 'Removed existing work folder');
  }

  ctx!.window.webContents.send('loading', { show: true });

  ctx!.extractedDir = workDir;
  ctx!.backglassViewEnabled = false;
  ctx!.is3DMode = false;

  ctx!.window.webContents.send('status', `Extracting ${ctx!.tableName}...`);

  const localCtx = ctx!;
  try {
    await runVpinExtract(localCtx, vpxPath, workDir, 'Extracting to work folder...', msg => {
      localCtx.window.webContents.send('status', msg);
    });

    sendConsoleOutput(localCtx, 'info', `Work folder: ${workDir}`);
    const upgraded = await upgradeOldMaterialsFormat(localCtx.extractedDir!);
    if (upgraded) {
      sendConsoleOutput(localCtx, 'info', 'Upgraded old materials format to new format');
    }
    await upgradePlayfieldMeshVisibility(localCtx.extractedDir!, (type, text) =>
      sendConsoleOutput(localCtx, type, text)
    );
    await upgradeLayersToPartGroups(localCtx.extractedDir!, (type, text) => sendConsoleOutput(localCtx, type, text));
    await upgradePartGroupIsLocked(localCtx.extractedDir!, (type, text) => sendConsoleOutput(localCtx, type, text));
    await cleanupCollectionItems(localCtx.extractedDir!, (type, text) => sendConsoleOutput(localCtx, type, text));
    await readTableLockState(localCtx);
    addToRecentFiles(vpxPath, { settings, saveSettings, createMenu });
    localCtx.updateWindowTitle();
    localCtx.window.webContents.send('table-loaded', {
      extractedDir: localCtx.extractedDir,
      vpxPath,
      tableName: localCtx.tableName,
      isTableLocked: localCtx.isTableLocked,
    });
    localCtx.window.webContents.send('status', 'Loaded');
    localCtx.window.webContents.send('loading', { show: false });
    createMenu();
    if (upgraded) {
      localCtx.window.webContents.send('show-info-modal', {
        title: 'Table Upgraded',
        message:
          'This table was created with an older version of Visual Pinball. The materials have been automatically converted to the new format.',
      });
    }
  } catch (err) {
    localCtx.window.webContents.send('loading', { show: false });
    dialog.showErrorBox('Extraction Failed', (err as Error).message);
    throw err;
  }
}

export async function openVPX(deps: OpenDeps & ExtractDeps): Promise<void> {
  const { windowRegistry, createEditorWindow, createMenu } = deps;

  let ctx = windowRegistry.getFocused();
  const createdWindow = !ctx;
  if (createdWindow) {
    ctx = createEditorWindow();
    await new Promise<void>(resolve => ctx!.window.webContents.once('did-finish-load', resolve));
  }

  const nativeDialogOpenSetter = (value: boolean): void => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', value);
    });
    createMenu();
  };

  nativeDialogOpenSetter(true);

  const result = await dialog.showOpenDialog(ctx!.window, {
    properties: ['openFile'],
    filters: [{ name: 'VPX Files', extensions: ['vpx'] }],
    defaultPath: getLastFolder('Table'),
  });

  nativeDialogOpenSetter(false);

  if (result.canceled || result.filePaths.length === 0) {
    if (createdWindow) ctx!.window.close();
    return;
  }

  const vpxPath = result.filePaths[0];
  setLastFolder('Table', path.dirname(vpxPath));
  await extractVPX(vpxPath, {}, deps);
}

export async function createNewTable(templateName: string, displayName: string, deps: ExtractDeps): Promise<void> {
  const {
    windowRegistry,
    createEditorWindow,
    createMenu,
    upgradeOldMaterialsFormat,
    upgradePlayfieldMeshVisibility,
    upgradeLayersToPartGroups,
    upgradePartGroupIsLocked,
    cleanupCollectionItems,
  } = deps;

  let ctx = windowRegistry.getFocused();
  if (!ctx || ctx.hasTable()) {
    ctx = createEditorWindow();
    await new Promise<void>(resolve => ctx!.window.webContents.once('did-finish-load', resolve));
  }

  const templatePath = getTemplatePath(templateName);

  if (!fs.existsSync(templatePath)) {
    dialog.showErrorBox('Template Not Found', `Could not find template: ${templateName}`);
    return;
  }

  const tableName = displayName.replace(/\s+/g, '');

  ctx!.closeChildWindows();
  ctx!.tableName = tableName;
  ctx!.currentTablePath = null;
  ctx!.isTableDirty = true;
  ctx!.backglassViewEnabled = false;
  ctx!.is3DMode = false;

  ctx!.window.webContents.send('loading', { show: true });
  ctx!.window.webContents.send('status', `Creating ${tableName}...`);

  const tempDir = path.join(os.tmpdir(), `vpx-editor-${Date.now()}`);
  const workDir = path.join(tempDir, tableName);
  ctx!.extractedDir = workDir;

  const localCtx = ctx!;
  try {
    await runVpinExtract(localCtx, templatePath, workDir, `Creating new table: ${tableName}`, msg => {
      localCtx.window.webContents.send('status', msg);
    });

    sendConsoleOutput(localCtx, 'info', `Created temp work folder: ${workDir}`);
    await upgradeOldMaterialsFormat(localCtx.extractedDir!);
    await upgradePlayfieldMeshVisibility(localCtx.extractedDir!);
    await upgradeLayersToPartGroups(localCtx.extractedDir!);
    await upgradePartGroupIsLocked(localCtx.extractedDir!);
    await cleanupCollectionItems(localCtx.extractedDir!);
    localCtx.isTableLocked = false;
    localCtx.updateWindowTitle();
    localCtx.window.webContents.send('table-loaded', {
      extractedDir: localCtx.extractedDir,
      vpxPath: null,
      tableName: localCtx.tableName,
      isTableLocked: localCtx.isTableLocked,
    });
    localCtx.window.webContents.send('status', 'Ready');
    localCtx.window.webContents.send('loading', { show: false });
    createMenu();
  } catch (err) {
    localCtx.window.webContents.send('loading', { show: false });
    dialog.showErrorBox('Extraction Failed', (err as Error).message);
    throw err;
  }
}

export async function saveVPX(deps: SaveDeps & AssembleDeps): Promise<void> {
  const { windowRegistry } = deps;
  const ctx = windowRegistry.getFocused();
  if (!ctx || !ctx.extractedDir) {
    dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
    return;
  }

  if (!ctx.currentTablePath) {
    return saveVPXAs(deps);
  }

  await assembleVPX(ctx.currentTablePath, deps);
}

export async function saveVPXAs(deps: SaveDeps & AssembleDeps): Promise<void> {
  const { windowRegistry, createMenu, settings, saveSettings } = deps;
  const ctx = windowRegistry.getFocused();
  if (!ctx || !ctx.extractedDir) {
    dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
    return;
  }

  const nativeDialogOpenSetter = (value: boolean): void => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', value);
    });
    createMenu();
  };

  nativeDialogOpenSetter(true);

  const defaultName = ctx.tableName ? `${ctx.tableName}.vpx` : 'untitled.vpx';
  const defaultPath = ctx.currentTablePath || path.join(getLastFolder('Table'), defaultName);
  const result = await dialog.showSaveDialog(ctx.window, {
    filters: [{ name: 'VPX Files', extensions: ['vpx'] }],
    defaultPath,
  });

  nativeDialogOpenSetter(false);

  if (result.canceled) return;

  const newVpxPath = result.filePath!;
  setLastFolder('Table', path.dirname(newVpxPath));
  const newTableName = path.basename(newVpxPath, '.vpx');
  const newVpxDir = path.dirname(newVpxPath);
  const newWorkDir = path.join(newVpxDir, `${newTableName}_work`);

  const isInTemp = ctx.extractedDir.startsWith(os.tmpdir());
  const needsMove = isInTemp || ctx.extractedDir !== newWorkDir;

  if (needsMove) {
    if (await fileExists(newWorkDir)) {
      const overwriteResult = await dialog.showMessageBox(ctx.window, {
        type: 'warning',
        buttons: ['Replace', 'Cancel'],
        defaultId: 1,
        title: 'Work Folder Exists',
        message: `A work folder "${newTableName}_work" already exists.`,
        detail: 'Replacing it will delete any unsaved changes in that folder. Continue?',
      });

      if (overwriteResult.response !== 0) {
        return;
      }

      await fs.promises.rm(newWorkDir, { recursive: true, force: true });
    }

    ctx.window.webContents.send('loading', { show: true });
    ctx.window.webContents.send('status', 'Copying work folder...');

    try {
      await fs.promises.cp(ctx.extractedDir, newWorkDir, { recursive: true });
      const oldExtractedDir = ctx.extractedDir;
      ctx.extractedDir = newWorkDir;

      ctx.window.webContents.send('extracted-dir-changed', newWorkDir);

      if (isInTemp) {
        const tempParent = path.dirname(oldExtractedDir);
        await fs.promises.rm(tempParent, { recursive: true, force: true });
      }
    } catch (err) {
      ctx.window.webContents.send('loading', { show: false });
      dialog.showErrorBox('Copy Failed', `Failed to copy work folder: ${(err as Error).message}`);
      return;
    }
  }

  ctx.currentTablePath = newVpxPath;
  ctx.tableName = newTableName;
  ctx.updateWindowTitle();

  await assembleVPX(newVpxPath, deps);
  addToRecentFiles(newVpxPath, { settings, saveSettings, createMenu });
}

export async function assembleVPX(outputPath: string, deps: AssembleDeps): Promise<void> {
  const { windowRegistry } = deps;
  const ctx = windowRegistry.getFocused();
  if (!ctx) return;

  ctx.window.webContents.send('loading', { show: true });
  ctx.window.webContents.send('status', 'Saving...');

  if (await fileExists(outputPath)) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const backupPath = outputPath.replace(/\.vpx$/i, `_backup_${timestamp}.vpx`);
    try {
      await fs.promises.rename(outputPath, backupPath);
      sendConsoleOutput(ctx, 'info', `Backed up to ${path.basename(backupPath)}`);
    } catch (err) {
      sendConsoleOutput(ctx, 'error', `Failed to create backup: ${(err as Error).message}`);
    }
  }

  try {
    await runVpinAssemble(ctx, outputPath, 'Saving table...', msg => {
      ctx.window.webContents.send('status', msg);
    });
    ctx.window.webContents.send('loading', { show: false });
    ctx.markClean();
    ctx.window.webContents.send('mark-save-point');
    sendConsoleOutput(ctx, 'success', `Saved to ${path.basename(outputPath)}`);
    ctx.window.webContents.send('status', `Saved to ${path.basename(outputPath)}`);
  } catch (err) {
    ctx.window.webContents.send('loading', { show: false });
    ctx.window.webContents.send('status', 'Save failed');
    throw err;
  }
}

export async function playTable(deps: PlayDeps & SaveDeps & AssembleDeps): Promise<void> {
  const { windowRegistry, settings } = deps;
  const ctx = windowRegistry.getFocused();
  if (!ctx || !ctx.extractedDir) {
    dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
    return;
  }

  if (!settings.vpinballPath) {
    dialog.showErrorBox('VPinballX Not Configured', 'Please set the VPinballX executable path in Preferences > Paths.');
    return;
  }

  if (vpinballProcess) {
    return;
  }

  if (!ctx.currentTablePath) {
    const result = await dialog.showMessageBox(ctx.window, {
      type: 'warning',
      buttons: ['Save', 'Cancel'],
      defaultId: 0,
      title: 'Table Not Saved',
      message: 'The table must be saved before playing.',
      detail: 'Would you like to save it now?',
    });

    if (result.response === 0) {
      await saveVPXAs(deps);
      if (ctx.currentTablePath) {
        return playTable(deps);
      }
    }
    return;
  }

  const vpxDir = path.dirname(ctx.currentTablePath);
  const playDir = path.join(vpxDir, `${ctx.tableName}_play`);
  const playVpxPath = path.join(playDir, `${ctx.tableName}.vpx`);

  ctx.window.webContents.send('play-started');
  ctx.window.webContents.send('status', 'Building table for play...');
  ctx.window.webContents.send('console-open');

  await fs.promises.rm(playDir, { recursive: true, force: true });
  await fs.promises.mkdir(playDir, { recursive: true });

  const b2sPattern = `${ctx.tableName}.directb2s`.toLowerCase();
  const files = await fs.promises.readdir(vpxDir);
  const b2sFile = files.find(f => f.toLowerCase() === b2sPattern);
  if (b2sFile) {
    await fs.promises.copyFile(path.join(vpxDir, b2sFile), path.join(playDir, b2sFile));
    sendConsoleOutput(ctx, 'info', `Copied ${b2sFile}`);
  }

  const pinmameDir = path.join(vpxDir, 'pinmame');
  if (await fileExists(pinmameDir)) {
    const destPinmame = path.join(playDir, 'pinmame');
    await fs.copy(pinmameDir, destPinmame);
    sendConsoleOutput(ctx, 'info', 'Copied pinmame folder');
  }

  await runAssembleThenPlay(ctx, playVpxPath, settings);
}

async function runAssembleThenPlay(ctx: WindowContext, vpxPath: string, settings: Settings): Promise<void> {
  playingContext = ctx;
  try {
    await runVpinAssemble(ctx, vpxPath, 'Assembling table...', msg => {
      ctx.window.webContents.send('status', msg);
    });
    sendConsoleOutput(ctx, 'success', 'Assembly complete.');
    launchVPinball(ctx, vpxPath, settings);
  } catch {
    ctx.window.webContents.send('play-stopped');
    ctx.window.webContents.send('status', 'Play failed');
    playingContext = null;
  }
}

export function launchVPinball(ctx: WindowContext, vpxPath: string, settings: Settings): void {
  const vpinballArgs: string[] = [];
  if (process.platform === 'win32') {
    vpinballArgs.push('-Minimized');
  }
  vpinballArgs.push('-play', vpxPath);
  let spawnCmd: string;
  let spawnArgs: string[];

  if (isRunningInFlatpak()) {
    spawnCmd = 'flatpak-spawn';
    spawnArgs = ['--host', settings.vpinballPath, ...vpinballArgs];
  } else {
    spawnCmd = settings.vpinballPath;
    spawnArgs = vpinballArgs;
  }

  const playCmd = `${spawnCmd} ${spawnArgs.join(' ')}`;
  sendConsoleOutput(ctx, 'command', `$ ${playCmd}`);
  sendConsoleOutput(ctx, 'stdout', '');
  ctx.window.webContents.send('status', 'Playing...');

  vpinballProcess = spawn(spawnCmd, spawnArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  vpinballProcess.stdout?.on('data', (data: Buffer) => {
    sendConsoleOutput(ctx, 'stdout', data.toString());
  });

  vpinballProcess.stderr?.on('data', (data: Buffer) => {
    sendConsoleOutput(ctx, 'stderr', data.toString());
  });

  vpinballProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
    if (code === 0) {
      sendConsoleOutput(ctx, 'success', `Process exited with code ${code}`);
    } else if (code !== null) {
      sendConsoleOutput(ctx, 'error', `Process exited with code ${code}`);
    } else if (signal) {
      sendConsoleOutput(ctx, 'info', `Process killed by signal ${signal}`);
    }
    vpinballProcess = null;
    playingContext = null;
    ctx.window.webContents.send('play-stopped');
    ctx.window.webContents.send('status', 'Ready');
  });

  vpinballProcess.on('error', (err: Error) => {
    sendConsoleOutput(ctx, 'error', `Error: ${err.message}`);
    vpinballProcess = null;
    playingContext = null;
    ctx.window.webContents.send('play-stopped');
    ctx.window.webContents.send('status', 'Play failed');
  });
}

export function stopPlay(): void {
  if (vpinballProcess) {
    vpinballProcess.kill();
    vpinballProcess = null;
    if (playingContext) {
      playingContext.window.webContents.send('play-stopped');
      playingContext.window.webContents.send('status', 'Ready');
      playingContext = null;
    }
  }
}

export function getVpinballProcess(): ChildProcess | null {
  return vpinballProcess;
}

export function getPlayingContext(): WindowContext | null {
  return playingContext;
}

export { sendConsoleOutput, fileExists };
