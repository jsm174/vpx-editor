import { beforeEach, describe, expect, it, vi } from 'vitest';

const { editorState, undoManagerMock, hitMock } = vi.hoisted(() => ({
  editorState: {
    viewMode: '2d',
    isTableLocked: false,
    lastMousePosition: { x: 0, y: 0 } as { x: number; y: number } | null,
    primarySelectedItem: null as string | null,
    selectedItems: [] as string[],
    alwaysDrawDragPoints: false,
    selectedNode: null as { itemName: string; nodeIndex: number } | null,
    selectedNodes: null as { itemName: string; indices: number[] } | null,
    items: {} as Record<string, Record<string, unknown>>,
  },
  undoManagerMock: { beginUndo: vi.fn(), markForUndo: vi.fn(), endUndo: vi.fn() },
  hitMock: vi.fn<(...args: unknown[]) => string[]>(),
}));

vi.mock('./state.js', () => ({
  state: editorState,
  undoManager: undoManagerMock,
  getItem: (name: string) => editorState.items[name] ?? editorState.items[name.toLowerCase()],
  isItemVisible: (item: { hidden?: boolean }) => !item.hidden,
  setSelection: (items: string | string[], primary: string | null = null) => {
    editorState.selectedItems = Array.isArray(items) ? items : [items];
    editorState.primarySelectedItem = primary || editorState.selectedItems[0] || null;
  },
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
import {
  addNode,
  addPointAtCursor,
  deleteSelectedNodes,
  getSelectedNodeIndices,
  moveSelectedNodes,
  nodeBoxCandidateItems,
  pickPointTarget,
  restoreNodeSelection,
  selectNodesInRect,
  snapshotNodeSelection,
  toggleNodeInSelection,
} from './node-operations.js';
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
  editorState.selectedItems = [];
  editorState.alwaysDrawDragPoints = false;
  editorState.selectedNode = null;
  editorState.selectedNodes = null;
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

  it('selects the item under the cursor when it was not selected', () => {
    editorState.primarySelectedItem = 'Wall1';
    editorState.selectedItems = ['Wall1'];
    hitMock.mockReturnValue(['Wall2']);
    addPointAtCursor(false);
    expect(editorState.selectedItems).toEqual(['Wall2']);
    expect(editorState.primarySelectedItem).toBe('Wall2');
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall2', nodeIndex: 1 });
  });
});

describe('multi-node selection', () => {
  const nodesOf = (name: string) => editorState.items[name].drag_points as { x: number; y: number }[];

  beforeEach(() => {
    editorState.selectedNode = { itemName: 'Wall1', nodeIndex: 0 };
    editorState.selectedNodes = null;
  });

  it('shift+click adds a node and makes it primary', () => {
    toggleNodeInSelection('Wall1', 2);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 2 });
    expect(getSelectedNodeIndices()).toEqual([0, 2]);
  });

  it('shift+click on a selected node removes it', () => {
    toggleNodeInSelection('Wall1', 2);
    toggleNodeInSelection('Wall1', 2);
    expect(getSelectedNodeIndices()).toEqual([0]);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 0 });
  });

  it('dragging moves every selected node by the same offset', () => {
    toggleNodeInSelection('Wall1', 2);
    moveSelectedNodes('Wall1', 2, 13, 12);
    expect(nodesOf('Wall1')[2]).toMatchObject({ x: 13, y: 12 });
    expect(nodesOf('Wall1')[0]).toMatchObject({ x: 3, y: 2 });
    expect(nodesOf('Wall1')[1]).toMatchObject({ x: 10, y: 0 });
  });

  it('moves only the primary node when nothing else is selected', () => {
    moveSelectedNodes('Wall1', 0, 5, 5);
    expect(nodesOf('Wall1')[0]).toMatchObject({ x: 5, y: 5 });
    expect(nodesOf('Wall1')[1]).toMatchObject({ x: 10, y: 0 });
  });

  it('delete removes all selected nodes in one undo step', () => {
    editorState.items.Wall1 = wall({
      drag_points: [...square(), { x: 5, y: 5, smooth: false }, { x: 6, y: 6, smooth: false }],
    });
    toggleNodeInSelection('Wall1', 1);
    toggleNodeInSelection('Wall1', 3);
    deleteSelectedNodes();
    expect(nodesOf('Wall1').map(p => p.x)).toEqual([10, 5, 6]);
    expect(editorState.selectedNode).toBeNull();
    expect(undoManagerMock.beginUndo).toHaveBeenCalledTimes(1);
    expect(undoManagerMock.endUndo).toHaveBeenCalledTimes(1);
  });

  it('delete does nothing when it would leave too few points', () => {
    toggleNodeInSelection('Wall1', 1);
    toggleNodeInSelection('Wall1', 2);
    deleteSelectedNodes();
    expect(nodesOf('Wall1')).toHaveLength(4);
  });

  it('delete does nothing on a locked item', () => {
    editorState.items.Wall1 = wall({ is_locked: true, drag_points: [...square(), { x: 5, y: 5, smooth: false }] });
    deleteSelectedNodes();
    expect(nodesOf('Wall1')).toHaveLength(5);
    toggleNodeInSelection('Wall1', 1);
    deleteSelectedNodes();
    expect(nodesOf('Wall1')).toHaveLength(5);
    expect(saveItemToFile).not.toHaveBeenCalled();
  });

  it('adding a point drops the group, since node indices shift', () => {
    toggleNodeInSelection('Wall1', 2);
    addNode('Wall1', 20, 5);
    expect(editorState.selectedNodes).toBeNull();
    expect(getSelectedNodeIndices()).toEqual([1]);
  });
});

