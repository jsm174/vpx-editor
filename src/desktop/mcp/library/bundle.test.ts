import { describe, it, expect } from 'vitest';
import { buildBundle } from './bundle.js';
import type { TableState } from '../../../shared/table-state.js';

function makeState(script: string, soundNames: string[]): TableState {
  return {
    workDir: '/tmp/test',
    gamedata: {},
    info: {},
    items: [
      {
        type: 'Bumper',
        name: 'Bumper1',
        fileName: 'bumper1.json',
        data: { name: 'Bumper1', center: { x: 100, y: 200 } },
        ref: { file_name: 'bumper1.json' },
      },
    ],
    materials: [],
    images: [],
    sounds: soundNames.map(name => ({ name })),
    collections: [],
    script,
  };
}

describe('buildBundle sound refs', () => {
  it('collects sounds referenced as string literals in lifted subs', async () => {
    const script = [
      'Sub Bumper1_Hit()',
      '    PlaySound "fx_bumperpop"',
      '    PlaySoundAtVol "fx_ding", Bumper1, 0.5',
      'End Sub',
    ].join('\n');
    const bundle = await buildBundle(makeState(script, ['fx_bumperpop', 'fx_ding', 'fx_unused']), 'Bumper1');
    expect(bundle).not.toBeNull();
    expect(bundle!.soundRefs.sort()).toEqual(['fx_bumperpop', 'fx_ding']);
  });

  it('matches sound names case-insensitively and keeps the donor casing', async () => {
    const script = ['Sub Bumper1_Hit()', '    PlaySoundAt "FX_BUMPERPOP", Bumper1', 'End Sub'].join('\n');
    const bundle = await buildBundle(makeState(script, ['fx_BumperPop']), 'Bumper1');
    expect(bundle!.soundRefs).toEqual(['fx_BumperPop']);
  });

  it('ignores literals that are not donor sounds', async () => {
    const script = ['Sub Bumper1_Hit()', '    Debug.Print "no sound here"', 'End Sub'].join('\n');
    const bundle = await buildBundle(makeState(script, ['fx_bumperpop']), 'Bumper1');
    expect(bundle!.soundRefs).toEqual([]);
  });

  it('returns no sound refs when no subs reference the part', async () => {
    const script = ['Sub Other_Hit()', '    PlaySound "fx_bumperpop"', 'End Sub'].join('\n');
    const bundle = await buildBundle(makeState(script, ['fx_bumperpop']), 'Bumper1');
    expect(bundle!.soundRefs).toEqual([]);
  });
});
