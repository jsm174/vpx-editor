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

interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

function crossV(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): { x: number; y: number; z: number } {
  return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
}

function normalizeV(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return v;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function rotateAxisAngle(
  point: { x: number; y: number; z: number },
  axis: { x: number; y: number; z: number },
  angleDeg: number
): { x: number; y: number; z: number } {
  const u = normalizeV(axis);
  const rad = (angleDeg * Math.PI) / 180.0;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const omc = 1.0 - cosA;

  const r0x = u.x * u.x + cosA * (1 - u.x * u.x);
  const r0y = u.x * u.y * omc - sinA * u.z;
  const r0z = u.x * u.z * omc + sinA * u.y;
  const r1x = u.x * u.y * omc + sinA * u.z;
  const r1y = u.y * u.y + cosA * (1 - u.y * u.y);
  const r1z = u.y * u.z * omc - sinA * u.x;
  const r2x = u.x * u.z * omc - sinA * u.y;
  const r2y = u.y * u.z * omc + sinA * u.x;
  const r2z = u.z * u.z + cosA * (1 - u.z * u.z);

  return {
    x: point.x * r0x + point.y * r0y + point.z * r0z,
    y: point.x * r1x + point.y * r1y + point.z * r1z,
    z: point.x * r2x + point.y * r2y + point.z * r2z,
  };
}

function createWireRingMesh(
  midPoints: { x: number; y: number }[],
  heights: number[],
  wireDiameter: number,
  material: THREE.Material
): THREE.Mesh {
  const numRings = midPoints.length;
  const numSegments = 13;
  const numVertices = numRings * numSegments;
  const numIndices = 6 * (numRings - 1) * numSegments;
  const radius = wireDiameter * 0.5;

  const positions = new Float32Array(numVertices * 3);
  const uvs = new Float32Array(numVertices * 2);
  const indices = new Uint32Array(numIndices);

  const invNR = 1.0 / numRings;
  const invNS = 1.0 / numSegments;
  let prevB = { x: 0, y: 0, z: 0 };

  for (let i = 0, index = 0; i < numRings; i++) {
    const i2 = i === numRings - 1 ? i : i + 1;
    const h = heights[i];

    let tangent = {
      x: midPoints[i2].x - midPoints[i].x,
      y: midPoints[i2].y - midPoints[i].y,
      z: heights[i2] - heights[i],
    };
    if (i === numRings - 1) {
      tangent = {
        x: midPoints[i].x - midPoints[i - 1].x,
        y: midPoints[i].y - midPoints[i - 1].y,
        z: heights[i] - heights[i - 1],
      };
    }

    let normal: { x: number; y: number; z: number };
    let binorm: { x: number; y: number; z: number };

    if (i === 0) {
      const up = { x: midPoints[i2].x + midPoints[i].x, y: midPoints[i2].y + midPoints[i].y, z: heights[i2] - h };
      normal = crossV(tangent.x, tangent.y, tangent.z, up.x, up.y, up.z);
      binorm = crossV(tangent.x, tangent.y, tangent.z, normal.x, normal.y, normal.z);
    } else {
      normal = crossV(prevB.x, prevB.y, prevB.z, tangent.x, tangent.y, tangent.z);
      binorm = crossV(tangent.x, tangent.y, tangent.z, normal.x, normal.y, normal.z);
    }

    binorm = normalizeV(binorm);
    normal = normalizeV(normal);
    prevB = binorm;

    const u = i * invNR;
    for (let j = 0; j < numSegments; j++, index++) {
      const v = (j + u) * invNS;
      const angleDeg = j * (360.0 * invNS);
      const tmp = rotateAxisAngle(normal, tangent, angleDeg);

      positions[index * 3] = midPoints[i].x + tmp.x * radius;
      positions[index * 3 + 1] = midPoints[i].y + tmp.y * radius;
      positions[index * 3 + 2] = h + tmp.z * radius;

      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }

  for (let i = 0; i < numRings - 1; i++) {
    for (let j = 0; j < numSegments; j++) {
      const q0 = i * numSegments + j;
      const q1 = j !== numSegments - 1 ? i * numSegments + j + 1 : i * numSegments;
      const q2 = (i + 1) * numSegments + j;
      const q3 = j !== numSegments - 1 ? (i + 1) * numSegments + j + 1 : (i + 1) * numSegments;

      const off = (i * numSegments + j) * 6;
      indices[off] = q0;
      indices[off + 1] = q1;
      indices[off + 2] = q2;
      indices[off + 3] = q3;
      indices[off + 4] = q2;
      indices[off + 5] = q1;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, material);
}

function computeRampNormal(path: Vertex3D[], i: number): { nx: number; ny: number } {
  const cvertex = path.length;
  const vprev = path[i > 0 ? i - 1 : i];
  const vmiddle = path[i];
  const vnext = path[i < cvertex - 1 ? i + 1 : i];

  const v1normal = { x: vprev.y - vmiddle.y, y: vmiddle.x - vprev.x };
  const v2normal = { x: vmiddle.y - vnext.y, y: vnext.x - vmiddle.x };

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

  if (i === cvertex - 1) {
    return { nx: v1normal.x, ny: v1normal.y };
  } else if (i === 0) {
    return { nx: v2normal.x, ny: v2normal.y };
  } else if (Math.abs(v1normal.x - v2normal.x) < 0.0001 && Math.abs(v1normal.y - v2normal.y) < 0.0001) {
    return { nx: v1normal.x, ny: v1normal.y };
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

    return { nx: vmiddle.x - intersectx, ny: vmiddle.y - intersecty };
  }
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

    const buildWire = (offset: number, zOffset: number = 0): void => {
      const midPoints: { x: number; y: number }[] = [];
      const heights: number[] = [];
      for (let i = 0; i < smoothedPath.length; i++) {
        const p = smoothedPath[i];
        const t = totalLength > 0 ? pathLengths[i] / totalLength : 0;
        const h = p.z + heightBottom + t * (heightTop - heightBottom) + zOffset;
        const { nx, ny } = computeRampNormal(smoothedPath, i);
        midPoints.push({ x: p.x + nx * offset, y: p.y + ny * offset });
        heights.push(h);
      }
      if (midPoints.length >= 2) {
        group.add(createWireRingMesh(midPoints, heights, wireDiameter, wireMat));
      }
    };

    if (rampType === 'one_wire') {
      buildWire(0);
    } else if (rampType === 'two_wire') {
      buildWire(wireDistanceX / 2);
      buildWire(-wireDistanceX / 2);
    } else if (rampType === 'three_wire_left') {
      buildWire(wireDistanceX / 2);
      buildWire(-wireDistanceX / 2);
      buildWire(wireDistanceX / 2, wireDistanceY / 2);
    } else if (rampType === 'three_wire_right') {
      buildWire(wireDistanceX / 2);
      buildWire(-wireDistanceX / 2);
      buildWire(-wireDistanceX / 2, wireDistanceY / 2);
    } else if (rampType === 'four_wire') {
      buildWire(wireDistanceX / 2);
      buildWire(-wireDistanceX / 2);
      buildWire(wireDistanceX / 2, wireDistanceY / 2);
      buildWire(-wireDistanceX / 2, wireDistanceY / 2);
    } else {
      buildWire(wireDistanceX / 2);
      buildWire(-wireDistanceX / 2);
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

    const { nx, ny } = computeRampNormal(smoothedPath, i);

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
