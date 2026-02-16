import * as THREE from 'three';
import { state, elements } from '../state.js';
import {
  toScreen,
  generateSmoothedPath,
  getStrokeStyle,
  getLineWidth,
  getFillColorWithAlpha,
  pointInPolygon,
  normalize,
} from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { materialSelect, imageSelect } from '../../shared/property-templates.js';
import { RUBBER_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, BLUEPRINT_SOLID_COLOR } from '../../shared/constants.js';
import { convertToUnit, getUnitSuffixHtml } from '../utils.js';
import { registerEditable, IEditable, Point } from './registry.js';
import { getDragPointCoords } from '../../types/game-objects.js';

export function createRubber3DMesh(item: unknown): THREE.Object3D | null {
  const rubberItem = item as {
    drag_points?: Array<{ x: number; y: number }>;
    thickness?: number;
    height?: number;
    rot_x?: number;
    rot_y?: number;
    rot_z?: number;
    material?: string;
    image?: string;
  };

  const points = rubberItem.drag_points;
  if (!points || points.length < 2) return null;

  const thickness = rubberItem.thickness ?? RUBBER_DEFAULTS.thickness;
  const height = rubberItem.height ?? RUBBER_DEFAULTS.height;
  const rotX = ((rubberItem.rot_x ?? RUBBER_DEFAULTS.rot_x) * Math.PI) / 180;
  const rotY = ((rubberItem.rot_y ?? RUBBER_DEFAULTS.rot_y) * Math.PI) / 180;
  const rotZ = ((rubberItem.rot_z ?? RUBBER_DEFAULTS.rot_z) * Math.PI) / 180;

  const smoothedResult = generateSmoothedPath(points, true);
  if (!Array.isArray(smoothedResult)) return null;
  const smoothed = smoothedResult;
  if (smoothed.length < 2) return null;

  const pathPoints = smoothed.map(v => new THREE.Vector3(v.x, v.y, height));

  const curve = new THREE.CatmullRomCurve3(pathPoints, true);
  const tubeGeom = new THREE.TubeGeometry(curve, pathPoints.length * 2, thickness / 2, 8, true);
  const material = createMaterial(rubberItem.material, rubberItem.image);
  const mesh = new THREE.Mesh(tubeGeom, material);

  if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
    const center = new THREE.Vector3();
    tubeGeom.computeBoundingBox();
    tubeGeom.boundingBox!.getCenter(center);

    mesh.position.set(-center.x, -center.y, -center.z);

    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.order = 'ZYX';
    group.rotation.set(rotX, rotY, rotZ);
    group.position.set(center.x, center.y, center.z);
    return group;
  }

  return mesh;
}

function generateRubberShape(
  centerline: Point[],
  thickness: number,
  loop: boolean = false
): { left: Point[]; right: Point[] } {
  if (centerline.length < 2) return { left: [], right: [] };

  const left: Point[] = [];
  const right: Point[] = [];
  const halfWidth = thickness / 2;
  const cvertex = centerline.length;

  for (let i = 0; i < cvertex; i++) {
    const prev = loop ? centerline[i > 0 ? i - 1 : cvertex - 1] : i > 0 ? centerline[i - 1] : null;
    const curr = centerline[i];
    const next = loop ? centerline[i < cvertex - 1 ? i + 1 : 0] : i < cvertex - 1 ? centerline[i + 1] : null;

    let vnormal: Point;

    if (!prev) {
      vnormal = normalize(-(next!.y - curr.y), next!.x - curr.x);
    } else if (!next) {
      vnormal = normalize(-(curr.y - prev.y), curr.x - prev.x);
    } else {
      const v1normal = normalize(prev.y - curr.y, curr.x - prev.x);
      const v2normal = normalize(curr.y - next.y, next.x - curr.x);

      if (Math.abs(v1normal.x - v2normal.x) < 0.0001 && Math.abs(v1normal.y - v2normal.y) < 0.0001) {
        vnormal = v1normal;
      } else {
        const A = prev.y - curr.y;
        const B = curr.x - prev.x;
        const C = A * (v1normal.x - prev.x) + B * (v1normal.y - prev.y);

        const D = next.y - curr.y;
        const E = curr.x - next.x;
        const F = D * (v2normal.x - next.x) + E * (v2normal.y - next.y);

        const det = A * E - B * D;
        if (Math.abs(det) < 0.0001) {
          vnormal = v1normal;
        } else {
          const inv_det = 1.0 / det;
          const intersectx = (B * F - E * C) * inv_det;
          const intersecty = (C * D - A * F) * inv_det;
          vnormal = { x: curr.x - intersectx, y: curr.y - intersecty };
        }
      }
    }

    left.push({
      x: curr.x + vnormal.x * halfWidth,
      y: curr.y + vnormal.y * halfWidth,
    });
    right.push({
      x: curr.x - vnormal.x * halfWidth,
      y: curr.y - vnormal.y * halfWidth,
    });
  }

  if (loop && left.length > 0) {
    left.push({ x: left[0].x, y: left[0].y });
    right.push({ x: right[0].x, y: right[0].y });
  }

  return { left, right };
}

