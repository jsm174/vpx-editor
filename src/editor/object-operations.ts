import { state, undoManager, getItem } from './state.js';
import { GameItem, DragPoint, Point } from './state.js';
import { saveItemToFile } from './table-loader.js';
import { invalidateItem } from './canvas-renderer-3d.js';
import { getSmoothedPathCenter } from './utils.js';
import { getDragPointCoords } from '../types/game-objects.js';

const CURVE_CENTER_TYPES = ['Wall', 'Ramp', 'Rubber', 'Flasher'];
const STORED_CENTER_CURVE_TYPES = ['Light', 'Trigger'];

const TRANSFORM_KEYS = [
  'drag_points',
  'center',
  'vCenter',
  'pos',
  'position',
  'vPosition',
  'ver1',
  'ver2',
  'pos_x',
  'pos_y',
  'rotation',
  'scale_x',
  'scale_y',
];

type TransformSnapshot = Record<string, unknown>;

export let transformItemName: string | null = null;
export let transformTargets: string[] = [];
export let originalDragPoints: DragPoint[] | null = null;
let transformSnapshots: Map<string, TransformSnapshot> = new Map();

export function setTransformItemName(name: string | null): void {
  transformItemName = name;
  if (!name) {
    transformTargets = [];
    transformSnapshots = new Map();
  }
}

export function setOriginalDragPoints(points: DragPoint[] | null): void {
  originalDragPoints = points;
}

export function backupDragPoints(item: GameItem): DragPoint[] | null {
  if (!item.drag_points) return null;
  return item.drag_points.map((pt: DragPoint) => ({ ...pt }));
}

