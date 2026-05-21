import { describe, it, expect } from 'vitest';
import { summarizeDonorTable } from './inspect.js';
import type { TableState, GameItem } from '../../../shared/table-state.js';

function item(type: string, name: string): GameItem {
  return { type, name, fileName: `${type}.${name}.json`, data: { name }, ref: { file_name: `${type}.${name}.json` } };
}

function state(overrides: Partial<TableState> = {}): TableState {
  return {
    workDir: '/tmp/x',
    gamedata: { left: 0, top: 0, right: 952, bottom: 2162 },
    info: { table_name: 'Demo', author_name: 'VPW', table_version: '1.2' },
    items: [item('Flipper', 'LeftFlipper'), item('Flipper', 'RightFlipper'), item('Kicker', 'swTrough1')],
    materials: [{ name: 'Metal' }],
    images: [{ name: 'playfield', width: 2048, height: 4096 }],
    sounds: [{ name: 'ding' }],
    collections: [{ name: 'glf_lights', items: ['gi1'], fire_events: true }],
    script: 'Sub LeftFlipper_Hit()\n  PlaySound "ding"\nEnd Sub\nFunction Score(x)\n  Score = x\nEnd Function\n',
    ...overrides,
  };
}

describe('summarizeDonorTable', () => {
  it('summarizes parts, assets, collections, and the script sub index', () => {
    const s = summarizeDonorTable(state(), '/tables/Demo.vpx');
    expect(s.tableName).toBe('Demo');
    expect(s.info.author).toBe('VPW');
    expect(s.partCounts).toEqual({ Flipper: 2, Kicker: 1 });
    expect(s.partsByType.Flipper.names).toEqual(['LeftFlipper', 'RightFlipper']);
    expect(s.playfieldBounds.width).toBe(952);
    expect(s.collections[0]).toEqual({ name: 'glf_lights', fireEvents: true, items: ['gi1'] });
    expect(s.materials.names).toEqual(['Metal']);
    expect(s.images.entries[0]).toEqual({ name: 'playfield', width: 2048, height: 4096 });
    expect(s.script.subs).toEqual([
      { kind: 'sub', name: 'LeftFlipper_Hit', lines: [1, 3] },
      { kind: 'function', name: 'Score', lines: [4, 6] },
    ]);
  });

  it('falls back to the file name when the table has no name', () => {
    const s = summarizeDonorTable(state({ info: {} }), '/tables/No Name (Test 2026).vpx');
    expect(s.tableName).toBe('No Name (Test 2026)');
  });

  it('caps long name lists and reports the omission', () => {
    const many = Array.from({ length: 250 }, (_, i) => item('Light', `l${i}`));
    const s = summarizeDonorTable(state({ items: many }), '/tables/Demo.vpx');
    expect(s.partsByType.Light.names).toHaveLength(200);
    expect(s.partsByType.Light.omitted).toBe(50);
  });
});
