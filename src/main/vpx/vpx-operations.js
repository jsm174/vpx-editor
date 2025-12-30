import { app, dialog } from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import { getLastFolder, setLastFolder } from '../settings/settings-manager.js';

const MAX_RECENT_FILES = 10;

function isRunningInFlatpak() {
  return !!process.env.FLATPAK_ID;
}

let vpinballProcess = null;
let playingContext = null;

function getVpxtoolPath(settings) {
  if (!settings.useEmbeddedVpxtool && settings.vpxtoolPath) {
    return settings.vpxtoolPath;
  }
  const binary = process.platform === 'win32' ? 'vpxtool.exe' : 'vpxtool';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'vpxtool', binary);
  }
  return path.join(process.cwd(), 'resources', 'vpxtool', binary);
}

function getTemplatePath(templateName) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates', templateName);
  }
  return path.join(process.cwd(), 'resources', 'templates', templateName);
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sendConsoleOutput(ctx, type, text) {
  if (ctx?.window && !ctx.window.isDestroyed()) {
    ctx.window.webContents.send('console-output', { type, text });
  }
}

async function readTableLockState(ctx) {
  if (!ctx.extractedDir) {
    ctx.isTableLocked = false;
    return;
  }
  try {
    const gamedataPath = path.join(ctx.extractedDir, 'gamedata.json');
    const gamedataContent = await fs.promises.readFile(gamedataPath, 'utf-8');
    const gamedata = JSON.parse(gamedataContent);
    ctx.isTableLocked = gamedata.locked > 0;
  } catch (e) {
    ctx.isTableLocked = false;
  }
}

export function addToRecentFiles(filePath, deps) {
  const { settings, saveSettings, createMenu } = deps;
  settings.recentFiles = settings.recentFiles.filter(f => f !== filePath);
  settings.recentFiles.unshift(filePath);
  if (settings.recentFiles.length > MAX_RECENT_FILES) {
    settings.recentFiles = settings.recentFiles.slice(0, MAX_RECENT_FILES);
  }
  saveSettings();
  createMenu();
}

