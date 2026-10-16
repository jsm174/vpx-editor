import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';

const supportCache = new Map<string, boolean>();

export function helpMentionsOption(help: string, option: string): boolean {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'im').test(help);
}

async function cacheKey(executable: string, option: string): Promise<string | null> {
  try {
    const { mtimeMs, size } = await stat(executable);
    return `${executable}|${mtimeMs}|${size}|${option}`;
  } catch {
    return null;
  }
}

function probeHelp(command: string, args: string[], option: string): Promise<boolean | null> {
  return new Promise(resolve => {
    execFile(command, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const output = `${stdout}\n${stderr}`;
      if (helpMentionsOption(output, option)) return resolve(true);
      resolve(err && !output.trim() ? null : false);
    });
  });
}

export async function vpinballSupportsOption(
  executable: string,
  option: string,
  viaFlatpakHost = false,
  platform: NodeJS.Platform = process.platform
): Promise<boolean | null> {
  if (platform === 'win32') return null;
  const key = await cacheKey(executable, option);
  if (key !== null && supportCache.has(key)) return supportCache.get(key)!;
  const command = viaFlatpakHost ? 'flatpak-spawn' : executable;
  const args = viaFlatpakHost ? ['--host', executable, '-h'] : ['-h'];
  const result = await probeHelp(command, args, option);
  if (key !== null && result !== null) supportCache.set(key, result);
  return result;
}
