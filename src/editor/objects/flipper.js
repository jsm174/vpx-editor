import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth, distToSegment } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { FLIPPER_DEFAULTS } from '../../shared/object-defaults.js';

import flipperBaseMesh from '../meshes/flipperBase.json';

function createFlipperGeometry(meshData, baseRadius, endRadius, flipperRadius, zScale, zOffset) {
  const positions = new Float32Array(meshData.positions.length);
  const normals = new Float32Array(meshData.normals.length);

  const meshEndY = 0.887744;
  const meshBaseRadius = 0.100762;

  for (let i = 0; i < meshData.positions.length; i += 3) {
    let x = meshData.positions[i];
    let y = meshData.positions[i + 1];
    let z = meshData.positions[i + 2];

    const isEnd = y > 0.5;
    if (isEnd) {
      const radiusScale = endRadius / meshBaseRadius;
      x *= radiusScale;
      const localY = (y - meshEndY) * radiusScale;
      y = flipperRadius + localY;
    } else {
      const radiusScale = baseRadius / meshBaseRadius;
      x *= radiusScale;
      y *= radiusScale;
    }

    x = -x;
    y = -y;

    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z * zScale + zOffset;

    normals[i] = -meshData.normals[i];
    normals[i + 1] = -meshData.normals[i + 1];
    normals[i + 2] = meshData.normals[i + 2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  if (meshData.uvs && meshData.uvs.length > 0) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(meshData.uvs), 2));
  }

  if (meshData.indices && meshData.indices.length > 0) {
    geometry.setIndex(meshData.indices);
  }

  return geometry;
}

export function createFlipper3DMesh(item) {
  const center = item.center;
  if (!center) return null;

  const baseRadius = item.base_radius ?? FLIPPER_DEFAULTS.baseRadius;
  const endRadius = item.end_radius ?? FLIPPER_DEFAULTS.endRadius;
  const flipperRadius = item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipperRadiusMax;
  const height = item.height ?? FLIPPER_DEFAULTS.height;
  const startAngle = ((item.start_angle ?? FLIPPER_DEFAULTS.startAngle) * Math.PI) / 180;

  const rubberThickness = item.rubber_thickness ?? FLIPPER_DEFAULTS.rubberThickness;
  const rubberHeight = item.rubber_height ?? FLIPPER_DEFAULTS.rubberHeight;
  const rubberWidth = item.rubber_width ?? FLIPPER_DEFAULTS.rubberWidth;

  const group = new THREE.Group();

  const baseMat = createMaterial(item.material, item.image);

  const bodyBaseRadius = baseRadius - rubberThickness;
  const bodyEndRadius = endRadius - rubberThickness;
  const bodyGeom = createFlipperGeometry(flipperBaseMesh, bodyBaseRadius, bodyEndRadius, flipperRadius, height, 0);
  const bodyMesh = new THREE.Mesh(bodyGeom, baseMat);
  group.add(bodyMesh);

  if (rubberThickness > 0) {
    const rubberMat = createMaterial(item.rubber_material, null);
    const rubberGeom = createFlipperGeometry(
      flipperBaseMesh,
      baseRadius,
      endRadius,
      flipperRadius,
      rubberWidth,
      rubberHeight
    );
    const rubberMesh = new THREE.Mesh(rubberGeom, rubberMat);
    group.add(rubberMesh);
  }

  group.rotation.z = startAngle;
  group.position.set(center.x, center.y, 0);
  return group;
}

function setFlipperVertices(basex, basey, angle, flipperRadius, baseRadius, endRadius) {
  const fa = Math.asin((baseRadius - endRadius) / flipperRadius);
  const faceNormOffset = Math.PI / 2 - fa;

  const endx = basex + flipperRadius * Math.sin(angle);
  const endy = basey - flipperRadius * Math.cos(angle);

  const faceNormx1 = Math.sin(angle - faceNormOffset);
  const faceNormy1 = -Math.cos(angle - faceNormOffset);
  const faceNormx2 = Math.sin(angle + faceNormOffset);
  const faceNormy2 = -Math.cos(angle + faceNormOffset);

  return {
    endCenter: { x: endx, y: endy },
    rgv: [
      { x: basex + baseRadius * faceNormx1, y: basey + baseRadius * faceNormy1 },
      { x: endx + endRadius * faceNormx1, y: endy + endRadius * faceNormy1 },
      { x: endx + endRadius * faceNormx2, y: endy + endRadius * faceNormy2 },
      { x: basex + baseRadius * faceNormx2, y: basey + baseRadius * faceNormy2 },
    ],
  };
}

function arcFromPoints(ctx, cx, cy, radius, x1, y1, x2, y2) {
  const startAngle = Math.atan2(y1 - cy, x1 - cx);
  const endAngle = Math.atan2(y2 - cy, x2 - cx);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, true);
  ctx.stroke();
}

