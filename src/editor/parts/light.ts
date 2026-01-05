import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, generateSmoothedPath, pointInPolygon } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { LIGHT_DEFAULTS } from '../../shared/object-defaults.js';
import { blendColorsToHex, blendColorsToRgba } from '../../shared/color-utils.js';
import {
  RENDER_COLOR_BLACK,
  RENDER_COLOR_RED,
  RENDER_COLOR_BLUE,
  PATH_SMOOTHING_ACCURACY,
} from '../../shared/constants.js';
import { registerEditable, IEditable, Point } from './registry.js';
import { getDragPointCoords } from '../../types/game-objects.js';

import bulbLightMesh from '../meshes/bulbLight.json';
import bulbSocketMesh from '../meshes/bulbSocket.json';

const LIGHT_CROSS_SIZE = 10.0;
const LIGHT_BULB_MESH_SCALE = 0.5;

export function createLight3DMesh(item: unknown): THREE.Object3D | null {
  const lightItem = item as {
    center?: Point;
    vCenter?: Point;
    color?: string;
    height?: number;
    is_bulb_light?: boolean;
    show_bulb_mesh?: boolean;
    falloff_radius?: number;
    falloff?: number;
    drag_points?: Array<{ x: number; y: number }>;
    color2?: string;
    intensity?: number;
    mesh_radius?: number;
    socket_material?: string;
  };

  const center = lightItem.center || lightItem.vCenter;
  if (!center) return null;

  const color = lightItem.color || LIGHT_DEFAULTS.color;
  const baseHeight = lightItem.height ?? 0;

  if (lightItem.is_bulb_light && !lightItem.show_bulb_mesh) {
    return null;
  }

  if (!lightItem.show_bulb_mesh) {
    const falloff = lightItem.falloff_radius ?? lightItem.falloff ?? LIGHT_DEFAULTS.falloff;
    const hasCustomShape = lightItem.drag_points && lightItem.drag_points.length >= 3;

    let geometry: THREE.BufferGeometry;
    if (hasCustomShape) {
      const result = generateSmoothedPath(lightItem.drag_points!, true, PATH_SMOOTHING_ACCURACY);
      const vertices = Array.isArray(result) ? result : result.vertices;
      if (vertices.length < 3) {
        geometry = new THREE.CircleGeometry(falloff, 32);
      } else {
        const shape = new THREE.Shape();
        shape.moveTo(vertices[0].x - center.x, vertices[0].y - center.y);
        for (let i = 1; i < vertices.length; i++) {
          shape.lineTo(vertices[i].x - center.x, vertices[i].y - center.y);
        }
        shape.closePath();
        geometry = new THREE.ShapeGeometry(shape);
      }
    } else {
      geometry = new THREE.CircleGeometry(falloff, 32);
    }

    const blendedColor = blendColorsToHex(lightItem.color, lightItem.color2);
    const intensity = lightItem.intensity ?? LIGHT_DEFAULTS.intensity;
    const material = new THREE.MeshStandardMaterial({
      color: blendedColor,
      emissive: blendedColor,
      emissiveIntensity: 0.3 * intensity,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(center.x, center.y, baseHeight + 0.5);
    return mesh;
  }

  const meshRadius = lightItem.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius;

  const group = new THREE.Group();

  const socketGeom = createMeshGeometry(bulbSocketMesh, { scale: meshRadius, offsetZ: 0 });
  const socketMat = createMaterial(lightItem.socket_material, null, 0x333333);
  group.add(new THREE.Mesh(socketGeom, socketMat));

  const bulbGeom = createMeshGeometry(bulbLightMesh, { scale: meshRadius, offsetZ: 0 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(bulbGeom, bulbMat));

  group.position.set(center.x, center.y, baseHeight);
  return group;
}

function renderOutline(
  ctx: CanvasRenderingContext2D,
  item: unknown,
  cx: number,
  cy: number,
  scale: number,
  toScreenFn: ((x: number, y: number) => Point) | null,
  drawCrossAlways: boolean
): void {
  const lightItem = item as {
    falloff_radius?: number;
    falloff?: number;
    drag_points?: Array<{ x: number; y: number }>;
  };

  const falloff = (lightItem.falloff_radius ?? lightItem.falloff ?? LIGHT_DEFAULTS.falloff) * scale;
  const isCustomShape = lightItem.drag_points && lightItem.drag_points.length >= 3;

  ctx.lineWidth = 1;

  if (isCustomShape) {
    ctx.strokeStyle = RENDER_COLOR_RED;
    ctx.beginPath();
    ctx.arc(cx, cy, falloff, 0, Math.PI * 2);
    ctx.stroke();

    const result = generateSmoothedPath(lightItem.drag_points!, true, PATH_SMOOTHING_ACCURACY);
    const vertices = Array.isArray(result) ? result : result.vertices;
    if (vertices.length >= 2) {
      ctx.strokeStyle = RENDER_COLOR_BLACK;
      ctx.beginPath();
      const first = toScreenFn
        ? toScreenFn(vertices[0].x, vertices[0].y)
        : { x: vertices[0].x * scale, y: vertices[0].y * scale };
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < vertices.length; i++) {
        const pt = toScreenFn
          ? toScreenFn(vertices[i].x, vertices[i].y)
          : { x: vertices[i].x * scale, y: vertices[i].y * scale };
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = RENDER_COLOR_BLACK;
    ctx.beginPath();
    ctx.arc(cx, cy, falloff, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isCustomShape || drawCrossAlways) {
    const crossSize = LIGHT_CROSS_SIZE * scale;
    ctx.strokeStyle = RENDER_COLOR_BLACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - crossSize, cy);
    ctx.lineTo(cx + crossSize, cy);
    ctx.moveTo(cx, cy - crossSize);
    ctx.lineTo(cx, cy + crossSize);
    ctx.stroke();
  }
}

export function uiRenderPass1(item: unknown, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const lightItem = item as {
    center?: Point;
    vCenter?: Point;
    drag_points?: Array<{ x: number; y: number }>;
    color?: string;
    color2?: string;
  };

  const center = lightItem.center || lightItem.vCenter;
  if (!center) return;

  if (!state.viewSolid) return;

  const isCustomShape = lightItem.drag_points && lightItem.drag_points.length >= 3;
  if (!isCustomShape) return;

  const result = generateSmoothedPath(lightItem.drag_points!, true, PATH_SMOOTHING_ACCURACY);
  const vertices = Array.isArray(result) ? result : result.vertices;
  if (vertices.length < 3) return;

  const fillColor = blendColorsToRgba(lightItem.color, lightItem.color2, 0.3);
  ctx.fillStyle = fillColor;

  ctx.beginPath();
  const first = toScreen(vertices[0].x, vertices[0].y);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < vertices.length; i++) {
    const pt = toScreen(vertices[i].x, vertices[i].y);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.fill();
}

export function uiRenderPass2(item: unknown, _isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;

  const lightItem = item as {
    center?: Point;
    vCenter?: Point;
    show_bulb_mesh?: boolean;
    mesh_radius?: number;
  };

  const center = lightItem.center || lightItem.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);

  renderOutline(ctx, item, cx, cy, state.zoom, toScreen, state.drawLightCenters);

  if (lightItem.show_bulb_mesh) {
    const meshRadius = (lightItem.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius) * LIGHT_BULB_MESH_SCALE * state.zoom;
    ctx.strokeStyle = RENDER_COLOR_BLUE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, meshRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function renderBlueprint(ctx: CanvasRenderingContext2D, item: unknown, scale: number, _solid: boolean): void {
  const lightItem = item as {
    center?: Point;
    vCenter?: Point;
    show_bulb_mesh?: boolean;
    mesh_radius?: number;
  };

  const center = lightItem.center || lightItem.vCenter;
  if (!center) return;

  const cx = center.x * scale;
  const cy = center.y * scale;

  renderOutline(ctx, item, cx, cy, scale, null, true);

  if (lightItem.show_bulb_mesh) {
    const meshRadius = (lightItem.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius) * LIGHT_BULB_MESH_SCALE * scale;
    ctx.strokeStyle = RENDER_COLOR_BLUE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, meshRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function render(item: unknown, isSelected: boolean): void {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function hitTestLight(
  item: unknown,
  worldX: number,
  worldY: number,
  _center?: Point,
  distFromCenter?: number
): boolean {
  const lightItem = item as {
    drag_points?: Array<{ vertex?: { x: number; y: number }; x?: number; y?: number }>;
    falloff_radius?: number;
    falloff?: number;
  };

  if (lightItem.drag_points && lightItem.drag_points.length >= 3) {
    const pts = lightItem.drag_points.map(p => getDragPointCoords(p));
    return pointInPolygon(worldX, worldY, pts);
  }
  const falloff = lightItem.falloff_radius ?? lightItem.falloff ?? LIGHT_DEFAULTS.falloff;
  return distFromCenter! < falloff;
}

function getLightRenderMode(item: unknown): string {
  const lightItem = item as {
    visible?: boolean;
    is_bulb_light?: boolean;
  };

  if (lightItem.visible === false) return 'hidden';
  if (lightItem.is_bulb_light) return 'halo';
  return 'classic';
}

export function lightProperties(item: unknown): string {
  const lightItem = item as {
    intensity?: number;
    fader?: string;
    fade_speed_up?: number;
    fade_speed_down?: number;
    color?: string;
    color2?: string;
    falloff_radius?: number;
    falloff?: number;
    falloff_power?: number;
    is_reflection_enabled?: boolean;
    depth_bias?: number;
    bulb_halo_height?: number;
    bulb_modulate_vs_add?: number;
    transmission_scale?: number;
    image?: string;
    image_mode?: boolean;
    show_bulb_mesh?: boolean;
    static_bulb_mesh?: boolean;
    mesh_radius?: number;
    show_reflection_on_ball?: boolean;
    shadows?: boolean;
    center?: { x?: number; y?: number };
    height?: number;
    surface?: string;
    state?: number;
    blink_pattern?: string;
    blink_interval?: number;
    is_timer_enabled?: boolean;
    timer_interval?: number;
  };

  const falloff = lightItem.falloff_radius ?? lightItem.falloff ?? LIGHT_DEFAULTS.falloff;
  const renderMode = getLightRenderMode(item);
  const isHidden = renderMode === 'hidden';
  const isClassic = renderMode === 'classic';
  const isHalo = renderMode === 'halo';
  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="states">States</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-group-title">Light Settings</div>
        <div class="prop-row">
          <label class="prop-label">Intensity</label>
          <input type="number" class="prop-input" data-prop="intensity" value="${(lightItem.intensity ?? LIGHT_DEFAULTS.intensity).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Fader</label>
          <select class="prop-select" data-prop="fader">
            <option value="incandescent"${lightItem.fader === 'incandescent' ? ' selected' : ''}>Incandescent</option>
            <option value="linear"${lightItem.fader === 'linear' ? ' selected' : ''}>Linear</option>
            <option value="none"${!lightItem.fader || lightItem.fader === 'none' ? ' selected' : ''}>None</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Fade Up (ms)</label>
          <input type="number" class="prop-input" data-prop="fade_speed_up" value="${(lightItem.fade_speed_up ?? LIGHT_DEFAULTS.fade_speed_up).toFixed(2)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Fade Down (ms)</label>
          <input type="number" class="prop-input" data-prop="fade_speed_down" value="${(lightItem.fade_speed_down ?? LIGHT_DEFAULTS.fade_speed_down).toFixed(2)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Light Color</label>
          <input type="color" class="prop-input" data-prop="color" value="${lightItem.color || LIGHT_DEFAULTS.color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Center Burst</label>
          <input type="color" class="prop-input" data-prop="color2" value="${lightItem.color2 || LIGHT_DEFAULTS.color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Falloff Range</label>
          <input type="number" class="prop-input" data-prop="falloff_radius" value="${falloff.toFixed(2)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Falloff Power</label>
          <input type="number" class="prop-input" data-prop="falloff_power" value="${(lightItem.falloff_power ?? LIGHT_DEFAULTS.falloff_power).toFixed(2)}" step="0.1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Render Mode</div>
        <div class="prop-row">
          <label class="prop-label">Type</label>
          <select class="prop-select" data-prop="render_mode" id="light-render-mode">
            <option value="hidden"${isHidden ? ' selected' : ''}>Hidden</option>
            <option value="classic"${isClassic ? ' selected' : ''}>Classic</option>
            <option value="halo"${isHalo ? ' selected' : ''}>Halo</option>
          </select>
        </div>
        <div class="prop-row render-mode-field classic-halo"${isHidden ? ' style="display:none"' : ''}>
          <label class="prop-label">Reflection Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${lightItem.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row render-mode-field classic-halo"${isHidden ? ' style="display:none"' : ''}>
          <label class="prop-label">Depth Bias</label>
          <input type="number" class="prop-input" data-prop="depth_bias" value="${(lightItem.depth_bias ?? LIGHT_DEFAULTS.depth_bias).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row render-mode-field halo-only"${!isHalo ? ' style="display:none"' : ''}>
          <label class="prop-label">Halo Height</label>
          <input type="number" class="prop-input" data-prop="bulb_halo_height" value="${(lightItem.bulb_halo_height ?? LIGHT_DEFAULTS.bulb_halo_height).toFixed(1)}" step="1">
        </div>
        <div class="prop-row render-mode-field halo-only"${!isHalo ? ' style="display:none"' : ''}>
          <label class="prop-label">Modulate (0..1)</label>
          <input type="number" class="prop-input" data-prop="bulb_modulate_vs_add" value="${(lightItem.bulb_modulate_vs_add ?? LIGHT_DEFAULTS.bulb_modulate_vs_add).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
        <div class="prop-row render-mode-field halo-only"${!isHalo ? ' style="display:none"' : ''}>
          <label class="prop-label">Transmit (0..1)</label>
          <input type="number" class="prop-input" data-prop="transmission_scale" value="${(lightItem.transmission_scale ?? LIGHT_DEFAULTS.transmission_scale).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
        <div class="prop-row render-mode-field classic-only"${!isClassic ? ' style="display:none"' : ''}>
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(lightItem.image)}</select>
        </div>
        <div class="prop-row render-mode-field classic-only"${!isClassic ? ' style="display:none"' : ''}>
          <label class="prop-label">PassThrough</label>
          <input type="checkbox" class="prop-input" data-prop="image_mode" ${lightItem.image_mode ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Bulb</div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="show_bulb_mesh" ${lightItem.show_bulb_mesh ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Static Mesh</label>
          <input type="checkbox" class="prop-input" data-prop="static_bulb_mesh" ${lightItem.static_bulb_mesh ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Bulb Size</label>
          <input type="number" class="prop-input" data-prop="mesh_radius" value="${(lightItem.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius).toFixed(1)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Ball Reflections & Shadows</div>
        <div class="prop-row">
          <label class="prop-label">Show Reflection on Balls</label>
          <input type="checkbox" class="prop-input" data-prop="show_reflection_on_ball" ${lightItem.show_reflection_on_ball !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Raytraced Ball Shadows</label>
          <input type="checkbox" class="prop-input" data-prop="shadows" ${lightItem.shadows ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" value="${(lightItem.center?.x ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" value="${(lightItem.center?.y ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z</label>
          <input type="number" class="prop-input" data-prop="height" value="${(lightItem.height ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(lightItem.surface)}</select>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="states">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">State</label>
          <select class="prop-select" data-prop="state" data-type="float">
            <option value="0"${(lightItem.state ?? 0) === 0 ? ' selected' : ''}>Off</option>
            <option value="1"${(lightItem.state ?? 0) === 1 ? ' selected' : ''}>On</option>
            <option value="2"${(lightItem.state ?? 0) === 2 ? ' selected' : ''}>Blinking</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Blink Pattern</label>
          <input type="text" class="prop-input" data-prop="blink_pattern" value="${lightItem.blink_pattern || LIGHT_DEFAULTS.blink_pattern}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Blink Interval</label>
          <input type="number" class="prop-input" data-prop="blink_interval" value="${lightItem.blink_interval ?? LIGHT_DEFAULTS.blink_interval}" step="25">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="timer">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="is_timer_enabled" ${lightItem.is_timer_enabled ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Interval (ms)</label>
          <input type="number" class="prop-input" data-prop="timer_interval" value="${lightItem.timer_interval ?? LIGHT_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}

function getCenter(item: unknown): Point | null {
  const lightItem = item as { center?: Point; vCenter?: Point };
  const center = lightItem.center || lightItem.vCenter;
  return center ? { x: center.x, y: center.y } : null;
}

function putCenter(item: unknown, center: Point): void {
  const lightItem = item as { center?: Point };
  lightItem.center = { x: center.x, y: center.y };
}

const lightRenderer: IEditable = {
  render,
  uiRenderPass1,
  uiRenderPass2,
  renderBlueprint,
  hitTest: hitTestLight,
  create3DMesh: createLight3DMesh,
  getProperties: lightProperties,
  getCenter,
  putCenter,
};
registerEditable('Light', lightRenderer);
