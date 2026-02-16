import * as THREE from 'three';
import { state, elements } from '../state.js';
import {
  toScreen,
  generateSmoothedPath,
  generateSmoothedPath3D,
  generateRampShape,
  getStrokeStyle,
  getLineWidth,
  getFillColorWithAlpha,
  pointInPolygon,
  convertToUnit,
  getUnitSuffixHtml,
} from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { materialSelect, imageSelect } from '../../shared/property-templates.js';
import { RAMP_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, BLUEPRINT_SOLID_COLOR, PATH_SMOOTHING_ACCURACY } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';
import type { DragPoint } from '../../types/game-objects.js';
import { getDragPointCoords } from '../../types/game-objects.js';

interface SmoothedPoint {
  x: number;
  y: number;
}

interface SmoothedPathResult {
  vertices: SmoothedPoint[];
  controlPointIndices: number[];
}

interface RampShapeData {
  left: SmoothedPoint[];
  right: SmoothedPoint[];
  centerline: SmoothedPoint[];
  controlPointIndices: number[];
  isWireRamp: boolean;
  rampTypeLower: string;
}

interface RampItem {
  drag_points?: DragPoint[];
  ramp_type?: string;
  width_bottom?: number;
  width_top?: number;
  height_bottom?: number;
  height_top?: number;
  wire_distance_x?: number;
  wire_distance_y?: number;
  wire_diameter?: number;
  left_wall_height_visible?: number;
  right_wall_height_visible?: number;
  left_wall_height?: number;
  right_wall_height?: number;
  material?: string;
  image?: string;
  image_alignment?: string;
  image_walls?: boolean;
  is_visible?: boolean;
  depth_bias?: number;
  is_reflection_enabled?: boolean;
  hit_event?: boolean;
  threshold?: number;
  physics_material?: string;
  overwrite_physics?: boolean;
  elasticity?: number;
  elasticity_falloff?: number;
  friction?: number;
  scatter?: number;
  is_collidable?: boolean;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  is_locked?: boolean;
}

