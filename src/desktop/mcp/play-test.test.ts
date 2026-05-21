import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { runPlayTest } from './play-test.js';

let dir: string;
let workDir: string;

function fakeVpx(name: string, script: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, `#!/bin/sh\n${script}\n`);
  fs.chmodSync(p, 0o755);
  return p;
}

beforeAll(async () => {
  dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vpx-playtest-test-'));
  workDir = path.join(dir, 'work');
  await fs.ensureDir(workDir);
  await fs.writeFile(path.join(workDir, 'script.vbs'), "' empty");
});

afterAll(async () => {
  await fs.remove(dir);
});

const base = {
  tableName: 'T',
  seconds: 5,
  assemble: (): Uint8Array => new Uint8Array([1]),
  log: (): void => {},
};

describe('runPlayTest', () => {
  it('flags a clean exit well before the requested time as earlyExit', async () => {
    const result = await runPlayTest({ ...base, workDir, vpinballPath: fakeVpx('quick.sh', 'exit 0') });
    expect(result.ok).toBe(true);
    expect(result.earlyExit).toBe(true);
    expect(result.note).toMatch(/exited cleanly/);
  });

  it('reports script errors from the log', async () => {
    const result = await runPlayTest({
      ...base,
      workDir,
      vpinballPath: fakeVpx('err.sh', 'echo "Script Error: object required"; exit 0'),
    });
    expect(result.ok).toBe(false);
    expect(result.errorLines.length).toBeGreaterThan(0);
  });

  it('reports a crash exit code', async () => {
    const result = await runPlayTest({ ...base, workDir, vpinballPath: fakeVpx('crash.sh', 'exit 3') });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(3);
    expect(result.earlyExit).toBe(false);
  });

  it('reports a missing or non-executable path as a launch error, not a crash', async () => {
    const result = await runPlayTest({ ...base, workDir, vpinballPath: path.join(dir, 'nope') });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
    expect(result.exitCode).toBeNull();

    const appDir = path.join(dir, 'Fake.app');
    await fs.ensureDir(appDir);
    const dirResult = await runPlayTest({ ...base, workDir, vpinballPath: appDir });
    expect(dirResult.error).toMatch(/not found/);
  });

  it('resolves a macOS .app bundle to its binary', async () => {
    const appDir = path.join(dir, 'VPinballX.app');
    await fs.ensureDir(path.join(appDir, 'Contents', 'MacOS'));
    const bin = path.join(appDir, 'Contents', 'MacOS', 'VPinballX');
    await fs.writeFile(bin, '#!/bin/sh\nexit 0\n');
    await fs.chmod(bin, 0o755);
    const result = await runPlayTest({ ...base, workDir, vpinballPath: appDir });
    expect(result.error).toBeUndefined();
    expect(result.exitCode).toBe(0);
  });

  it('kills a hung process at the deadline and reports timedOut', async () => {
    const pidFile = path.join(dir, 'hung.pid');
    const result = await runPlayTest({
      ...base,
      workDir,
      seconds: 1,
      vpinballPath: fakeVpx('hung.sh', `echo $$ > ${pidFile}; sleep 30`),
    });
    expect(result.timedOut).toBe(true);
    expect(result.ok).toBe(true);
    const pid = Number(await fs.readFile(pidFile, 'utf-8'));
    await new Promise(r => setTimeout(r, 200));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('ignores benign lines that merely contain "exception"', async () => {
    const result = await runPlayTest({
      ...base,
      workDir,
      vpinballPath: fakeVpx('benign.sh', 'echo "exception handling enabled"; exit 0'),
    });
    expect(result.errorLines).toEqual([]);
  });
});
