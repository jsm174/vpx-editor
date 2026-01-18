import { state, elements, isItemVisible, GameItem, Point, DragPoint, getItem, getItemByFileName } from './state.js';
import {
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  ANIMATION_DURATION_MS,
  VIEW_MARGIN_PX,
  BOUNDS_PADDING,
} from '../shared/constants.js';
import { getItemCenter } from '../shared/position-utils.js';
import { getDragPointCoords } from '../types/game-objects.js';
export { getItemCenter, getDragPointCoords };

export interface Vertex {
  x: number;
  y: number;
}

export interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

export interface SplineCoeffs {
  c0: number;
  c1: number;
  c2: number;
  c3: number;
}

export interface RampShape {
  left: Vertex[];
  right: Vertex[];
}

export interface PathResult {
  vertices: Vertex[];
  controlPointIndices: number[];
}

export interface ItemBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type HitTestHandler = (
  item: unknown,
  worldX: number,
  worldY: number,
  center?: Point,
  distFromCenter?: number
) => boolean;

export interface HitTestHandlersInput {
  hitTestBumper: HitTestHandler;
  hitTestDecal: HitTestHandler;
  hitTestFlasher: HitTestHandler;
  hitTestFlipper: HitTestHandler;
  hitTestLight: HitTestHandler;
  hitTestLightSequencer: HitTestHandler;
  hitTestRamp: HitTestHandler;
  hitTestReel: HitTestHandler;
  hitTestRubber: HitTestHandler;
  hitTestTextBox: HitTestHandler;
  hitTestTrigger: HitTestHandler;
  hitTestWall: HitTestHandler;
}

export interface HitTestHandlers {
  [key: string]: HitTestHandler;
}

let hitTestHandlers: HitTestHandlers | null = null;

export function initHitTestHandlers(objects: HitTestHandlersInput): void {
  hitTestHandlers = {
    Bumper: objects.hitTestBumper,
    Decal: objects.hitTestDecal,
    Flasher: objects.hitTestFlasher,
    Flipper: objects.hitTestFlipper,
    Light: objects.hitTestLight,
    LightSequencer: objects.hitTestLightSequencer,
    Ramp: objects.hitTestRamp,
    Reel: objects.hitTestReel,
    Rubber: objects.hitTestRubber,
    TextBox: objects.hitTestTextBox,
    Trigger: objects.hitTestTrigger,
    Wall: objects.hitTestWall,
  };
}

export function getSelectColor(): string {
  return state.editorColors?.elementSelect || DEFAULT_ELEMENT_SELECT_COLOR;
}

export function getLockedColor(): string {
  return state.editorColors?.elementSelectLocked || DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
}

export function getFillColor(): string {
  return state.editorColors?.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
}

export function getFillColorWithAlpha(alpha: number = 0.6): string {
  const hex = state.editorColors?.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getStrokeStyle(
  item: { is_locked?: boolean },
  isSelected: boolean,
  defaultColor: string = '#000000',
  useLockedColorWhenUnselected: boolean = true
): string {
  if (isSelected) {
    return item.is_locked ? getLockedColor() : getSelectColor();
  }
  if (item.is_locked && useLockedColorWhenUnselected) {
    return getLockedColor();
  }
  return defaultColor;
}

export function getLineWidth(isSelected: boolean): number {
  return isSelected ? 4 : 1;
}

export function drawPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: Vertex[],
  transformFn: (x: number, y: number) => Vertex,
  fillStyle: string | null,
  strokeStyle: string | null,
  lineWidth: number
): void {
  if (!vertices || vertices.length < 2) return;

  ctx.beginPath();
  const first = transformFn(vertices[0].x, vertices[0].y);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < vertices.length; i++) {
    const pt = transformFn(vertices[i].x, vertices[i].y);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (vertices.length === 4) {
      const p0 = transformFn(vertices[0].x, vertices[0].y);
      const p1 = transformFn(vertices[1].x, vertices[1].y);
      const p2 = transformFn(vertices[2].x, vertices[2].y);
      const p3 = transformFn(vertices[3].x, vertices[3].y);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
    }
  }
}

