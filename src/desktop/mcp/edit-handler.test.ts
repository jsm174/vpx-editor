import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { applyEditDirect, collectImageRefsFromPart, rewriteRefs } from './edit-handler.js';

let workDir: string;

beforeEach(async () => {
  workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vpx-edit-test-'));
});

afterEach(async () => {
  await fs.remove(workDir);
});

const PNG_BASE64 = Buffer.from('fakepngbytes').toString('base64');

async function readImagesJson(): Promise<Record<string, unknown>[]> {
  return JSON.parse(await fs.promises.readFile(path.join(workDir, 'images.json'), 'utf-8'));
}

describe('applyAddImage vpin round-trip', () => {
  it('names the disk file by the raw image name so vpin read_images finds it', async () => {
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'add-image',
        payload: { name: 'Playfield Art', source: { base64: PNG_BASE64, mimeType: 'image/png' } },
        description: 'add',
      }
    );
    expect(result.success).toBe(true);
    expect(await fs.pathExists(path.join(workDir, 'images', 'Playfield Art.png'))).toBe(true);

    const entries = await readImagesJson();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ name: 'Playfield Art', path: 'Playfield Art.png' });
    const fileFromEntry = `${(entries[0].name_dedup as string) ?? (entries[0].name as string)}.${(
      entries[0].path as string
    )
      .split('.')
      .pop()}`;
    expect(await fs.pathExists(path.join(workDir, 'images', fileFromEntry))).toBe(true);
  });

  it('records name_dedup when the name has illegal filename characters', async () => {
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'add-image',
        payload: { name: 'a/b:c', source: { base64: PNG_BASE64 } },
        description: 'add',
      }
    );
    expect(result.success).toBe(true);
    const entries = await readImagesJson();
    expect(entries[0].name).toBe('a/b:c');
    expect(entries[0].name_dedup).toBe('abc');
    expect(await fs.pathExists(path.join(workDir, 'images', 'abc.png'))).toBe(true);
  });

  it('modify preserves extra entry fields and replaces the raw-named file', async () => {
    await fs.promises.writeFile(
      path.join(workDir, 'images.json'),
      JSON.stringify([{ name: 'Wheel Image', path: 'C:\\old\\Wheel Image.png', width: 64, height: 64 }])
    );
    await fs.promises.mkdir(path.join(workDir, 'images'), { recursive: true });
    await fs.promises.writeFile(path.join(workDir, 'images', 'Wheel Image.png'), 'old');

    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'modify-image',
        payload: { name: 'Wheel Image', source: { base64: PNG_BASE64, mimeType: 'image/webp' } },
        description: 'modify',
      }
    );
    expect(result.success).toBe(true);
    const entries = await readImagesJson();
    expect(entries[0]).toMatchObject({ name: 'Wheel Image', path: 'Wheel Image.webp', width: 64, height: 64 });
    expect(await fs.pathExists(path.join(workDir, 'images', 'Wheel Image.webp'))).toBe(true);
    expect(await fs.pathExists(path.join(workDir, 'images', 'Wheel Image.png'))).toBe(false);
  });

  it('delete removes the raw-named file', async () => {
    await applyEditDirect(
      { workDir },
      { kind: 'add-image', payload: { name: 'Logo Art', source: { base64: PNG_BASE64 } }, description: 'add' }
    );
    const result = await applyEditDirect(
      { workDir },
      { kind: 'delete-image', payload: { name: 'Logo Art' }, description: 'delete' }
    );
    expect(result.success).toBe(true);
    expect(await fs.pathExists(path.join(workDir, 'images', 'Logo Art.png'))).toBe(false);
    expect(await readImagesJson()).toHaveLength(0);
  });
});

describe('replace-script-string', () => {
  it('treats $-tokens in newString literally', async () => {
    await fs.promises.writeFile(path.join(workDir, 'script.vbs'), 'Sub Foo()\nEnd Sub\n');
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'replace-script-string',
        payload: { oldString: 'Sub Foo()', newString: "Sub Foo() ' cost is $& and $$" },
        description: 'replace',
      }
    );
    expect(result.success).toBe(true);
    const script = await fs.promises.readFile(path.join(workDir, 'script.vbs'), 'utf-8');
    expect(script).toContain("Sub Foo() ' cost is $& and $$");
  });
});

describe('replace-sub with one-line subs present', () => {
  it('replaces only the targeted sub', async () => {
    const script = [
      'Sub DT1_Hit() : DropTargetsHit(0) = True : CheckDropBank : End Sub',
      'Sub CheckDropBank()',
      '    old body',
      'End Sub',
      'Sub Keep()',
      '    keep me',
      'End Sub',
    ].join('\n');
    await fs.promises.writeFile(path.join(workDir, 'script.vbs'), script);
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'replace-sub',
        payload: { subName: 'CheckDropBank', newBody: 'Sub CheckDropBank()\n    new body\nEnd Sub' },
        description: 'replace',
      }
    );
    expect(result.success).toBe(true);
    const next = await fs.promises.readFile(path.join(workDir, 'script.vbs'), 'utf-8');
    expect(next).toContain('new body');
    expect(next).not.toContain('old body');
    expect(next).toContain('DropTargetsHit(0) = True');
    expect(next).toContain('keep me');
  });
});

describe('image ref keys', () => {
  it('does not treat image_alignment as an image reference', () => {
    const part = { image: 'wrap', image_alignment: 'wrap', image_a: 'flash' };
    expect(collectImageRefsFromPart(part).sort()).toEqual(['flash', 'wrap']);

    const imageMap = new Map([['wrap', 'Cloned_wrap']]);
    const rewritten = rewriteRefs(part, new Map(), imageMap, new Map());
    expect(rewritten.image).toBe('Cloned_wrap');
    expect(rewritten.image_alignment).toBe('wrap');
  });
});

describe('direct-mode part guard', () => {
  it('rejects add-part data containing the tool-level position field', async () => {
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'add-part',
        payload: { type: 'Bumper', data: { name: 'B1', position: { x: 100, y: 200 } } },
        description: 'add',
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('position');
  });

  it('rejects modify-part patches containing position', async () => {
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'modify-part',
        payload: { name: 'B1', patch: { position: { x: 1, y: 2 } } },
        description: 'modify',
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('position');
  });

  it('still allows vpin-shaped add-part data', async () => {
    const result = await applyEditDirect(
      { workDir },
      {
        kind: 'add-part',
        payload: { type: 'Bumper', data: { name: 'B1', center: { x: 100, y: 200 } } },
        description: 'add',
      }
    );
    expect(result.success).toBe(true);
    expect(await fs.pathExists(path.join(workDir, 'gameitems', 'Bumper.B1.json'))).toBe(true);
  });
});
