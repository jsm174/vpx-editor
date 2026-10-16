import { describe, expect, it } from 'vitest';
import { insertShortcuts } from './insert-shortcuts.js';

describe('insertShortcuts', () => {
  it('takes the shortcut of each Insert item', () => {
    const shortcuts = insertShortcuts(false);
    expect(shortcuts.Gate).toBe('Ctrl+G');
    expect(shortcuts.Trigger).toBe('Ctrl+T');
    expect(shortcuts.Rubber).toBe('Ctrl+U');
  });

  it('maps menu names that differ from the toolbar element types', () => {
    const shortcuts = insertShortcuts(false);
    expect(shortcuts.TextBox).toBe('Ctrl+E');
    expect(shortcuts.Textbox).toBeUndefined();
  });

  it('leaves out elements that have no shortcut', () => {
    const shortcuts = insertShortcuts(false);
    for (const type of ['Wall', 'Ramp', 'HitTarget', 'Reel']) {
      expect(shortcuts[type]).toBeUndefined();
    }
  });

  it('uses the Mac key symbols on a Mac', () => {
    expect(insertShortcuts(true).Gate).toBe('⌘G');
  });
});
