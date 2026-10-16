import { beforeEach, describe, expect, it, vi } from 'vitest';

const { editorState, undoManagerMock, hitMock } = vi.hoisted(() => ({
  editorState: {
    viewMode: '2d',
    isTableLocked: false,
    lastMousePosition: { x: 0, y: 0 } as { x: number; y: number } | null,
    primarySelectedItem: null as string | null,
    selectedNode: null as unknown,
    items: {} as Record<string, Record<string, unknown>>,
  },
  undoManagerMock: { beginUndo: vi.fn(), markForUndo: vi.fn(), endUndo: vi.fn() },
  hitMock: vi.fn<(...args: unknown[]) => string[]>(),
}));

vi.mock('./state.js', () => ({
  state: editorState,
  undoManager: undoManagerMock,
  getItem: (name: string) => editorState.items[name],
}));
vi.mock('./table-loader.js', () => ({ saveItemToFile: vi.fn() }));
vi.mock('./properties-panel.js', () => ({ updatePropertiesPanel: vi.fn() }));
vi.mock('./canvas-renderer.js', () => ({ render: vi.fn() }));
vi.mock('./utils.js', () => ({
  findItemsAtPoint: hitMock,
  // Always inserts after the first point, so the tests can see where the splice lands.
  findClosestSegmentIndex: () => 1,
}));

import { VIEW_MODE_3D } from '../shared/constants.js';
import { addNode, addPointAtCursor, pickPointTarget } from './node-operations.js';
import { saveItemToFile } from './table-loader.js';

const square = () => [
  { x: 0, y: 0, smooth: false },
  { x: 10, y: 0, smooth: false },
  { x: 10, y: 10, smooth: false },
  { x: 0, y: 10, smooth: false },
];
const wall = (extra: Record<string, unknown> = {}) => ({ _type: 'Wall', drag_points: square(), ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  editorState.viewMode = '2d';
  editorState.isTableLocked = false;
  editorState.lastMousePosition = { x: 20, y: 5 };
  editorState.primarySelectedItem = null;
  editorState.selectedNode = null;
  editorState.items = { Wall1: wall(), Wall2: wall() };
  hitMock.mockReturnValue([]);
});

describe('addNode', () => {
  it('inserts a sharp point at the given position and selects it', () => {
    addNode('Wall1', 20, 5, false);
    const pts = editorState.items.Wall1.drag_points as { x: number; y: number; smooth: boolean }[];
    expect(pts).toHaveLength(5);
    expect(pts[1]).toMatchObject({ x: 20, y: 5, smooth: false });
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 1 });
    expect(saveItemToFile).toHaveBeenCalledWith('Wall1');
  });

  it('sets smooth when asked', () => {
    addNode('Wall1', 20, 5, true);
    expect((editorState.items.Wall1.drag_points as { smooth: boolean }[])[1].smooth).toBe(true);
  });

  it('is a single undo step', () => {
    addNode('Wall1', 20, 5);
    expect(undoManagerMock.beginUndo).toHaveBeenCalledTimes(1);
    expect(undoManagerMock.endUndo).toHaveBeenCalledTimes(1);
  });
});

describe('pickPointTarget', () => {
  it('prefers the selected item when it is under the cursor', () => {
    expect(pickPointTarget(['Wall2', 'Wall1'], 'Wall1')).toBe('Wall1');
  });

  it('falls back to the topmost hit when the selection is not under the cursor', () => {
    expect(pickPointTarget(['Wall2', 'Wall1'], null)).toBe('Wall2');
  });

  it('falls back to the selection when the cursor is over nothing', () => {
    expect(pickPointTarget([], 'Wall1')).toBe('Wall1');
  });

  it('returns null when nothing is hit or selected', () => {
    expect(pickPointTarget([], null)).toBeNull();
  });

  it('skips locked items and types without editable points', () => {
    editorState.items.Wall2 = wall({ is_locked: true });
    editorState.items.Bumper1 = { _type: 'Bumper' };
    expect(pickPointTarget(['Bumper1', 'Wall2', 'Wall1'], null)).toBe('Wall1');
    expect(pickPointTarget(['Bumper1', 'Wall2'], 'Wall2')).toBeNull();
  });
});

describe('addPointAtCursor', () => {
  it('adds a sharp point at the cursor for F10 even when the cursor is outside the shape', () => {
    editorState.primarySelectedItem = 'Wall1';
    addPointAtCursor(false);
    const pts = editorState.items.Wall1.drag_points as { x: number; y: number; smooth: boolean }[];
    expect(pts[1]).toMatchObject({ x: 20, y: 5, smooth: false });
  });

  it('adds a smooth point for F11', () => {
    hitMock.mockReturnValue(['Wall1']);
    addPointAtCursor(true);
    expect((editorState.items.Wall1.drag_points as { smooth: boolean }[])[1].smooth).toBe(true);
  });

  it('does nothing in 3D view, on a locked table, or without a cursor position', () => {
    editorState.primarySelectedItem = 'Wall1';
    editorState.viewMode = VIEW_MODE_3D;
    addPointAtCursor(false);
    editorState.viewMode = '2d';
    editorState.isTableLocked = true;
    addPointAtCursor(false);
    editorState.isTableLocked = false;
    editorState.lastMousePosition = null;
    addPointAtCursor(false);
    expect(editorState.items.Wall1.drag_points).toHaveLength(4);
  });

  it('does nothing when there is no editable target', () => {
    addPointAtCursor(false);
    expect(saveItemToFile).not.toHaveBeenCalled();
  });
});