describe('window selection of control points', () => {
  // Covers only the corner at (10, 10), which is node 2 of the square.
  const aroundNode2 = { startX: 9, endX: 11, startY: 9, endY: 11 };
  const nodesOf = (name: string) => editorState.items[name].drag_points as { x: number; y: number }[];

  it('picks points of any visible item when every item may be picked', () => {
    editorState.items.Wall1 = wall({ drag_points: [{ x: 100, y: 100 }] });
    const picked = selectNodesInRect(aroundNode2, null, null);
    expect(picked).toBe(true);
    expect(editorState.primarySelectedItem).toBe('Wall2');
    expect(editorState.selectedItems).toEqual(['Wall2']);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall2', nodeIndex: 2 });
  });

  it('uses the item name rather than the lowercase key when every item may be picked', () => {
    editorState.items = {
      wall1: wall({ name: 'Wall1' }),
      wall2: wall({ name: 'Wall2', drag_points: [{ x: 100, y: 100 }] }),
    };
    expect(selectNodesInRect(aroundNode2, null, null)).toBe(true);
    expect(editorState.selectedItems).toEqual(['Wall1']);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 2 });
  });

  it('prefers the selected item regardless of name case', () => {
    editorState.items = { wall1: wall({ name: 'Wall1' }), wall2: wall({ name: 'Wall2' }) };
    editorState.primarySelectedItem = 'WALL2';
    expect(selectNodesInRect(aroundNode2, null, null)).toBe(true);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall2', nodeIndex: 2 });
  });

  it('only considers the listed items otherwise', () => {
    editorState.items.Wall1 = wall({ drag_points: [{ x: 100, y: 100 }] });
    expect(selectNodesInRect(aroundNode2, ['Wall1'], null)).toBe(false);
    expect(editorState.selectedNode).toBeNull();
  });

  it('skips hidden items', () => {
    editorState.items.Wall1 = wall({ drag_points: [{ x: 100, y: 100 }] });
    editorState.items.Wall2 = wall({ hidden: true });
    expect(selectNodesInRect(aroundNode2, null, null)).toBe(false);
  });

  it('leaves the selection alone when no point is inside the box', () => {
    editorState.selectedNode = { itemName: 'Wall1', nodeIndex: 0 };
    expect(selectNodesInRect({ startX: 50, endX: 60, startY: 50, endY: 60 }, null, null)).toBe(false);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 0 });
  });

  it('selects every point inside the box, with the last one primary', () => {
    selectNodesInRect({ startX: -1, endX: 11, startY: -1, endY: 1 }, ['Wall1'], null);
    expect(getSelectedNodeIndices()).toEqual([0, 1]);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 1 });
  });

  it('appends to the base selection of the same item', () => {
    selectNodesInRect(aroundNode2, ['Wall1'], { itemName: 'Wall1', indices: [0] });
    expect(getSelectedNodeIndices()).toEqual([0, 2]);
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 2 });
  });

  it('does not duplicate points that are already in the base selection', () => {
    selectNodesInRect(aroundNode2, ['Wall1'], { itemName: 'Wall1', indices: [2, 3] });
    expect(getSelectedNodeIndices()).toEqual([2, 3]);
  });

  it('ignores a base selection from another item', () => {
    selectNodesInRect(aroundNode2, ['Wall1'], { itemName: 'Wall2', indices: [0, 1] });
    expect(getSelectedNodeIndices()).toEqual([2]);
  });

  it('matches the base item name regardless of case', () => {
    selectNodesInRect(aroundNode2, ['Wall1'], { itemName: 'wall1', indices: [0] });
    expect(getSelectedNodeIndices()).toEqual([0, 2]);
  });

  it('lets the selected points be moved together afterwards', () => {
    selectNodesInRect({ startX: -1, endX: 11, startY: -1, endY: 1 }, ['Wall1'], null);
    moveSelectedNodes('Wall1', 1, 20, 5);
    expect(nodesOf('Wall1')[1]).toMatchObject({ x: 20, y: 5 });
    expect(nodesOf('Wall1')[0]).toMatchObject({ x: 10, y: 5 });
  });
});

describe('node selection snapshots', () => {
  it('is null when no point is selected', () => {
    expect(snapshotNodeSelection()).toBeNull();
  });

  it('round-trips a multi-point selection', () => {
    restoreNodeSelection({ itemName: 'Wall1', indices: [0, 2] });
    expect(snapshotNodeSelection()).toEqual({ itemName: 'Wall1', indices: [0, 2] });
    expect(editorState.selectedNode).toEqual({ itemName: 'Wall1', nodeIndex: 2 });
  });

  it('restores a single point without a group', () => {
    restoreNodeSelection({ itemName: 'Wall1', indices: [3] });
    expect(editorState.selectedNodes).toBeNull();
    expect(snapshotNodeSelection()).toEqual({ itemName: 'Wall1', indices: [3] });
  });
});

describe('nodeBoxCandidateItems', () => {
  it('is every item when control points are always drawn', () => {
    editorState.alwaysDrawDragPoints = true;
    editorState.selectedItems = ['Wall1'];
    expect(nodeBoxCandidateItems()).toBeNull();
  });

  it('is the selected items otherwise', () => {
    editorState.selectedItems = ['Wall1'];
    expect(nodeBoxCandidateItems()).toEqual(['Wall1']);
  });
});
