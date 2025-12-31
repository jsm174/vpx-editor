import { state, elements, undoManager, isItemSelected } from './state.js';
import { getItemNameFromFileName } from '../shared/gameitem-utils.js';
import { VIEW_MODE_3D } from '../shared/constants.js';
import { getCollectionNameForItem, renameItemInAllCollections, saveCollections } from './collections.js';
import { render } from './canvas-renderer.js';
import { refresh3DScene, render3D, is3DInitialized, invalidateItem } from './canvas-renderer-3d.js';
import { loadBackdropImage } from './table-loader.js';
import { objectTypeLabels } from './toolbar-init.js';
import { selectItem, updateItemsList } from './items-panel.js';
import { updateLayersList } from './layers-panel.js';
import {
  flipperProperties,
  bumperProperties,
  lightProperties,
  kickerProperties,
  wallProperties,
  rubberProperties,
  rampProperties,
  gateProperties,
  spinnerProperties,
  hitTargetProperties,
  triggerProperties,
  plungerProperties,
  flasherProperties,
  timerProperties,
  decalProperties,
  textBoxProperties,
  primitiveProperties,
  reelProperties,
  lightSequencerProperties,
  ballProperties,
  partGroupProperties,
} from './objects/index.js';
import {
  materialOptions,
  imageOptions,
  surfaceOptions,
  lightOptions,
  layerOptions,
  collectionOptions,
  soundOptions,
  renderProbeOptions,
} from '../shared/options-generators.js';

export {
  materialOptions,
  imageOptions,
  surfaceOptions,
  lightOptions,
  layerOptions,
  collectionOptions,
  soundOptions,
  renderProbeOptions,
};

const POSITION_PROPS = [
  'center.x',
  'center.y',
  'height',
  'position.x',
  'position.y',
  'position.z',
  'pos.x',
  'pos.y',
  'pos.z',
  'ver1.x',
  'ver1.y',
  'ver2.x',
  'ver2.y',
  'vPosition.x',
  'vPosition.y',
  'vPosition.z',
];

function applyColorGradient(input) {
  const color = input.value;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const darkR = Math.round(r * 0.9);
  const darkG = Math.round(g * 0.9);
  const darkB = Math.round(b * 0.9);
  const darkColor = `rgb(${darkR}, ${darkG}, ${darkB})`;
  input.style.background = `linear-gradient(to right, ${color}, ${darkColor})`;
}

