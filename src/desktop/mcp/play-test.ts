import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import type { PlayTestResult } from './types.js';

const SOURCE_VPX_FILENAME = '.source.vpx';
const MAX_LOG_BYTES = 256 * 1024;
const ERROR_PATTERN =
  /script error|compile error|runtime error|syntax error|microsoft vbscript|line \d+.*error|unhandled exception|assertion failed/i;

async function collectFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, baseDir)));
    } else if (entry.name !== SOURCE_VPX_FILENAME) {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files;
}

export interface PlayTestOptions {
  workDir: string;
  tableName: string;
  vpinballPath: string;
  seconds: number;
  assemble: (files: Record<string, Uint8Array>) => Uint8Array;
  log: (msg: string) => void;
  flatpak?: boolean;
}

export async function resolveVpinballExecutable(vpinballPath: string): Promise<string | null> {
  let candidate = vpinballPath;
  try {
    let stat = await fs.promises.stat(candidate);
    if (stat.isDirectory() && candidate.endsWith('.app')) {
      const name = path.basename(candidate, '.app');
      candidate = path.join(candidate, 'Contents', 'MacOS', name);
      stat = await fs.promises.stat(candidate);
    }
    return stat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function failResult(error: string): PlayTestResult {
  return {
    ok: false,
    ranSeconds: 0,
    exitCode: null,
    timedOut: false,
    earlyExit: false,
    errorLines: [],
    logTail: '',
    error,
  };
}

export async function runPlayTest(opts: PlayTestOptions): Promise<PlayTestResult> {
  const { workDir, tableName, seconds, assemble, log } = opts;
  const vpinballPath = opts.flatpak ? opts.vpinballPath : await resolveVpinballExecutable(opts.vpinballPath);
  if (!vpinballPath) {
    return failResult(
      `VPinballX executable not found at: ${opts.vpinballPath} (on macOS point Preferences > Paths at the .app bundle or the binary inside Contents/MacOS).`
    );
  }

  const relPaths = await collectFiles(workDir);
  const files: Record<string, Uint8Array> = {};
  for (const rel of relPaths) {
    files['/vpx/' + rel.replaceAll('\\', '/')] = await fs.promises.readFile(path.join(workDir, rel));
  }

  log(`play-test: assembling ${relPaths.length} files...`);
  const vpxBytes = assemble(files);

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vpx-mcp-test-'));
  const tmpVpx = path.join(tmpDir, `${tableName || 'table'}.vpx`);
  await fs.promises.writeFile(tmpVpx, vpxBytes);

  log(`play-test: launching VPinballX for ${seconds}s...`);
  const started = Date.now();
  let logBuf = '';
  let timedOut = false;

  let launchError: string | null = null;
  const exitCode = await new Promise<number | null>(resolve => {
    const [cmd, args] = opts.flatpak
      ? ['flatpak-spawn', ['--host', vpinballPath, '-play', tmpVpx]]
      : [vpinballPath, ['-play', tmpVpx]];
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const append = (chunk: Buffer): void => {
      if (logBuf.length < MAX_LOG_BYTES) logBuf += chunk.toString('utf-8');
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    let forceKill: NodeJS.Timeout | null = null;
    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceKill = setTimeout(() => child.kill('SIGKILL'), 3000);
    }, seconds * 1000);
    const done = (code: number | null): void => {
      clearTimeout(killTimer);
      if (forceKill) clearTimeout(forceKill);
      resolve(code);
    };

    child.once('error', err => {
      launchError = err.message;
      done(null);
    });
    child.once('exit', code => done(code));
  });

  await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  if (launchError) return failResult(`Could not launch VPinballX (${vpinballPath}): ${launchError}`);

  const errorLines = logBuf
    .split('\n')
    .map(l => l.trim())
    .filter(l => ERROR_PATTERN.test(l))
    .slice(0, 40);

  const ranSeconds = Math.round((Date.now() - started) / 100) / 10;
  const crashed = !timedOut && exitCode !== 0;
  const earlyExit = !timedOut && !crashed && ranSeconds < seconds * 0.8;
  const ok = errorLines.length === 0 && !crashed;

  return {
    ok,
    ranSeconds,
    exitCode,
    timedOut,
    earlyExit,
    errorLines,
    logTail: logBuf.slice(-4000),
    note: earlyExit
      ? `VPinballX exited cleanly after ${ranSeconds}s though ${seconds}s were requested — the table may have failed to load without logging a script error. Verify with vpx_view or a longer run.`
      : undefined,
  };
}