export async function extractVPX(vpxPath, options = {}, deps) {
  const {
    windowRegistry,
    createEditorWindow,
    showWorkFolderModal,
    createMenu,
    upgradeOldMaterialsFormat,
    upgradePlayfieldMeshVisibility,
    upgradeLayersToPartGroups,
    upgradePartGroupIsLocked,
    settings,
    saveSettings,
  } = deps;

  let ctx = windowRegistry.getFocused();

  const existingCtx = windowRegistry.findByTablePath(vpxPath);
  if (existingCtx) {
    existingCtx.window.focus();
    return;
  }

  if (!ctx || ctx.hasTable()) {
    ctx = createEditorWindow();
  }

  ctx.closeChildWindows();
  ctx.currentTablePath = vpxPath;
  ctx.tableName = path.basename(vpxPath, '.vpx');
  ctx.isTableDirty = false;

  const vpxDir = path.dirname(vpxPath);
  const workDir = path.join(vpxDir, `${ctx.tableName}_work`);

  ctx.window.webContents.send('loading', { show: true });
  ctx.window.webContents.send('console-open');
  sendConsoleOutput(ctx, 'info', `Opening: ${vpxPath}`);

  const workFolderExists = await fileExists(workDir);

  if (workFolderExists && options.forceExtract) {
    await fs.promises.rm(workDir, { recursive: true, force: true });
    sendConsoleOutput(ctx, 'info', 'Removed existing work folder');
  } else if (workFolderExists) {
    const vpxStat = await fs.promises.stat(vpxPath);
    const workStat = await fs.promises.stat(workDir);

    ctx.window.webContents.send('loading', { show: false });

    if (workStat.mtimeMs > vpxStat.mtimeMs) {
      const response = await showWorkFolderModal(
        ctx,
        'resume',
        'A previous editing session was found. Resume or start fresh?'
      );

      if (response === 'cancel') {
        ctx.window.webContents.send('loading', { show: false });
        ctx.reset();
        return;
      }

      if (response === 'resume') {
        ctx.extractedDir = workDir;
        ctx.backglassViewEnabled = false;
        ctx.is3DMode = false;
        await readTableLockState(ctx);
        addToRecentFiles(vpxPath, { settings, saveSettings, createMenu });
        ctx.updateWindowTitle();
        ctx.window.webContents.send('table-loaded', {
          extractedDir: ctx.extractedDir,
          vpxPath,
          tableName: ctx.tableName,
          isTableLocked: ctx.isTableLocked,
        });
        ctx.window.webContents.send('status', 'Loaded');
        ctx.window.webContents.send('loading', { show: false });
        createMenu();
        return;
      }
    } else {
      const response = await showWorkFolderModal(
        ctx,
        'external',
        'A work folder exists but the VPX file appears newer. What would you like to do?'
      );

      if (response === 'cancel') {
        ctx.window.webContents.send('loading', { show: false });
        ctx.reset();
        return;
      }

      if (response === 'resume') {
        ctx.extractedDir = workDir;
        ctx.backglassViewEnabled = false;
        ctx.is3DMode = false;
        await readTableLockState(ctx);
        addToRecentFiles(vpxPath, { settings, saveSettings, createMenu });
        ctx.updateWindowTitle();
        ctx.window.webContents.send('table-loaded', {
          extractedDir: ctx.extractedDir,
          vpxPath,
          tableName: ctx.tableName,
          isTableLocked: ctx.isTableLocked,
        });
        ctx.window.webContents.send('status', 'Loaded');
        ctx.window.webContents.send('loading', { show: false });
        createMenu();
        return;
      }
    }

    await fs.promises.rm(workDir, { recursive: true, force: true });
    sendConsoleOutput(ctx, 'info', 'Removed existing work folder');
  }

  ctx.window.webContents.send('loading', { show: true });

  const tempDir = path.join(os.tmpdir(), `vpx-editor-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  const tempVpxPath = path.join(tempDir, path.basename(vpxPath));
  await fs.promises.copyFile(vpxPath, tempVpxPath);
  sendConsoleOutput(ctx, 'info', `Extracting to work folder...`);

  ctx.extractedDir = workDir;
  ctx.backglassViewEnabled = false;
  ctx.is3DMode = false;

  ctx.window.webContents.send('status', `Extracting ${ctx.tableName}...`);

  const vpxtoolPath = getVpxtoolPath(settings);
  const extractCmd = `${vpxtoolPath} extract -f "${tempVpxPath}"`;
  sendConsoleOutput(ctx, 'command', `$ ${extractCmd}`);

  return new Promise((resolve, reject) => {
    const vpxtool = spawn(vpxtoolPath, ['extract', '-f', tempVpxPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    vpxtool.stdout.on('data', data => {
      sendConsoleOutput(ctx, 'stdout', data.toString());
    });

    let stderr = '';
    vpxtool.stderr.on('data', data => {
      const msg = data.toString();
      stderr += msg;
      sendConsoleOutput(ctx, 'stderr', msg);
    });

    vpxtool.on('close', async code => {
      if (code === 0) {
        const tempExtracted = path.join(tempDir, ctx.tableName);
        await fs.move(tempExtracted, workDir);
        await fs.promises.rm(tempDir, { recursive: true, force: true });

        sendConsoleOutput(ctx, 'success', 'Extraction complete');
        const upgraded = await upgradeOldMaterialsFormat(ctx.extractedDir);
        if (upgraded) {
          sendConsoleOutput(ctx, 'info', 'Upgraded old materials format to new format');
        }
        await upgradePlayfieldMeshVisibility(ctx.extractedDir, (type, text) => sendConsoleOutput(ctx, type, text));
        await upgradeLayersToPartGroups(ctx.extractedDir, (type, text) => sendConsoleOutput(ctx, type, text));
        await upgradePartGroupIsLocked(ctx.extractedDir, (type, text) => sendConsoleOutput(ctx, type, text));
        await readTableLockState(ctx);
        addToRecentFiles(vpxPath, { settings, saveSettings, createMenu });
        ctx.updateWindowTitle();
        ctx.window.webContents.send('table-loaded', {
          extractedDir: ctx.extractedDir,
          vpxPath,
          tableName: ctx.tableName,
          isTableLocked: ctx.isTableLocked,
        });
        ctx.window.webContents.send('status', `Loaded`);
        ctx.window.webContents.send('loading', { show: false });
        createMenu();
        if (upgraded) {
          ctx.window.webContents.send('show-info-modal', {
            title: 'Table Upgraded',
            message:
              'This table was created with an older version of Visual Pinball. The materials have been automatically converted to the new format.',
          });
        }
        resolve();
      } else {
        sendConsoleOutput(ctx, 'error', `Extraction failed with code ${code}`);
        ctx.window.webContents.send('loading', { show: false });
        dialog.showErrorBox('Extraction Failed', stderr || `vpxtool exited with code ${code}`);
        reject(new Error(stderr));
      }
    });

    vpxtool.on('error', err => {
      sendConsoleOutput(ctx, 'error', `Error: ${err.message}`);
      ctx.window.webContents.send('loading', { show: false });
      dialog.showErrorBox(
        'vpxtool Error',
        `Failed to run vpxtool: ${err.message}\n\nMake sure vpxtool is installed and in your PATH.`
      );
      reject(err);
    });
  });
}

export async function openVPX(deps) {
  const { windowRegistry, createEditorWindow, createMenu } = deps;

  let ctx = windowRegistry.getFocused();
  const createdWindow = !ctx;
  if (createdWindow) {
    ctx = createEditorWindow();
    await new Promise(resolve => ctx.window.webContents.once('did-finish-load', resolve));
  }

  const nativeDialogOpenSetter = value => {
    windowRegistry.forEach(c => {
      c.window.webContents.send('set-input-disabled', value);
    });
    createMenu();
  };

  nativeDialogOpenSetter(true);

  const result = await dialog.showOpenDialog(ctx.window, {
    properties: ['openFile'],
    filters: [{ name: 'VPX Files', extensions: ['vpx'] }],
    defaultPath: getLastFolder('Table'),
  });

  nativeDialogOpenSetter(false);

  if (result.canceled || result.filePaths.length === 0) {
    if (createdWindow) ctx.window.close();
    return;
  }

  const vpxPath = result.filePaths[0];
  setLastFolder('Table', path.dirname(vpxPath));
  await extractVPX(vpxPath, {}, deps);
}

export async function createNewTable(templateName, displayName, deps) {
  const {
    windowRegistry,
    createEditorWindow,
    createMenu,
    upgradeOldMaterialsFormat,
    upgradePlayfieldMeshVisibility,
    upgradeLayersToPartGroups,
    upgradePartGroupIsLocked,
    settings,
  } = deps;

  let ctx = windowRegistry.getFocused();
  if (!ctx || ctx.hasTable()) {
    ctx = createEditorWindow();
    await new Promise(resolve => ctx.window.webContents.once('did-finish-load', resolve));
  }

  const templatePath = getTemplatePath(templateName);

  if (!fs.existsSync(templatePath)) {
    dialog.showErrorBox('Template Not Found', `Could not find template: ${templateName}`);
    return;
  }

  const tableName = displayName.replace(/\s+/g, '');

  ctx.closeChildWindows();
  ctx.tableName = tableName;
  ctx.currentTablePath = null;
  ctx.isTableDirty = true;
  ctx.backglassViewEnabled = false;
  ctx.is3DMode = false;

  ctx.window.webContents.send('loading', { show: true });
  ctx.window.webContents.send('status', `Creating ${tableName}...`);

  const tempDir = path.join(os.tmpdir(), `vpx-editor-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  const tempVpxPath = path.join(tempDir, `${tableName}.vpx`);
  await fs.promises.copyFile(templatePath, tempVpxPath);

  const workDir = path.join(tempDir, tableName);
  ctx.extractedDir = workDir;

  const vpxtoolPath = getVpxtoolPath(settings);
  sendConsoleOutput(ctx, 'info', `Creating new table: ${tableName}`);
  sendConsoleOutput(ctx, 'command', `$ ${vpxtoolPath} extract -f "${tempVpxPath}"`);

  return new Promise((resolve, reject) => {
    const vpxtool = spawn(vpxtoolPath, ['extract', '-f', tempVpxPath]);

    let stderr = '';
    vpxtool.stderr.on('data', data => {
      stderr += data.toString();
    });

    vpxtool.on('close', async code => {
      if (code === 0) {
        await fs.promises.unlink(tempVpxPath);

        sendConsoleOutput(ctx, 'info', `Created temp work folder: ${workDir}`);
        await upgradeOldMaterialsFormat(ctx.extractedDir);
        await upgradePlayfieldMeshVisibility(ctx.extractedDir);
        await upgradeLayersToPartGroups(ctx.extractedDir);
        await upgradePartGroupIsLocked(ctx.extractedDir);
        ctx.isTableLocked = false;
        ctx.updateWindowTitle();
        ctx.window.webContents.send('table-loaded', {
          extractedDir: ctx.extractedDir,
          vpxPath: null,
          tableName: ctx.tableName,
          isTableLocked: ctx.isTableLocked,
        });
        ctx.window.webContents.send('status', 'Ready');
        ctx.window.webContents.send('loading', { show: false });
        createMenu();
        resolve();
      } else {
        ctx.window.webContents.send('loading', { show: false });
        dialog.showErrorBox('Extraction Failed', stderr || `vpxtool exited with code ${code}`);
        reject(new Error(stderr));
      }
    });

    vpxtool.on('error', err => {
      ctx.window.webContents.send('loading', { show: false });
      dialog.showErrorBox('vpxtool Error', `Failed to run vpxtool: ${err.message}`);
      reject(err);
    });
  });
}

export async function saveVPX(deps) {
  const { windowRegistry } = deps;
  const ctx = windowRegistry.getFocused();
  if (!ctx || !ctx.extractedDir) {
    dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
    return;
  }

  if (!ctx.currentTablePath) {
    return saveVPXAs(deps);
  }

  await assembleVPX(ctx.currentTablePath, true, deps);
}

export async function saveVPXAs(deps) {
  const { windowRegistry, createMenu } = deps;
  const ctx = windowRegistry.getFocused();
  if (!ctx || !ctx.extractedDir) {
    dialog.showErrorBox('No Table Open', 'Please open a VPX file first.');
    return;
  }

  const nativeDialogOpenSetter = value => {
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

  const newVpxPath = result.filePath;
  setLastFolder('Table', path.dirname(newVpxPath));
  const newTableName = path.basename(newVpxPath, '.vpx');
  const newVpxDir = path.dirname(newVpxPath);
  const newWorkDir = path.join(newVpxDir, `${newTableName}_work`);

  const isInTemp = ctx.extractedDir.startsWith(os.tmpdir());
  const needsMove = isInTemp || ctx.extractedDir !== newWorkDir;

  if (needsMove) {
    if (await fileExists(newWorkDir)) {
      await fs.promises.rm(newWorkDir, { recursive: true, force: true });
    }

    ctx.window.webContents.send('loading', { show: true });
    ctx.window.webContents.send('status', 'Copying work folder...');

    try {
      await fs.promises.cp(ctx.extractedDir, newWorkDir, { recursive: true });
      const oldExtractedDir = ctx.extractedDir;
      ctx.extractedDir = newWorkDir;

      if (isInTemp) {
        const tempParent = path.dirname(oldExtractedDir);
        await fs.promises.rm(tempParent, { recursive: true, force: true });
      }
    } catch (err) {
      ctx.window.webContents.send('loading', { show: false });
      dialog.showErrorBox('Copy Failed', `Failed to copy work folder: ${err.message}`);
      return;
    }
  }

  ctx.currentTablePath = newVpxPath;
  ctx.tableName = newTableName;
  ctx.updateWindowTitle();

  await assembleVPX(newVpxPath, true, deps);
}

export async function assembleVPX(outputPath, showConsole = false, deps) {
  const { windowRegistry, settings } = deps;
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
      sendConsoleOutput(ctx, 'error', `Failed to create backup: ${err.message}`);
    }
  }

  if (showConsole) {
    return assembleVPXWithConsole(ctx, outputPath, settings);
  }

  return new Promise((resolve, reject) => {
    const vpxtool = spawn(getVpxtoolPath(settings), ['assemble', '-f', ctx.extractedDir, outputPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    vpxtool.stderr.on('data', data => {
      const msg = data.toString();
      if (!msg.toLowerCase().includes('warn')) {
        stderr += msg;
      }
    });

    vpxtool.on('close', code => {
      ctx.window.webContents.send('loading', { show: false });
      if (code === 0) {
        ctx.markClean();
        ctx.window.webContents.send('mark-save-point');
        ctx.window.webContents.send('status', `Saved to ${path.basename(outputPath)}`);
        resolve();
      } else {
        dialog.showErrorBox('Save Failed', stderr || `vpxtool exited with code ${code}`);
        reject(new Error(stderr));
      }
    });

    vpxtool.on('error', err => {
      ctx.window.webContents.send('loading', { show: false });
      dialog.showErrorBox('vpxtool Error', `Failed to run vpxtool: ${err.message}`);
      reject(err);
    });
  });
}

export function assembleVPXWithConsole(ctx, outputPath, settings) {
  return new Promise((resolve, reject) => {
    ctx.window.webContents.send('console-open');

    const vpxtoolPath = getVpxtoolPath(settings);
    const command = `${vpxtoolPath} assemble -f "${ctx.extractedDir}" "${outputPath}"`;

    sendConsoleOutput(ctx, 'info', 'Saving table...');
    sendConsoleOutput(ctx, 'command', `$ ${command}`);

    const vpxtoolProcess = spawn(vpxtoolPath, ['assemble', '-f', ctx.extractedDir, outputPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    vpxtoolProcess.stdout.on('data', data => {
      sendConsoleOutput(ctx, 'stdout', data.toString());
    });

    vpxtoolProcess.stderr.on('data', data => {
      sendConsoleOutput(ctx, 'stderr', data.toString());
    });

    vpxtoolProcess.on('close', code => {
      ctx.window.webContents.send('loading', { show: false });
      if (code === 0) {
        ctx.markClean();
        ctx.window.webContents.send('mark-save-point');
        sendConsoleOutput(ctx, 'success', `Saved to ${path.basename(outputPath)}`);
        ctx.window.webContents.send('status', `Saved to ${path.basename(outputPath)}`);
        resolve();
      } else {
        sendConsoleOutput(ctx, 'error', `Save failed with code ${code}`);
        ctx.window.webContents.send('status', 'Save failed');
        reject(new Error(`vpxtool exited with code ${code}`));
      }
    });

    vpxtoolProcess.on('error', err => {
      ctx.window.webContents.send('loading', { show: false });
      sendConsoleOutput(ctx, 'error', `Error: ${err.message}`);
      ctx.window.webContents.send('status', 'Save failed');
      reject(err);
    });
  });
}

export async function playTable(deps) {
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
    dialog.showErrorBox('Table Not Saved', 'Please save the table before playing.');
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

  const files = await fs.promises.readdir(vpxDir);
  for (const file of files) {
    if (file.toLowerCase().endsWith('.directb2s')) {
      const src = path.join(vpxDir, file);
      const dest = path.join(playDir, file);
      await fs.promises.copyFile(src, dest);
      sendConsoleOutput(ctx, 'info', `Copied ${file}`);
    }
  }

  const pinmameDir = path.join(vpxDir, 'pinmame');
  if (await fileExists(pinmameDir)) {
    const destPinmame = path.join(playDir, 'pinmame');
    await fs.copy(pinmameDir, destPinmame);
    sendConsoleOutput(ctx, 'info', 'Copied pinmame folder');
  }

  runAssembleThenPlay(ctx, playVpxPath, settings);
}

function runAssembleThenPlay(ctx, vpxPath, settings) {
  playingContext = ctx;
  const vpxtoolPath = getVpxtoolPath(settings);
  const assembleCmd = `${vpxtoolPath} assemble -f "${ctx.extractedDir}" "${vpxPath}"`;

  sendConsoleOutput(ctx, 'info', 'Assembling table...');
  sendConsoleOutput(ctx, 'command', `$ ${assembleCmd}`);

  const vpxtoolProcess = spawn(vpxtoolPath, ['assemble', '-f', ctx.extractedDir, vpxPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  vpxtoolProcess.stdout.on('data', data => {
    sendConsoleOutput(ctx, 'stdout', data.toString());
  });

  vpxtoolProcess.stderr.on('data', data => {
    sendConsoleOutput(ctx, 'stderr', data.toString());
  });

  vpxtoolProcess.on('close', code => {
    if (code === 0) {
      sendConsoleOutput(ctx, 'success', 'Assembly complete.');
      sendConsoleOutput(ctx, 'stdout', '');
      launchVPinball(ctx, vpxPath, settings);
    } else {
      sendConsoleOutput(ctx, 'error', `Assembly failed with code ${code}`);
      ctx.window.webContents.send('play-stopped');
      ctx.window.webContents.send('status', 'Play failed');
      playingContext = null;
    }
  });

  vpxtoolProcess.on('error', err => {
    sendConsoleOutput(ctx, 'error', `Error: ${err.message}`);
    ctx.window.webContents.send('play-stopped');
    ctx.window.webContents.send('status', 'Play failed');
    playingContext = null;
  });
}

export function launchVPinball(ctx, vpxPath, settings) {
  const vpinballArgs = ['-Minimized', '-play', vpxPath];
  let spawnCmd, spawnArgs;

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

  vpinballProcess.stdout.on('data', data => {
    sendConsoleOutput(ctx, 'stdout', data.toString());
  });

  vpinballProcess.stderr.on('data', data => {
    sendConsoleOutput(ctx, 'stderr', data.toString());
  });

  vpinballProcess.on('close', (code, signal) => {
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

  vpinballProcess.on('error', err => {
    sendConsoleOutput(ctx, 'error', `Error: ${err.message}`);
    vpinballProcess = null;
    playingContext = null;
    ctx.window.webContents.send('play-stopped');
    ctx.window.webContents.send('status', 'Play failed');
  });
}

export function stopPlay() {
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

export function getVpinballProcess() {
  return vpinballProcess;
}

export function getPlayingContext() {
  return playingContext;
}

export { sendConsoleOutput, fileExists };