function tableProperties(gamedata) {
  const tonemapperOptions = ['Reinhard', 'Tony McMapface', 'Filmic']
    .map(name => {
      const value = name === 'Reinhard' ? 0 : name === 'Tony McMapface' ? 1 : 2;
      const selected = (gamedata.tone_mapper ?? 0) === value ? ' selected' : '';
      return `<option value="${value}"${selected}>${name}</option>`;
    })
    .join('');

  const lockLabel = state.isTableLocked ? 'Unlock' : 'Lock';
  const lockIcon = state.isTableLocked ? 'locked' : 'unlocked';

  return `
    <div class="prop-header-sticky">
      <div class="prop-row">
        <label class="prop-label">Name</label>
        <img src="icons/${lockIcon}.png" class="prop-lock-icon" alt="${lockLabel}">
        <input type="text" class="prop-input" data-prop="name" value="${gamedata.name || 'Table1'}" readonly style="background: transparent; border-color: transparent; flex: 1;">
        <button class="rename-btn" id="rename-table-btn">Rename</button>
        <button class="rename-btn" id="lock-table-btn">${lockLabel}</button>
      </div>
    </div>

    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="lights">Lights</button>
      <button class="prop-tab" data-tab="physics">Physics</button>
      <button class="prop-tab" data-tab="sound">Sound</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-group-title">Playfield</div>
        <div class="prop-row">
          <label class="prop-label">Material</label>
          <select class="prop-select" data-prop="playfield_material">${materialOptions(gamedata.playfield_material)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="image">${imageOptions(gamedata.image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection Strength (0..100)</label>
          <input type="number" class="prop-input" data-prop="playfield_reflection_strength" value="${Math.round((gamedata.playfield_reflection_strength || 0) * 100)}" step="1" min="0" max="100">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Ball</div>
        <div class="prop-row">
          <label class="prop-label">Ball Image</label>
          <select class="prop-select" data-prop="ball_image">${imageOptions(gamedata.ball_image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Spherical Map</label>
          <input type="checkbox" class="prop-input" data-prop="ball_spherical_mapping" ${gamedata.ball_spherical_mapping !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Decal</label>
          <select class="prop-select" data-prop="ball_image_front">${imageOptions(gamedata.ball_image_front)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Logo Mode</label>
          <input type="checkbox" class="prop-input" data-prop="ball_decal_mode" ${gamedata.ball_decal_mode ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reflection of Playfield (0..X)</label>
          <input type="number" class="prop-input" data-prop="ball_playfield_reflection_strength" value="${(gamedata.ball_playfield_reflection_strength ?? 1).toFixed(2)}" step="0.1" min="0">
        </div>
        <div class="prop-row">
          <label class="prop-label">Default Bulb Intensity Scale</label>
          <input type="number" class="prop-input" data-prop="default_bulb_intensity_scale_on_ball" value="${(gamedata.default_bulb_intensity_scale_on_ball ?? 1).toFixed(2)}" step="0.1" min="0">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Render Options</div>
        <div class="prop-row">
          <label class="prop-label">Enable Ambient Occlusion</label>
          <input type="checkbox" class="prop-input" data-prop="use_ao" ${gamedata.use_ao !== 0 ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Ambient Occlusion Scale</label>
          <input type="number" class="prop-input" data-prop="ao_scale" value="${(gamedata.ao_scale ?? 1.75).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Enable Sc. Sp. Reflections</label>
          <input type="checkbox" class="prop-input" data-prop="use_ssr" ${gamedata.use_ssr !== 0 ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Sc.Sp. Reflections Scale</label>
          <input type="number" class="prop-input" data-prop="ssr_scale" value="${(gamedata.ssr_scale ?? 1).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Bloom Strength</label>
          <input type="number" class="prop-input" data-prop="bloom_strength" value="${(gamedata.bloom_strength ?? 1.8).toFixed(2)}" step="0.1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Tonemapping</label>
          <select class="prop-select" data-prop="tone_mapper">${tonemapperOptions}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Exposure</label>
          <input type="number" class="prop-input" data-prop="exposure" value="${(gamedata.exposure ?? 1).toFixed(2)}" step="0.1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="lights">
      <div class="prop-group">
        <div class="prop-group-title">Environment Lighting</div>
        <div class="prop-row">
          <label class="prop-label">Image</label>
          <select class="prop-select" data-prop="env_image">${imageOptions(gamedata.env_image)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Power</label>
          <input type="number" class="prop-input" data-prop="env_emission_scale" value="${(gamedata.env_emission_scale ?? 1).toFixed(2)}" step="0.1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Overhead Lights 1 & 2</div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input" data-prop="light0_emission" value="${gamedata.light0_emission || '#fffff0'}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Power</label>
          <input type="number" class="prop-input" data-prop="light_emission_scale" value="${(gamedata.light_emission_scale ?? 4000000).toFixed(0)}" step="100000">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="light_height" value="${(gamedata.light_height ?? 5000).toFixed(0)}" step="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Range</label>
          <input type="number" class="prop-input" data-prop="light_range" value="${(gamedata.light_range ?? 4000000).toFixed(0)}" step="100000">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Ambient</label>
          <input type="color" class="prop-input" data-prop="light_ambient" value="${gamedata.light_ambient || '#000000'}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scene Lighting Scale</label>
          <input type="number" class="prop-input" data-prop="global_emission_scale" value="${(gamedata.global_emission_scale ?? 1).toFixed(2)}" step="0.1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="physics">
      <div class="prop-group">
        <div class="prop-group-title">Physics Constants</div>
        <div class="prop-row">
          <label class="prop-label">Gravity Constant</label>
          <input type="number" class="prop-input" data-prop="gravity" value="${(gamedata.gravity ?? 1.76).toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Playfield Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${(gamedata.elasticity ?? 0.25).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Playfield Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elastic_falloff" value="${(gamedata.elastic_falloff ?? 0).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Playfield Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${(gamedata.friction ?? 0.075).toFixed(4)}" step="0.001">
        </div>
        <div class="prop-row">
          <label class="prop-label">Playfield Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter" value="${(gamedata.scatter ?? 0).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Default Elements Scatter</label>
          <input type="number" class="prop-input" data-prop="default_scatter" value="${(gamedata.default_scatter ?? 0).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Overwrite by Global Set</label>
          <select class="prop-select" data-prop="override_physics">
            <option value="0"${(gamedata.override_physics ?? 0) === 0 ? ' selected' : ''}>Disable</option>
            <option value="1"${gamedata.override_physics === 1 ? ' selected' : ''}>Set 1</option>
            <option value="2"${gamedata.override_physics === 2 ? ' selected' : ''}>Set 2</option>
            <option value="3"${gamedata.override_physics === 3 ? ' selected' : ''}>Set 3</option>
            <option value="4"${gamedata.override_physics === 4 ? ' selected' : ''}>Set 4</option>
            <option value="5"${gamedata.override_physics === 5 ? ' selected' : ''}>Set 5</option>
            <option value="6"${gamedata.override_physics === 6 ? ' selected' : ''}>Set 6</option>
            <option value="7"${gamedata.override_physics === 7 ? ' selected' : ''}>Set 7</option>
            <option value="8"${gamedata.override_physics === 8 ? ' selected' : ''}>Set 8</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">including Flipper Physics</label>
          <input type="checkbox" class="prop-input" data-prop="override_physics_flipper" ${gamedata.override_physics_flipper ? 'checked' : ''}>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Dimensions (inches)</div>
        <div class="prop-row">
          <label class="prop-label">Playfield Width</label>
          <input type="number" class="prop-input" data-prop="right" value="${(gamedata.right ?? 952).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Playfield Length</label>
          <input type="number" class="prop-input" data-prop="bottom" value="${(gamedata.bottom ?? 2162).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Top Glass Height</label>
          <input type="number" class="prop-input" data-prop="glass_top_height" value="${(gamedata.glass_top_height ?? 400).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Bottom Glass Height</label>
          <input type="number" class="prop-input" data-prop="glass_bottom_height" value="${(gamedata.glass_bottom_height ?? 0).toFixed(1)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Lockbar Height</label>
          <input type="number" class="prop-input" data-prop="ground_to_lockbar_height" value="${(gamedata.ground_to_lockbar_height ?? 0).toFixed(1)}" step="1">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Difficulty</div>
        <div class="prop-row">
          <label class="prop-label">Slope for Min. Difficulty</label>
          <input type="number" class="prop-input" data-prop="angle_tilt_min" value="${(gamedata.angle_tilt_min ?? 6).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Slope for Max. Difficulty</label>
          <input type="number" class="prop-input" data-prop="angle_tilt_max" value="${(gamedata.angle_tilt_max ?? 6).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Game Difficulty (0..100)</label>
          <input type="number" class="prop-input" data-prop="global_difficulty" value="${Math.round((gamedata.global_difficulty ?? 0.2) * 100)}" step="1" min="0" max="100">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Nudge Time</label>
          <input type="number" class="prop-input" data-prop="nudge_time" value="${(gamedata.nudge_time ?? 5).toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Physics Max. Loops</label>
          <input type="number" class="prop-input" data-prop="physics_max_loops" value="${gamedata.physics_max_loops ?? 0}" step="1">
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="sound">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Sound Effect Volume (0..100)</label>
          <input type="number" class="prop-input" data-prop="table_sound_volume" value="${Math.round((gamedata.table_sound_volume ?? 1) * 100)}" step="1" min="0" max="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Music Volume (0..100)</label>
          <input type="number" class="prop-input" data-prop="table_music_volume" value="${Math.round((gamedata.table_music_volume ?? 1) * 100)}" step="1" min="0" max="100">
        </div>
      </div>
    </div>
  `;
}

let selectedBackglassViewMode = state.backglassViewMode || 'desktop';

