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
import { RENDER_COLOR_BLACK } from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';

import gateBracketMesh from '../meshes/gateBracket.json';
import gateWireMesh from '../meshes/gateWire.json';
import gateWireRectangleMesh from '../meshes/gateWireRectangle.json';
import gatePlateMesh from '../meshes/gatePlate.json';
import gateLongPlateMesh from '../meshes/gateLongPlate.json';

interface GateItem {
  center?: { x: number; y: number };
  length?: number;
  height?: number;
  rotation?: number;
  gate_type?: string;
  show_bracket?: boolean;
  material?: string;
  is_visible?: boolean;
  is_reflection_enabled?: boolean;
  angle_max?: number;
  angle_min?: number;
  surface?: string;
  elasticity?: number;
  friction?: number;
  damping?: number;
  gravity_factor?: number;
  is_collidable?: boolean;
  two_way?: boolean;
  is_timer_enabled?: boolean;
  timer_interval?: number;
  is_locked?: boolean;
}

interface GateGeometry {
  halfLen: number;
  rad: number;
  len1: number;
  len2: number;
}

export function createGate3DMesh(item: GateItem): THREE.Group | null {
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

function getGateGeometry(item: GateItem, scale: number): GateGeometry {
  const halfLen = (item.length ?? GATE_DEFAULTS.length) * 0.5 * scale;
  const rad = ((item.rotation ?? GATE_DEFAULTS.rotation) * Math.PI) / 180;
  const len1 = halfLen * 0.5;
  const len2 = len1 * 0.5;
  return { halfLen, rad, len1, len2 };
}

export function uiRenderPass1(_item: GateItem, _isSelected: boolean): void {}

export function uiRenderPass2(item: GateItem, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const { center, two_way } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const { halfLen, rad, len1, len2 } = getGateGeometry(item, state.zoom);

  ctx.strokeStyle = getStrokeStyle(item, isSelected);
  ctx.lineWidth = getLineWidth(isSelected);
  ctx.beginPath();
  ctx.arc(cx, cy, halfLen, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(rad) * halfLen, cy + Math.sin(rad) * halfLen);
  ctx.lineTo(cx - Math.cos(rad) * halfLen, cy - Math.sin(rad) * halfLen);
  ctx.stroke();

  const tipX = cx + Math.sin(rad) * len1;
  const tipY = cy - Math.cos(rad) * len1;

  ctx.strokeStyle = RENDER_COLOR_BLACK;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx + Math.sin(rad + 0.6) * len2, cy - Math.cos(rad + 0.6) * len2);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx + Math.sin(rad - 0.6) * len2, cy - Math.cos(rad - 0.6) * len2);
  ctx.stroke();

  if (two_way) {
    const rad2 = rad + Math.PI;
    const tip2X = cx + Math.sin(rad2) * len1;
    const tip2Y = cy - Math.cos(rad2) * len1;

    ctx.beginPath();
    ctx.moveTo(tip2X, tip2Y);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tip2X, tip2Y);
    ctx.lineTo(cx + Math.sin(rad2 + 0.6) * len2, cy - Math.cos(rad2 + 0.6) * len2);
    ctx.moveTo(tip2X, tip2Y);
    ctx.lineTo(cx + Math.sin(rad2 - 0.6) * len2, cy - Math.cos(rad2 - 0.6) * len2);
    ctx.stroke();
  }
}

export function renderBlueprint(
  _ctx: CanvasRenderingContext2D,
  _item: GateItem,
  _scale: number,
  _solid: boolean
): void {}

export function render(item: GateItem, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

interface GateTypeOption {
  value: string;
  label: string;
}

const gateTypeOptions: GateTypeOption[] = [
  { value: 'long_plate', label: 'Long Plate' },
  { value: 'plate', label: 'Plate' },
  { value: 'wire_rectangle', label: 'Wire Rectangle' },
  { value: 'wire_w', label: 'Wire W' },
];

function gateTypeSelect(currentValue: string): string {
  return gateTypeOptions
    .map(opt => {
      const selected = opt.value === currentValue ? ' selected' : '';
      return `<option value="${opt.value}"${selected}>${opt.label}</option>`;
    })
    .join('');
}

export function gateProperties(item: GateItem): string {
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

function getCenter(item: GateItem): Point | null {
  return item.center ? { x: item.center.x, y: item.center.y } : null;
}

function putCenter(item: GateItem, center: Point): void {
  item.center = { x: center.x, y: center.y };
}

const gateRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  create3DMesh: createGate3DMesh,
  getProperties: gateProperties,
  getCenter,
  putCenter,
};
registerEditable('Gate', gateRenderer);
