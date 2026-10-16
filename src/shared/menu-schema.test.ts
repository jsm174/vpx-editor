import { describe, expect, it } from 'vitest';
import { getAllMenuItems, getMenuItemById } from './menu-schema.js';

const scope = (item: ReturnType<typeof getAllMenuItems>[number]) =>
  [item.playfieldOnly, item.backglassOnly, item.macOnly, item.electronOnly, item.webOnly].map(Boolean).join();

describe('menu accelerators', () => {
  it('are not shared by two items that can be active at the same time', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const item of getAllMenuItems()) {
      if (!item.accelerator) continue;
      const key = `${item.accelerator}|${scope(item)}`;
      const other = seen.get(key);
      if (other) clashes.push(`${item.accelerator}: ${other} / ${item.id}`);
      seen.set(key, item.id);
    }
    expect(clashes).toEqual([]);
  });

  it('puts Live Edit on F6 and leaves F7 unused', () => {
    expect(getMenuItemById('live-edit')).toMatchObject({ accelerator: 'F6', action: 'live-edit' });
    expect(getAllMenuItems().some(item => item.accelerator === 'F7')).toBe(false);
  });

  it('keeps Play on F5', () => {
    expect(getMenuItemById('play')).toMatchObject({ accelerator: 'F5', action: 'play' });
  });
});