function colorToHex(color, swapBgr = false) {
  if (!color) return '#626E8E';
  let hex = null;
  if (typeof color === 'string') {
    if (color.startsWith('#') && color.length === 7) hex = color;
    else if (color.length === 9 && color[2] === '#') hex = color.slice(2);
  }
  if (!hex) return '#626E8E';
  if (swapBgr) {
    const b = hex.slice(1, 3);
    const g = hex.slice(3, 5);
    const r = hex.slice(5, 7);
    return `#${r}${g}${b}`;
  }
  return hex;
}

function getBackglassCameraProps(gamedata, mode) {
  const suffix = mode === 'desktop' ? '_desktop' : mode === 'fullscreen' ? '_fullscreen' : '_full_single_screen';
  return {
    rotation: gamedata[`bg_rotation${suffix}`] ?? 0,
    inclination: gamedata[`bg_inclination${suffix}`] ?? 0,
    layback: gamedata[`bg_layback${suffix}`] ?? 0,
    fov: gamedata[`bg_fov${suffix}`] ?? 45,
    offsetX: gamedata[`bg_offset_x${suffix}`] ?? 0,
    offsetY: gamedata[`bg_offset_y${suffix}`] ?? 0,
    offsetZ: gamedata[`bg_offset_z${suffix}`] ?? 0,
    scaleX: gamedata[`bg_scale_x${suffix}`] ?? 1,
    scaleY: gamedata[`bg_scale_y${suffix}`] ?? 1,
    scaleZ: gamedata[`bg_scale_z${suffix}`] ?? 1,
  };
}

function backglassProperties(gamedata) {
  const cam = getBackglassCameraProps(gamedata, selectedBackglassViewMode);
  const suffix =
    selectedBackglassViewMode === 'desktop'
      ? '_desktop'
      : selectedBackglassViewMode === 'fullscreen'
        ? '_fullscreen'
        : '_full_single_screen';
  const lockLabel = state.isTableLocked ? 'Unlock' : 'Lock';
  const lockIcon = state.isTableLocked ? 'locked' : 'unlocked';

  return `
    <div class="prop-header-sticky">
      <div class="prop-row">
        <label class="prop-label">Name</label>
        <img src="icons/${lockIcon}.png" class="prop-lock-icon" alt="${lockLabel}">
        <input type="text" class="prop-input" data-prop="name" value="${gamedata.name || 'Table1'}" readonly style="background: transparent; border-color: transparent; flex: 1;">
        <button class="rename-btn" id="rename-table-btn">Rename</button>
        <button class="rename-btn" id="lock-table-btn">${lockLabel}</button>
      </div>
    </div>

    <div class="prop-tabs">
      <button class="prop-tab active" data-tab="visuals">Visuals</button>
      <button class="prop-tab" data-tab="camera">Camera</button>
    </div>

    <div class="prop-tab-content active" data-tab="visuals">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Background Color</label>
          <input type="color" class="prop-input" data-prop="backdrop_color" value="${colorToHex(gamedata.backdrop_color, true)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Apply Night->Day cycle</label>
          <input type="checkbox" class="prop-input" data-prop="image_backdrop_night_day" ${gamedata.image_backdrop_night_day ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">DT Image</label>
          <select class="prop-select" data-prop="backglass_image_full_desktop">${imageOptions(gamedata.backglass_image_full_desktop)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">FS Image</label>
          <select class="prop-select" data-prop="backglass_image_full_fullscreen">${imageOptions(gamedata.backglass_image_full_fullscreen)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">FSS Image</label>
          <select class="prop-select" data-prop="backglass_image_full_single_screen">${imageOptions(gamedata.backglass_image_full_single_screen)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Color Grading LookupTable(256x16)</label>
          <select class="prop-select" data-prop="image_color_grade">${imageOptions(gamedata.image_color_grade)}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Enable EMReels</label>
          <input type="checkbox" class="prop-input" data-prop="render_em_reels" ${gamedata.render_em_reels ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Enable Decals</label>
          <input type="checkbox" class="prop-input" data-prop="render_decals" ${gamedata.render_decals ? 'checked' : ''}>
        </div>
      </div>
    </div>

    <div class="prop-tab-content" data-tab="camera">
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">View</label>
          <select class="prop-select" id="backglass-view-selector">
            <option value="desktop"${selectedBackglassViewMode === 'desktop' ? ' selected' : ''}>Desktop (DT)</option>
            <option value="fullscreen"${selectedBackglassViewMode === 'fullscreen' ? ' selected' : ''}>Fullscreen (FS)</option>
            <option value="fss"${selectedBackglassViewMode === 'fss' ? ' selected' : ''}>Full Single Screen (FSS)</option>
          </select>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">View Setup</div>
        <div class="prop-row">
          <label class="prop-label">Inclination</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_inclination${suffix}" value="${cam.inclination.toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">FOV</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_fov${suffix}" value="${cam.fov.toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Layback</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_layback${suffix}" value="${cam.layback.toFixed(2)}" step="0.5">
        </div>
        <div class="prop-row">
          <label class="prop-label">Rotation</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_rotation${suffix}" value="${cam.rotation.toFixed(2)}" step="0.5">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Scale</div>
        <div class="prop-row">
          <label class="prop-label">X Scale</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_scale_x${suffix}" value="${cam.scaleX.toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y Scale</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_scale_y${suffix}" value="${cam.scaleY.toFixed(4)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z Scale</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_scale_z${suffix}" value="${cam.scaleZ.toFixed(4)}" step="0.01">
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Offset</div>
        <div class="prop-row">
          <label class="prop-label">X Offset</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_offset_x${suffix}" value="${cam.offsetX.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y Offset</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_offset_y${suffix}" value="${cam.offsetY.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z Offset</label>
          <input type="number" class="prop-input camera-prop" data-prop="bg_offset_z${suffix}" value="${cam.offsetZ.toFixed(2)}" step="1">
        </div>
      </div>
    </div>
  `;
}

