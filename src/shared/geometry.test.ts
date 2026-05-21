import { describe, it, expect } from 'vitest';
import { retargetPart } from './geometry.js';

const origin = { x: 100, y: 100 };

describe('retargetPart rotation', () => {
  it('takes degrees and rotates the center about the target origin', () => {
    const out = retargetPart(
      { center: { x: 110, y: 100 } },
      { donorOrigin: origin, targetOrigin: origin, rotation: 90 }
    );
    const c = out.center as { x: number; y: number };
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(110);
  });

  it('rotates drag points', () => {
    const out = retargetPart(
      {
        drag_points: [
          { x: 100, y: 100 },
          { x: 100, y: 110 },
        ],
      },
      { donorOrigin: origin, targetOrigin: { x: 0, y: 0 }, rotation: 180 }
    );
    const pts = out.drag_points as { x: number; y: number }[];
    expect(pts[1].x).toBeCloseTo(0);
    expect(pts[1].y).toBeCloseTo(-10);
  });

  it('turns each type orientation field by the same degrees', () => {
    const opts = { donorOrigin: origin, targetOrigin: origin, rotation: 30 };
    expect(retargetPart({ start_angle: 120.5, end_angle: 70 }, opts)).toMatchObject({
      start_angle: 150.5,
      end_angle: 100,
    });
    expect(retargetPart({ orientation: 0 }, opts)).toMatchObject({ orientation: 30 });
    expect(retargetPart({ rotation: -60 }, opts)).toMatchObject({ rotation: -30 });
    expect(retargetPart({ rot_z: 10 }, opts)).toMatchObject({ rot_z: 40 });
    expect(retargetPart({ rot_and_tra: [0, 0, 45, 0, 0, 0, 0, 0, -68] }, opts)).toMatchObject({
      rot_and_tra: [0, 0, 75, 0, 0, 0, 0, 0, -68],
    });
  });

  it('leaves orientation fields alone when rotation is 0', () => {
    const out = retargetPart(
      { orientation: 12, center: { x: 5, y: 5 } },
      { donorOrigin: origin, targetOrigin: origin }
    );
    expect(out.orientation).toBe(12);
  });
});