export function renderFlipper(item, isSelected) {
  const { center, rubber_thickness } = item;
  const startAngleVal = item.start_angle ?? FLIPPER_DEFAULTS.startAngle;
  const endAngleVal = item.end_angle ?? FLIPPER_DEFAULTS.endAngle;
  const angleRad = (startAngleVal * Math.PI) / 180;
  const angleRad2 = (endAngleVal * Math.PI) / 180;

  const baseRadius = item.base_radius ?? FLIPPER_DEFAULTS.baseRadius;
  const endRadius = item.end_radius ?? FLIPPER_DEFAULTS.endRadius;
  const flipperRadius = item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipperRadiusMax;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const br = baseRadius * state.zoom;
  const er = endRadius * state.zoom;
  const len = flipperRadius * state.zoom;

  const verts = setFlipperVertices(cx, cy, angleRad, len, br, er);
  const { endCenter, rgv } = verts;

  if (state.viewSolid) {
    elements.ctx.fillStyle = state.editorColors?.elementFill || '#b1cfb3';
    elements.ctx.beginPath();
    elements.ctx.arc(cx, cy, br, 0, Math.PI * 2);
    elements.ctx.fill();
    elements.ctx.beginPath();
    elements.ctx.arc(endCenter.x, endCenter.y, er, 0, Math.PI * 2);
    elements.ctx.fill();

    elements.ctx.beginPath();
    elements.ctx.moveTo(rgv[0].x, rgv[0].y);
    elements.ctx.lineTo(rgv[1].x, rgv[1].y);
    elements.ctx.lineTo(rgv[2].x, rgv[2].y);
    elements.ctx.lineTo(rgv[3].x, rgv[3].y);
    elements.ctx.closePath();
    elements.ctx.fill();
  }

  const rubThick = (rubber_thickness ?? FLIPPER_DEFAULTS.rubberThickness) * state.zoom;
  const rubBr = br - rubThick;
  const rubEr = er - rubThick;

  if (rubBr > 0 && rubEr > 0) {
    const rubVerts = setFlipperVertices(cx, cy, angleRad, len, rubBr, rubEr);
    elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
    elements.ctx.lineWidth = getLineWidth(isSelected);

    elements.ctx.beginPath();
    elements.ctx.moveTo(rubVerts.rgv[0].x, rubVerts.rgv[0].y);
    elements.ctx.lineTo(rubVerts.rgv[1].x, rubVerts.rgv[1].y);
    elements.ctx.lineTo(rubVerts.rgv[2].x, rubVerts.rgv[2].y);
    elements.ctx.lineTo(rubVerts.rgv[3].x, rubVerts.rgv[3].y);
    elements.ctx.closePath();
    elements.ctx.stroke();

    elements.ctx.beginPath();
    elements.ctx.arc(cx, cy, rubBr, 0, Math.PI * 2);
    elements.ctx.stroke();
    elements.ctx.beginPath();
    elements.ctx.arc(rubVerts.endCenter.x, rubVerts.endCenter.y, rubEr, 0, Math.PI * 2);
    elements.ctx.stroke();
  }

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);

  elements.ctx.beginPath();
  elements.ctx.moveTo(rgv[0].x, rgv[0].y);
  elements.ctx.lineTo(rgv[1].x, rgv[1].y);
  elements.ctx.lineTo(rgv[2].x, rgv[2].y);
  elements.ctx.lineTo(rgv[3].x, rgv[3].y);
  elements.ctx.closePath();
  elements.ctx.stroke();

  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, br, 0, Math.PI * 2);
  elements.ctx.stroke();
  elements.ctx.beginPath();
  elements.ctx.arc(endCenter.x, endCenter.y, er, 0, Math.PI * 2);
  elements.ctx.stroke();

  elements.ctx.strokeStyle = '#808080';
  elements.ctx.lineWidth = 1;
  elements.ctx.setLineDash([4, 4]);

  const verts2 = setFlipperVertices(cx, cy, angleRad2, len, br, er);
  const { endCenter: endCenter2, rgv: rgv2 } = verts2;

  elements.ctx.beginPath();
  elements.ctx.moveTo(rgv2[0].x, rgv2[0].y);
  elements.ctx.lineTo(rgv2[1].x, rgv2[1].y);
  elements.ctx.stroke();

  elements.ctx.beginPath();
  elements.ctx.moveTo(rgv2[2].x, rgv2[2].y);
  elements.ctx.lineTo(rgv2[3].x, rgv2[3].y);
  elements.ctx.stroke();

  arcFromPoints(elements.ctx, cx, cy, br, rgv2[0].x, rgv2[0].y, rgv2[3].x, rgv2[3].y);
  arcFromPoints(elements.ctx, endCenter2.x, endCenter2.y, er, rgv2[2].x, rgv2[2].y, rgv2[1].x, rgv2[1].y);

  const sweepRadius = len + er;
  const tip1x = cx + Math.sin(angleRad) * sweepRadius;
  const tip1y = cy - Math.cos(angleRad) * sweepRadius;
  const tip2x = cx + Math.sin(angleRad2) * sweepRadius;
  const tip2y = cy - Math.cos(angleRad2) * sweepRadius;

  if (endAngleVal < startAngleVal) {
    arcFromPoints(elements.ctx, cx, cy, sweepRadius, tip1x, tip1y, tip2x, tip2y);
  } else {
    arcFromPoints(elements.ctx, cx, cy, sweepRadius, tip2x, tip2y, tip1x, tip1y);
  }

  elements.ctx.setLineDash([]);
}

