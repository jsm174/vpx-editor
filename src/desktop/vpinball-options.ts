import { execFile } from 'node:child_process';

export function helpMentionsOption(help: string, option: string): boolean {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'im').test(help);
}

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
      resolve(err && !output.trim() ? null : false);
    });
  });
}