export function createRamp3DMesh(item: RampItem): THREE.Group | null {
  const points = item.drag_points;
  if (!points || points.length < 2) return null;

  const rampType = (item.ramp_type || 'flat').toLowerCase();
  const isWireRamp = rampType.includes('wire');

  const widthBottom = item.width_bottom ?? RAMP_DEFAULTS.width_bottom;
  const widthTop = item.width_top ?? RAMP_DEFAULTS.width_top;
  const heightBottom =
    (item.height_bottom ?? RAMP_DEFAULTS.height_bottom) < 1 ? 0.5 : (item.height_bottom ?? RAMP_DEFAULTS.height_bottom);
  const heightTop = item.height_top ?? RAMP_DEFAULTS.height_top;

  if (isWireRamp) {
    const wireDistanceX = item.wire_distance_x ?? RAMP_DEFAULTS.wire_distance_x;
    const wireDistanceY = item.wire_distance_y ?? RAMP_DEFAULTS.wire_distance_y;
    const wireDiameter = item.wire_diameter ?? RAMP_DEFAULTS.wire_diameter;

    const group = new THREE.Group();
    const wireMat = createMaterial(item.material, null);

    const smoothedPath = generateSmoothedPath3D(points, false, PATH_SMOOTHING_ACCURACY);
    if (smoothedPath.length < 2) return null;

    const pathLengths = [0];
    let totalLength = 0;
    for (let i = 1; i < smoothedPath.length; i++) {
      const dx = smoothedPath[i].x - smoothedPath[i - 1].x;
      const dy = smoothedPath[i].y - smoothedPath[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
      pathLengths.push(totalLength);
    }

    const createWirePath = (offset: number, zOffset: number = 0): THREE.Vector3[] => {
      const pathPoints = [];
      for (let i = 0; i < smoothedPath.length; i++) {
        const p = smoothedPath[i];
        const t = totalLength > 0 ? pathLengths[i] / totalLength : 0;
        const height = p.z + heightBottom + t * (heightTop - heightBottom) + zOffset;

        let nx = 0,
          ny = 1;
        if (i < smoothedPath.length - 1) {
          const next = smoothedPath[i + 1];
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            nx = dy / len;
            ny = -dx / len;
          }
        } else if (i > 0) {
          const prev = smoothedPath[i - 1];
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            nx = dy / len;
            ny = -dx / len;
          }
        }

        pathPoints.push(new THREE.Vector3(p.x + nx * offset, p.y + ny * offset, height));
      }
      return pathPoints;
    };

    const addWire = (path: THREE.Vector3[]): void => {
      if (path.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(path, false);
        const segments = Math.min(path.length, 64);
        const geom = new THREE.TubeGeometry(curve, segments, wireDiameter / 2, 8, false);
        group.add(new THREE.Mesh(geom, wireMat));
      }
    };

    if (rampType === 'one_wire') {
      addWire(createWirePath(0));
    } else if (rampType === 'two_wire') {
      addWire(createWirePath(wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2));
    } else if (rampType === 'three_wire_left') {
      addWire(createWirePath(wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2));
      addWire(createWirePath(wireDistanceX / 2, wireDistanceY / 2));
    } else if (rampType === 'three_wire_right') {
      addWire(createWirePath(wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2, wireDistanceY / 2));
    } else if (rampType === 'four_wire') {
      addWire(createWirePath(wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2));
      addWire(createWirePath(wireDistanceX / 2, wireDistanceY / 2));
      addWire(createWirePath(-wireDistanceX / 2, wireDistanceY / 2));
    } else {
      addWire(createWirePath(wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2));
    }

    return group;
  }

  const smoothedPath = generateSmoothedPath3D(points, false, PATH_SMOOTHING_ACCURACY);
  if (smoothedPath.length < 2) return null;

  const pathLengths = [0];
  let totalLength = 0;
  for (let i = 1; i < smoothedPath.length; i++) {
    const dx = smoothedPath[i].x - smoothedPath[i - 1].x;
    const dy = smoothedPath[i].y - smoothedPath[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
    pathLengths.push(totalLength);
  }

  const vertices = [];
  for (let i = 0; i < smoothedPath.length; i++) {
    const p = smoothedPath[i];
    const t = totalLength > 0 ? pathLengths[i] / totalLength : 0;
    const width = widthBottom + t * (widthTop - widthBottom);
    const height = p.z + heightBottom + t * (heightTop - heightBottom);

    let nx = 0,
      ny = 1;
    if (i < smoothedPath.length - 1) {
      const next = smoothedPath[i + 1];
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        nx = dy / len;
        ny = -dx / len;
      }
    } else if (i > 0) {
      const prev = smoothedPath[i - 1];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        nx = dy / len;
        ny = -dx / len;
      }
    }
    vertices.push({
      left: new THREE.Vector3(p.x + (nx * width) / 2, p.y + (ny * width) / 2, height),
      right: new THREE.Vector3(p.x - (nx * width) / 2, p.y - (ny * width) / 2, height),
    });
  }

  const leftWallHeight = item.left_wall_height_visible ?? 0;
  const rightWallHeight = item.right_wall_height_visible ?? 0;
  const isWorldAlignment = item.image_alignment === 'world';
  const tableWidth = ((state.gamedata?.right as number) || 952) - ((state.gamedata?.left as number) || 0);
  const tableHeight = ((state.gamedata?.bottom as number) || 2162) - ((state.gamedata?.top as number) || 0);
  const imageWalls = item.image_walls !== false;

  const group = new THREE.Group();

  const floorGeom = new THREE.BufferGeometry();
  const floorPos = [];
  const floorUvs = [];
  const floorIdx = [];

  for (let i = 0; i < vertices.length; i++) {
    const t = vertices.length > 1 ? i / (vertices.length - 1) : 0;
    floorPos.push(vertices[i].left.x, vertices[i].left.y, vertices[i].left.z);
    floorPos.push(vertices[i].right.x, vertices[i].right.y, vertices[i].right.z);
    if (isWorldAlignment) {
      floorUvs.push(vertices[i].left.x / tableWidth, vertices[i].left.y / tableHeight);
      floorUvs.push(vertices[i].right.x / tableWidth, vertices[i].right.y / tableHeight);
    } else {
      floorUvs.push(0, 1 - t);
      floorUvs.push(1, 1 - t);
    }
  }

  for (let i = 0; i < vertices.length - 1; i++) {
    const bl = i * 2,
      br = i * 2 + 1,
      tl = (i + 1) * 2,
      tr = (i + 1) * 2 + 1;
    floorIdx.push(bl, br, tl);
    floorIdx.push(br, tr, tl);
  }

  floorGeom.setAttribute('position', new THREE.Float32BufferAttribute(floorPos, 3));
  floorGeom.setAttribute('uv', new THREE.Float32BufferAttribute(floorUvs, 2));
  floorGeom.setIndex(floorIdx);
  floorGeom.computeVertexNormals();

  const material = createMaterial(item.material, item.image);
  group.add(new THREE.Mesh(floorGeom, material));

  if (leftWallHeight > 0) {
    const wallGeom = new THREE.BufferGeometry();
    const wallPos = [];
    const wallUvs = [];
    const wallIdx = [];

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i].left;
      const t = vertices.length > 1 ? i / (vertices.length - 1) : 0;
      wallPos.push(v.x, v.y, v.z);
      wallPos.push(v.x, v.y, v.z + leftWallHeight);
      if (imageWalls) {
        if (isWorldAlignment) {
          const u = v.x / tableWidth;
          const uv = v.y / tableHeight;
          wallUvs.push(u, uv);
          wallUvs.push(u, uv);
        } else {
          wallUvs.push(0, 1 - t);
          wallUvs.push(0, 1 - t);
        }
      } else {
        wallUvs.push(0, 0);
        wallUvs.push(0, 0);
      }
    }

    for (let i = 0; i < vertices.length - 1; i++) {
      const bl = i * 2,
        tl = i * 2 + 1,
        br = (i + 1) * 2,
        tr = (i + 1) * 2 + 1;
      wallIdx.push(bl, br, tl);
      wallIdx.push(br, tr, tl);
    }

    wallGeom.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeom.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    wallGeom.setIndex(wallIdx);
    wallGeom.computeVertexNormals();
    group.add(new THREE.Mesh(wallGeom, material));
  }

  if (rightWallHeight > 0) {
    const wallGeom = new THREE.BufferGeometry();
    const wallPos = [];
    const wallUvs = [];
    const wallIdx = [];

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i].right;
      const t = vertices.length > 1 ? i / (vertices.length - 1) : 0;
      wallPos.push(v.x, v.y, v.z);
      wallPos.push(v.x, v.y, v.z + rightWallHeight);
      if (imageWalls) {
        if (isWorldAlignment) {
          const u = v.x / tableWidth;
          const uv = v.y / tableHeight;
          wallUvs.push(u, uv);
          wallUvs.push(u, uv);
        } else {
          wallUvs.push(0, 1 - t);
          wallUvs.push(0, 1 - t);
        }
      } else {
        wallUvs.push(0, 0);
        wallUvs.push(0, 0);
      }
    }

    for (let i = 0; i < vertices.length - 1; i++) {
      const bl = i * 2,
        tl = i * 2 + 1,
        br = (i + 1) * 2,
        tr = (i + 1) * 2 + 1;
      wallIdx.push(bl, tl, br);
      wallIdx.push(br, tl, tr);
    }

    wallGeom.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeom.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    wallGeom.setIndex(wallIdx);
    wallGeom.computeVertexNormals();
    group.add(new THREE.Mesh(wallGeom, material));
  }

  return group;
}

