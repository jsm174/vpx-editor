import * as THREE from 'three';
import { state, elements } from '../state.js';
import {
  toScreen,
  generateSmoothedPath,
  generateRampShape,
  getStrokeStyle,
  getLineWidth,
  getFillColorWithAlpha,
  pointInPolygon,
} from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions } from '../../shared/options-generators.js';
import { RAMP_DEFAULTS } from '../../shared/object-defaults.js';

function interpolateZFromDragPoints(points, smoothedPath) {
  if (!points || points.length < 2) return smoothedPath.map(() => 0);

  const dragPointLengths = [0];
  let totalDragLength = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dx = (p2.x || p2.vertex?.x || 0) - (p1.x || p1.vertex?.x || 0);
    const dy = (p2.y || p2.vertex?.y || 0) - (p1.y || p1.vertex?.y || 0);
    totalDragLength += Math.sqrt(dx * dx + dy * dy);
    dragPointLengths.push(totalDragLength);
  }

  const pathLengths = [0];
  let totalPathLength = 0;
  for (let i = 1; i < smoothedPath.length; i++) {
    const dx = smoothedPath[i].x - smoothedPath[i - 1].x;
    const dy = smoothedPath[i].y - smoothedPath[i - 1].y;
    totalPathLength += Math.sqrt(dx * dx + dy * dy);
    pathLengths.push(totalPathLength);
  }

  const zValues = [];
  for (let i = 0; i < smoothedPath.length; i++) {
    const pathRatio = totalPathLength > 0 ? pathLengths[i] / totalPathLength : 0;
    const targetLength = pathRatio * totalDragLength;

    let segIndex = 0;
    for (let j = 1; j < dragPointLengths.length; j++) {
      if (dragPointLengths[j] >= targetLength) {
        segIndex = j - 1;
        break;
      }
      segIndex = j - 1;
    }

    const segStart = dragPointLengths[segIndex];
    const segEnd = dragPointLengths[segIndex + 1] || segStart;
    const segLength = segEnd - segStart;
    const segRatio = segLength > 0 ? (targetLength - segStart) / segLength : 0;

    const z1 = points[segIndex]?.z || 0;
    const z2 = points[Math.min(segIndex + 1, points.length - 1)]?.z || 0;
    zValues.push(z1 + segRatio * (z2 - z1));
  }

  return zValues;
}

