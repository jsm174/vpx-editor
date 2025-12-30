import * as THREE from 'three';
import { state, elements } from '../state.js';
import { toScreen, generateSmoothedPath, getStrokeStyle, getLineWidth, pointInPolygon } from '../utils.js';
import { createMaterial } from '../../shared/3d-material-helpers.js';
import { imageOptions, surfaceOptions } from '../../shared/options-generators.js';
import { createMeshGeometry } from '../../shared/mesh-utils.js';
import { LIGHT_DEFAULTS } from '../../shared/object-defaults.js';
import { blendColorsToHex, blendColorsToRgba } from '../../shared/color-utils.js';

import bulbLightMesh from '../meshes/bulbLight.json';
import bulbSocketMesh from '../meshes/bulbSocket.json';

const LIGHT_CROSS_SIZE = 10.0;

export function createLight3DMesh(item) {
  const center = item.center || item.vCenter;
  if (!center) return null;

  const color = item.color || LIGHT_DEFAULTS.color;
  const baseHeight = item.height ?? 0;

  if (item.is_bulb_light && !item.show_bulb_mesh) {
    return null;
  }

  if (!item.show_bulb_mesh) {
    const falloff = item.falloff_radius ?? item.falloff ?? LIGHT_DEFAULTS.falloff;
    const hasCustomShape = item.drag_points && item.drag_points.length >= 3;

    let geometry;
    if (hasCustomShape) {
      const vertices = generateSmoothedPath(item.drag_points, true, 8);
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

    const blendedColor = blendColorsToHex(item.color, item.color2);
    const intensity = item.intensity ?? LIGHT_DEFAULTS.intensity;
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

  const meshRadius = item.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius;

  const group = new THREE.Group();

  const socketGeom = createMeshGeometry(bulbSocketMesh, { scale: meshRadius, offsetZ: 0 });
  const socketMat = createMaterial(item.socket_material, null, 0x333333);
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

export function renderLight(item, isSelected) {
  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);
  const falloff = (item.falloff_radius ?? item.falloff ?? LIGHT_DEFAULTS.falloff) * state.zoom;
  const isCustomShape = item.drag_points && item.drag_points.length >= 3;
  const fillColor = blendColorsToRgba(item.color, item.color2, 0.3);

  elements.ctx.strokeStyle = '#ff0000';
  elements.ctx.lineWidth = 1;
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, falloff, 0, Math.PI * 2);
  if (state.viewSolid) {
    elements.ctx.fillStyle = fillColor;
    elements.ctx.fill();
  }
  elements.ctx.stroke();

  if (isCustomShape) {
    const vertices = generateSmoothedPath(item.drag_points, true, 8);
    if (vertices.length >= 2) {
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
        elements.ctx.fillStyle = fillColor;
        elements.ctx.fill();
      }
      elements.ctx.stroke();
    }
  }

  if (isCustomShape || state.drawLightCenters) {
    const crossSize = LIGHT_CROSS_SIZE * state.zoom;
    elements.ctx.strokeStyle = getStrokeStyle(item, isSelected, '#000000');
    elements.ctx.lineWidth = getLineWidth(isSelected);
    elements.ctx.beginPath();
    elements.ctx.moveTo(cx - crossSize, cy);
    elements.ctx.lineTo(cx + crossSize, cy);
    elements.ctx.moveTo(cx, cy - crossSize);
    elements.ctx.lineTo(cx, cy + crossSize);
    elements.ctx.stroke();
  }

  if (item.is_bulb_light) {
    const meshRadius = (item.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius) * 0.5 * state.zoom;
    elements.ctx.strokeStyle = '#007fff';
    elements.ctx.lineWidth = 1;
    elements.ctx.beginPath();
    elements.ctx.arc(cx, cy, meshRadius, 0, Math.PI * 2);
    elements.ctx.stroke();
  }
}

export function hitTestLight(item, worldX, worldY, center, distFromCenter) {
  if (item.drag_points && item.drag_points.length >= 3) {
    const pts = item.drag_points.map(p => {
      const v = p.vertex || p;
      return { x: v.x, y: v.y };
    });
    return pointInPolygon(worldX, worldY, pts);
  }
  const falloff = item.falloff_radius ?? item.falloff ?? LIGHT_DEFAULTS.falloff;
  return distFromCenter < falloff;
}

function getLightRenderMode(item) {
  if (item.visible === false) return 'hidden';
  if (item.is_bulb_light) return 'halo';
  return 'classic';
}

