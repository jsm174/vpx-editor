import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { materialOptions, surfaceOptions } from '../../shared/options-generators.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { GATE_DEFAULTS } from '../../shared/object-defaults.js';
import {
  numberInput,
  checkbox,
  select,
  propGroup,
  propTabs,
  propTabContent,
  timerTab,
} from '../../shared/property-templates.js';

import gateBracketMesh from '../meshes/gateBracket.json';
import gateWireMesh from '../meshes/gateWire.json';
import gateWireRectangleMesh from '../meshes/gateWireRectangle.json';
import gatePlateMesh from '../meshes/gatePlate.json';
import gateLongPlateMesh from '../meshes/gateLongPlate.json';

export function createGate3DMesh(item) {
  const center = item.center;
  if (!center) return null;

  const length = item.length ?? GATE_DEFAULTS.length;
  const height = item.height ?? GATE_DEFAULTS.height;
  const rotation = ((item.rotation ?? GATE_DEFAULTS.rotation) * Math.PI) / 180;
  const gateType = (item.gate_type || 'wire_w').toLowerCase();

  let wireMeshData;
  switch (gateType) {
    case 'wire_rectangle':
      wireMeshData = gateWireRectangleMesh;
      break;
    case 'plate':
      wireMeshData = gatePlateMesh;
      break;
    case 'long_plate':
      wireMeshData = gateLongPlateMesh;
      break;
    case 'wire_w':
    default:
      wireMeshData = gateWireMesh;
      break;
  }

  const group = new THREE.Group();

  if (item.show_bracket !== false) {
    const bracketGeom = createMeshGeometry(gateBracketMesh, {
      scaleXY: length,
      scaleZ: length,
      rotation,
      offsetZ: height,
    });
    const bracketMat = createMaterial(item.material, null);
    group.add(new THREE.Mesh(bracketGeom, bracketMat));
  }

  const wireGeom = createMeshGeometry(wireMeshData, { scaleXY: length, scaleZ: length, rotation, offsetZ: height });
  const wireMat = createMaterial(item.material, null);
  group.add(new THREE.Mesh(wireGeom, wireMat));

  group.position.set(center.x, center.y, 0.5);
  return group;
}

export function renderGate(item, isSelected) {
  const { center, length, rotation, two_way } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const halfLen = (item.length ?? GATE_DEFAULTS.length) * 0.5 * state.zoom;
  const rad = ((item.rotation ?? GATE_DEFAULTS.rotation) * Math.PI) / 180;

  elements.ctx.strokeStyle = getStrokeStyle(item, isSelected);
  elements.ctx.lineWidth = getLineWidth(isSelected);
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, halfLen, 0, Math.PI * 2);
  elements.ctx.stroke();

  elements.ctx.lineWidth = 2;
  elements.ctx.beginPath();
  elements.ctx.moveTo(cx + Math.cos(rad) * halfLen, cy + Math.sin(rad) * halfLen);
  elements.ctx.lineTo(cx - Math.cos(rad) * halfLen, cy - Math.sin(rad) * halfLen);
  elements.ctx.stroke();

  const len1 = halfLen * 0.5;
  const len2 = len1 * 0.5;

  const tipX = cx + Math.sin(rad) * len1;
  const tipY = cy - Math.cos(rad) * len1;

  elements.ctx.strokeStyle = '#000000';
  elements.ctx.lineWidth = 1;

  elements.ctx.beginPath();
  elements.ctx.moveTo(tipX, tipY);
  elements.ctx.lineTo(cx, cy);
  elements.ctx.stroke();

  elements.ctx.beginPath();
  elements.ctx.moveTo(tipX, tipY);
  elements.ctx.lineTo(cx + Math.sin(rad + 0.6) * len2, cy - Math.cos(rad + 0.6) * len2);
  elements.ctx.moveTo(tipX, tipY);
  elements.ctx.lineTo(cx + Math.sin(rad - 0.6) * len2, cy - Math.cos(rad - 0.6) * len2);
  elements.ctx.stroke();

  if (two_way) {
    const rad2 = rad + Math.PI;
    const tip2X = cx + Math.sin(rad2) * len1;
    const tip2Y = cy - Math.cos(rad2) * len1;

    elements.ctx.beginPath();
    elements.ctx.moveTo(tip2X, tip2Y);
    elements.ctx.lineTo(cx, cy);
    elements.ctx.stroke();

    elements.ctx.beginPath();
    elements.ctx.moveTo(tip2X, tip2Y);
    elements.ctx.lineTo(cx + Math.sin(rad2 + 0.6) * len2, cy - Math.cos(rad2 + 0.6) * len2);
    elements.ctx.moveTo(tip2X, tip2Y);
    elements.ctx.lineTo(cx + Math.sin(rad2 - 0.6) * len2, cy - Math.cos(rad2 - 0.6) * len2);
    elements.ctx.stroke();
  }
}

const gateTypeOptions = [
  { value: 'long_plate', label: 'Long Plate' },
  { value: 'plate', label: 'Plate' },
  { value: 'wire_rectangle', label: 'Wire Rectangle' },
  { value: 'wire_w', label: 'Wire W' },
];

function gateTypeSelect(currentValue) {
  return gateTypeOptions
    .map(opt => {
      const selected = opt.value === currentValue ? ' selected' : '';
      return `<option value="${opt.value}"${selected}>${opt.label}</option>`;
    })
    .join('');
}

export function gateProperties(item) {
  const openAngleDeg = (((item.angle_max ?? 0) * 180) / Math.PI).toFixed(1);
  const closeAngleDeg = (((item.angle_min ?? 0) * 180) / Math.PI).toFixed(1);

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
        ${select('Type', 'gate_type', gateTypeSelect(item.gate_type || 'wire_w'))}
        ${checkbox('Visible', 'is_visible', item.is_visible !== false)}
        ${checkbox('Show Bracket', 'show_bracket', item.show_bracket !== false)}
        ${checkbox('Reflection Enabled', 'is_reflection_enabled', item.is_reflection_enabled !== false)}
        ${select('Material', 'material', materialOptions(item.material))}
      `)}
      ${propGroup(
        `
        ${numberInput('X', 'center.x', item.center?.x ?? 0, 1)}
        ${numberInput('Y', 'center.y', item.center?.y ?? 0, 1)}
        ${numberInput('Length', 'length', item.length ?? GATE_DEFAULTS.length, 5)}
        ${numberInput('Height', 'height', item.height ?? GATE_DEFAULTS.height, 5)}
        ${numberInput('Rotation', 'rotation', item.rotation ?? GATE_DEFAULTS.rotation, 5)}
        ${numberInput('Open Angle', 'angle_max', openAngleDeg, 5)}
        ${numberInput('Close Angle', 'angle_min', closeAngleDeg, 5)}
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
        ${numberInput('Elasticity', 'elasticity', item.elasticity ?? GATE_DEFAULTS.elasticity, 0.05)}
        ${numberInput('Friction', 'friction', item.friction ?? GATE_DEFAULTS.friction, 0.05)}
        ${numberInput('Damping', 'damping', item.damping ?? GATE_DEFAULTS.damping, 0.005)}
        ${numberInput('Gravity Factor', 'gravity_factor', item.gravity_factor ?? GATE_DEFAULTS.gravity_factor, 0.05)}
      `)}
      ${propGroup(`
        ${checkbox('Collidable', 'is_collidable', item.is_collidable !== false)}
        ${checkbox('Two Way', 'two_way', item.two_way)}
      `)}
    `
    )}

    ${timerTab(item, GATE_DEFAULTS.timer_interval)}
  `;
}
