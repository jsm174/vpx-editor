import * as THREE from 'three';
import { state, elements } from '../state.js';
import {
  toScreen,
  generateSmoothedPath,
  getStrokeStyle,
  getLineWidth,
  getFillColorWithAlpha,
  pointInPolygon,
  drawPolygon,
} from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { WALL_DEFAULTS } from '../../shared/object-defaults.js';
import { RENDER_COLOR_BLACK, BLUEPRINT_SOLID_COLOR, PATH_SMOOTHING_ACCURACY } from '../../shared/constants.js';
import { convertToUnit, getUnitSuffixHtml } from '../utils.js';
import { registerEditable, IEditable, Point } from './registry.js';
import type { Wall, DragPoint } from '../../types/game-objects.js';
import { getDragPointCoords } from '../../types/game-objects.js';

interface WallDragPoint extends DragPoint {
  slingshot?: boolean;
  x: number;
  y: number;
}

interface WallItem extends Wall {
  drag_points: WallDragPoint[];
  side_image?: string;
  physics_material?: string;
  overwrite_physics?: boolean;
  is_flipbook?: boolean;
  is_bottom_solid?: boolean;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  disable_lighting_top_old?: number;
  is_reflection_enabled?: boolean;
  hit_event?: boolean;
}

function createWallSidesGeometry(shape: THREE.Shape, height: number): THREE.BufferGeometry {
  const points = shape.getPoints();
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const baseIdx = vertices.length / 3;

    vertices.push(p1.x, p1.y, 0);
    vertices.push(p2.x, p2.y, 0);
    vertices.push(p1.x, p1.y, height);
    vertices.push(p2.x, p2.y, height);

    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createWall3DMesh(item: WallItem): THREE.Mesh | null {
  const points = item.drag_points;
  if (!points || points.length < 3) return null;

  const sideVisible = item.is_side_visible !== false;
  const topVisible = item.is_top_bottom_visible !== false;

  if (!sideVisible && !topVisible) return null;

  const heightBottom = item.height_bottom ?? WALL_DEFAULTS.height_bottom;
  const heightTop = item.height_top ?? WALL_DEFAULTS.height_top;
  const height = heightTop - heightBottom;

  if (Math.abs(height) < 0.1 && !topVisible) return null;

  const vertices = generateSmoothedPath(points, true, PATH_SMOOTHING_ACCURACY) as Point[];
  if (vertices.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(vertices[0].x, vertices[0].y);

  for (let i = 1; i < vertices.length; i++) {
    shape.lineTo(vertices[i].x, vertices[i].y);
  }
  shape.closePath();

  const material = createMaterial(item.top_material || item.side_material, item.image || item.side_image);

  if (!sideVisible && topVisible) {
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = heightTop;
    return mesh;
  }

  if (sideVisible && !topVisible) {
    const geometry = createWallSidesGeometry(shape, Math.abs(height));
    const mesh = new THREE.Mesh(geometry, material);
    const baseZ = Math.min(heightBottom, heightTop);
    mesh.position.z = baseZ >= 0 && baseZ < 1 ? 0.5 : baseZ;
    return mesh;
  }

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.abs(height), bevelEnabled: false });
  const mesh = new THREE.Mesh(geometry, material);
  const baseZ = Math.min(heightBottom, heightTop);
  mesh.position.z = baseZ >= 0 && baseZ < 1 ? 0.5 : baseZ;

  return mesh;
}

function getVertices(item: WallItem): Point[] | null {
  const points = item.drag_points;
  if (!points || points.length < 2) return null;
  const vertices = generateSmoothedPath(points, true, PATH_SMOOTHING_ACCURACY) as Point[];
  if (vertices.length < 2) return null;
  return vertices;
}

export function uiRenderPass1(item: WallItem, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const vertices = getVertices(item);
  if (!vertices) return;

  const fillColor = state.viewSolid ? getFillColorWithAlpha(0.6) : null;
  if (!fillColor) return;

  drawPolygon(ctx, vertices, toScreen, fillColor, null, 0);
}

export function uiRenderPass2(item: WallItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const vertices = getVertices(item);
  if (!vertices) return;

  drawPolygon(ctx, vertices, toScreen, null, getStrokeStyle(item, isSelected), getLineWidth(isSelected));

  const points = item.drag_points;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.is_slingshot || pt.slingshot) {
      const nextPt = points[(i + 1) % points.length];
      const v1 = getDragPointCoords(pt);
      const v2 = getDragPointCoords(nextPt);
      const p1 = toScreen(v1.x, v1.y);
      const p2 = toScreen(v2.x, v2.y);

      ctx.strokeStyle = RENDER_COLOR_BLACK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.strokeStyle = getStrokeStyle(item, isSelected);
      ctx.lineWidth = getLineWidth(isSelected);
    }
  }
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: WallItem, scale: number, solid: boolean): void {
  const vertices = getVertices(item);
  if (!vertices) return;

  const transformFn = (x: number, y: number): Point => ({ x: x * scale, y: y * scale });
  drawPolygon(ctx, vertices, transformFn, solid ? BLUEPRINT_SOLID_COLOR : null, RENDER_COLOR_BLACK, 1);
}

