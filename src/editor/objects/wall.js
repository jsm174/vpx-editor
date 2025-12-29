import * as THREE from 'three';
import { state, elements } from '../state.js';
import {
  toScreen,
  generateSmoothedPath,
  getStrokeStyle,
  getLineWidth,
  getFillColorWithAlpha,
  pointInPolygon,
} from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { WALL_DEFAULTS } from '../../shared/object-defaults.js';

function createWallSidesGeometry(shape, height) {
  const points = shape.getPoints();
  const vertices = [];
  const indices = [];

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

export function createWall3DMesh(item) {
  const points = item.drag_points;
  if (!points || points.length < 3) return null;

  const sideVisible = item.is_side_visible !== false;
  const topVisible = item.is_top_bottom_visible !== false;

  if (!sideVisible && !topVisible) return null;

  const heightBottom = item.height_bottom ?? WALL_DEFAULTS.heightBottom;
  const heightTop = item.height_top ?? WALL_DEFAULTS.heightTop;
  const height = heightTop - heightBottom;

  if (Math.abs(height) < 0.1 && !topVisible) return null;

  const vertices = generateSmoothedPath(points, true, 8);
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

export function renderWall(item, isSelected) {
  const points = item.drag_points;
  if (!points || points.length < 2) return;

  const vertices = generateSmoothedPath(points, true, 8);
  if (vertices.length < 2) return;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  elements.ctx.beginPath();
  const first = toScreen(vertices[0].x, vertices[0].y);
  elements.ctx.moveTo(first.x, first.y);

  for (let i = 1; i < vertices.length; i++) {
    const pt = toScreen(vertices[i].x, vertices[i].y);
    elements.ctx.lineTo(pt.x, pt.y);
  }
  elements.ctx.closePath();
  if (state.viewSolid) {
    elements.ctx.fillStyle = getFillColorWithAlpha(0.6);
    elements.ctx.fill();
  }
  elements.ctx.stroke();

  if (vertices.length === 4) {
    const p0 = toScreen(vertices[0].x, vertices[0].y);
    const p1 = toScreen(vertices[1].x, vertices[1].y);
    const p2 = toScreen(vertices[2].x, vertices[2].y);
    const p3 = toScreen(vertices[3].x, vertices[3].y);
    elements.ctx.beginPath();
    elements.ctx.moveTo(p0.x, p0.y);
    elements.ctx.lineTo(p2.x, p2.y);
    elements.ctx.moveTo(p1.x, p1.y);
    elements.ctx.lineTo(p3.x, p3.y);
    elements.ctx.stroke();
  }

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.is_slingshot || pt.slingshot) {
      const nextPt = points[(i + 1) % points.length];
      const v1 = pt.vertex || pt;
      const v2 = nextPt.vertex || nextPt;
      const p1 = toScreen(v1.x, v1.y);
      const p2 = toScreen(v2.x, v2.y);

      elements.ctx.strokeStyle = '#000000';
      elements.ctx.lineWidth = 3;
      elements.ctx.beginPath();
      elements.ctx.moveTo(p1.x, p1.y);
      elements.ctx.lineTo(p2.x, p2.y);
      elements.ctx.stroke();
    }
  }
}

export function hitTestWall(item, worldX, worldY) {
  if (!item.drag_points || item.drag_points.length < 3) return false;
  const pts = item.drag_points.map(p => {
    const v = p.vertex || p;
    return { x: v.x, y: v.y };
  });
  return pointInPolygon(worldX, worldY, pts);
}

export function wallProperties(item) {
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
          <input type="number" class="prop-input" data-prop="disable_lighting_top_old" value="${(item.disable_lighting_top_old ?? WALL_DEFAULTS.disableLightingTop).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Translucency (0..1)</label>
          <input type="number" class="prop-input" data-prop="disable_lighting_below" value="${(item.disable_lighting_below ?? WALL_DEFAULTS.disableLightingBelow).toFixed(2)}" step="0.1" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Top Height</label>
          <input type="number" class="prop-input" data-prop="height_top" value="${(item.height_top ?? WALL_DEFAULTS.heightTop).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Height</label>
          <input type="number" class="prop-input" data-prop="height_bottom" value="${(item.height_bottom ?? WALL_DEFAULTS.heightBottom).toFixed(1)}" step="5">
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
          <input type="number" class="prop-input" data-prop="slingshot_force" value="${(item.slingshot_force ?? WALL_DEFAULTS.slingshotForce).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Slingshot Threshold</label>
          <input type="number" class="prop-input" data-prop="slingshot_threshold" value="${(item.slingshot_threshold ?? WALL_DEFAULTS.slingshotThreshold).toFixed(2)}" step="0.5">
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
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? WALL_DEFAULTS.elasticityFalloff).toFixed(3)}" step="0.05">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? WALL_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