const HIT_SHAPE_DETAIL_LEVEL = 7.0;
const RUBBER_2D_ACCURACY = 4.0 * Math.pow(10.0, (10.0 - HIT_SHAPE_DETAIL_LEVEL) / 1.5);

function getRubberShapeData(item: unknown): { left: Point[]; right: Point[]; controlPointIndices: number[] } | null {
  const rubberItem = item as {
    drag_points?: Array<{ x: number; y: number }>;
    thickness?: number;
  };

  const points = rubberItem.drag_points;
  if (!points || points.length < 2) return null;

  const thickness = rubberItem.thickness ?? RUBBER_DEFAULTS.thickness;
  const pathResult = generateSmoothedPath(points, true, RUBBER_2D_ACCURACY, true);
  if (Array.isArray(pathResult)) return null;
  const { vertices: centerline, controlPointIndices } = pathResult;
  if (centerline.length < 2) return null;

  const { left, right } = generateRubberShape(centerline, thickness, true);
  return { left, right, controlPointIndices };
}

function drawRubberShape(
  ctx: CanvasRenderingContext2D,
  left: Point[],
  right: Point[],
  controlPointIndices: number[] | null,
  transformFn: (x: number, y: number) => Point,
  fillStyle: string | null,
  strokeStyle: string | null,
  lineWidth: number
): void {
  ctx.beginPath();
  const firstLeft = transformFn(left[0].x, left[0].y);
  ctx.moveTo(firstLeft.x, firstLeft.y);

  for (let i = 1; i < left.length; i++) {
    const { x, y } = transformFn(left[i].x, left[i].y);
    ctx.lineTo(x, y);
  }

  for (let i = right.length - 1; i >= 0; i--) {
    const { x, y } = transformFn(right[i].x, right[i].y);
    ctx.lineTo(x, y);
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
  }

  if (controlPointIndices && strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    for (const idx of controlPointIndices) {
      if (idx < left.length && idx < right.length) {
        const leftPt = transformFn(left[idx].x, left[idx].y);
        const rightPt = transformFn(right[idx].x, right[idx].y);
        ctx.beginPath();
        ctx.moveTo(leftPt.x, leftPt.y);
        ctx.lineTo(rightPt.x, rightPt.y);
        ctx.stroke();
      }
    }
  }
}

export function uiRenderPass1(item: unknown, _isSelected: boolean): void {
  if (!elements.ctx) return;
  if (!state.viewSolid) return;

  const shapeData = getRubberShapeData(item);
  if (!shapeData) return;

  const { left, right } = shapeData;
  drawRubberShape(elements.ctx, left, right, null, toScreen, getFillColorWithAlpha(0.6), null, 0);
}

export function uiRenderPass2(item: unknown, isSelected: boolean): void {
  if (!elements.ctx) return;
  const shapeData = getRubberShapeData(item);
  if (!shapeData) return;

  const { left, right, controlPointIndices } = shapeData;
  drawRubberShape(
    elements.ctx,
    left,
    right,
    controlPointIndices,
    toScreen,
    null,
    getStrokeStyle(item as { is_locked?: boolean }, isSelected),
    getLineWidth(isSelected)
  );
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: unknown, scale: number, solid: boolean): void {
  const shapeData = getRubberShapeData(item);
  if (!shapeData) return;

  const { left, right, controlPointIndices } = shapeData;
  const transformFn = (x: number, y: number): Point => ({ x: x * scale, y: y * scale });
  drawRubberShape(
    ctx,
    left,
    right,
    controlPointIndices,
    transformFn,
    solid ? BLUEPRINT_SOLID_COLOR : null,
    RENDER_COLOR_BLACK,
    1
  );
}