export function updatePropertiesPanel(resetTab = false) {
  const activeTab = resetTab ? null : elements.propertiesContent.querySelector('.prop-tab.active')?.dataset.tab;

  if (state.selectedPartGroup) {
    const group = state.partGroups[state.selectedPartGroup];
    if (group) {
      elements.propertiesTitle.textContent = 'GROUP';
      let html = `
        <div class="prop-header-sticky">
          <div class="prop-row">
            <label class="prop-label">Name</label>
            <span class="prop-value">${state.selectedPartGroup}</span>
          </div>
        </div>
      `;
      html += partGroupProperties(group);
      elements.propertiesContent.innerHTML = html;
      setupPartGroupPropertyHandlers(state.selectedPartGroup);
      restoreActiveTab(activeTab);
      return;
    }
  }

  if (!state.primarySelectedItem) {
    if (state.gamedata) {
      if (state.backglassView) {
        elements.propertiesTitle.textContent = 'BACKGLASS PROPERTIES';
        elements.propertiesContent.innerHTML = backglassProperties(state.gamedata);
        setupBackglassPropertyHandlers();
      } else {
        elements.propertiesTitle.textContent = 'TABLE PROPERTIES';
        elements.propertiesContent.innerHTML = tableProperties(state.gamedata);
        setupTablePropertyHandlers();
      }
      restoreActiveTab(activeTab);
      return;
    }
    elements.propertiesTitle.textContent = 'PROPERTIES';
    elements.propertiesContent.innerHTML = '<p class="placeholder">Select an item to view properties</p>';
    return;
  }

  const item = state.items[state.primarySelectedItem];
  if (!item) return;

  if (state.selectedNode && state.selectedNode.itemName === state.primarySelectedItem && item.drag_points) {
    const nodeIndex = state.selectedNode.nodeIndex;
    const pt = item.drag_points[nodeIndex];
    const v = pt.vertex || pt;
    const isRamp = item._type === 'Ramp';

    elements.propertiesTitle.textContent = 'CONTROL POINT';

    let html = `
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Smooth</label>
          <input type="checkbox" class="prop-input" data-prop="drag_points.${nodeIndex}.smooth" ${pt.smooth ? 'checked' : ''}>
        </div>
    `;

    if (item._type !== 'Flasher') {
      html += `
        <div class="prop-row">
          <label class="prop-label">Auto Texture Coord.</label>
          <input type="checkbox" class="prop-input" data-prop="drag_points.${nodeIndex}.has_auto_texture" ${pt.has_auto_texture !== false ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Texture Coord.</label>
          <input type="number" class="prop-input" data-prop="drag_points.${nodeIndex}.tex_coord" value="${(pt.tex_coord ?? 0).toFixed(4)}" step="0.01">
        </div>
      `;
    }

    html += `
      </div>
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="drag_points.${nodeIndex}.${pt.vertex ? 'vertex.x' : 'x'}" value="${v.x.toFixed(4)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="drag_points.${nodeIndex}.${pt.vertex ? 'vertex.y' : 'y'}" value="${v.y.toFixed(4)}" step="1">
        </div>
    `;

    if (isRamp) {
      const heightBottom = item.height_bottom ?? 0;
      const heightTop = item.height_top ?? 50;
      const t = item.drag_points.length > 1 ? nodeIndex / (item.drag_points.length - 1) : 0;
      const baseHeight = heightBottom + t * (heightTop - heightBottom);
      const heightOffset = v.z ?? 0;
      const calcHeight = baseHeight + heightOffset;

      html += `
        <div class="prop-row">
          <label class="prop-label">Height Offset</label>
          <input type="number" class="prop-input" data-prop="drag_points.${nodeIndex}.${pt.vertex ? 'vertex.z' : 'z'}" value="${heightOffset.toFixed(4)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Real Height</label>
          <input type="number" class="prop-input" value="${calcHeight.toFixed(4)}" readonly style="background: transparent;">
        </div>
      `;
    }

    html += `</div>`;

    elements.propertiesContent.innerHTML = html;

    if (state.isTableLocked) {
      elements.propertiesContent.querySelectorAll('.prop-input').forEach(input => {
        input.disabled = true;
      });
    }

    elements.propertiesContent.querySelectorAll('.prop-input').forEach(input => {
      input.addEventListener('change', async e => {
        if (state.isTableLocked) return;
        const prop = e.target.dataset.prop;
        if (!prop) return;
        let value;
        if (e.target.type === 'checkbox') {
          value = e.target.checked;
        } else if (e.target.type === 'text') {
          value = e.target.value;
        } else {
          value = parseFloat(e.target.value);
        }
        await updateItemProperty(state.primarySelectedItem, prop, value);
      });
    });

    return;
  }

  const isMultiSelect = state.selectedItems.length > 1;

  if (isMultiSelect) {
    const types = [...new Set(state.selectedItems.map(name => state.items[name]?._type).filter(Boolean))];
    if (types.length > 1) {
      elements.propertiesTitle.textContent = 'MULTIPLE SELECTION';
      elements.propertiesContent.innerHTML = '<p class="placeholder">Multiple elements of different types selected</p>';
      return;
    }

    elements.propertiesTitle.textContent = 'PROPERTIES';
  } else {
    const typeLabel = objectTypeLabels[item._type] || item._type;
    elements.propertiesTitle.textContent = `${typeLabel.toUpperCase()} PROPERTIES`;
  }

  const isLocked = item.is_locked === true;

  let nameValue;
  if (isMultiSelect) {
    const collectionName = getCollectionNameForItem(state.primarySelectedItem);
    const typeName = item._type;
    const count = state.selectedItems.length;
    nameValue = collectionName ? `${collectionName} [${typeName}](${count})` : `${typeName}(${count})`;
  } else {
    nameValue = item.name || state.primarySelectedItem;
  }

  let html = `
    <div class="prop-header-sticky">
      <div class="prop-row">
        <label class="prop-label">Name</label>
        <img src="icons/${isLocked ? 'locked' : 'unlocked'}.png" class="prop-lock-icon" alt="${isLocked ? 'Locked' : 'Unlocked'}">
        <input type="text" class="prop-input" data-prop="name" value="${nameValue}" readonly style="background: transparent; border-color: transparent; flex: 1;">
        <button class="rename-btn" id="rename-object-btn"${isLocked || isMultiSelect ? ' disabled' : ''}>Rename</button>
        <button class="rename-btn" id="lock-object-btn">${isLocked ? 'Unlock' : 'Lock'}</button>
      </div>
    </div>
  `;

  const tabbedTypes = [
    'Wall',
    'Surface',
    'Gate',
    'Ramp',
    'Flipper',
    'Plunger',
    'Bumper',
    'Spinner',
    'Timer',
    'Trigger',
    'Light',
    'Kicker',
    'HitTarget',
    'Decal',
    'TextBox',
    'Reel',
    'LightSequencer',
    'Primitive',
    'Flasher',
    'Rubber',
    'Ball',
    'PartGroup',
  ];
  if (item.center && !tabbedTypes.includes(item._type)) {
    html += `
      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="center.x" value="${item.center.x.toFixed(2)}" step="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="center.y" value="${item.center.y.toFixed(2)}" step="1">
        </div>
      </div>
    `;
  }

  switch (item._type) {
    case 'Flipper':
      html += flipperProperties(item);
      break;
    case 'Bumper':
      html += bumperProperties(item);
      break;
    case 'Light':
      html += lightProperties(item);
      break;
    case 'Kicker':
      html += kickerProperties(item);
      break;
    case 'Wall':
    case 'Surface':
      html += wallProperties(item);
      break;
    case 'Rubber':
      html += rubberProperties(item);
      break;
    case 'Ramp':
      html += rampProperties(item);
      break;
    case 'Gate':
      html += gateProperties(item);
      break;
    case 'Spinner':
      html += spinnerProperties(item);
      break;
    case 'HitTarget':
      html += hitTargetProperties(item);
      break;
    case 'Trigger':
      html += triggerProperties(item);
      break;
    case 'Plunger':
      html += plungerProperties(item);
      break;
    case 'Flasher':
      html += flasherProperties(item);
      break;
    case 'Timer':
      html += timerProperties(item);
      break;
    case 'Decal':
      html += decalProperties(item);
      break;
    case 'TextBox':
      html += textBoxProperties(item);
      break;
    case 'Primitive':
      html += primitiveProperties(item);
      break;
    case 'Reel':
      html += reelProperties(item);
      break;
    case 'LightSequencer':
      html += lightSequencerProperties(item);
      break;
    case 'Ball':
      html += ballProperties(item);
      break;
    case 'PartGroup':
      html += partGroupProperties(item);
      break;
  }

  elements.propertiesContent.innerHTML = html;

  const currentItemName = state.primarySelectedItem;

  if (item.is_locked) {
    elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      const prop = input.dataset.prop;
      if (prop && POSITION_PROPS.includes(prop)) {
        input.disabled = true;
      }
    });
  }

  if (state.isTableLocked) {
    elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      input.disabled = true;
    });
  }

  elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
    input.addEventListener('change', async e => {
      if (state.isTableLocked) return;
      const prop = e.target.dataset.prop;
      let value;
      if (e.target.type === 'checkbox') {
        value = e.target.checked;
      } else if (e.target.type === 'color' || e.target.type === 'text') {
        value = e.target.value;
      } else if (e.target.tagName === 'SELECT') {
        value = e.target.value;
        if (e.target.dataset.type === 'int') {
          value = parseInt(value, 10);
        } else if (e.target.dataset.type === 'float') {
          value = parseFloat(value);
        }
      } else {
        value = parseFloat(e.target.value);
      }
      if (e.target.type === 'color') {
        applyColorGradient(e.target);
      }
      const primaryItem = state.items[state.primarySelectedItem];
      const isLightRenderMode = prop === 'render_mode' && primaryItem?._type === 'Light';
      if (isLightRenderMode) {
        for (const itemName of state.selectedItems) {
          if (value === 'hidden') {
            await updateItemProperty(itemName, 'visible', false);
          } else if (value === 'classic') {
            await updateItemProperty(itemName, 'visible', true);
            await updateItemProperty(itemName, 'is_bulb_light', false);
          } else if (value === 'halo') {
            await updateItemProperty(itemName, 'visible', true);
            await updateItemProperty(itemName, 'is_bulb_light', true);
          }
        }
        elements.propertiesContent.querySelectorAll('.render-mode-field').forEach(field => {
          const isClassicHalo = field.classList.contains('classic-halo');
          const isHaloOnly = field.classList.contains('halo-only');
          const isClassicOnly = field.classList.contains('classic-only');
          if (value === 'hidden') {
            field.style.display = 'none';
          } else if (value === 'classic') {
            field.style.display = isClassicHalo || isClassicOnly ? '' : 'none';
          } else if (value === 'halo') {
            field.style.display = isClassicHalo || isHaloOnly ? '' : 'none';
          }
        });
      } else {
        for (const itemName of state.selectedItems) {
          await updateItemProperty(itemName, prop, value);
        }
      }
    });
  });

  elements.propertiesContent.querySelectorAll('input[type="color"]').forEach(input => {
    applyColorGradient(input);
    input.addEventListener('input', e => {
      const prop = e.target.dataset.prop;
      const value = e.target.value;
      applyColorGradient(e.target);
      updateItemPropertyLive(currentItemName, prop, value);
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-input:not([type="checkbox"]), .prop-select').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(
          elements.propertiesContent.querySelectorAll('.prop-input:not([type="checkbox"]), .prop-select')
        ).filter(el => !el.disabled && el.offsetParent !== null);
        const currentIndex = allInputs.indexOf(e.target);
        if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1].focus();
          if (allInputs[currentIndex + 1].select) {
            allInputs[currentIndex + 1].select();
          }
        }
      }
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      const tabName = e.target.dataset.tab;
      elements.propertiesContent.querySelectorAll('.prop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      elements.propertiesContent.querySelectorAll('.prop-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tab === tabName);
      });
    });
  });

  const importBtn = elements.propertiesContent.querySelector('#btn-import-mesh');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      const filename = importBtn.dataset.filename;
      if (!filename) return;
      await window.vpxEditor.importMesh(filename);
    });
  }

  const exportBtn = elements.propertiesContent.querySelector('#btn-export-mesh');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const filename = exportBtn.dataset.filename;
      const name = exportBtn.dataset.name || 'mesh';
      if (!filename) return;
      const result = await window.vpxEditor.exportMesh(filename, `${name}.obj`);
      if (result.success) {
        elements.statusBar.textContent = `Mesh exported to ${result.path}`;
      } else if (result.error) {
        elements.statusBar.textContent = `Export failed: ${result.error}`;
      }
    });
  }

  const renameBtn = elements.propertiesContent.querySelector('#rename-object-btn');
  if (renameBtn) {
    if (state.isTableLocked) {
      renameBtn.disabled = true;
    }
    renameBtn.addEventListener('click', () => {
      if (state.isTableLocked) return;
      showRenameModal(state.primarySelectedItem);
    });
  }

  const lockBtn = elements.propertiesContent.querySelector('#lock-object-btn');
  if (lockBtn) {
    if (state.isTableLocked) {
      lockBtn.disabled = true;
    }
    lockBtn.addEventListener('click', async () => {
      if (state.isTableLocked) return;
      const primaryItem = state.items[state.primarySelectedItem];
      if (!primaryItem) return;

      const newLockState = !primaryItem.is_locked;
      undoManager.beginUndo(newLockState ? 'Lock' : 'Unlock');

      for (const itemName of state.selectedItems) {
        const item = state.items[itemName];
        if (!item) continue;

        undoManager.markForUndo(itemName);
        item.is_locked = newLockState;

        const gameitemEntry = state.gameitems.find(gi => gi.file_name === item._fileName.replace('gameitems/', ''));
        if (gameitemEntry) {
          gameitemEntry.is_locked = item.is_locked;
        }

        if (item.is_locked && state.selectedNode?.itemName === itemName) {
          state.selectedNode = null;
        }
      }

      await window.vpxEditor.writeFile(
        `${state.extractedDir}/gameitems.json`,
        JSON.stringify(state.gameitems, null, 2)
      );

      undoManager.endUndo();
      updatePropertiesPanel();
      updateItemsList();
      render();
    });
  }

  restoreActiveTab(activeTab);
}

