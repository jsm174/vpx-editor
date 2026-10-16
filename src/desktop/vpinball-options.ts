import { execFile } from 'node:child_process';

/** True when a `-h` usage dump lists the given command line option, e.g. `-LiveEdit`. */
export function helpMentionsOption(help: string, option: string): boolean {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'im').test(help);
}

/**
 * Asks a VPinballX executable whether it knows a command line option, by reading its `-h` usage text.
 * Older builds print a usage dump and exit for options they do not know, so check before launching with one.
 * Returns null when the executable could not be run, so callers can fall back to launching and reporting the error.
 */
export function vpinballSupportsOption(
  executable: string,
  option: string,
  viaFlatpakHost = false
): Promise<boolean | null> {
  const command = viaFlatpakHost ? 'flatpak-spawn' : executable;
  const args = viaFlatpakHost ? ['--host', executable, '-h'] : ['-h'];
  return new Promise(resolve => {
    execFile(command, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const output = `${stdout}\n${stderr}`;
      if (helpMentionsOption(output, option)) return resolve(true);
      // -h may exit non-zero; any usage text at all means the executable ran and does not list the option.
      resolve(err && !output.trim() ? null : false);
    });
  });
}
