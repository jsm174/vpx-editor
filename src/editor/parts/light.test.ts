import { beforeEach, describe, expect, it, vi } from 'vitest';

const { editorState, strokes } = vi.hoisted(() => {
  const strokes: { color: string; width: number }[] = [];
  const ctx = {
    strokeStyle: '' as string,
    fillStyle: '' as string,
    lineWidth: 1,
    beginPath: () => {},
    arc: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke() {
      strokes.push({ color: this.strokeStyle, width: this.lineWidth });
    },
  };
  return {
    strokes,
    editorState: {
      state: {
        zoom: 1,
        panX: 0,
        panY: 0,
        viewSolid: false,
        drawLightCenters: false,
        editorColors: undefined,
      } as Record<string, unknown>,
      elements: { ctx } as Record<string, unknown>,
    },
  };
});

vi.mock('../state.js', () => ({
  state: editorState.state,
  elements: editorState.elements,
  isItemVisible: () => true,
  getItem: () => undefined,
  getItemByFileName: () => undefined,
}));
vi.mock('../texture-loader.js', () => ({ loadTexture: vi.fn() }));

import { DEFAULT_ELEMENT_SELECT_COLOR, DEFAULT_ELEMENT_SELECT_LOCKED_COLOR } from '../../shared/constants.js';
import { uiRenderPass2 } from './light.js';

const light = (extra: Record<string, unknown> = {}) => ({ center: { x: 10, y: 10 }, falloff_radius: 50, ...extra });

describe('light outline colour', () => {
  beforeEach(() => {
    strokes.length = 0;
  });

  it('is black and thin for a plain unselected light', () => {
    uiRenderPass2(light(), false);
    expect(strokes[0]).toEqual({ color: '#000000', width: 1 });
  });

  it('switches to the locked colour when the light is locked', () => {
    uiRenderPass2(light({ is_locked: true }), false);
    expect(strokes[0].color).toBe(DEFAULT_ELEMENT_SELECT_LOCKED_COLOR);
    expect(strokes[0].width).toBe(1);
  });

  it('uses the selection colour and a thicker line when selected', () => {
    uiRenderPass2(light(), true);
    expect(strokes[0]).toEqual({ color: DEFAULT_ELEMENT_SELECT_COLOR, width: 4 });
  });

  it('keeps the locked colour when a locked light is selected', () => {
    uiRenderPass2(light({ is_locked: true }), true);
    expect(strokes[0].color).toBe(DEFAULT_ELEMENT_SELECT_LOCKED_COLOR);
  });

  it('colours the outline and the cross of a custom shape but keeps the falloff circle red', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ];
    uiRenderPass2(light({ drag_points: points, is_locked: true }), false);
    const colors = strokes.map(s => s.color);
    expect(colors[0]).toBe('#ff0000');
    expect(colors.slice(1).every(c => c === DEFAULT_ELEMENT_SELECT_LOCKED_COLOR)).toBe(true);
  });
});
