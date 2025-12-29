import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { materialOptions, surfaceOptions } from '../../shared/options-generators.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { createMaterialWithTexture } from '../../shared/3d-material-helpers.js';
import { BUMPER_DEFAULTS } from '../../shared/object-defaults.js';
import {
  numberInput,
  checkbox,
  select,
  propGroup,
  propTabs,
  propTabContent,
  timerTab,
} from '../../shared/property-templates.js';
import { getMaterialColor } from '../../shared/color-utils.js';

import bumperBaseMesh from '../meshes/bumperBase.json';
import bumperCapMesh from '../meshes/bumperCap.json';
import bumperRingMesh from '../meshes/bumperRing.json';
import bumperSocketMesh from '../meshes/bumperSocket.json';

const BUMPER_POLE_RADIUS = 10.0;
const BUMPER_POLE_OFFSET = 10.0;
const BUMPER_OUTER_RADIUS_MULT = 1.5;
const BUMPER_CROSS_SIZE = 10.0;

export function createBumper3DMesh(item) {
  const center = item.center;
  if (!center) return null;

  const radius = item.radius ?? BUMPER_DEFAULTS.radius;
  const heightScale = item.height_scale ?? BUMPER_DEFAULTS.heightScale;
  const orientation = ((item.orientation ?? BUMPER_DEFAULTS.orientation) * Math.PI) / 180;
  const baseHeight = 0;

  const group = new THREE.Group();

  if (item.is_base_visible !== false) {
    const geom = createMeshGeometry(bumperBaseMesh, {
      scaleXY: radius,
      scaleZ: heightScale,
      offsetZ: baseHeight,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.base_material, null, 'BumperBase.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  if (item.is_cap_visible !== false) {
    const geom = createMeshGeometry(bumperCapMesh, {
      scaleXY: radius * 2,
      scaleZ: heightScale,
      offsetZ: heightScale + baseHeight,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.cap_material, null, 'BumperCap.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  if (item.is_ring_visible !== false) {
    const geom = createMeshGeometry(bumperRingMesh, {
      scaleXY: radius,
      scaleZ: heightScale,
      offsetZ: baseHeight,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.ring_material, null, 'BumperRing.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  if (item.is_socket_visible !== false) {
    const geom = createMeshGeometry(bumperSocketMesh, {
      scaleXY: radius,
      scaleZ: heightScale,
      offsetZ: baseHeight + 5,
      rotation: orientation,
    });
    const mat = createMaterialWithTexture(item.socket_material, null, 'BumperSkirt.webp');
    group.add(new THREE.Mesh(geom, mat));
  }

  group.position.set(center.x, center.y, 0.5);
  return group;
}

export function renderBumper(item, isSelected) {
  const { center } = item;
  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const radius = item.radius ?? BUMPER_DEFAULTS.radius;
  const orientation = item.orientation ?? BUMPER_DEFAULTS.orientation;
  const r = radius * state.zoom;
  const outerR = r * BUMPER_OUTER_RADIUS_MULT;
  const poleR = BUMPER_POLE_RADIUS * state.zoom;
  const poleOffset = r + BUMPER_POLE_OFFSET * state.zoom;
  const rad = (-(orientation - 90) * Math.PI) / 180;

  if (state.viewSolid) {
    const defaultColor = state.editorColors?.defaultMaterial || '#ff69b4';
    const baseColor = getMaterialColor(item.base_material, defaultColor);
    const capColor = getMaterialColor(item.cap_material, defaultColor);

    elements.ctx.fillStyle = baseColor;
    elements.ctx.beginPath();
    elements.ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    elements.ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    elements.ctx.fill();

    elements.ctx.fillStyle = capColor;
    elements.ctx.beginPath();
    elements.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    elements.ctx.fill();

    elements.ctx.fillStyle = baseColor;
    elements.ctx.beginPath();
    elements.ctx.arc(cx - Math.cos(rad) * poleOffset, cy - Math.sin(rad) * poleOffset, poleR, 0, Math.PI * 2);
    elements.ctx.fill();
    elements.ctx.beginPath();
    elements.ctx.arc(cx + Math.cos(rad) * poleOffset, cy + Math.sin(rad) * poleOffset, poleR, 0, Math.PI * 2);
    elements.ctx.fill();
  }

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  elements.ctx.stroke();
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, r, 0, Math.PI * 2);
  elements.ctx.stroke();
  elements.ctx.beginPath();
  elements.ctx.arc(cx - Math.cos(rad) * poleOffset, cy - Math.sin(rad) * poleOffset, poleR, 0, Math.PI * 2);
  elements.ctx.stroke();
  elements.ctx.beginPath();
  elements.ctx.arc(cx + Math.cos(rad) * poleOffset, cy + Math.sin(rad) * poleOffset, poleR, 0, Math.PI * 2);
  elements.ctx.stroke();

  if (state.drawLightCenters) {
    const crossSize = BUMPER_CROSS_SIZE * state.zoom;
    elements.ctx.strokeStyle = '#000000';
    elements.ctx.lineWidth = 1;
    elements.ctx.beginPath();
    elements.ctx.moveTo(cx - crossSize, cy);
    elements.ctx.lineTo(cx + crossSize, cy);
    elements.ctx.moveTo(cx, cy - crossSize);
    elements.ctx.lineTo(cx, cy + crossSize);
    elements.ctx.stroke();
  }
}

export function hitTestBumper(item, worldX, worldY, center, distFromCenter) {
  const r = (item.radius ?? BUMPER_DEFAULTS.radius) * 1.5;
  return distFromCenter < r;
}

export function bumperProperties(item) {
  return `
    ${propTabs([
      { id: 'visuals', label: 'Visuals' },
      { id: 'physics', label: 'Physics' },
      { id: 'timer', label: 'Timer' },
    ])}

    ${propTabContent(
      'visuals',
      `
      ${propGroup(`
        ${select('Cap Material', 'cap_material', materialOptions(item.cap_material))}
        ${select('Base Material', 'base_material', materialOptions(item.base_material))}
        ${select('Skirt Material', 'socket_material', materialOptions(item.socket_material))}
        ${select('Ring Material', 'ring_material', materialOptions(item.ring_material))}
        ${numberInput('Radius', 'radius', item.radius ?? BUMPER_DEFAULTS.radius, 1)}
        ${numberInput('Height Scale', 'height_scale', item.height_scale ?? BUMPER_DEFAULTS.heightScale, 5)}
        ${numberInput('Orientation', 'orientation', item.orientation ?? BUMPER_DEFAULTS.orientation, 5)}
        ${numberInput('Ring Speed', 'ring_speed', item.ring_speed ?? BUMPER_DEFAULTS.ringSpeed, 0.1)}
        ${numberInput('Ring Drop Offset', 'ring_drop_offset', item.ring_drop_offset ?? BUMPER_DEFAULTS.ringDropOffset, 1)}
        ${checkbox('Reflection Enabled', 'is_reflection_enabled', item.is_reflection_enabled !== false)}
        ${checkbox('Cap Visible', 'is_cap_visible', item.is_cap_visible !== false)}
        ${checkbox('Base Visible', 'is_base_visible', item.is_base_visible !== false)}
        ${checkbox('Ring Visible', 'is_ring_visible', item.is_ring_visible !== false)}
        ${checkbox('Skirt Visible', 'is_socket_visible', item.is_socket_visible !== false)}
      `)}
      ${propGroup(
        `
        ${numberInput('X', 'center.x', item.center?.x ?? 0, 1)}
        ${numberInput('Y', 'center.y', item.center?.y ?? 0, 1)}
        ${select('Surface', 'surface', surfaceOptions(item.surface))}
      `,
        'Position'
      )}
    `,
      true
    )}

    ${propTabContent(
      'physics',
      `
      ${propGroup(`
        ${checkbox('Has Hit Event', 'hit_event', item.hit_event)}
        ${numberInput('Force', 'force', item.force ?? BUMPER_DEFAULTS.force, 0.5)}
        ${numberInput('Hit Threshold', 'threshold', item.threshold ?? BUMPER_DEFAULTS.threshold, 0.5)}
        ${numberInput('Scatter Angle', 'scatter', item.scatter ?? BUMPER_DEFAULTS.scatter, 1)}
        ${checkbox('Collidable', 'is_collidable', item.is_collidable !== false)}
      `)}
    `
    )}

    ${timerTab(item, BUMPER_DEFAULTS.timerInterval)}
  `;
}