export function restoreDragPoints(item: GameItem, backup: DragPoint[] | null): void {
  if (!backup) return;
  item.drag_points = backup.map((pt: DragPoint) => ({ ...pt }));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function snapshotTransformState(item: GameItem): TransformSnapshot {
  const snap: TransformSnapshot = {};
  const record = item as unknown as Record<string, unknown>;
  for (const key of TRANSFORM_KEYS) {
    if (record[key] !== undefined) snap[key] = clone(record[key]);
  }
  return snap;
}

export function restoreTransformState(item: GameItem, snap: TransformSnapshot): void {
  const record = item as unknown as Record<string, unknown>;
  for (const key of TRANSFORM_KEYS) {
    if (snap[key] !== undefined) record[key] = clone(snap[key]);
    else delete record[key];
  }
}

function anchorPoint(item: GameItem): Point | null {
  const it = item as unknown as Record<string, Point | undefined> & { pos_x?: number; pos_y?: number };
  if (it.center) return { x: it.center.x, y: it.center.y };
  if (it.vCenter) return { x: it.vCenter.x, y: it.vCenter.y };
  if (it.pos) return { x: it.pos.x, y: it.pos.y };
  if (it.vPosition) return { x: it.vPosition.x, y: it.vPosition.y };
  if (it.position) return { x: it.position.x, y: it.position.y };
  if (it.ver1) return { x: it.ver1.x, y: it.ver1.y };
  if (it.pos_x !== undefined && it.pos_y !== undefined) return { x: it.pos_x, y: it.pos_y };
  return null;
}

function rawPointsCenter(points: DragPoint[]): Point | null {
  if (points.length === 0) return null;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const pt of points) {
    const { x, y } = getDragPointCoords(pt);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function getObjectCenter(item: GameItem): Point {
  const type = item._type;
  if (CURVE_CENTER_TYPES.includes(type) && item.drag_points && item.drag_points.length > 0) {
    return getSmoothedPathCenter(item.drag_points, true) ?? rawPointsCenter(item.drag_points) ?? { x: 0, y: 0 };
  }
  const anchor = anchorPoint(item);
  if (anchor) return anchor;
  if (item.drag_points && item.drag_points.length > 0) {
    return rawPointsCenter(item.drag_points) ?? { x: 0, y: 0 };
  }
  return { x: 0, y: 0 };
}

export function getMultiSelCenter(itemNames: string[]): Point {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const name of itemNames) {
    const item = getItem(name);
    if (!item) continue;
    const c = getObjectCenter(item);
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  if (!isFinite(minX)) return { x: 0, y: 0 };
  return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
}

function translatePoints(points: DragPoint[], dx: number, dy: number): void {
  for (const pt of points) {
    if (pt.vertex) {
      pt.vertex.x += dx;
      pt.vertex.y += dy;
    } else if (pt.x !== undefined && pt.y !== undefined) {
      pt.x += dx;
      pt.y += dy;
    }
  }
}

function reversePointOrder(points: DragPoint[]): void {
  if (points.length === 0) return;
  points.reverse();
  const slingshotTemp = points[0].is_slingshot;
  for (let i = 0; i < points.length - 1; i++) {
    points[i].is_slingshot = points[i + 1].is_slingshot;
  }
  points[points.length - 1].is_slingshot = slingshotTemp;
}

function flipPoints(points: DragPoint[], center: Point, axis: 'x' | 'y'): void {
  for (const pt of points) {
    if (pt.vertex) {
      pt.vertex[axis] -= (pt.vertex[axis] - center[axis]) * 2;
    } else if (pt[axis] !== undefined) {
      pt[axis] = pt[axis]! - (pt[axis]! - center[axis]) * 2;
    }
  }
  reversePointOrder(points);
}

function rotatePoints(points: DragPoint[], angle: number, center: Point): void {
  const rad = (angle * Math.PI) / 180;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  for (const pt of points) {
    const p = pt.vertex ?? (pt as { x?: number; y?: number });
    if (p.x === undefined || p.y === undefined) continue;
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    p.x = center.x + cs * dx - sn * dy;
    p.y = center.y + cs * dy + sn * dx;
  }
}

function scalePoints(points: DragPoint[], scaleX: number, scaleY: number, center: Point): void {
  for (const pt of points) {
    const p = pt.vertex ?? (pt as { x?: number; y?: number });
    if (p.x === undefined || p.y === undefined) continue;
    p.x = center.x + (p.x - center.x) * scaleX;
    p.y = center.y + (p.y - center.y) * scaleY;
  }
}

function storedCenter(item: GameItem): Point | null {
  if (item.center) return item.center;
  if (item.vCenter) return item.vCenter;
  return null;
}

export function applyTranslate(item: GameItem, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const it = item as unknown as Record<string, Point | undefined> & { pos_x?: number; pos_y?: number };
  for (const key of ['center', 'vCenter', 'pos', 'position', 'vPosition', 'ver1', 'ver2']) {
    const p = it[key];
    if (p) {
      p.x += dx;
      p.y += dy;
    }
  }
  if (it.pos_x !== undefined) it.pos_x += dx;
  if (it.pos_y !== undefined) it.pos_y += dy;
  if (item.drag_points) translatePoints(item.drag_points, dx, dy);
}

export function applyFlip(item: GameItem, axis: 'x' | 'y', center: Point): void {
  const type = item._type;
  if (item.drag_points && (CURVE_CENTER_TYPES.includes(type) || STORED_CENTER_CURVE_TYPES.includes(type))) {
    flipPoints(item.drag_points, center, axis);
    const c = storedCenter(item);
    if (c) c[axis] -= (c[axis] - center[axis]) * 2;
    if (type === 'Flasher') {
      const derived = getObjectCenter(item);
      if (item.pos_x !== undefined) item.pos_x = derived.x;
      if (item.pos_y !== undefined) item.pos_y = derived.y;
    }
    return;
  }
  const c = getObjectCenter(item);
  if (axis === 'x') applyTranslate(item, -2 * (c.x - center.x), 0);
  else applyTranslate(item, 0, -2 * (c.y - center.y));
}

export function applyRotation(item: GameItem, angle: number, center: Point, useElementCenter: boolean): void {
  const type = item._type;
  const rad = (angle * Math.PI) / 180;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);

  if (item.drag_points && (CURVE_CENTER_TYPES.includes(type) || STORED_CENTER_CURVE_TYPES.includes(type))) {
    rotatePoints(item.drag_points, angle, useElementCenter ? getObjectCenter(item) : center);
    const c = storedCenter(item);
    if (c && !useElementCenter) {
      const dx = c.x - center.x;
      const dy = c.y - center.y;
      c.x = center.x + cs * dx - sn * dy;
      c.y = center.y + cs * dy + sn * dx;
    }
    if (type === 'Trigger') item.rotation = ((item.rotation as number | undefined) ?? 0) + angle;
    if (type === 'Flasher') {
      const derived = getObjectCenter(item);
      if (item.pos_x !== undefined) item.pos_x = derived.x;
      if (item.pos_y !== undefined) item.pos_y = derived.y;
    }
    return;
  }

  const c = getObjectCenter(item);
  const dx = c.x - center.x;
  const dy = c.y - center.y;
  applyTranslate(item, center.x + cs * dx - sn * dy - c.x, center.y + cs * dy + sn * dx - c.y);
  if (type === 'Decal') item.rotation = ((item.rotation as number | undefined) ?? 0) + angle;
}

export function applyScale(
  item: GameItem,
  scaleX: number,
  scaleY: number,
  center: Point,
  useElementCenter: boolean
): void {
  const type = item._type;

  if (item.drag_points && (CURVE_CENTER_TYPES.includes(type) || STORED_CENTER_CURVE_TYPES.includes(type))) {
    scalePoints(item.drag_points, scaleX, scaleY, useElementCenter ? getObjectCenter(item) : center);
    const c = storedCenter(item);
    if (c && !useElementCenter) {
      c.x = center.x + (c.x - center.x) * scaleX;
      c.y = center.y + (c.y - center.y) * scaleY;
    }
    if (type === 'Trigger') {
      item.scale_x = ((item.scale_x as number | undefined) ?? 1) * scaleX;
      item.scale_y = ((item.scale_y as number | undefined) ?? 1) * scaleY;
    }
    if (type === 'Flasher') {
      const derived = getObjectCenter(item);
      if (item.pos_x !== undefined) item.pos_x = derived.x;
      if (item.pos_y !== undefined) item.pos_y = derived.y;
    }
    return;
  }

  const c = getObjectCenter(item);
  const dx = c.x - center.x;
  const dy = c.y - center.y;
  applyTranslate(item, center.x + dx * scaleX - c.x, center.y + dy * scaleY - c.y);
}

export function moveObjectOffset(itemName: string, dx: number, dy: number): void {
  const item = getItem(itemName);
  if (!item) return;
  applyTranslate(item, dx, dy);
}

export function getItemAnchor(item: GameItem): Point {
  if (item.center) return { x: item.center.x, y: item.center.y };
  if (item.pos) return { x: item.pos.x, y: item.pos.y };
  if (item.pos_x !== undefined && item.pos_y !== undefined) return { x: item.pos_x, y: item.pos_y };
  if (item.position) return { x: item.position.x, y: item.position.y };
  if (item.ver1 && item.ver2) return { x: (item.ver1.x + item.ver2.x) / 2, y: (item.ver1.y + item.ver2.y) / 2 };
  if (item.drag_points && item.drag_points.length > 0) return getObjectCenter(item);
  return { x: 0, y: 0 };
}

export function moveObjectTo(itemName: string, x: number, y: number, z?: number): void {
  const item = getItem(itemName);
  if (!item) return;
  const anchor = getItemAnchor(item);
  moveObjectOffset(itemName, x - anchor.x, y - anchor.y);
  if (z !== undefined && item.position) {
    (item.position as unknown as Record<string, number>).z = z;
  }
}

function getTransformTargets(itemName: string): string[] {
  const selected = state.selectedItems.filter(name => !getItem(name)?.is_locked);
  if (selected.length > 1 && selected.some(name => name.toLowerCase() === itemName.toLowerCase())) {
    return selected;
  }
  return [itemName];
}

function getTransformCenter(targets: string[]): Point {
  if (targets.length === 1) {
    const item = getItem(targets[0]);
    return item ? getObjectCenter(item) : { x: 0, y: 0 };
  }
  return getMultiSelCenter(targets);
}

function flipObjects(itemName: string, axis: 'x' | 'y', renderCallback?: () => void): void {
  const targets = getTransformTargets(itemName).filter(name => getItem(name));
  if (targets.length === 0) return;

  const center = getTransformCenter(targets);

  undoManager.beginUndo(axis === 'x' ? 'Flipped horizontal' : 'Flipped vertical');
  for (const name of targets) {
    undoManager.markForUndo(name);
    applyFlip(getItem(name)!, axis, center);
    saveItemToFile(name);
  }
  undoManager.endUndo();

  for (const name of targets) invalidateItem(name);
  if (renderCallback) renderCallback();
}

export function flipObjectX(itemName: string, renderCallback?: () => void): void {
  flipObjects(itemName, 'x', renderCallback);
}

export function flipObjectY(itemName: string, renderCallback?: () => void): void {
  flipObjects(itemName, 'y', renderCallback);
}

function beginTransform(itemName: string): Point | null {
  const targets = getTransformTargets(itemName).filter(name => getItem(name));
  if (targets.length === 0) return null;

  transformItemName = itemName;
  transformTargets = targets;
  transformSnapshots = new Map();
  for (const name of targets) {
    transformSnapshots.set(name, snapshotTransformState(getItem(name)!));
  }
  const primary = getItem(itemName);
  originalDragPoints = primary ? backupDragPoints(primary) : null;
  return getTransformCenter(targets);
}

export function restoreTransformTargets(): void {
  for (const name of transformTargets) {
    const item = getItem(name);
    const snap = transformSnapshots.get(name);
    if (item && snap) restoreTransformState(item, snap);
  }
}

export function rotateObject(itemName: string, worldX?: number, worldY?: number): void {
  const center = beginTransform(itemName);
  if (!center) return;
  window.vpxEditor.openTransform('rotate', {
    centerX: center.x,
    centerY: center.y,
    mouseX: worldX !== undefined ? worldX : center.x,
    mouseY: worldY !== undefined ? worldY : center.y,
  });
}

export function scaleObject(itemName: string, worldX?: number, worldY?: number): void {
  const center = beginTransform(itemName);
  if (!center) return;
  window.vpxEditor.openTransform('scale', {
    centerX: center.x,
    centerY: center.y,
    mouseX: worldX !== undefined ? worldX : center.x,
    mouseY: worldY !== undefined ? worldY : center.y,
  });
}

export function translateObject(itemName: string): void {
  const center = beginTransform(itemName);
  if (!center) return;
  window.vpxEditor.openTransform('translate', { centerX: 0, centerY: 0 });
}