export function render(item: WallItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestWall(item: WallItem, worldX: number, worldY: number): boolean {
  if (!item.drag_points || item.drag_points.length < 3) return false;
  const pts = item.drag_points.map(p => getDragPointCoords(p));
  return pointInPolygon(worldX, worldY, pts);
}

export function wallProperties(item: WallItem): string {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Top Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_top_bottom_visible" ${item.is_top_bottom_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Top Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Display Image in Editor</label>
          <input type="checkbox" class="prop-input" data-prop="display_texture" ${item.display_texture ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Top Material</label>
          <select class="prop-select" data-prop="top_material">${materialOptions(item.top_material)}</select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Side Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_side_visible" ${item.is_side_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Side Image</label>
          <select class="prop-select" data-prop="side_image">${imageOptions(item.side_image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Side Material</label>
          <select class="prop-select" data-prop="side_material">${materialOptions(item.side_material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Slingshot Material</label>
          <select class="prop-select" data-prop="slingshot_material">${materialOptions(item.slingshot_material)}</select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Animate Slingshot</label>
          <input type="checkbox" class="prop-input" data-prop="slingshot_animation" ${item.slingshot_animation ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Flipbook / Hide wall when dropped</label>
          <input type="checkbox" class="prop-input" data-prop="is_flipbook" ${item.is_flipbook ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Disable Lighting (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_top_old" value="${(item.disable_lighting_top_old ?? WALL_DEFAULTS.disable_lighting_top).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Translucency (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_below" value="${(item.disable_lighting_below ?? WALL_DEFAULTS.disable_lighting_below).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Top Height</label>
          <input type="number" class="prop-input" data-prop="height_top" data-convert-units value="${convertToUnit(item.height_top ?? WALL_DEFAULTS.height_top).toFixed(1)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Height</label>
          <input type="number" class="prop-input" data-prop="height_bottom" data-convert-units value="${convertToUnit(item.height_bottom ?? WALL_DEFAULTS.height_bottom).toFixed(1)}" step="${convertToUnit(5).toFixed(4)}">${getUnitSuffixHtml()}
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
          <input type="number" class="prop-input" data-prop="threshold" value="${(item.threshold ?? WALL_DEFAULTS.threshold).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Slingshot Force</label>
          <input type="number" class="prop-input" data-prop="slingshot_force" value="${(item.slingshot_force ?? WALL_DEFAULTS.slingshot_force).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Slingshot Threshold</label>
          <input type="number" class="prop-input" data-prop="slingshot_threshold" value="${(item.slingshot_threshold ?? WALL_DEFAULTS.slingshot_threshold).toFixed(2)}" step="0.5">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Physics Material</label>
          <select class="prop-select" data-prop="physics_material">${materialOptions(item.physics_material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Overwrite Material Settings</label>
          <input type="checkbox" class="prop-input" data-prop="overwrite_physics" ${item.overwrite_physics !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? WALL_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? WALL_DEFAULTS.elasticity_falloff).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? WALL_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? WALL_DEFAULTS.scatter).toFixed(1)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Can Drop</label>
          <input type="checkbox" class="prop-input" data-prop="is_droppable" ${item.is_droppable ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_collidable" ${item.is_collidable !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Is Bottom Collidable</label>
          <input type="checkbox" class="prop-input" data-prop="is_bottom_solid" ${item.is_bottom_solid ? 'checked' : ''}>
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
          <input type="number" class="prop-input" data-prop="timer_interval" data-type="int" value="${item.timer_interval ?? WALL_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: WallItem): Point | null {
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

function putCenter(item: WallItem, center: Point): void {
  const oldCenter = getCenter(item);
  if (!oldCenter || !item.drag_points) return;
  const dx = center.x - oldCenter.x;
  const dy = center.y - oldCenter.y;
  for (const p of item.drag_points) {
    if (p.vertex) {
      p.vertex.x += dx;
      p.vertex.y += dy;
    } else {
      p.x += dx;
      p.y += dy;
    }
  }
}

const wallRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestWall,
  create3DMesh: createWall3DMesh,
  getProperties: wallProperties,
  getCenter,
  putCenter,
};

registerEditable('Wall', wallRenderer);