export function render(item: unknown, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestRubber(item: unknown, worldX: number, worldY: number): boolean {
  const rubberItem = item as {
    drag_points?: Array<{ vertex?: { x: number; y: number }; x?: number; y?: number }>;
    thickness?: number;
  };

  if (!rubberItem.drag_points || rubberItem.drag_points.length < 2) return false;
  const thickness = rubberItem.thickness ?? RUBBER_DEFAULTS.thickness;
  const pts = rubberItem.drag_points.map(p => getDragPointCoords(p));
  const centerlineResult = generateSmoothedPath(pts, true, RUBBER_2D_ACCURACY);
  if (!Array.isArray(centerlineResult)) return false;
  const centerline = centerlineResult;
  if (centerline.length < 2) return false;
  const { left, right } = generateRubberShape(centerline, thickness, true);
  const polygon = [...left, ...right.slice().reverse()];
  return pointInPolygon(worldX, worldY, polygon);
}

export function rubberProperties(item: unknown): string {
  const rubberItem = item as {
    image?: string;
    material?: string;
    static_rendering?: boolean;
    is_visible?: boolean;
    is_reflection_enabled?: boolean;
    height?: number;
    thickness?: number;
    rot_x?: number;
    rot_y?: number;
    rot_z?: number;
    show_in_editor?: boolean;
    physics_material?: string;
    overwrite_physics?: boolean;
    elasticity?: number;
    elasticity_falloff?: number;
    friction?: number;
    scatter?: number;
    hit_height?: number;
    is_collidable?: boolean;
    hit_event?: boolean;
    is_timer_enabled?: boolean;
    timer_interval?: number;
  };

  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        ${imageSelect('Image', 'image', imageOptions(rubberItem.image))}
        ${materialSelect('Material', 'material', materialOptions(rubberItem.material))}
        <div class="prop-row">
          <label class="prop-label">Static Rendering</label>
          <input type="checkbox" class="prop-input" data-prop="static_rendering" ${rubberItem.static_rendering ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${rubberItem.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${rubberItem.is_reflection_enabled ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" data-convert-units value="${convertToUnit(rubberItem.height ?? RUBBER_DEFAULTS.height).toFixed(1)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Thickness</label>
          <input type="number" class="prop-input" data-prop="thickness" data-type="int" data-convert-units value="${convertToUnit(rubberItem.thickness ?? RUBBER_DEFAULTS.thickness).toFixed(1)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Orientation</div>
        <div class="prop-row">
          <label class="prop-label">RotX</label>
          <input type="number" class="prop-input" data-prop="rot_x" value="${(rubberItem.rot_x ?? RUBBER_DEFAULTS.rot_x).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotY</label>
          <input type="number" class="prop-input" data-prop="rot_y" value="${(rubberItem.rot_y ?? RUBBER_DEFAULTS.rot_y).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotZ</label>
          <input type="number" class="prop-input" data-prop="rot_z" value="${(rubberItem.rot_z ?? RUBBER_DEFAULTS.rot_z).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Show in Editor</label>
          <input type="checkbox" class="prop-input" data-prop="show_in_editor" ${rubberItem.show_in_editor !== false ? 'checked' : ''}>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        ${materialSelect('Physics Material', 'physics_material', materialOptions(rubberItem.physics_material))}
        <div class="prop-row">
          <label class="prop-label">Overwrite Material Settings</label>
          <input type="checkbox" class="prop-input" data-prop="overwrite_physics" ${rubberItem.overwrite_physics ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(rubberItem.elasticity ?? RUBBER_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(rubberItem.elasticity_falloff ?? RUBBER_DEFAULTS.elasticity_falloff).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(rubberItem.friction ?? RUBBER_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(rubberItem.scatter ?? RUBBER_DEFAULTS.scatter).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Hit Height</label>
          <input type="number" class="prop-input" data-prop="hit_height" data-convert-units value="${convertToUnit(rubberItem.hit_height ?? RUBBER_DEFAULTS.hit_height).toFixed(1)}" step="${convertToUnit(1).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_collidable" ${rubberItem.is_collidable ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Has Hit Event</label>
          <input type="checkbox" class="prop-input" data-prop="hit_event" ${rubberItem.hit_event ? 'checked' : ''}>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="timer">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_timer_enabled" ${rubberItem.is_timer_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${rubberItem.timer_interval ?? RUBBER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: unknown): Point | null {
  const rubberItem = item as { drag_points?: Array<{ vertex?: { x: number; y: number }; x?: number; y?: number }> };
  const points = rubberItem.drag_points;
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

function putCenter(item: unknown, center: Point): void {
  const rubberItem = item as { drag_points?: Array<{ vertex?: { x: number; y: number }; x?: number; y?: number }> };
  const oldCenter = getCenter(item);
  if (!oldCenter || !rubberItem.drag_points) return;
  const dx = center.x - oldCenter.x;
  const dy = center.y - oldCenter.y;
  for (const p of rubberItem.drag_points) {
    if (p.vertex) {
      p.vertex.x += dx;
      p.vertex.y += dy;
    } else {
      if (p.x !== undefined) (p as { x: number }).x += dx;
      if (p.y !== undefined) (p as { y: number }).y += dy;
    }
  }
}

const rubberRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestRubber,
  create3DMesh: createRubber3DMesh,
  getProperties: rubberProperties,
  getCenter,
  putCenter,
};
registerEditable('Rubber', rubberRenderer);
