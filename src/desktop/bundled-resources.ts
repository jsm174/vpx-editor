import { app } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';

// Resolve a directory bundled via forge.config extraResource. In a packaged app these live under
// process.resourcesPath; in dev they're under the project's resources/ folder. We probe candidates
// and return the first that exists so it works in both modes without env-specific branching.
function resolveBundledDir(name: string): string {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, name)]
    : [path.join(app.getAppPath(), 'resources', name), path.join(process.cwd(), 'resources', name)];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore and try the next candidate
    }
  }
  return candidates[0];
}

/** Vendored vpinball VBS scripts (core.vbs, controller.vbs, manufacturer controllers). GPL; pinned in resources/vendor.json. */
export function bundledVpinballScriptsDir(): string {
  return resolveBundledDir('vpinball-scripts');
}

/** Vendored GLF (Game Logic Framework): compiled vpx-glf.vbs + docs/. MIT; pinned in resources/vendor.json. */
export function bundledGlfDir(): string {
  return resolveBundledDir('glf');
}
