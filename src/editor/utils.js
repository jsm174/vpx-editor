import { state, elements, isItemVisible } from './state.js';
import {
  DEFAULT_ELEMENT_SELECT_COLOR,
  DEFAULT_ELEMENT_SELECT_LOCKED_COLOR,
  DEFAULT_ELEMENT_FILL_COLOR,
  ANIMATION_DURATION_MS,
  VIEW_MARGIN_PX,
  BOUNDS_PADDING,
} from '../shared/constants.js';
import { getItemCenter } from '../shared/position-utils.js';
import { getItemNameFromFileName } from '../shared/gameitem-utils.js';
export { getItemCenter, getItemNameFromFileName };

let hitTestHandlers = null;

export function initHitTestHandlers(objects) {
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

export function getSelectColor() {
  return state.editorColors?.elementSelect || DEFAULT_ELEMENT_SELECT_COLOR;
}

export function getLockedColor() {
  return state.editorColors?.elementSelectLocked || DEFAULT_ELEMENT_SELECT_LOCKED_COLOR;
}

export function getFillColor() {
  return state.editorColors?.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
}

export function getFillColorWithAlpha(alpha = 0.6) {
  const hex = state.editorColors?.elementFill || DEFAULT_ELEMENT_FILL_COLOR;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getStrokeStyle(item, isSelected, defaultColor = '#000000') {
  if (item.is_locked) return getLockedColor();
  if (isSelected) return getSelectColor();
  return defaultColor;
}

export function getLineWidth(isSelected) {
  return isSelected ? 4 : 1;
}

function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function initCubicSplineCoeffs(x0, x1, t0, t1) {
  return {
    c0: x0,
    c1: t0,
    c2: -3.0 * x0 + 3.0 * x1 - 2.0 * t0 - t1,
    c3: 2.0 * x0 - 2.0 * x1 + t0 + t1,
  };
}

function initNonuniformCatmullCoeffs(x0, x1, x2, x3, dt0, dt1, dt2) {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1;
  t2 *= dt1;
  return initCubicSplineCoeffs(x1, x2, t1, t2);
}

class CatmullCurve {
  constructor(p0, p1, p2, p3) {
    let dt0 = Math.sqrt(distance(p0, p1));
    let dt1 = Math.sqrt(distance(p1, p2));
    let dt2 = Math.sqrt(distance(p2, p3));

    if (dt1 < 1e-4) dt1 = 1.0;
    if (dt0 < 1e-4) dt0 = dt1;
    if (dt2 < 1e-4) dt2 = dt1;

    this.xCoeffs = initNonuniformCatmullCoeffs(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
    this.yCoeffs = initNonuniformCatmullCoeffs(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
  }

  getPointAt(t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: this.xCoeffs.c3 * t3 + this.xCoeffs.c2 * t2 + this.xCoeffs.c1 * t + this.xCoeffs.c0,
      y: this.yCoeffs.c3 * t3 + this.yCoeffs.c2 * t2 + this.yCoeffs.c1 * t + this.yCoeffs.c0,
    };
  }
}

function flatWithAccuracy(v1, v2, vMid, accuracy) {
  const dblarea = (vMid.x - v1.x) * (v2.y - v1.y) - (v2.x - v1.x) * (vMid.y - v1.y);
  return dblarea * dblarea < accuracy;
}

function recurseSmoothLine(curve, t1, t2, vt1, vt2, vertices, accuracy, depth = 0) {
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

export function generateSmoothedPath(points, loop = true, accuracy = 4.0, trackControlPoints = false) {
  if (!points || points.length < 2) {
    return trackControlPoints ? { vertices: [], controlPointIndices: [] } : [];
  }

  const vertices = [];
  const controlPointIndices = [];
  const pts = points.map(p => {
    const v = p.vertex || p;
    return { x: v.x, y: v.y, smooth: p.smooth === true };
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
    const vt1 = { x: p1.x, y: p1.y };
    const vt2 = { x: p2.x, y: p2.y };
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

function calculatePathLength(vertices) {
  let total = 0;
  const lengths = [0];
  for (let i = 1; i < vertices.length; i++) {
    const dx = vertices[i].x - vertices[i - 1].x;
    const dy = vertices[i].y - vertices[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
    lengths.push(total);
  }
  return { total, lengths };
}

export function generateRampShape(centerline, widthBottom, widthTop) {
  const cvertex = centerline.length;
  if (cvertex < 2) return { left: [], right: [] };

  const { total, lengths } = calculatePathLength(centerline);
  const left = [];
  const right = [];

  for (let i = 0; i < cvertex; i++) {
    const vprev = centerline[i > 0 ? i - 1 : i];
    const vmiddle = centerline[i];
    const vnext = centerline[i < cvertex - 1 ? i + 1 : i];

    const ratio = total > 0 ? lengths[i] / total : 0;
    const halfWidth = (widthBottom + ratio * (widthTop - widthBottom)) / 2;

    let v1normal = { x: vprev.y - vmiddle.y, y: vmiddle.x - vprev.x };
    let v2normal = { x: vmiddle.y - vnext.y, y: vnext.x - vmiddle.x };

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

    let vnormal;

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

export function toScreen(x, y) {
  return {
    x: x * state.zoom + state.panX,
    y: y * state.zoom + state.panY,
  };
}

export function toWorld(screenX, screenY) {
  return {
    x: (screenX - state.panX) / state.zoom,
    y: (screenY - state.panY) / state.zoom,
  };
}

export function vpUnitsToInches(value) {
  return value * (1.0625 / 50);
}

export function vpUnitsToMillimeters(value) {
  return value * ((25.4 * 1.0625) / 50);
}

export function convertToUnit(value) {
  switch (state.unitConversion) {
    case 0:
      return vpUnitsToInches(value);
    case 1:
      return vpUnitsToMillimeters(value);
    default:
      return value;
  }
}

export function getUnitSuffix() {
  switch (state.unitConversion) {
    case 0:
      return ' (inch)';
    case 1:
      return ' (mm)';
    default:
      return '';
  }
}

export function updateZoomDisplay() {
  elements.zoomLevelEl.textContent = `${Math.round(state.zoom * 100)}%`;
}

let animationId = null;

export function centerViewOnPoint(worldX, worldY, animate = true) {
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

  function animateStep(currentTime) {
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

export function isPointInView(worldX, worldY) {
  const screen = toScreen(worldX, worldY);
  return (
    screen.x >= VIEW_MARGIN_PX &&
    screen.x <= elements.canvas.width - VIEW_MARGIN_PX &&
    screen.y >= VIEW_MARGIN_PX &&
    screen.y <= elements.canvas.height - VIEW_MARGIN_PX
  );
}

export function getItemBounds(item) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const addPoint = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  if (item.drag_points && item.drag_points.length > 0) {
    for (const pt of item.drag_points) {
      const p = pt.vertex || pt;
      addPoint(p.x, p.y);
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
    const center = getItemCenter(item);
    if (center) {
      addPoint(center.x - 50, center.y - 50);
      addPoint(center.x + 50, center.y + 50);
    }
  }

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

export function zoomToFitItems(itemNames, animate = true) {
  if (!itemNames || itemNames.length === 0) return;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const name of itemNames) {
    const item = state.items[name];
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

  function animateStep(currentTime) {
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

export function distToSegment(px, py, x1, y1, x2, y2) {
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

export function pointInPolygon(px, py, points) {
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

export function distToPath(px, py, points, threshold) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (distToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < threshold) {
      return true;
    }
  }
  return false;
}

export function hitTestItem(item, worldX, worldY) {
  const center = getItemCenter(item);
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

export function findItemsAtPoint(items, worldX, worldY) {
  const hits = [];
  for (let i = state.gameitems.length - 1; i >= 0; i--) {
    const gi = state.gameitems[i];
    if (!gi.file_name) continue;
    const name = getItemNameFromFileName(gi.file_name);
    const item = items[name];
    if (!item || !isItemVisible(item, name)) continue;
    if (hitTestItem(item, worldX, worldY)) {
      hits.push(name);
    }
  }
  return hits;
}

export function findNodeAtPoint(item, worldX, worldY, thresholdPx = 10) {
  if (!item.drag_points || item.drag_points.length === 0) return -1;

  const threshold = thresholdPx / state.zoom;

  for (let i = 0; i < item.drag_points.length; i++) {
    const pt = item.drag_points[i];
    const v = pt.vertex || pt;
    const dx = worldX - v.x;
    const dy = worldY - v.y;
    if (Math.sqrt(dx * dx + dy * dy) < threshold) {
      return i;
    }
  }
  return -1;
}

export function findClosestSegmentIndex(item, worldX, worldY) {
  if (!item.drag_points || item.drag_points.length < 2) return 0;

  let minDist = Infinity;
  let insertIndex = 0;

  const pts = item.drag_points;
  const loop = item._type !== 'Ramp';

  const count = loop ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const p1 = pts[i].vertex || pts[i];
    const p2Idx = (i + 1) % pts.length;
    const p2 = pts[p2Idx].vertex || pts[p2Idx];

    const dist = distToSegment(worldX, worldY, p1.x, p1.y, p2.x, p2.y);
    if (dist < minDist) {
      minDist = dist;
      insertIndex = i + 1;
    }
  }

  return insertIndex;
}