function restoreActiveTab(tabName) {
  if (!tabName) return;
  const tab = elements.propertiesContent.querySelector(`.prop-tab[data-tab="${tabName}"]`);
  if (tab) {
    elements.propertiesContent.querySelectorAll('.prop-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    elements.propertiesContent.querySelectorAll('.prop-tab-content').forEach(c => {
      c.classList.toggle('active', c.dataset.tab === tabName);
    });
  }
}

function updateItemPropertyLive(itemName, prop, value) {
  const item = state.items[itemName];
  if (!item) return;

  const path = prop.split('.');
  let target = item;
  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i]];
  }
  const finalKey = path[path.length - 1];
  const key = /^\d+$/.test(finalKey) ? parseInt(finalKey, 10) : finalKey;
  target[key] = value;

  invalidateItem(itemName);
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    render3D();
  } else {
    render();
  }
}

async function updateItemProperty(itemName, prop, value) {
  const item = state.items[itemName];
  if (!item) return;

  if (item.is_locked && POSITION_PROPS.includes(prop)) {
    elements.statusBar.textContent = `Cannot change position of locked item`;
    updatePropertiesPanel();
    return;
  }

  undoManager.beginUndo(`Change ${prop}`);
  undoManager.markForUndo(itemName);

  const path = prop.split('.');
  let target = item;
  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i]];
  }
  const finalKey = path[path.length - 1];
  const key = /^\d+$/.test(finalKey) ? parseInt(finalKey, 10) : finalKey;
  target[key] = value;

  const fileName = item._fileName;
  const type = item._type;

  const saveData = { [type]: { ...item } };
  delete saveData[type]._type;
  delete saveData[type]._fileName;
  delete saveData[type]._layer;
  delete saveData[type].is_locked;

  const result = await window.vpxEditor.writeFile(
    `${state.extractedDir}/${fileName}`,
    JSON.stringify(saveData, null, 2)
  );

  if (result.success) {
    undoManager.endUndo();
    elements.statusBar.textContent = `Updated ${itemName}.${prop}`;
    invalidateItem(itemName);
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      render3D();
    } else {
      render();
    }
    const focusedProp = document.activeElement?.dataset?.prop;
    updatePropertiesPanel();
    if (focusedProp) {
      const inputToFocus = elements.propertiesContent.querySelector(`[data-prop="${focusedProp}"]`);
      if (inputToFocus) {
        inputToFocus.focus();
        if (inputToFocus.select) {
          inputToFocus.select();
        }
      }
    }
  } else {
    undoManager.cancelUndo();
    elements.statusBar.textContent = `Failed to save: ${result.error}`;
  }
}

