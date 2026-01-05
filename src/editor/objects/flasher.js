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
import { loadTexture } from '../texture-loader.js';
import { imageOptions } from '../../shared/options-generators.js';
import { FLASHER_DEFAULTS } from '../../shared/object-defaults.js';
import { PATH_SMOOTHING_ACCURACY } from '../../shared/constants.js';

export function createFlasher3DMesh(item) {
  if (item.is_visible === false) return null;

  const points = item.drag_points;
  if (!points || points.length < 3) return null;

  const vertices = generateSmoothedPath(points, true, PATH_SMOOTHING_ACCURACY);
  if (vertices.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) {
    shape.lineTo(vertices[i].x, vertices[i].y);
  }
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;

  const uvAttr = geometry.getAttribute('position');
  const uvs = new Float32Array(uvAttr.count * 2);
  for (let i = 0; i < uvAttr.count; i++) {
    const x = uvAttr.getX(i);
    const y = uvAttr.getY(i);
    uvs[i * 2] = width > 0 ? (x - minX) / width : 0;
    uvs[i * 2 + 1] = height > 0 ? (y - minY) / height : 0;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  let color = FLASHER_DEFAULTS.color;
  if (item.color) {
    if (typeof item.color === 'string' && item.color.startsWith('#')) {
      color = parseInt(item.color.slice(1), 16);
    } else if (typeof item.color === 'number') {
      color = item.color;
    }
  }

  const imageName = item.image_a || item.image_b;

  const material = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });

  if (state.showMaterials && imageName) {
    loadTexture(imageName).then(texture => {
      if (texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = item.height ?? FLASHER_DEFAULTS.height;

  if (item.rot_x) mesh.rotation.x = THREE.MathUtils.degToRad(item.rot_x);
  if (item.rot_y) mesh.rotation.y = THREE.MathUtils.degToRad(item.rot_y);
  if (item.rot_z) mesh.rotation.z = THREE.MathUtils.degToRad(item.rot_z);

  return mesh;
}

function getFlasherVertices(item) {
  let points = item.drag_points;

  if (!points || points.length < 3) {
    const cx = item.pos_x ?? 0;
    const cy = item.pos_y ?? 0;
    const halfSize = FLASHER_DEFAULTS.size * 0.5;
    points = [
      { x: cx - halfSize, y: cy - halfSize },
      { x: cx - halfSize, y: cy + halfSize },
      { x: cx + halfSize, y: cy + halfSize },
      { x: cx + halfSize, y: cy - halfSize },
    ];
  }

  return generateSmoothedPath(points, true, PATH_SMOOTHING_ACCURACY);
}

export function uiRenderPass1(item, isSelected) {
  if (!state.viewSolid) return;

  const vertices = getFlasherVertices(item);
  if (vertices.length < 2) return;

  drawPolygon(elements.ctx, vertices, toScreen, getFillColorWithAlpha(0.3), null, 0);
}

export function uiRenderPass2(item, isSelected) {
  const vertices = getFlasherVertices(item);
  if (vertices.length < 2) return;

  drawPolygon(elements.ctx, vertices, toScreen, null, getStrokeStyle(item, isSelected), getLineWidth(isSelected));
}

export function renderBlueprint(ctx, item, scale, solid) {}

export function render(item, isSelected) {
  uiRenderPass1(item, isSelected);
  uiRenderPass2(item, isSelected);
}

export function renderFlasher(item, isSelected) {
  render(item, isSelected);
}

export function hitTestFlasher(item, worldX, worldY) {
  if (!item.drag_points || item.drag_points.length < 3) return false;
  const pts = item.drag_points.map(p => {
    const v = p.vertex || p;
    return { x: v.x, y: v.y };
  });
  return pointInPolygon(worldX, worldY, pts);
}

function getStyleOptions(mode, selectedStyle) {
  const styles = {
    dmd: ['Legacy VPX', 'Neon Plasma', 'Red LED', 'Green LED', 'Yellow LED', 'Generic Plasma', 'Generic LED'],
    display: ['Pixelated', 'Smoothed', 'CRT'],
    alpha_seg: (() => {
      const families = ['Generic', 'Gottlieb', 'Williams', 'Bally', 'Atari'];
      const types = [
        'Neon Plasma',
        'Blue VFD',
        'Green VFD',
        'Red LED',
        'Green LED',
        'Yellow LED',
        'Generic Plasma',
        'Generic LED',
      ];
      const opts = [];
      for (const family of families) {
        for (const type of types) {
          opts.push(`${family}: ${type}`);
        }
      }
      return opts;
    })(),
  };
  const opts = styles[mode] || [];
  return opts
    .map((label, i) => `<option value="${i}"${(selectedStyle ?? 0) === i ? ' selected' : ''}>${label}</option>`)
    .join('');
}

export function flasherProperties(item) {
  const mode = item.render_mode || 'flasher';
  const isFlasher = mode === 'flasher';
  const isAlphaSeg = mode === 'alpha_seg';
  const isDisplay = !isFlasher;
  const groupTitle = isFlasher
    ? 'Images'
    : mode === 'dmd'
      ? 'DMD Style'
      : mode === 'display'
        ? 'Display Style'
        : 'Alpha Seg. Style';
  const opacityLabel = isFlasher ? 'Opacity' : 'Brightness';

  return `
    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="timer">Timer</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Mode</label>
          <select class="prop-select" data-prop="render_mode" data-flasher-mode>
            <option value="flasher"${mode === 'flasher' ? ' selected' : ''}>Flasher</option>
            <option value="dmd"${mode === 'dmd' ? ' selected' : ''}>DMD</option>
            <option value="display"${mode === 'display' ? ' selected' : ''}>Display</option>
            <option value="alpha_seg"${mode === 'alpha_seg' ? ' selected' : ''}>Alpha.Seg.</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input" data-prop="color" value="${item.color || '#ffffff'}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Depth Bias</label>
          <input type="number" class="prop-input" data-prop="depth_bias" value="${(item.depth_bias ?? FLASHER_DEFAULTS.depth_bias).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" class="prop-input" data-prop="is_visible" ${item.is_visible !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">${groupTitle}</div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Render Style</label>
          <select class="prop-select" data-prop="render_style" data-type="int">${getStyleOptions(mode, item.render_style)}</select>
        </div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Source</label>
          <input type="text" class="prop-input" data-prop="image_src_link" value="${item.image_src_link || ''}">
        </div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Glass</label>
          <select class="prop-select" data-prop="image_a">${imageOptions(item.image_a)}</select>
        </div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Roughness</label>
          <input type="number" class="prop-input" data-prop="glass_roughness" value="${(item.glass_roughness ?? 0).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Ambient</label>
          <input type="number" class="prop-input" data-prop="glass_ambient" value="${item.glass_ambient ?? 0}" step="1">
        </div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Pad T/B</label>
          <input type="number" class="prop-input" data-prop="glass_pad_top" value="${(item.glass_pad_top ?? 0).toFixed(1)}" step="1" style="width: 40px;">
          <input type="number" class="prop-input" data-prop="glass_pad_bottom" value="${(item.glass_pad_bottom ?? 0).toFixed(1)}" step="1" style="width: 40px;">
        </div>
        <div class="prop-row" style="${isDisplay ? '' : 'display:none'}">
          <label class="prop-label">Pad L/R</label>
          <input type="number" class="prop-input" data-prop="glass_pad_left" value="${(item.glass_pad_left ?? 0).toFixed(1)}" step="1" style="width: 40px;">
          <input type="number" class="prop-input" data-prop="glass_pad_right" value="${(item.glass_pad_right ?? 0).toFixed(1)}" step="1" style="width: 40px;">
        </div>
        <div class="prop-row" style="${isFlasher ? '' : 'display:none'}">
          <label class="prop-label">Image Mode</label>
          <select class="prop-select" data-prop="image_alignment">
            <option value="world"${item.image_alignment === 'world' ? ' selected' : ''}>World</option>
            <option value="wrap"${(item.image_alignment || 'wrap') === 'wrap' ? ' selected' : ''}>Wrap</option>
          </select>
        </div>
        <div class="prop-row" style="${isFlasher ? '' : 'display:none'}">
          <label class="prop-label">A</label>
          <select class="prop-select" data-prop="image_a">${imageOptions(item.image_a)}</select>
        </div>
        <div class="prop-row" style="${isFlasher ? '' : 'display:none'}">
          <label class="prop-label">B</label>
          <select class="prop-select" data-prop="image_b">${imageOptions(item.image_b)}</select>
        </div>
        <div class="prop-row" style="${isFlasher ? '' : 'display:none'}">
          <label class="prop-label">Mix</label>
          <select class="prop-select" data-prop="filter">
            <option value="none"${item.filter === 'none' ? ' selected' : ''}>None</option>
            <option value="additive"${item.filter === 'additive' ? ' selected' : ''}>Additive</option>
            <option value="overlay"${(item.filter || 'overlay') === 'overlay' ? ' selected' : ''}>Overlay</option>
            <option value="multiply"${item.filter === 'multiply' ? ' selected' : ''}>Multiply</option>
            <option value="screen"${item.filter === 'screen' ? ' selected' : ''}>Screen</option>
          </select>
        </div>
        <div class="prop-row" style="${isFlasher ? '' : 'display:none'}">
          <label class="prop-label">Mix Factor</label>
          <input type="number" class="prop-input" data-prop="filter_amount" value="${item.filter_amount ?? FLASHER_DEFAULTS.filter_amount}" step="10" min="0" max="100">
        </div>
        <div class="prop-row" style="${isFlasher ? '' : 'display:none'}">
          <label class="prop-label">Show in Editor</label>
          <input type="checkbox" class="prop-input" data-prop="display_texture" ${item.display_texture !== false ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Transparency</div>
        <div class="prop-row">
          <label class="prop-label">${opacityLabel}</label>
          <input type="number" class="prop-input" data-prop="alpha" value="${item.alpha ?? FLASHER_DEFAULTS.alpha}" step="5" min="0" max="100">
        </div>
        <div class="prop-row" style="${isAlphaSeg ? 'display:none' : ''}">
          <label class="prop-label">Lightmap</label>
          <select class="prop-select" data-prop="light_map">${imageOptions(item.light_map)}</select>
        </div>
        <div class="prop-row" style="${isAlphaSeg ? 'display:none' : ''}">
          <label class="prop-label">Additive Blend</label>
          <input type="checkbox" class="prop-input" data-prop="add_blend" ${item.add_blend ? 'checked' : ''}>
        </div>
        <div class="prop-row" style="${isAlphaSeg ? 'display:none' : ''}">
          <label class="prop-label">Modulate (0..1)</label>
          <input type="number" class="prop-input" data-prop="modulate_vs_add" value="${(item.modulate_vs_add ?? FLASHER_DEFAULTS.modulate_vs_add).toFixed(2)}" step="0.05" min="0" max="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="pos_x" value="${(item.pos_x || 0).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="pos_y" value="${(item.pos_y || 0).toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${(item.height ?? FLASHER_DEFAULTS.height).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotX</label>
          <input type="number" class="prop-input" data-prop="rot_x" value="${(item.rot_x || 0).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotY</label>
          <input type="number" class="prop-input" data-prop="rot_y" value="${(item.rot_y || 0).toFixed(1)}" step="5">
        </div>
        <div class="prop-row">
          <label class="prop-label">RotZ</label>
          <input type="number" class="prop-input" data-prop="rot_z" value="${(item.rot_z || 0).toFixed(1)}" step="5">
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
          <input type="number" class="prop-input" data-prop="timer_interval" value="${item.timer_interval ?? FLASHER_DEFAULTS.timer_interval}" step="10" min="1">
        </div>
      </div>
    </div>
  `;
}