export function createRamp3DMesh(item) {
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

    const smoothedPath = generateSmoothedPath(points, false, 4);
    if (smoothedPath.length < 2) return null;

    const zOffsets = interpolateZFromDragPoints(points, smoothedPath);

    const createWirePath = (offset, zOffset = 0) => {
      const pathPoints = [];
      for (let i = 0; i < smoothedPath.length; i++) {
        const p = smoothedPath[i];
        const t = smoothedPath.length > 1 ? i / (smoothedPath.length - 1) : 0;
        const height = zOffsets[i] + heightBottom + t * (heightTop - heightBottom) + zOffset;

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

    const addWire = path => {
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
      addWire(createWirePath(-wireDistanceX / 2, wireDistanceY / 2));
    } else if (rampType === 'three_wire_right') {
      addWire(createWirePath(wireDistanceX / 2));
      addWire(createWirePath(-wireDistanceX / 2));
      addWire(createWirePath(wireDistanceX / 2, wireDistanceY / 2));
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

  const smoothedPath = generateSmoothedPath(points, false, 4);
  if (smoothedPath.length < 2) return null;

  const zOffsets = interpolateZFromDragPoints(points, smoothedPath);

  const vertices = [];
  for (let i = 0; i < smoothedPath.length; i++) {
    const p = smoothedPath[i];
    const t = smoothedPath.length > 1 ? i / (smoothedPath.length - 1) : 0;
    const width = widthBottom + t * (widthTop - widthBottom);
    const height = zOffsets[i] + heightBottom + t * (heightTop - heightBottom);

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

  const group = new THREE.Group();

  const floorGeom = new THREE.BufferGeometry();
  const floorPos = [];
  const floorUvs = [];
  const floorIdx = [];

  for (let i = 0; i < vertices.length; i++) {
    const t = vertices.length > 1 ? i / (vertices.length - 1) : 0;
    floorPos.push(vertices[i].left.x, vertices[i].left.y, vertices[i].left.z);
    floorPos.push(vertices[i].right.x, vertices[i].right.y, vertices[i].right.z);
    floorUvs.push(0, 1 - t);
    floorUvs.push(1, 1 - t);
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
    const wallIdx = [];

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i].left;
      wallPos.push(v.x, v.y, v.z);
      wallPos.push(v.x, v.y, v.z + leftWallHeight);
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
    wallGeom.setIndex(wallIdx);
    wallGeom.computeVertexNormals();
    group.add(new THREE.Mesh(wallGeom, material));
  }

  if (rightWallHeight > 0) {
    const wallGeom = new THREE.BufferGeometry();
    const wallPos = [];
    const wallIdx = [];

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i].right;
      wallPos.push(v.x, v.y, v.z);
      wallPos.push(v.x, v.y, v.z + rightWallHeight);
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
    wallGeom.setIndex(wallIdx);
    wallGeom.computeVertexNormals();
    group.add(new THREE.Mesh(wallGeom, material));
  }

  return group;
}

export function renderRamp(item, isSelected) {
  const points = item.drag_points;
  if (!points || points.length < 2) return;

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

  const smoothResult = generateSmoothedPath(points, false, 4.0, true);
  const centerline = smoothResult.vertices;
  const controlPointIndices = smoothResult.controlPointIndices;
  if (centerline.length < 2) return;

  if (isWireRamp) {
    const wireDistanceX = item.wire_distance_x ?? RAMP_DEFAULTS.wire_distance_x;
    const wireDiameter = item.wire_diameter ?? RAMP_DEFAULTS.wire_diameter;
    const isOneWire = rampTypeLower === 'one_wire';
    const isFourWire = rampTypeLower === 'four_wire';
    const isThreeWireRight = rampTypeLower === 'three_wire_right';
    const isThreeWireLeft = rampTypeLower === 'three_wire_left';

    const width = isOneWire ? wireDiameter : wireDistanceX;
    const { left, right } = generateRampShape(centerline, width, width);

    elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
    elements.ctx.lineWidth = getLineWidth(isSelected);

    elements.ctx.beginPath();
    const firstLeft = toScreen(left[0].x, left[0].y);
    elements.ctx.moveTo(firstLeft.x, firstLeft.y);
    for (let i = 1; i < left.length; i++) {
      const { x, y } = toScreen(left[i].x, left[i].y);
      elements.ctx.lineTo(x, y);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      const { x, y } = toScreen(right[i].x, right[i].y);
      elements.ctx.lineTo(x, y);
    }
    elements.ctx.closePath();
    elements.ctx.stroke();

    elements.ctx.beginPath();
    for (let i = 0; i < centerline.length; i++) {
      const { x, y } = toScreen(centerline[i].x, centerline[i].y);
      if (i === 0) elements.ctx.moveTo(x, y);
      else elements.ctx.lineTo(x, y);
    }
    elements.ctx.stroke();

    if (isFourWire || isThreeWireRight) {
      elements.ctx.strokeStyle = '#000000';
      elements.ctx.lineWidth = 3;
      elements.ctx.beginPath();
      for (let i = 0; i < left.length; i++) {
        const { x, y } = toScreen(left[i].x, left[i].y);
        if (i === 0) elements.ctx.moveTo(x, y);
        else elements.ctx.lineTo(x, y);
      }
      elements.ctx.stroke();
    }
    if (isFourWire || isThreeWireLeft) {
      elements.ctx.strokeStyle = '#000000';
      elements.ctx.lineWidth = 3;
      elements.ctx.beginPath();
      for (let i = 0; i < right.length; i++) {
        const { x, y } = toScreen(right[i].x, right[i].y);
        if (i === 0) elements.ctx.moveTo(x, y);
        else elements.ctx.lineTo(x, y);
      }
      elements.ctx.stroke();
    }
  } else {
    const { left, right } = generateRampShape(centerline, widthBottom, widthTop);

    elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
    elements.ctx.lineWidth = isSelected ? getLineWidth(isSelected) : 2;

    elements.ctx.beginPath();

    const firstLeft = toScreen(left[0].x, left[0].y);
    elements.ctx.moveTo(firstLeft.x, firstLeft.y);

    for (let i = 1; i < left.length; i++) {
      const { x, y } = toScreen(left[i].x, left[i].y);
      elements.ctx.lineTo(x, y);
    }

    for (let i = right.length - 1; i >= 0; i--) {
      const { x, y } = toScreen(right[i].x, right[i].y);
      elements.ctx.lineTo(x, y);
    }

    elements.ctx.closePath();
    if (state.viewSolid) {
      elements.ctx.fillStyle = getFillColorWithAlpha(0.6);
      elements.ctx.fill();
    }
    elements.ctx.stroke();

    elements.ctx.lineWidth = 1;
    for (const idx of controlPointIndices) {
      if (idx >= 0 && idx < left.length) {
        const l = toScreen(left[idx].x, left[idx].y);
        const r = toScreen(right[idx].x, right[idx].y);
        elements.ctx.beginPath();
        elements.ctx.moveTo(l.x, l.y);
        elements.ctx.lineTo(r.x, r.y);
        elements.ctx.stroke();
      }
    }
  }
}

export function hitTestRamp(item, worldX, worldY) {
  if (!item.drag_points || item.drag_points.length < 2) return false;
  const widthBottom = item.width_bottom ?? RAMP_DEFAULTS.width_bottom;
  const widthTop = item.width_top ?? RAMP_DEFAULTS.width_top;
  const pts = item.drag_points.map(p => {
    const v = p.vertex || p;
    return { x: v.x, y: v.y };
  });
  const centerline = generateSmoothedPath(pts, false, 4.0);
  if (centerline.length < 2) return false;
  const { left, right } = generateRampShape(centerline, widthBottom, widthTop);
  const polygon = [...left, ...right.slice().reverse()];
  return pointInPolygon(worldX, worldY, polygon);
}

export function rampProperties(item) {
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
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
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
          <input type="number" class="prop-input" data-prop="height_top" value="${(item.height_top ?? RAMP_DEFAULTS.height_top).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Height</label>
          <input type="number" class="prop-input" data-prop="height_bottom" value="${(item.height_bottom ?? RAMP_DEFAULTS.height_bottom).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Top Width</label>
          <input type="number" class="prop-input" data-prop="width_top" value="${(item.width_top ?? RAMP_DEFAULTS.width_top).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Width</label>
          <input type="number" class="prop-input" data-prop="width_bottom" value="${(item.width_bottom ?? RAMP_DEFAULTS.width_bottom).toFixed(1)}" step="5">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Visible Wall</div>
        <div class="prop-row">
          <label class="prop-label">Left Wall</label>
          <input type="number" class="prop-input" data-prop="left_wall_height_visible" value="${(item.left_wall_height_visible ?? RAMP_DEFAULTS.left_wall_height_VISIBLE).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Right Wall</label>
          <input type="number" class="prop-input" data-prop="right_wall_height_visible" value="${(item.right_wall_height_visible ?? RAMP_DEFAULTS.right_wall_height_VISIBLE).toFixed(1)}" step="5">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Wire Ramp</div>
        <div class="prop-row">
          <label class="prop-label">Diameter</label>
          <input type="number" class="prop-input" data-prop="wire_diameter" value="${(item.wire_diameter ?? RAMP_DEFAULTS.wire_diameter).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">DistanceX</label>
          <input type="number" class="prop-input" data-prop="wire_distance_x" value="${(item.wire_distance_x ?? RAMP_DEFAULTS.wire_distance_x).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">DistanceY</label>
          <input type="number" class="prop-input" data-prop="wire_distance_y" value="${(item.wire_distance_y ?? RAMP_DEFAULTS.wire_distance_y).toFixed(1)}" step="5">
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
          <input type="number" class="prop-input" data-prop="left_wall_height" value="${(item.left_wall_height ?? RAMP_DEFAULTS.left_wall_height).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Right Wall</label>
          <input type="number" class="prop-input" data-prop="right_wall_height" value="${(item.right_wall_height ?? RAMP_DEFAULTS.right_wall_height).toFixed(1)}" step="5">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? RAMP_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