function getRampShapeData(item: RampItem): RampShapeData | null {
  const points = item.drag_points;
  if (!points || points.length < 2) return null;

  const widthBottom = item.width_bottom ?? RAMP_DEFAULTS.width_bottom;
  const widthTop = item.width_top ?? RAMP_DEFAULTS.width_top;
  const rampType = item.ramp_type;
  const rampTypeLower = (rampType || '').toLowerCase();
  const isWireRamp =
    rampTypeLower === 'one_wire' ||
    rampTypeLower === 'two_wire' ||
    rampTypeLower === 'three_wire_left' ||
    rampTypeLower === 'three_wire_right' ||
    rampTypeLower === 'four_wire';

  const smoothResult = generateSmoothedPath(points, false, PATH_SMOOTHING_ACCURACY, true) as SmoothedPathResult;
  const centerline = smoothResult.vertices;
  const controlPointIndices = smoothResult.controlPointIndices;
  if (centerline.length < 2) return null;

  if (isWireRamp) {
    const wireDistanceX = item.wire_distance_x ?? RAMP_DEFAULTS.wire_distance_x;
    const wireDiameter = item.wire_diameter ?? RAMP_DEFAULTS.wire_diameter;
    const isOneWire = rampTypeLower === 'one_wire';
    const width = isOneWire ? wireDiameter : wireDistanceX;
    const { left, right } = generateRampShape(centerline, width, width);
    return { left, right, centerline, controlPointIndices, isWireRamp, rampTypeLower };
  }

  const { left, right } = generateRampShape(centerline, widthBottom, widthTop);
  return { left, right, centerline, controlPointIndices, isWireRamp, rampTypeLower };
}

