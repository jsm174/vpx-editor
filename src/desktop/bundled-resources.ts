import { app } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';

function resolveBundledDir(name: string): string {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, name)]
    : [path.join(app.getAppPath(), 'resources', name), path.join(process.cwd(), 'resources', name)];
  return candidates.find(c => fs.existsSync(c)) ?? candidates[0];
}

/** Vendored vpinball VBS scripts (core.vbs, controller.vbs, manufacturer controllers). GPL; pinned in resources/vendor.json. */
export function bundledVpinballScriptsDir(): string {
  return resolveBundledDir('vpinball-scripts');
}

/** Vendored GLF (Game Logic Framework): compiled vpx-glf.vbs + docs/. MIT; pinned in resources/vendor.json. */
export function bundledGlfDir(): string {
  return resolveBundledDir('glf');
}
