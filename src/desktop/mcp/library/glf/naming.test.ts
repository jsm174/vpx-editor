import { describe, it, expect } from 'vitest';
import { normalizeBase, glfName, NameRegistry } from './naming.js';

describe('normalizeBase', () => {
  it('lowercases and collapses separators', () => {
    expect(normalizeBase('Left Scoop!')).toBe('left_scoop');
    expect(normalizeBase('  VUK--Hole  ')).toBe('vuk_hole');
  });
});

describe('glfName', () => {
  it('prefixes by kind', () => {
    expect(glfName('switch', 'Scoop')).toBe('s_scoop');
    expect(glfName('coil', 'left flipper')).toBe('c_left_flipper');
  });
  it('is idempotent when already prefixed', () => {
    expect(glfName('switch', 's_scoop')).toBe('s_scoop');
  });
});

describe('NameRegistry', () => {
  it('allocates a clean name when no collision', () => {
    const reg = new NameRegistry([]);
    expect(reg.allocate('switch', 'scoop')).toBe('s_scoop');
  });

  it('avoids collisions with existing table part names', () => {
    const reg = new NameRegistry(['s_scoop']);
    expect(reg.allocate('switch', 'scoop')).toBe('s_scoop1');
  });

  it('avoids collisions among newly allocated names', () => {
    const reg = new NameRegistry([]);
    expect(reg.allocate('switch', 'scoop')).toBe('s_scoop');
    expect(reg.allocate('switch', 'scoop')).toBe('s_scoop1');
  });
});
