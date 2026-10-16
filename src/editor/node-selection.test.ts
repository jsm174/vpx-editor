import { describe, expect, it } from 'vitest';
import { mergeNodeIndices, pickNodesInRect, selectedNodeIndices, toggleNodeSelection } from './node-selection.js';

describe('selectedNodeIndices', () => {
  it('is empty without a primary node', () => {
    expect(selectedNodeIndices(null, { itemName: 'Wall1', indices: [1, 2] })).toEqual([]);
  });

  it('falls back to the primary node alone without a group', () => {
    expect(selectedNodeIndices({ itemName: 'Wall1', nodeIndex: 3 }, null)).toEqual([3]);
  });

  it('uses the group while it matches the primary node', () => {
    expect(selectedNodeIndices({ itemName: 'Wall1', nodeIndex: 2 }, { itemName: 'Wall1', indices: [1, 2] })).toEqual([
      1, 2,
    ]);
  });

  it('matches item names regardless of case', () => {
    expect(
      selectedNodeIndices({ itemName: 'Rubber1', nodeIndex: 2 }, { itemName: 'rubber1', indices: [1, 2] })
    ).toEqual([1, 2]);
  });

  it('ignores a stale group for another item or one that lost the primary node', () => {
    expect(selectedNodeIndices({ itemName: 'Wall1', nodeIndex: 2 }, { itemName: 'Wall2', indices: [1, 2] })).toEqual([
      2,
    ]);
    expect(selectedNodeIndices({ itemName: 'Wall1', nodeIndex: 5 }, { itemName: 'Wall1', indices: [1, 2] })).toEqual([
      5,
    ]);
  });
});

describe('toggleNodeSelection', () => {
  it('adds a node and makes it primary', () => {
    expect(toggleNodeSelection([0], 2)).toEqual({ indices: [0, 2], primary: 2 });
  });

  it('removes a node and promotes the latest remaining one', () => {
    expect(toggleNodeSelection([0, 1, 2], 2)).toEqual({ indices: [0, 1], primary: 1 });
  });

  it('clears the selection when the last node is removed', () => {
    expect(toggleNodeSelection([4], 4)).toEqual({ indices: [], primary: null });
  });
});

describe('pickNodesInRect', () => {
  const rect = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
  const line = (name: string, xs: number[]) => ({ name, points: xs.map(x => ({ x, y: 5 })) });

  it('returns the indices of the points inside the rectangle, edges included', () => {
    expect(pickNodesInRect([line('Rubber1', [-5, 0, 3, 10, 12])], rect, null)).toEqual({
      itemName: 'Rubber1',
      indices: [1, 2, 3],
    });
  });

  it('returns null when no point is inside', () => {
    expect(pickNodesInRect([line('Rubber1', [-5, 12])], rect, null)).toBeNull();
    expect(pickNodesInRect([], rect, null)).toBeNull();
  });

  it('picks the item with the most points inside when several qualify', () => {
    const picked = pickNodesInRect([line('Wall1', [1, 2]), line('Rubber1', [1, 2, 3])], rect, null);
    expect(picked?.itemName).toBe('Rubber1');
  });

  it('prefers the given item whenever it has a point inside', () => {
    const picked = pickNodesInRect([line('Wall1', [1]), line('Rubber1', [1, 2, 3])], rect, 'Wall1');
    expect(picked).toEqual({ itemName: 'Wall1', indices: [0] });
  });
});

describe('mergeNodeIndices', () => {
  it('appends new indices and skips ones already selected', () => {
    expect(mergeNodeIndices([1, 4], [4, 2, 7])).toEqual([1, 4, 2, 7]);
  });

  it('returns the existing selection when nothing is added', () => {
    expect(mergeNodeIndices([1, 4], [])).toEqual([1, 4]);
  });
});