export function uiRenderPass1(item: RampItem, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  if (!state.viewSolid) return;

  const shapeData = getRampShapeData(item);
  if (!shapeData || shapeData.isWireRamp) return;

  const { left, right } = shapeData;
  const fillColor = getFillColorWithAlpha(0.6);

  ctx.fillStyle = fillColor;
  ctx.beginPath();

  const firstLeft = toScreen(left[0].x, left[0].y);
  ctx.moveTo(firstLeft.x, firstLeft.y);

  for (let i = 1; i < left.length; i++) {
    const { x, y } = toScreen(left[i].x, left[i].y);
    ctx.lineTo(x, y);
  }

  for (let i = right.length - 1; i >= 0; i--) {
    const { x, y } = toScreen(right[i].x, right[i].y);
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
}

function drawRampShape(
  ctx: CanvasRenderingContext2D,
  shapeData: RampShapeData,
  transformFn: (x: number, y: number) => SmoothedPoint,
  strokeStyle: string,
  lineWidth: number,
  fillStyle: string | null
): void {
  const { left, right, centerline, controlPointIndices, isWireRamp, rampTypeLower } = shapeData;

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;

  if (isWireRamp) {
    const isFourWire = rampTypeLower === 'four_wire';
    const isThreeWireRight = rampTypeLower === 'three_wire_right';
    const isThreeWireLeft = rampTypeLower === 'three_wire_left';

    ctx.beginPath();
    const firstLeft = transformFn(left[0].x, left[0].y);
    ctx.moveTo(firstLeft.x, firstLeft.y);
    for (let i = 1; i < left.length; i++) {
      const pt = transformFn(left[i].x, left[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      const pt = transformFn(right[i].x, right[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < centerline.length; i++) {
      const pt = transformFn(centerline[i].x, centerline[i].y);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    if (isFourWire || isThreeWireRight) {
      ctx.strokeStyle = RENDER_COLOR_BLACK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < left.length; i++) {
        const pt = transformFn(left[i].x, left[i].y);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    if (isFourWire || isThreeWireLeft) {
      ctx.strokeStyle = RENDER_COLOR_BLACK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < right.length; i++) {
        const pt = transformFn(right[i].x, right[i].y);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    const firstLeft = transformFn(left[0].x, left[0].y);
    ctx.moveTo(firstLeft.x, firstLeft.y);

    for (let i = 1; i < left.length; i++) {
      const pt = transformFn(left[i].x, left[i].y);
      ctx.lineTo(pt.x, pt.y);
    }

    for (let i = right.length - 1; i >= 0; i--) {
      const pt = transformFn(right[i].x, right[i].y);
      ctx.lineTo(pt.x, pt.y);
    }

    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    ctx.stroke();

    ctx.strokeStyle = RENDER_COLOR_BLACK;
    ctx.lineWidth = 1;
    for (const idx of controlPointIndices) {
      if (idx >= 0 && idx < left.length) {
        const l = transformFn(left[idx].x, left[idx].y);
        const r = transformFn(right[idx].x, right[idx].y);
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
      }
    }
  }
}

export function uiRenderPass2(item: RampItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const shapeData = getRampShapeData(item);
  if (!shapeData) return;

  drawRampShape(
    ctx,
    shapeData,
    toScreen,
    getStrokeStyle(item, isSelected),
    isSelected ? getLineWidth(isSelected) : 2,
    null
  );
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: RampItem, scale: number, solid: boolean): void {
  const shapeData = getRampShapeData(item);
  if (!shapeData) return;

  const transformFn = (x: number, y: number): SmoothedPoint => ({ x: x * scale, y: y * scale });
  drawRampShape(
    ctx,
    shapeData,
    transformFn,
    RENDER_COLOR_BLACK,
    1,
    solid && !shapeData.isWireRamp ? BLUEPRINT_SOLID_COLOR : null
  );
}

export function render(item: RampItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestRamp(item: RampItem, worldX: number, worldY: number): boolean {
  if (!item.drag_points || item.drag_points.length < 2) return false;
  const widthBottom = item.width_bottom ?? RAMP_DEFAULTS.width_bottom;
  const widthTop = item.width_top ?? RAMP_DEFAULTS.width_top;
  const pts = item.drag_points.map(p => getDragPointCoords(p));
  const centerline = generateSmoothedPath(pts, false, PATH_SMOOTHING_ACCURACY);
  if (!Array.isArray(centerline) || centerline.length < 2) return false;
  const { left, right } = generateRampShape(centerline, widthBottom, widthTop);
  const polygon = [...left, ...right.slice().reverse()];
  return pointInPolygon(worldX, worldY, polygon);
}

export function rampProperties(item: RampItem): string {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Type</label>
          <select class="prop-select" data-prop="ramp_type">
            <option value="one_wire"${item.ramp_type === 'one_wire' ? ' selected' : ''}>1-Wire</option>
            <option value="two_wire"${item.ramp_type === 'two_wire' ? ' selected' : ''}>2-Wire</option>
            <option value="three_wire_left"${item.ramp_type === 'three_wire_left' ? ' selected' : ''}>3-Wire Left</option>
            <option value="three_wire_right"${item.ramp_type === 'three_wire_right' ? ' selected' : ''}>3-Wire Right</option>
            <option value="four_wire"${item.ramp_type === 'four_wire' ? ' selected' : ''}>4-Wire</option>
            <option value="flat"${(item.ramp_type || 'flat') === 'flat' ? ' selected' : ''}>Flat</option>
          </select>
        </div>
        ${imageSelect('Image', 'image', imageOptions(item.image))}
        ${materialSelect('Material', 'material', materialOptions(item.material))}
        <div class="prop-row">
          <label class="prop-label">Mode</label>
          <select class="prop-select" data-prop="image_alignment">
            <option value="world"${item.image_alignment === 'world' ? ' selected' : ''}>World</option>
            <option value="wrap"${(item.image_alignment || 'wrap') === 'wrap' ? ' selected' : ''}>Wrap</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Apply Image to Wall</label>
          <input type="checkbox" class="prop-input" data-prop="image_walls" ${item.image_walls ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Depth Bias</label>
          <input type="number" class="prop-input" data-prop="depth_bias" value="${(item.depth_bias ?? RAMP_DEFAULTS.depth_bias).toFixed(1)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">Top Height</label>
          <input type="number" class="prop-input" data-prop="height_top" data-convert-units value="${convertToUnit(item.height_top ?? RAMP_DEFAULTS.height_top).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Height</label>
          <input type="number" class="prop-input" data-prop="height_bottom" data-convert-units value="${convertToUnit(item.height_bottom ?? RAMP_DEFAULTS.height_bottom).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Top Width</label>
          <input type="number" class="prop-input" data-prop="width_top" data-convert-units value="${convertToUnit(item.width_top ?? RAMP_DEFAULTS.width_top).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Width</label>
          <input type="number" class="prop-input" data-prop="width_bottom" data-convert-units value="${convertToUnit(item.width_bottom ?? RAMP_DEFAULTS.width_bottom).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Visible Wall</div>
        <div class="prop-row">
          <label class="prop-label">Left Wall</label>
          <input type="number" class="prop-input" data-prop="left_wall_height_visible" data-convert-units value="${convertToUnit(item.left_wall_height_visible ?? RAMP_DEFAULTS.left_wall_height_visible).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Right Wall</label>
          <input type="number" class="prop-input" data-prop="right_wall_height_visible" data-convert-units value="${convertToUnit(item.right_wall_height_visible ?? RAMP_DEFAULTS.right_wall_height_visible).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Wire Ramp</div>
        <div class="prop-row">
          <label class="prop-label">Diameter</label>
          <input type="number" class="prop-input" data-prop="wire_diameter" data-convert-units value="${convertToUnit(item.wire_diameter ?? RAMP_DEFAULTS.wire_diameter).toFixed(2)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">DistanceX</label>
          <input type="number" class="prop-input" data-prop="wire_distance_x" data-convert-units value="${convertToUnit(item.wire_distance_x ?? RAMP_DEFAULTS.wire_distance_x).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">DistanceY</label>
          <input type="number" class="prop-input" data-prop="wire_distance_y" data-convert-units value="${convertToUnit(item.wire_distance_y ?? RAMP_DEFAULTS.wire_distance_y).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Has Hit Event</label>
          <input type="checkbox" class="prop-input" data-prop="hit_event" ${item.hit_event ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Threshold</label>
          <input type="number" class="prop-input" data-prop="threshold" value="${(item.threshold ?? RAMP_DEFAULTS.threshold).toFixed(2)}" step="0.1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Physical Wall</div>
        <div class="prop-row">
          <label class="prop-label">Left Wall</label>
          <input type="number" class="prop-input" data-prop="left_wall_height" data-convert-units value="${convertToUnit(item.left_wall_height ?? RAMP_DEFAULTS.left_wall_height).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Right Wall</label>
          <input type="number" class="prop-input" data-prop="right_wall_height" data-convert-units value="${convertToUnit(item.right_wall_height ?? RAMP_DEFAULTS.right_wall_height).toFixed(2)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
      </div>
      <div class="prop-group">
        ${materialSelect('Physics Material', 'physics_material', materialOptions(item.physics_material))}
        <div class="prop-row">
          <label class="prop-label">Overwrite Material Settings</label>
          <input type="checkbox" class="prop-input" data-prop="overwrite_physics" ${item.overwrite_physics !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? RAMP_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? RAMP_DEFAULTS.elasticity_falloff).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? RAMP_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? RAMP_DEFAULTS.scatter).toFixed(1)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_collidable" ${item.is_collidable !== false ? 'checked' : ''}>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="timer">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_timer_enabled" ${item.is_timer_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${item.timer_interval ?? RAMP_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: RampItem): Point | null {
  const points = item.drag_points;
  if (!points || points.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    const { x, y } = getDragPointCoords(p);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function putCenter(item: RampItem, center: Point): void {
  const oldCenter = getCenter(item);
  if (!oldCenter || !item.drag_points) return;
  const dx = center.x - oldCenter.x;
  const dy = center.y - oldCenter.y;
  for (const p of item.drag_points) {
    if (p.vertex) {
      p.vertex.x += dx;
      p.vertex.y += dy;
    } else {
      if (p.x !== undefined) p.x += dx;
      if (p.y !== undefined) p.y += dy;
    }
  }
}

const rampRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestRamp,
  create3DMesh: createRamp3DMesh,
  getProperties: rampProperties,
  getCenter,
  putCenter,
};
registerEditable('Ramp', rampRenderer);
