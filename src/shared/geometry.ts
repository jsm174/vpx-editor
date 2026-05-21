import type { Point } from '../types/game-objects.js';

export interface DragPointLike {
  x?: number;
  y?: number;
  z?: number;
  [key: string]: unknown;
}

export interface RetargetOptions {
  donorOrigin: Point;
  targetOrigin: Point;
  scale?: number;
  /** Rotation about the target origin, in degrees (VPX orientation fields are degrees). */
  rotation?: number;
}

export function translateDragPoints(points: DragPointLike[], dx: number, dy: number): DragPointLike[] {
  return points.map(p => ({ ...p, x: (p.x ?? 0) + dx, y: (p.y ?? 0) + dy }));
}

export function scaleAround(points: DragPointLike[], center: Point, factor: number): DragPointLike[] {
  return points.map(p => ({
    ...p,
    x: center.x + ((p.x ?? 0) - center.x) * factor,
    y: center.y + ((p.y ?? 0) - center.y) * factor,
  }));
}

export function rotateAround(points: DragPointLike[], center: Point, angleRad: number): DragPointLike[] {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return points.map(p => {
    const dx = (p.x ?? 0) - center.x;
    const dy = (p.y ?? 0) - center.y;
    return { ...p, x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
  });
}

const ORIENTATION_KEYS = ['orientation', 'rotation', 'rot_z', 'start_angle', 'end_angle'];

function rotateOrientationFields(out: Record<string, unknown>, degrees: number): void {
  for (const key of ORIENTATION_KEYS) {
    if (typeof out[key] === 'number') out[key] = (out[key] as number) + degrees;
  }
  const rotAndTra = out.rot_and_tra;
  if (Array.isArray(rotAndTra) && typeof rotAndTra[2] === 'number') {
    out.rot_and_tra = rotAndTra.map((v, i) => (i === 2 ? (v as number) + degrees : v));
  }
}

export function retargetPart(partData: Record<string, unknown>, opts: RetargetOptions): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(partData)) as Record<string, unknown>;
  const scale = opts.scale ?? 1;
  const degrees = opts.rotation ?? 0;
  const radians = (degrees * Math.PI) / 180;

  const translatePoint = (key: 'center' | 'position') => {
    const p = out[key] as Point | undefined;
    if (p && typeof p === 'object') {
      let x = (p.x ?? 0) - opts.donorOrigin.x;
      let y = (p.y ?? 0) - opts.donorOrigin.y;
      x *= scale;
      y *= scale;
      if (degrees !== 0) {
        const c = Math.cos(radians);
        const s = Math.sin(radians);
        const rx = x * c - y * s;
        const ry = x * s + y * c;
        x = rx;
        y = ry;
      }
      out[key] = { ...p, x: x + opts.targetOrigin.x, y: y + opts.targetOrigin.y };
    }
  };
  translatePoint('center');
  translatePoint('position');

  const dragKeys = ['drag_points', 'dragPoints'];
  for (const key of dragKeys) {
    const arr = out[key];
    if (Array.isArray(arr)) {
      let pts = arr as DragPointLike[];
      pts = translateDragPoints(pts, -opts.donorOrigin.x, -opts.donorOrigin.y);
      if (scale !== 1) pts = scaleAround(pts, { x: 0, y: 0 }, scale);
      if (degrees !== 0) pts = rotateAround(pts, { x: 0, y: 0 }, radians);
      pts = translateDragPoints(pts, opts.targetOrigin.x, opts.targetOrigin.y);
      out[key] = pts;
    }
  }

  if (degrees !== 0) rotateOrientationFields(out, degrees);

  const sizeKeys = ['size', 'size_x', 'size_y', 'size_z', 'radius', 'width', 'height', 'length'];
  if (scale !== 1) {
    for (const key of sizeKeys) {
      const v = out[key];
      if (typeof v === 'number') {
        out[key] = v * scale;
      } else if (v && typeof v === 'object' && 'x' in v) {
        const p = v as Point & { z?: number };
        out[key] = {
          ...p,
          x: (p.x ?? 0) * scale,
          y: (p.y ?? 0) * scale,
          z: p.z !== undefined ? p.z * scale : undefined,
        };
      }
    }
  }

  return out;
}