export function hitTestFlipper(item, worldX, worldY, center, distFromCenter) {
  const baseRadius = item.base_radius ?? FLIPPER_DEFAULTS.baseRadius;
  const endRadius = item.end_radius ?? FLIPPER_DEFAULTS.endRadius;
  const flipperRadius = item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipperRadiusMax;
  const angle = ((item.start_angle ?? FLIPPER_DEFAULTS.startAngle) * Math.PI) / 180;

  if (distFromCenter < baseRadius) return true;

  const endX = center.x + Math.sin(angle) * flipperRadius;
  const endY = center.y - Math.cos(angle) * flipperRadius;

  const distFromEnd = Math.sqrt((worldX - endX) ** 2 + (worldY - endY) ** 2);
  if (distFromEnd < endRadius) return true;

  if (distToSegment(worldX, worldY, center.x, center.y, endX, endY) < baseRadius) return true;

  return false;
}

export function flipperProperties(item) {
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="material">${materialOptions(item.material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Material</label>
          <select class="prop-select" data-prop="rubber_material">${materialOptions(item.rubber_material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Thickness</label>
          <input type="number" class="prop-input" data-prop="rubber_thickness" value="${(item.rubber_thickness ?? FLIPPER_DEFAULTS.rubberThickness).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Offset Height</label>
          <input type="number" class="prop-input" data-prop="rubber_height" value="${(item.rubber_height ?? FLIPPER_DEFAULTS.rubberHeight).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Rubber Width</label>
          <input type="number" class="prop-input" data-prop="rubber_width" value="${(item.rubber_width ?? FLIPPER_DEFAULTS.rubberWidth).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_enabled" ${item.is_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" value="${(item.center?.x ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" value="${(item.center?.y ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Base Radius</label>
          <input type="number" class="prop-input" data-prop="base_radius" value="${(item.base_radius ?? FLIPPER_DEFAULTS.baseRadius).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">End Radius</label>
          <input type="number" class="prop-input" data-prop="end_radius" value="${(item.end_radius ?? FLIPPER_DEFAULTS.endRadius).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Length</label>
          <input type="number" class="prop-input" data-prop="flipper_radius_max" value="${(item.flipper_radius_max ?? FLIPPER_DEFAULTS.flipperRadiusMax).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Start Angle</label>
          <input type="number" class="prop-input" data-prop="start_angle" value="${(item.start_angle ?? FLIPPER_DEFAULTS.startAngle).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">End Angle</label>
          <input type="number" class="prop-input" data-prop="end_angle" value="${(item.end_angle ?? FLIPPER_DEFAULTS.endAngle).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${(item.height ?? FLIPPER_DEFAULTS.height).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Max.Difficulty Length</label>
          <input type="number" class="prop-input" data-prop="flipper_radius_min" value="${(item.flipper_radius_min ?? FLIPPER_DEFAULTS.flipperRadiusMin).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(item.surface)}</select>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Mass</label>
          <input type="number" class="prop-input" data-prop="mass" value="${(item.mass ?? FLIPPER_DEFAULTS.mass).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Strength</label>
          <input type="number" class="prop-input" data-prop="strength" value="${(item.strength ?? FLIPPER_DEFAULTS.strength).toFixed(1)}" step="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(item.elasticity ?? FLIPPER_DEFAULTS.elasticity).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${(item.elasticity_falloff ?? FLIPPER_DEFAULTS.elasticityFalloff).toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(item.friction ?? FLIPPER_DEFAULTS.friction).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Return Strength Ratio</label>
          <input type="number" class="prop-input" data-prop="return_" value="${(item.return_ ?? FLIPPER_DEFAULTS.return).toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Coil Ramp Up</label>
          <input type="number" class="prop-input" data-prop="ramp_up" value="${(item.ramp_up ?? FLIPPER_DEFAULTS.rampUp).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(item.scatter ?? FLIPPER_DEFAULTS.scatter).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">EOS Torque</label>
          <input type="number" class="prop-input" data-prop="torque_damping" value="${(item.torque_damping ?? FLIPPER_DEFAULTS.torqueDamping).toFixed(3)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">EOS Torque Angle</label>
          <input type="number" class="prop-input" data-prop="torque_damping_angle" value="${(item.torque_damping_angle ?? FLIPPER_DEFAULTS.torqueDampingAngle).toFixed(1)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Overwrite Physics</label>
          <input type="number" class="prop-input" data-prop="override_physics" value="${item.override_physics ?? 0}" step="1" min="0">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? FLIPPER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
