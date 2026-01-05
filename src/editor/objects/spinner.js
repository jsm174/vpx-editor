import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, getStrokeStyle, getLineWidth } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { materialOptions, imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { SPINNER_DEFAULTS } from '../../shared/object-defaults.js';
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

import spinnerPlateMesh from '../meshes/spinnerPlate.json';
import spinnerBracketMesh from '../meshes/spinnerBracket.json';

const SPINNER_LINE_WIDTH_THICK = 3;
const SPINNER_LINE_WIDTH_THIN = 1;

export function createSpinner3DMesh(item) {
  const center = item.center;
  if (!center) return null;

  const length = item.length ?? SPINNER_DEFAULTS.length;
  const height = item.height ?? SPINNER_DEFAULTS.height;
  const rotation = ((item.rotation ?? SPINNER_DEFAULTS.rotation) * Math.PI) / 180;

  const group = new THREE.Group();

  if (item.show_bracket !== false) {
    const bracketGeom = createMeshGeometry(spinnerBracketMesh, { scale: length, rotation, offsetZ: height });
    const bracketMat = createMaterial(item.material, item.image);
    group.add(new THREE.Mesh(bracketGeom, bracketMat));
  }

  const plateGeom = createMeshGeometry(spinnerPlateMesh, { scale: length, rotation, offsetZ: height });
  const plateMat = createMaterial(item.material, item.image);
  group.add(new THREE.Mesh(plateGeom, plateMat));

  group.position.set(center.x, center.y, 0.5);
  return group;
}

function getSpinnerGeometry(item, scale) {
  const length = item.length ?? SPINNER_DEFAULTS.length;
  const rotation = item.rotation ?? SPINNER_DEFAULTS.rotation;
  const halfLen = length * 0.5 * scale;
  const rad = (-rotation * Math.PI) / 180;
  return { halfLen, rad };
}

function drawSpinner(ctx, item, cx, cy, scale, strokeStyle) {
  const { halfLen, rad } = getSpinnerGeometry(item, scale);
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = SPINNER_LINE_WIDTH_THICK;
  ctx.beginPath();
  ctx.moveTo(cx + cs * halfLen, cy + sn * halfLen);
  ctx.lineTo(cx - cs * halfLen, cy - sn * halfLen);
  ctx.stroke();

  ctx.lineWidth = SPINNER_LINE_WIDTH_THIN;
  ctx.beginPath();
  ctx.moveTo(cx + cs * halfLen, cy + sn * halfLen);
  ctx.lineTo(cx - cs * halfLen, cy - sn * halfLen);
  ctx.stroke();
}

export function uiRenderPass1(item, isSelected) {}

export function uiRenderPass2(item, isSelected) {
  const { center } = item;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  drawSpinner(elements.ctx, item, cx, cy, state.zoom, getStrokeStyle(item, isSelected));
}

export function renderBlueprint(ctx, item, scale, solid) {
  const { center } = item;
  if (!center) return;

  drawSpinner(ctx, item, center.x * scale, center.y * scale, scale, RENDER_COLOR_BLACK);
}

export function render(item, isSelected) {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function renderSpinner(item, isSelected) {
  render(item, isSelected);
}

export function spinnerProperties(item) {
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
        ${checkbox('Visible', 'is_visible', item.is_visible !== false)}
        ${select('Image', 'image', imageOptions(item.image))}
        ${select('Material', 'material', materialOptions(item.material))}
        ${checkbox('Show Bracket', 'show_bracket', item.show_bracket !== false)}
        ${checkbox('Reflection Enabled', 'is_reflection_enabled', item.is_reflection_enabled !== false)}
      `)}
      ${propGroup(
        `
        ${numberInput('X', 'center.x', item.center?.x ?? 0, 1)}
        ${numberInput('Y', 'center.y', item.center?.y ?? 0, 1)}
        ${numberInput('Length', 'length', item.length ?? SPINNER_DEFAULTS.length, 5)}
        ${numberInput('Height', 'height', item.height ?? SPINNER_DEFAULTS.height, 5)}
        ${numberInput('Rotation', 'rotation', item.rotation ?? SPINNER_DEFAULTS.rotation, 5)}
        ${numberInput('Angle Max', 'angle_max', item.angle_max ?? SPINNER_DEFAULTS.angle_max, 5)}
        ${numberInput('Angle Min', 'angle_min', item.angle_min ?? SPINNER_DEFAULTS.angle_min, 5)}
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
        ${numberInput('Elasticity', 'elasticity', item.elasticity ?? SPINNER_DEFAULTS.elasticity, 0.05)}
        ${numberInput('Damping', 'damping', item.damping ?? SPINNER_DEFAULTS.damping, 0.005)}
      `)}
    `
    )}

    ${timerTab(item, SPINNER_DEFAULTS.timer_interval)}
  `;
}
