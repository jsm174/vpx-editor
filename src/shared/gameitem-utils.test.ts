import { describe, it, expect } from 'vitest';
import { clampPrimitiveSides } from './gameitem-utils.js';

describe('clampPrimitiveSides', () => {
  it('keeps the sides vpinball accepts', () => {
    expect(clampPrimitiveSides(3)).toBe(3);
    expect(clampPrimitiveSides(42)).toBe(42);
    expect(clampPrimitiveSides(100)).toBe(100);
  });

  it('clamps to 3..100 like vpinball does on load', () => {
    expect(clampPrimitiveSides(0)).toBe(3);
    expect(clampPrimitiveSides(-5)).toBe(3);
    expect(clampPrimitiveSides(101)).toBe(100);
    expect(clampPrimitiveSides(5000)).toBe(100);
  });

  it('rounds fractional and rejects non-finite values', () => {
    expect(clampPrimitiveSides(4.6)).toBe(5);
    expect(clampPrimitiveSides(Number.NaN)).toBe(3);
    expect(clampPrimitiveSides(Number.POSITIVE_INFINITY)).toBe(3);
  });
});