function setupTablePropertyHandlers() {
  if (state.isTableLocked) {
    elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      input.disabled = true;
    });
  }

  elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
    input.addEventListener('change', async e => {
      if (state.isTableLocked) return;
      const prop = e.target.dataset.prop;
      let value;
      if (e.target.type === 'checkbox') {
        value = e.target.checked;
        if (prop === 'use_ao' || prop === 'use_ssr') {
          value = e.target.checked ? -1 : 0;
        }
      } else if (e.target.type === 'color' || e.target.type === 'text') {
        value = e.target.value;
      } else if (e.target.tagName === 'SELECT') {
        value = e.target.value;
        if (prop === 'tone_mapper' || prop === 'override_physics') {
          value = parseInt(e.target.value);
        }
      } else {
        value = parseFloat(e.target.value);
        if (prop === 'playfield_reflection_strength') {
          value = value / 100;
        } else if (prop === 'global_difficulty') {
          value = value / 100;
        } else if (prop === 'table_sound_volume' || prop === 'table_music_volume') {
          value = value / 100;
        }
      }

      undoManager.beginUndo(`Change table ${prop}`);
      undoManager.markGamedataForUndo();

      state.gamedata[prop] = value;

      const result = await window.vpxEditor.writeFile(
        `${state.extractedDir}/gamedata.json`,
        JSON.stringify(state.gamedata, null, 2)
      );

      if (result.success) {
        undoManager.endUndo();
        elements.statusBar.textContent = `Updated table.${prop}`;
        if (prop === 'image') {
          if (value) {
            await loadBackdropImage(value);
          } else {
            state.backdropImage = null;
          }
        }
        const focusedInput = document.activeElement;
        if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
          refresh3DScene();
        } else {
          render();
        }
        if (focusedInput && focusedInput.dataset?.prop) {
          focusedInput.focus();
          if (focusedInput.select) {
            focusedInput.select();
          }
        }
      } else {
        undoManager.cancelUndo();
        elements.statusBar.textContent = `Failed to save: ${result.error}`;
      }

      if (e.target.type === 'color') {
        applyColorGradient(e.target);
      }
    });
  });

  elements.propertiesContent.querySelectorAll('input[type="color"]').forEach(input => {
    applyColorGradient(input);
    input.addEventListener('input', e => {
      const prop = e.target.dataset.prop;
      const value = e.target.value;
      applyColorGradient(e.target);
      state.gamedata[prop] = value;
      if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
        refresh3DScene();
      } else {
        render();
      }
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-input:not([type="checkbox"]), .prop-select').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(
          elements.propertiesContent.querySelectorAll('.prop-input:not([type="checkbox"]), .prop-select')
        ).filter(el => !el.disabled && el.offsetParent !== null);
        const currentIndex = allInputs.indexOf(e.target);
        if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1].focus();
          if (allInputs[currentIndex + 1].select) {
            allInputs[currentIndex + 1].select();
          }
        }
      }
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      const tabName = e.target.dataset.tab;
      elements.propertiesContent.querySelectorAll('.prop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      elements.propertiesContent.querySelectorAll('.prop-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tab === tabName);
      });
    });
  });

  const lockTableBtn = elements.propertiesContent.querySelector('#lock-table-btn');
  if (lockTableBtn) {
    lockTableBtn.addEventListener('click', () => {
      window.vpxEditor.toggleTableLock?.();
    });
  }

  const renameBtn = elements.propertiesContent.querySelector('#rename-table-btn');
  if (renameBtn) {
    if (state.isTableLocked) {
      renameBtn.disabled = true;
    }
    renameBtn.addEventListener('click', () => {
      if (state.isTableLocked) return;
      showRenameTableModal();
    });
  }
}