export function lightProperties(item) {
  const falloff = item.falloff_radius ?? item.falloff ?? LIGHT_DEFAULTS.falloff;
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
          <input type="number" class="prop-input" data-prop="intensity" value="${(item.intensity ?? LIGHT_DEFAULTS.intensity).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Fader</label>
          <select class="prop-select" data-prop="fader">
            <option value="incandescent"${item.fader === 'incandescent' ? ' selected' : ''}>Incandescent</option>
            <option value="linear"${item.fader === 'linear' ? ' selected' : ''}>Linear</option>
            <option value="none"${!item.fader || item.fader === 'none' ? ' selected' : ''}>None</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Fade Up (ms)</label>
          <input type="number" class="prop-input" data-prop="fade_speed_up" value="${(item.fade_speed_up ?? LIGHT_DEFAULTS.fade_speed_up).toFixed(2)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Fade Down (ms)</label>
          <input type="number" class="prop-input" data-prop="fade_speed_down" value="${(item.fade_speed_down ?? LIGHT_DEFAULTS.fade_speed_down).toFixed(2)}" step="0.05">
        </div>
        <div class="prop-row">
          <label class="prop-label">Light Color</label>
          <input type="color" class="prop-input" data-prop="color" value="${item.color || LIGHT_DEFAULTS.color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Center Burst</label>
          <input type="color" class="prop-input" data-prop="color2" value="${item.color2 || LIGHT_DEFAULTS.color}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Falloff Range</label>
          <input type="number" class="prop-input" data-prop="falloff_radius" value="${falloff.toFixed(2)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Falloff Power</label>
          <input type="number" class="prop-input" data-prop="falloff_power" value="${(item.falloff_power ?? LIGHT_DEFAULTS.falloff_power).toFixed(2)}" step="0.1">
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
          <input type="checkbox" class="prop-input" data-prop="is_reflection_enabled" ${item.is_reflection_enabled !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row render-mode-field classic-halo"${isHidden ? ' style="display:none"' : ''}>
          <label class="prop-label">Depth Bias</label>
          <input type="number" class="prop-input" data-prop="depth_bias" value="${(item.depth_bias ?? LIGHT_DEFAULTS.depth_bias).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row render-mode-field halo-only"${!isHalo ? ' style="display:none"' : ''}>
          <label class="prop-label">Halo Height</label>
          <input type="number" class="prop-input" data-prop="bulb_halo_height" value="${(item.bulb_halo_height ?? LIGHT_DEFAULTS.bulb_halo_height).toFixed(1)}" step="1">
        </div>
        <div class="prop-row render-mode-field halo-only"${!isHalo ? ' style="display:none"' : ''}>
          <label class="prop-label">Modulate (0..1)</label>
          <input type="number" class="prop-input" data-prop="bulb_modulate_vs_add" value="${(item.bulb_modulate_vs_add ?? LIGHT_DEFAULTS.bulb_modulate_vs_add).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
        <div class="prop-row render-mode-field halo-only"${!isHalo ? ' style="display:none"' : ''}>
          <label class="prop-label">Transmit (0..1)</label>
          <input type="number" class="prop-input" data-prop="transmission_scale" value="${(item.transmission_scale ?? LIGHT_DEFAULTS.transmission_scale).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
        <div class="prop-row render-mode-field classic-only"${!isClassic ? ' style="display:none"' : ''}>
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(item.image)}</select>
        </div>
        <div class="prop-row render-mode-field classic-only"${!isClassic ? ' style="display:none"' : ''}>
          <label class="prop-label">PassThrough</label>
          <input type="checkbox" class="prop-input" data-prop="image_mode" ${item.image_mode ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Bulb</div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="show_bulb_mesh" ${item.show_bulb_mesh ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Static Mesh</label>
          <input type="checkbox" class="prop-input" data-prop="static_bulb_mesh" ${item.static_bulb_mesh ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Bulb Size</label>
          <input type="number" class="prop-input" data-prop="mesh_radius" value="${(item.mesh_radius ?? LIGHT_DEFAULTS.mesh_radius).toFixed(1)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Ball Reflections & Shadows</div>
        <div class="prop-row">
          <label class="prop-label">Show Reflection on Balls</label>
          <input type="checkbox" class="prop-input" data-prop="show_reflection_on_ball" ${item.show_reflection_on_ball !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Raytraced Ball Shadows</label>
          <input type="checkbox" class="prop-input" data-prop="shadows" ${item.shadows ? 'checked' : ''}>
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
          <label class="prop-label">Z</label>
          <input type="number" class="prop-input" data-prop="height" value="${(item.height ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Surface</label>
          <select class="prop-select" data-prop="surface">${surfaceOptions(item.surface)}</select>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="states">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">State</label>
          <select class="prop-select" data-prop="state" data-type="float">
            <option value="0"${(item.state ?? 0) === 0 ? ' selected' : ''}>Off</option>
            <option value="1"${(item.state ?? 0) === 1 ? ' selected' : ''}>On</option>
            <option value="2"${(item.state ?? 0) === 2 ? ' selected' : ''}>Blinking</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Blink Pattern</label>
          <input type="text" class="prop-input" data-prop="blink_pattern" value="${item.blink_pattern || LIGHT_DEFAULTS.blink_pattern}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Blink Interval</label>
          <input type="number" class="prop-input" data-prop="blink_interval" value="${item.blink_interval ?? LIGHT_DEFAULTS.blink_interval}" step="25">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? LIGHT_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