function distance(a: Vertex, b: Vertex): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distance3D(a: Vertex3D, b: Vertex3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalize(x: number, y: number): Vertex {
  const len = Math.sqrt(x * x + y * y);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function initCubicSplineCoeffs(x0: number, x1: number, t0: number, t1: number): SplineCoeffs {
  return {
    c0: x0,
    c1: t0,
    c2: -3.0 * x0 + 3.0 * x1 - 2.0 * t0 - t1,
    c3: 2.0 * x0 - 2.0 * x1 + t0 + t1,
  };
}

function initNonuniformCatmullCoeffs(
  x0: number,
  x1: number,
  x2: number,
  x3: number,
  dt0: number,
  dt1: number,
  dt2: number
): SplineCoeffs {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1;
  t2 *= dt1;
  return initCubicSplineCoeffs(x1, x2, t1, t2);
}

class CatmullCurve {
  private xCoeffs: SplineCoeffs;
  private yCoeffs: SplineCoeffs;

  constructor(p0: Vertex, p1: Vertex, p2: Vertex, p3: Vertex) {
    let dt0 = Math.sqrt(distance(p0, p1));
    let dt1 = Math.sqrt(distance(p1, p2));
    let dt2 = Math.sqrt(distance(p2, p3));

    if (dt1 < 1e-4) dt1 = 1.0;
    if (dt0 < 1e-4) dt0 = dt1;
    if (dt2 < 1e-4) dt2 = dt1;

    this.xCoeffs = initNonuniformCatmullCoeffs(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
    this.yCoeffs = initNonuniformCatmullCoeffs(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
  }

  getPointAt(t: number): Vertex {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: this.xCoeffs.c3 * t3 + this.xCoeffs.c2 * t2 + this.xCoeffs.c1 * t + this.xCoeffs.c0,
      y: this.yCoeffs.c3 * t3 + this.yCoeffs.c2 * t2 + this.yCoeffs.c1 * t + this.yCoeffs.c0,
    };
  }
}

class CatmullCurve3D {
  private xCoeffs: SplineCoeffs;
  private yCoeffs: SplineCoeffs;
  private zCoeffs: SplineCoeffs;

  constructor(p0: Vertex3D, p1: Vertex3D, p2: Vertex3D, p3: Vertex3D) {
    let dt0 = Math.sqrt(distance3D(p0, p1));
    let dt1 = Math.sqrt(distance3D(p1, p2));
    let dt2 = Math.sqrt(distance3D(p2, p3));

    if (dt1 < 1e-4) dt1 = 1.0;
    if (dt0 < 1e-4) dt0 = dt1;
    if (dt2 < 1e-4) dt2 = dt1;

    this.xCoeffs = initNonuniformCatmullCoeffs(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
    this.yCoeffs = initNonuniformCatmullCoeffs(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
    this.zCoeffs = initNonuniformCatmullCoeffs(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
  }

  getPointAt(t: number): Vertex3D {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: this.xCoeffs.c3 * t3 + this.xCoeffs.c2 * t2 + this.xCoeffs.c1 * t + this.xCoeffs.c0,
      y: this.yCoeffs.c3 * t3 + this.yCoeffs.c2 * t2 + this.yCoeffs.c1 * t + this.yCoeffs.c0,
      z: this.zCoeffs.c3 * t3 + this.zCoeffs.c2 * t2 + this.zCoeffs.c1 * t + this.zCoeffs.c0,
    };
  }
}

function flatWithAccuracy(v1: Vertex, v2: Vertex, vMid: Vertex, accuracy: number): boolean {
  const dblarea = (vMid.x - v1.x) * (v2.y - v1.y) - (v2.x - v1.x) * (vMid.y - v1.y);
  return dblarea * dblarea < accuracy;
}

function recurseSmoothLine(
  curve: CatmullCurve,
  t1: number,
  t2: number,
  vt1: Vertex,
  vt2: Vertex,
  vertices: Vertex[],
  accuracy: number,
  depth: number = 0
): void {
  if (depth > 16) {
    vertices.push(vt1);
    return;
  }

  const tMid = (t1 + t2) * 0.5;
  const vMid = curve.getPointAt(tMid);

  if (flatWithAccuracy(vt1, vt2, vMid, accuracy)) {
    vertices.push(vt1);
  } else {
    recurseSmoothLine(curve, t1, tMid, vt1, vMid, vertices, accuracy, depth + 1);
    recurseSmoothLine(curve, tMid, t2, vMid, vt2, vertices, accuracy, depth + 1);
  }
}

interface SmoothPoint {
  x: number;
  y: number;
  smooth: boolean;
}

export function generateSmoothedPath(
  points: DragPoint[],
  loop: boolean = true,
  accuracy: number = 4.0,
  trackControlPoints: boolean = false
): Vertex[] | PathResult {
  if (!points || points.length < 2) {
    return trackControlPoints ? { vertices: [], controlPointIndices: [] } : [];
  }

  const vertices: Vertex[] = [];
  const controlPointIndices: number[] = [];
  const pts: SmoothPoint[] = points.map(p => {
    const { x, y } = getDragPointCoords(p);
    return { x, y, smooth: p.smooth === true || p.is_smooth === true };
  });

  const cpoint = pts.length;
  const count = loop ? cpoint : cpoint - 1;

  for (let i = 0; i < count; i++) {
    const i1 = i;
    const i2 = (i + 1) % cpoint;

    const pdp1 = pts[i1];
    const pdp2 = pts[i2];

    let iprev = pdp1.smooth ? i - 1 : i;
    if (iprev < 0) {
      iprev = loop ? cpoint - 1 : 0;
    }

    let inext = pdp2.smooth ? i + 2 : i + 1;
    if (inext >= cpoint) {
      inext = loop ? inext - cpoint : cpoint - 1;
    }

    const p0 = pts[iprev];
    const p1 = pdp1;
    const p2 = pdp2;
    const p3 = pts[inext];

    if (p1.x === p2.x && p1.y === p2.y) {
      continue;
    }

    if (trackControlPoints) {
      controlPointIndices.push(vertices.length);
    }

    const curve = new CatmullCurve(p0, p1, p2, p3);
    const vt1: Vertex = { x: p1.x, y: p1.y };
    const vt2: Vertex = { x: p2.x, y: p2.y };
    recurseSmoothLine(curve, 0, 1, vt1, vt2, vertices, accuracy);
  }

  if (!loop && pts.length > 0) {
    const last = pts[pts.length - 1];
    if (trackControlPoints) {
      controlPointIndices.push(vertices.length);
    }
    vertices.push({ x: last.x, y: last.y });
  }

  return trackControlPoints ? { vertices, controlPointIndices } : vertices;
}

function flatWithAccuracy3D(v1: Vertex3D, v2: Vertex3D, vMid: Vertex3D, accuracy: number): boolean {
  const dxv1v2 = v2.x - v1.x;
  const dyv1v2 = v2.y - v1.y;
  const dzv1v2 = v2.z - v1.z;
  const dxv1mid = vMid.x - v1.x;
  const dyv1mid = vMid.y - v1.y;
  const dzv1mid = vMid.z - v1.z;
  const crossX = dyv1v2 * dzv1mid - dzv1v2 * dyv1mid;
  const crossY = dzv1v2 * dxv1mid - dxv1v2 * dzv1mid;
  const crossZ = dxv1v2 * dyv1mid - dyv1v2 * dxv1mid;
  const areaSquared = crossX * crossX + crossY * crossY + crossZ * crossZ;
  return areaSquared < accuracy;
}

function recurseSmoothLine3D(
  curve: CatmullCurve3D,
  t1: number,
  t2: number,
  vt1: Vertex3D,
  vt2: Vertex3D,
  vertices: Vertex3D[],
  accuracy: number,
  depth: number = 0
): void {
  if (depth > 16) {
    vertices.push(vt1);
    return;
  }

  const tMid = (t1 + t2) * 0.5;
  const vMid = curve.getPointAt(tMid);

  if (flatWithAccuracy3D(vt1, vt2, vMid, accuracy)) {
    vertices.push(vt1);
  } else {
    recurseSmoothLine3D(curve, t1, tMid, vt1, vMid, vertices, accuracy, depth + 1);
    recurseSmoothLine3D(curve, tMid, t2, vMid, vt2, vertices, accuracy, depth + 1);
  }
}

interface SmoothPoint3D {
  x: number;
  y: number;
  z: number;
  smooth: boolean;
}

export function generateSmoothedPath3D(points: DragPoint[], loop: boolean = true, accuracy: number = 4.0): Vertex3D[] {
  if (!points || points.length < 2) {
    return [];
  }

  const vertices: Vertex3D[] = [];
  const pts: SmoothPoint3D[] = points.map(p => {
    const { x, y } = getDragPointCoords(p);
    const z = p.z ?? 0;
    return { x, y, z, smooth: p.smooth === true || p.is_smooth === true };
  });

  const cpoint = pts.length;
  const count = loop ? cpoint : cpoint - 1;

  for (let i = 0; i < count; i++) {
    const i1 = i;
    const i2 = (i + 1) % cpoint;

    const pdp1 = pts[i1];
    const pdp2 = pts[i2];

    let iprev = pdp1.smooth ? i - 1 : i;
    if (iprev < 0) {
      iprev = loop ? cpoint - 1 : 0;
    }

    let inext = pdp2.smooth ? i + 2 : i + 1;
    if (inext >= cpoint) {
      inext = loop ? inext - cpoint : cpoint - 1;
    }

    const p0 = pts[iprev];
    const p1 = pdp1;
    const p2 = pdp2;
    const p3 = pts[inext];

    if (p1.x === p2.x && p1.y === p2.y && p1.z === p2.z) {
      continue;
    }

    const curve = new CatmullCurve3D(p0, p1, p2, p3);
    const vt1: Vertex3D = { x: p1.x, y: p1.y, z: p1.z };
    const vt2: Vertex3D = { x: p2.x, y: p2.y, z: p2.z };
    recurseSmoothLine3D(curve, 0, 1, vt1, vt2, vertices, accuracy);
  }

  if (!loop && pts.length > 0) {
    const last = pts[pts.length - 1];
    vertices.push({ x: last.x, y: last.y, z: last.z });
  }

  return vertices;
}

interface PathLengthResult {
  total: number;
  lengths: number[];
}

function calculatePathLength(vertices: Vertex[]): PathLengthResult {
  let total = 0;
  const lengths: number[] = [0];
  for (let i = 1; i < vertices.length; i++) {
    const dx = vertices[i].x - vertices[i - 1].x;
    const dy = vertices[i].y - vertices[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
    lengths.push(total);
  }
  return { total, lengths };
}

export function generateRampShape(centerline: Vertex[], widthBottom: number, widthTop: number): RampShape {
  const cvertex = centerline.length;
  if (cvertex < 2) return { left: [], right: [] };

  const { total, lengths } = calculatePathLength(centerline);
  const left: Vertex[] = [];
  const right: Vertex[] = [];

  for (let i = 0; i < cvertex; i++) {
    const vprev = centerline[i > 0 ? i - 1 : i];
    const vmiddle = centerline[i];
    const vnext = centerline[i < cvertex - 1 ? i + 1 : i];

    const ratio = total > 0 ? lengths[i] / total : 0;
    const halfWidth = (widthBottom + ratio * (widthTop - widthBottom)) / 2;

    let v1normal: Vertex = { x: vprev.y - vmiddle.y, y: vmiddle.x - vprev.x };
    let v2normal: Vertex = { x: vmiddle.y - vnext.y, y: vnext.x - vmiddle.x };

    const len1 = Math.sqrt(v1normal.x * v1normal.x + v1normal.y * v1normal.y);
    if (len1 > 0.0001) {
      v1normal.x /= len1;
      v1normal.y /= len1;
    }

    const len2 = Math.sqrt(v2normal.x * v2normal.x + v2normal.y * v2normal.y);
    if (len2 > 0.0001) {
      v2normal.x /= len2;
      v2normal.y /= len2;
    }

    let vnormal: Vertex;

    if (i === cvertex - 1) {
      vnormal = v1normal;
    } else if (i === 0) {
      vnormal = v2normal;
    } else if (Math.abs(v1normal.x - v2normal.x) < 0.0001 && Math.abs(v1normal.y - v2normal.y) < 0.0001) {
      vnormal = v1normal;
    } else {
      const A = vprev.y - vmiddle.y;
      const B = vmiddle.x - vprev.x;
      const C = A * (v1normal.x - vprev.x) + B * (v1normal.y - vprev.y);

      const D = vnext.y - vmiddle.y;
      const E = vmiddle.x - vnext.x;
      const F = D * (v2normal.x - vnext.x) + E * (v2normal.y - vnext.y);

      const det = A * E - B * D;
      const inv_det = det !== 0 ? 1.0 / det : 0;

      const intersectx = (B * F - E * C) * inv_det;
      const intersecty = (C * D - A * F) * inv_det;

      vnormal = { x: vmiddle.x - intersectx, y: vmiddle.y - intersecty };
    }

    left.push({ x: vmiddle.x + vnormal.x * halfWidth, y: vmiddle.y + vnormal.y * halfWidth });
    right.push({ x: vmiddle.x - vnormal.x * halfWidth, y: vmiddle.y - vnormal.y * halfWidth });
  }

  return { left, right };
}

export function toScreen(x: number, y: number): Vertex {
  return {
    x: x * state.zoom + state.panX,
    y: y * state.zoom + state.panY,
  };
}

export function toWorld(screenX: number, screenY: number): Vertex {
  return {
    x: (screenX - state.panX) / state.zoom,
    y: (screenY - state.panY) / state.zoom,
  };
}

export function vpUnitsToInches(value: number): number {
  return value * (1.0625 / 50);
}

export function vpUnitsToMillimeters(value: number): number {
  return value * ((25.4 * 1.0625) / 50);
}

export function inchesToVpUnits(value: number): number {
  return value * (50 / 1.0625);
}

export function millimetersToVpUnits(value: number): number {
  return value * (50 / (25.4 * 1.0625));
}

export function convertToUnit(value: number): number {
  switch (state.unitConversion) {
    case 'inches':
      return vpUnitsToInches(value);
    case 'mm':
      return vpUnitsToMillimeters(value);
    default:
      return value;
  }
}

export function convertFromUnit(value: number): number {
  switch (state.unitConversion) {
    case 'inches':
      return inchesToVpUnits(value);
    case 'mm':
      return millimetersToVpUnits(value);
    default:
      return value;
  }
}

export function getUnitSuffix(): string {
  switch (state.unitConversion) {
    case 'inches':
      return ' (inch)';
    case 'mm':
      return ' (mm)';
    default:
      return '';
  }
}

export function getUnitLabel(): string {
  switch (state.unitConversion) {
    case 'inches':
      return 'in';
    case 'mm':
      return 'mm';
    default:
      return 'vpu';
  }
}

export function getUnitSuffixHtml(): string {
  if (state.unitConversion === 'vpu') {
    return '';
  }
  return `<span class="prop-unit">(${getUnitLabel()})</span>`;
}

export function updateZoomDisplay(): void {
  if (elements.zoomLevelEl) {
    elements.zoomLevelEl.textContent = `${Math.round(state.zoom * 100)}%`;
  }
}

let animationId: number | null = null;

export function centerViewOnPoint(worldX: number, worldY: number, animate: boolean = true): void {
  if (!elements.canvas) return;

  const canvasWidth = elements.canvas.width;
  const canvasHeight = elements.canvas.height;

  const targetZoom = Math.max(state.zoom, 0.8);
  const targetPanX = canvasWidth / 2 - worldX * targetZoom;
  const targetPanY = canvasHeight / 2 - worldY * targetZoom;

  if (!animate) {
    state.zoom = targetZoom;
    state.panX = targetPanX;
    state.panY = targetPanY;
    updateZoomDisplay();
    return;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  const startPanX = state.panX;
  const startPanY = state.panY;
  const startZoom = state.zoom;
  const startTime = performance.now();
  const duration = ANIMATION_DURATION_MS;

  function animateStep(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    state.zoom = startZoom + (targetZoom - startZoom) * eased;
    state.panX = startPanX + (targetPanX - startPanX) * eased;
    state.panY = startPanY + (targetPanY - startPanY) * eased;

    updateZoomDisplay();
    if (state.renderCallback) state.renderCallback();

    if (progress < 1) {
      animationId = requestAnimationFrame(animateStep);
    } else {
      animationId = null;
    }
  }

  animationId = requestAnimationFrame(animateStep);
}

export function isPointInView(worldX: number, worldY: number): boolean {
  if (!elements.canvas) return false;

  const screen = toScreen(worldX, worldY);
  return (
    screen.x >= VIEW_MARGIN_PX &&
    screen.x <= elements.canvas.width - VIEW_MARGIN_PX &&
    screen.y >= VIEW_MARGIN_PX &&
    screen.y <= elements.canvas.height - VIEW_MARGIN_PX
  );
}

export function getItemBounds(item: GameItem): ItemBounds | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const addPoint = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  if (item.drag_points && item.drag_points.length > 0) {
    for (const pt of item.drag_points) {
      const { x, y } = getDragPointCoords(pt);
      addPoint(x, y);
    }
  } else if (item.center) {
    const radius = item.radius || item.falloff_radius || 50;
    addPoint(item.center.x - radius, item.center.y - radius);
    addPoint(item.center.x + radius, item.center.y + radius);
  } else if (item.position) {
    const size = item.size || { x: 100, y: 100 };
    addPoint(item.position.x - size.x / 2, item.position.y - size.y / 2);
    addPoint(item.position.x + size.x / 2, item.position.y + size.y / 2);
  } else if (item.ver1 && item.ver2) {
    addPoint(item.ver1.x, item.ver1.y);
    addPoint(item.ver2.x, item.ver2.y);
  } else {
    const center = getItemCenter(item as unknown as import('../shared/position-utils.js').PositionableItem);
    if (center) {
      addPoint(center.x - 50, center.y - 50);
      addPoint(center.x + 50, center.y + 50);
    }
  }

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

export function zoomToFitItems(itemNames: string[], animate: boolean = true): void {
  if (!itemNames || itemNames.length === 0) return;
  if (!elements.canvas) return;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const name of itemNames) {
    const item = getItem(name);
    if (!item) continue;
    const bounds = getItemBounds(item);
    if (!bounds) continue;
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (minX === Infinity) return;

  minX -= BOUNDS_PADDING;
  minY -= BOUNDS_PADDING;
  maxX += BOUNDS_PADDING;
  maxY += BOUNDS_PADDING;

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const canvasWidth = elements.canvas.width;
  const canvasHeight = elements.canvas.height;

  const zoomX = canvasWidth / boundsWidth;
  const zoomY = canvasHeight / boundsHeight;
  const targetZoom = Math.min(zoomX, zoomY, 2.0);

  const targetPanX = canvasWidth / 2 - centerX * targetZoom;
  const targetPanY = canvasHeight / 2 - centerY * targetZoom;

  if (!animate) {
    state.zoom = targetZoom;
    state.panX = targetPanX;
    state.panY = targetPanY;
    updateZoomDisplay();
    return;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  const startPanX = state.panX;
  const startPanY = state.panY;
  const startZoom = state.zoom;
  const startTime = performance.now();
  const duration = ANIMATION_DURATION_MS;

  function animateStep(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    state.zoom = startZoom + (targetZoom - startZoom) * eased;
    state.panX = startPanX + (targetPanX - startPanX) * eased;
    state.panY = startPanY + (targetPanY - startPanY) * eased;
    updateZoomDisplay();
    if (state.renderCallback) state.renderCallback();

    if (t < 1) {
      animationId = requestAnimationFrame(animateStep);
    } else {
      animationId = null;
    }
  }

  animationId = requestAnimationFrame(animateStep);
}

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
}

export function pointInPolygon(px: number, py: number, points: Vertex[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x,
      yi = points[i].y;
    const xj = points[j].x,
      yj = points[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function distToPath(px: number, py: number, points: Vertex[], threshold: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (distToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < threshold) {
      return true;
    }
  }
  return false;
}

export function hitTestItem(item: GameItem, worldX: number, worldY: number): boolean {
  const center = getItemCenter(item as unknown as import('../shared/position-utils.js').PositionableItem);
  if (!center) return false;

  const dx = worldX - center.x;
  const dy = worldY - center.y;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);

  const handler = hitTestHandlers?.[item._type];
  if (handler) {
    return handler(item, worldX, worldY, center, distFromCenter);
  }

  return distFromCenter < 25;
}

export function findItemsAtPoint(_items: Record<string, GameItem>, worldX: number, worldY: number): string[] {
  const hits: string[] = [];
  for (let i = state.gameitems.length - 1; i >= 0; i--) {
    const gi = state.gameitems[i];
    if (!gi.file_name) continue;
    const item = getItemByFileName(gi.file_name);
    if (!item) continue;
    const name = item.name || gi.file_name;
    if (!isItemVisible(item, name)) continue;
    if (hitTestItem(item, worldX, worldY)) {
      hits.push(name);
    }
  }
  return hits;
}

export function findNodeAtPoint(item: GameItem, worldX: number, worldY: number, thresholdPx: number = 10): number {
  if (!item.drag_points || item.drag_points.length === 0) return -1;

  const threshold = thresholdPx / state.zoom;

  for (let i = 0; i < item.drag_points.length; i++) {
    const { x, y } = getDragPointCoords(item.drag_points[i]);
    const dx = worldX - x;
    const dy = worldY - y;
    if (Math.sqrt(dx * dx + dy * dy) < threshold) {
      return i;
    }
  }
  return -1;
}

export function findClosestSegmentIndex(item: GameItem, worldX: number, worldY: number): number {
  if (!item.drag_points || item.drag_points.length < 2) return 0;

  let minDist = Infinity;
  let insertIndex = 0;

  const pts = item.drag_points;
  const loop = item._type !== 'Ramp';

  const count = loop ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const p1 = getDragPointCoords(pts[i]);
    const p2Idx = (i + 1) % pts.length;
    const p2 = getDragPointCoords(pts[p2Idx]);

    const dist = distToSegment(worldX, worldY, p1.x, p1.y, p2.x, p2.y);
    if (dist < minDist) {
      minDist = dist;
      insertIndex = i + 1;
    }
  }

  return insertIndex;
}
