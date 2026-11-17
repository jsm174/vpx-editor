import { describe, it, expect } from 'vitest';
import { volumeToGain } from './core.js';

describe('volumeToGain', () => {
  it('plays a sound with no volume offset at full gain, like the vpinball preview', () => {
    expect(volumeToGain(0)).toBe(1);
  });

  it('applies negative offsets as a percentage below full gain', () => {
    expect(volumeToGain(-40)).toBeCloseTo(0.6);
    expect(volumeToGain(-100)).toBe(0);
  });

  it('saturates outside the gain range', () => {
    expect(volumeToGain(50)).toBe(1);
    expect(volumeToGain(-150)).toBe(0);
  });
});