function showRenameTableModal() {
  const oldName = state.gamedata.name || 'Table1';
  window.vpxEditor.showRenameDialog({
    mode: 'table',
    currentName: oldName,
    existingNames: [],
  });
}

export async function renameTable(newName) {
  const oldName = state.gamedata.name || 'Table1';
  if (newName === oldName) return;

  undoManager.beginUndo('Rename table');
  undoManager.markGamedataForUndo();

  state.gamedata.name = newName;

  const result = await window.vpxEditor.writeFile(
    `${state.extractedDir}/gamedata.json`,
    JSON.stringify(state.gamedata, null, 2)
  );

  if (result.success) {
    undoManager.endUndo();
    updatePropertiesPanel();
    elements.statusBar.textContent = `Renamed table to "${newName}"`;
  } else {
    undoManager.cancelUndo();
    elements.statusBar.textContent = `Failed to rename: ${result.error}`;
  }
}

function setupBackglassPropertyHandlers() {
  if (state.isTableLocked) {
    elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      if (input.id !== 'backglass-view-selector') {
        input.disabled = true;
      }
    });
  }

  elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
    if (input.id === 'backglass-view-selector') return;

    input.addEventListener('change', async e => {
      if (state.isTableLocked) return;
      const prop = e.target.dataset.prop;
      if (!prop) return;

      let value;
      if (e.target.type === 'checkbox') {
        value = e.target.checked;
      } else if (e.target.type === 'color') {
        const hex = e.target.value;
        const r = hex.slice(1, 3);
        const g = hex.slice(3, 5);
        const b = hex.slice(5, 7);
        value = `#${b}${g}${r}`;
      } else if (e.target.type === 'text' || e.target.tagName === 'SELECT') {
        value = e.target.value;
      } else {
        value = parseFloat(e.target.value);
      }

      undoManager.beginUndo(`Change backglass ${prop}`);
      undoManager.markGamedataForUndo();

      state.gamedata[prop] = value;

      const result = await window.vpxEditor.writeFile(
        `${state.extractedDir}/gamedata.json`,
        JSON.stringify(state.gamedata, null, 2)
      );

      if (result.success) {
        undoManager.endUndo();
        elements.statusBar.textContent = `Updated backglass.${prop}`;
        const focusedInput = document.activeElement;
        if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
          refresh3DScene();
        } else {
          render();
        }
        if (focusedInput && focusedInput.dataset?.prop) {
          focusedInput.focus();
          if (focusedInput.select) {
            focusedInput.select();
          }
        }
      } else {
        undoManager.cancelUndo();
        elements.statusBar.textContent = `Failed to save: ${result.error}`;
      }

      if (e.target.type === 'color') {
        applyColorGradient(e.target);
      }
    });
  });

  elements.propertiesContent.querySelectorAll('input[type="color"]').forEach(input => {
    applyColorGradient(input);
    input.addEventListener('input', e => {
      applyColorGradient(e.target);
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-input:not([type="checkbox"]), .prop-select').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(
          elements.propertiesContent.querySelectorAll('.prop-input:not([type="checkbox"]), .prop-select')
        ).filter(el => !el.disabled && el.offsetParent !== null);
        const currentIndex = allInputs.indexOf(e.target);
        if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1].focus();
          if (allInputs[currentIndex + 1].select) {
            allInputs[currentIndex + 1].select();
          }
        }
      }
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      const tabName = e.target.dataset.tab;
      elements.propertiesContent.querySelectorAll('.prop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      elements.propertiesContent.querySelectorAll('.prop-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tab === tabName);
      });
    });
  });

  const viewSelector = document.getElementById('backglass-view-selector');
  if (viewSelector) {
    viewSelector.addEventListener('change', e => {
      selectedBackglassViewMode = e.target.value;
      state.backglassViewMode = e.target.value;
      render();
      updatePropertiesPanel();
    });
  }

  const lockTableBtn = elements.propertiesContent.querySelector('#lock-table-btn');
  if (lockTableBtn) {
    lockTableBtn.addEventListener('click', () => {
      window.vpxEditor.toggleTableLock?.();
    });
  }

  const renameBtn = elements.propertiesContent.querySelector('#rename-table-btn');
  if (renameBtn) {
    if (state.isTableLocked) {
      renameBtn.disabled = true;
    }
    renameBtn.addEventListener('click', () => {
      if (state.isTableLocked) return;
      showRenameTableModal();
    });
  }
}

