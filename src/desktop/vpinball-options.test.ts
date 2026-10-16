import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { helpMentionsOption, vpinballSupportsOption } from './vpinball-options.js';

const OLD_HELP = `Visual Pinball Usage
Valid Parameters are:
-h
-Play  [filename]  Load and play file
-PovEdit  [filename]  Load and run file in live editing mode, then export new pov on exit
`;
const NEW_HELP = `${OLD_HELP}-LiveEdit [opt filename]  Start in live editor mode
`;

describe('helpMentionsOption', () => {
  it('finds an option listed in the usage text', () => {
    expect(helpMentionsOption(NEW_HELP, '-LiveEdit')).toBe(true);
  });

  it('ignores case', () => {
    expect(helpMentionsOption('-liveedit [file]', '-LiveEdit')).toBe(true);
  });

  it('does not match another option or a mention inside prose', () => {
    expect(helpMentionsOption(OLD_HELP, '-LiveEdit')).toBe(false);
    expect(helpMentionsOption('use -LiveEditor for that', '-LiveEdit')).toBe(false);
  });
});

describe.skipIf(process.platform === 'win32')('vpinballSupportsOption', () => {
  let dir: string;
  const script = async (name: string, body: string, code = 0) => {
    const file = path.join(dir, name);
    await fs.writeFile(file, `#!/bin/sh\ncat <<'EOF'\n${body}\nEOF\nexit ${code}\n`, { mode: 0o755 });
    return file;
  };

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vpinball-options-'));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('is true for a build that lists the option', async () => {
    expect(await vpinballSupportsOption(await script('new.sh', NEW_HELP), '-LiveEdit')).toBe(true);
  });

  it('is false for a build that does not, even when -h exits non-zero', async () => {
    expect(await vpinballSupportsOption(await script('old.sh', OLD_HELP, 1), '-LiveEdit')).toBe(false);
  });

  it('is null when the executable cannot be run', async () => {
    expect(await vpinballSupportsOption(path.join(dir, 'missing'), '-LiveEdit')).toBeNull();
  });
});