function setupPartGroupPropertyHandlers(groupName) {
  if (!state.partGroups[groupName]) return;

  if (state.isTableLocked) {
    elements.propertiesContent.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      input.disabled = true;
    });
  }

  elements.propertiesContent.querySelectorAll('.prop-input[data-mask]').forEach(input => {
    input.addEventListener('change', async e => {
      if (state.isTableLocked) return;
      const group = state.partGroups[groupName];
      if (!group) return;

      const mask = parseInt(e.target.dataset.mask);
      const checked = e.target.checked;

      undoManager.beginUndo(`Change group visibility`);
      undoManager.markForUndo(groupName);

      let currentMask = group.player_mode_visibility_mask ?? 0xffff;
      if (checked) {
        currentMask |= mask;
      } else {
        currentMask &= ~mask;
      }
      group.player_mode_visibility_mask = currentMask;

      await savePartGroup(groupName, group);
      undoManager.endUndo();
      elements.statusBar.textContent = `Updated group visibility`;
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-input:not([data-mask]), .prop-select').forEach(input => {
    input.addEventListener('change', async e => {
      if (state.isTableLocked) return;
      const group = state.partGroups[groupName];
      if (!group) return;

      const prop = e.target.dataset.prop;
      if (!prop) return;

      let value;
      if (e.target.type === 'checkbox') {
        value = e.target.checked;
      } else if (e.target.tagName === 'SELECT') {
        value = e.target.value;
      } else {
        value = parseFloat(e.target.value);
        if (isNaN(value)) value = e.target.value;
      }

      undoManager.beginUndo(`Change group ${prop}`);
      undoManager.markForUndo(groupName);

      group[prop] = value;

      await savePartGroup(groupName, group);
      undoManager.endUndo();
      elements.statusBar.textContent = `Updated group.${prop}`;
    });
  });

  elements.propertiesContent.querySelectorAll('.prop-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      const tabName = e.target.dataset.tab;
      elements.propertiesContent.querySelectorAll('.prop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      elements.propertiesContent.querySelectorAll('.prop-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tab === tabName);
      });
    });
  });
}

async function savePartGroup(groupName, group) {
  const fileName = group._fileName;
  if (!fileName) return;

  const saveData = { ...group };
  delete saveData._type;
  delete saveData._fileName;
  delete saveData._layer;
  saveData.is_locked = saveData.is_locked ?? false;

  const result = await window.vpxEditor.writeFile(
    `${state.extractedDir}/${fileName}`,
    JSON.stringify({ PartGroup: saveData }, null, 2)
  );

  return result;
}

export function showRenameModal(itemName) {
  const existingNames = Object.keys(state.items);
  window.vpxEditor.showRenameDialog({
    mode: 'element',
    currentName: itemName,
    existingNames,
  });
}

export async function renameObject(oldName, newName) {
  const item = state.items[oldName];
  if (!item) {
    elements.statusBar.textContent = `Object "${oldName}" not found`;
    return;
  }

  const type = item._type;
  const oldFileName = item._fileName;
  const newFileName = `gameitems/${type}.${newName}.json`;

  undoManager.beginUndo(`Rename ${oldName}`);
  undoManager.markForRename(oldName, newName, oldFileName, newFileName);

  const oldPath = `${state.extractedDir}/${oldFileName}`;
  const newPath = `${state.extractedDir}/${newFileName}`;
  const renameResult = await window.vpxEditor.renameFile(oldPath, newPath);
  if (!renameResult.success) {
    undoManager.cancelUndo();
    elements.statusBar.textContent = `Rename failed: ${renameResult.error}`;
    return;
  }

  if (type === 'Primitive') {
    const oldObjPath = oldPath.replace('.json', '.obj');
    const newObjPath = newPath.replace('.json', '.obj');
    await window.vpxEditor.renameFile(oldObjPath, newObjPath);
  }

  item.name = newName;
  item._fileName = newFileName;

  const saveData = { [type]: { ...item } };
  delete saveData[type]._type;
  delete saveData[type]._fileName;
  delete saveData[type]._layer;
  delete saveData[type].is_locked;

  const writeResult = await window.vpxEditor.writeFile(newPath, JSON.stringify(saveData, null, 2));
  if (!writeResult.success) {
    undoManager.cancelUndo();
    elements.statusBar.textContent = `Failed to update object file: ${writeResult.error}`;
    return;
  }

  delete state.items[oldName];
  state.items[newName] = item;

  const gameitemsPath = `${state.extractedDir}/gameitems.json`;
  const gameitemsResult = await window.vpxEditor.readFile(gameitemsPath);
  if (gameitemsResult.success) {
    const gameitems = JSON.parse(gameitemsResult.content);
    const itemInfo = gameitems.find(i => i.file_name && getItemNameFromFileName(i.file_name) === oldName);
    if (itemInfo) {
      itemInfo.file_name = `${type}.${newName}.json`;
      await window.vpxEditor.writeFile(gameitemsPath, JSON.stringify(gameitems, null, 2));
      state.gameitems = gameitems;
    }
  }

  if (renameItemInAllCollections(oldName, newName)) {
    undoManager.markCollectionsForUndo();
    await saveCollections();
  }

  undoManager.endUndo();
  state.primarySelectedItem = newName;

  updateItemsList();
  updateLayersList();
  selectItem(newName, true);

  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    invalidateItem(oldName);
    render3D();
  } else {
    render();
  }

  elements.statusBar.textContent = `Renamed "${oldName}" to "${newName}"`;
}

export { updateItemProperty };
